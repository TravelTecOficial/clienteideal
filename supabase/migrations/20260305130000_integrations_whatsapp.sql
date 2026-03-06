-- Tabela de integrações de provedores externos (inclui WhatsApp Cloud)

create table if not exists public.integrations (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,           -- ID do usuário no Clerk
  provider text not null,          -- 'whatsapp', 'meta_ads', etc.
  access_token text not null,      -- token longo (ex.: 60 dias da Meta)
  waba_id text,                    -- ID da WhatsApp Business Account
  phone_number_id text,            -- ID específico do número WhatsApp escolhido
  expires_at timestamptz not null, -- data de expiração do token
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint integrations_user_provider_unique unique (user_id, provider)
);

alter table public.integrations enable row level security;

create policy "Users can view their own integrations"
  on public.integrations
  for select
  using (auth.uid()::text = user_id);

