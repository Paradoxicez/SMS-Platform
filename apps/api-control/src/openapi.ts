/**
 * T122: OpenAPI 3.1 spec generation
 *
 * Returns the full API spec as a JSON object.
 * Served at GET /api/v1/docs.
 */
export function generateOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "B2B CCTV Streaming Platform — API Control Plane",
      version: "1.0.0",
      description:
        "Multi-tenant API for managing cameras, playback sessions, users, API keys, audit logs, and tenant settings.",
    },
    servers: [
      {
        url: "/api/v1",
        description: "API v1",
      },
    ],
    paths: {
      "/cameras": {
        get: {
          summary: "List cameras",
          tags: ["Cameras"],
          parameters: [
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "site_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "tags", in: "query", schema: { type: "string" } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "per_page", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            "200": {
              description: "Paginated camera list",
              content: { "application/json": { schema: { $ref: "#/components/schemas/PaginatedCameras" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/cameras/{id}": {
        get: {
          summary: "Get camera details",
          tags: ["Cameras"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Camera details" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        patch: {
          summary: "Update camera",
          tags: ["Cameras"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateCameraInput" } } },
          },
          responses: {
            "200": { description: "Updated camera" },
            "404": { $ref: "#/components/responses/NotFound" },
            "409": { description: "Version conflict" },
          },
        },
        delete: {
          summary: "Delete camera",
          tags: ["Cameras"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Deleted" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/cameras/{id}/status": {
        get: {
          summary: "Get camera health status",
          tags: ["Cameras"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Camera health status" } },
        },
      },
      "/sites/{siteId}/cameras": {
        post: {
          summary: "Create camera",
          tags: ["Cameras"],
          parameters: [{ name: "siteId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateCameraInput" } } },
          },
          responses: { "201": { description: "Camera created" } },
        },
      },
      "/playback/sessions": {
        post: {
          summary: "Create playback session",
          tags: ["Playback"],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["camera_id"],
                  properties: {
                    camera_id: { type: "string", format: "uuid" },
                    ttl: { type: "integer", default: 3600 },
                    embed_origin: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Session created with playback URL and token" },
            "403": { description: "Quota exceeded or origin denied" },
          },
        },
      },
      "/playback/sessions/{id}/refresh": {
        post: {
          summary: "Refresh playback session",
          tags: ["Playback"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Session refreshed" } },
        },
      },
      "/playback/sessions/{id}/revoke": {
        post: {
          summary: "Revoke playback session",
          tags: ["Playback"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Session revoked" } },
        },
      },
      "/users": {
        get: {
          summary: "List users",
          tags: ["Users"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "per_page", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": { description: "Paginated user list" } },
        },
        post: {
          summary: "Invite user",
          tags: ["Users"],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "name", "role"],
                  properties: {
                    email: { type: "string", format: "email" },
                    name: { type: "string" },
                    role: { type: "string", enum: ["admin", "operator", "developer", "viewer"] },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "User invited" } },
        },
      },
      "/users/{id}/role": {
        patch: {
          summary: "Change user role",
          tags: ["Users"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["role"],
                  properties: {
                    role: { type: "string", enum: ["admin", "operator", "developer", "viewer"] },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Role updated" } },
        },
      },
      "/users/{id}": {
        delete: {
          summary: "Remove user",
          tags: ["Users"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "User removed" } },
        },
      },
      "/api-clients": {
        get: {
          summary: "List API keys",
          tags: ["API Clients"],
          responses: { "200": { description: "List of API keys with creator, project, and site info" } },
        },
        post: {
          summary: "Generate API key",
          tags: ["API Clients"],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["label"],
                  properties: {
                    label: { type: "string" },
                    project_id: { type: "string", format: "uuid", description: "Scope key to a specific project" },
                    site_id: { type: "string", format: "uuid", description: "Scope key to a specific site" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "API key generated (returned once)" } },
        },
      },
      "/api-clients/{id}": {
        delete: {
          summary: "Delete API key",
          tags: ["API Clients"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "API key deleted" } },
        },
      },
      "/api-clients/{id}/revoke": {
        post: {
          summary: "Revoke API key",
          tags: ["API Clients"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "API key revoked" } },
        },
      },
      "/api-clients/{id}/disable": {
        post: {
          summary: "Disable API key",
          tags: ["API Clients"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "API key disabled" } },
        },
      },
      "/api-clients/{id}/enable": {
        post: {
          summary: "Enable API key",
          tags: ["API Clients"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "API key enabled" } },
        },
      },
      "/audit/events": {
        get: {
          summary: "Search audit events",
          tags: ["Audit"],
          parameters: [
            { name: "event_type", in: "query", schema: { type: "string" } },
            { name: "actor_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "camera_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "session_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "per_page", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": { description: "Paginated audit events" } },
        },
      },
      "/audit/events/export": {
        post: {
          summary: "Export audit events",
          tags: ["Audit"],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    format: { type: "string", enum: ["csv", "json"], default: "json" },
                    event_type: { type: "string" },
                    from: { type: "string", format: "date-time" },
                    to: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Exported data as CSV or JSON file" },
          },
        },
      },
      "/tenants/{id}": {
        patch: {
          summary: "Update tenant settings",
          tags: ["Tenants"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Tenant updated" } },
        },
      },
      "/health": {
        get: {
          summary: "Liveness check",
          tags: ["Operations"],
          responses: { "200": { description: "Service is alive" } },
        },
      },
      "/ready": {
        get: {
          summary: "Readiness check",
          tags: ["Operations"],
          responses: {
            "200": { description: "Service is ready" },
            "503": { description: "Service is not ready" },
          },
        },
      },
      "/metrics": {
        get: {
          summary: "Prometheus metrics",
          tags: ["Operations"],
          responses: {
            "200": {
              description: "Prometheus-format metrics",
              content: { "text/plain": {} },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
      },
      schemas: {
        CreateCameraInput: {
          type: "object",
          required: ["name", "rtsp_url", "site_id"],
          properties: {
            site_id: { type: "string", format: "uuid" },
            name: { type: "string" },
            rtsp_url: { type: "string", format: "uri" },
            tags: { type: "array", items: { type: "string" } },
            lat: { type: "number" },
            lng: { type: "number" },
          },
        },
        UpdateCameraInput: {
          type: "object",
          required: ["version"],
          properties: {
            name: { type: "string" },
            rtsp_url: { type: "string", format: "uri" },
            tags: { type: "array", items: { type: "string" } },
            version: { type: "integer" },
          },
        },
        PaginatedCameras: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Camera" } },
            meta: { $ref: "#/components/schemas/Meta" },
            pagination: { $ref: "#/components/schemas/Pagination" },
          },
        },
        Camera: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            health_status: {
              type: "string",
              enum: ["connecting", "online", "degraded", "offline", "reconnecting", "stopping", "stopped"],
            },
            last_seen_at: { type: "string", format: "date-time", nullable: true },
          },
        },
        Meta: {
          type: "object",
          properties: {
            request_id: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            page: { type: "integer" },
            per_page: { type: "integer" },
            total: { type: "integer" },
            total_pages: { type: "integer" },
          },
        },
        ErrorEnvelope: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: {},
              },
            },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Authentication required",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorEnvelope" },
            },
          },
        },
        Forbidden: {
          description: "Insufficient permissions",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorEnvelope" },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorEnvelope" },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  };
}
