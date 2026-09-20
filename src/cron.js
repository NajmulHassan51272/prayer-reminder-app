// Standalone cron job for Render
// This script runs the scheduler tick and exits
require("dotenv").config();
const scheduler = require("./services/scheduler");

console.log('[render-cron] Starting prayer scheduler tick');

scheduler.tick()
  .then(() => {
    console.log('[render-cron] Prayer scheduler completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[render-cron] Prayer scheduler failed:', error);
    process.exit(1);
  });