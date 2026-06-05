import nodemailer from 'nodemailer';

const transporter = () => {
  const host = process.env.SMTP_HOST;
  if (!host || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export async function sendOtpEmail(to: string, otp: string, businessName: string) {
  const subject = 'Activate your Bekye Swap account';
  const html = `
    <div style="font-family:sans-serif;max-width:480px">
      <h2>Welcome to Bekye Battery Swap</h2>
      <p>Hi ${businessName},</p>
      <p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${otp}</p>
      <p>This code expires in 15 minutes.</p>
      <p>If you did not register, ignore this email.</p>
    </div>
  `;

  if (process.env.DEV_LOG_OTP === 'true') {
    console.log(`[OTP] ${to}: ${otp}`);
    return;
  }

  const transport = transporter();
  if (!transport) {
    console.log(`[OTP] ${to}: ${otp}`);
    console.log('[OTP] SMTP not configured — set Gmail credentials in backend/.env');
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? 'Bekye Swap <noreply@bekye.local>',
    to,
    subject,
    html,
  });
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
