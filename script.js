'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Sen o'zbek tili constituency parsing tizimisan.
Foydalanuvchi o'zbek tilidagi gap beradi. Sen FAQAT quyidagi JSON formatida javob berasan — boshqa hech narsa yozma.

JSON format:
{
  "tree": { ... },
  "tokens": [ ... ]
}

"tree" — rekursiv daraxt strukturasi:
  Ichki tugun: { "label": "NP", "children": [...] }
  Barg tugun (so'z): { "label": "so'z", "pos": "N" }
  Barg tugunlarda "children" bo'lmaydi.

Constituency teglari (ichki tugunlar uchun label):
  S    — Gap (har doim ildiz tugun)
  NP   — Otli birikma
  VP   — Fe'lli birikma
  ADJP — Sifat birikmasi
  ADVP — Ravish birikmasi (holli birikma)
  PP   — Ko'makchili birikma

POS teglari (barg tugunlar uchun pos maydoni):
  N     — Ot (noun)
  JJ    — Sifat (adjective)
  VB    — Fe'l (verb)
  RR    — Ravish (adverb)
  PRN   — Olmosh (pronoun)
  PUNCT — Tinish belgisi
  MD    — Modal so'z
  NUM   — Son
  CC    — Bog'lovchi

"tokens" massivi — har bir so'z (tokenizatsiya tartibi bo'yicha):
{
  "sentenceId": 1,
  "tokenId": 1,
  "token": "so'z",
  "bi": "B",
  "lemma": "so'zning_asosiy_shakli",
  "tag": "N",
  "chunk": "B-NP"
}
  bi    : "B" (birikma boshi) yoki "I" (birikma davomi)
  chunk : "B-NP","I-NP","B-VP","I-VP","B-ADJP","I-ADJP","B-ADVP","I-ADVP","B-PP","I-PP","O"
  tag   : yuqoridagi POS teglari

Faqat JSON qaytarasan. Boshqa hech narsa yozma.`;

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    const stored = localStorage.getItem('groq_key');
    if (stored) document.getElementById('apiKey').value = stored;

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
    setTimeout(() => { st.textContent = ''; }, 2000);
}

function getKey() {
    return document.getElementById('apiKey').value.trim()
        || localStorage.getItem('groq_key') || '';
}

// ─── Local cache (localStorage) ───────────────────────────────────────────────

function cacheGet(text) {
    try {
        const c = JSON.parse(localStorage.getItem('cp_cache') || '{}');
        return c[text] || null;
    } catch { return null; }
}

function cacheSet(text, data) {
    try {
        const c = JSON.parse(localStorage.getItem('cp_cache') || '{}');
        c[text] = data;
        const keys = Object.keys(c);
        if (keys.length > 100) delete c[keys[0]];
        localStorage.setItem('cp_cache', JSON.stringify(c));
    } catch {}
}

// ─── Main analysis ────────────────────────────────────────────────────────────

async function startAnalysis() {
    const text = document.getElementById('inputText').value.trim();
    if (!text) { document.getElementById('inputText').focus(); return; }

    const key = getKey();
    if (!key) { showErr('Iltimos, Groq API kalitini kiriting va "Saqlash" tugmasini bosing!'); return; }

    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> Tahlil qilinmoqda...';
    hideErr();
    document.getElementById('cardResult').style.display = 'none';

    try {
        // Check local cache first (offline-first)
        let data = cacheGet(text);
        if (!data) {
            data = await callGroq(text, key);
            cacheSet(text, data);
        }
        renderTree(data.tree);
        renderTable(data.tokens);
        document.getElementById('cardResult').style.display = 'block';
        document.getElementById('cardResult').scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (e) {
        showErr(e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Tahlil qilish';
    }
}

function clearAll() {
    document.getElementById('inputText').value = '';
    document.getElementById('cardResult').style.display = 'none';
    document.getElementById('treeBox').innerHTML = '';
    document.getElementById('tableBody').innerHTML = '';
    hideErr();
    document.getElementById('inputText').focus();
}

// ─── Groq API call ────────────────────────────────────────────────────────────

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
        throw new Error('Tarmoq xatosi. Internet aloqasini tekshiring.');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error?.message || `API xato: ${res.status}`;
        if (res.status === 401) throw new Error('API kalit noto\'g\'ri. Groq kalingizni tekshiring.');
        if (res.status === 429) throw new Error('So\'rov limiti oshdi. Bir oz kuting.');
        throw new Error(msg);
    }

    const raw     = await res.json();
    const content = raw.choices?.[0]?.message?.content;
    if (!content) throw new Error('Groq bo\'sh javob qaytardi.');

    let data;
    try { data = JSON.parse(content); }
    catch { throw new Error('JSON parse xatosi: ' + content.slice(0, 120)); }

    if (!data.tree)   throw new Error('Groq javobida "tree" maydoni yo\'q.');
    if (!data.tokens) throw new Error('Groq javobida "tokens" maydoni yo\'q.');
    return data;
}

// ─── Constituency tree rendering ──────────────────────────────────────────────

function renderTree(tree) {
    const box = document.getElementById('treeBox');
    box.innerHTML = '';

    if (!tree) return;

    // ── Layout constants ──────────────────────────────────────────────────────
    const LEVEL_H  = 65;   // vertical gap between levels
    const LEAF_MIN = 75;
    const LEAF_MAX = 130;
    const PAD_X    = 50;
    const PAD_TOP  = 28;
    const POS_GAP  = 26;   // px below word leaf for POS tag

    // ── Step 1: assign depth to every node ───────────────────────────────────
    (function dep(node, d) {
        node._d = d;
        (node.children || []).forEach(c => dep(c, d + 1));
    })(tree, 0);

    // ── Step 2: collect leaves & compute max depth ────────────────────────────
    const leaves = [];
    let maxD = 0;
    (function walk(node) {
        if (!node.children?.length) {
            leaves.push(node);
            if (node._d > maxD) maxD = node._d;
        } else {
            node.children.forEach(walk);
        }
    })(tree);

    if (!leaves.length) return;

    // ── Step 3: assign x to leaves, propagate up ─────────────────────────────
    const lw = Math.max(LEAF_MIN, Math.min(LEAF_MAX, 860 / leaves.length));
    leaves.forEach((leaf, i) => { leaf._x = i * lw + lw / 2; });

    (function setX(node) {
        if (node.children?.length) {
            node.children.forEach(setX);
            const xs = node.children.map(c => c._x);
            node._x = (Math.min(...xs) + Math.max(...xs)) / 2;
        }
    })(tree);

    // ── Step 4: compute SVG size ──────────────────────────────────────────────
    const W = leaves.length * lw + PAD_X * 2;
    const H = PAD_TOP + maxD * LEVEL_H + 20 + POS_GAP + 14;

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

    // x / y of a node's centre
    const nx = n => PAD_X + n._x;
    const ny = n => PAD_TOP + (n.children?.length ? n._d : maxD) * LEVEL_H;

    // ── Step 5: draw (lines layer first, labels on top) ──────────────────────
    const gLines  = mk('g');
    const gLabels = mk('g');

    (function draw(node) {
        const x      = nx(node);
        const y      = ny(node);
        const isLeaf = !node.children?.length;
        const isRoot = node._d === 0;

        // Lines to children
        if (!isLeaf) {
            node.children.forEach(child => {
                gLines.appendChild(mk('line', {
                    x1: x,       y1: y + 11,
                    x2: nx(child), y2: ny(child) - 11,
                    stroke:           '#cbd5e1',
                    'stroke-width':   '1.8',
                    'stroke-linecap': 'round',
                }));
                draw(child);
            });
        }

        // Node label
        gLabels.appendChild(mk('text', {
            x,
            y,
            'text-anchor':       'middle',
            'dominant-baseline': 'middle',
            'font-family':       'Inter, sans-serif',
            'font-size':         isRoot ? '17' : isLeaf ? '14' : '14',
            'font-weight':       isRoot ? '800' : '700',
            fill: isRoot ? '#dc2626' : isLeaf ? '#1d4ed8' : '#1e40af',
        }, node.label));

        // POS tag below word leaf
        if (isLeaf && node.pos) {
            gLabels.appendChild(mk('text', {
                x,
                y: y + POS_GAP,
                'text-anchor':       'middle',
                'dominant-baseline': 'middle',
                'font-family':       'JetBrains Mono, monospace',
                'font-size':         '11',
                'font-weight':       '600',
                fill: '#94a3b8',
            }, node.pos));
        }
    })(tree);

    svg.appendChild(gLines);
    svg.appendChild(gLabels);
    box.appendChild(svg);
}

// ─── Linguistic table rendering ───────────────────────────────────────────────

function renderTable(tokens) {
    const body = document.getElementById('tableBody');
    body.innerHTML = tokens.map(t => {
        const biCls    = t.bi === 'B' ? 'bi-b' : 'bi-i';
        const chunkCls = getChunkClass(t.chunk);
        return `<tr>
            <td>${esc(t.sentenceId)}</td>
            <td>${esc(t.tokenId)}</td>
            <td><strong>${esc(t.token)}</strong></td>
            <td class="${biCls}">${esc(t.bi)}</td>
            <td>${esc(t.lemma)}</td>
            <td><span class="tag-badge">${esc(t.tag)}</span></td>
            <td><span class="chunk-badge ${chunkCls}">${esc(t.chunk)}</span></td>
        </tr>`;
    }).join('');
}

function getChunkClass(chunk) {
    if (!chunk || chunk === 'O') return 'chunk-o';
    const ph = (chunk.split('-')[1] || '').toUpperCase();
    if (ph === 'NP')   return 'chunk-np';
    if (ph === 'VP')   return 'chunk-vp';
    if (ph === 'ADJP') return 'chunk-adj';
    if (ph === 'ADVP') return 'chunk-adv';
    if (ph === 'PP')   return 'chunk-pp';
    return 'chunk-o';
}

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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
    style.textContent = "text { font-family: Inter, sans-serif; }";
    clone.insertBefore(style, clone.firstChild);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', '#f8fafc');
    clone.insertBefore(bg, clone.firstChild);

    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'constituency_tree.svg';
    a.click();
    URL.revokeObjectURL(a.href);
}

// ─── Error helpers ────────────────────────────────────────────────────────────

function showErr(msg) {
    const box = document.getElementById('errBox');
    box.textContent = 'Xato: ' + msg;
    box.style.display = 'block';
}

function hideErr() {
    document.getElementById('errBox').style.display = 'none';
}
