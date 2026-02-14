-- Migration: 20260117_update_reparations_add_finance_fields.sql
BEGIN TRANSACTION;

ALTER TABLE reparations ADD COLUMN price REAL DEFAULT 0;
ALTER TABLE reparations ADD COLUMN paid_amount REAL DEFAULT 0;
ALTER TABLE reparations ADD COLUMN payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE reparations ADD COLUMN closed_at INTEGER;

COMMIT;
