const express = require("express");
const db = require("../db");
const { requireLogin, requireGroupAdmin } = require("../middleware/auth");
const { getOrFetchTodayTimes, todayStr, computeNextPrayer } = require("../services/prayerTimes");
const { REMINDERS, reminderOfTheDay } = require("../data/reminders");

const router = express.Router();
const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

router.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/dashboard");
  res.render("landing", { reminders: REMINDERS });
});

router.get("/dashboard", requireLogin, async (req, res) => {
  const user = req.user;
  let group = null;
  let memberCount = 0;
  if (user.group_id) {
    group = await db.getGroupById(user.group_id);
    const members = await db.getGroupMembers(user.group_id);
    memberCount = members.length;
  }

  let todayTimes = null;
  let apiError = null;
  let nextPrayer = null;
  try {
    todayTimes = await getOrFetchTodayTimes(user);
    nextPrayer = await computeNextPrayer(user);
  } catch (err) {
    apiError = "Could not fetch prayer times right now. Try again shortly.";
  }

  const date = todayStr();
  const todayResponses = await db.getResponsesByUser(user.id);
  const todayResponsesFiltered = todayResponses.filter(r => r.date === date);
  const statusMap = {};
  todayResponsesFiltered.forEach((r) => (statusMap[r.prayer_name] = r.status));
  
  // Calculate completed prayers for progress indicator
  const completedCount = Object.values(statusMap).filter(status => status === 'done').length;

  const recentHistory = await db.getResponsesByUser(user.id);
  const recentHistoryLimited = recentHistory.slice(0, 25);

  const isAdmin = !!(group && group.created_by === user.id);

  res.render("dashboard", {
    user,
    group,
    memberCount,
    todayTimes,
    apiError,
    statusMap,
    PRAYERS,
    recentHistory: recentHistoryLimited,
    isAdmin,
    reminder: reminderOfTheDay(),
    nextPrayer,
    today: date,
    completedCount,
  });
});

// Let a logged-in user mark their own prayer as done/missed directly from the dashboard.
router.post("/prayer/mark", requireLogin, async (req, res) => {
  const { prayer_name, date, status } = req.body;

  if (!PRAYERS.includes(prayer_name)) return res.status(400).send("Unknown prayer.");
  if (!["done", "missed"].includes(status)) return res.status(400).send("Invalid status.");
  if (!date) return res.status(400).send("Missing date.");

  try {
    // Check if response already exists
    const existing = await db.getResponse(req.user.id, prayer_name, date);
    
    if (existing) {
      // Update existing response
      await db.updateResponse(existing.id, {
        status: status,
        responded_at: new Date().toISOString()
      });
    } else {
      // Create new response
      await db.createResponse({
        user_id: req.user.id,
        group_id: req.user.group_id,
        prayer_name: prayer_name,
        date: date,
        status: status,
        responded_at: new Date().toISOString()
      });
    }

    res.redirect("/dashboard");
  } catch (error) {
    console.error(`[prayer-mark] Error:`, error);
    res.status(500).send("Failed to mark prayer.");
  }
});

router.get("/admin", requireLogin, requireGroupAdmin, async (req, res) => {
  const group = req.group;
  const date = todayStr();

  const members = await db.getGroupMembers(group.id);

  const rows = await Promise.all(members.map(async (m) => {
    const todayResponses = await db.getResponsesByUser(m.id);
    const todayResponsesFiltered = todayResponses.filter(r => r.date === date);
    const statusMap = {};
    todayResponsesFiltered.forEach((r) => (statusMap[r.prayer_name] = r.status));

    const allTimeResponses = await db.getResponsesByUser(m.id);
    const done = allTimeResponses.filter(r => r.status === 'done').length;
    const total = allTimeResponses.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : null;

    return { member: m, statusMap, pct };
  }));

  // Per-prayer summary for today: how many of the group's members have
  // completed each prayer so far, out of the total member count.
  const prayerSummary = PRAYERS.map((p) => {
    const done = rows.filter((r) => r.statusMap[p] === "done").length;
    const missed = rows.filter((r) => r.statusMap[p] === "missed").length;
    return { name: p, done, missed, total: members.length };
  });

  res.render("admin", { group, rows, PRAYERS, date, memberCount: members.length, prayerSummary, user: req.user });
});

// Admin-only: inspect one member's full prayer history in detail.
router.get("/admin/member/:userId", requireLogin, requireGroupAdmin, async (req, res) => {
  const member = await db.getUserProfile(req.params.userId);
  if (!member || member.group_id !== req.group.id) {
    return res.status(404).send("Member not found in your group.");
  }

  const history = await db.getResponsesByUser(member.id);
  const historyLimited = history.slice(0, 100);

  const done = history.filter(r => r.status === 'done').length;
  const missed = history.filter(r => r.status === 'missed').length;
  const pending = history.filter(r => r.status === 'pending').length;
  const total = history.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : null;

  const totals = { done, missed, pending, total };

  res.render("admin_member", { group: req.group, member, history: historyLimited, totals, pct, user: req.user });
});

module.exports = router;
