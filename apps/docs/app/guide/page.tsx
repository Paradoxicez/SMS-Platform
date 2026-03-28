export default function UserGuidePage() {
  return (
    <div>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
        User Guide
      </h1>
      <p style={{ color: "#666", marginBottom: "32px" }}>
        Learn how to set up and manage your CCTV streaming platform.
      </p>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "12px" }}>
          Getting Started
        </h2>
        <ol style={{ color: "#444", lineHeight: "1.8", paddingLeft: "20px" }}>
          <li>
            <strong>Create a tenant</strong> — Register your organization via
            the sign-up page or API. You will be the initial admin.
          </li>
          <li>
            <strong>Create a project</strong> — Projects group sites and
            cameras logically (e.g., by region or customer).
          </li>
          <li>
            <strong>Create a site</strong> — Each site represents a physical
            location within a project.
          </li>
          <li>
            <strong>Onboard cameras</strong> — Add RTSP or SRT camera URLs to
            a site. The platform will validate connectivity and begin ingest.
          </li>
          <li>
            <strong>View streams</strong> — Use the dashboard or create
            playback sessions to watch HLS/WebRTC streams.
          </li>
        </ol>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "12px" }}>
          Camera Management
        </h2>
        <p style={{ color: "#444", lineHeight: "1.8" }}>
          Cameras can be started, stopped, and monitored from the Cameras page.
          Health status is tracked automatically via RTSP heartbeats. The health
          state machine supports: <strong>connecting</strong>,{" "}
          <strong>online</strong>, <strong>degraded</strong>,{" "}
          <strong>offline</strong>, <strong>reconnecting</strong>, and{" "}
          <strong>stopped</strong>. Flapping detection prevents rapid state
          transitions.
        </p>
        <p style={{ color: "#444", lineHeight: "1.8", marginTop: "8px" }}>
          Use <strong>bulk operations</strong> to start, stop, or assign
          profiles to multiple cameras at once. CSV import/export is supported
          for large deployments.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "12px" }}>
          Stream Profiles
        </h2>
        <p style={{ color: "#444", lineHeight: "1.8" }}>
          Stream profiles control output settings applied to cameras:
        </p>
        <ul style={{ color: "#444", lineHeight: "1.8", paddingLeft: "20px" }}>
          <li>
            <strong>Output protocol</strong> — HLS, WebRTC, or both.
          </li>
          <li>
            <strong>Audio mode</strong> — Include, strip, or mute audio.
          </li>
          <li>
            <strong>Framerate cap</strong> — Limit output framerate for
            bandwidth savings.
          </li>
          <li>
            <strong>Resolution</strong> — Downscale to 1080p, 720p, etc.
          </li>
        </ul>
        <p style={{ color: "#444", lineHeight: "1.8", marginTop: "8px" }}>
          Assign profiles to individual cameras or apply a site-wide default
          profile.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "12px" }}>
          Playback Sessions
        </h2>
        <p style={{ color: "#444", lineHeight: "1.8" }}>
          Playback sessions provide secure, time-limited access to camera
          streams. Each session generates a unique playback URL with an
          expiration time. Sessions can be created via the API or console and
          are tracked for billing purposes.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "12px" }}>
          Recordings
        </h2>
        <p style={{ color: "#444", lineHeight: "1.8" }}>
          Enable recording on individual cameras to capture footage in fMP4
          format. Recordings are stored locally or in S3-compatible storage.
          Configure retention days per camera. Browse and play back recordings
          from the Recordings page.
        </p>
      </section>
    </div>
  );
}
