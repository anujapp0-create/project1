-- Run this once in Supabase -> SQL Editor -> New query -> Run.

-- 1) Tables
create table if not exists credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0
);

create table if not exists payments (
  payment_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- 2) Lock the tables: only the server (service role) can touch them.
alter table credits enable row level security;
alter table payments enable row level security;
-- (No policies added on purpose -> the public/anon key cannot read or write these.)

-- 3) Atomic credit functions
create or replace function grant_demo(uid uuid)
returns int language plpgsql security definer as $$
declare newbal int;
begin
  insert into credits(user_id, balance) values (uid, 10)
  on conflict (user_id) do nothing;
  select balance into newbal from credits where user_id = uid;
  return newbal;
end; $$;

create or replace function spend_pages(uid uuid, n int)
returns int language plpgsql security definer as $$
declare newbal int;
begin
  update credits set balance = balance - n
  where user_id = uid and balance >= n
  returning balance into newbal;
  if newbal is null then return -1; end if;  -- not enough credits
  return newbal;
end; $$;

create or replace function add_pages(uid uuid, n int)
returns int language plpgsql security definer as $$
declare newbal int;
begin
  insert into credits(user_id, balance) values (uid, n)
  on conflict (user_id) do update set balance = credits.balance + n
  returning balance into newbal;
  return newbal;
end; $$;

-- 4) IMPORTANT security step: stop visitors from calling these functions directly.
revoke all on function grant_demo(uuid)      from public, anon, authenticated;
revoke all on function spend_pages(uuid,int) from public, anon, authenticated;
revoke all on function add_pages(uuid,int)   from public, anon, authenticated;
grant execute on function grant_demo(uuid)      to service_role;
grant execute on function spend_pages(uuid,int) to service_role;
grant execute on function add_pages(uuid,int)   to service_role;
