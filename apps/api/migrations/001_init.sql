CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            text PRIMARY KEY DEFAULT ('u_' || encode(gen_random_bytes(9), 'hex')),
  email         text UNIQUE NOT NULL,
  name          text NOT NULL,
  phone         text,
  role          text NOT NULL DEFAULT 'STAFF' CHECK (role IN ('STAFF','MANAGER','ADMIN')),
  password_hash text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  must_change_pw boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE designs (
  id           text PRIMARY KEY DEFAULT ('d_' || encode(gen_random_bytes(10), 'hex')),
  brand        text NOT NULL DEFAULT 'CLELIA' CHECK (brand IN ('CLELIA','SCORPLING')),
  piece_type   text NOT NULL,
  prompt       text NOT NULL,
  metal        text NOT NULL,
  purity       text,
  stone        text,
  style_tags   jsonb NOT NULL DEFAULT '[]',
  params       jsonb NOT NULL DEFAULT '{}',
  summary      text,
  dimensions   jsonb,
  volume_mm3   double precision,
  weight_g     double precision,
  ref_images   jsonb NOT NULL DEFAULT '[]',
  ai_images    jsonb NOT NULL DEFAULT '[]',
  model_files  jsonb NOT NULL DEFAULT '[]',
  preview_path text,
  client_ip    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quotes (
  id              text PRIMARY KEY DEFAULT ('q_' || encode(gen_random_bytes(10), 'hex')),
  ref             text UNIQUE NOT NULL,
  track_token     text UNIQUE NOT NULL,
  brand           text NOT NULL DEFAULT 'CLELIA',
  design_id       text NOT NULL REFERENCES designs(id),
  status          text NOT NULL DEFAULT 'NEW',
  customer_name   text NOT NULL,
  phone           text NOT NULL,
  email           text,
  address1        text NOT NULL,
  address2        text,
  city            text NOT NULL,
  state           text NOT NULL,
  pincode         text NOT NULL,
  customer_notes  text,
  price_breakdown jsonb,
  total           integer,
  advance_percent integer NOT NULL DEFAULT 50,
  valid_until     timestamptz,
  approval_note   text,
  decline_reason  text,
  staff_notes     jsonb NOT NULL DEFAULT '[]',
  timeline        jsonb NOT NULL DEFAULT '[]',
  assigned_to_id  text REFERENCES users(id),
  prepared_by_id  text REFERENCES users(id),
  approved_by_id  text REFERENCES users(id),
  quoted_at       timestamptz,
  accepted_at     timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quotes_status_idx ON quotes(status);
CREATE INDEX quotes_created_idx ON quotes(created_at DESC);
CREATE INDEX quotes_phone_idx ON quotes(phone);

CREATE TABLE payments (
  id                  text PRIMARY KEY DEFAULT ('p_' || encode(gen_random_bytes(10), 'hex')),
  quote_id            text NOT NULL REFERENCES quotes(id),
  kind                text NOT NULL CHECK (kind IN ('ADVANCE','BALANCE','FULL')),
  amount              integer NOT NULL,
  currency            text NOT NULL DEFAULT 'INR',
  status              text NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','PAID','FAILED','REFUNDED')),
  razorpay_order_id   text UNIQUE NOT NULL,
  razorpay_payment_id text UNIQUE,
  method              text,
  raw                 jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz
);
CREATE INDEX payments_quote_idx ON payments(quote_id);

CREATE TABLE webhook_events (
  id           text PRIMARY KEY,
  event        text NOT NULL,
  payload      jsonb NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_providers (
  id                 text PRIMARY KEY DEFAULT ('ai_' || encode(gen_random_bytes(8), 'hex')),
  provider           text UNIQUE NOT NULL,
  key_ciphertext     text NOT NULL,
  key_last4          text NOT NULL,
  model              text NOT NULL,
  enabled            boolean NOT NULL DEFAULT true,
  is_default         boolean NOT NULL DEFAULT false,
  monthly_budget_usd double precision,
  last_test_at       timestamptz,
  last_test_ok       boolean,
  last_test_error    text,
  updated_by_id      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_usage (
  id         text PRIMARY KEY DEFAULT ('au_' || encode(gen_random_bytes(10), 'hex')),
  provider   text NOT NULL,
  model      text NOT NULL,
  design_id  text,
  images     integer NOT NULL DEFAULT 0,
  cost_usd   double precision NOT NULL DEFAULT 0,
  ms         integer NOT NULL DEFAULT 0,
  ok         boolean NOT NULL DEFAULT true,
  error      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_created_idx ON ai_usage(created_at DESC);

CREATE TABLE audit_logs (
  id         bigserial PRIMARY KEY,
  user_id    text REFERENCES users(id),
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx ON audit_logs(entity, entity_id);

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;
CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER designs_touch BEFORE UPDATE ON designs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER quotes_touch BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER settings_touch BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER ai_providers_touch BEFORE UPDATE ON ai_providers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
