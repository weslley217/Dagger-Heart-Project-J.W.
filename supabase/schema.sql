create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null check (role in ('PLAYER', 'MASTER')),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.app_users(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'open', 'active', 'archived')),
  is_open boolean not null default false,
  start_level integer not null default 1 check (start_level >= 1),
  restrictions jsonb not null default '{}'::jsonb,
  special_rules text,
  bonus_card_ids text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null default 'PLAYER' check (role in ('PLAYER', 'MASTER')),
  can_manage boolean not null default false,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (campaign_id, user_id)
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_users(id) on delete cascade,
  name text not null,
  level integer not null default 1 check (level >= 1),
  short_description text not null default '',
  class_key text not null,
  subclass_key text not null,
  ancestry_key text not null,
  community_key text not null,
  domains jsonb not null default '[]'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  proficiencies jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  resources jsonb not null default '{}'::jsonb,
  equipment jsonb not null default '{}'::jsonb,
  druid_forms jsonb not null default '[]'::jsonb,
  total_hp integer not null default 1,
  current_hp integer not null default 0,
  armor_max integer not null default 0,
  armor_current integer not null default 0,
  threshold1 integer not null default 1,
  threshold2 integer not null default 2,
  evasion integer not null default 10,
  notes text,
  is_downed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.campaign_characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  base_character_id uuid references public.characters(id) on delete set null,
  player_id uuid not null references public.app_users(id) on delete cascade,
  name text not null,
  level integer not null default 1 check (level >= 1),
  short_description text not null default '',
  class_key text not null,
  subclass_key text not null,
  ancestry_key text not null,
  community_key text not null,
  domains jsonb not null default '[]'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  proficiencies jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  resources jsonb not null default '{}'::jsonb,
  equipment jsonb not null default '{}'::jsonb,
  druid_forms jsonb not null default '[]'::jsonb,
  total_hp integer not null default 1,
  current_hp integer not null default 0,
  armor_max integer not null default 0,
  armor_current integer not null default 0,
  threshold1 integer not null default 1,
  threshold2 integer not null default 2,
  evasion integer not null default 10,
  notes text,
  is_downed boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'finished')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (campaign_id, base_character_id)
);

create table if not exists public.cards (
  id text primary key,
  name text not null,
  category text not null,
  type text,
  class_key text,
  subclass_key text,
  domain_key text,
  tier text,
  text text not null,
  keywords jsonb not null default '[]'::jsonb,
  image_url text,
  source_pdf_key text,
  source_page integer,
  effects jsonb not null default '[]'::jsonb,
  custom_handler text,
  tag_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.character_cards (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  card_id text not null references public.cards(id) on delete cascade,
  status text not null default 'passiva',
  uses_max integer,
  uses_current integer,
  cooldown text,
  notes text,
  assigned_at timestamptz not null default timezone('utc', now()),
  unique (character_id, card_id)
);

create table if not exists public.campaign_character_cards (
  id uuid primary key default gen_random_uuid(),
  campaign_character_id uuid not null references public.campaign_characters(id) on delete cascade,
  card_id text not null references public.cards(id) on delete cascade,
  status text not null default 'passiva',
  uses_max integer,
  uses_current integer,
  cooldown text,
  notes text,
  assigned_at timestamptz not null default timezone('utc', now()),
  unique (campaign_character_id, card_id)
);

create table if not exists public.damage_logs (
  id uuid primary key default gen_random_uuid(),
  character_id uuid references public.characters(id) on delete cascade,
  campaign_character_id uuid references public.campaign_characters(id) on delete cascade,
  damage_raw integer not null,
  damage_points integer not null,
  armor_used boolean not null default false,
  armor_before integer not null,
  armor_after integer not null,
  hp_before integer not null,
  hp_after integer not null,
  downed boolean not null default false,
  undone_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    ((character_id is not null)::int + (campaign_character_id is not null)::int) = 1
  )
);

create table if not exists public.effect_logs (
  id uuid primary key default gen_random_uuid(),
  character_id uuid references public.characters(id) on delete cascade,
  campaign_character_id uuid references public.campaign_characters(id) on delete cascade,
  card_id text references public.cards(id) on delete set null,
  action text not null,
  summary text not null,
  details jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    ((character_id is not null)::int + (campaign_character_id is not null)::int) <= 1
  )
);

do $$
begin
  alter table public.characters add column if not exists equipment jsonb not null default '{}'::jsonb;
  alter table public.campaign_characters add column if not exists equipment jsonb not null default '{}'::jsonb;
  alter table public.cards add column if not exists tag_key text;
exception when undefined_table then
  null;
end $$;

create index if not exists idx_app_users_role on public.app_users(role);
create index if not exists idx_campaigns_status on public.campaigns(status, is_open);
create index if not exists idx_campaigns_created_by on public.campaigns(created_by);
create index if not exists idx_campaign_members_user on public.campaign_members(user_id);
create index if not exists idx_characters_owner on public.characters(owner_id, updated_at desc);
create index if not exists idx_campaign_characters_campaign on public.campaign_characters(campaign_id, updated_at desc);
create index if not exists idx_campaign_characters_player on public.campaign_characters(player_id, updated_at desc);
create index if not exists idx_cards_category on public.cards(category);
create index if not exists idx_cards_class_key on public.cards(class_key);
create index if not exists idx_cards_subclass_key on public.cards(subclass_key);
create index if not exists idx_cards_domain_key on public.cards(domain_key);
create index if not exists idx_cards_tag_key on public.cards(tag_key);
create index if not exists idx_character_cards_character on public.character_cards(character_id);
create index if not exists idx_campaign_character_cards_character on public.campaign_character_cards(campaign_character_id);
create index if not exists idx_damage_logs_character on public.damage_logs(character_id, created_at desc);
create index if not exists idx_damage_logs_campaign_character on public.damage_logs(campaign_character_id, created_at desc);
create index if not exists idx_effect_logs_character on public.effect_logs(character_id, created_at desc);
create index if not exists idx_effect_logs_campaign_character on public.effect_logs(campaign_character_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_app_users_updated_at'
  ) then
    create trigger trg_app_users_updated_at
      before update on public.app_users
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_campaigns_updated_at'
  ) then
    create trigger trg_campaigns_updated_at
      before update on public.campaigns
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_characters_updated_at'
  ) then
    create trigger trg_characters_updated_at
      before update on public.characters
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_campaign_characters_updated_at'
  ) then
    create trigger trg_campaign_characters_updated_at
      before update on public.campaign_characters
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_cards_updated_at'
  ) then
    create trigger trg_cards_updated_at
      before update on public.cards
      for each row execute function public.set_updated_at();
  end if;
end $$;

insert into public.app_users (username, display_name, password_hash, role)
values ('mestre', 'Mestre', '30aa76b11cac529b727b2a8dcad9b2d4188132596b62aa454cfe301d2b949c71', 'MASTER')
on conflict (username) do update
set display_name = excluded.display_name,
    password_hash = excluded.password_hash,
    role = excluded.role,
    active = true;

insert into public.app_users (username, display_name, password_hash, role)
values ('joao', 'João', 'b9217017457386940845ca3c86a246791c5c8dafe015ab825343f94432bbb1da', 'PLAYER')
on conflict (username) do update
set display_name = excluded.display_name,
    password_hash = excluded.password_hash,
    role = excluded.role,
    active = true;

do $$
declare
  master_id uuid;
  local_campaign_id uuid;
begin
  select id into master_id from public.app_users where username = 'mestre' limit 1;

  if master_id is null then
    raise exception 'Usuário mestre não encontrado.';
  end if;

  insert into public.campaigns (
    name,
    description,
    created_by,
    status,
    is_open,
    start_level,
    restrictions,
    special_rules
  )
  values (
    'Sala Local',
    'Campanha padrão para testes locais.',
    master_id,
    'open',
    true,
    1,
    jsonb_build_object(
      'startingLevel', 1,
      'bonusCards', jsonb_build_array(),
      'specialAbilities', jsonb_build_array(),
      'customRules', ''
    ),
    ''
  )
  on conflict do nothing;

  select id into local_campaign_id
  from public.campaigns
  where name = 'Sala Local'
  order by created_at asc
  limit 1;

  if local_campaign_id is not null then
    insert into public.campaign_members (campaign_id, user_id, role, can_manage)
    values (local_campaign_id, master_id, 'MASTER', true)
    on conflict (campaign_id, user_id) do update
    set role = excluded.role,
        can_manage = excluded.can_manage;
  end if;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.campaigns;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.campaign_members;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.characters;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.campaign_characters;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.damage_logs;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.effect_logs;
  exception when duplicate_object then
    null;
  end;
end $$;

-- ── Migração: NPCs de campanha, ordem de turnos e estado de sessão ──────────

alter table public.campaigns
  add column if not exists map_tokens jsonb not null default '[]'::jsonb,
  add column if not exists session_active boolean not null default false;

alter table public.damage_logs
  add column if not exists campaign_npc_id uuid;

create table if not exists public.campaign_npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  npc_type text not null default 'monster' check (npc_type in ('monster','npc','boss')),
  level integer not null default 1,
  description text,
  total_hp integer not null default 10,
  current_hp integer not null default 10,
  armor_max integer not null default 0,
  armor_current integer not null default 0,
  threshold1 integer not null default 5,
  threshold2 integer not null default 10,
  evasion integer not null default 10,
  damage_dice text,
  attack_bonus integer not null default 0,
  conditions jsonb not null default '[]'::jsonb,
  health_indicator text not null default 'unknown'
    check (health_indicator in ('plena_forma','ferido','gravemente_ferido','critico','desacordado','unknown')),
  visible_to_players boolean not null default false,
  token_x float,
  token_y float,
  token_color text not null default '#ef4444',
  token_icon text not null default 'monster',
  is_downed boolean not null default false,
  traits jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now())
);

create table if not exists public.campaign_turns (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  entity_type text not null check (entity_type in ('player','npc')),
  entity_id uuid not null,
  entity_name text not null,
  initiative integer not null default 0,
  position integer not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc',now())
);

do $$
begin
  begin alter publication supabase_realtime add table public.campaign_npcs;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.campaign_turns;
  exception when duplicate_object then null; end;
end $$;
