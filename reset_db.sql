-- ============================================
-- SCRIPT DE NETTOYAGE COMPLET (RESET)
-- EXÉCUTER DANS SUPABASE SQL EDITOR
-- ============================================

-- Désactiver RLS temporairement pour éviter les blocages lors des DROP
-- (Pas strictement nécessaire si on drop en cascade, mais plus propre)

-- 1. DROP TABLES (dans l'ordre inverse des dépendances)
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS cash_transactions CASCADE;
DROP TABLE IF EXISTS personnel CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS return_items CASCADE;
DROP TABLE IF EXISTS returns CASCADE;
DROP TABLE IF EXISTS invoice_payments CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS stock_entries CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. DROP SEQUENCES
DROP SEQUENCE IF EXISTS invoice_seq CASCADE;
DROP SEQUENCE IF EXISTS employee_seq CASCADE;
DROP SEQUENCE IF EXISTS order_seq CASCADE;
DROP SEQUENCE IF EXISTS return_seq CASCADE;

-- 3. DROP FUNCTIONS
DROP FUNCTION IF EXISTS next_invoice_number() CASCADE;
DROP FUNCTION IF EXISTS next_employee_matricule() CASCADE;
DROP FUNCTION IF EXISTS next_order_number() CASCADE;
DROP FUNCTION IF EXISTS next_return_number() CASCADE;

-- 4. CLEANUP EXTENSIONS (Optionnel, uuid-ossp est utile de garder)
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- FIN DU NETTOYAGE
-- Vous pouvez maintenant ré-exécuter le fichier supabase-schema.sql
