# Prayer Reminder App - Render Deployment Guide

## 🚀 Deploying to Render (Recommended)

Render is perfect for your Prayer Reminder app because it supports:
- ✅ Persistent storage (for SQLite database)
- ✅ Built-in cron jobs
- ✅ Free tier available
- ✅ Easy deployment

## 📋 Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Account**: Required for connecting your repository
3. **Git Repository**: Your code should be on GitHub

## 🔧 Step-by-Step Deployment

### 1. Prepare Your Code

#### Create Render Configuration File
Create `render.yaml` in your project root:

```yaml
services:
  # Web Service
  - type: web
    name: prayer-reminder-app
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: PORT
        value: 10000
      - key: NODE_ENV
        value: production
      - key: BASE_URL
        sync: false
      - key: CRON_SECRET
        generateValue: true
    disk:
      name: data
      mountPath: /app/data
      size: 1

  # Cron Job for Prayer Scheduler
  - type: cron
    name: prayer-scheduler
    plan: free
    schedule: "*/5 * * * *"
    env: node
    buildCommand: npm install
    startCommand: npm run cron
    envVars:
      - key: BASE_URL
        sync: false
      - key: SMTP_HOST
        sync: false
      - key: SMTP_PORT
        sync: false
      - key: SMTP_SECURE
        sync: false
      - key: SMTP_USER
        sync: false
      - key: SMTP_PASS
        sync: false
      - key: EMAIL_FROM
        sync: false
      - key: PRAYER_CALC_METHOD
        sync: false
      - key: FOLLOWUP_DELAY_MINUTES
        sync: false
      - key: MISSED_AFTER_MINUTES
        sync: false
    disk:
      name: data
      mountPath: /app/data
      size: 1
```

#### Update Database Path for Render
Modify `src/db.js` to support Render's file system:

```javascript
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");

// Support both local development and Render deployment
const dataDir = process.env.RENDER ? '/app/data' : path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "app.db");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
```

#### Create Standalone Cron Script
Create `src/cron.js`:

```javascript
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
```

#### Update package.json
Add a cron script:

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "node --watch src/server.js",
  "cron": "node src/cron.js"
}
```

#### Update Server for Render
Modify `src/server.js` to detect Render environment:

```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Prayer Reminder App running at http://localhost:${PORT}`);
  
  // Only start internal scheduler in development
  if (!process.env.CRON_SECRET && !process.env.CRON_MODE) {
    console.log('[scheduler] Starting internal node-cron scheduler (development mode)');
    scheduler.start();
  } else {
    console.log('[scheduler] Internal scheduler disabled (production mode)');
  }
});
```

### 2. Push Code to GitHub

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 3. Deploy to Render

1. **Log in to Render** and click "New +"
2. **Select "New Web Service"**
3. **Connect your GitHub repository**
4. **Select the prayer-app repository**
5. **Render will detect your Node.js app automatically**
6. **Configure:**
   - **Name**: prayer-reminder-app
   - **Region**: Choose closest to your users
   - **Branch**: main
   - **Root Directory**: leave as is
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
7. **Click "Create Web Service"**

### 4. Configure Environment Variables

After deployment, go to your service settings and add these environment variables:

#### Required Variables:
- `BASE_URL`: Your Render app URL (e.g., `https://prayer-reminder-app.onrender.com`)
- `SESSION_SECRET`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `TOKEN_SECRET`: Generate another random secret
- `SMTP_HOST`: `smtp.gmail.com`
- `SMTP_PORT`: `587`
- `SMTP_SECURE`: `false`
- `SMTP_USER`: `your-email@gmail.com`
- `SMTP_PASS`: `your-gmail-app-password`
- `EMAIL_FROM`: `"Prayer Reminder <your-email@gmail.com>"`
- `PRAYER_CALC_METHOD`: `1`
- `FOLLOWUP_DELAY_MINUTES`: `45`
- `MISSED_AFTER_MINUTES`: `180`
- `CRON_SECRET`: Generate a random secret

### 5. Add Persistent Disk

1. Go to your service settings
2. Scroll down to "Persistent Disk"
3. Click "Add Disk"
4. Configure:
   - **Name**: data
   - **Size**: 1 GB
   - **Mount Path**: `/app/data`

### 6. Deploy Cron Job

1. Go to your Render dashboard
2. Click "New +"
3. Select "Cron Job"
4. **Configure:**
   - **Name**: prayer-scheduler
   - **Repository**: Your prayer-app repo
   - **Branch**: main
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run cron`
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
5. **Environment Variables**: Add the same SMTP and config variables as the web service
6. **Add Persistent Disk**: Same as step 5

### 7. Test Your Deployment

1. **Access your app**: `https://your-app-name.onrender.com`
2. **Test signup**: Create a test account
3. **Test prayer times**: Ensure prayer times load correctly
4. **Test email**: Send an invitation and check email delivery
5. **Monitor cron job**: Check Render logs to see scheduler running

## 🔧 Environment Variables Setup

### Generate Secrets:
```bash
# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate TOKEN_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate CRON_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Gmail App Password:
1. Enable 2FA on your Google Account
2. Go to Security → App Passwords
3. Create app password for "Mail"
4. Use the 16-character password (without spaces)

## 🚨 Important Notes

### Database Persistence:
- Render's persistent disk ensures your SQLite database survives restarts
- The database file will be at `/app/data/app.db` on Render
- Regular backups are recommended

### Email Configuration:
- Use Gmail App Password (not regular password)
- Test email delivery before going live
- Consider using Mailtrap for development testing

### Cron Job:
- The cron job runs independently from the web service
- Both services share the same persistent disk
- Monitor cron job logs to ensure prayer reminders are sent

### Session Management:
- Current implementation uses cookie-based sessions
- Works fine on Render as long as the web service stays running
- Consider Redis for better session management if you scale

## 📊 Monitoring

### View Logs:
- **Web Service**: Logs tab in Render dashboard
- **Cron Job**: Separate logs for the cron service
- **Important Logs**: Look for `[email]`, `[scheduler]`, `[signup]` prefixes

### Health Checks:
- Monitor app uptime in Render dashboard
- Check cron job execution frequency
- Monitor disk usage (SQLite database size)

## 🔄 Updates

### Deploying Updates:
```bash
git add .
git commit -m "Update description"
git push origin main
```
Render will automatically detect the push and redeploy.

### Database Migrations:
- Current setup uses auto-schema creation
- For schema changes, create migration scripts
- Test migrations locally before deploying

## 💰 Cost

### Free Tier Limits:
- **Web Service**: Free tier includes 512MB RAM, shared CPU
- **Cron Job**: Free tier with limited execution time
- **Persistent Disk**: 1 GB free (sufficient for SQLite)
- **Outbound Requests**: 100GB/month free bandwidth

### When to Upgrade:
- More than 30 active users
- Need faster response times
- Require more storage
- Need more frequent cron jobs

## 🆘 Troubleshooting

### Common Issues:

**Database not persisting:**
- Ensure persistent disk is properly mounted at `/app/data`
- Check disk is not full
- Verify database path in code

**Email not sending:**
- Verify SMTP credentials are correct
- Check Render logs for email errors
- Ensure Gmail App Password is valid

**Cron job not running:**
- Check cron job logs in Render dashboard
- Verify environment variables are set
- Ensure cron job service is active

**Session issues:**
- Verify web service is not restarting frequently
- Check CRON_SECRET is not set for web service
- Consider enabling Render's auto-deploy

## 🎯 Alternative: Railway

If Render doesn't work, Railway is very similar:

1. Create `railway.json` instead of `render.yaml`
2. Use Railway's PostgreSQL instead of SQLite
3. Similar cron job setup
4. Slightly different environment configuration

## 📞 Support

- **Render Documentation**: https://render.com/docs
- **Render Community**: https://community.render.com
- **SQLite on Render**: https://render.com/docs/learn/persistent-disk

Your app is ready for Render deployment! The configuration files are prepared, and you just need to follow the steps above.