/**
 * Outbound email. Development-mode implementation: log messages to the
 * server console with an obvious marker so the developer can copy the
 * code / reset link into the browser without needing an email account.
 *
 * To ship this for real: swap the body of `deliver()` for a call into
 * Resend (recommended), Postmark, SES, or an SMTP transport via
 * nodemailer. Everything upstream (register / verify / reset flows)
 * already awaits the promise, so the change is contained here.
 */

interface Message {
  to: string;
  subject: string;
  body: string;
}

async function deliver(msg: Message): Promise<void> {
  const banner = '━'.repeat(60);
  const lines = [
    '',
    banner,
    `📧  DEV EMAIL — nothing is actually sent`,
    `    to:      ${msg.to}`,
    `    subject: ${msg.subject}`,
    '',
    ...msg.body.split('\n').map((l) => `    ${l}`),
    banner,
    '',
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  await deliver({
    to: email,
    subject: 'Your Plus One verification code',
    body:
      `Your verification code is:\n\n    ${code}\n\n` +
      `It expires in 15 minutes. If you didn't sign up, ignore this email.`,
  });
}

export async function sendPasswordResetLink(email: string, url: string): Promise<void> {
  await deliver({
    to: email,
    subject: 'Reset your Plus One password',
    body:
      `Click the link below to choose a new password:\n\n    ${url}\n\n` +
      `The link is valid for 1 hour. If you didn't request a reset, ignore this email.`,
  });
}
