# Email Notification System - Setup Guide

## Overview
This system automatically sends email notifications to opposing captains when a match result is entered. The system uses Netlify Functions and SendGrid for reliable email delivery.

## What Was Implemented

### Part 1: Captain Management Updates ✅
- Added **email address** field (required, validated)
- Added **cell phone** field (optional, auto-formatted as (XXX) XXX-XXXX)
- Email and phone displayed in captain list
- Email validation prevents invalid addresses
- Credentials display includes email after captain creation

### Part 2: Netlify Function ✅
- Created `netlify/functions/send-match-notification.js`
- Uses SendGrid API v3 for email delivery
- Validates all inputs (email format, required fields)
- Graceful error handling
- Simple text-based email template

### Part 3: Match Entry Integration ✅
- Captains trigger emails automatically when saving matches
- Looks up opponent captain by team ID
- Only sends for new matches (not edits)
- Graceful failure: match saves even if email fails
- Success message: "Match saved and opponent notified via email"

### Part 4: Configuration ✅
- Updated `netlify.toml` with functions directory
- Added security headers
- Documented required environment variables

## Setup Instructions

### 1. Create SendGrid Account
1. Go to https://sendgrid.com/
2. Sign up for a free account (100 emails/day free tier)
3. Verify your email address
4. Complete sender authentication

### 2. Get SendGrid API Key
1. In SendGrid dashboard, go to Settings → API Keys
2. Click "Create API Key"
3. Name it "Conquest of the Creek"
4. Select "Full Access" or "Mail Send" permission
5. **Copy the API key** (you won't see it again!)

### 3. Configure Netlify Environment Variables
1. In Netlify dashboard, go to Site Settings
2. Navigate to "Environment variables"
3. Add the following variables:

   ```
   SENDGRID_API_KEY = your_sendgrid_api_key_here
   FROM_EMAIL = noreply@yourdomain.com (optional)
   ```

   **Important**:
   - The FROM_EMAIL should match your verified sender in SendGrid
   - If not set, defaults to `noreply@conquestofthecreek.com`

### 4. Verify Sender Email (Required by SendGrid)
1. In SendGrid dashboard, go to Settings → Sender Authentication
2. Choose "Single Sender Verification" (easiest for single sender)
3. Fill out the form with:
   - From Email Address: `noreply@yourdomain.com`
   - From Name: "Conquest of the Creek"
   - Reply To: your actual email
   - Company details (can be the tournament name)
4. Verify the email address via the link sent to your inbox

### 5. Deploy to Netlify
1. Commit all changes to your repository:
   ```bash
   git add .
   git commit -m "Add email notification system"
   git push
   ```

2. Netlify will automatically rebuild with the new function

### 6. Test the System

#### Test 1: Create Captains with Emails
1. Login as a director
2. Go to Captains tab
3. Create two captains:
   - Captain 1: Team A, with your test email
   - Captain 2: Team B, with another test email
4. Verify emails are displayed in the captain list

#### Test 2: Send Match Notification
1. Logout and login as Captain 1
2. Go to Match Entry
3. Enter a match result:
   - Team 1: Your team (auto-selected)
   - Team 2: Select opponent team
   - Enter set scores
4. Click "Save Match"
5. Should see: "Match saved and opponent notified via email"
6. Check Captain 2's email inbox

#### Expected Email Content:
```
Subject: Match Result Verification - [Your Team] vs [Opponent Team]

Hi [Captain Name],

[Your Team]'s captain has entered a match result that involves your team:

Match Details:
- Teams: [Your Team] vs [Opponent Team]
- Score: 6-4, 3-6, 10-8 (TB)
- Level: 7.0
- Date: December 15, 2024

Please verify this result in the Conquest of the Creek tournament app.

If you have any questions about this match result, please contact the tournament directors.

Thank you,
Conquest of the Creek Tournament System
```

## Troubleshooting

### Email Not Sending

1. **Check Netlify Function Logs**
   - Netlify dashboard → Functions → send-match-notification
   - Check for error messages

2. **Verify Environment Variables**
   - Ensure `SENDGRID_API_KEY` is set correctly
   - No extra spaces or quotes in the value

3. **Check SendGrid Dashboard**
   - Activity → Email Activity
   - See if emails are being received/rejected

4. **Verify Sender Email**
   - SendGrid requires sender verification
   - Check Settings → Sender Authentication

5. **Check Browser Console**
   - Open developer tools
   - Look for errors when saving match

### Common Errors

#### "Email service not configured"
- `SENDGRID_API_KEY` not set in Netlify
- Solution: Add environment variable and redeploy

#### "Failed to send email" (403 Forbidden)
- Sender email not verified in SendGrid
- Solution: Complete sender authentication

#### "Invalid email address"
- Captain's email format is wrong
- Solution: Edit captain and fix email

#### Match saves but no email
- This is by design for graceful degradation
- Check function logs for specific error

## Features

### When Emails Are Sent
✅ Captain enters a new match
✅ Opponent has active captain with email
✅ Only for new matches (not edits)

### When Emails Are NOT Sent
❌ Director enters a match
❌ Captain edits existing match
❌ Opponent has no captain assigned
❌ Opponent captain has no email
❌ Opponent captain is inactive

### Rate Limiting
- One email per match entry
- SendGrid free tier: 100 emails/day
- Sufficient for most tournament use

## Cost
- **SendGrid Free Tier**: 100 emails/day forever
- **Paid Plans**: Start at $15/month for 50,000 emails
- **Typical Tournament**: 50-200 emails/month (well within free tier)

## Security
- API key stored securely in Netlify environment
- Email validation prevents injection
- Rate limited by SendGrid
- No sensitive data in emails
- HTTPS only (enforced by Netlify)

## Future Enhancements
Possible improvements:
- HTML email templates with styling
- SMS notifications using captain phone numbers
- Email templates for match confirmations
- Digest emails with weekly summaries
- Attachment support for match photos

## Support
For issues:
1. Check Netlify function logs
2. Check SendGrid activity dashboard
3. Review browser console errors
4. Contact tournament directors

## Files Modified/Created
- ✅ `src/components/CaptainManagement.jsx` - Added email/phone fields
- ✅ `netlify/functions/send-match-notification.js` - New email function
- ✅ `netlify.toml` - Added functions configuration
- ✅ `src/components/MatchEntry.jsx` - Integrated email sending
- ✅ `src/App.jsx` - Pass captains to MatchEntry

All changes are backward compatible - existing captains without emails will work fine.
