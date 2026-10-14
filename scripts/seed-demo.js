require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');

const products = [
  ['DEMO - Café', 28, 18.50, 'Alimentos'],
  ['DEMO - Papel A4', 15, 32.90, 'Escritório'],
  ['DEMO - Caneta azul', 50, 2.75, 'Escritório'],
  ['DEMO - Toner preto', 8, 119.90, 'Impressão'],
];

const movements = [
  ['DEMO - Café', '2026-10-10T09:00:00-03:00', 'entrada', 40],
  ['DEMO - Café', '2026-10-12T14:30:00-03:00', 'saida', 12],
  ['DEMO - Papel A4', '2026-10-10T10:00:00-03:00', 'entrada', 20],
  ['DEMO - Papel A4', '2026-10-13T11:15:00-03:00', 'saida', 5],
  ['DEMO - Caneta azul', '2026-10-11T08:30:00-03:00', 'entrada', 100],
  ['DEMO - Caneta azul', '2026-10-14T12:00:00-03:00', 'saida', 50],
  ['DEMO - Toner preto', '2026-10-11T15:00:00-03:00', 'entrada', 10],
  ['DEMO - Toner preto', '2026-10-14T16:00:00-03:00', 'saida', 2],
];

async function seed() {
  let client;
  let productsAdded = 0;
  let movementsAdded = 0;

  try {
    client = await db.connect();
    const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    await client.query(schema);
    await client.query('BEGIN');

    for (const [name, quantity, price, category] of products) {
      const result = await client.query(
        `INSERT INTO produtos (nome, quantidade, valor, categoria)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE nome = $1)
         RETURNING id`,
        [name, quantity, price, category]
      );
      productsAdded += result.rowCount;
    }

    for (const [product, time, type, quantity] of movements) {
      const result = await client.query(
        `INSERT INTO movimentacoes (tempo, tipo, quantidade, id_produto)
         SELECT $2::timestamptz, $3, $4, p.id
         FROM produtos p
         WHERE p.nome = $1
           AND NOT EXISTS (
             SELECT 1 FROM movimentacoes m
             WHERE m.id_produto = p.id AND m.tempo = $2::timestamptz
               AND m.tipo = $3 AND m.quantidade = $4
           )
         RETURNING id`,
        [product, time, type, quantity]
      );
      movementsAdded += result.rowCount;
    }

    await client.query('COMMIT');
    console.log(`Carga concluída: ${productsAdded} produtos e ${movementsAdded} movimentações adicionados.`);
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    console.error('Não foi possível carregar os dados de demonstração. Confira se a DATABASE_URL está correta e se o Neon aceita conexões de rede deste computador.');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    client?.release();
    await db.end();
  }
}

seed();
