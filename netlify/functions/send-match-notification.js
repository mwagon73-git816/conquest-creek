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
      emailType // 'confirmation' or 'verification'
    } = data;

    if (!recipientEmail || !senderTeam || !recipientTeam || !matchScores || !matchDate || !emailType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Validate email type
    if (emailType !== 'confirmation' && emailType !== 'verification') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid emailType. Must be "confirmation" or "verification"' })
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
    } else {
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
