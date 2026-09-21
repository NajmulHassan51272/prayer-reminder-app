const axios = require("axios");
const moment = require("moment-timezone");
const db = require("../db");
// Service-role client: profile queries here run outside a user session and must
// bypass RLS (the anon key returns zero rows under RLS).
const { supabaseAdmin: supabase } = require("../supabase");

const METHOD = process.env.PRAYER_CALC_METHOD || 1;
const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

/**
 * Calls the free Aladhan API to get today's 5 prayer times for a city/country.
 * Docs: https://aladhan.com/prayer-times-api
 */
async function fetchTimesFromApi(city, country, date) {
  // date format required by Aladhan: DD-MM-YYYY
  const [yyyy, mm, dd] = date.split("-");
  const dateStr = `${dd}-${mm}-${yyyy}`;

  const url = `https://api.aladhan.com/v1/timingsByCity/${dateStr}`;
  const res = await axios.get(url, {
    params: { city, country, method: METHOD },
    timeout: 10000,
  });

  if (!res.data || res.data.code !== 200) {
    throw new Error("Aladhan API did not return a valid response");
  }

  const timings = res.data.data.timings;
  const timezone = res.data.data.meta.timezone;

  // Timings come back like "05:12 (PKT)" sometimes — strip anything after a space.
  const clean = (t) => (t || "").split(" ")[0];

  return {
    timezone,
    fajr: clean(timings.Fajr),
    dhuhr: clean(timings.Dhuhr),
    asr: clean(timings.Asr),
    maghrib: clean(timings.Maghrib),
    isha: clean(timings.Isha),
  };
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC calendar date)
}

function tomorrowStr() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetches (if missing) and returns prayer times for a user on a given date,
 * caching in DB. Defaults to today. This is what keeps times auto-updating —
 * since Maghrib/Fajr shift a little every day, we never hardcode a time; we
 * always ask the API for the requested day and store it.
 */
async function getOrFetchTimesForDate(user, date) {
  const existing = await db.getPrayerTime(user.id, date);
  if (existing) return existing;

  if (!user.city || !user.country) return null;

  const times = await fetchTimesFromApi(user.city, user.country, date);

  await db.createPrayerTime({
    user_id: user.id,
    date: date,
    timezone: times.timezone,
    fajr: times.fajr,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
    fetched_at: new Date().toISOString()
  });

  return await db.getPrayerTime(user.id, date);
}

/**
 * Fetches (if missing) and returns today's prayer times for a user, caching in DB.
 */
async function getOrFetchTodayTimes(user) {
  return getOrFetchTimesForDate(user, todayStr());
}

/**
 * Works out which prayer is next for this user, and exactly when it falls,
 * using their own city's timezone. If every prayer for today has already
 * passed, it rolls over to tomorrow's Fajr instead.
 * Returns { name, atUTC: Date, isTomorrow: boolean } or null if unavailable.
 */
async function computeNextPrayer(user) {
  const todayRow = await getOrFetchTimesForDate(user, todayStr());
  if (!todayRow || !todayRow.timezone) return null;

  const now = moment.utc();

  for (const prayerName of PRAYERS) {
    const timeStr = todayRow[prayerName.toLowerCase()];
    if (!timeStr) continue;
    const prayerMoment = moment.tz(`${todayRow.date} ${timeStr}`, "YYYY-MM-DD HH:mm", todayRow.timezone);
    if (!prayerMoment.isValid()) continue;
    if (prayerMoment.isAfter(now)) {
      return { name: prayerName, atUTC: prayerMoment.utc().toDate(), isTomorrow: false };
    }
  }

  // Every prayer today has passed — fall back to tomorrow's Fajr.
  try {
    const tomorrowRow = await getOrFetchTimesForDate(user, tomorrowStr());
    if (tomorrowRow && tomorrowRow.fajr && tomorrowRow.timezone) {
      const fajrMoment = moment.tz(
        `${tomorrowRow.date} ${tomorrowRow.fajr}`,
        "YYYY-MM-DD HH:mm",
        tomorrowRow.timezone
      );
      if (fajrMoment.isValid()) {
        return { name: "Fajr", atUTC: fajrMoment.utc().toDate(), isTomorrow: true };
      }
    }
  } catch (err) {
    // If tomorrow's times can't be fetched, just skip the countdown rather than error out.
  }
  return null;
}

/**
 * Refreshes today's prayer times for every user who has a city set.
 * Intended to be called once a day by the scheduler, and also works
 * fine to call more often since it's cached per (user, date).
 */
async function refreshAllUsersToday() {
  // Get all users with city and country set
  // Since we're using Supabase, we need to query differently
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('*')
    .not('city', 'is', null)
    .not('country', 'is', null);
  
  if (error) {
    console.error('[refreshAllUsersToday] Error fetching users:', error);
    return [];
  }

  const results = [];
  for (const user of profiles) {
    try {
      const times = await getOrFetchTodayTimes(user);
      results.push({ user_id: user.id, ok: true, times });
    } catch (err) {
      results.push({ user_id: user.id, ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = {
  fetchTimesFromApi,
  getOrFetchTodayTimes,
  getOrFetchTimesForDate,
  refreshAllUsersToday,
  computeNextPrayer,
  todayStr,
  tomorrowStr,
};
