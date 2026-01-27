-- Migration: Add content catalog and update contracts table
-- Created: 2026-01-27
-- This migration adds missing columns and new tables to match the current schema

-- ============================================
-- Ensure all core contracts columns exist
-- (These may be missing if table was created by drizzle-kit before schema was complete)
-- ============================================

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS partner VARCHAR;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS licensor VARCHAR;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS licensee VARCHAR;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS territory VARCHAR;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS platform VARCHAR;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS content VARCHAR;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS royalty_rate DECIMAL(5,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS exclusivity VARCHAR DEFAULT 'Non-Exclusive';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'Active';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_document_url VARCHAR;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS created_by VARCHAR;

-- ============================================
-- Add new contracts columns (from enhanced schema)
-- ============================================

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS royalty_type VARCHAR DEFAULT 'Revenue Share';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS flat_fee_amount DECIMAL(15,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS reporting_frequency VARCHAR DEFAULT 'None';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_terms VARCHAR DEFAULT 'Net 30';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS minimum_payment DECIMAL(15,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS parent_contract_id VARCHAR;

-- Make end_date nullable (for auto-renew contracts) - safe to run even if already nullable
DO $$
BEGIN
  ALTER TABLE contracts ALTER COLUMN end_date DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Update status check constraint to include 'In Perpetuity'
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
  WHEN others THEN NULL;
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

CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(type);
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

CREATE INDEX IF NOT EXISTS idx_contract_content_contract_id ON contract_content(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_content_content_id ON contract_content(content_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_content_unique ON contract_content(contract_id, content_id);

-- ============================================
-- Add indexes (only if columns exist)
-- ============================================

DO $$
BEGIN
  -- Contracts indexes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'partner') THEN
    CREATE INDEX IF NOT EXISTS idx_contracts_partner ON contracts(partner);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'start_date') THEN
    CREATE INDEX IF NOT EXISTS idx_contracts_start_date ON contracts(start_date);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'end_date') THEN
    CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
  END IF;
  
  -- Royalties indexes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'royalties' AND column_name = 'contract_id') THEN
    CREATE INDEX IF NOT EXISTS idx_royalties_contract_id ON royalties(contract_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'royalties' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_royalties_status ON royalties(status);
  END IF;
  
  -- Audit logs indexes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entity_type') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
  END IF;
END $$;
