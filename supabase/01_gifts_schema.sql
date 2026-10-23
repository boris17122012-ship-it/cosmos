-- cosmos: каталог NFT-подарков Telegram. Запустить один раз в Supabase -> SQL Editor.
create table if not exists public.gift_collections (
  slug text primary key,
  name text not null,
  supply integer,
  floor_ton numeric(14,2),
  avg_ton numeric(14,2),
  listings_sampled integer,
  thumb text,
  source text default 'fragment.com',
  updated_at timestamptz default now()
);
create table if not exists public.gift_models (
  id bigserial primary key,
  collection_slug text not null references public.gift_collections(slug) on delete cascade,
  name text not null,
  image_url text,
  supply integer,
  rarity_permille integer,
  unique (collection_slug, name)
);
create index if not exists gift_models_collection_idx on public.gift_models(collection_slug);
alter table public.gift_collections enable row level security;
alter table public.gift_models enable row level security;
drop policy if exists "gift_collections read" on public.gift_collections;
create policy "gift_collections read" on public.gift_collections for select using (true);
drop policy if exists "gift_models read" on public.gift_models;
create policy "gift_models read" on public.gift_models for select using (true);
