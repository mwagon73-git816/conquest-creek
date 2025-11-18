/**
 * SMS Notification Service - Netlify Function
 *
 * SMS feature implemented but disabled pending regulatory approval.
 * Set VITE_SMS_ENABLED=true in environment variables to activate when approved.
 *
 * This function handles all SMS notifications via Twilio API for:
 * - Match confirmations (to captain entering match)
 * - Match verifications (to opponent captain)
 * - Match edits (to both captains)
 * - Challenge created (to challenged team captain)
 * - Challenge accepted (to challenger captain)
 *
 * When enabled:
 * - Frontend feature flag must be set to true in .env files
 * - Twilio credentials must be configured in Netlify environment variables
 * - Phone number fields will appear in captain settings UI
 *
 * Environment variables required (configured in Netlify dashboard):
 * - VITE_TWILIO_ACCOUNT_SID: Your Twilio account SID
 * - VITE_TWILIO_AUTH_TOKEN: Your Twilio auth token
 * - VITE_TWILIO_PHONE_NUMBER: Your Twilio phone number (E.164 format)
 */

const TWILIO_ACCOUNT_SID = process.env.VITE_TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.VITE_TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.VITE_TWILIO_PHONE_NUMBER;

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);

    // Validate required fields
    const {
      recipientPhone,
      recipientName,
      senderTeam,
      recipientTeam,
      matchScores,
      matchDate,
      matchLevel,
      smsType, // 'confirmation', 'verification', 'edit', 'challenge_created', 'challenge_accepted', 'pending_match_created'
      editorName, // Name of person who edited (only for 'edit' type)
      proposedDate, // For challenges and pending matches
      courtLocation, // Optional court location
      matchId, // Match ID (optional, for better tracking)
      challengeId // Challenge ID (optional, for challenges and pending matches)
    } = data;

    if (!recipientPhone || !smsType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: recipientPhone and smsType' })
      };
    }

    // Validate smsType
    const validTypes = ['confirmation', 'verification', 'edit', 'challenge_created', 'challenge_accepted', 'pending_match_created'];
    if (!validTypes.includes(smsType)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Invalid smsType. Must be one of: ${validTypes.join(', ')}` })
      };
    }

    // Validate phone number format (remove all non-digits and check length)
    const cleanPhone = recipientPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid phone number. Must be 10 digits.' })
      };
    }

    // Format phone number to E.164 format (US country code)
    const formattedPhone = `+1${cleanPhone}`;

    // Check if Twilio credentials are configured
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error('Twilio credentials not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'SMS service not configured' })
      };
    }

    // Construct SMS message based on type (keep under 160 characters to avoid segmentation)
    let messageBody;

    if (smsType === 'confirmation') {
      // SMS to the captain who entered the match
      const idInfo = matchId ? ` (${matchId})` : '';
      messageBody = `Match result submitted vs ${recipientTeam}${idInfo}. Opponent notified. -Conquest Creek`;
    } else if (smsType === 'verification') {
      // SMS to the opposing captain (verification)
      const idInfo = matchId ? ` (${matchId})` : '';
      messageBody = `${senderTeam} entered match vs your team${idInfo} (${matchScores}). Please verify in app. -Conquest Creek`;
    } else if (smsType === 'edit') {
      // SMS to both captains when a match is edited
      const idInfo = matchId ? ` (${matchId})` : '';
      messageBody = `Match updated by ${editorName}: ${senderTeam} vs ${recipientTeam}${idInfo}. Check app for details. -Conquest Creek`;
    } else if (smsType === 'challenge_created') {
      // SMS to the challenged team captain
      const idInfo = challengeId ? ` (${challengeId})` : '';
      const dateInfo = proposedDate ? ` for ${new Date(proposedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '';
      const levelInfo = matchLevel ? ` (${matchLevel})` : '';
      messageBody = `Challenge from ${senderTeam}${dateInfo}${levelInfo}${idInfo}. Accept in app. -Conquest Creek`;
    } else if (smsType === 'challenge_accepted') {
      // SMS to the challenging team captain
      const idInfo = challengeId ? ` (${challengeId})` : '';
      const dateInfo = matchDate ? ` on ${new Date(matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '';
      messageBody = `${recipientTeam} accepted your challenge${dateInfo}${idInfo}! Check app for details. -Conquest Creek`;
    } else if (smsType === 'pending_match_created') {
      // SMS to opponent captain when a pending match is created directly
      const idInfo = challengeId ? ` (${challengeId})` : '';
      const dateInfo = proposedDate ? ` for ${new Date(proposedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '';
      const levelInfo = matchLevel ? ` (${matchLevel})` : '';
      messageBody = `${senderTeam} scheduled match with your team${dateInfo}${levelInfo}${idInfo}. Check app for details. -Conquest Creek`;
    }

    // Twilio API request body
    const twilioData = new URLSearchParams({
      To: formattedPhone,
      From: TWILIO_PHONE_NUMBER,
      Body: messageBody
    });

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: twilioData.toString()
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Twilio API error:', responseData);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: 'Failed to send SMS',
          details: responseData.message || 'Unknown error'
        })
      };
    }

    // Success
    console.log(`SMS sent successfully to ${recipientPhone}. SID: ${responseData.sid}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'SMS sent successfully',
        sid: responseData.sid
      })
    };

  } catch (error) {
    console.error('Error in send-sms-notification function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
