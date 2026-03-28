import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Platform Documentation",
  description: "API reference, user guides, and deployment documentation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <nav
          style={{
            borderBottom: "1px solid #e5e7eb",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: "24px",
            background: "#fafafa",
          }}
        >
          <a
            href="/docs"
            style={{ fontWeight: 700, fontSize: "16px", textDecoration: "none", color: "#111" }}
          >
            SMS Docs
          </a>
          <a href="/docs/api" style={{ textDecoration: "none", color: "#555", fontSize: "14px" }}>
            API Reference
          </a>
          <a href="/docs/guide" style={{ textDecoration: "none", color: "#555", fontSize: "14px" }}>
            User Guide
          </a>
          <a href="/docs/deploy" style={{ textDecoration: "none", color: "#555", fontSize: "14px" }}>
            Deployment
          </a>
        </nav>
        <main style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
