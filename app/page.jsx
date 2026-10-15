'use client';

import { useEffect, useMemo, useState } from 'react';

async function api(path, options = {}) {
  const response = await fetch(`/loja/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('Resposta inválida do servidor. Confira a aplicação e a conexão com o banco.'); }
  if (!response.ok) throw new Error(data.error || 'A solicitação não foi concluída.');
  return data;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const labels = {
  id: 'ID', nome: 'Produto', quantidade: 'Quantidade', valor: 'Valor unitário', categoria: 'Categoria',
  total_categoria: 'Valor em estoque', percentual_atingido: 'Estoque (%)', unidade_medida: 'Categoria',
  total_entradas: 'Entradas', total_saidas: 'Saídas', saldo_periodo: 'Saldo no período',
  valor_total_entradas: 'Valor das entradas', valor_total_saidas: 'Valor das saídas',
  quantidade_total_saida: 'Quantidade de saídas', valor_total_financeiro_saida: 'Valor das saídas',
};

function ResultTable({ data, products = false, onEdit, onDelete }) {
  const rows = Array.isArray(data) ? data : data?.produtos_no_limite || [data];
  if (!rows.length) return <p className="muted">Nenhum resultado encontrado.</p>;
  const columns = Object.keys(rows[0] || {});
  const cell = (key, value) => {
    if (value == null) return '—';
    if (['valor', 'total_categoria', 'valor_total_entradas', 'valor_total_saidas', 'valor_total_financeiro_saida'].includes(key)) return currency.format(Number(value));
    if (key === 'percentual_atingido') return `${value}%`;
    return value;
  };
  return <div className="table-wrap"><table><thead><tr>{columns.map((key) => <th key={key}>{labels[key] || key.replaceAll('_', ' ')}</th>)}{products && <th>Ações</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id || JSON.stringify(row)}>{columns.map((key) => <td key={key}>{cell(key, row[key])}</td>)}{products && <td className="actions"><button className="button-secondary" onClick={() => onEdit(row)}>Editar</button><button className="button-danger" onClick={() => onDelete(row)}>Excluir</button></td>}</tr>)}</tbody></table></div>;
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('Selecione um relatório para consultar.');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [connection, setConnection] = useState('checking');
  const [editingProduct, setEditingProduct] = useState(null);
  const [search, setSearch] = useState('');

  async function loadProducts() {
    setLoadingProducts(true);
    try { setProducts(await api('listar')); setError(''); }
    catch (e) { setError(e.message); }
    finally { setLoadingProducts(false); }
  }

  useEffect(() => {
    loadProducts();
    api('health').then(({ status }) => setConnection(status === 'ok' ? 'online' : 'schema_missing'))
      .catch(() => setConnection('offline'));
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    if (!query) return products;
    return products.filter((product) => `${product.nome} ${product.categoria} ${product.id}`.toLocaleLowerCase('pt-BR').includes(query));
  }, [products, search]);

  async function send(event, path, successText) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    for (const key of ['quantidade', 'valor', 'limite_minimo', 'limite_maximo', 'id_produto']) {
      if (body[key] !== undefined && body[key] !== '') body[key] = Number(body[key]);
    }
    if (body.tempo) body.tempo = body.tempo.replace('T', ' ') + ':00';
    try {
      const data = await api(path, path === 'categoria' ? {} : { method: 'POST', body: JSON.stringify(body) });
      if (successText) {
        setMessage(data.message || successText); setResult(null); form.reset();
        if (path === 'cadastro' || path === 'registro') await loadProducts();
      } else { setMessage('Resultado da consulta'); setResult(data); }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function saveProduct(event) {
    event.preventDefault(); setBusy(true); setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    body.quantidade = Number(body.quantidade); body.valor = Number(body.valor);
    try {
      const data = await api(`produtos/${editingProduct.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setMessage(data.message); setEditingProduct(null); await loadProducts();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Excluir o produto "${product.nome}"? Esta ação não pode ser desfeita.`)) return;
    setBusy(true); setError('');
    try {
      const data = await api(`produtos/${product.id}`, { method: 'DELETE' });
      setMessage(data.message); await loadProducts();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const connectionText = connection === 'online' ? 'Banco conectado' : connection === 'checking' ? 'Conectando ao banco' : connection === 'schema_missing' ? 'Tabelas pendentes' : 'Banco indisponível';

  return <>
    <header className="topbar"><a className="brand" href="#inicio"><span className="brand-mark">E</span> ESTOQUE <span className="brand-light">/ PAINEL</span></a><span className={`connection connection-${connection}`}><i /> {connectionText}</span></header>
    <main>
      <section className="welcome" id="inicio"><div><span className="eyebrow">GESTÃO SIMPLES, DIA A DIA MAIS LEVE</span><h1>Seu estoque,<br /><span>em ordem.</span></h1><p>Cadastre produtos, acompanhe movimentações e consulte relatórios em um só lugar.</p></div><div className="welcome-art" aria-hidden="true"><div className="art-box box-one"/><div className="art-box box-two"/><div className="art-box box-three"/><span>INVENTÁRIO<br/>ORGANIZADO</span></div></section>

      <section className="card"><div className="section-title"><div><span className="eyebrow">VISÃO GERAL</span><h2>Seus produtos <span className="count-badge">{products.length}</span></h2></div><button className="button-secondary" onClick={loadProducts} disabled={loadingProducts}>↻ Atualizar lista</button></div>
        {error && <p className="error">{error}</p>}
        <label className="search-label">Buscar produto<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, categoria ou ID" /></label>
        {loadingProducts ? <div className="skeleton-list" aria-label="Carregando produtos"><i/><i/><i/></div> : filteredProducts.length ? <ResultTable data={filteredProducts} products onEdit={setEditingProduct} onDelete={deleteProduct}/> : <p className="muted">{error ? 'Verifique se o servidor e o banco estão ativos.' : search ? 'Nenhum produto corresponde à busca.' : 'Nenhum produto cadastrado.'}</p>}
      </section>

      <div className="grid">
        <section className="card form-card"><span className="card-icon">＋</span><span className="eyebrow">NOVO NO ESTOQUE</span><h2>Cadastrar produto</h2><p className="card-description">Adicione um item ao seu inventário.</p><form onSubmit={(e) => send(e, 'cadastro', 'Produto cadastrado.')}><label>Nome<input name="nome" maxLength="150" required /></label><label>Quantidade inicial<input name="quantidade" type="number" min="0" step="any" required /></label><label>Valor unitário (R$)<input name="valor" type="number" min="0" step="0.01" required /></label><label>Categoria<input name="categoria" maxLength="100" required /></label><button disabled={busy}>Cadastrar produto</button></form></section>
        <section className="card form-card"><span className="card-icon icon-orange">↗</span><span className="eyebrow">ENTRADAS E SAÍDAS</span><h2>Movimentação</h2><p className="card-description">Mantenha o saldo atualizado.</p><form onSubmit={(e) => send(e, 'registro', 'Movimentação registrada.')}><label>Produto<select name="id_produto" required defaultValue=""><option value="" disabled>Selecione um produto</option>{products.map(p => <option key={p.id} value={p.id}>{p.nome} (ID {p.id})</option>)}</select></label><label>Tipo<select name="tipo"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label><label>Quantidade<input name="quantidade" type="number" min="0.01" step="any" required /></label><label>Data e hora<input name="tempo" type="datetime-local" required /></label><button disabled={busy || !products.length}>Registrar movimentação</button></form></section>
      </div>

      <section className="card reports-card"><span className="eyebrow">DADOS PARA DECIDIR</span><h2>Relatórios</h2><p className="card-description">Escolha uma consulta para explorar os dados do seu estoque.</p><div className="grid">
        <form className="report-form" onSubmit={(e) => send(e, 'categoria')}><h3>Total por categoria</h3><p>Valor total armazenado em cada categoria.</p><button disabled={busy}>Gerar relatório <span>→</span></button></form>
        <form className="report-form" onSubmit={(e) => send(e, 'porcentagem')}><h3>Limites do estoque</h3><p>Produtos abaixo ou acima dos limites informados.</p><label>Limite mínimo<input name="limite_minimo" type="number" defaultValue="0" step="any" /></label><label>Limite máximo<input name="limite_maximo" type="number" defaultValue="100" min="0.01" step="any" /></label><button disabled={busy}>Gerar relatório <span>→</span></button></form>
        <form className="report-form" onSubmit={(e) => send(e, 'relatorio-periodo')}><h3>Movimentações no período</h3><p>Entradas, saídas e saldo entre datas.</p><label>Data inicial<input name="dataInicial" type="date" required /></label><label>Data final<input name="dataFinal" type="date" required /></label><button disabled={busy}>Gerar relatório <span>→</span></button></form>
        <form className="report-form" onSubmit={(e) => send(e, 'maiores-saidas')}><h3>Maiores saídas</h3><p>Produtos com mais saídas no período.</p><label>Data inicial<input name="dataInicial" type="date" required /></label><label>Data final<input name="dataFinal" type="date" required /></label><button disabled={busy}>Gerar relatório <span>→</span></button></form>
      </div><div className="result" aria-live="polite"><strong>{message}</strong>{result && <ResultTable data={result}/>}</div></section>
    </main>
    <footer>PAINEL DE ESTOQUE <span>·</span> ORGANIZAÇÃO PARA O SEU NEGÓCIO</footer>

    {editingProduct && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingProduct(null); }}><section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><button className="modal-close button-secondary" onClick={() => setEditingProduct(null)} aria-label="Fechar edição">✕</button><span className="eyebrow">ATUALIZAR CADASTRO</span><h2 id="edit-title">Editar produto</h2><form onSubmit={saveProduct}><label>Nome<input name="nome" defaultValue={editingProduct.nome} maxLength="150" required /></label><label>Quantidade<input name="quantidade" type="number" min="0" step="any" defaultValue={editingProduct.quantidade} required /></label><label>Valor unitário (R$)<input name="valor" type="number" min="0" step="0.01" defaultValue={editingProduct.valor} required /></label><label>Categoria<input name="categoria" defaultValue={editingProduct.categoria} maxLength="100" required /></label>{error && <p className="error">{error}</p>}<div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setEditingProduct(null)}>Cancelar</button><button disabled={busy}>Salvar alterações</button></div></form></section></div>}
  </>;
}
