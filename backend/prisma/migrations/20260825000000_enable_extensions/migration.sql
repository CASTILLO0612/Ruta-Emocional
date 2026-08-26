-- Required by geography(Point, 4326) columns and GiST spatial indexes.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Required by exclusion constraints that combine UUID equality with time ranges.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Kept explicit so gen_random_uuid() is available on supported PostgreSQL setups.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
