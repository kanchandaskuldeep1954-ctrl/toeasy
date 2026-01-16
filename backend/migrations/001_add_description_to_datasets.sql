-- Migration: Add description column to datasets table
-- This file should be executed on the production database to add the missing column

-- Check if the description column already exists, if not, add it
ALTER TABLE IF EXISTS datasets 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add an index on the new column for better query performance
CREATE INDEX IF NOT EXISTS idx_datasets_description ON datasets(description);

-- This migration is safe to run multiple times due to IF NOT EXISTS and IF EXISTS clauses
