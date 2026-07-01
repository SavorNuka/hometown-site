-- Add assigned_to column to packing_items so person assignments survive sync.
ALTER TABLE packing_items ADD COLUMN IF NOT EXISTS assigned_to TEXT[] NULL;
