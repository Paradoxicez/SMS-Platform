-- Seed dev users with bcrypt-hashed passwords (password: demo123)
-- This runs only if the default tenant doesn't exist yet

INSERT INTO tenants (id, name, slug, billing_email, subscription_tier, onboarding_completed)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Tenant',
  'demo',
  'demo@example.com',
  'free',
  true
) ON CONFLICT DO NOTHING;

INSERT INTO users (id, tenant_id, email, name, password_hash, role, mfa_enabled)
VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'demo@example.com',
    'Demo Admin',
    '$2b$12$LyT.XHXZcfIzGyW1cQ/tJ.zXwFsa6t7qoDw07Z5hh6nRFBQLtav7e',
    'admin',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'operator@example.com',
    'Demo Operator',
    '$2b$12$LyT.XHXZcfIzGyW1cQ/tJ.zXwFsa6t7qoDw07Z5hh6nRFBQLtav7e',
    'operator',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'developer@example.com',
    'Demo Developer',
    '$2b$12$LyT.XHXZcfIzGyW1cQ/tJ.zXwFsa6t7qoDw07Z5hh6nRFBQLtav7e',
    'developer',
    false
  )
ON CONFLICT DO NOTHING;
