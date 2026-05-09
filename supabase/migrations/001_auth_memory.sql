create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_language text not null default 'zh-Hant',
  care_preference text check (care_preference in ('public', 'private', 'either')),
  location_area text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  preference_key text not null,
  preference_value jsonb not null,
  source text check (source in ('explicit_user_choice', 'inferred_with_confirmation')) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, preference_key)
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nickname text not null,
  relationship text,
  age_range text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  mode text check (mode in ('symptom', 'department', 'insurance', 'general')) not null,
  title text,
  language text not null default 'zh-Hant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.conversation_sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  safety_level text check (safety_level in ('normal', 'caution', 'emergency')) default 'normal',
  created_at timestamptz not null default now()
);

create table if not exists public.saved_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  session_id uuid references public.conversation_sessions(id) on delete set null,
  recommendation_type text check (recommendation_type in ('department', 'insurance', 'emergency', 'followup')) not null,
  summary_zh text not null,
  summary_en text,
  urgency text,
  department text,
  insurance_categories text[],
  requires_human_review boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  consent_type text check (consent_type in ('save_memory', 'health_data', 'marketing', 'adviser_handoff')) not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists user_preferences_user_id_idx on public.user_preferences(user_id);
create index if not exists household_members_user_id_idx on public.household_members(user_id);
create index if not exists conversation_sessions_user_id_idx on public.conversation_sessions(user_id);
create index if not exists conversation_messages_user_id_idx on public.conversation_messages(user_id);
create index if not exists conversation_messages_session_id_idx on public.conversation_messages(session_id);
create index if not exists saved_recommendations_user_id_idx on public.saved_recommendations(user_id);
create index if not exists saved_recommendations_session_id_idx on public.saved_recommendations(session_id);
create index if not exists consent_events_user_id_idx on public.consent_events(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

drop trigger if exists household_members_set_updated_at on public.household_members;
create trigger household_members_set_updated_at
  before update on public.household_members
  for each row execute function public.set_updated_at();

drop trigger if exists conversation_sessions_set_updated_at on public.conversation_sessions;
create trigger conversation_sessions_set_updated_at
  before update on public.conversation_sessions
  for each row execute function public.set_updated_at();

create or replace function public.current_user_is_anonymous()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean, false);
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider text := new.raw_app_meta_data->>'provider';
  metadata_is_anonymous text := new.raw_app_meta_data->>'is_anonymous';
begin
  insert into public.profiles (
    id,
    display_name,
    preferred_language,
    is_anonymous
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'preferred_language', 'zh-Hant'),
    case
      when metadata_is_anonymous in ('true', 'false') then metadata_is_anonymous::boolean
      else provider = 'anonymous'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.household_members enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.saved_recommendations enable row level security;
alter table public.consent_events enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.conversation_sessions to authenticated;
grant select, insert, update, delete on public.conversation_messages to authenticated;
grant select, insert, update, delete on public.saved_recommendations to authenticated;
grant select, insert, update, delete on public.consent_events to authenticated;

create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy profiles_delete_own
on public.profiles for delete
to authenticated
using (id = (select auth.uid()));

create policy user_preferences_select_own
on public.user_preferences for select
to authenticated
using (user_id = (select auth.uid()));

create policy user_preferences_insert_own
on public.user_preferences for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy user_preferences_update_own
on public.user_preferences for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy user_preferences_delete_own
on public.user_preferences for delete
to authenticated
using (user_id = (select auth.uid()));

create policy household_members_select_own
on public.household_members for select
to authenticated
using (user_id = (select auth.uid()));

create policy household_members_insert_own
on public.household_members for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy household_members_update_own
on public.household_members for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy household_members_delete_own
on public.household_members for delete
to authenticated
using (user_id = (select auth.uid()));

create policy conversation_sessions_select_own
on public.conversation_sessions for select
to authenticated
using (user_id = (select auth.uid()));

create policy conversation_sessions_insert_own
on public.conversation_sessions for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy conversation_sessions_update_own
on public.conversation_sessions for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy conversation_sessions_delete_own
on public.conversation_sessions for delete
to authenticated
using (user_id = (select auth.uid()));

create policy conversation_messages_select_own
on public.conversation_messages for select
to authenticated
using (user_id = (select auth.uid()));

create policy conversation_messages_insert_own
on public.conversation_messages for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.conversation_sessions s
    where s.id = session_id
      and s.user_id = (select auth.uid())
  )
);

create policy conversation_messages_update_own
on public.conversation_messages for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy conversation_messages_delete_own
on public.conversation_messages for delete
to authenticated
using (user_id = (select auth.uid()));

create policy saved_recommendations_select_own
on public.saved_recommendations for select
to authenticated
using (user_id = (select auth.uid()));

create policy saved_recommendations_insert_own
on public.saved_recommendations for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    session_id is null
    or exists (
      select 1
      from public.conversation_sessions s
      where s.id = session_id
        and s.user_id = (select auth.uid())
    )
  )
);

create policy saved_recommendations_update_own
on public.saved_recommendations for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy saved_recommendations_delete_own
on public.saved_recommendations for delete
to authenticated
using (user_id = (select auth.uid()));

create policy consent_events_select_own
on public.consent_events for select
to authenticated
using (user_id = (select auth.uid()));

create policy consent_events_insert_own
on public.consent_events for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy consent_events_update_own
on public.consent_events for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy consent_events_delete_own
on public.consent_events for delete
to authenticated
using (user_id = (select auth.uid()));
