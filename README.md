# Daggerheart Campaign Hub

Plataforma web para Daggerheart com backend Supabase, focada em:

- criação de personagem (ficha base) pelo jogador
- múltiplos personagens por conta
- campanhas controladas pelo mestre (sem auto-cadastro público)
- snapshot da ficha dentro da campanha sem afetar a ficha base
- painel do mestre para dano, condições, cartas, histórico e undo
- importação de cartas por `DH-Baralho.pdf`, JSON e cadastro manual
- atualização em tempo real via Supabase Realtime + refresh reativo

## Acessos padrão

- `mestre / 123456`
- `joao / 1234` (jogador de exemplo)

## Fonte de dados usada

- `daggerheart_criacao_personagem.json` (extraído do livro básico): classes, subclasses, ancestralidades, comunidades, defaults de ficha
- `DH-Baralho.pdf`: importação das cartas (nome, texto, categoria, efeitos inferidos)

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4
- Zustand
- Supabase (Postgres + Realtime)
- Vitest

## Configuracao

1. Copie o arquivo de exemplo e preencha as credenciais:

```bash
cp .env.example .env
```

2. Variaveis obrigatorias para rodar local e na Vercel:

- `SUPABASE_PROJECT_ID`
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`

3. Instale dependencias e aplique o schema:

```bash
npm install
npm run supabase:apply-schema
```

4. (Opcional) Reimporte cartas:

```bash
npm run import:cards -- "C:\\Users\\wesll\\Downloads\\DH-Baralho.pdf"
```

5. Rode o app:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npm run supabase:apply-schema
npm run import:cards
```

## Estrutura principal

```text
src/
  app/
    api/
    login/
    master/
    player/
  components/
    ui/
  data/
  hooks/
  lib/
  rules/
  stores/
  types/
scripts/
  apply-supabase-schema.ts
  import-card-pdf.ts
supabase/
  schema.sql
```

