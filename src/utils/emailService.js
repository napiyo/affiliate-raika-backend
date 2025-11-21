import nodemailer from "nodemailer";

const catchAsync = (fn) => async (...args) => {
  try {
    console.log(...args);
    return await fn(...args);
  } catch (error) {
    console.error("email service error occured:", error.message);
  }
};

let transporter;
try {
  transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_FOR_NOTIFICATIONS,
      pass: process.env.EMAIL_PASS,
    },
  });
} catch (err) {
  console.error("Failed to create email transporter:", err);
  throw err;
}

/**
 * buildEmail - reusable HTML email template (inline styles, table layout)
 * @param {Object} options
 * @param {string} options.title - main headline
 * @param {string} options.preheader - short preview text
 * @param {string} options.message - html string for the message/body
 * @param {string} [options.ctaText] - button text (optional)
 * @param {string} [options.ctaUrl] - button url (optional)
 * @param {string} [options.note] - small note under button (optional)
 */
const buildEmail = ({ title, preheader, message, ctaText, ctaUrl, note }) => {
  // Plain-text fallback
  const textParts = [title, message.replace(/<[^>]*>/g, ""), ctaUrl || ""].join("\n\n");

  // HTML (safe, inline styles)
  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background-color:#f3f4f6;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px;margin:24px auto;">
      <tr>
        <td align="center" style="padding:20px 16px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px rgba(16,24,40,0.08);">
            <!-- Header / Brand -->
            <tr>
              <td style="padding:24px 28px 8px; text-align:left;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#ef9a9a,#f48fb1);display:flex;align-items:center;justify-content:center;font-weight:700;color:white;">
                    RP
                  </div>
                  <div>
                    <div style="font-size:16px;font-weight:700;color:#0f172a;">Raika Photography</div>
                    <div style="font-size:12px;color:#64748b;margin-top:2px;">beautiful moments, captured</div>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Hero -->
            <tr>
              <td style="padding:20px 28px 8px;">
                <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${title}</h1>
                <div style="font-size:14px;color:#6b7280;line-height:1.45;">${preheader}</div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:8px 28px 20px; color:#334155; font-size:15px; line-height:1.6;">
                ${message}
              </td>
            </tr>

            <!-- CTA -->
            ${ctaText && ctaUrl ? `
            <tr>
              <td style="padding:0 28px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
                  <tr>
                    <td align="center">
                      <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#2563eb;color:white;text-decoration:none;font-weight:600;">${ctaText}</a>
                    </td>
                  </tr>
                </table>
                ${note ? `<div style="font-size:12px;color:#94a3b8;margin-top:12px;text-align:center;">${note}</div>` : ""}
              </td>
            </tr>` : ""}

            <!-- Footer -->
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;font-size:13px;color:#64748b;">
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                  <div>© ${new Date().getFullYear()} Raika Photography</div>
                  <div style="text-align:right;">Need help? <a href="mailto:${process.env.EMAIL_FOR_NOTIFICATIONS || 'support@raikaphotography.example'}" style="color:#2563eb;text-decoration:none;">Contact us</a></div>
                </div>
              </td>
            </tr>

          </table>
          <div style="text-align:center;margin-top:12px;color:#94a3b8;font-size:12px;">
            If you didn't expect this email, you can ignore it.
          </div>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  return { html, text: textParts };
};

/* === Specific templates === */

export const sendVerificationEmail = catchAsync(async (email, url) => {
  const { html, text } = buildEmail({
    title: "Verify your email address",
    preheader: "One last step — confirm your email to activate your account.",
    message: `
      <p style="margin:0 0 12px">Hi there 👋</p>
      <p style="margin:0 0 12px">Thanks for signing up for Raika Photography. Click the button below to verify your email address and get started.</p>
    `,
    ctaText: "Verify my email",
    ctaUrl: url,
    note: "This link will expire in 24 hours."
  });

  await transporter.sendMail({
    from: `"Raika Photography" <${process.env.EMAIL_FOR_NOTIFICATIONS}>`,
    to: email,
    subject: "Verify your Raika Photography account",
    html,
    text,
  });
});

export const sendResetTokenEmail = catchAsync(async (email, url) => {
  const { html, text } = buildEmail({
    title: "Reset your password",
    preheader: "We received a request to reset your password — use the link below.",
    message: `
      <p style="margin:0 0 12px">Hello,</p>
      <p style="margin:0 0 12px">You (or someone using your email) requested a password reset. Click the button below to set a new password for your account.</p>
      <ul style="margin:8px 0 0 18px;padding:0;color:#475569">
        <li>One-time use link</li>
        <li>Expires in 1 hour</li>
      </ul>
    `,
    ctaText: "Reset password",
    ctaUrl: url,
    note: "If you didn't request this, ignore this message or contact support."
  });

  await transporter.sendMail({
    from: `"Raika Photography" <${process.env.EMAIL_FOR_NOTIFICATIONS}>`,
    to: email,
    subject: "Password reset — Raika Photography",
    html,
    text,
  });
});

export const sendTransactionEmail = catchAsync(async (email, type, amount) => {
  const { html, text } = buildEmail({
    title: "Transaction update",
    preheader: `A ${type} of ₹${amount} was recorded.`,
    message: `
      <p style="margin:0 0 12px">Hi,</p>
      <p style="margin:0 0 12px">This is a quick update that a <strong style="color:#0f172a">${type}</strong> of <strong style="color:#0f172a">₹${amount}</strong> has been ${type} on your account.</p>
      <p style="margin:0 0 12px">If this looks wrong, please reply to this email or contact our support immediately.</p>
    `,
    // No CTA for small transaction notice, but you can pass one if needed
  });

  await transporter.sendMail({
    from: `"Raika Photography" <${process.env.EMAIL_FOR_NOTIFICATIONS}>`,
    to: [email, process.env.ADMIN_EMAIL_TO_GET_UPDATE].filter(Boolean),
    subject: "Transaction on your Raika account",
    html,
    text,
  });
});

export const sendEmailToAdmin = catchAsync(async (amount, userEmail, leadId) => {
  const { html, text } = buildEmail({
    title: "[URGENT] Transaction dispute — action required",
    preheader: `Possible duplicate/incorrect credit for lead ${leadId}.`,
    message: `
      <p style="margin:0 0 12px"><strong>Attention Finance/Admin team,</strong></p>
      <p style="margin:0 0 12px">We detected a potential duplicate transaction for <strong>${userEmail}</strong> on lead <strong>${leadId}</strong>. An amount of <strong>₹${amount}</strong> was already credited, but a second update has been requested.</p>
      <ol style="margin:8px 0 12px;padding-left:18px;color:#475569">
        <li>Verify the original credit for lead ID: <strong>${leadId}</strong>.</li>
        <li>If original credit was incorrect, debit the previously added amount and apply corrections manually.</li>
        <li>Contact the user to confirm next steps.</li>
      </ol>
      <p style="margin:0 0 12px">Please handle this as high priority.</p>
    `,
    ctaText: "Open Admin Panel",
    ctaUrl: process.env.ADMIN_PANEL_URL || "#",
    note: "If you're not the right person, please escalate to the Finance lead."
  });

  await transporter.sendMail({
    from: `"Raika Photography" <${process.env.EMAIL_FOR_NOTIFICATIONS}>`,
    to: process.env.ADMIN_EMAIL_TO_GET_UPDATE,
    subject: "[URGENT] Transaction dispute - Needs Attention",
    html,
    text,
  });
});
