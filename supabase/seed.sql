-- seed.sql for OMGEXP Cargo Portal
-- This file will be loaded automatically when you run supabase start or supabase db reset

-- Add initial mock user if needed or depend on local auth ui
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@omgexp.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Destinations sample data
INSERT INTO destinations (country, port, shipping_time, notes, user_id)
VALUES 
  ('Japan', 'Tokyo', 7, 'Regular shipping routes available', '00000000-0000-0000-0000-000000000000'),
  ('China', 'Shanghai', 5, 'High volume destination', '00000000-0000-0000-0000-000000000000'),
  ('South Korea', 'Busan', 6, 'Efficient customs processing', '00000000-0000-0000-0000-000000000000'),
  ('Switzerland', 'Zurich', 25, 'High Value / Pharmaceuticals', '00000000-0000-0000-0000-000000000000')
ON CONFLICT DO NOTHING;

-- Delivery Companies sample data
INSERT INTO delivery_services (name, service_type, contact_info, address, email, phone, user_id)
VALUES 
  ('Ocean Express', 'sea', 'John Doe', '123 Harbor St, Bangkok', 'contact@oceanexpress.com', '02-123-4567', '00000000-0000-0000-0000-000000000000'),
  ('Air Cargo Solutions', 'air', 'Jane Smith', '456 Airport Blvd, Bangkok', 'info@aircargo.com', '02-987-6543', '00000000-0000-0000-0000-000000000000')
ON CONFLICT DO NOTHING;
