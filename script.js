'use strict';

// ─── State ────────────────────────────────────────────────────────────────────

let lastTokens        = null;
let lastSentence      = null;
let _suggestions      = [];   // loaded from db.json keys
let _currentMatches   = [];   // filtered for current input

// ─── Auto-detect API URL ──────────────────────────────────────────────────────

function getDefaultApiUrl() {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '') {
        return 'http://localhost:8000';
    }
    // Deployed (Vercel, GitHub Pages, etc.) → HuggingFace Space backend
    return 'https://azizwebdev-uzbek-depparser-api.hf.space';
}

function getApiUrl() {
    return (document.getElementById('apiUrl')?.value || getDefaultApiUrl()).replace(/\/$/, '');
}

function getVersion() {
    return document.getElementById('modelVersion')?.value || 'v8';
}

function escHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Backend status ───────────────────────────────────────────────────────────

async function checkApiStatus() {
    const el  = document.getElementById('apiStatus');
    const url = getApiUrl();
    try {
        const res  = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        if (data.pipeline_ready) {
            el.style.color       = '#00ff88';
            el.style.borderColor = 'rgba(0,255,136,0.2)';
            el.style.background  = 'rgba(0,255,136,0.05)';
            el.textContent       = 'Backend: Tayyor ✓\nModel: Yuklangan ✓';
        } else if (data.error) {
            el.style.color       = '#f87171';
            el.style.borderColor = 'rgba(248,113,113,0.2)';
            el.style.background  = 'rgba(248,113,113,0.05)';
            el.textContent       = `Backend: Xato ✗\n${data.error}`;
        } else {
            el.style.color       = '#facc15';
            el.style.borderColor = 'rgba(250,204,21,0.2)';
            el.style.background  = 'rgba(250,204,21,0.05)';
            el.textContent       = 'Backend: Tayyor ✓\nModel: yuklanmoqda...\n(birinchi marta 2–5 daqiqa)';
        }
    } catch {
        el.style.color       = '#f87171';
        el.style.borderColor = 'rgba(248,113,113,0.2)';
        el.style.background  = 'rgba(248,113,113,0.05)';
        el.textContent       = `Backend: Ulanmadi ✗\n${url}\nrun.py ni ishga tushiring!`;
    }
}

// ─── Suggestions from db.json (keys only — text used, parse via Stanza) ───────

async function loadSuggestions() {
    const statusEl = document.getElementById('apiStatus');
    try {
        const res = await fetch('db.json', { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const db = await res.json();
        _suggestions = Object.keys(db);
        setupAutocomplete();
        // Update status if backend not ready yet
        if (statusEl.textContent.includes('Ulanmadi')) {
            statusEl.textContent += `\n\n${_suggestions.length.toLocaleString()} ta taklif yuklandi`;
        }
    } catch {
        // db.json yo'q (deployed versiyada bo'lmasligi mumkin) — OK
    }
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

function setupAutocomplete() {
    const input = document.getElementById('inputText');
    const list  = document.getElementById('suggestionList');
    if (!list) return;

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        list.innerHTML = '';

        if (val.length < 2 || _suggestions.length === 0) {
            list.style.display = 'none'; return;
        }

        _currentMatches = _suggestions
            .filter(t => t.toLowerCase().includes(val))
            .slice(0, 15);

        if (!_currentMatches.length) { list.style.display = 'none'; return; }

        list.innerHTML = _currentMatches.map((t, i) =>
            `<li onclick="pickSuggestion(${i})">${escHtml(t)}</li>`
        ).join('');
        list.style.display = 'block';
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.input-wrap')) list.style.display = 'none';
    });
}

function pickSuggestion(i) {
    const text = _currentMatches[i];
    if (!text) return;
    document.getElementById('inputText').value = text;
    document.getElementById('suggestionList').style.display = 'none';
    startAnalysis();
}

// ─── Main analysis ────────────────────────────────────────────────────────────

async function startAnalysis() {
    const text = document.getElementById('inputText').value.trim();
    const btn  = document.getElementById('runBtn');
    if (!text) { document.getElementById('inputText').focus(); return; }

    btn.disabled  = true;
    btn.innerHTML = '<span class="loader"></span> TAHLIL QILINMOQDA...';

    try {
        const res = await fetch(`${getApiUrl()}/api/parse`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ text, version: getVersion() }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || `Server xato: ${res.status}`);
        }

        const data = await res.json();
        lastTokens   = data.tokens;
        lastSentence = data.sentence;

        renderTable(data.tokens);
        drawArcDiagram(data.tokens);
        updateStats(data.tokens, data.version);

    } catch (e) {
        console.error('Xatolik:', e);
        showError(e.message);
    } finally {
        btn.disabled  = false;
        btn.innerText = 'TAHLILNI BOSHLASH';
    }
}

function showError(msg) {
    document.getElementById('treeCanvas').innerHTML =
        `<div class="error-msg">
            <strong>Xato:</strong> ${escHtml(msg)}<br>
            <small>Backend ishga tushirilganini tekshiring (run.py) yoki API URL ni tekshiring.</small>
        </div>`;
}

function clearAll() {
    document.getElementById('inputText').value     = '';
    document.getElementById('tableBody').innerHTML  = '';
    document.getElementById('suggestionList').innerHTML = '';
    document.getElementById('suggestionList').style.display = 'none';
    document.getElementById('treeCanvas').innerHTML =
        `<div class="canvas-placeholder"><p>Matn kiriting va "Tahlilni boshlash" tugmasini bosing</p></div>`;
    document.getElementById('statTokens').textContent  = '—';
    document.getElementById('statRoot').textContent    = '—';
    document.getElementById('statVersion').textContent = '—';
    lastTokens = null; lastSentence = null;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function updateStats(tokens, version) {
    const root = tokens.find(t => t.is_root);
    document.getElementById('statTokens').textContent  = tokens.length;
    document.getElementById('statRoot').textContent    = root ? root.text : '—';
    document.getElementById('statVersion').textContent = version || '—';
}

// ─── Colour maps ──────────────────────────────────────────────────────────────

const DEPREL_COLOR = {
    nsubj: '#60a5fa', 'nsubj:pass': '#60a5fa',
    obj:   '#34d399', iobj: '#34d399',
    root:  '#00ff88',
    punct: '#64748b',
    obl:   '#86efac', 'obl:tmod': '#86efac',
    case:  '#fb923c',
    nmod:  '#a78bfa', 'nmod:poss': '#a78bfa',
    advmod:'#facc15',
    advcl: '#fca5a5',
    amod:  '#f87171',
    acl:   '#d8b4fe', 'acl:relcl': '#d8b4fe',
    aux:   '#38bdf8', 'aux:pass': '#38bdf8',
    cop:   '#4ade80',
    mark:  '#fb7185',
    conj:  '#c084fc',
    cc:    '#fdba74',
    det:   '#67e8f9',
    compound: '#f472b6',
    nummod: '#fde68a',
    appos: '#a5f3fc',
    flat:  '#f9a8d4', 'flat:name': '#f9a8d4',
    parataxis: '#fbbf24',
    dislocated: '#e879f9',
    vocative: '#a3e635',
    expl:  '#22d3ee',
    list:  '#818cf8',
    orphan:'#6b7280',
    dep:   '#94a3b8',
};

const UPOS_COLOR = {
    NOUN:  '#a78bfa', PROPN: '#c084fc',
    VERB:  '#34d399', AUX:   '#4ade80',
    ADJ:   '#60a5fa', ADV:   '#facc15',
    PRON:  '#fb923c', DET:   '#fdba74',
    ADP:   '#f472b6', CCONJ: '#e879f9', SCONJ: '#d946ef',
    PART:  '#38bdf8', INTJ:  '#a3e635',
    PUNCT: '#64748b', NUM:   '#fde68a',
    X:     '#94a3b8', SYM:   '#94a3b8',
};

function depColor(d)  { return DEPREL_COLOR[d] || DEPREL_COLOR[d?.split(':')[0]] || '#94a3b8'; }
function uposColor(u) { return UPOS_COLOR[u] || '#94a3b8'; }

// ─── Table ────────────────────────────────────────────────────────────────────

function renderTable(tokens) {
    document.getElementById('tableBody').innerHTML = tokens.map(t => {
        const dc = depColor(t.deprel);
        const uc = uposColor(t.upos);
        return `<tr class="${t.is_root ? 'root-row' : ''}">
            <td class="mono">${t.id}</td>
            <td><strong>${escHtml(t.text)}</strong></td>
            <td class="mono">${escHtml(t.lemma)}</td>
            <td><span class="upos-badge" style="--c:${uc}">${escHtml(t.upos)}</span></td>
            <td><span class="tag-badge">${escHtml(t.upos_uz)}</span></td>
            <td class="mono">${t.is_root ? '0' : t.head}</td>
            <td class="mono">${t.is_root ? '<em style="color:#00ff88">ROOT</em>' : escHtml(t.head_text || '')}</td>
            <td><span class="deprel-badge" style="--c:${dc}">${escHtml(t.deprel)}</span></td>
            <td>${t.is_root ? '<span class="root-badge">ROOT</span>' : ''}</td>
        </tr>`;
    }).join('');
}

function copyTableData(btn) {
    const rows = document.querySelectorAll('#dataTable tr');
    const text = Array.from(rows)
        .map(r => Array.from(r.querySelectorAll('th,td'))
            .map(c => c.innerText.trim()).join('\t'))
        .join('\n');
    navigator.clipboard.writeText(text).then(() => {
        const old = btn.textContent;
        btn.textContent = '✓ Nusxa olindi!';
        setTimeout(() => btn.textContent = old, 1600);
    });
}

// ─── Arc Diagram (SVG) ────────────────────────────────────────────────────────

function drawArcDiagram(tokens) {
    const canvas = document.getElementById('treeCanvas');
    canvas.innerHTML = '';
    if (!tokens?.length) return;

    const n = tokens.length;

    const TOKEN_W = Math.max(75, Math.min(115, Math.floor(850 / n)));
    const PAD_X   = 55;
    const PAD_TOP = 16;
    const ROOT_BOX= 22;
    const ROOT_GAP= 10;
    const WORD_GAP= 18;
    const WORD_H  = 20;
    const POS_H   = 17;
    const IDX_H   = 14;
    const BOT_PAD = 14;

    let maxDist = 0;
    tokens.forEach(t => {
        if (!t.is_root) maxDist = Math.max(maxDist, Math.abs(t.id - t.head));
    });

    const arcH   = dist => 22 + dist * Math.min(40, Math.floor(260 / n));
    const maxArcH= maxDist > 0 ? arcH(maxDist) : 30;

    const ARC_BASE = PAD_TOP + ROOT_BOX + ROOT_GAP + maxArcH;
    const WORD_Y   = ARC_BASE + WORD_GAP;
    const POS_Y    = WORD_Y   + WORD_H;
    const IDX_Y    = POS_Y    + POS_H;

    const W = PAD_X * 2 + (n - 1) * TOKEN_W;
    const H = IDX_Y + IDX_H + BOT_PAD;

    const NS  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width',   W);
    svg.setAttribute('height',  H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.cssText = 'display:block;overflow:visible';

    const mk = (tag, attrs = {}) => {
        const el = document.createElementNS(NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    };

    const tx = id => PAD_X + (id - 1) * TOKEN_W;

    // ── Arcs ─────────────────────────────────────────────────────────────────
    tokens.forEach(t => {
        if (t.is_root) return;

        const x1   = tx(t.id);
        const x2   = tx(t.head);
        const dist = Math.abs(t.id - t.head);
        const peak = ARC_BASE - arcH(dist);
        const mid  = (x1 + x2) / 2;
        const col  = depColor(t.deprel);

        svg.appendChild(mk('path', {
            d:              `M ${x2} ${ARC_BASE} Q ${mid} ${peak} ${x1} ${ARC_BASE}`,
            fill:           'none',
            stroke:         col,
            'stroke-width': '1.8',
            opacity:        '0.85',
        }));

        // Arrowhead at dependent end
        const dx  = x1 - mid;
        const dy  = ARC_BASE - peak;
        const len = Math.hypot(dx, dy) || 1;
        const ux  = dx / len;
        const uy  = dy / len;
        const as  = 5;
        svg.appendChild(mk('polygon', {
            points: `${x1},${ARC_BASE} ` +
                    `${x1 - ux*as*2 - uy*as},${ARC_BASE - uy*as*2 + ux*as} ` +
                    `${x1 - ux*as*2 + uy*as},${ARC_BASE - uy*as*2 - ux*as}`,
            fill: col,
        }));

        // Deprel label
        const lbl = t.deprel;
        const lw  = lbl.length * 6.4 + 10;
        const lh  = 15;
        const lx  = mid - lw / 2;
        const ly  = peak - lh / 2;

        const lblBg = mk('rect', {
            x: lx, y: ly, width: lw, height: lh, rx: '3',
            stroke: col, 'stroke-width': '1', opacity: '0.95',
        });
        lblBg.setAttribute('style', 'fill: var(--canvas-bg, #0d0f11)');
        svg.appendChild(lblBg);

        const lblEl = mk('text', {
            x: mid, y: ly + 11,
            'text-anchor': 'middle', 'font-size': '10',
            'font-family': 'JetBrains Mono, monospace',
            'font-weight': '600', fill: col,
        });
        lblEl.textContent = lbl;
        svg.appendChild(lblEl);
    });

    // ── ROOT indicator ────────────────────────────────────────────────────────
    tokens.forEach(t => {
        if (!t.is_root) return;
        const x = tx(t.id);

        svg.appendChild(mk('line', {
            x1: x, y1: ARC_BASE,
            x2: x, y2: PAD_TOP + ROOT_BOX + 2,
            stroke: '#00ff88', 'stroke-width': '1.8', 'stroke-dasharray': '3,2',
        }));

        const bw = 38, bh = ROOT_BOX;
        svg.appendChild(mk('rect', {
            x: x - bw/2, y: PAD_TOP, width: bw, height: bh, rx: '4',
            fill: 'rgba(0,255,136,0.12)', stroke: '#00ff88', 'stroke-width': '1',
        }));

        const rl = mk('text', {
            x, y: PAD_TOP + 14,
            'text-anchor': 'middle', 'font-size': '10',
            'font-family': 'JetBrains Mono, monospace',
            'font-weight': '700', fill: '#00ff88',
        });
        rl.textContent = 'ROOT';
        svg.appendChild(rl);
    });

    // ── Tokens ────────────────────────────────────────────────────────────────
    tokens.forEach(t => {
        const x    = tx(t.id);
        const uc   = uposColor(t.upos);
        const root = t.is_root;

        const wt = mk('text', {
            x, y: WORD_Y,
            'text-anchor': 'middle', 'font-size': '14',
            'font-family': 'JetBrains Mono, monospace',
            'font-weight': root ? '700' : '600',
            fill: root ? '#00ff88' : 'var(--text, #e2e8f0)',
        });
        wt.textContent = t.text;
        svg.appendChild(wt);

        const pt = mk('text', {
            x, y: POS_Y,
            'text-anchor': 'middle', 'font-size': '10',
            'font-family': 'JetBrains Mono, monospace', fill: uc,
        });
        pt.textContent = t.upos_uz || t.upos;
        svg.appendChild(pt);

        const it = mk('text', {
            x, y: IDX_Y,
            'text-anchor': 'middle', 'font-size': '9',
            'font-family': 'JetBrains Mono, monospace', fill: '#475569',
        });
        it.textContent = t.id;
        svg.appendChild(it);
    });

    canvas.appendChild(svg);
}

// ─── Downloads ────────────────────────────────────────────────────────────────

function downloadSVG() {
    const svgEl = document.querySelector('#treeCanvas svg');
    if (!svgEl) { alert('Avval tahlil bajaring!'); return; }

    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = "text { font-family: 'JetBrains Mono', monospace; }";
    clone.insertBefore(style, clone.firstChild);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%');
    bg.setAttribute('fill', '#0d0f11');
    clone.insertBefore(bg, clone.firstChild);

    triggerDownload(new XMLSerializer().serializeToString(clone), `${safeName()}.svg`, 'image/svg+xml');
}

function downloadPNG() {
    const svgEl = document.querySelector('#treeCanvas svg');
    if (!svgEl) { alert('Avval tahlil bajaring!'); return; }

    const SW = parseInt(svgEl.getAttribute('width'));
    const SH = parseInt(svgEl.getAttribute('height'));
    const SCALE = 2;
    const W = SW * SCALE, H = SH * SCALE;

    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', W); clone.setAttribute('height', H);
    clone.setAttribute('viewBox', `0 0 ${SW} ${SH}`);

    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = "text { font-family: 'JetBrains Mono', monospace; }";
    clone.insertBefore(style, clone.firstChild);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', W); bg.setAttribute('height', H);
    bg.setAttribute('fill', '#0d0f11');
    clone.insertBefore(bg, clone.firstChild);

    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        ctx.fillStyle = '#0d0f11';
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const a = document.createElement('a');
        a.download = `${safeName()}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    };
    img.src = url;
}

async function downloadXLSX() {
    if (!lastTokens) { alert('Avval tahlil bajaring!'); return; }
    try {
        const res = await fetch(`${getApiUrl()}/api/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: lastSentence, tokens: lastTokens }),
        });
        if (!res.ok) throw new Error(`Export xato: ${res.status}`);
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `${safeName()}.xlsx`; a.click();
        URL.revokeObjectURL(url);
    } catch {
        // SheetJS fallback
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(document.getElementById('dataTable'));
        XLSX.utils.book_append_sheet(wb, ws, 'Tahlil');
        XLSX.writeFile(wb, `${safeName()}.xlsx`);
    }
}

function downloadCoNLL() {
    if (!lastTokens) { alert('Avval tahlil bajaring!'); return; }
    const lines = [
        `# text = ${lastSentence}`,
        `# generator = uzbek-dependency-parser`,
    ];
    lastTokens.forEach(t => {
        lines.push(`${t.id}\t${t.text}\t${t.lemma}\t${t.upos}\t_\t_\t${t.head}\t${t.deprel}\t_\t_`);
    });
    lines.push('');
    triggerDownload(lines.join('\n'), `${safeName()}.conllu`, 'text/plain');
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function safeName() {
    return (lastSentence || 'tahlil').slice(0, 28).replace(/[\\/:*?"<>|]/g, '_');
}

function triggerDownload(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function toggleSidebar() {
    document.getElementById('appWrapper').classList.toggle('sidebar-hidden');
}

function toggleCard(id) {
    document.getElementById(id).classList.toggle('collapsed');
}

function toggleTheme() {
    const light = document.body.classList.toggle('light');
    document.getElementById('themeBtn').textContent = light ? '☀️ Light' : '🌙 Dark';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    // Auto-detect and set API URL
    const apiInput = document.getElementById('apiUrl');
    if (apiInput) apiInput.value = getDefaultApiUrl();

    checkApiStatus();
    loadSuggestions();   // db.json dan takliflar yuklash (background)

    // API URL o'zgarganda qayta tekshir
    apiInput?.addEventListener('change', checkApiStatus);

    // Ctrl+Enter bilan tahlil
    document.getElementById('inputText')?.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') startAnalysis();
    });

    // Yuklanish paytida har 5 sek, yuklangandan keyin har 30 sek tekshirish
    const _fast = setInterval(async () => {
        await checkApiStatus();
        const txt = document.getElementById('apiStatus')?.textContent || '';
        if (txt.includes('Yuklangan')) {
            clearInterval(_fast);
            setInterval(checkApiStatus, 30000);
        }
    }, 5000);
});
