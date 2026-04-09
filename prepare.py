import json, os, sys

src = 'base.json'
dst = 'db.json'

if not os.path.exists(src):
    print(f"XATO: {src} topilmadi!")
    sys.exit(1)

print("base.json o'qilmoqda (19 MB)...")
with open(src, encoding='utf-8') as f:
    raw = json.load(f)

print(f"  {len(raw):,} ta token topildi. Guruhlanmoqda...")

# Group by SentenceID
groups = {}
for row in raw:
    sid = row['SentenceID']
    if sid not in groups:
        groups[sid] = []
    groups[sid].append(row)

print(f"  {len(groups):,} ta gap topildi. db.json yozilmoqda...")

# Build compact dict: "sentence text" -> {"id": N, "t": [[token,BI,Lemma,Tag,Chunk],...]}
db = {}
for sid, tokens in groups.items():
    def get_token(r):
        v = r.get('token ', '') or r.get('token', '') or ''
        return str(v).strip()

    text = ' '.join(get_token(r) for r in tokens)
    db[text] = {
        "id": sid,
        "t": [
            [
                get_token(r),
                r.get('BI', ''),
                r.get('Lemma', '') or '',
                r.get('Tag', ''),
                r.get('Chunk tag', '')
            ]
            for r in tokens
        ]
    }

with open(dst, 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, separators=(',', ':'))

size_mb = os.path.getsize(dst) / 1024 / 1024
print(f"\nTayyor! db.json yaratildi: {len(db):,} ta gap, {size_mb:.1f} MB")
print("Endi start.bat ni ikki marta bosing!")
