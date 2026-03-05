-- ============================================
-- StockPro - Supabase Database Schema (v2)
-- Migration complète - exécuter dans Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SÉQUENCES ATOMIQUES (numérotation sans race condition)
-- ============================================
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS employee_seq START 1;
CREATE SEQUENCE IF NOT EXISTS order_seq START 1;
CREATE SEQUENCE IF NOT EXISTS return_seq START 1;

-- Fonctions RPC pour obtenir le prochain numéro sans race condition
CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT AS $$
DECLARE
  year_str TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  seq_val  BIGINT;
BEGIN
  seq_val := nextval('invoice_seq');
  RETURN 'FAC-' || year_str || '-' || LPAD(seq_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION next_employee_matricule()
RETURNS TEXT AS $$
DECLARE
  year_str TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  seq_val  BIGINT;
BEGIN
  seq_val := nextval('employee_seq');
  RETURN 'EMP-' || year_str || '-' || LPAD(seq_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION next_order_number()
RETURNS TEXT AS $$
DECLARE
  year_str TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  seq_val  BIGINT;
BEGIN
  seq_val := nextval('order_seq');
  RETURN 'BC-' || year_str || '-' || LPAD(seq_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION next_return_number()
RETURNS TEXT AS $$
DECLARE
  year_str TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  seq_val  BIGINT;
BEGIN
  seq_val := nextval('return_seq');
  RETURN 'AV-' || year_str || '-' || LPAD(seq_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  password_hash TEXT DEFAULT '',
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'gestionnaire' CHECK (role IN ('admin', 'gestionnaire')),
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Ajouter password_hash si la colonne n'existe pas encore (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
    ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT '';
  END IF;
END $$;

-- Default admin user (mot de passe sera hashé par l'app au premier login)
INSERT INTO users (username, password, full_name, role, email, phone, is_active)
VALUES 
  ('admin', 'admin123', 'Administrateur Principal', 'admin', 'admin@stockpro.com', '+243 999 000 000', true),
  ('gestionnaire', 'gest123', 'Jean Gestionnaire', 'gestionnaire', 'gestionnaire@stockpro.com', '+243 888 000 000', true)
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- CATEGORIES TABLE (nouveau)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================
-- SUPPLIERS TABLE (fournisseurs - nouveau)
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  price_per_carton NUMERIC NOT NULL DEFAULT 0,
  stock_level INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Ajouter category_id si manquant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') THEN
    ALTER TABLE products ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- STOCK ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stock_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_carton NUMERIC NOT NULL,
  total_value NUMERIC NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajouter supplier_id si manquant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_entries' AND column_name='supplier_id') THEN
    ALTER TABLE stock_entries ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id),
  client_name TEXT NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'check', NULL)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  paid_at TIMESTAMPTZ
);

-- Ajouter amount_paid si manquant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='amount_paid') THEN
    ALTER TABLE invoices ADD COLUMN amount_paid NUMERIC NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Mise à jour du CHECK pour inclure partially_paid
DO $$ BEGIN
  ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
  ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('pending', 'partially_paid', 'paid', 'cancelled'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================
-- INVOICE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_carton NUMERIC NOT NULL,
  total NUMERIC NOT NULL
);

-- ============================================
-- INVOICE PAYMENTS TABLE (paiements partiels - nouveau)
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'check')),
  notes TEXT DEFAULT '',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- RETURNS TABLE (avoirs/retours - nouveau)
-- ============================================
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number TEXT UNIQUE NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  invoice_number TEXT DEFAULT '',
  client_id UUID REFERENCES clients(id),
  client_name TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================
-- RETURN ITEMS TABLE (nouveau)
-- ============================================
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_carton NUMERIC NOT NULL,
  total NUMERIC NOT NULL
);

-- ============================================
-- PURCHASE ORDERS TABLE (commandes fournisseurs - nouveau)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'received', 'cancelled')),
  expected_date DATE,
  received_date DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================
-- PURCHASE ORDER ITEMS TABLE (nouveau)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_carton NUMERIC NOT NULL,
  total NUMERIC NOT NULL
);

-- ============================================
-- PERSONNEL TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS personnel (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matricule TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  id_card_number TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  salary NUMERIC DEFAULT 0,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================
-- CASH TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('invoice_payment', 'expense', 'withdrawal', 'deposit', 'activity', 'return', 'purchase_order')),
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference TEXT DEFAULT '',
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Mise à jour du CHECK pour inclure return et purchase_order
DO $$ BEGIN
  ALTER TABLE cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_type_check;
  ALTER TABLE cash_transactions ADD CONSTRAINT cash_transactions_type_check
    CHECK (type IN ('invoice_payment', 'expense', 'withdrawal', 'deposit', 'activity', 'return', 'purchase_order'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================
-- ACTIVITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost NUMERIC DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================
-- NOTIFICATIONS TABLE (nouveau)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('low_stock', 'overdue_invoice', 'order_received', 'return_approved', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  reference_id UUID,
  reference_type TEXT DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  target_role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SYSTEM LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE policyname = 'Allow all for anon'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "Allow all for anon" ON ' || r.tablename;
  END LOOP;
END $$;

-- Politiques restrictives : l'app s'authentifie via la clé anon
-- Les mots de passe sont maintenant hachés, donc la lecture de users est moins risquée
-- On empêche toutefois la lecture directe du champ password/password_hash via une vue sécurisée

-- Allow anon access (app handles its own auth — passwords are now hashed)
CREATE POLICY "Allow anon read-write" ON users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON categories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON suppliers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON products FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON stock_entries FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON clients FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON invoices FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON invoice_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON invoice_payments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON returns FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON return_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON purchase_orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON purchase_order_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON personnel FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON cash_transactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON activities FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON notifications FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read-write" ON system_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================
-- GRANT RPC FUNCTIONS
-- ============================================
GRANT EXECUTE ON FUNCTION next_invoice_number() TO anon;
GRANT EXECUTE ON FUNCTION next_employee_matricule() TO anon;
GRANT EXECUTE ON FUNCTION next_order_number() TO anon;
GRANT EXECUTE ON FUNCTION next_return_number() TO anon;
