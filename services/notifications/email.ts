import nodemailer from "nodemailer";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    });
  }

  async send(params: SendEmailParams): Promise<void> {
    const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || "noreply@kairo.io",
      to: toAddresses.join(", "),
      subject: params.subject,
      html: params.html,
      text: params.text || params.html.replace(/<[^>]*>/g, ""),
    });
  }
}

function createEmailService(): EmailService {
  const config: EmailConfig = {
    host: process.env.EMAIL_HOST || "localhost",
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER || "",
      pass: process.env.EMAIL_PASS || "",
    },
  };

  return new EmailService(config);
}

export { EmailService, SendEmailParams };
export { createEmailService };