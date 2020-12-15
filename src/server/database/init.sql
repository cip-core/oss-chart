DROP TABLE IF EXISTS components_cache;
DROP TABLE IF EXISTS components;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS component_stacks;
DROP TABLE IF EXISTS company_stacks;

CREATE TABLE IF NOT EXISTS components_cache (
   id varchar unique,
   component varchar,
   metrics varchar,
   company varchar,
   period varchar,
   value integer
);

CREATE TABLE IF NOT EXISTS components (
   short varchar unique,
   name varchar,
   href varchar,
   svg varchar
);

CREATE TABLE IF NOT EXISTS companies (
   name varchar unique
);

CREATE TABLE IF NOT EXISTS component_stacks (
   parent varchar,
   child varchar
);

CREATE TABLE IF NOT EXISTS company_stacks (
   parent varchar,
   child varchar
);