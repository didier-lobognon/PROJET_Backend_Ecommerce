-- Sync product status with stock for existing rows
UPDATE "products"
SET "status" = 'UNAVAILABLE'
WHERE "stock" = 0 AND "status" = 'AVAILABLE';

UPDATE "products"
SET "status" = 'AVAILABLE'
WHERE "stock" > 0 AND "status" = 'UNAVAILABLE';
