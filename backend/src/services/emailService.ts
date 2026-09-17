import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

let cachedTransporter: Transporter | null = null;
let etherealCredentials: { user: string; pass: string } | null = null;

export const getTransporter = async (): Promise<Transporter> => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  // Use configured credentials if present
  if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    etherealCredentials = {
      user: env.ETHEREAL_USER,
      pass: env.ETHEREAL_PASS,
    };
  } else {
    // Generate an Ethereal test account automatically
    console.log('[EmailService] Generating Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    etherealCredentials = {
      user: testAccount.user,
      pass: testAccount.pass,
    };
    console.log(`[EmailService] Ethereal account ready: ${etherealCredentials.user}`);
  }

  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: etherealCredentials.user,
      pass: etherealCredentials.pass,
    },
  });

  return cachedTransporter;
};

export interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export const sendEmail = async (options: SendEmailOptions): Promise<SendEmailResult> => {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    text: options.body,
    html: `<div style="font-family: sans-serif; line-height: 1.5;">${options.body.replace(
      /\n/g,
      '<br/>',
    )}</div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[EmailService] Preview URL for ${options.to}: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl,
  };
};

export const getEtherealCredentials = async () => {
  if (!etherealCredentials) {
    await getTransporter();
  }
  return etherealCredentials;
};
