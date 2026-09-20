# Prayer Reminder App - Vercel Deployment Guide

## Overview
This guide covers deploying the Prayer Reminder App to Vercel with Supabase backend.

## Prerequisites
- Vercel account (free at vercel.com)
- GitHub account (for connecting your repository)
- Supabase project already set up
- Project code migrated to Supabase

## Step 1: Install Dependencies

```bash
npm install
```

This will install the new `memorystore` package needed for Vercel session management.

## Step 2: Push Code to GitHub

1. **Initialize Git** (if not already done):
```bash
git init
git add .
git commit -m "Ready for Vercel deployment"
```

2. **Create GitHub Repository**:
   - Go to GitHub and create a new repository
   - Follow the instructions to push your local repository

```bash
git remote add origin https://github.com/your-username/prayer-app.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

### Option A: Using Vercel CLI

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Link to existing project?** → No
- **Project name** → prayer-reminder-app
- **Directory** → ./
- **Override settings?** → No

### Option B: Using Vercel Dashboard

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Click "Add New Project"**
3. **Import your GitHub repository**
4. **Configure the project**:
   - **Framework Preset**: Other
   - **Root Directory**: ./
   - **Build Command**: `npm install`
   - **Output Directory**: (leave empty)
   - **Install Command**: `npm install`

5. **Click "Deploy"**

## Step 4: Configure Environment Variables

After deployment, go to your project settings in Vercel and add these environment variables:

### Required Variables:
```
SUPABASE_URL=https://mpvmzwxsvufbfzhelwri.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wdm16d3hzdnVmYmZ6aGVsd3JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDU1OTUsImV4cCI6MjEwNTQ4MTU5NX0.g-zUmK-OcCXvHyCTBSlLFV4yH3fhbi4Jb3csKhckUAM
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wdm16d3hzdnVmYmZ6aGVsd3JpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTkwNTU5NSwiZXhwIjoyMTA1NDgxNTk1fQ.yj-e_rTAzJWa2kYjkDHrW9POz4Zkd7JJR_Vs541qaRc
SESSION_SECRET=your_generated_secret
TOKEN_SECRET=your_generated_secret
BASE_URL=https://your-app.vercel.app
```

### Email Configuration (Optional):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM="Prayer Reminder <your_email@gmail.com>"
```

### Prayer Configuration:
```
PRAYER_CALC_METHOD=1
FOLLOWUP_DELAY_MINUTES=45
MISSED_AFTER_MINUTES=180
```

### Cron Job Secret:
```
CRON_SECRET=your_generated_cron_secret
```

## Step 5: Configure Cron Job

The `vercel.json` file already includes cron job configuration:

```json
{
  "crons": [
    {
      "path": "/api/cron/prayer-scheduler",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This will automatically create a Vercel Cron Job that runs every 5 minutes.

## Step 6: Test the Deployment

1. **Access your app**: `https://your-app-name.vercel.app`
2. **Test signup**: Create a test account
3. **Test prayer times**: Ensure prayer times load correctly
4. **Test email**: Send an invitation and check email delivery
5. **Monitor cron job**: Check Vercel logs to see scheduler running

## Vercel-Specific Considerations

### Session Management
- Uses `memorystore` for session storage
- Sessions are stored in memory (not persistent across restarts)
- Users may need to re-login after deployments
- For production, consider using Vercel KV or Redis

### Cron Jobs
- Vercel Cron Jobs are configured in `vercel.json`
- The cron endpoint is secured with `CRON_SECRET`
- Runs every 5 minutes automatically
- Logs are available in Vercel dashboard

### Performance
- Vercel automatically handles scaling
- Cold starts may occur on first request
- Functions timeout after 10 seconds (may need optimization for heavy operations)

### File Uploads
- Vercel doesn't support persistent file storage
- All data is stored in Supabase
- No local file system access

## Monitoring and Debugging

### View Logs:
1. Go to your Vercel project dashboard
2. Click on the "Logs" tab
3. Select your deployment
4. View real-time logs for debugging

### Environment Variables:
1. Go to project settings
2. Click "Environment Variables"
3. Add/update variables as needed
4. Redeploy to apply changes

### Cron Job Status:
1. Go to the "Cron Jobs" tab in Vercel
2. View execution history
3. Check for failed executions

## Troubleshooting

### Common Issues:

**Session issues after deployment:**
- Users may need to re-login after deployments
- This is normal with memory-based sessions
- Consider implementing persistent sessions for better UX

**Cron job not running:**
- Check Vercel Cron Jobs tab
- Verify `CRON_SECRET` is set
- Check cron job logs for errors

**Email not sending:**
- Verify SMTP credentials in environment variables
- Check Vercel logs for email errors
- Ensure email provider allows Vercel IPs

**Database connection issues:**
- Verify Supabase URL and keys
- Check Supabase project status
- Ensure Supabase project is active

**Build failures:**
- Check build logs in Vercel
- Ensure all dependencies are in package.json
- Verify Node.js version compatibility

## Scaling Considerations

### Current Limitations:
- Memory-based sessions (not scalable)
- 10-second function timeout
- No persistent file storage

### For Larger Scale:
- Implement Redis for session storage
- Use Vercel KV for better performance
- Optimize long-running operations
- Consider dedicated server for heavy processing

## Cost

### Vercel Free Tier:
- 100GB bandwidth per month
- Unlimited deployments
- 6,000 minutes of execution time
- 100GB-Hours of serverless function execution
- Automatic HTTPS

### When to Upgrade:
- More than 100GB bandwidth
- Need longer execution times
- Require more concurrent executions
- Need dedicated resources

## Updates and Maintenance

### Deploying Updates:
```bash
git add .
git commit -m "Update description"
git push origin main
```
Vercel will automatically detect the push and redeploy.

### Rolling Back:
1. Go to Vercel dashboard
2. Click on "Deployments"
3. Find the previous deployment
4. Click "..." and select "Promote to Production"

## Alternative: Vercel + Supabase Edge Functions

For even better performance, consider moving some functionality to Supabase Edge Functions:
- User authentication
- Prayer time calculations
- Email sending
- Database operations

This would reduce Vercel function execution time and improve performance.

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Community](https://vercel.com/community)
- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

Your app is now ready for Vercel deployment! The configuration files are prepared, and you just need to follow the steps above.