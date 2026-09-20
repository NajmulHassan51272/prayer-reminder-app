const jwt = require("jsonwebtoken");

const SECRET = process.env.TOKEN_SECRET || "dev_secret_change_me";

function createResponseToken(userId, prayerName, date) {
  return jwt.sign({ userId, prayerName, date }, SECRET, { expiresIn: "48h" });
}

function verifyResponseToken(token) {
  return jwt.verify(token, SECRET); // throws if invalid/expired
}

module.exports = { createResponseToken, verifyResponseToken };
