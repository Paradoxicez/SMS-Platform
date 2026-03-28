import type { EmailProvider } from "./provider";
import { SmtpProvider } from "./smtp-provider";
import { SendGridProvider } from "./sendgrid-provider";
import { verificationTemplate } from "./templates/verification";
import { invitationTemplate } from "./templates/invitation";
import { cameraAlertTemplate } from "./templates/camera-alert";

export type { EmailProvider } from "./provider";

class ConsoleProvider implements EmailProvider {
  async send(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    console.log("[EMAIL-CONSOLE] ========================================");
    console.log(`  To:      ${options.to}`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  Body:    ${options.text ?? options.html.slice(0, 300)}...`);
    console.log("[EMAIL-CONSOLE] ========================================");
    return { success: true, messageId: `console-${Date.now()}` };
  }
}

let _provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (_provider) return _provider;

  const providerName = (process.env["EMAIL_PROVIDER"] ?? "console").toLowerCase();

  switch (providerName) {
    case "smtp":
      _provider = new SmtpProvider();
      break;
    case "sendgrid":
      _provider = new SendGridProvider();
      break;
    default:
      _provider = new ConsoleProvider();
  }

  return _provider;
}

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const provider = getEmailProvider();
  return provider.send({
    to,
    subject: "Verify your email - CCTV Platform",
    html: verificationTemplate(verifyUrl),
    text: `Verify your email by visiting: ${verifyUrl}`,
  });
}

export async function sendInvitationEmail(
  to: string,
  inviteUrl: string,
  tenantName: string,
) {
  const provider = getEmailProvider();
  return provider.send({
    to,
    subject: `You've been invited to ${tenantName} - CCTV Platform`,
    html: invitationTemplate(inviteUrl, tenantName),
    text: `You've been invited to join ${tenantName}. Accept the invitation: ${inviteUrl}`,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const provider = getEmailProvider();
  return provider.send({
    to,
    subject: "Reset your password - CCTV Platform",
    html: `<!DOCTYPE html>
<html><body style="margin:0;padding:40px 20px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="480" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:32px;text-align:center;">
    <h2 style="margin:0 0 16px;color:#18181b;">Reset your password</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">Click below to reset your password. This link expires in 1 hour.</p>
    <a href="${resetUrl}" style="display:inline-block;padding:12px 32px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">Reset Password</a>
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #f4f4f5;text-align:center;font-size:12px;color:#a1a1aa;">CCTV Streaming Platform</td></tr>
</table>
</body></html>`,
    text: `Reset your password: ${resetUrl}`,
  });
}

export async function sendCameraOfflineAlert(
  to: string,
  cameraName: string,
  siteName: string,
) {
  const provider = getEmailProvider();
  return provider.send({
    to,
    subject: `Camera offline: ${cameraName} - CCTV Platform`,
    html: cameraAlertTemplate(cameraName, siteName, "offline"),
    text: `Camera "${cameraName}" at site "${siteName}" is now offline.`,
  });
}

export async function sendBillingReceipt(
  to: string,
  invoiceData: { id: string; amount: string; date: string; description: string },
) {
  const provider = getEmailProvider();
  return provider.send({
    to,
    subject: `Payment receipt #${invoiceData.id} - CCTV Platform`,
    html: `<!DOCTYPE html>
<html><body style="margin:0;padding:40px 20px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="480" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 16px;color:#18181b;">Payment Receipt</h2>
    <table width="100%" cellpadding="8" cellspacing="0" style="background:#f4f4f5;border-radius:6px;">
      <tr><td style="font-size:13px;color:#71717a;">Invoice</td><td style="font-size:13px;color:#18181b;">#${invoiceData.id}</td></tr>
      <tr><td style="font-size:13px;color:#71717a;">Amount</td><td style="font-size:13px;color:#18181b;font-weight:600;">${invoiceData.amount}</td></tr>
      <tr><td style="font-size:13px;color:#71717a;">Date</td><td style="font-size:13px;color:#18181b;">${invoiceData.date}</td></tr>
      <tr><td style="font-size:13px;color:#71717a;">Description</td><td style="font-size:13px;color:#18181b;">${invoiceData.description}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #f4f4f5;text-align:center;font-size:12px;color:#a1a1aa;">CCTV Streaming Platform</td></tr>
</table>
</body></html>`,
    text: `Payment receipt #${invoiceData.id} - Amount: ${invoiceData.amount} - Date: ${invoiceData.date}`,
  });
}

export async function sendLicenseExpiryWarning(
  to: string,
  expiryDate: string,
  daysLeft: number,
) {
  const provider = getEmailProvider();
  return provider.send({
    to,
    subject: `License expiring in ${daysLeft} days - CCTV Platform`,
    html: `<!DOCTYPE html>
<html><body style="margin:0;padding:40px 20px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="480" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:32px;text-align:center;">
    <h2 style="margin:0 0 16px;color:#18181b;">License Expiry Warning</h2>
    <p style="margin:0 0 8px;font-size:14px;color:#71717a;">Your CCTV Platform license expires on <strong>${expiryDate}</strong>.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#f59e0b;font-weight:600;">${daysLeft} days remaining</p>
    <p style="margin:0;font-size:13px;color:#71717a;">Contact your administrator to renew.</p>
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #f4f4f5;text-align:center;font-size:12px;color:#a1a1aa;">CCTV Streaming Platform</td></tr>
</table>
</body></html>`,
    text: `Your license expires on ${expiryDate} (${daysLeft} days remaining). Please renew.`,
  });
}
