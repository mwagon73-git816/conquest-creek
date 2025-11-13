# SMS Notifications - Quick Start Guide
## Get SMS Notifications Running in 15 Minutes

> **⚠️ FEATURE CURRENTLY DISABLED PENDING REGULATORY APPROVAL**
>
> All SMS code is implemented but disabled via feature flag (`VITE_SMS_ENABLED=false`).
> To enable: Set `VITE_SMS_ENABLED=true` in .env files and follow the steps below.

---

## ✅ What's Already Done

All the code is implemented and ready to go! Here's what was added:

### Files Created
- ✅ `netlify/functions/send-sms-notification.js` - SMS sending function

### Files Modified
- ✅ `src/components/CaptainManagement.jsx` - SMS opt-in checkbox
- ✅ `src/components/MatchEntry.jsx` - SMS for match notifications
- ✅ `src/components/ChallengeManagement.jsx` - SMS for challenge acceptance

---

## 🚀 Setup Steps (15 minutes)

### Step 1: Create Twilio Account (5 minutes)
1. Go to https://www.twilio.com/try-twilio
2. Sign up (free trial includes $15 credit)
3. Verify your email and phone number

### Step 2: Get Your Credentials (2 minutes)
In the Twilio Console dashboard:
1. Copy your **Account SID** (starts with `AC...`)
2. Click "Show" and copy your **Auth Token**
3. Go to Phone Numbers > Buy a Number
4. Search for a US number with SMS capability
5. Buy the number (free during trial)
6. Copy your phone number (e.g., `+15551234567`)

### Step 3: Configure Netlify (5 minutes)
1. Log in to Netlify Dashboard
2. Go to your site > **Site settings** > **Environment**
3. Add these three variables:
   - `TWILIO_ACCOUNT_SID` = Your Account SID
   - `TWILIO_AUTH_TOKEN` = Your Auth Token
   - `TWILIO_PHONE_NUMBER` = Your Twilio phone number (with +1)
4. Save changes

### Step 4: Deploy (3 minutes)
```bash
git add .
git commit -m "Add SMS notifications feature"
git push origin main
```

Wait for Netlify to deploy (automatic).

---

## 🧪 Test It Out

### Enable SMS for a Captain
1. Log in as Tournament Director
2. Captain Management tab
3. Edit a captain
4. Enter phone: `(555) 123-4567`
5. Check: "Enable SMS text notifications"
6. Click Save, then Save Data

### Test Match Entry
1. Log in as that captain
2. Enter a match result
3. You should receive an SMS!

---

## 💰 Costs

### Trial Account (Free for Testing)
- $15 credit included
- Can send to verified numbers only
- Messages include "trial account" prefix

### Production Account (Pay-as-you-go)
- **SMS**: $0.0115 per message
- **Phone Number**: $1.15/month
- **A2P Registration**: $4/month (required for production)
- **Estimated Total**: $7-17/month depending on volume

For a medium tournament (20 teams, 40 captains):
- ~400-500 SMS/month
- **~$10-12/month total cost**

---

## 📱 SMS Messages Sent

### Match Entry
**To entering captain:**
```
Match result submitted vs Team Blue. Opponent notified. -Conquest Creek
```

**To opponent captain:**
```
Team Red entered match vs your team (6-4, 3-6, 10-8 TB). Please verify in app. -Conquest Creek
```

### Challenge Accepted
**To challenger captain:**
```
Team Blue accepted your challenge on Mar 15! Check app for details. -Conquest Creek
```

---

## ⚠️ Trial Account Limitations

If using the free trial:
1. Can only send SMS to **verified phone numbers**
2. To verify a number:
   - Twilio Console > Phone Numbers > Verified Caller IDs
   - Add phone number and verify via SMS code
3. Messages include "Sent from your Twilio trial account"
4. Upgrade to remove these limitations ($0 minimum, pay per use)

---

## 🐛 Troubleshooting

### SMS Not Received?
1. Check if phone number is verified (trial accounts)
2. Check captain has SMS checkbox enabled
3. Check Netlify Function logs for errors
4. Check Twilio Console > Logs > Messages

### "SMS service not configured" error?
1. Verify environment variables are set in Netlify
2. Redeploy site after adding variables

### Still not working?
Check the full guide: `SMS_NOTIFICATION_SETUP.md`

---

## 📚 Full Documentation

For complete setup, troubleshooting, and cost details:
- Read `SMS_NOTIFICATION_SETUP.md`

---

## 🎯 Next Steps After Testing

Once you've confirmed SMS is working:

1. **Upgrade Twilio Account** (optional, for production)
   - Remove trial limitations
   - Better delivery rates

2. **A2P 10DLC Registration** (required for production in US)
   - Takes 1-5 business days
   - Costs $4/month + $10 one-time
   - Required to avoid carrier filtering

3. **Set Usage Alerts**
   - Twilio Console > Usage > Triggers
   - Alert at $10, $25, $50

4. **Train Captains**
   - Show them how to enable SMS in their profile
   - Explain they can opt-out anytime

---

**Questions?** Check `SMS_NOTIFICATION_SETUP.md` for detailed documentation.

**Ready to go!** Your SMS notifications are fully implemented and ready to use.
