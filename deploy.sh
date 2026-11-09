#!/usr/bin/env bash
# ==============================================================================
# SOAPI Clinical AI — One-Click VPS Deployment Script
# ==============================================================================
set -euo pipefail

echo "============================================================"
echo "  🚀 MEMULAI DEPLOYMENT SOAPI CLINICAL AI KE VPS"
echo "============================================================"

# 1. Periksa file .env
if [ ! -f .env ]; then
  echo "⚠️ File .env tidak ditemukan!"
  if [ -f .env.example ]; then
    echo "📋 Menyalin .env.example ke .env..."
    cp .env.example .env
    echo "❗ Silakan edit file .env dan masukkan GEMINI_API_KEY / OPENAI_API_KEY Anda:"
    echo "   nano .env"
    exit 1
  else
    echo "❌ File .env.example tidak ditemukan. Buat file .env terlebih dahulu."
    exit 1
  fi
fi

# 2. Periksa dependensi Docker & Docker Compose
if ! command -v docker &> /dev/null; then
  echo "❌ Docker belum terpasang di VPS ini. Silakan pasang Docker terlebih dahulu:"
  echo "   curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
  exit 1
fi

DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null; then
  DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE_CMD="docker-compose"
else
  echo "❌ Docker Compose belum terpasang."
  exit 1
fi

echo "✅ Docker terdeteksi: $(${DOCKER_COMPOSE_CMD} version)"

# 3. Jalankan Build & Up Container
echo "🔨 Membangun image & menjalankan container produksi..."
${DOCKER_COMPOSE_CMD} -f docker-compose.prod.yml down --remove-orphans || true
${DOCKER_COMPOSE_CMD} -f docker-compose.prod.yml up -d --build

# 4. Tunggu container aktif
echo "⏳ Menunggu container siap dan sehat (10 detik)..."
sleep 10

# 5. Status container
echo "📊 Status Container:"
${DOCKER_COMPOSE_CMD} -f docker-compose.prod.yml ps

# 6. Uji Endpoint Backend FastAPI
echo "🔍 Menguji kesehatan FastAPI Backend (port 8000)..."
if curl -s http://127.0.0.1:8000/health | grep -q '"status":"healthy"'; then
  echo "✅ FastAPI Backend SEHAT & AKTIF!"
else
  echo "⚠️ FastAPI belum merespons /health, cek log: docker logs soapi-backend"
fi

# 7. Uji Web Application
echo "🔍 Menguji Web Frontend (port 3000)..."
if curl -s -I http://127.0.0.1:3000 | grep -E -q "HTTP/1.1 (200|302|301|307|308)"; then
  echo "✅ Web Application SEHAT & AKTIF!"
else
  echo "⚠️ Web App sedang proses inisialisasi, cek log: docker logs soapi-web"
fi

echo "============================================================"
echo "🎉 DEPLOYMENT SELESAI!"
echo "   - Web App: http://IP_VPS:3000"
echo "   - FastAPI Swagger Docs: http://IP_VPS:8000/docs"
echo "   - Cek Log: ${DOCKER_COMPOSE_CMD} -f docker-compose.prod.yml logs -f"
echo "============================================================"
