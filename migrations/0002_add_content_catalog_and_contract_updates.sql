-- Migration: Add content catalog and update contracts table
-- Created: 2026-01-27
-- This migration adds missing columns and new tables to match the current schema

-- ============================================
-- Update contracts table with missing columns
-- ============================================

-- Add auto_renew column
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;

-- Add royalty_type column
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS royalty_type VARCHAR DEFAULT 'Revenue Share';

-- Add flat_fee_amount column
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS flat_fee_amount DECIMAL(15,2);

-- Add reporting_frequency column
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS reporting_frequency VARCHAR DEFAULT 'None';

-- Add payment_terms column
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_terms VARCHAR DEFAULT 'Net 30';

-- Add minimum_payment column
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS minimum_payment DECIMAL(15,2);

-- Add parent_contract_id for amendments
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS parent_contract_id VARCHAR;

-- Make end_date nullable (for auto-renew contracts)
ALTER TABLE contracts ALTER COLUMN end_date DROP NOT NULL;

-- Update status check constraint to include 'In Perpetuity' and remove 'Pending'
-- First drop the existing constraint if it exists, then add the new one
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contracts_status_check' 
    AND conrelid = 'contracts'::regclass
  ) THEN
    ALTER TABLE contracts DROP CONSTRAINT contracts_status_check;
  END IF;
  
  -- Add new constraint with updated values
  ALTER TABLE contracts ADD CONSTRAINT contracts_status_check 
    CHECK (status IN ('Active', 'Expired', 'In Perpetuity', 'Terminated'));
EXCEPTION
  WHEN others THEN
    -- Constraint might not exist or have different name, ignore error
    NULL;
END $$;

-- ============================================
-- Create content_items table
-- ============================================

CREATE TABLE IF NOT EXISTS content_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  type VARCHAR NOT NULL CHECK (type IN ('Film', 'TV Series', 'TBN FAST', 'TBN Linear', 'WoF FAST')),
  description TEXT,
  season INTEGER,
  episode_count INTEGER,
  release_year INTEGER,
  genre VARCHAR,
  duration INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR REFERENCES users(id)
);

-- Create index on content_items type for filtering
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(type);

-- Create index on content_items title for searching
CREATE INDEX IF NOT EXISTS idx_content_items_title ON content_items(title);

-- ============================================
-- Create contract_content junction table
-- ============================================

CREATE TABLE IF NOT EXISTS contract_content (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id VARCHAR NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  content_id VARCHAR NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_contract_content_contract_id ON contract_content(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_content_content_id ON contract_content(content_id);

-- Create unique constraint to prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_content_unique 
  ON contract_content(contract_id, content_id);

-- ============================================
-- Add any missing indexes
-- ============================================

-- Index on contracts for common queries
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_partner ON contracts(partner);
CREATE INDEX IF NOT EXISTS idx_contracts_start_date ON contracts(start_date);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);

-- Index on royalties
CREATE INDEX IF NOT EXISTS idx_royalties_contract_id ON royalties(contract_id);
CREATE INDEX IF NOT EXISTS idx_royalties_status ON royalties(status);

-- Index on audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
