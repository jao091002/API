# Painel de estoque

Aplicação Next.js com API Routes e PostgreSQL no Neon, pronta para deploy nativo na Vercel.

## Rodar localmente

1. Configure `DATABASE_URL` no `.env` com a URL pooled do Neon.
2. Execute `npm install`.
3. Execute `npm run db:seed` para criar as tabelas e inserir dados de demonstração.
4. Execute `npm run dev` e abra `http://localhost:3000`.

## Publicar na Vercel

1. Importe este repositório como projeto Next.js na Vercel. Use os comandos padrão (`npm run build` e `npm start`).
2. Em **Project Settings → Environment Variables**, configure `DATABASE_URL` com a URL pooled do Neon para Production e Preview.
3. Faça redeploy. As rotas `/loja/*` são servidas como Route Handler do Next.js no runtime Node.js.
4. Execute `npm run db:seed` localmente com a URL do banco de destino para criar as tabelas e, se desejado, os dados de demonstração.

O `.env` local não vai para o Git. Não use prefixo `NEXT_PUBLIC_` em `DATABASE_URL`.
