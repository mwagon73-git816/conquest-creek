// Netlify Function for sending match verification emails
// Uses SendGrid API for email delivery
// Environment variables required: SENDGRID_API_KEY, FROM_EMAIL

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@conquestofthecreek.com';

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
      recipientEmail,
      recipientName,
      senderTeam,
      recipientTeam,
      matchScores,
      matchDate,
      matchLevel,
      emailType, // 'confirmation', 'verification', 'edit', or 'pending_match_created'
      editorName // Name of person who edited (only for 'edit' type)
    } = data;

    // Validate required fields (matchScores not required for pending_match_created)
    if (!recipientEmail || !senderTeam || !recipientTeam || !matchDate || !emailType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // matchScores required for all types except pending_match_created
    if (emailType !== 'pending_match_created' && !matchScores) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field: matchScores' })
      };
    }

    // Validate email type
    if (emailType !== 'confirmation' && emailType !== 'verification' && emailType !== 'edit' && emailType !== 'pending_match_created') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid emailType. Must be "confirmation", "verification", "edit", or "pending_match_created"' })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email address' })
      };
    }

    // Check if SendGrid API key is configured
    if (!SENDGRID_API_KEY) {
      console.error('SENDGRID_API_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Email service not configured' })
      };
    }

    // Format match date
    const formattedDate = new Date(matchDate).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // Construct email subject and body based on type
    let subject, textBody;

    if (emailType === 'confirmation') {
      // Email to the captain who entered the match
      subject = `Match Result Submitted - ${senderTeam} vs ${recipientTeam}`;
      textBody = `Hi ${recipientName || 'Captain'},

Thank you for submitting the match result:

${senderTeam} vs ${recipientTeam}
Score: ${matchScores}
Level: ${matchLevel || 'Not specified'}
Date: ${formattedDate}

The opposing team captain has been notified and the result has been recorded.

Thank you,
Conquest of the Creek Tournament System`;
    } else if (emailType === 'verification') {
      // Email to the opposing captain (verification)
      subject = `Match Result Verification - ${senderTeam} vs ${recipientTeam}`;
      textBody = `Hi ${recipientName || 'Captain'},

${senderTeam}'s captain has entered a match result that involves your team:

Match Details:
- Teams: ${senderTeam} vs ${recipientTeam}
- Score: ${matchScores}
- Level: ${matchLevel || 'Not specified'}
- Date: ${formattedDate}

Please verify this result in the Conquest of the Creek tournament app.

If you have any questions about this match result, please contact the tournament directors.

Thank you,
Conquest of the Creek Tournament System`;
    } else if (emailType === 'edit') {
      // Email to both captains when a match is edited
      subject = `Match Result Updated - ${senderTeam} vs ${recipientTeam}`;
      textBody = `Hi ${recipientName || 'Captain'},

A match result has been updated by ${editorName || 'a team captain'}:

Updated Match Details:
- Teams: ${senderTeam} vs ${recipientTeam}
- Score: ${matchScores}
- Level: ${matchLevel || 'Not specified'}
- Date: ${formattedDate}
- Updated: ${new Date().toLocaleString('en-US')}
- Updated by: ${editorName || 'Captain'}

This is a notification that the match result has been modified. Please review the updated information in the Conquest of the Creek tournament app.

If you have any questions about this change, please contact the other team's captain or the tournament directors.

Thank you,
Conquest of the Creek Tournament System`;
    } else if (emailType === 'pending_match_created') {
      // Email to opponent captain when a pending match is scheduled directly
      subject = `Match Scheduled - ${senderTeam} vs ${recipientTeam}`;
      textBody = `Hi ${recipientName || 'Captain'},

${senderTeam} has scheduled a match with your team:

Match Details:
- Teams: ${senderTeam} vs ${recipientTeam}
- Level: ${matchLevel || 'Not specified'}
- Scheduled Date: ${formattedDate}

This match has been added to the tournament schedule. When the match is played, either captain can enter the results in the Conquest of the Creek tournament app.

If you have any questions about this match, please contact the other team's captain or the tournament directors.

Thank you,
Conquest of the Creek Tournament System`;
    }

    // SendGrid API v3 request
    const emailData = {
      personalizations: [{
        to: [{ email: recipientEmail, name: recipientName }],
        subject: subject
      }],
      from: {
        email: FROM_EMAIL,
        name: 'Conquest of the Creek'
      },
      content: [{
        type: 'text/plain',
        value: textBody
      }]
    };

    // Send email via SendGrid
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid API error:', errorText);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: 'Failed to send email',
          details: errorText
        })
      };
    }

    // Success
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Email sent successfully'
      })
    };

  } catch (error) {
    console.error('Error in send-match-notification function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
