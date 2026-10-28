# Panduan Integrasi Frontend (Next.js) ke Backend (FastAPI)

Dokumen ini menjelaskan implementasi **Tahap 1 & 2** untuk proyek SOAPI.

---

## 1. Menjalankan Backend FastAPI (Mendukung Gemini atau OpenAI)

Backend SOAPI mendukung **Google Gemini API Key** (`GEMINI_API_KEY`) secara langsung menggunakan endpoint resmi Google OpenAI-compatible, atau **OpenAI API Key** (`OPENAI_API_KEY`).

### Opsi A: Menggunakan Google Gemini Key (Sudah Tersedia di `.env`)
Jika di file `.env` sudah terdapat:
```env
GEMINI_API_KEY=AIzaSy... atau AQ...
```
FastAPI akan otomatis menggunakan model **`gemini-2.5-flash`** dengan `temperature=0` dan `response_format={"type": "json_object"}`. Anda **tidak memerlukan akun atau saldo OpenAI**.

### Opsi B: Menggunakan OpenAI Key
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

### Menjalankan Server FastAPI:
```bash
# Masuk ke folder proyek
cd SOAPI

# Jalankan server FastAPI dengan uvicorn
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Dokumentasi interaktif Swagger UI akan otomatis tersedia di:
- **Swagger Docs:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## 2. Struktur Endpoint Backend

### A. `POST /generate-soap`
- **Request Body:**
  ```json
  {
    "transcript": "Dokter: Tensinya 140/90 ya pak. Pasien: Kepala saya pusing dok. Dokter: Kita lanjutkan Amlodipine 10mg."
  }
  ```
- **Karakteristik:**
  - Menggunakan OpenAI API dengan `temperature=0` dan `response_format={"type": "json_object"}`.
  - Memanfaatkan `SOAP_SYSTEM_PROMPT` ketat anti-halusinasi dan few-shot example di `backend/prompts.py`.
  - Divalidasi skema Pydantic `SOAPModel`.

### B. `POST /recommend-icd` (RAG Sederhana)
- **Request Body:**
  ```json
  {
    "soap": {
      "subjective": "Pasien mengeluh pusing.",
      "objective": "TD 140/90 mmHg.",
      "assessment": "Hipertensi Primer Stage 1.",
      "plan": "Amlodipine 10mg 1x1.",
      "intervention": "Edukasi diet rendah garam."
    }
  }
  ```
- **Alur RAG 3-Langkah:**
  1. **Langkah A (Ekstraksi):** LLM mengekstrak istilah diagnosis dari `assessment`.
  2. **Langkah B (Retrieval):** Pencarian teks di kamus `backend/icd10.csv` mengambil 5-10 kandidat kode terbaik.
  3. **Langkah C (Verifikasi):** LLM memilih kode terbaik dan **mengutip bukti teks langsung dari SOAP**.

---

## 3. Integrasi ke Proyek Next.js

Anda dapat menggunakan komponen di file `frontend-nextjs/page.tsx` pada proyek Next.js Anda (Next.js 13, 14, atau 15 dengan App Router atau Pages Router).

### Konfigurasi `.env.local` di Next.js:
```env
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
```

### Opsi Tambahan: Next.js Rewrites (Menghindari Masalah CORS)
Jika tidak ingin memanggil langsung ke port 8000, tambahkan konfigurasi `rewrites` di `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
```
