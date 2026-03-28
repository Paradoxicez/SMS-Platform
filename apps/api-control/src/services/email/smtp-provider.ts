import nodemailer from "nodemailer";
import type { EmailProvider } from "./provider";

export class SmtpProvider implements EmailProvider {
  private transporter: nodemailer.Transporter | null = null;
  private from: string;
  private configured: boolean;

  constructor() {
    const host = process.env["SMTP_HOST"];
    const port = process.env["SMTP_PORT"];
    const user = process.env["SMTP_USER"];
    const pass = process.env["SMTP_PASS"];
    this.from = process.env["SMTP_FROM"] ?? "noreply@cctv-platform.local";
    this.configured = !!(host && port);

    if (this.configured) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: user && pass ? { user, pass } : undefined,
      });
    }
  }

  async send(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.configured || !this.transporter) {
      console.log("[EMAIL-SMTP-DEV] SMTP not configured, logging email:");
      console.log(`  To: ${options.to}`);
      console.log(`  Subject: ${options.subject}`);
      console.log(`  Body: ${options.text ?? options.html.slice(0, 200)}...`);
      return { success: true, messageId: `dev-${Date.now()}` };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
