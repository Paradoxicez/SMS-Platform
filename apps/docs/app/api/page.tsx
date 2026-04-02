export default function ApiReferencePage() {
  const endpoints = [
    { method: "POST", path: "/api/v1/auth/register", desc: "Register a new tenant and admin user" },
    { method: "GET", path: "/api/v1/tenants", desc: "Get current tenant details" },
    { method: "GET", path: "/api/v1/projects", desc: "List projects" },
    { method: "POST", path: "/api/v1/projects", desc: "Create a project" },
    { method: "GET", path: "/api/v1/projects/:id/sites", desc: "List sites in a project" },
    { method: "POST", path: "/api/v1/projects/:id/sites", desc: "Create a site" },
    { method: "POST", path: "/api/v1/sites/:id/cameras", desc: "Onboard a camera" },
    { method: "GET", path: "/api/v1/cameras", desc: "List cameras with filters" },
    { method: "GET", path: "/api/v1/cameras/:id", desc: "Get camera details" },
    { method: "POST", path: "/api/v1/cameras/:id/start", desc: "Start camera ingest" },
    { method: "POST", path: "/api/v1/cameras/:id/stop", desc: "Stop camera ingest" },
    { method: "GET", path: "/api/v1/cameras/:id/status", desc: "Get camera health status" },
    { method: "POST", path: "/api/v1/playback/sessions", desc: "Create a playback session" },
    { method: "GET", path: "/api/v1/stream-profiles", desc: "List stream profiles" },
    { method: "POST", path: "/api/v1/stream-profiles", desc: "Create a stream profile" },
    { method: "GET", path: "/api/v1/audit", desc: "Query audit events" },
    { method: "POST", path: "/api/v1/webhooks", desc: "Register a webhook" },
    { method: "GET", path: "/api/v1/webhooks", desc: "List webhooks" },
    { method: "DELETE", path: "/api/v1/webhooks/:id", desc: "Delete a webhook" },
    { method: "POST", path: "/api/v1/webhooks/:id/test", desc: "Send test webhook" },
    { method: "GET", path: "/api/v1/webhooks/:id/deliveries", desc: "Webhook delivery logs" },
    { method: "POST", path: "/api/v1/cameras/:id/recording/enable", desc: "Enable recording" },
    { method: "POST", path: "/api/v1/cameras/:id/recording/disable", desc: "Disable recording" },
    { method: "GET", path: "/api/v1/cameras/:id/recordings", desc: "List recordings" },
    { method: "POST", path: "/api/v1/recordings/:id/playback", desc: "Create VOD session" },
    { method: "POST", path: "/api/v1/data/export", desc: "Export tenant data (GDPR)" },
    { method: "POST", path: "/api/v1/data/delete-tenant", desc: "Delete tenant (GDPR)" },
    { method: "GET", path: "/api/v1/developer/usage", desc: "API usage analytics" },
  ];

  const methodColors: Record<string, string> = {
    GET: "#22c55e",
    POST: "#3b82f6",
    PATCH: "#f59e0b",
    DELETE: "#ef4444",
  };

  return (
    <div>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
        API Reference
      </h1>
      <p style={{ color: "#666", marginBottom: "24px" }}>
        All endpoints require authentication via Bearer token or API key
        (X-API-Key header) unless noted otherwise. Responses use a standard
        envelope: {"{"} data, meta, pagination {"}"}.
      </p>

      <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>
        Authentication
      </h2>
      <p style={{ color: "#666", fontSize: "14px", marginBottom: "24px" }}>
        Include <code>Authorization: Bearer &lt;token&gt;</code> or{" "}
        <code>X-API-Key: &lt;key&gt;</code> in request headers. Tokens are
        obtained via OIDC login; API keys are generated from the Developer
        Portal.
      </p>

      <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "12px" }}>
        Endpoints
      </h2>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "14px",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "8px 12px" }}>Method</th>
            <th style={{ padding: "8px 12px" }}>Path</th>
            <th style={{ padding: "8px 12px" }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map((ep, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "8px 12px" }}>
                <span
                  style={{
                    background: methodColors[ep.method] ?? "#999",
                    color: "white",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {ep.method}
                </span>
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  fontFamily: "monospace",
                  fontSize: "13px",
                }}
              >
                {ep.path}
              </td>
              <td style={{ padding: "8px 12px", color: "#555" }}>{ep.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
