-- Run this once in Supabase SQL Editor if the deployed app still reports:
-- function digest(text, unknown) does not exist

create extension if not exists pgcrypto;

create or replace function public.digest(value text, algorithm text)
returns bytea
language sql
immutable
security definer
set search_path = extensions
as $$ select extensions.digest(value, algorithm); $$;

notify pgrst, 'reload schema';
