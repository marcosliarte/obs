-- =========================================================================
-- StreamKit — configuração do Supabase
-- Rode no SQL Editor do Supabase. É seguro rodar mais de uma vez.
--
-- Por que: a chave "publishable" fica no código (é pública por natureza).
-- Se a tabela aceitar escrita anônima, QUALQUER pessoa com essa chave pode
-- trocar textos, imagens e o widget de chat que aparecem na sua live.
-- Com este script, ler continua público (o OBS precisa), mas escrever exige
-- a chave de escrita, que fica só no navegador do painel.
-- =========================================================================

-- 1) Tabela de configuração (leitura pública) -----------------------------
create table if not exists public.streamkit_config (
  id         text primary key,
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.streamkit_config enable row level security;

drop policy if exists "streamkit_read" on public.streamkit_config;
create policy "streamkit_read" on public.streamkit_config
  for select to anon, authenticated using (true);

insert into public.streamkit_config (id) values ('default') on conflict (id) do nothing;

-- 2) Chave de escrita -------------------------------------------------------
-- TROQUE o texto abaixo por uma senha longa só sua. Depois, no painel,
-- abra "Segurança", cole a mesma chave e clique em Salvar.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.streamkit_keys (
  id       text primary key,
  key_hash text not null
);
alter table public.streamkit_keys enable row level security;   -- sem políticas: ninguém lê pela API
revoke all on public.streamkit_keys from anon, authenticated;

insert into public.streamkit_keys (id, key_hash)
values ('default', extensions.crypt('TROQUE-POR-UMA-CHAVE-LONGA', extensions.gen_salt('bf')))
on conflict (id) do update set key_hash = excluded.key_hash;

create or replace function public.streamkit_save(p_id text, p_key text, p_config jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (
    select 1 from public.streamkit_keys k
    where k.id = p_id and k.key_hash = extensions.crypt(p_key, k.key_hash)
  ) then
    raise exception 'chave de escrita inválida' using errcode = '42501';
  end if;

  insert into public.streamkit_config (id, config, updated_at)
  values (p_id, p_config, now())
  on conflict (id) do update set config = excluded.config, updated_at = now();
end;
$$;

revoke all on function public.streamkit_save(text, text, jsonb) from public;
grant execute on function public.streamkit_save(text, text, jsonb) to anon, authenticated;

-- 3) Bloquear a escrita direta ---------------------------------------------
-- Rode SÓ DEPOIS de salvar a chave no painel e ver "Salvo" no topo.
-- A partir daqui, sem a chave ninguém altera o overlay.
revoke insert, update, delete on public.streamkit_config from anon, authenticated;

-- Para desfazer o passo 3 (voltar ao modo antigo, sem proteção):
-- grant insert, update on public.streamkit_config to anon, authenticated;
-- create policy "streamkit_write" on public.streamkit_config for all to anon using (true) with check (true);

-- Vários overlays: crie outra linha de chave com o id desejado (ex.: 'canal2')
-- e abra o painel com ?id=canal2.
