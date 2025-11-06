-- Initial database schema for Promissio Rights and Royalties Management
-- Created: 2025-01-05

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sessions table (for express-session with connect-pg-simple)
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions(expire);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  role VARCHAR NOT NULL DEFAULT 'Sales' CHECK (role IN ('Admin', 'Legal', 'Finance', 'Sales')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  invite_token VARCHAR,
  invite_token_expiry TIMESTAMP,
  invite_status VARCHAR CHECK (invite_status IN ('pending', 'accepted')),
  reset_token VARCHAR,
  reset_token_expiry TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  partner VARCHAR NOT NULL,
  licensor VARCHAR NOT NULL,
  licensee VARCHAR NOT NULL,
  territory VARCHAR NOT NULL,
  platform VARCHAR,
  content VARCHAR,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  royalty_rate DECIMAL(5,2),
  exclusivity VARCHAR DEFAULT 'Non-Exclusive' CHECK (exclusivity IN ('Exclusive', 'Non-Exclusive', 'Limited Exclusive')),
  status VARCHAR DEFAULT 'Pending' CHECK (status IN ('Active', 'Expired', 'Pending', 'Terminated')),
  contract_document_url VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR REFERENCES users(id)
);

-- Royalties table
CREATE TABLE IF NOT EXISTS royalties (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id VARCHAR NOT NULL REFERENCES contracts(id),
  reporting_period VARCHAR NOT NULL,
  revenue DECIMAL(15,2) NOT NULL,
  royalty_amount DECIMAL(15,2) NOT NULL,
  status VARCHAR DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Paid')),
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  calculated_by VARCHAR REFERENCES users(id)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR NOT NULL,
  entity_type VARCHAR NOT NULL,
  entity_id VARCHAR,
  old_values JSONB,
  new_values JSONB,
  user_id VARCHAR REFERENCES users(id),
  ip_address VARCHAR,
  user_agent VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
