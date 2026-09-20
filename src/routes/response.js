const express = require("express");
const db = require("../db");
const { verifyResponseToken } = require("../utils/token");

const router = express.Router();

router.get("/respond", async (req, res) => {
  const { token, action } = req.query;

  if (!token || !["yes", "no"].includes(action)) {
    return res.status(400).render("respond_result", {
      ok: false,
      message: "This link is invalid.",
    });
  }

  let payload;
  try {
    payload = verifyResponseToken(token);
  } catch (err) {
    return res.status(400).render("respond_result", {
      ok: false,
      message: "This link is invalid or has expired.",
    });
  }

  const { userId, prayerName, date } = payload;
  const status = action === "yes" ? "done" : "missed";

  try {
    const user = await db.getUserProfile(userId);
    if (!user) {
      return res.status(404).render("respond_result", { ok: false, message: "User not found." });
    }

    // Check if response already exists
    const existing = await db.getResponse(userId, prayerName, date);
    
    if (existing) {
      // Update existing response
      await db.updateResponse(existing.id, {
        status: status,
        responded_at: new Date().toISOString()
      });
    } else {
      // Create new response
      await db.createResponse({
        user_id: userId,
        group_id: user.group_id,
        prayer_name: prayerName,
        date: date,
        status: status,
        responded_at: new Date().toISOString()
      });
    }

    res.render("respond_result", {
      ok: true,
      message:
        status === "done"
          ? `Marked ${prayerName} as completed for ${date}. Great job, ${user.name}!`
          : `Marked ${prayerName} as not completed for ${date}. There's always the next one.`,
    });
  } catch (error) {
    console.error(`[respond] Error:`, error);
    res.status(500).render("respond_result", { ok: false, message: "An error occurred while processing your response." });
  }
});

module.exports = router;
