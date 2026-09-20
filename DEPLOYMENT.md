# Prayer Reminder App - Deployment Guide

## Overview
This guide covers the deployment of the upgraded Prayer Reminder App with production-ready email system, modern UI with Tailwind CSS, and email-based group invitations.

## Environment Variables

### Required Variables
```bash
# Server Configuration
PORT=3000
SESSION_SECRET=<your-secret-key>
TOKEN_SECRET=<your-secret-key>
BASE_URL=<your-deployment-url>

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="Prayer Reminder <your-email@gmail.com>"

# Prayer Configuration
PRAYER_CALC_METHOD=1
FOLLOWUP_DELAY_MINUTES=45
MISSED_AFTER_MINUTES=180

# Production Cron (Optional - for external cron services)
CRON_SECRET=<your-cron-secret>
```

### Generating Secrets
```bash
# Generate SESSION_SECRET and TOKEN_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate CRON_SECRET (for production cron jobs)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Deployment Options

### Option 1: Traditional VPS/Server
1. **Server Requirements**
   - Node.js 18+ 
   - SQLite (no separate database needed)
   - Outbound internet access for prayer times API

2. **Deployment Steps**
   ```bash
   # Clone repository
   git clone <your-repo>
   cd prayer-app
   
   # Install dependencies
   npm install
   
   # Setup environment
   cp .env.example .env
   # Edit .env with your values
   
   # Start server (development mode with internal cron)
   npm start
   
   # OR start with PM2 for production
   npm install -g pm2
   pm2 start src/server.js --name prayer-app
   pm2 startup
   pm2 save
   ```

### Option 2: Vercel/Render (with External Cron)

#### Vercel Deployment
1. **Create `vercel.json`**
   ```json
   {
     "crons": [{
       "path": "/api/cron/prayer-scheduler",
       "schedule": "*/5 * * * *"
     }]
   }
   ```

2. **Environment Variables in Vercel Dashboard**
   - Set all required variables from above
   - Set `CRON_SECRET` to enable external cron
   - Set `BASE_URL` to your Vercel domain

3. **Deploy**
   ```bash
   npm install -g vercel
   vercel
   ```

#### Render Deployment
1. **Create `render.yaml`**
   ```yaml
   services:
     - type: web
       name: prayer-app
       env: node
       buildCommand: npm install
       startCommand: npm start
       envVars:
         - key: PORT
           value: 10000
         # Add other environment variables
   ```

2. **Cron Job Setup**
   - Use Render Cron Jobs to hit `/api/cron/prayer-scheduler`
   - Set Authorization header: `Bearer YOUR_CRON_SECRET`
   - Schedule: Every 5 minutes

### Option 3: Docker Deployment

1. **Create `Dockerfile`**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install --production
   COPY . .
   EXPOSE 3000
   CMD ["node", "src/server.js"]
   ```

2. **Build and Run**
   ```bash
   docker build -t prayer-app .
   docker run -p 3000:3000 --env-file .env prayer-app
   ```

## Cron Job Configuration

### Development Mode (Internal Cron)
- Set `CRON_SECRET` empty or don't set it
- Internal node-cron scheduler runs every 5 minutes
- Good for local development and simple deployments

### Production Mode (External Cron)
- Set `CRON_SECRET` to a secure random string
- Internal scheduler is disabled
- External service calls `/api/cron/prayer-scheduler`

#### External Cron Examples

**GitHub Actions:**
```yaml
name: Prayer Scheduler
on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  scheduler:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Prayer Scheduler
        run: |
          curl -X POST https://your-app.com/api/cron/prayer-scheduler \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

**Vercel Cron:**
- Automatic configuration via `vercel.json`
- Vercel handles the scheduling

**Traditional Cron:**
```bash
# Add to crontab
*/5 * * * * curl -X POST https://your-app.com/api/cron/prayer-scheduler -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Email Configuration

### Gmail Setup
1. Enable 2-Factor Authentication
2. Generate App Password: Google Account → Security → App Passwords
3. Use App Password in `SMTP_PASS`

### Alternative Email Providers
- **SendGrid**: Use API key or SMTP credentials
- **Mailgun**: Use SMTP credentials from dashboard
- **AWS SES**: Verify domain and use SMTP credentials
- **Resend**: Use API key or SMTP

### Email Testing
- **Mailtrap**: Use for development/testing
- **EmailOctopus**: Free tier for small applications

## Database Management

### SQLite Database Location
- Development: `data/app.db`
- Production: Ensure `data/` directory exists and is writable

### Database Backups
```bash
# Backup
cp data/app.db data/app.db.backup.$(date +%Y%m%d)

# Restore
cp data/app.db.backup.YYYYMMDD data/app.db
```

### Database Migration
The app uses SQLite with automatic schema creation. The `group_invitations` table is created automatically on first run.

## Security Considerations

1. **Environment Variables**
   - Never commit `.env` file
   - Use different secrets for production
   - Rotate secrets periodically

2. **API Security**
   - Cron endpoint is protected with `CRON_SECRET`
   - Session-based authentication for user routes
   - Input validation on all forms

3. **Email Security**
   - Use App Passwords, not regular passwords
   - Implement rate limiting for invitation emails
   - Set invitation expiry (7 days default)

## Monitoring and Logging

### Application Logs
```bash
# With PM2
pm2 logs prayer-app

# Direct log output
npm start > logs/app.log 2>&1
```

### Email Delivery Monitoring
- Check logs for `[email]` prefixed messages
- Failed emails are logged with error details
- Monitor SMTP provider dashboard for delivery issues

### Health Checks
```bash
# Basic health check
curl https://your-app.com/

# Cron endpoint health (with auth)
curl -X POST https://your-app.com/api/cron/prayer-scheduler \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Scaling Considerations

### Current Limitations
- Single server deployment (cookie-based sessions)
- SQLite (single database file)
- Email rate limits depend on SMTP provider

### For Larger Scale
- Migrate to PostgreSQL/MySQL
- Implement Redis for session storage
- Use queue system for email sending
- Add load balancer with multiple servers

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Find and kill process using port 3000
netstat -ano | findstr :3000  # Windows
lsof -ti:3000 | xargs kill    # Linux/Mac
```

**Email Not Sending**
- Check SMTP credentials
- Verify network connectivity
- Check SMTP provider logs
- Review application logs for `[email]` errors

**Prayer Times Not Loading**
- Verify outbound internet access
- Check Aladhan API status
- Review city/country values in user profile

**Cron Not Running**
- Verify `CRON_SECRET` is set for production
- Check external cron service configuration
- Test endpoint manually with curl

## Performance Optimization

### Current Optimizations
- Connection pooling for email sending
- Daily prayer time caching
- Efficient database queries with prepared statements

### Additional Optimizations
- Implement CDN for static assets
- Add response compression
- Cache static assets
- Implement database indexing

## Support and Maintenance

### Regular Maintenance Tasks
- Monitor email delivery rates
- Review application logs weekly
- Backup database regularly
- Update dependencies monthly
- Monitor prayer time API changes

### Update Process
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Restart application
pm2 restart prayer-app
```

## Contact and Resources

- Aladhan Prayer Times API: https://aladhan.com/prayer-times-api
- Node.js Documentation: https://nodejs.org/docs
- SQLite Documentation: https://sqlite.org/docs.html
- Email Provider Documentation:
  - Gmail: https://support.google.com/accounts/answer/185833
  - SendGrid: https://docs.sendgrid.com
  - Mailgun: https://documentation.mailgun.com