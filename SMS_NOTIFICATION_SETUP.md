# SMS Notification Setup Guide
## Conquest of the Creek Tournament - Twilio Integration

> **⚠️ IMPORTANT: FEATURE CURRENTLY DISABLED**
>
> SMS functionality is fully implemented but **disabled pending regulatory approval**.
> All SMS code is gated behind a feature flag (`VITE_SMS_ENABLED=false` in .env files).
>
> **To enable when approved:**
> 1. Set `VITE_SMS_ENABLED=true` in all .env files (.env.development, .env.production, .env.local)
> 2. Configure Twilio credentials in Netlify (see below)
> 3. Redeploy the application
>
> While disabled, no SMS-related UI elements will appear, and no SMS operations will execute.

This document provides complete setup instructions for SMS notifications in the Conquest of the Creek application.

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Twilio Account Setup](#twilio-account-setup)
4. [Netlify Configuration](#netlify-configuration)
5. [Testing](#testing)
6. [Cost Management](#cost-management)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### What Was Implemented
SMS notifications have been added to notify team captains when:
- **Match Entry**: Both captains receive SMS when a match is entered or edited
  - Entering captain: Confirmation SMS
  - Opponent captain: Verification SMS
- **Challenge Accepted**: Challenger captain receives SMS when their challenge is accepted

### Technical Stack
- **SMS Provider**: Twilio
- **Backend**: Netlify Serverless Functions
- **Frontend**: React (Vite)
- **Database**: Firebase Firestore

### Files Modified/Created
1. **Created**: `netlify/functions/send-sms-notification.js` - SMS sending function
2. **Modified**: `src/components/CaptainManagement.jsx` - Added SMS opt-in checkbox and smsEnabled field
3. **Modified**: `src/components/MatchEntry.jsx` - Integrated SMS sending for match notifications
4. **Modified**: `src/components/ChallengeManagement.jsx` - Integrated SMS sending for challenge acceptance

---

## Prerequisites

Before setting up SMS notifications, ensure you have:
- ✅ Access to the Netlify dashboard for your site
- ✅ Credit card for Twilio account setup (no charges until you enable production)
- ✅ Admin access to modify environment variables
- ✅ Basic understanding of Netlify Functions

---

## Twilio Account Setup

### Step 1: Create Twilio Account
1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for a free trial account
3. Verify your email address and phone number

### Step 2: Get Your Credentials
After logging in to the Twilio Console:

1. **Account SID** and **Auth Token**:
   - Navigate to the [Twilio Console Dashboard](https://console.twilio.com/)
   - Copy your **Account SID** (starts with `AC...`)
   - Click "Show" to reveal your **Auth Token** and copy it
   - **⚠️ IMPORTANT**: Keep these credentials secret!

### Step 3: Get a Phone Number
1. In the Twilio Console, go to **Phone Numbers** > **Manage** > **Buy a number**
2. Select your country (United States)
3. Check the **SMS** capability box
4. Click **Search**
5. Choose a phone number and click **Buy**
6. Copy your new phone number in E.164 format (e.g., `+15551234567`)

### Step 4: A2P 10DLC Registration (Required for US Production)
For production use in the US, you must register for A2P 10DLC:

1. Go to **Messaging** > **Regulatory Compliance** in Twilio Console
2. Click **Create a new US A2P 10DLC Registration**
3. Complete the **Business Profile** form:
   - Business Name: "Conquest of the Creek Tennis Tournament"
   - Business Type: Non-profit or Recreation
   - Business Description: "Tennis tournament management and notifications"
4. Complete the **Campaign** form:
   - Use Case: Account Notifications or Customer Care
   - Message Sample: "Match result submitted vs Team Blue. Opponent notified. -Conquest Creek"
5. Submit and wait for approval (typically 1-5 business days)

**Cost**:
- Brand Registration: $4/month
- Campaign Registration: $10 one-time fee
- Phone Number: $1.15/month

**Trial Account Limitations**:
- Can only send to verified phone numbers
- Messages include "Sent from your Twilio trial account" prefix
- Sufficient for testing, but production requires upgrade

---

## Netlify Configuration

### Step 1: Add Environment Variables
1. Log in to [Netlify Dashboard](https://app.netlify.com/)
2. Navigate to your site
3. Go to **Site settings** > **Build & deploy** > **Environment**
4. Click **Add a variable** or **Edit variables**
5. Add the following environment variables:

| Variable Name | Value | Example |
|---------------|-------|---------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token | `your_auth_token_here` |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number | `+15551234567` |

6. Click **Save**

### Step 2: Deploy the Changes
The SMS notification code has already been added to your repository. To deploy:

```bash
# If you haven't committed yet:
git add .
git commit -m "Add SMS notification feature with Twilio integration"
git push origin main
```

Netlify will automatically detect the push and deploy the new function.

### Step 3: Verify Function Deployment
1. In Netlify Dashboard, go to **Functions**
2. Verify that `send-sms-notification` appears in the list
3. Click on it to view logs and recent invocations

---

## Testing

### Phase 1: Test the Netlify Function Directly

You can test the SMS function using `curl` or Postman:

```bash
curl -X POST https://your-site-name.netlify.app/.netlify/functions/send-sms-notification \
  -H "Content-Type: application/json" \
  -d '{
    "recipientPhone": "(555) 123-4567",
    "recipientName": "Test Captain",
    "senderTeam": "Team A",
    "recipientTeam": "Team B",
    "matchScores": "6-4, 3-6, 10-8 (TB)",
    "matchLevel": "7.0",
    "smsType": "verification"
  }'
```

**Expected Response** (Success):
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Expected Response** (Error):
```json
{
  "error": "SMS service not configured"
}
```

### Phase 2: Test via Application UI

#### Test 1: Enable SMS for a Captain
1. Log in as Tournament Director
2. Go to **Captain Management** tab
3. Edit an existing captain or create a new one
4. Enter a phone number: `(555) 123-4567`
5. Check the box: **"Enable SMS text notifications for matches and challenges"**
6. Click **Save**
7. Click **Save Data** button to persist to Firestore

#### Test 2: Test Match Entry SMS
1. Log out and log in as the captain you just configured
2. Go to **Match Entry** tab
3. Enter a match result between your team and another team
4. Fill in all required fields (teams, scores, date, level)
5. Click **Save Match**
6. **Expected**: You should receive an SMS confirmation
7. The opponent captain (if they have SMS enabled) should receive a verification SMS

#### Test 3: Test Challenge Acceptance SMS
1. Log in as a captain
2. Go to **Challenges** tab
3. Create a challenge (or have another captain create one)
4. Log in as a different captain
5. Accept the challenge
6. **Expected**: The challenging captain should receive an SMS notification

### Phase 3: Monitor Logs

#### Netlify Function Logs
1. Go to Netlify Dashboard > **Functions** > `send-sms-notification`
2. View real-time logs to see:
   - Function invocations
   - Success/failure status
   - Error messages

#### Browser Console Logs
Open browser DevTools (F12) and check console for:
- `✓ Confirmation SMS sent to entering captain`
- `✓ Verification SMS sent to opponent captain`
- `✗ Failed to send SMS: [error message]`

#### Twilio Logs
1. Go to [Twilio Console](https://console.twilio.com/)
2. Click **Monitor** > **Logs** > **Messaging**
3. View all sent messages, delivery status, and errors

---

## Cost Management

### Current Pricing (2025)

#### Per-Message Costs
- SMS (US Domestic): $0.0075 per segment (160 characters)
- Carrier Fees: ~$0.004 per message
- **Total per SMS**: ~$0.0115

#### Fixed Monthly Costs
- Phone Number: $1.15/month
- A2P 10DLC Brand: $4/month
- **Total Fixed**: $5.15/month

#### Campaign Registration
- One-time fee: $10-15

### Projected Costs by Tournament Size

| Tournament Size | Captains | Matches/Season | Challenges | SMS/Month | Monthly Cost |
|-----------------|----------|----------------|------------|-----------|--------------|
| Small (10 teams) | 20 | 50 | 20 | 180 | $7.22 |
| Medium (20 teams) | 40 | 120 | 50 | 440 | $10.21 |
| Large (40 teams) | 80 | 300 | 100 | 1,000 | $16.65 |

### Cost Optimization Tips

1. **Opt-In Only**: SMS is already opt-in by default (captains must check the box)
2. **Character Limit**: Keep messages under 160 characters to avoid multi-segment charges
3. **Rate Limiting**: Twilio automatically prevents spam and duplicate sends
4. **Monitor Usage**: Set up Twilio usage alerts
   - Go to Console > Usage > Triggers
   - Create alert at $10, $25, $50 thresholds
5. **Disable During Off-Season**: Captains can uncheck SMS preference when not playing

---

## Troubleshooting

### Issue: "SMS service not configured" Error

**Cause**: Environment variables not set in Netlify

**Solution**:
1. Check Netlify Dashboard > Site Settings > Environment
2. Verify all three variables are present:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
3. Redeploy site after adding variables

### Issue: SMS Not Received

**Possible Causes**:
1. **Trial Account Limitation**: Phone number not verified in Twilio
   - Solution: Add number to Verified Caller IDs in Twilio Console

2. **Invalid Phone Number**: Format incorrect
   - Solution: Ensure format is `(XXX) XXX-XXXX` in UI
   - Function converts to E.164: `+1XXXXXXXXXX`

3. **Captain SMS Not Enabled**: Checkbox not checked
   - Solution: Edit captain and enable SMS notifications

4. **Phone Number Missing**: Captain has no phone number
   - Solution: Add phone number in Captain Management

5. **Carrier Blocked**: Some carriers block automated messages
   - Solution: Complete A2P 10DLC registration

### Issue: "Invalid phone number" Error

**Cause**: Phone number doesn't have exactly 10 digits

**Solution**: Ensure format in database is `(XXX) XXX-XXXX`

### Issue: High SMS Costs

**Cause**: Too many messages being sent

**Solution**:
1. Check Twilio logs for duplicate sends
2. Verify captains aren't creating/editing matches excessively
3. Consider limiting SMS to challenges only (remove from match entry)

### Issue: Messages Include "Trial Account" Prefix

**Cause**: Using Twilio trial account

**Solution**: Upgrade to paid account ($0 minimum, pay-as-you-go)

---

## Message Templates

The following SMS templates are sent by the system:

### Match Confirmation (to entering captain)
```
Match result submitted vs [Team B]. Opponent notified. -Conquest Creek
```

### Match Verification (to opponent captain)
```
[Team A] entered match vs your team (6-4, 3-6, 10-8 TB). Please verify in app. -Conquest Creek
```

### Match Edit (to both captains)
```
Match updated by [Editor Name]: [Team A] vs [Team B]. Check app for details. -Conquest Creek
```

### Challenge Accepted (to challenger captain)
```
[Team B] accepted your challenge on [Date]! Check app for details. -Conquest Creek
```

All messages are kept under 160 characters to avoid segmentation charges.

---

## Security Best Practices

1. **Never commit credentials to Git**:
   - Credentials are stored only in Netlify environment variables
   - `.env` files are in `.gitignore`

2. **Rotate credentials periodically**:
   - Generate new Auth Token in Twilio Console annually
   - Update Netlify environment variables

3. **Monitor for abuse**:
   - Set up Twilio usage alerts
   - Review logs weekly for unusual activity

4. **Limit access**:
   - Only tournament directors can enable SMS for captains
   - Captains must opt-in individually

---

## Support and Resources

### Documentation
- [Twilio SMS Quickstart](https://www.twilio.com/docs/sms/quickstart)
- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [A2P 10DLC Registration Guide](https://www.twilio.com/docs/sms/a2p-10dlc)

### Contact Information
- **Twilio Support**: [https://support.twilio.com](https://support.twilio.com)
- **Netlify Support**: [https://www.netlify.com/support/](https://www.netlify.com/support/)

### Code Locations
- SMS Function: `netlify/functions/send-sms-notification.js`
- Captain UI: `src/components/CaptainManagement.jsx:419-439`
- Match Integration: `src/components/MatchEntry.jsx:240-272, 308-340`
- Challenge Integration: `src/components/ChallengeManagement.jsx:111-145, 282-305`

---

## Changelog

### Version 1.0 (2025-11-12)
- ✅ Initial SMS notification implementation
- ✅ Twilio integration via Netlify Functions
- ✅ SMS opt-in checkbox in Captain Management
- ✅ Match entry/edit SMS notifications
- ✅ Challenge acceptance SMS notifications
- ✅ Error handling and graceful fallbacks
- ✅ Cost optimization (under 160 chars per message)

---

## Next Steps (Optional Enhancements)

Future improvements that could be added:

1. **SMS Preferences**: Fine-grained control
   - Separate toggles for matches vs challenges
   - Do Not Disturb hours (e.g., 10 PM - 8 AM)

2. **SMS History**: Track sent messages
   - Add SMS log to activity logs
   - Show delivery status in UI

3. **Bulk SMS**: Tournament announcements
   - Send announcements to all captains
   - Tournament schedule updates

4. **SMS Reply Handling**: Two-way messaging
   - Captains can reply "CONFIRM" or "DISPUTE"
   - Webhook handler for incoming SMS

5. **International Support**: Non-US phone numbers
   - Support for international tournaments
   - Dynamic country code detection

---

**Document Version**: 1.0
**Last Updated**: November 12, 2025
**Author**: Claude Code Assistant
