'use client';

import { useEffect, useState } from 'react';

async function api(path, options = {}) {
  const response = await fetch(`/loja/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('Resposta inválida do servidor. Confira se a aplicação e a conexão com o banco estão ativas.'); }
  if (!response.ok) throw new Error(data.error || 'A solicitação não foi concluída.');
  return data;
}

function ResultTable({ data }) {
  const rows = Array.isArray(data) ? data : data?.produtos_no_limite || [data];
  if (!rows.length) return <p className="muted">Nenhum resultado encontrado.</p>;
  const columns = Object.keys(rows[0] || {});
  return <div className="table-wrap"><table><thead><tr>{columns.map((key) => <th key={key}>{key.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{columns.map((key) => <td key={key}>{row[key] ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('Selecione um relatório para consultar.');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadProducts() {
    try { setProducts(await api('listar')); setError(''); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { loadProducts(); }, []);

  async function send(event, path, successText) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    for (const key of ['quantidade', 'valor', 'limite_minimo', 'limite_maximo', 'id_produto']) {
      if (body[key] !== undefined && body[key] !== '') body[key] = Number(body[key]);
    }
    if (body.tempo) body.tempo = body.tempo.replace('T', ' ') + ':00';
    try {
      const data = await api(path, { method: 'POST', body: JSON.stringify(body) });
      if (successText) {
        setMessage(data.message || successText); setResult(null); form.reset();
        if (path === 'cadastro' || path === 'registro') await loadProducts();
      } else { setMessage('Resultado da consulta'); setResult(data); }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <>
    <header className="topbar"><a className="brand" href="#inicio"><span className="brand-mark">E</span> ESTOQUE <span className="brand-light">/ PAINEL</span></a><span className="connection"><i /> Gestão do seu negócio</span></header>
    <main>
      <section className="welcome" id="inicio"><div><span className="eyebrow">GESTÃO SIMPLES, DIA A DIA MAIS LEVE</span><h1>Seu estoque,<br /><span>em ordem.</span></h1><p>Cadastre produtos, acompanhe movimentações e consulte relatórios em um só lugar.</p></div><div className="welcome-art" aria-hidden="true"><div className="art-box box-one"/><div className="art-box box-two"/><div className="art-box box-three"/><span>INVENTÁRIO<br/>ORGANIZADO</span></div></section>
      <section className="card"><div className="section-title"><div><span className="eyebrow">VISÃO GERAL</span><h2>Seus produtos</h2></div><button className="button-secondary" onClick={loadProducts}>↻ Atualizar lista</button></div>{error && <p className="error">{error}</p>}{products.length ? <ResultTable data={products}/> : <p className="muted">{error ? 'Verifique se o servidor e o banco estão ativos.' : 'Nenhum produto cadastrado.'}</p>}</section>
      <div className="grid">
        <section className="card form-card"><span className="card-icon">＋</span><span className="eyebrow">NOVO NO ESTOQUE</span><h2>Cadastrar produto</h2><p className="card-description">Adicione um item ao seu inventário.</p><form onSubmit={(e) => send(e, 'cadastro', 'Produto cadastrado.')}><label>Nome<input name="nome" required /></label><label>Quantidade inicial<input name="quantidade" type="number" min="0" step="any" required /></label><label>Valor unitário (R$)<input name="valor" type="number" min="0" step="0.01" required /></label><label>Categoria<input name="categoria" required /></label><button disabled={busy}>Cadastrar produto</button></form></section>
        <section className="card form-card"><span className="card-icon icon-orange">↗</span><span className="eyebrow">ENTRADAS E SAÍDAS</span><h2>Movimentação</h2><p className="card-description">Mantenha o saldo atualizado.</p><form onSubmit={(e) => send(e, 'registro', 'Movimentação registrada.')}><label>Produto<select name="id_produto" required defaultValue=""><option value="" disabled>Selecione um produto</option>{products.map(p => <option key={p.id} value={p.id}>{p.nome} (ID {p.id})</option>)}</select></label><label>Tipo<select name="tipo"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label><label>Quantidade<input name="quantidade" type="number" min="0.01" step="any" required /></label><label>Data e hora<input name="tempo" type="datetime-local" required /></label><button disabled={busy}>Registrar movimentação</button></form></section>
      </div>
      <section className="card reports-card"><span className="eyebrow">DADOS PARA DECIDIR</span><h2>Relatórios</h2><p className="card-description">Escolha uma consulta para explorar os dados do seu estoque.</p><div className="grid">
        <form className="report-form" onSubmit={(e) => send(e, 'categoria')}><h3>Total por categoria</h3><p>Valor total armazenado em cada categoria.</p><button disabled={busy}>Gerar relatório <span>→</span></button></form>
        <form className="report-form" onSubmit={(e) => send(e, 'porcentagem')}><h3>Limites do estoque</h3><p>Produtos abaixo ou acima dos limites informados.</p><label>Limite mínimo<input name="limite_minimo" type="number" defaultValue="0" step="any" /></label><label>Limite máximo<input name="limite_maximo" type="number" defaultValue="100" min="0.01" step="any" /></label><button disabled={busy}>Gerar relatório <span>→</span></button></form>
        <form className="report-form" onSubmit={(e) => send(e, 'relatorio-periodo')}><h3>Movimentações no período</h3><p>Entradas, saídas e saldo entre datas.</p><label>Data inicial<input name="dataInicial" type="date" required /></label><label>Data final<input name="dataFinal" type="date" required /></label><button disabled={busy}>Gerar relatório <span>→</span></button></form>
        <form className="report-form" onSubmit={(e) => send(e, 'maiores-saidas')}><h3>Maiores saídas</h3><p>Produtos com mais saídas no período.</p><label>Data inicial<input name="dataInicial" type="date" required /></label><label>Data final<input name="dataFinal" type="date" required /></label><button disabled={busy}>Gerar relatório <span>→</span></button></form>
      </div><div className="result" aria-live="polite"><strong>{message}</strong>{error && <p className="error">{error}</p>}{result && <ResultTable data={result}/>}</div></section>
    </main><footer>PAINEL DE ESTOQUE <span>·</span> ORGANIZAÇÃO PARA O SEU NEGÓCIO</footer>
  </>;
}
