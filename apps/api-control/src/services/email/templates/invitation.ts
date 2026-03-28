export function invitationTemplate(inviteUrl: string, tenantName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <div style="width:40px;height:40px;background:#18181b;border-radius:8px;display:inline-block;line-height:40px;color:#fff;font-weight:bold;">C</div>
              <h2 style="margin:16px 0 0;font-size:18px;color:#18181b;">CCTV Platform</h2>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <h1 style="margin:0 0 12px;font-size:20px;color:#18181b;">You've been invited</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
                You've been invited to join <strong>${tenantName}</strong> on the CCTV Platform. Click below to accept the invitation.
              </p>
              <a href="${inviteUrl}" style="display:inline-block;padding:12px 32px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
                Accept Invitation
              </a>
              <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;">
                If the button doesn't work, copy and paste this URL into your browser:<br>
                <a href="${inviteUrl}" style="color:#18181b;word-break:break-all;">${inviteUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">CCTV Streaming Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
