-- Migration: Add series_name and series_sequence columns to metadata tables
-- This replaces the series_info JSON field with proper first-class columns

-- Add series columns to agent metadata
ALTER TABLE audiobook_metadata_agent ADD COLUMN series_name TEXT NULL;
ALTER TABLE audiobook_metadata_agent ADD COLUMN series_sequence TEXT NULL;

-- Add series columns to embedded metadata
ALTER TABLE audiobook_metadata_embedded ADD COLUMN series_name TEXT NULL;
ALTER TABLE audiobook_metadata_embedded ADD COLUMN series_sequence TEXT NULL;

-- Migrate existing series_info JSON data to new columns (if any exists)
-- This will extract {"name": "X", "sequence": "Y"} from series_info
UPDATE audiobook_metadata_agent
SET
    series_name = json_extract(series_info, '$.name'),
    series_sequence = json_extract(series_info, '$.sequence')
WHERE series_info IS NOT NULL AND series_info != '';

-- Note: series_info column is kept for backward compatibility but deprecated
-- It will be removed in a future migration once all code is updated
