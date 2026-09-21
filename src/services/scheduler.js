const cron = require("node-cron");
const moment = require("moment-timezone");
const db = require("../db");
// Service-role client: the scheduler runs outside any user session, so it must
// bypass RLS to read all user profiles and look up each user's auth email.
const { supabaseAdmin: supabase } = require("../supabase");
const { getOrFetchTodayTimes, todayStr } = require("./prayerTimes");
const { sendMail, reminderEmailHtml, followupEmailHtml } = require("./email");
const { createResponseToken } = require("../utils/token");

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
// "Before prayer" reminder is sent this many minutes ahead of the prayer time.
const PRE_REMINDER_MIN = Number(process.env.PRE_REMINDER_MINUTES || 15);
const FOLLOWUP_DELAY_MIN = Number(process.env.FOLLOWUP_DELAY_MINUTES || 45);
const MISSED_AFTER_MIN = Number(process.env.MISSED_AFTER_MINUTES || 180);
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function alreadyLogged(userId, prayerName, date, type) {
  const existing = await db.getNotificationLog(userId, prayerName, date, type);
  return !!existing;
}

async function logNotification(userId, prayerName, date, type) {
  try {
    await db.createNotificationLog({
      user_id: userId,
      prayer_name: prayerName,
      date: date,
      type: type
    });
  } catch (error) {
    // Ignore duplicate errors
    if (!error.message.includes('duplicate')) {
      console.error(`[scheduler] Error logging notification:`, error);
    }
  }
}

async function upsertPendingResponse(userId, groupId, prayerName, date) {
  try {
    const existing = await db.getResponse(userId, prayerName, date);
    if (!existing) {
      await db.createResponse({
        user_id: userId,
        group_id: groupId,
        prayer_name: prayerName,
        date: date,
        status: 'pending'
      });
    }
  } catch (error) {
    console.error(`[scheduler] Error upserting response:`, error);
  }
}

/**
 * Core tick: runs every few minutes. For every user with a city set,
 * figures out (in THEIR local timezone) whether a prayer time has just
 * been reached, and whether a follow-up is due, and whether an unanswered
 * prayer should be auto-marked missed.
 */
async function tick() {
  const now = moment.utc();
  
  // Get all users with city and country set from Supabase
  const { data: profiles, error: userError } = await supabase
    .from('user_profiles')
    .select('*')
    .not('city', 'is', null)
    .not('country', 'is', null);
  
  if (userError) {
    console.error('[scheduler] Error fetching users:', userError);
    return;
  }

  for (const user of profiles) {
    try {
      const row = await getOrFetchTodayTimes(user);
      if (!row || !row.timezone) continue;

      const date = row.date;

      for (const prayerName of PRAYERS) {
        const timeStr = row[prayerName.toLowerCase()];
        if (!timeStr) continue;

        // Build the exact UTC instant for this prayer, in the user's own timezone.
        const prayerMoment = moment.tz(`${date} ${timeStr}`, "YYYY-MM-DD HH:mm", row.timezone);
        if (!prayerMoment.isValid()) continue;

        const minutesSincePrayer = now.diff(prayerMoment, "minutes"); // >0 once the time has passed
        const minutesUntilPrayer = prayerMoment.diff(now, "minutes");  // >0 while still upcoming

        // 1) BEFORE the prayer: a single "time to prepare" reminder, sent within the
        //    lead window ahead of the prayer time (default: 15 minutes before).
        if (minutesUntilPrayer > 0 && minutesUntilPrayer <= PRE_REMINDER_MIN) {
          if (!(await alreadyLogged(user.id, prayerName, date, "reminder"))) {
            // Get user email from auth.users
            const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
            if (!authUser.user) continue;

            const result = await sendMail({
              to: authUser.user.email,
              subject: `🕌 ${prayerName} is at ${timeStr} — time to prepare`,
              html: reminderEmailHtml(user, prayerName, timeStr),
            });
            
            if (result.success) {
              await logNotification(user.id, prayerName, date, "reminder");
              await upsertPendingResponse(user.id, user.group_id, prayerName, date);
            } else {
              console.error(`[scheduler] Failed to send reminder email to ${authUser.user.email}: ${result.error}`);
            }
          }
        }

        // 2) Send the "did you pray?" follow-up after the configured delay.
        if (minutesSincePrayer >= FOLLOWUP_DELAY_MIN && minutesSincePrayer <= FOLLOWUP_DELAY_MIN + 10) {
          if (!(await alreadyLogged(user.id, prayerName, date, "followup"))) {
            const token = createResponseToken(user.id, prayerName, date);
            const yesUrl = `${BASE_URL}/respond?token=${token}&action=yes`;
            const noUrl = `${BASE_URL}/respond?token=${token}&action=no`;
            
            // Get user email from auth.users
            const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
            if (!authUser.user) continue;
            
            const result = await sendMail({
              to: authUser.user.email,
              subject: `Did you pray ${prayerName}?`,
              html: followupEmailHtml(user, prayerName, date, yesUrl, noUrl),
            });
            
            if (result.success) {
              await logNotification(user.id, prayerName, date, "followup");
              
              // Update response with followup timestamp
              const existing = await db.getResponse(user.id, prayerName, date);
              if (existing) {
                await db.updateResponse(existing.id, {
                  followup_sent_at: new Date().toISOString()
                });
              }
            } else {
              console.error(`[scheduler] Failed to send follow-up email to ${authUser.user.email}: ${result.error}`);
            }
          }
        }

        // 3) Auto-mark "missed" if still pending long after the prayer time.
        if (minutesSincePrayer >= MISSED_AFTER_MIN) {
          const existing = await db.getResponse(user.id, prayerName, date);
          if (existing && existing.status === 'pending') {
            await db.updateResponse(existing.id, {
              status: 'missed'
            });
          }
        }
      }
    } catch (err) {
      console.error(`[scheduler] error for user ${user.id}:`, err.message);
    }
  }
}

function start() {
  // Every 5 minutes. Adjust the cron expression if you want it more/less frequent.
  cron.schedule("*/5 * * * *", () => {
    tick().catch((e) => console.error("[scheduler] tick failed:", e));
  });

  // Also run once shortly after startup so today's data populates immediately.
  setTimeout(() => tick().catch((e) => console.error("[scheduler] initial tick failed:", e)), 5000);

  console.log("[scheduler] started — checking every 5 minutes");
}

// Export both start and tick for flexibility
module.exports = { start, tick };
