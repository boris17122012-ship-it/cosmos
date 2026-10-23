-- cosmos: основные таблицы. Запустить первым в Supabase -> SQL Editor.
create table if not exists public.players (
  telegram_id bigint primary key,
  username text,
  stars bigint not null default 0,
  inventory jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pending_deliveries (
  id bigserial primary key,
  telegram_id bigint not null,
  username text,
  collection_slug text not null,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz default now()
);
create index if not exists pending_deliveries_status_idx on public.pending_deliveries(status);

alter table public.players enable row level security;
alter table public.pending_deliveries enable row level security;

-- Бета: клиент сам читает/создаёт/обновляет игрока публичным ключом (как в старой базе).
-- Перед релизом заменить на серверную логику.
drop policy if exists "players read" on public.players;
create policy "players read" on public.players for select using (true);
drop policy if exists "players insert" on public.players;
create policy "players insert" on public.players for insert with check (true);
drop policy if exists "players update" on public.players;
create policy "players update" on public.players for update using (true) with check (true);

-- api/check-payments.js добавляет заявки публичным ключом; worker.py читает их service-ключом.
drop policy if exists "deliveries insert" on public.pending_deliveries;
create policy "deliveries insert" on public.pending_deliveries for insert with check (true);

-- Перенос игроков из старой базы (oawmltaiiryankxvtzrc), выгружено 23.10.2026
insert into public.players (telegram_id, stars, inventory, updated_at) values
(7366648944,1999997005,'[{"val": 80, "icon": "img/IMG_6767.jpeg", "name": "Planet Core"}, {"val": 120, "icon": "img/IMG_6766.jpeg", "name": "Plush Pepe"}, {"val": 60, "icon": "img/IMG_6755.jpeg", "name": "Diamond Ring"}, {"val": 120, "icon": "img/IMG_6766.jpeg", "name": "Plush Pepe"}, {"val": 80, "icon": "img/IMG_6767.jpeg", "name": "Planet Core"}, {"val": 40, "icon": "img/IMG_6756.jpeg", "name": "Gift Box"}, {"val": 10, "icon": "img/IMG_6761.jpeg", "name": "Tiny Heart"}, {"val": 15, "icon": "img/IMG_6760.jpeg", "name": "Space Bear"}, {"val": 20, "icon": "img/IMG_6758.jpeg", "name": "Cosmic Cake"}, {"val": 25, "icon": "img/IMG_6757.jpeg", "name": "STAR"}, {"val": 80, "icon": "img/IMG_6767.jpeg", "name": "PLANET"}, {"val": 40, "icon": "img/IMG_6756.jpeg", "name": "GIFT"}, {"val": 20, "icon": "img/IMG_6758.jpeg", "name": "CAKE"}, {"val": 60, "icon": "img/IMG_6755.jpeg", "name": "RING"}, {"val": 15, "icon": "img/IMG_6760.jpeg", "name": "BEAR"}, {"val": 80, "icon": "img/IMG_6767.jpeg", "name": "PLANET"}]'::jsonb,'2026-10-22T11:05:32.492+00:00'),
(7906692052,105,'[{"val": 10, "icon": "img/IMG_6761.jpeg", "name": "Tiny Heart"}, {"val": 180, "icon": "img/IMG_6765.jpeg", "name": "Durov''s Cap"}, {"val": 10, "icon": "img/IMG_6761.jpeg", "name": "Tiny Heart"}, {"val": 120, "icon": "img/IMG_6766.jpeg", "name": "Plush Pepe"}, {"val": 180, "icon": "img/IMG_6765.jpeg", "name": "Durov''s Cap"}, {"val": 20, "icon": "img/IMG_6758.jpeg", "name": "Cosmic Cake"}, {"val": 20, "icon": "img/IMG_6758.jpeg", "name": "CAKE"}, {"val": 25, "icon": "img/IMG_6757.jpeg", "name": "STAR"}]'::jsonb,'2026-10-22T12:47:52.095+00:00'),
(8098980041,998485,'[{"val": 25, "icon": "img/IMG_6757.jpeg", "name": "STAR"}, {"val": 60, "icon": "img/IMG_6755.jpeg", "name": "RING"}, {"val": 25, "icon": "img/IMG_6757.jpeg", "name": "STAR"}, {"val": 15, "icon": "img/IMG_6760.jpeg", "name": "BEAR"}]'::jsonb,'2026-10-22T07:52:39.259338+00:00')
on conflict (telegram_id) do update set stars=excluded.stars, inventory=excluded.inventory, updated_at=excluded.updated_at;
