#!/usr/bin/env python3
"""
Cria o bucket 'arquivos-clientes' no Supabase Storage (executar UMA VEZ).
Requer SUPABASE_SERVICE_KEY no .env.
"""
import sys, os, re, urllib.request, urllib.error, json

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, '.env'))

DB_URL = os.getenv('DATABASE_URL', '')
m = re.search(r'@db\.([a-z0-9]+)\.supabase\.co', DB_URL)
SUPABASE_URL = os.getenv('SUPABASE_URL', f"https://{m.group(1)}.supabase.co" if m else '')
SERVICE_KEY  = os.getenv('SUPABASE_SERVICE_KEY', '')
BUCKET       = 'arquivos-clientes'

if not SERVICE_KEY:
    print("ERRO: SUPABASE_SERVICE_KEY nao definida no .env")
    sys.exit(1)

if not SUPABASE_URL:
    print("ERRO: nao foi possivel determinar a URL do Supabase")
    sys.exit(1)

print(f"Supabase URL : {SUPABASE_URL}")
print(f"Bucket       : {BUCKET}")

payload = json.dumps({"id": BUCKET, "name": BUCKET, "public": False}).encode()
req = urllib.request.Request(
    f"{SUPABASE_URL}/storage/v1/bucket",
    data=payload,
    method='POST',
    headers={
        'Authorization': f'Bearer {SERVICE_KEY}',
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
    },
)
try:
    resp = urllib.request.urlopen(req, timeout=15)
    print(f"OK  Bucket criado: {json.loads(resp.read())}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    if 'already exists' in body or e.code == 409:
        print(f"OK  Bucket ja existe (ignorado): {body}")
    else:
        print(f"ERRO {e.code}: {body}")
        sys.exit(1)
