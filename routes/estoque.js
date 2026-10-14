const express = require('express');
const router = express.Router();
const mysql = require('../mysql.js');

router.get('/listar', (req, res) => {
    mysql.query('SELECT * FROM produtos', (err, results) => {
        if (err) {
            console.error('Erro ao listar produtos:', err);
            return res.status(500).json({ error: 'Erro ao listar produtos' });
        }
        return res.json(results);
    });
});

router.post('/cadastro', (req, res) => {
    const { nome, quantidade, valor, categoria } = req.body;

    if (!nome || quantidade == null || valor == null || !categoria) {
        return res.status(400).json({ error: 'Informe nome, quantidade, valor e categoria' });
    }

    mysql.query(
        'INSERT INTO produtos (nome, quantidade, valor, categoria) VALUES (?, ?, ?, ?)',
        [nome, quantidade, valor, categoria],
        (err, result) => {
            if (err) {
                console.error('Erro ao cadastrar produto:', err);
                return res.status(500).json({ error: 'Erro ao cadastrar produto' });
            }
            return res.status(201).json({ message: 'Produto cadastrado com sucesso', id: result.insertId });
        }
    );
});

router.post('/registro', (req, res) => {
    const { tempo, tipo, quantidade, id_produto } = req.body;

    if (!tempo || !['entrada', 'saida'].includes(tipo) || quantidade == null || !id_produto) {
        return res.status(400).json({ error: 'Informe tempo, tipo (entrada/saida), quantidade e id_produto' });
    }

    mysql.query(
        'INSERT INTO movimentacoes (tempo, tipo, quantidade, id_produto) VALUES (?, ?, ?, ?)',
        [tempo, tipo, quantidade, id_produto],
        (err, result) => {
            if (err) {
                console.error('Erro ao registrar movimentação:', err);
                return res.status(500).json({ error: 'Erro ao registrar movimentação' });
            }
            return res.status(201).json({ message: 'Movimentação registrada', id: result.insertId });
        }
    );
});

router.get('/categoria', (req, res) => {
    mysql.query(
        'SELECT categoria, SUM(quantidade * valor) AS total_categoria FROM produtos GROUP BY categoria',
        (err, results) => {
            if (err) {
                console.error('Erro ao consultar totais por categoria:', err);
                return res.status(500).json({ error: 'Erro ao consultar totais por categoria' });
            }
            return res.json(results);
        }
    );
});

router.post('/porcentagem', (req, res) => {
    const limiteMaximo = req.body.limite_maximo ?? 100;
    const limiteMinimo = req.body.limite_minimo ?? 0;

    if (!Number.isFinite(Number(limiteMaximo)) || !Number.isFinite(Number(limiteMinimo)) || Number(limiteMaximo) <= 0) {
        return res.status(400).json({ error: 'limite_maximo deve ser maior que zero e os limites devem ser numéricos' });
    }

    const sql = `
        SELECT
            id,
            nome,
            quantidade,
            categoria,
            ROUND((quantidade / ?) * 100, 2) AS percentual_atingido
        FROM produtos
        WHERE quantidade <= ? OR quantidade >= ?
    `;

    mysql.query(sql, [Number(limiteMaximo), Number(limiteMinimo), Number(limiteMaximo)], (err, results) => {
        if (err) {
            console.error('Erro ao buscar relatório de estoque:', err);
            return res.status(500).json({ error: 'Erro ao buscar o relatório de estoque' });
        }
        return res.json({
            filtros_aplicados: { minimo: Number(limiteMinimo), maximo: Number(limiteMaximo) },
            produtos_no_limite: results
        });
    });
});

router.post('/relatorio-periodo', (req, res) => {
    const { dataInicial, dataFinal } = req.body;
    if (!dataInicial || !dataFinal) {
        return res.status(400).json({ error: 'Informe dataInicial e dataFinal' });
    }

    const sql = `
        SELECT
            p.nome,
            p.categoria AS unidade_medida,
            SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE 0 END) AS total_entradas,
            SUM(CASE WHEN m.tipo = 'saida' THEN m.quantidade ELSE 0 END) AS total_saidas,
            SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE -m.quantidade END) AS saldo_periodo,
            SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade * p.valor ELSE 0 END) AS valor_total_entradas,
            SUM(CASE WHEN m.tipo = 'saida' THEN m.quantidade * p.valor ELSE 0 END) AS valor_total_saidas
        FROM movimentacoes m
        INNER JOIN produtos p ON p.id = m.id_produto
        WHERE m.tempo BETWEEN ? AND ?
        GROUP BY p.id, p.nome, p.categoria
    `;

    mysql.query(sql, [dataInicial, dataFinal], (err, results) => {
        if (err) {
            console.error('Erro ao gerar relatório do período:', err);
            return res.status(500).json({ error: 'Erro ao gerar relatório do período' });
        }
        return res.json(results);
    });
});

router.post('/maiores-saidas', (req, res) => {
    const { dataInicial, dataFinal } = req.body;
    if (!dataInicial || !dataFinal) {
        return res.status(400).json({ error: 'Informe dataInicial e dataFinal' });
    }

    const sql = `
        SELECT
            p.nome,
            SUM(m.quantidade) AS quantidade_total_saida,
            SUM(m.quantidade * p.valor) AS valor_total_financeiro_saida
        FROM movimentacoes m
        INNER JOIN produtos p ON p.id = m.id_produto
        WHERE m.tipo = 'saida' AND m.tempo BETWEEN ? AND ?
        GROUP BY p.id, p.nome
        ORDER BY quantidade_total_saida DESC
    `;

    mysql.query(sql, [dataInicial, dataFinal], (err, results) => {
        if (err) {
            console.error('Erro ao gerar relatório de saídas:', err);
            return res.status(500).json({ error: 'Erro ao gerar relatório de saídas' });
        }
        return res.json(results);
    });
});

module.exports = router;
