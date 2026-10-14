import db from '../../../db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function routeName(context) {
  const { path = [] } = await context.params;
  return path.join('/');
}

function serverError(res, message, error) {
  console.error(`${message}:`, error.message);
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(request, context) {
  const route = await routeName(context);
  try {
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
      if (!tempo || !['entrada', 'saida'].includes(tipo) || quantidade == null || !id_produto) {
        return Response.json({ error: 'Informe tempo, tipo (entrada/saida), quantidade e id_produto' }, { status: 400 });
      }
      const { rows } = await db.query(
        'INSERT INTO movimentacoes (tempo, tipo, quantidade, id_produto) VALUES ($1, $2, $3, $4) RETURNING id',
        [tempo, tipo, quantidade, id_produto]
      );
      return Response.json({ message: 'Movimentação registrada', id: rows[0].id }, { status: 201 });
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
        WHERE quantidade <= $2 OR quantidade >= $3
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
