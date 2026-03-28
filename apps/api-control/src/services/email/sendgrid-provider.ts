import type { EmailProvider } from "./provider";

export class SendGridProvider implements EmailProvider {
  private apiKey: string;
  private from: string;
  private configured: boolean;

  constructor() {
    this.apiKey = process.env["SENDGRID_API_KEY"] ?? "";
    this.from = process.env["SENDGRID_FROM"] ?? "noreply@cctv-platform.local";
    this.configured = !!this.apiKey;
  }

  async send(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.configured) {
      console.log("[EMAIL-SENDGRID-DEV] SendGrid not configured, logging email:");
      console.log(`  To: ${options.to}`);
      console.log(`  Subject: ${options.subject}`);
      console.log(`  Body: ${options.text ?? options.html.slice(0, 200)}...`);
      return { success: true, messageId: `dev-${Date.now()}` };
    }

    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: this.from },
          subject: options.subject,
          content: [
            ...(options.text
              ? [{ type: "text/plain", value: options.text }]
              : []),
            { type: "text/html", value: options.html },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `SendGrid ${res.status}: ${body}` };
      }

      const messageId = res.headers.get("x-message-id") ?? `sg-${Date.now()}`;
      return { success: true, messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
