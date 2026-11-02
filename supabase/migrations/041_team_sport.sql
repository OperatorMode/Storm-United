-- The team's sport (soccer, basketball, afl, hockey, ice-hockey, netball): the
-- field My Game draws and how scoring works. Empty means soccer, as before.
alter table teams add column if not exists sport text;
