-- ════════════════════════════════════════════════════════════════════
--  Sierra — seed data (SAFE for any environment)
--  Creates the three demo tenants ONLY. It deliberately does NOT create
--  any user/admin account — provision the first admin with a real password
--  via `node scripts/bootstrap-admin.mjs` (reads SEED_ADMIN_* env vars) so
--  no known credentials ever ship in the database.
-- ════════════════════════════════════════════════════════════════════

INSERT INTO tenants
  (id, name, slug, primary_color, accent_color, welcome_message, tone,
   off_limit_topics, off_limit_phrases, approval_threshold, require_approval)
VALUES
  ('r-mobile', 'R-Mobile', 'r-mobile', '#ef4444', '#1e293b',
   'Welcome to R-Mobile! How can we help with your device or plan today?',
   'professional',
   '["Competitor pricing","Unlocking devices","Third-party repairs"]'::jsonb,
   '["I don''t know","That''s not my department","Call back later"]'::jsonb,
   300, 1),
  ('ichiba', 'Ichiba', 'ichiba', '#f97316', '#0f172a',
   'Konnichiwa! Welcome to Ichiba. What can we help you find today?',
   'empathetic',
   '["Counterfeit items","Illegal goods","Tax evasion"]'::jsonb,
   '["Not my problem","Figure it out yourself","I am busy"]'::jsonb,
   500, 1),
  ('r-travel', 'RTravel', 'r-travel', '#06b6d4', '#0f172a',
   'Hello traveler! Ready to plan your next adventure?',
   'enthusiastic',
   '["Visa fraud","Illegal destinations","Travel insurance scams"]'::jsonb,
   '["I don''t care","That''s your fault","Nothing I can do"]'::jsonb,
   1000, 1)
ON CONFLICT (id) DO NOTHING;
