'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Detailed system prompt with exact PDF examples
const SYSTEM_PROMPT = `Sen o'zbek tili constituency parser tizimisan.
Foydalanuvchi o'zbek tilidagi gap beradi.
Sen FAQAT quyidagi JSON formatida javob berasan. Boshqa hech narsa yozma.

=== JAVOB FORMATI ===
{
  "tree": { ...rekursiv daraxt... },
  "tokens": [ ...tokenlar... ]
}

=== DARAXT QOIDALARI ===
Ichki tugun: { "label": "NP", "children": [...] }
Barg tugun (so'z): { "label": "so'z", "pos": "N" }   -- children bo'lmaydi

Ildiz har doim "S" bo'lishi shart.
Tinish belgilari uchun alohida PUNCT tugun yasaladi: {"label":"PUNCT","children":[{"label":".","pos":"PUNCT"}]}

=== CONSTITUENCY TEGLARI (ichki tugunlar) ===
S    — Gap (ildiz, har doim bor)
NP   — Otli birikma     (Dunyoning tarixi, Ali)
VP   — Fe'lli birikma   (Yozib chiqdi, bordi)
ADJP — Sifat birikmasi  (Juda ko'hna, eng yaxshi)
ADVP — Ravish birikmasi (Nihoyatda tez)
PP   — Ko'makchili birikma (Do'stlari bilan)

=== POS TEGLARI (barg tugunlarda "pos" maydoni) ===
N     — Ot       (kitob, tarix, Ali)
JJ    — Sifat    (katta, yaxshi, haqiqiy)
VB    — Fe'l     (bordi, o'qiydi, yozdi)
RR    — Ravish   (tez, sekin, nihoyatda)
PRN   — Olmosh   (men, u, bu, o'zi)
PUNCT — Tinish   (. , ! ? ; :)
MD    — Modal    (kerak, mumkin, lozim, shart)
NUM   — Son      (bir, ikki, uch, 3, 10)
CC    — Bog'lovchi (va, lekin, biroq, ammo, yoki)

=== TOKENS FORMATI ===
Har bir token (so'z va tinish belgisi) uchun:
{
  "sentenceId": 1,
  "tokenId": N,
  "token": "asl so'z",
  "bi": "B yoki I",
  "lemma": "so'zning asosiy shakli",
  "tag": "POS tegi",
  "chunk": "chunk tegi"
}

bi maydoni:  B=birikma boshi, I=birikma davomi
chunk teglari: B-NP, I-NP, B-VP, I-VP, B-ADJP, I-ADJP, B-ADVP, I-ADVP, B-PP, I-PP, O
Tinish belgilari va bog'lovchilar chunk = "O"

=== TO'LIQ MISOL ===
Gap: "Tarix hayotning haqiqiy o'qituvchisidir."

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
        "label": "NP",
        "children": [
          { "label": "hayotning",       "pos": "N"  },
          { "label": "haqiqiy",         "pos": "JJ" },
          { "label": "o'qituvchisidir", "pos": "N"  }
        ]
      },
      {
        "label": "PUNCT",
        "children": [
          { "label": ".", "pos": "PUNCT" }
        ]
      }
    ]
  },
  "tokens": [
    { "sentenceId":1, "tokenId":1, "token":"Tarix",            "bi":"B", "lemma":"tarix",       "tag":"N",     "chunk":"B-NP" },
    { "sentenceId":1, "tokenId":2, "token":"hayotning",        "bi":"B", "lemma":"hayot",        "tag":"N",     "chunk":"B-NP" },
    { "sentenceId":1, "tokenId":3, "token":"haqiqiy",          "bi":"I", "lemma":"haqiqiy",      "tag":"JJ",    "chunk":"I-NP" },
    { "sentenceId":1, "tokenId":4, "token":"o'qituvchisidir",  "bi":"I", "lemma":"o'qituvchi",  "tag":"N",     "chunk":"I-NP" },
    { "sentenceId":1, "tokenId":5, "token":".",                "bi":"B", "lemma":".",             "tag":"PUNCT", "chunk":"O"    }
  ]
}

=== YANA BIR MISOL (murakkab gap) ===
Gap: "Ali cesur kadından yardım aldı."

Javob:
{
  "tree": {
    "label": "S",
    "children": [
      {
        "label": "NP",
        "children": [
          { "label": "Ali", "pos": "N" }
        ]
      },
      {
        "label": "VP",
        "children": [
          {
            "label": "NP",
            "children": [
              { "label": "ADJP", "children": [{ "label": "cesur", "pos": "JJ" }] },
              { "label": "NP",   "children": [{ "label": "kadından", "pos": "N" }] }
            ]
          },
          {
            "label": "VP",
            "children": [
              { "label": "NP",  "children": [{ "label": "yardım", "pos": "N" }] },
              { "label": "VP",  "children": [{ "label": "aldı", "pos": "VB" }] }
            ]
          }
        ]
      },
      {
        "label": "PUNCT",
        "children": [{ "label": ".", "pos": "PUNCT" }]
      }
    ]
  },
  "tokens": [
    { "sentenceId":1, "tokenId":1, "token":"Ali",      "bi":"B", "lemma":"Ali",    "tag":"N",     "chunk":"B-NP" },
    { "sentenceId":1, "tokenId":2, "token":"cesur",    "bi":"B", "lemma":"cesur",  "tag":"JJ",    "chunk":"B-ADJP" },
    { "sentenceId":1, "tokenId":3, "token":"kadından", "bi":"B", "lemma":"kadın",  "tag":"N",     "chunk":"B-NP" },
    { "sentenceId":1, "tokenId":4, "token":"yardım",   "bi":"B", "lemma":"yardım", "tag":"N",     "chunk":"B-NP" },
    { "sentenceId":1, "tokenId":5, "token":"aldı",     "bi":"B", "lemma":"al",     "tag":"VB",    "chunk":"B-VP" },
    { "sentenceId":1, "tokenId":6, "token":".",         "bi":"B", "lemma":".",      "tag":"PUNCT", "chunk":"O"    }
  ]
}

Faqat JSON qaytarasan. Hech qanday izoh yoki tushuntirish yozma.`;

// ─── State ────────────────────────────────────────────────────────────────────

let _suggestions = [];
let _matches     = [];
let _lastText    = '';
let _lastData    = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    // Restore saved key
    const saved = localStorage.getItem('groq_key');
    if (saved) {
        document.getElementById('apiKey').value = saved;
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
    const p = ['gsk_5XBSRxh5FKdy', '0fu5ACS2WGdyb3FY', 'Ire9m4OeGLyXmWvb1IIfo3hm'];
    return p.join('');
}

// ─── Autocomplete (data.txt) ──────────────────────────────────────────────────

async function loadSuggestions() {
    try {
        const res = await fetch('data.txt', { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const raw = await res.text();
        _suggestions = raw.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 5 && !l.startsWith('//'));
        setupAutocomplete();
    } catch { /* data.txt yo'q yoki yetib kelmadi */ }
}

function setupAutocomplete() {
    const input = document.getElementById('inputText');
    const list  = document.getElementById('suggestionList');

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        list.innerHTML = '';
        if (val.length < 3) { list.style.display = 'none'; return; }

        _matches = _suggestions
            .filter(s => s.toLowerCase().startsWith(val) || s.toLowerCase().includes(val))
            .slice(0, 12);

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

// ─── Local cache (localStorage) ───────────────────────────────────────────────

function cacheGet(text) {
    try {
        const db = JSON.parse(localStorage.getItem('cp_db') || '{}');
        return db[text] || null;
    } catch { return null; }
}

function cacheSet(text, data) {
    try {
        const db = JSON.parse(localStorage.getItem('cp_db') || '{}');
        db[text] = data;
        // Keep max 150 entries
        const keys = Object.keys(db);
        if (keys.length > 150) delete db[keys[0]];
        localStorage.setItem('cp_db', JSON.stringify(db));
    } catch {}
}

// ─── Main analysis ────────────────────────────────────────────────────────────

async function startAnalysis() {
    const text = document.getElementById('inputText').value.trim();
    if (!text) { document.getElementById('inputText').focus(); return; }

    const key = getKey();
    if (!key) {
        showErr(
            'Groq API kaliti kiritilmagan!\n' +
            '1. Yuqoridagi "Groq API Key" maydoniga kalitingizni kiriting\n' +
            '2. "Saqlash" tugmasini bosing\n' +
            'Bepul kalit olish: https://console.groq.com'
        );
        return;
    }

    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> TAHLIL QILINMOQDA...';
    hideErr();
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('suggestionList').style.display = 'none';

    try {
        // ── 1. Lokal keshni tekshir ──
        let fromCache = false;
        let data = cacheGet(text);

        // ── 2. Topilmasa — Groq API ga so'rov ──
        if (!data) {
            data = await callGroq(text, key);
            cacheSet(text, data);
        } else {
            fromCache = true;
        }

        _lastText = text;
        _lastData = data;

        // ── 3. Natijani ko'rsat ──
        renderTree(data.tree);
        renderTable(data.tokens);

        const cacheLabel = document.getElementById('cacheLabel');
        cacheLabel.style.display = fromCache ? 'inline-flex' : 'none';

        document.getElementById('resultSection').style.display = 'block';
        setTimeout(() => {
            document.getElementById('resultSection')
                .scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);

    } catch (e) {
        showErr(e.message);
    } finally {
        btn.disabled  = false;
        btn.textContent = 'TAHLILNI BOSHLASH';
    }
}

function clearAll() {
    document.getElementById('inputText').value = '';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('treeBox').innerHTML = '';
    document.getElementById('tableBody').innerHTML = '';
    document.getElementById('suggestionList').style.display = 'none';
    hideErr();
    _lastText = '';
    _lastData = null;
    document.getElementById('inputText').focus();
}

// ─── Groq API ─────────────────────────────────────────────────────────────────

async function callGroq(text, key) {
    let res;
    try {
        res = await fetch(GROQ_URL, {
            method: 'POST',
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
        throw new Error('Tarmoq xatosi. Internet aloqangizni tekshiring.');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error?.message || `HTTP ${res.status}`;
        if (res.status === 401) throw new Error('API kalit noto\'g\'ri yoki muddati o\'tgan. Yangi kalit oling.');
        if (res.status === 429) throw new Error('Juda ko\'p so\'rov. Bir oz kuting va qayta urining.');
        throw new Error('Groq API xato: ' + msg);
    }

    const raw     = await res.json();
    const content = raw.choices?.[0]?.message?.content;
    if (!content) throw new Error('Groq bo\'sh javob qaytardi.');

    let data;
    try {
        data = JSON.parse(content);
    } catch {
        throw new Error('JSON parse xatosi. Qayta urinib ko\'ring.');
    }

    if (!data.tree)   throw new Error('Model javobida "tree" maydoni yo\'q.');
    if (!data.tokens || !data.tokens.length) throw new Error('Model javobida "tokens" maydoni yo\'q.');

    return data;
}

// ─── Constituency Tree (SVG) ──────────────────────────────────────────────────

const NODE_COLORS = {
    S:     '#b91c1c',   // dark red
    NP:    '#1d4ed8',   // blue
    VP:    '#15803d',   // green
    ADJP:  '#7e22ce',   // purple
    ADVP:  '#b45309',   // amber
    PP:    '#0e7490',   // cyan
    PUNCT: '#64748b',   // gray
};

function nodeColor(label) {
    return NODE_COLORS[label] || '#475569';
}

// drawTree() — rekursiv SVG constituency daraxt
function renderTree(tree) {
    const box = document.getElementById('treeBox');
    box.innerHTML = '';
    if (!tree) return;

    // ── Layout parameters ──────────────────────────────────────────────────
    const LEAF_W   = 88;    // horizontal space per leaf
    const LEVEL_H  = 58;    // vertical distance between levels
    const PAD_X    = 44;    // left/right padding
    const PAD_TOP  = 36;    // top padding
    const POS_OFF  = 20;    // y below word for POS tag

    // ── Step 1: assign depth ───────────────────────────────────────────────
    (function setDepth(node, d) {
        node._d = d;
        (node.children || []).forEach(c => setDepth(c, d + 1));
    })(tree, 0);

    // ── Step 2: collect leaves, find maxDepth ──────────────────────────────
    const leaves = [];
    let maxD = 0;
    (function walk(node) {
        if (node.children?.length) {
            node.children.forEach(walk);
        } else {
            leaves.push(node);
            if (node._d > maxD) maxD = node._d;
        }
    })(tree);

    if (!leaves.length) return;

    // ── Step 3: assign x to each leaf, propagate to parents ───────────────
    leaves.forEach((leaf, i) => { leaf._cx = i * LEAF_W + LEAF_W / 2; });

    (function setX(node) {
        if (node.children?.length) {
            node.children.forEach(setX);
            const childX = node.children.map(c => c._cx);
            node._cx = (Math.min(...childX) + Math.max(...childX)) / 2;
        }
    })(tree);

    // ── Step 4: compute SVG dimensions ────────────────────────────────────
    const W = leaves.length * LEAF_W + PAD_X * 2;
    const H = PAD_TOP + maxD * LEVEL_H + POS_OFF + 18;

    const NS  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width',   W);
    svg.setAttribute('height',  H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.cssText = 'display:block;overflow:visible;font-family:Inter,sans-serif';

    const mk = (tag, attrs, txt) => {
        const el = document.createElementNS(NS, tag);
        if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        if (txt != null) el.textContent = txt;
        return el;
    };

    // x/y of a node's label centre
    const nx = n => PAD_X + n._cx;
    const ny = n => PAD_TOP + (n.children?.length ? n._d : maxD) * LEVEL_H;

    const gLines  = mk('g');   // lines drawn first (below labels)
    const gLabels = mk('g');   // labels on top

    // ── Step 5: draw recursively ───────────────────────────────────────────
    (function draw(node) {
        const x      = nx(node);
        const y      = ny(node);
        const isLeaf = !node.children?.length;
        const isRoot = node._d === 0;
        const col    = isLeaf ? '#0f172a' : nodeColor(node.label);

        // Lines from this node to each child
        if (!isLeaf) {
            node.children.forEach(child => {
                const cx = nx(child);
                const cy = ny(child);
                // Line from bottom of parent label → top of child label
                gLines.appendChild(mk('line', {
                    x1: x,  y1: y + 13,
                    x2: cx, y2: cy - 13,
                    stroke:           '#cbd5e1',
                    'stroke-width':   '1.5',
                    'stroke-linecap': 'round',
                }));
                draw(child);
            });
        }

        // Inner node label (S, NP, VP, ...)
        if (!isLeaf) {
            // Subtle background pill
            const labelW = Math.max(isRoot ? 28 : 24, node.label.length * 8 + 12);
            const labelH = isRoot ? 22 : 19;
            gLabels.appendChild(mk('rect', {
                x:      x - labelW / 2,
                y:      y - labelH / 2,
                width:  labelW,
                height: labelH,
                rx:     4,
                fill:   col + '14',
                stroke: col + '55',
                'stroke-width': '1',
            }));
            gLabels.appendChild(mk('text', {
                x, y: y + 5,
                'text-anchor':  'middle',
                'font-size':    isRoot ? '15' : '13',
                'font-weight':  isRoot ? '800' : '700',
                fill: col,
            }, node.label));
        } else {
            // Leaf word
            gLabels.appendChild(mk('text', {
                x, y,
                'text-anchor':       'middle',
                'dominant-baseline': 'middle',
                'font-size':         '13',
                'font-weight':       '600',
                fill: '#0f172a',
            }, node.label));

            // POS tag below word
            if (node.pos) {
                gLabels.appendChild(mk('text', {
                    x,
                    y: y + POS_OFF,
                    'text-anchor':       'middle',
                    'dominant-baseline': 'middle',
                    'font-size':         '10',
                    'font-weight':       '600',
                    'font-family':       'JetBrains Mono, monospace',
                    fill: '#94a3b8',
                }, node.pos));
            }
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
        const biCls = t.bi === 'B' ? 'bi-b' : t.bi === 'I' ? 'bi-i' : 'bi-o';
        const chCls = chunkClass(t.chunk);
        return `<tr>
            <td class="td-id">${esc(t.sentenceId)}</td>
            <td class="td-id">${esc(t.tokenId)}</td>
            <td class="td-token">${esc(t.token)}</td>
            <td><span class="${biCls}">${esc(t.bi)}</span></td>
            <td>${esc(t.lemma)}</td>
            <td><span class="tag-badge">${esc(t.tag)}</span></td>
            <td><span class="chunk-badge ${chCls}">${esc(t.chunk)}</span></td>
        </tr>`;
    }).join('');
}

function chunkClass(chunk) {
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
    }).catch(() => alert('Nusxa olishda xato. Brauzer ruxsatini tekshiring.'));
}

// ─── SVG download ─────────────────────────────────────────────────────────────

function downloadSVG() {
    const svgEl = document.querySelector('#treeBox svg');
    if (!svgEl) { alert('Avval tahlil bajaring!'); return; }

    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = 'text{font-family:Inter,sans-serif}';
    clone.insertBefore(style, clone.firstChild);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width',  clone.getAttribute('width'));
    bg.setAttribute('height', clone.getAttribute('height'));
    bg.setAttribute('fill',   '#fafbfc');
    clone.insertBefore(bg, clone.firstChild);

    const xml  = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = (_lastText || 'tree').slice(0, 30).replace(/[\\/:*?"<>|]/g, '_') + '.svg';
    a.click();
    URL.revokeObjectURL(a.href);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function showErr(msg) {
    const box = document.getElementById('errBox');
    box.textContent = msg;
    box.style.display = 'block';
}

function hideErr() {
    document.getElementById('errBox').style.display = 'none';
}
