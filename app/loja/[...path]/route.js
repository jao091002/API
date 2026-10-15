import db from '../../../db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function routeName(context) {
  const { path = [] } = await context.params;
  return path.join('/');
}

function serverError(message, error) {
  console.error(`${message}:`, error.message);
  if (error.code === 'DATABASE_URL_MISSING') {
    return Response.json({ error: 'Configure DATABASE_URL nas variáveis de ambiente da Vercel.' }, { status: 503 });
  }
  if (error.code === '42P01') {
    return Response.json({ error: 'As tabelas do banco ainda não existem. Execute npm run db:seed uma vez.' }, { status: 503 });
  }
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(request, context) {
  const route = await routeName(context);
  try {
    if (route === 'health') {
      const { rows } = await db.query(`
        SELECT to_regclass('public.produtos') IS NOT NULL AS produtos,
               to_regclass('public.movimentacoes') IS NOT NULL AS movimentacoes
      `);
      const ready = rows[0].produtos && rows[0].movimentacoes;
      return Response.json({ status: ready ? 'ok' : 'schema_missing' }, { status: ready ? 200 : 503 });
    }
    if (route === 'listar') {
      const { rows } = await db.query('SELECT * FROM produtos ORDER BY id');
      return Response.json(rows);
    }
    if (route === 'categoria') {
      const { rows } = await db.query(
        'SELECT categoria, SUM(quantidade * valor) AS total_categoria FROM produtos GROUP BY categoria ORDER BY categoria'
      );
      return Response.json(rows);
    }
    return Response.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    return serverError('Erro ao consultar o estoque', error);
  }
}

export async function POST(request, context) {
  const route = await routeName(context);
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Corpo da solicitação deve ser JSON válido' }, { status: 400 }); }

  try {
    if (route === 'cadastro') {
      const { nome, quantidade, valor, categoria } = body;
      if (!nome || quantidade == null || valor == null || !categoria) {
        return Response.json({ error: 'Informe nome, quantidade, valor e categoria' }, { status: 400 });
      }
      const { rows } = await db.query(
        'INSERT INTO produtos (nome, quantidade, valor, categoria) VALUES ($1, $2, $3, $4) RETURNING id',
        [nome, quantidade, valor, categoria]
      );
      return Response.json({ message: 'Produto cadastrado com sucesso', id: rows[0].id }, { status: 201 });
    }

    if (route === 'registro') {
      const { tempo, tipo, quantidade, id_produto } = body;
      if (!tempo || Number.isNaN(Date.parse(tempo)) || !['entrada', 'saida'].includes(tipo) || !Number.isFinite(Number(quantidade)) || Number(quantidade) <= 0 || !/^\d+$/.test(String(id_produto || ''))) {
        return Response.json({ error: 'Informe tempo, tipo (entrada/saida), quantidade e id_produto' }, { status: 400 });
      }
      const client = await db.connect();
      let rows;
      try {
        await client.query('BEGIN');
        const product = await client.query('SELECT id, quantidade FROM produtos WHERE id = $1 FOR UPDATE', [id_produto]);
        if (!product.rows.length) {
          await client.query('ROLLBACK');
          return Response.json({ error: 'Produto nÃ£o encontrado' }, { status: 404 });
        }
        const currentStock = Number(product.rows[0].quantidade);
        const movementQuantity = Number(quantidade);
        if (tipo === 'saida' && movementQuantity > currentStock) {
          await client.query('ROLLBACK');
          return Response.json({ error: `Estoque insuficiente. Saldo atual: ${currentStock}.` }, { status: 409 });
        }
        const inserted = await client.query(
          'INSERT INTO movimentacoes (tempo, tipo, quantidade, id_produto) VALUES ($1, $2, $3, $4) RETURNING id',
          [tempo, tipo, movementQuantity, id_produto]
        );
        const updated = await client.query(
          `UPDATE produtos
           SET quantidade = quantidade + CASE WHEN $1 = 'entrada' THEN $2::numeric ELSE -$2::numeric END
           WHERE id = $3 RETURNING quantidade`,
          [tipo, movementQuantity, id_produto]
        );
        await client.query('COMMIT');
        rows = inserted.rows;
        rows[0].quantidade_atual = updated.rows[0].quantidade;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch {}
        throw error;
      } finally {
        client.release();
      }
      return Response.json({ message: 'Movimentação registrada', id: rows[0].id, quantidade_atual: rows[0].quantidade_atual }, { status: 201 });
    }

    if (route === 'porcentagem') {
      const limiteMaximo = Number(body.limite_maximo ?? 100);
      const limiteMinimo = Number(body.limite_minimo ?? 0);
      if (!Number.isFinite(limiteMaximo) || !Number.isFinite(limiteMinimo) || limiteMaximo <= 0) {
        return Response.json({ error: 'limite_maximo deve ser maior que zero e os limites devem ser numéricos' }, { status: 400 });
      }
      const { rows } = await db.query(`
        SELECT id, nome, quantidade, categoria,
               ROUND((quantidade / $1::numeric) * 100, 2) AS percentual_atingido
        FROM produtos
        WHERE quantidade < $2 OR quantidade >= $3
        ORDER BY quantidade, nome
      `, [limiteMaximo, limiteMinimo, limiteMaximo]);
      return Response.json({
        filtros_aplicados: { minimo: limiteMinimo, maximo: limiteMaximo },
        produtos_no_limite: rows,
      });
    }

    if (route === 'relatorio-periodo' || route === 'maiores-saidas') {
      const { dataInicial, dataFinal } = body;
      if (!dataInicial || !dataFinal) {
        return Response.json({ error: 'Informe dataInicial e dataFinal' }, { status: 400 });
      }
      const dateParams = [dataInicial, dataFinal];

      if (route === 'relatorio-periodo') {
        const { rows } = await db.query(`
          SELECT p.nome,
                 p.categoria AS unidade_medida,
                 SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE 0 END) AS total_entradas,
                 SUM(CASE WHEN m.tipo = 'saida' THEN m.quantidade ELSE 0 END) AS total_saidas,
                 SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE -m.quantidade END) AS saldo_periodo,
                 SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade * p.valor ELSE 0 END) AS valor_total_entradas,
                 SUM(CASE WHEN m.tipo = 'saida' THEN m.quantidade * p.valor ELSE 0 END) AS valor_total_saidas
          FROM movimentacoes m
          INNER JOIN produtos p ON p.id = m.id_produto
          WHERE m.tempo BETWEEN $1::date AND ($2::date + INTERVAL '1 day' - INTERVAL '1 microsecond')
          GROUP BY p.id, p.nome, p.categoria
          ORDER BY p.nome
        `, dateParams);
        return Response.json(rows);
      }

      const { rows } = await db.query(`
        SELECT p.nome,
               SUM(m.quantidade) AS quantidade_total_saida,
               SUM(m.quantidade * p.valor) AS valor_total_financeiro_saida
        FROM movimentacoes m
        INNER JOIN produtos p ON p.id = m.id_produto
        WHERE m.tipo = 'saida'
          AND m.tempo BETWEEN $1::date AND ($2::date + INTERVAL '1 day' - INTERVAL '1 microsecond')
        GROUP BY p.id, p.nome
        ORDER BY quantidade_total_saida DESC
      `, dateParams);
      return Response.json(rows);
    }

    return Response.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    return serverError('Erro ao processar a solicitação', error);
  }
}

export async function PATCH(request, context) {
  const route = await routeName(context);
  const match = route.match(/^produtos\/(\d+)$/);
  if (!match) return Response.json({ error: 'Rota não encontrada' }, { status: 404 });

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Corpo da solicitação deve ser JSON válido' }, { status: 400 }); }

  const { nome, quantidade, valor, categoria } = body;
  if (!nome?.trim() || !categoria?.trim() || !Number.isFinite(Number(quantidade)) || Number(quantidade) < 0 || !Number.isFinite(Number(valor)) || Number(valor) < 0) {
    return Response.json({ error: 'Informe nome, categoria e valores numéricos válidos para quantidade e preço' }, { status: 400 });
  }

  try {
    const { rows } = await db.query(
      'UPDATE produtos SET nome = $1, quantidade = $2, valor = $3, categoria = $4 WHERE id = $5 RETURNING id',
      [nome.trim(), quantidade, valor, categoria.trim(), match[1]]
    );
    if (!rows.length) return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    return Response.json({ message: 'Produto atualizado com sucesso', id: rows[0].id });
  } catch (error) {
    return serverError('Erro ao atualizar produto', error);
  }
}

export async function DELETE(_request, context) {
  const route = await routeName(context);
  const match = route.match(/^produtos\/(\d+)$/);
  if (!match) return Response.json({ error: 'Rota não encontrada' }, { status: 404 });

  try {
    const { rows } = await db.query('DELETE FROM produtos WHERE id = $1 RETURNING id', [match[1]]);
    if (!rows.length) return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    return Response.json({ message: 'Produto excluído com sucesso', id: rows[0].id });
  } catch (error) {
    if (error.code === '23503') {
      return Response.json({ error: 'Este produto tem movimentações registradas e não pode ser excluído.' }, { status: 409 });
    }
    return serverError('Erro ao excluir produto', error);
  }
}
