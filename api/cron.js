// Vercel Cron Job endpoint for prayer scheduler
const { supabase } = require('../src/supabase');
const { tick } = require('../src/services/scheduler');

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret for security
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  
  if (cronSecret && (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== cronSecret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[vercel-cron] Starting prayer scheduler tick');
    await tick();
    console.log('[vercel-cron] Prayer scheduler completed successfully');
    res.status(200).json({ success: true, message: 'Prayer scheduler completed' });
  } catch (error) {
    console.error('[vercel-cron] Prayer scheduler failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};