# Panduan Deployment SOAPI ke VPS (Ubuntu / Debian)

Dokumen ini memuat panduan komprehensif untuk men-deploy seluruh arsitektur **SOAPI (Smart Observation & Clinical Assistant)** ke Virtual Private Server (VPS) produksi.

---

## 1. Arsitektur Sistem Produksi

```
[Browser Klien / Dokter]
          │  (HTTPS :443)
          ▼
   [Nginx Reverse Proxy]
          │
    ┌─────┴───────────────────────────────────────────────────────┐
    │                                                             │
    ▼ (:3000)                                                     ▼ (:8000)
[Node.js TanStack Web App] ──(Internal Proxy)──► [FastAPI Clinical AI]
    │                 │                                     │
    ▼ (:5432)         ▼ (:9000)                             ▼
[PostgreSQL 16]   [S3 Object Storage]             [RAG: ICD9.csv & ICD10]
(Clinical DB)     (Audio Medis)                             │
                                                            ▼
                                                [Google Gemini / OpenAI]
```

---

## 2. Persyaratan VPS (Prerequisites)

- **Sistem Operasi**: Ubuntu 22.04 LTS / 24.04 LTS (disarankan) atau Debian 12.
- **Spesifikasi Minimal**:
  - **CPU**: 2 vCPU
  - **RAM**: Minimal 2 GB (Disarankan 4 GB)
  - **Storage**: 20 GB SSD
- **Akses**: Akses `root` atau user dengan hak akses `sudo`.
- **Domain**: Domain / Subdomain yang A-Record-nya telah diarahkan ke IP publik VPS Anda (contoh: `soapi.klinikanda.com`).

---

## 3. Langkah 1 — Persiapan Server & Firewall

Login ke VPS Anda via SSH:
```bash
ssh root@IP_VPS_ANDA
```

Update repositori dan paket sistem:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw htop
```

Konfigurasi firewall (UFW) untuk keamanan:
```bash
# Izinkan SSH, HTTP, dan HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

---

## 4. Langkah 2 — Instalasi Docker & Docker Compose

Pasang Docker menggunakan script resmi:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Izinkan user saat ini menjalankan docker tanpa sudo (opsional)
sudo usermod -aG docker $USER
```

Verifikasi instalasi:
```bash
docker --version
docker compose version
```

---

## 5. Langkah 3 — Clone Repositori & Konfigurasi `.env`

Clone repositori proyek ke direktori server:
```bash
sudo mkdir -p /var/www/soapi
sudo chown -R $USER:$USER /var/www/soapi
git clone https://github.com/doniwah/doniwah-voice-ai.git /var/www/soapi
cd /var/www/soapi
```

Salin dan sesuaikan file `.env`:
```bash
cp .env.example .env
nano .env
```

Pastikan variabel penting berikut terisi di `.env`:
```env
NODE_ENV=production
PORT=3000

# Kunci API AI (Pilih salah satu atau isi keduanya)
GEMINI_API_KEY=AIzaSy...ContohKunciGeminiAnda
OPENAI_API_KEY=sk-...ContohKunciOpenAIAnda
OPENAI_MODEL=gpt-4o-mini

# Matikan PyTorch lokal berat di VPS (gunakan Fast Lexical BM25 yang instan 10ms)
DISABLE_TORCH_EMBEDDINGS=1

# Kredensial Database PostgreSQL
POSTGRES_USER=soapi_user
POSTGRES_PASSWORD=GantiDenganPasswordSangatKuat123!
POSTGRES_DB=soapi_db
DATABASE_URL=postgresql://soapi_user:GantiDenganPasswordSangatKuat123!@postgres:5432/soapi_db

# Konfigurasi Storage Audio
S3_ENDPOINT=http://s3:9090
S3_BUCKET_NAME=soapi-audio-recordings
FASTAPI_URL=http://backend:8000
```
> Simpan file dengan menekan `Ctrl + O`, lalu `Enter`, dan keluar dengan `Ctrl + X`.

---

## 6. Langkah 4 — Deployment Otomatis (Metode Docker Compose)

Jalankan script deploy otomatis yang sudah disiapkan:
```bash
chmod +x deploy.sh
./deploy.sh
```

Atau jalankan secara manual:
```bash
# Build dan jalankan seluruh container (Postgres, S3, FastAPI Backend, Web App)
docker compose -f docker-compose.prod.yml up -d --build
```

Periksa status container:
```bash
docker compose -f docker-compose.prod.yml ps
```
Semua 4 container (`soapi-postgres`, `soapi-s3`, `soapi-backend`, `soapi-web`) harus berstatus `healthy` atau `Up`.

Uji endpoint backend langsung dari VPS:
```bash
curl http://127.0.0.1:8000/health
```
Respons yang diharapkan:
```json
{
  "status": "healthy",
  "service": "SOAPI FastAPI Clinical AI Backend",
  "ai_configured": true,
  "icd10_csv_loaded": true,
  "icd9_csv_loaded": true,
  "knowledge_base_loaded": true
}
```

---

## 7. Langkah 5 — Konfigurasi Nginx & SSL HTTPS Gratis (Certbot)

Pasang Nginx dan Certbot:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Salin konfigurasi Nginx SOAPI yang telah disiapkan:
```bash
sudo cp nginx/soapi.conf /etc/nginx/sites-available/soapi
sudo nano /etc/nginx/sites-available/soapi
```
> Ganti `your-domain.com` pada file konfigurasi dengan nama domain atau subdomain Anda (misal `rekammedis.faskes.id`).

Aktifkan konfigurasi:
```bash
# Buat symlink ke sites-enabled
sudo ln -sf /etc/nginx/sites-available/soapi /etc/nginx/sites-enabled/

# Hapus konfigurasi default jika ada
sudo rm -f /etc/nginx/sites-enabled/default

# Uji sintaks Nginx
sudo nginx -t
sudo systemctl reload nginx
```

Dapatkan sertifikat SSL otomatis dari Let's Encrypt:
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```
Pilih opsi **Redirect HTTP to HTTPS**. Certbot akan otomatis mengonfigurasi sertifikat dan mengatur auto-renewal tiap 90 hari.

---

## 8. Langkah 6 — Verifikasi Sistem & Monitoring

Buka browser dan akses domain Anda:
- **Aplikasi Web SOAPI**: `https://your-domain.com`
- **Swagger API Docs (Opsional)**: `https://your-domain.com/fastapi/docs`

### Perintah Pemeliharaan Rutin

Melihat log realtime:
```bash
# Log seluruh sistem
docker compose -f docker-compose.prod.yml logs -f

# Log FastAPI AI Backend saja
docker compose -f docker-compose.prod.yml logs -f backend

# Log Web Application saja
docker compose -f docker-compose.prod.yml logs -f web
```

Restart sistem:
```bash
docker compose -f docker-compose.prod.yml restart
```

Update aplikasi setelah perubahan kode:
```bash
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

Backup database PostgreSQL:
```bash
docker exec -t soapi-postgres pg_dump -U soapi_user soapi_db > backup_$(date +%Y%m%d).sql
```
