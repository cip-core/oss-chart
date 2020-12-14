DROP TABLE IF EXISTS components_cache;

CREATE TABLE IF NOT EXISTS components_cache (
   component varchar,
   metrics varchar,
   company varchar,
   period varchar,
   value integer
);