const nodemailer = require('nodemailer');

function getTransport() {
  const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS } = process.env;
  if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) {
    throw new Error('MAIL_HOST, MAIL_USER, and MAIL_PASS env vars are required to send email');
  }
  return nodemailer.createTransport({
    host: MAIL_HOST,
    port: parseInt(MAIL_PORT || '587', 10),
    secure: parseInt(MAIL_PORT || '587', 10) === 465,
    auth: { user: MAIL_USER, pass: MAIL_PASS },
  });
}

async function sendPasswordReset(toEmail, resetUrl) {
  const transport = getTransport();
  const from = process.env.MAIL_FROM || process.env.MAIL_USER;
  await transport.sendMail({
    from: `"TourneyRun" <${from}>`,
    to: toEmail,
    subject: 'Reset your TourneyRun password',
    text: `You requested a password reset.\n\nClick the link below to set a new password (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#378ADD;">Reset your password</h2>
        <p>You requested a password reset for your TourneyRun account.</p>
        <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <p style="margin:24px 0;">
          <a href="${resetUrl}" style="background:#2563EB;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">
            Reset Password
          </a>
        </p>
        <p style="color:#888;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #333;margin-top:32px;" />
        <p style="color:#555;font-size:12px;">TourneyRun — Player Pool Fantasy</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordReset };
