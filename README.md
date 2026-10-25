# SOAPI - AI Clinical Scribe Dashboard

Aplikasi asisten rekam medis dan dokumentasi klinis berbasis AI untuk dokter dan tenaga kesehatan. Mengintegrasikan pencatatan suara (Voice Scribe), transkripsi real-time, dan penyusunan otomatis catatan medis berstandar **SOAPI** (*Subjective, Objective, Assessment, Plan, Intervention*).

## Fitur Utama

- **Dashboard Klinis**: Ringkasan aktivitas konsultasi harian, metrik produktivitas mingguan, dan antrean review catatan.
- **Daftar Pasien**: Manajemen data pasien rawat jalan, riwayat rekam medis, dan jadwal konsultasi hari ini.
- **Voice Scribe**: Perekam suara konsultasi interaktif dengan visualisasi audio real-time dan draft catatan SOAPI otomatis dengan AI.
- **Riwayat Catatan SOAPI**: Manajemen catatan medis dengan filter status (Menunggu Review, Disetujui, Terkirim SIMRS), preview struktur SOAPI lengkap, dan tombol persetujuan langsung.
- **Pengaturan**: Konfigurasi profil dokter, integrasi SIMRS, dan preferensi bahasa catatan AI.

## Menjalankan Proyek Secara Lokal

Pastikan telah menginstal Node.js (versi 18+).

```sh
# Masuk ke folder proyek
cd SOAPI

# Install dependensi (jika belum)
npm install

# Jalankan server development
npm run dev

# Build untuk produksi
npm run build

# Menjalankan unit tests
npm run test
```

## Teknologi

- **Framework**: TanStack Start / React 19 / Vite
- **Styling**: Tailwind CSS v4 & Lucide Icons
- **State & Routing**: TanStack Router & TanStack React Query
- **Testing**: Vitest & Testing Library
