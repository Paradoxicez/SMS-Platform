export interface EmailProvider {
  send(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}
