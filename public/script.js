const $ = (id) => document.getElementById(id);
const result = $('resultado');

async function api(path, options = {}) {
  const response = await fetch(`/loja/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  return data;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function showTable(data) {
  if (!Array.isArray(data)) data = data.produtos_no_limite || [data];
  if (!data.length) { result.textContent = 'Nenhum resultado encontrado.'; return; }
  const columns = Object.keys(data[0]);
  result.innerHTML = `<table><thead><tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${data.map(row => `<tr>${columns.map(c => `<td>${escapeHtml(row[c] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

async function carregarProdutos() {
  try {
    const produtos = await api('listar');
    const target = $('produtos');
    if (!produtos.length) target.innerHTML = '<p class="muted">Nenhum produto cadastrado.</p>';
    else {
      const cols = Object.keys(produtos[0]);
      target.innerHTML = `<table><thead><tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${produtos.map(p => `<tr>${cols.map(c => `<td>${escapeHtml(p[c] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    $('produto-select').innerHTML = '<option value="">Selecione um produto</option>' + produtos.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)} (ID ${escapeHtml(p.id)})</option>`).join('');
  } catch (error) { $('produtos').textContent = error.message; }
}

async function submitForm(id, path, onSuccess) {
  const form = $(id);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = formData(form);
    if (data.quantidade !== undefined) data.quantidade = Number(data.quantidade);
    if (data.valor !== undefined) data.valor = Number(data.valor);
    if (data.limite_minimo !== undefined) data.limite_minimo = Number(data.limite_minimo);
    if (data.limite_maximo !== undefined) data.limite_maximo = Number(data.limite_maximo);
    if (data.tempo) data.tempo = data.tempo.replace('T', ' ') + ':00';
    try {
      const response = await api(path, { method: 'POST', body: JSON.stringify(data) });
      if (onSuccess) onSuccess(response);
      else showTable(response);
      if (path === 'cadastro' || path === 'registro') await carregarProdutos();
    } catch (error) { result.textContent = error.message; }
  });
}

$('atualizar').addEventListener('click', carregarProdutos);
submitForm('form-produto', 'cadastro', response => { result.textContent = response.message; $('form-produto').reset(); });
submitForm('form-movimentacao', 'registro', response => { result.textContent = response.message; $('form-movimentacao').reset(); });
submitForm('form-categoria', 'categoria');
submitForm('form-percentual', 'porcentagem');
submitForm('form-periodo', 'relatorio-periodo');
submitForm('form-saidas', 'maiores-saidas');
carregarProdutos();
