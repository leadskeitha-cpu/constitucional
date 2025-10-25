/* eslint-disable no-console */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const store = {
  raw: [], // { username, text, id? }
  filtered: [],
  winners: [],
  token: localStorage.getItem('ig_token') || '',
};

const els = {
  statTotal: $('#statTotal'),
  statElegiveis: $('#statElegiveis'),
  statExcluidos: $('#statExcluidos'),
  fileInput: $('#fileInput'),
  rawPaste: $('#rawPaste'),
  btnParsePaste: $('#btnParsePaste'),
  btnLimpar: $('#btnLimpar'),
  btnAplicarRegras: $('#btnAplicarRegras'),
  keyword: $('#keyword'),
  matchAll: $('#matchAll'),
  caseSensitive: $('#caseSensitive'),
  minMentions: $('#minMentions'),
  distinctMentions: $('#distinctMentions'),
  maxEntries: $('#maxEntries'),
  blacklist: $('#blacklist'),
  eligibleList: $('#eligibleList'),
  btnSortear: $('#btnSortear'),
  wheelInner: $('#wheelInner'),
  winnerBox: $('#winnerBox'),
  winnerUser: $('#winnerUser'),
  winnerComment: $('#winnerComment'),
  resultsList: $('#resultsList'),
  overlay: $('#overlay'),
  loadingText: $('#loadingText'),
  btnExportCsv: $('#btnExportCsv'),
  btnExportJson: $('#btnExportJson'),
  btnClearResults: $('#btnClearResults'),
  postUrl: $('#postUrl'),
  btnFetch: $('#btnFetch'),
  accessToken: $('#accessToken'),
  btnSaveToken: $('#btnSaveToken'),
};

function setLoading(on, text = 'Carregando…') {
  els.loadingText.textContent = text;
  els.overlay.classList.toggle('hidden', !on);
}

function updateStats() {
  els.statTotal.textContent = store.raw.length.toString();
  const excluded = store.raw.length - store.filtered.length;
  els.statElegiveis.textContent = store.filtered.length.toString();
  els.statExcluidos.textContent = excluded.toString();
}

function renderEligible() {
  els.eligibleList.innerHTML = '';
  const frag = document.createDocumentFragment();
  const counts = new Map();
  for (const c of store.filtered) {
    counts.set(c.username, (counts.get(c.username) || 0) + 1);
  }
  const byUser = [...counts.entries()].sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
  for (const [user, qty] of byUser) {
    const div = document.createElement('div');
    div.className = 'item';
    const u = document.createElement('span'); u.textContent = `@${user}`;
    const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = `${qty} entr.`;
    div.append(u, chip);
    frag.appendChild(div);
  }
  els.eligibleList.appendChild(frag);
}

function normalizeUsername(s) {
  return (s||'').trim().replace(/^@+/, '').toLowerCase();
}

function parseMentions(text) {
  const mentions = new Set();
  const regex = /@([A-Za-z0-9_\.]+)/g; // Instagram username charset
  let m;
  while ((m = regex.exec(text))) {
    mentions.add(normalizeUsername(m[1]));
  }
  return [...mentions];
}

function applyRules() {
  const keywordRaw = els.keyword.value.trim();
  const matchAll = els.matchAll.checked;
  const caseSensitive = els.caseSensitive.checked;
  const minMentions = parseInt(els.minMentions.value || '0', 10);
  const distinctMentions = els.distinctMentions.checked;
  const maxEntries = Math.max(1, parseInt(els.maxEntries.value || '1', 10));
  const black = new Set((els.blacklist.value || '').split(/\r?\n/).map(normalizeUsername).filter(Boolean));

  const keywords = keywordRaw ? keywordRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];

  const filtered = [];
  const entriesPerUser = new Map();

  for (const item of store.raw) {
    const user = normalizeUsername(item.username);
    if (!user || black.has(user)) continue;

    // keyword rule
    if (keywords.length) {
      const hay = caseSensitive ? item.text : item.text.toLowerCase();
      const ks = caseSensitive ? keywords : keywords.map(k => k.toLowerCase());
      const checks = ks.map(k => hay.includes(k));
      const ok = matchAll ? checks.every(Boolean) : checks.some(Boolean);
      if (!ok) continue;
    }

    // mentions rule
    const mentions = parseMentions(item.text);
    const mentionCount = distinctMentions ? mentions.length : (item.text.match(/@([A-Za-z0-9_\.]+)/g) || []).length;
    if (mentionCount < minMentions) continue;

    const curr = entriesPerUser.get(user) || 0;
    if (curr >= maxEntries) continue;

    entriesPerUser.set(user, curr + 1);
    filtered.push({ username: user, text: item.text, id: item.id });
  }

  store.filtered = filtered;
  updateStats();
  renderEligible();
  renderWheelNames();
}

function renderWheelNames() {
  const names = [...new Set(store.filtered.map(c => '@' + c.username))];
  if (names.length === 0) {
    els.wheelInner.innerHTML = '<div class="placeholder">Carregue comentários e aplique as regras para sortear</div>';
    return;
  }
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
  grid.style.gap = '10px';
  grid.style.width = '100%';
  grid.style.alignItems = 'center';
  grid.style.justifyItems = 'center';
  for (const n of names) {
    const chip = document.createElement('div');
    chip.textContent = n;
    chip.style.padding = '8px 10px';
    chip.style.borderRadius = '999px';
    chip.style.background = 'linear-gradient(180deg, rgba(246,226,122,.18), rgba(212,175,55,.12))';
    chip.style.border = '1px solid rgba(212,175,55,.35)';
    chip.style.fontWeight = '600';
    chip.style.color = '#fff';
    grid.appendChild(chip);
  }
  els.wheelInner.innerHTML = '';
  els.wheelInner.appendChild(grid);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function drawAnimated() {
  if (store.filtered.length === 0) {
    alert('Não há participantes elegíveis.');
    return;
  }
  // Build a ticker of names for suspense
  const pool = store.filtered.map(c => c.username);
  const ticker = shuffle([...pool, ...pool, ...pool]);

  const box = document.createElement('div');
  box.style.display = 'flex';
  box.style.gap = '8px';
  box.style.flexWrap = 'wrap';
  box.style.alignItems = 'center';
  box.style.justifyContent = 'center';
  box.style.width = '100%';

  const chips = ticker.map((u) => {
    const d = document.createElement('div');
    d.textContent = '@' + u;
    d.style.padding = '8px 10px';
    d.style.borderRadius = '999px';
    d.style.background = 'linear-gradient(180deg, rgba(246,226,122,.18), rgba(212,175,55,.12))';
    d.style.border = '1px solid rgba(212,175,55,.35)';
    d.style.fontWeight = '600';
    d.style.color = '#fff';
    d.style.opacity = '0.35';
    d.style.transform = 'scale(0.95)';
    box.appendChild(d);
    return d;
  });

  els.wheelInner.innerHTML = '';
  els.wheelInner.appendChild(box);

  const duration = 3000 + Math.random()*1500; // 3-4.5s suspense
  const highlightIdx = Math.floor(Math.random() * chips.length);

  const start = performance.now();
  function frame(now) {
    const t = now - start;
    const progress = Math.min(1, t / duration);
    const index = Math.floor(progress * (chips.length - 1));
    chips.forEach((c, i) => {
      const active = i === index;
      c.style.opacity = active ? '1' : '0.35';
      c.style.transform = active ? 'scale(1.08)' : 'scale(0.95)';
      c.style.boxShadow = active ? '0 0 0 1px rgba(246,226,122,.55), 0 8px 20px rgba(0,0,0,.35)' : 'none';
    });

    if (t < duration) {
      requestAnimationFrame(frame);
    } else {
      const winnerIdx = highlightIdx % store.filtered.length;
      const winner = store.filtered[winnerIdx];
      onWinner(winner);
    }
  }
  requestAnimationFrame(frame);
}

function onWinner(win) {
  els.winnerBox.classList.remove('hidden');
  els.winnerUser.textContent = '@' + win.username;
  els.winnerComment.textContent = win.text;
  store.winners.push({ time: new Date().toISOString(), ...win });
  renderResults();
  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#f6e27a','#d4af37','#ffffff'] });
}

function renderResults() {
  els.resultsList.innerHTML = '';
  for (const r of store.winners.slice().reverse()) {
    const row = document.createElement('div');
    row.className = 'res';
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'Vencedor';
    const u = document.createElement('strong'); u.textContent = '@' + r.username;
    const c = document.createElement('span'); c.style.color = '#9aa3b2'; c.textContent = ' – ' + r.text;
    const t = document.createElement('span'); t.style.marginLeft = 'auto'; t.style.color = '#9aa3b2'; t.style.fontSize = '12px'; t.textContent = new Date(r.time).toLocaleString();
    row.append(tag, u, c, t);
    els.resultsList.appendChild(row);
  }
}

// Importers
async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const idxUser = headers.indexOf('username');
  const idxComment = headers.indexOf('comment');
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const username = (cols[idxUser] || '').trim();
    const text = (cols[idxComment] || '').trim();
    if (username && text) out.push({ username, text });
  }
  return out;
}

function parseRawPasted(text) {
  const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const items = [];
  for (const row of rows) {
    const m = row.match(/^([^:]+):\s*(.+)$/);
    if (m) items.push({ username: m[1].trim(), text: m[2].trim() });
    else if (row.startsWith('@')) items.push({ username: row.replace(/^@+/, '').trim(), text: '' });
    else items.push({ username: row.trim(), text: '' });
  }
  return items;
}

function ingestItems(items) {
  const normalized = items
    .map(it => ({ username: normalizeUsername(it.username), text: String(it.text||'') }))
    .filter(it => it.username);
  store.raw = normalized;
  store.filtered = normalized.slice();
  updateStats();
  renderEligible();
  renderWheelNames();
}

// Instagram Graph API (simple helper)
async function fetchInstagramComments() {
  const url = els.postUrl.value.trim();
  if (!url) { alert('Informe o link do post.'); return; }
  if (!store.token) { alert('Informe e salve um Access Token válido para usar a API.'); return; }
  try {
    setLoading(true, 'Buscando post…');
    // Resolve URL to media via oEmbed to get media_id
    const oembedUrl = `https://graph.facebook.com/v20.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${encodeURIComponent(store.token)}`;
    const oembed = await fetch(oembedUrl).then(r => r.json());
    if (!oembed || !oembed.media_id) throw new Error('Não foi possível obter media_id via oEmbed.');

    setLoading(true, 'Buscando comentários…');
    const commentsUrl = `https://graph.facebook.com/v20.0/${oembed.media_id}/comments?fields=username,text&limit=500&access_token=${encodeURIComponent(store.token)}`;
    const all = [];
    let nextUrl = commentsUrl;
    while (nextUrl) {
      const res = await fetch(nextUrl).then(r => r.json());
      if (res.error) throw new Error(res.error.message || 'Erro API');
      const data = (res.data || []).map(d => ({ username: d.username, text: d.text || '', id: d.id }));
      all.push(...data);
      nextUrl = res.paging && res.paging.next ? res.paging.next : null;
      if (all.length > 5000) break; // safety
    }
    ingestItems(all);
  } catch (err) {
    console.error(err);
    alert('Falha ao buscar comentários: ' + err.message);
  } finally {
    setLoading(false);
  }
}

// Export helpers
function exportCSV() {
  const rows = [['time','username','comment']]
    .concat(store.winners.map(w => [w.time, '@'+w.username, w.text.replace(/\n/g,' ')]));
  const csv = rows.map(r => r.map(field => '"' + String(field).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'resultados_grupo_keitha.csv';
  a.click();
}
function exportJSON() {
  const blob = new Blob([JSON.stringify(store.winners, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'resultados_grupo_keitha.json';
  a.click();
}

// Wire events
function wire() {
  els.fileInput.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const text = await readFileAsText(f);
      let items = [];
      if (f.name.endsWith('.csv')) items = parseCSV(text);
      else if (f.name.endsWith('.json')) items = JSON.parse(text).map(o => ({ username: o.username || o.user || o.author || '', text: o.text || o.comment || '' }));
      ingestItems(items);
    } catch (err) {
      alert('Falha ao ler arquivo: ' + err.message);
    } finally {
      e.target.value = '';
    }
  });
  els.btnParsePaste.addEventListener('click', () => {
    const txt = els.rawPaste.value.trim();
    if (!txt) return;
    ingestItems(parseRawPasted(txt));
  });
  els.btnLimpar.addEventListener('click', () => {
    store.raw = []; store.filtered = []; updateStats(); renderEligible(); renderWheelNames();
  });
  els.btnAplicarRegras.addEventListener('click', applyRules);
  els.btnSortear.addEventListener('click', drawAnimated);

  els.btnExportCsv.addEventListener('click', exportCSV);
  els.btnExportJson.addEventListener('click', exportJSON);
  els.btnClearResults.addEventListener('click', () => { store.winners = []; renderResults(); });

  els.btnFetch.addEventListener('click', fetchInstagramComments);
  els.btnSaveToken.addEventListener('click', () => {
    store.token = els.accessToken.value.trim();
    if (store.token) {
      localStorage.setItem('ig_token', store.token);
      alert('Token salvo localmente no navegador.');
    } else {
      localStorage.removeItem('ig_token');
      alert('Token removido.');
    }
  });
}

wire();
updateStats();
