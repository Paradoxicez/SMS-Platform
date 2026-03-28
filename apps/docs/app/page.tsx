export default function DocsHome() {
  return (
    <div>
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
        SMS Platform Documentation
      </h1>
      <p style={{ color: "#666", marginBottom: "32px" }}>
        Everything you need to deploy, configure, and integrate with the CCTV
        streaming management platform.
      </p>

      <div style={{ display: "grid", gap: "16px" }}>
        <a
          href="/docs/api"
          style={{
            display: "block",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "20px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 4px 0" }}>
            API Reference
          </h2>
          <p style={{ color: "#666", margin: 0, fontSize: "14px" }}>
            REST API endpoints for cameras, projects, sites, playback sessions,
            webhooks, recordings, and AI integrations.
          </p>
        </a>

        <a
          href="/docs/guide"
          style={{
            display: "block",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "20px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 4px 0" }}>
            User Guide
          </h2>
          <p style={{ color: "#666", margin: 0, fontSize: "14px" }}>
            Getting started, camera management, stream profiles, playback
            sessions, and recordings.
          </p>
        </a>

        <a
          href="/docs/deploy"
          style={{
            display: "block",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "20px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 4px 0" }}>
            Deployment Guide
          </h2>
          <p style={{ color: "#666", margin: 0, fontSize: "14px" }}>
            Docker, on-prem HCI, and SaaS deployment options.
          </p>
        </a>
      </div>
    </div>
  );
}
