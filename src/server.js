require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");

const authRoutes = require("./routes/auth");
const groupRoutes = require("./routes/group");
const dashboardRoutes = require("./routes/dashboard");
const responseRoutes = require("./routes/response");
const scheduler = require("./services/scheduler");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Add JSON parsing for API routes
app.use(express.static(path.join(__dirname, "..", "public")));

// Simple memory store for sessions (works for Vercel)
const MemoryStore = require('memorystore')(session);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 days
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    })
  })
);

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// Secured cron job endpoint for production deployment
// This allows external cron services (Vercel Cron, GitHub Actions, etc.) to trigger prayer scheduling
app.post("/api/cron/prayer-scheduler", async (req, res) => {
  const CRON_SECRET = process.env.CRON_SECRET;
  
  // Verify the request is authorized
  const authHeader = req.headers.authorization;
  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
    console.error('[cron] Unauthorized access attempt to prayer scheduler endpoint');
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized' 
    });
  }
  
  try {
    console.log('[cron] Authorized prayer scheduler tick triggered');
    await scheduler.tick();
    res.json({ 
      success: true, 
      message: 'Prayer scheduler executed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[cron] Prayer scheduler execution failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Standalone scheduler entry point for Render cron jobs
if (process.env.CRON_MODE === 'true') {
  console.log('[scheduler] Running in standalone cron mode');
  // Run once immediately then exit (Render will schedule this)
  scheduler.tick().then(() => {
    console.log('[scheduler] Cron job completed');
    process.exit(0);
  }).catch((error) => {
    console.error('[scheduler] Cron job failed:', error);
    process.exit(1);
  });
}

app.use(dashboardRoutes);
app.use(authRoutes);
app.use(groupRoutes);
app.use(responseRoutes);

app.use((req, res) => res.status(404).send("Not found"));

// Export for Vercel
module.exports = app;

// Only start the server if not running in Vercel
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Prayer Reminder App running at http://localhost:${PORT}`);
    
    // Only start the internal scheduler if CRON_SECRET and CRON_MODE are not set
    // This allows using external cron services in production
    if (!process.env.CRON_SECRET && !process.env.CRON_MODE) {
      console.log('[scheduler] Starting internal node-cron scheduler (development mode)');
      scheduler.start();
    } else {
      console.log('[scheduler] Internal scheduler disabled (production mode - using external cron or Render cron job)');
    }
  });
}
