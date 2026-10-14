# Painel de estoque

Aplicação Next.js com API Routes e PostgreSQL no Neon, pronta para deploy nativo na Vercel.

## Rodar localmente

1. Configure `DATABASE_URL` no `.env` com a URL pooled do Neon.
2. Execute `npm install`.
3. Execute `npm run db:seed` para criar as tabelas e inserir dados de demonstração (a carga é idempotente).
4. Execute `npm run dev` e abra `http://localhost:3000`.

## Publicar na Vercel

1. Importe este repositório na Vercel. `vercel.json` fixa o preset Next.js e o comando de build.
2. Em **Project Settings → Environment Variables**, configure `DATABASE_URL` com a URL pooled do Neon para Production e Preview.
3. Faça redeploy. As rotas `/loja/*` são servidas como Route Handler do Next.js no runtime Node.js.
4. Execute `npm run db:seed` uma vez em um terminal com `DATABASE_URL` apontando para o Neon de produção. O script cria tabelas e dados de demonstração sem duplicá-los; não o execute em cada build.

O `.env` local não vai para o Git. Não use prefixo `NEXT_PUBLIC_` em `DATABASE_URL`.
