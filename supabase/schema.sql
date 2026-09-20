-- WhiteSpace 0.4
create extension if not exists pgcrypto;
alter table public.profiles add column if not exists profile_color text default '#08263b';
alter table public.profiles add column if not exists accent_color text default '#74f7ff';
