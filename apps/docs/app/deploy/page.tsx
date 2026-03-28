export default function DeploymentGuidePage() {
  return (
    <div>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
        Deployment Guide
      </h1>
      <p style={{ color: "#666", marginBottom: "32px" }}>
        Deploy the SMS platform using Docker, on-prem HCI, or as a SaaS
        service.
      </p>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "12px" }}>
          Docker (Recommended)
        </h2>
        <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "12px" }}>
          The simplest way to deploy all platform components.
        </p>
        <pre
          style={{
            background: "#f3f4f6",
            padding: "16px",
            borderRadius: "8px",
            fontSize: "13px",
            overflow: "auto",
          }}
        >
{`# Clone the repository
git clone https://github.com/your-org/sms-platform.git
cd sms-platform

# Copy environment configuration
cp .env.example .env

# Start all services
docker compose up -d

# Services:
# - api-control:       localhost:3001
# - console-web:       localhost:3000
# - data-plane-worker: localhost:3003
# - docs:              localhost:3002
# - PostgreSQL:        localhost:5432
# - Redis:             localhost:6379
# - MediaMTX:          localhost:8554 (RTSP), localhost:8888 (HLS)`}
        </pre>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "12px" }}>
          On-Premises / HCI
        </h2>
        <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "12px" }}>
          For air-gapped or edge deployments on HCI (Hyper-Converged
          Infrastructure) appliances:
        </p>
        <ol style={{ color: "#444", lineHeight: "1.8", paddingLeft: "20px" }}>
          <li>
            <strong>System requirements</strong>: 4+ CPU cores, 8 GB RAM, 100
            GB SSD storage minimum. Scale storage based on recording retention.
          </li>
          <li>
            <strong>Install Docker</strong> on the target host or use
            pre-built OVA/QCOW2 images.
          </li>
          <li>
            <strong>Upload license key</strong> via the Settings &gt; License
            page in the console. On-prem deployments require a valid license.
          </li>
          <li>
            <strong>Configure networking</strong>: Ensure cameras are reachable
            via RTSP from the host. Configure firewall rules for ports 3000,
            3001, 8554, 8888.
          </li>
          <li>
            <strong>TLS</strong>: Place a reverse proxy (nginx, Caddy, or
            Traefik) in front of the services for HTTPS termination.
          </li>
        </ol>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "12px" }}>
          SaaS
        </h2>
        <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "12px" }}>
          For hosted / multi-tenant SaaS deployments:
        </p>
        <ul style={{ color: "#444", lineHeight: "1.8", paddingLeft: "20px" }}>
          <li>
            Deploy to Kubernetes with the provided Helm charts (see{" "}
            <code>deploy/helm/</code>).
          </li>
          <li>
            Use managed PostgreSQL (e.g., AWS RDS, GCP Cloud SQL) and Redis
            (ElastiCache, Memorystore).
          </li>
          <li>
            Enable RLS (Row-Level Security) policies for tenant isolation
            (enabled by default in the schema).
          </li>
          <li>
            Configure S3-compatible storage for recordings (set{" "}
            <code>RECORDING_STORAGE=s3</code> and provide bucket credentials).
          </li>
          <li>
            Set up OIDC provider for authentication (Auth0, Keycloak, etc.)
            via environment variables.
          </li>
          <li>
            Configure Stripe for billing using the <code>STRIPE_*</code>{" "}
            environment variables.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "12px" }}>
          Environment Variables
        </h2>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr
              style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}
            >
              <th style={{ padding: "8px 12px" }}>Variable</th>
              <th style={{ padding: "8px 12px" }}>Description</th>
              <th style={{ padding: "8px 12px" }}>Default</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["DATABASE_URL", "PostgreSQL connection string", "postgresql://postgres:postgres@localhost:5432/sms_app"],
              ["REDIS_URL", "Redis connection string", "redis://localhost:6379"],
              ["MEDIAMTX_API_URL", "MediaMTX HTTP API URL", "http://localhost:9997"],
              ["CORS_ORIGIN", "Allowed CORS origin", "http://localhost:3000"],
              ["JWT_SECRET", "JWT signing secret", "(required)"],
              ["STRIPE_SECRET_KEY", "Stripe API key (SaaS only)", "(optional)"],
              ["LICENSE_KEY", "On-prem license key", "(on-prem only)"],
            ].map(([name, desc, def], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td
                  style={{
                    padding: "8px 12px",
                    fontFamily: "monospace",
                    fontSize: "13px",
                  }}
                >
                  {name}
                </td>
                <td style={{ padding: "8px 12px", color: "#555" }}>{desc}</td>
                <td
                  style={{
                    padding: "8px 12px",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    color: "#888",
                  }}
                >
                  {def}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
