const { Resend } = require('resend');

// Simple parser for .env.local
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) acc[match[1].trim()] = match[2].trim();
  return acc;
}, {});

const resend = new Resend(env.RESEND_API_KEY);

async function testEmail() {
  console.log(`Sending test email from ${env.FROM_EMAIL} to ${env.TYLER_EMAIL}...`);
  
  try {
    const data = await resend.emails.send({
      from: `Anna from Faraday <${env.FROM_EMAIL}>`,
      to: env.TYLER_EMAIL,
      subject: 'Test: Anna is online! 🚀',
      html: `
        <h2>It worked!</h2>
        <p>Hey Tyler,</p>
        <p>This is a test email sent from the newly verified <strong>${env.FROM_EMAIL}</strong> burner domain.</p>
        <p>Anna's cold email pipeline is officially unblocked and ready to scale.</p>
        <p>- Anna</p>
      `
    });

    console.log('✅ Success! Email sent.');
    console.log('Response:', data);
  } catch (error) {
    console.error('❌ Failed to send email:', error);
  }
}

testEmail();
