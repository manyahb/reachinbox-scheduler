import nodemailer, { Transporter } from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let transporterPromise: Promise<Transporter> | null = null;

/**
 * Lazily creates (and caches) a single Ethereal transporter. If no
 * ETHEREAL_USER/PASS are configured in .env, we auto-create a throwaway
 * Ethereal test account on first send so the app works out of the box.
 */
function getTransporter(): Promise<Transporter> {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    let user = process.env.ETHEREAL_USER;
    let pass = process.env.ETHEREAL_PASS;

    if (!user || !pass) {
      const testAccount = await nodemailer.createTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
      console.log(
        `⚠️  No ETHEREAL_USER/PASS set — created a temporary Ethereal account: ${user}`
      );
    }

    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user, pass },
    });
  })();

  return transporterPromise;
}

export interface SendEmailInput {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmailViaEthereal(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info),
  };
}
