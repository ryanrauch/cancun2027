create table if not exists signups (
  id         bigserial primary key,
  type       text not null,             -- 'application' | 'subscribe'
  email      text not null,
  name       text default '',
  phone      text default '',
  room       text default '',
  division   text default '',
  referral   text default '',
  notes      text default '',
  created_at timestamptz not null default now(),
  unique (type, email)
);
