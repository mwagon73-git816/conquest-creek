# Dual Email Notification System - Update Summary

## Overview
Updated the match entry email notification system to send TWO emails when a captain enters a match:
1. **Confirmation email** to the entering captain
2. **Verification email** to the opposing captain

## What Changed

### 1. Netlify Function Updated ✅
**File**: `netlify/functions/send-match-notification.js`

**Changes**:
- Added `emailType` parameter (required): `"confirmation"` or `"verification"`
- Generates different email subject and body based on `emailType`
- Validation ensures only valid email types are accepted

**Email Types**:

#### Confirmation Email (to entering captain):
```
Subject: Match Result Submitted - [Your Team] vs [Opponent Team]

Hi [Captain Name],

Thank you for submitting the match result:

[Your Team] vs [Opponent Team]
Score: 6-4, 3-6, 10-8 (TB)
Level: 7.0
Date: December 15, 2024

The opposing team captain has been notified and the result has been recorded.

Thank you,
Conquest of the Creek Tournament System
```

#### Verification Email (to opposing captain):
```
Subject: Match Result Verification - [Sender Team] vs [Recipient Team]

Hi [Captain Name],

[Sender Team]'s captain has entered a match result that involves your team:

Match Details:
- Teams: [Sender Team] vs [Recipient Team]
- Score: 6-4, 3-6, 10-8 (TB)
- Level: 7.0
- Date: December 15, 2024

Please verify this result in the Conquest of the Creek tournament app.

If you have any questions about this match result, please contact the tournament directors.

Thank you,
Conquest of the Creek Tournament System
```

### 2. Match Entry Component Updated ✅
**File**: `src/components/MatchEntry.jsx`

**Changes**:
- Renamed function: `sendMatchNotification` → `sendMatchNotifications` (plural)
- Function now sends TWO separate emails:
  1. Confirmation to entering captain (if they have email)
  2. Verification to opposing captain (if they have email)
- Tracks email success/failure for each email
- Returns detailed status message

**Email Sending Logic**:
```javascript
// Find both captains
const enteringCaptain = captains.find(c =>
  c.teamId === userTeamId &&
  c.status === 'active' &&
  c.email
);

const opponentCaptain = captains.find(c =>
  c.teamId === opponentTeamId &&
  c.status === 'active' &&
  c.email
);

// Send confirmation email to entering captain
if (enteringCaptain) {
  await fetch('/.netlify/functions/send-match-notification', {
    body: JSON.stringify({
      ...matchData,
      emailType: 'confirmation'
    })
  });
}

// Send verification email to opponent captain
if (opponentCaptain) {
  await fetch('/.netlify/functions/send-match-notification', {
    body: JSON.stringify({
      ...matchData,
      emailType: 'verification'
    })
  });
}
```

### 3. Success/Error Messages Updated ✅

**New User Feedback Messages**:

| Scenario | Message |
|----------|---------|
| Both emails sent successfully | "Match saved. Confirmation emails sent to both captains." |
| Only one email sent | "Match saved but some email notifications failed." |
| Both emails failed | "Match saved but email notifications failed." |
| No captains with emails | "Match saved. No captains with emails found." |

**Important**: The match ALWAYS saves successfully regardless of email status. Emails are a secondary feature.

## How It Works

### Step-by-Step Flow:

1. **Captain enters match**
   - Fills out match form
   - Clicks "Save Match"
   - Match is saved to database

2. **System identifies captains**
   - Finds entering captain by `userTeamId`
   - Finds opposing captain by opponent team ID
   - Verifies both have active status and email addresses

3. **Sends confirmation email**
   - To: Entering captain
   - Type: `confirmation`
   - Content: Thank you message with match details

4. **Sends verification email**
   - To: Opposing captain
   - Type: `verification`
   - Content: Please verify message with match details

5. **Shows result**
   - Success: "Confirmation emails sent to both captains"
   - Partial: "Some email notifications failed"
   - All messages indicate match was saved

## When Emails Are Sent

### ✅ Emails ARE sent when:
- A **captain** enters a new match (not editing)
- Captain and/or opponent have active status
- Captain and/or opponent have email addresses configured
- SendGrid is properly configured

### ❌ Emails are NOT sent when:
- A **director** enters a match
- Captain edits an existing match
- Captain or opponent is inactive
- Captain or opponent has no email configured
- SendGrid API key is not configured

## Testing Instructions

### Test 1: Both Captains Have Emails
1. Create two teams with captains who have emails
2. Login as Captain 1
3. Enter a match against Team 2
4. Check both inboxes:
   - Captain 1 receives: "Match Result Submitted..."
   - Captain 2 receives: "Match Result Verification..."

### Test 2: Only Opponent Has Email
1. Create Captain 1 without email
2. Create Captain 2 with email
3. Login as Captain 1
4. Enter match
5. Only Captain 2 receives verification email
6. Message: "Match saved but some email notifications failed"

### Test 3: Director Enters Match
1. Login as director
2. Enter a match
3. No emails are sent (expected behavior)

## Configuration

No configuration changes needed! The system uses the same SendGrid setup:

```
Environment Variables (in Netlify):
- SENDGRID_API_KEY = your_api_key
- FROM_EMAIL = noreply@yourdomain.com (optional)
```

## Email Costs

With dual emails:
- **Before**: 1 email per match
- **After**: 2 emails per match
- **Free tier**: 100 emails/day = 50 matches/day
- **Typical tournament**: 25-100 matches/month = 50-200 emails/month
- **Still well within free tier limits!**

## Troubleshooting

### Only One Email Sends
**Symptom**: One captain gets email, the other doesn't

**Check**:
1. Both captains have email addresses configured
2. Both captains are marked as "active"
3. Email addresses are valid format
4. Check Netlify function logs for specific errors

### No Emails Send
**Symptom**: Match saves but no emails arrive

**Check**:
1. SENDGRID_API_KEY is configured in Netlify
2. Sender email is verified in SendGrid
3. Captain (not director) is entering the match
4. Browser console for fetch errors
5. Netlify function logs for execution errors

### Wrong Email Content
**Symptom**: Emails have wrong content

**Check**:
1. `emailType` parameter is correctly set
2. Function logs show correct emailType received
3. Redeploy if function was recently updated

## Backward Compatibility

✅ **Fully backward compatible**:
- Existing captains without emails will work fine
- Directors can still enter matches (no emails sent)
- Match saving is completely independent of email system
- Old email notifications have been replaced (not duplicated)

## Files Modified

1. ✅ `netlify/functions/send-match-notification.js`
   - Added `emailType` parameter
   - Added dual email template logic

2. ✅ `src/components/MatchEntry.jsx`
   - Renamed to `sendMatchNotifications` (plural)
   - Sends two separate emails
   - Updated success/error messages

## Future Enhancements

Possible improvements:
- Add email preview in captain dashboard
- Allow captains to opt-out of confirmation emails
- Add "Resend email" button for failed sends
- Email digest of all matches entered in a day
- CC tournament directors on all match emails

## Support

For issues:
1. Check Netlify function logs: Functions → send-match-notification
2. Check SendGrid dashboard: Activity → Email Activity
3. Verify captain email addresses in Captains tab
4. Check browser console for client-side errors
5. Review this document for expected behavior

## Summary

The dual email notification system is now active! When a captain enters a match:
- ✅ They receive a confirmation email
- ✅ Their opponent receives a verification email
- ✅ Both emails have appropriate content
- ✅ Match saves regardless of email status
- ✅ Clear feedback on email success/failure

Everything is ready to use - no additional configuration needed!
