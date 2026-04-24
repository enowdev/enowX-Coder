-- Add is_enabled flag to providers (default true)
ALTER TABLE providers ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1;
