export function cameraAlertTemplate(
  cameraName: string,
  siteName: string,
  status: string,
): string {
  const isOffline = status.toLowerCase() === "offline";
  const statusColor = isOffline ? "#ef4444" : "#f59e0b";
  const statusLabel = isOffline ? "Offline" : "Degraded";

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
              <h1 style="margin:0 0 12px;font-size:20px;color:#18181b;">Camera Alert</h1>
              <p style="margin:0 0 16px;font-size:14px;color:#71717a;line-height:1.6;">
                A camera in your network requires attention:
              </p>
              <table width="100%" cellpadding="12" cellspacing="0" style="background:#f4f4f5;border-radius:6px;">
                <tr>
                  <td style="font-size:13px;color:#71717a;">Camera</td>
                  <td style="font-size:13px;color:#18181b;font-weight:500;">${cameraName}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#71717a;">Site</td>
                  <td style="font-size:13px;color:#18181b;font-weight:500;">${siteName}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#71717a;">Status</td>
                  <td style="font-size:13px;color:${statusColor};font-weight:600;">${statusLabel}</td>
                </tr>
              </table>
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
