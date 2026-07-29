-- Enable pg_trgm for fuzzy search (optional enhancement)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_reference_trgm_idx ON products USING gin (reference gin_trgm_ops);
