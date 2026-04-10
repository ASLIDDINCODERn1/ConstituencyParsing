'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Sen o'zbek tili constituency parsing mutaxassisisan.
Foydalanuvchi o'zbek tilidagi gap beradi. Sen FAQAT quyidagi JSON formatida javob berasan. Boshqa hech narsa yozma.

=== MISOL ===
Kirish: "Tarix hayotning haqiqiy o'qituvchisidir."

Javob:
{
  "tree": {
    "label": "S",
    "children": [
      {
        "label": "NP",
        "children": [
          { "label": "Tarix", "pos": "N" }
        ]
      },
      {
        "label": "VP",
        "children": [
          {
            "label": "NP",
            "children": [
              { "label": "hayotning", "pos": "N" },
              { "label": "haqiqiy", "pos": "JJ" },
              { "label": "o'qituvchisidir", "pos": "N" }
            ]
          }
        ]
      },
      { "label": ".", "pos": "PUNCT" }
    ]
  },
  "tokens": [
    { "sentenceId": 1, "tokenId": 1, "token": "Tarix",            "bi": "B", "lemma": "tarix",        "tag": "N",     "chunk": "B-NP" },
    { "sentenceId": 1, "tokenId": 2, "token": "hayotning",        "bi": "B", "lemma": "hayot",        "tag": "N",     "chunk": "B-NP" },
    { "sentenceId": 1, "tokenId": 3, "token": "haqiqiy",          "bi": "I", "lemma": "haqiqiy",      "tag": "JJ",    "chunk": "I-NP" },
    { "sentenceId": 1, "tokenId": 4, "token": "o'qituvchisidir",  "bi": "I", "lemma": "o'qituvchi",   "tag": "N",     "chunk": "I-NP" },
    { "sentenceId": 1, "tokenId": 5, "token": ".",                "bi": "B", "lemma": ".",             "tag": "PUNCT", "chunk": "O"    }
  ]
}
=== MISOL TUGADI ===

QOIDALAR:
1. "tree" — rekursiv daraxt. Ildiz har doim S.
   - Ichki tugun: { "label": "NP", "children": [...] }
   - Barg tugun (so'z): { "label": "so'z", "pos": "TAG" }  — children YO'Q
2. "tokens" — gapning har bir so'zi va tinish belgisi tartib bo'yicha.
3. Constituency teglari (ichki tugunlar): S, NP, VP, ADJP, ADVP, PP
4. POS teglari (barg pos maydoni):
   N=Ot, JJ=Sifat, VB=Fe'l, RR=Ravish, PRN=Olmosh, PUNCT=Tinish, MD=Modal, NUM=Son, CC=Bog'lovchi
5. chunk maydoni: B-NP, I-NP, B-VP, I-VP, B-ADJP, I-ADJP, B-ADVP, I-ADVP, B-PP, I-PP, O
6. bi maydoni: B (birikma boshi), I (birikma davomi)
7. Tinish belgilarini ham tree va tokens ga qo'sh.
8. FAQAT JSON qaytarasan. Izoh yozma.`;

// ─── State ────────────────────────────────────────────────────────────────────

let _suggestions = [];
let _matches     = [];
let _lastData    = null;
let _lastText    = '';

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    const stored = localStorage.getItem('groq_key');
    if (stored) {
        document.getElementById('apiKey').value = stored;
        document.getElementById('keyStatus').textContent = '✓ Saqlangan';
    }

    loadSuggestions();

    document.getElementById('inputText').addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') startAnalysis();
    });
});

// ─── API key ──────────────────────────────────────────────────────────────────

function saveKey() {
    const key = document.getElementById('apiKey').value.trim();
    if (!key) return;
    localStorage.setItem('groq_key', key);
    const st = document.getElementById('keyStatus');
    st.textContent = '✓ Saqlandi';
    st.style.color = '#4ade80';
}

function getKey() {
    return document.getElementById('apiKey').value.trim()
        || localStorage.getItem('groq_key') || '';
}

// ─── Autocomplete from data.txt ───────────────────────────────────────────────

async function loadSuggestions() {
    try {
        const res = await fetch('data.txt', { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const text = await res.text();
        _suggestions = text.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 4);
        setupAutocomplete();
    } catch { /* data.txt yo'q — ok */ }
}

function setupAutocomplete() {
    const input = document.getElementById('inputText');
    const list  = document.getElementById('suggestionList');
    if (!list) return;

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        list.innerHTML = '';
        if (val.length < 3 || !_suggestions.length) { list.style.display = 'none'; return; }

        _matches = _suggestions.filter(s => s.toLowerCase().includes(val)).slice(0, 12);
        if (!_matches.length) { list.style.display = 'none'; return; }

        list.innerHTML = _matches.map((s, i) =>
            `<li onclick="pickSuggestion(${i})">${esc(s)}</li>`).join('');
        list.style.display = 'block';
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.input-wrap')) list.style.display = 'none';
    });
}

function pickSuggestion(i) {
    const s = _matches[i];
    if (!s) return;
    document.getElementById('inputText').value = s;
    document.getElementById('suggestionList').style.display = 'none';
    startAnalysis();
}

// ─── Local cache ──────────────────────────────────────────────────────────────

function cacheGet(text) {
    try {
        return JSON.parse(localStorage.getItem('cp_cache') || '{}')[text] || null;
    } catch { return null; }
}

function cacheSet(text, data) {
    try {
        const c = JSON.parse(localStorage.getItem('cp_cache') || '{}');
        c[text] = data;
        const keys = Object.keys(c);
        if (keys.length > 120) delete c[keys[0]];
        localStorage.setItem('cp_cache', JSON.stringify(c));
    } catch {}
}

// ─── Main analysis ────────────────────────────────────────────────────────────

async function startAnalysis() {
    const text = document.getElementById('inputText').value.trim();
    if (!text) { document.getElementById('inputText').focus(); return; }

    const key = getKey();
    if (!key) {
        showErr('Groq API kalitini kiriting va "Saqlash" tugmasini bosing.\n' +
                'Bepul kalit olish: https://console.groq.com');
        return;
    }

    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> Tahlil qilinmoqda...';
    hideErr();
    document.getElementById('cardResult').style.display = 'none';
    document.getElementById('suggestionList').style.display = 'none';

    try {
        let data = cacheGet(text);
        if (data) {
            renderAll(data, text);
        } else {
            data = await callGroq(text, key);
            cacheSet(text, data);
            renderAll(data, text);
        }
    } catch (e) {
        showErr(e.message);
    } finally {
        btn.disabled  = false;
        btn.textContent = 'Tahlil qilish';
    }
}

function renderAll(data, text) {
    _lastData = data;
    _lastText = text;
    renderTree(data.tree);
    renderTable(data.tokens);
    document.getElementById('cardResult').style.display = 'block';
    setTimeout(() => {
        document.getElementById('cardResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
}

function clearAll() {
    document.getElementById('inputText').value = '';
    document.getElementById('cardResult').style.display = 'none';
    document.getElementById('treeBox').innerHTML = '';
    document.getElementById('tableBody').innerHTML = '';
    document.getElementById('suggestionList').style.display = 'none';
    hideErr();
    _lastData = null;
    _lastText = '';
    document.getElementById('inputText').focus();
}

// ─── Groq API ─────────────────────────────────────────────────────────────────

async function callGroq(text, key) {
    let res;
    try {
        res = await fetch(GROQ_URL, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model:           GROQ_MODEL,
                temperature:     0.0,
                seed:            12345,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user',   content: `Gap: "${text}"` },
                ],
            }),
        });
    } catch {
        throw new Error('Tarmoq xatosi. Internet aloqasini tekshiring.');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error?.message || `API xato: ${res.status}`;
        if (res.status === 401) throw new Error('API kalit noto\'g\'ri yoki muddati o\'tgan.');
        if (res.status === 429) throw new Error('So\'rovlar juda ko\'p. Bir oz kuting.');
        throw new Error(msg);
    }

    const raw     = await res.json();
    const content = raw.choices?.[0]?.message?.content;
    if (!content) throw new Error('Groq bo\'sh javob qaytardi.');

    let data;
    try { data = JSON.parse(content); }
    catch { throw new Error('JSON parse xatosi. Qayta urinib ko\'ring.'); }

    if (!data.tree)   throw new Error('Javobda "tree" yo\'q.');
    if (!data.tokens) throw new Error('Javobda "tokens" yo\'q.');
    return data;
}

// ─── Constituency Tree (SVG) ──────────────────────────────────────────────────

const NODE_COLORS = {
    S:    '#dc2626',  // red  — root
    NP:   '#1d4ed8',  // blue
    VP:   '#16a34a',  // green
    ADJP: '#9333ea',  // purple
    ADVP: '#d97706',  // amber
    PP:   '#0891b2',  // cyan
};
const LEAF_COLOR   = '#0f172a';  // word text
const POS_COLOR    = '#64748b';  // pos tag below word
const LINE_COLOR   = '#cbd5e1';

function nodeColor(label) {
    return NODE_COLORS[label] || '#475569';
}

function renderTree(tree) {
    const box = document.getElementById('treeBox');
    box.innerHTML = '';
    if (!tree) return;

    // ── Constants ──
    const LEVEL_H = 62;
    const LEAF_W  = 82;
    const PAD_X   = 40;
    const PAD_TOP = 32;
    const POS_DY  = 20;   // gap between word and pos tag

    // ── Assign depth ──
    (function d(n, depth) {
        n._d = depth;
        (n.children || []).forEach(c => d(c, depth + 1));
    })(tree, 0);

    // ── Collect leaves & max depth ──
    const leaves = [];
    let maxD = 0;
    (function walk(n) {
        if (!n.children?.length) { leaves.push(n); if (n._d > maxD) maxD = n._d; }
        else n.children.forEach(walk);
    })(tree);

    if (!leaves.length) return;

    // ── Assign X to leaves, propagate up ──
    leaves.forEach((leaf, i) => { leaf._cx = i * LEAF_W + LEAF_W / 2; });

    (function setX(n) {
        if (n.children?.length) {
            n.children.forEach(setX);
            const xs = n.children.map(c => c._cx);
            n._cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        }
    })(tree);

    // ── SVG size ──
    const W = leaves.length * LEAF_W + PAD_X * 2;
    const H = PAD_TOP + maxD * LEVEL_H + POS_DY + 18 + 10;

    const NS  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width',   W);
    svg.setAttribute('height',  H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.cssText = 'display:block;overflow:visible';

    const mk = (tag, attrs, txt) => {
        const el = document.createElementNS(NS, tag);
        if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        if (txt != null) el.textContent = txt;
        return el;
    };

    // x/y helpers — leaves always at bottom row
    const nx  = n => PAD_X + n._cx;
    const ny  = n => PAD_TOP + (n.children?.length ? n._d : maxD) * LEVEL_H;

    const gLines  = mk('g');
    const gLabels = mk('g');

    (function draw(n) {
        const x      = nx(n);
        const y      = ny(n);
        const isLeaf = !n.children?.length;
        const isRoot = n._d === 0;
        const col    = isLeaf ? LEAF_COLOR : nodeColor(n.label);

        // Lines to children
        if (!isLeaf) {
            n.children.forEach(child => {
                gLines.appendChild(mk('line', {
                    x1: x,       y1: y + 12,
                    x2: nx(child), y2: ny(child) - 12,
                    stroke: LINE_COLOR, 'stroke-width': '1.6', 'stroke-linecap': 'round',
                }));
                draw(child);
            });
        }

        // Node label background circle for inner nodes
        if (!isLeaf) {
            const r = isRoot ? 15 : 12;
            gLabels.appendChild(mk('circle', {
                cx: x, cy: y, r,
                fill:         col + '18',
                stroke:       col,
                'stroke-width': '1.5',
            }));
        }

        // Label text
        gLabels.appendChild(mk('text', {
            x, y: y + (isLeaf ? 0 : 4),
            'text-anchor':       'middle',
            'dominant-baseline': isLeaf ? 'middle' : 'auto',
            'font-family':       'Inter, sans-serif',
            'font-size':         isRoot ? '15' : isLeaf ? '13' : '12',
            'font-weight':       isRoot ? '800' : isLeaf ? '600' : '700',
            fill: col,
        }, n.label));

        // POS tag below leaf word
        if (isLeaf && n.pos) {
            gLabels.appendChild(mk('text', {
                x, y: y + POS_DY,
                'text-anchor':       'middle',
                'dominant-baseline': 'middle',
                'font-family':       'JetBrains Mono, monospace',
                'font-size':         '10',
                'font-weight':       '600',
                fill: POS_COLOR,
            }, n.pos));
        }
    })(tree);

    svg.appendChild(gLines);
    svg.appendChild(gLabels);
    box.appendChild(svg);
}

// ─── Linguistic table ─────────────────────────────────────────────────────────

function renderTable(tokens) {
    const body = document.getElementById('tableBody');
    body.innerHTML = tokens.map(t => {
        const biClass    = t.bi === 'B' ? 'bi-b' : t.bi === 'I' ? 'bi-i' : 'bi-o';
        const chunkClass = chunkCls(t.chunk);
        return `<tr>
            <td class="cell-center">${esc(t.sentenceId)}</td>
            <td class="cell-center">${esc(t.tokenId)}</td>
            <td class="cell-token">${esc(t.token)}</td>
            <td class="cell-center"><span class="${biClass}">${esc(t.bi)}</span></td>
            <td>${esc(t.lemma)}</td>
            <td><span class="tag-badge">${esc(t.tag)}</span></td>
            <td><span class="chunk-badge ${chunkClass}">${esc(t.chunk)}</span></td>
        </tr>`;
    }).join('');
}

function chunkCls(chunk) {
    if (!chunk || chunk === 'O') return 'chunk-o';
    const ph = (chunk.split('-')[1] || '').toUpperCase();
    if (ph === 'NP')   return 'chunk-np';
    if (ph === 'VP')   return 'chunk-vp';
    if (ph === 'ADJP') return 'chunk-adj';
    if (ph === 'ADVP') return 'chunk-adv';
    if (ph === 'PP')   return 'chunk-pp';
    return 'chunk-o';
}

// ─── Copy table ───────────────────────────────────────────────────────────────

function copyTable(btn) {
    const rows = document.querySelectorAll('#lingTable tr');
    const text = Array.from(rows)
        .map(r => Array.from(r.querySelectorAll('th,td'))
            .map(c => c.innerText.trim()).join('\t'))
        .join('\n');
    navigator.clipboard.writeText(text).then(() => {
        const old = btn.textContent;
        btn.textContent = '✓ Nusxa olindi!';
        setTimeout(() => { btn.textContent = old; }, 1800);
    }).catch(() => alert('Nusxa olishda xato!'));
}

// ─── SVG download ─────────────────────────────────────────────────────────────

function downloadSVG() {
    const svgEl = document.querySelector('#treeBox svg');
    if (!svgEl) { alert('Avval tahlil bajaring!'); return; }

    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = "text{font-family:Inter,sans-serif}";
    clone.insertBefore(style, clone.firstChild);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%');
    bg.setAttribute('fill', '#f8fafc');
    clone.insertBefore(bg, clone.firstChild);

    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const name = (_lastText || 'tree').slice(0, 30).replace(/[\\/:*?"<>|]/g, '_');
    a.download = `${name}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showErr(msg) {
    const box = document.getElementById('errBox');
    box.innerHTML = esc(msg).replace(/\n/g, '<br>');
    box.style.display = 'block';
}

function hideErr() {
    document.getElementById('errBox').style.display = 'none';
}
