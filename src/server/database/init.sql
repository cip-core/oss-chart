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
   id varchar unique,
   parent varchar,
   child varchar
);

CREATE TABLE IF NOT EXISTS company_stacks (
   id varchar unique,
   parent varchar,
   child varchar
);