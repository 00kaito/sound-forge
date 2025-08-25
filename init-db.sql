-- AudioForge Database Initialization Script
-- This script will run when the PostgreSQL container starts for the first time

-- Ensure the database exists (already created by POSTGRES_DB env var)
-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'UTC';

-- Create indexes for better performance (Drizzle will create tables)
-- Note: Actual table creation is handled by Drizzle migrations
-- This script is for any additional setup needed

-- Example: Create a function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'AudioForge database initialized successfully';
END $$;