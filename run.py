"""
O'zbek Dependency Parser — Local launcher
Frontend (port 3000) + Backend (port 8000) bitta jarayonda
"""

import subprocess
import threading
import time
import webbrowser
import sys
import os
import socket
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT      = os.path.dirname(os.path.abspath(__file__))
BACKEND   = os.path.join(ROOT, 'backend')
FRONT_PORT = 3000
BACK_PORT  = 8000

# ─── Banner ───────────────────────────────────────────────────────────────────

print("""
  ╔═══════════════════════════════════════════╗
  ║   O'zbek Dependency Parser  v2.0          ║
  ║   FastAPI + Stanza NLP                     ║
  ╚═══════════════════════════════════════════╝
""")

# ─── Port tekshirish ──────────────────────────────────────────────────────────

def kill_port(port):
    """Windows: portni ishlatayotgan jarayonni o'ldirish."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(('localhost', port)) != 0:
            return  # port bo'sh, hech narsa qilmasa ham bo'ladi
    try:
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True, text=True
        )
        for line in result.stdout.splitlines():
            if f':{port} ' in line and 'LISTENING' in line:
                pid = line.strip().split()[-1]
                subprocess.run(['taskkill', '/PID', pid, '/F'],
                               capture_output=True)
                print(f'  ✓ Port {port} tozalandi (PID {pid})')
                time.sleep(0.5)
                break
    except Exception:
        pass

kill_port(FRONT_PORT)
kill_port(BACK_PORT)

# ─── 1. Kutubxonalar (requirements.txt) ──────────────────────────────────────

req_file = os.path.join(BACKEND, 'requirements.txt')
print('  [1/3] Kutubxonalar tekshirilmoqda...')
result = subprocess.run(
    [sys.executable, '-m', 'pip', 'install', '-r', req_file, '-q',
     '--disable-pip-version-check'],
    capture_output=True,
)
if result.returncode != 0:
    print('  XATO: kutubxona o\'rnatilmadi!')
    print(result.stderr.decode(errors='replace'))
    input('Enter bosing...')
    sys.exit(1)
print('  ✓ Kutubxonalar tayyor')

# ─── 2. Frontend — ichki HTTP server (thread) ─────────────────────────────────

class _Silent(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def log_error(self, *a):   pass

def _serve_frontend():
    os.chdir(ROOT)
    try:
        server = HTTPServer(('', FRONT_PORT), _Silent)
        server.serve_forever()
    except OSError as e:
        print(f'  XATO: frontend port {FRONT_PORT}: {e}')

print(f'  [2/3] Frontend server ishga tushirilmoqda (:{FRONT_PORT})...')
threading.Thread(target=_serve_frontend, daemon=True).start()
print(f'  ✓ Frontend: http://localhost:{FRONT_PORT}')

# ─── 3. Backend — FastAPI subprocess ─────────────────────────────────────────

print(f'  [3/3] Backend ishga tushirilmoqda (:{BACK_PORT})...')
print( '        (birinchi marta modellar yuklanadi — bir necha daqiqa kerak)')
print()

backend = subprocess.Popen(
    [sys.executable, '-m', 'uvicorn', 'app:app',
     '--host', '0.0.0.0', '--port', str(BACK_PORT)],
    cwd=BACKEND,
)

# ─── Brauzer ──────────────────────────────────────────────────────────────────

time.sleep(2)
webbrowser.open(f'http://localhost:{FRONT_PORT}')

print(f'  ✓ Brauzer ochildi: http://localhost:{FRONT_PORT}')
print(f'  ✓ API docs:        http://localhost:{BACK_PORT}/docs')
print()
print("  Sidebar sariq bo'lsa — model yuklanmoqda (2-5 daqiqa).")
print("  Yashil bo'lgach tahlil boshlash mumkin.")
print()
print("  To'xtatish: Ctrl+C")
print()

# ─── Kutish + To'xtatish ─────────────────────────────────────────────────────

try:
    backend.wait()
    if backend.returncode != 0:
        print(f"\n  Backend xato bilan to'xtadi (kod {backend.returncode}).")
        print("  Yuqoridagi xato xabarini ko'ring.")
except KeyboardInterrupt:
    print("\n  To'xtatilmoqda...")
    backend.terminate()
    try:
        backend.wait(timeout=5)
    except subprocess.TimeoutExpired:
        backend.kill()
    print("  Bajarildi.")
