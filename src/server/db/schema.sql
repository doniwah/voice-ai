-- ==============================================================================
-- SOAPI (AI Clinical Scribe) — Production Database Schema (PostgreSQL 15+)
-- Designed according to Permenkes No. 24/2022 & UU Perlindungan Data Pribadi (UU PDP)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. MASTER POLIKLINIK / DEPARTEMEN
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS poliklinik (
    id_poli UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_poli VARCHAR(50) NOT NULL UNIQUE,
    nama_poli VARCHAR(150) NOT NULL,
    deskripsi TEXT,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dihapus_pada TIMESTAMPTZ NULL
);

-- ------------------------------------------------------------------------------
-- 2. MASTER DOKTER & TENAGA MEDIS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dokter (
    id_dokter UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nomor_sip VARCHAR(100) NOT NULL,
    spesialisasi VARCHAR(150) NOT NULL,
    inisial VARCHAR(10) NOT NULL,
    foto_profil_url TEXT,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dihapus_pada TIMESTAMPTZ NULL
);

-- ------------------------------------------------------------------------------
-- 3. MASTER PASIEN (REKAM MEDIS PASIEN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pasien (
    id_pasien UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_rekam_medis VARCHAR(50) NOT NULL UNIQUE,
    nik VARCHAR(16),
    nama VARCHAR(255) NOT NULL,
    tanggal_lahir DATE NOT NULL,
    jenis_kelamin VARCHAR(20) NOT NULL CHECK (jenis_kelamin IN ('Laki-laki', 'Perempuan')),
    nomor_telepon VARCHAR(30),
    golongan_darah VARCHAR(10),
    alamat TEXT,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dihapus_pada TIMESTAMPTZ NULL -- Soft delete (retensi 25 tahun sesuai Permenkes 24/2022)
);

-- ------------------------------------------------------------------------------
-- 4. KONSULTASI / PERTEMUAN (ENCOUNTER)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS konsultasi (
    id_konsultasi UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pasien UUID NOT NULL REFERENCES pasien(id_pasien) ON DELETE RESTRICT,
    id_dokter UUID NOT NULL REFERENCES dokter(id_dokter) ON DELETE RESTRICT,
    id_poli UUID NOT NULL REFERENCES poliklinik(id_poli) ON DELETE RESTRICT,
    waktu_mulai TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    waktu_selesai TIMESTAMPTZ NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Menunggu' 
        CHECK (status IN ('Menunggu', 'Diperiksa', 'Menunggu Review', 'Selesai', 'Batal')),
    keluhan_utama TEXT,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dihapus_pada TIMESTAMPTZ NULL
);

-- ------------------------------------------------------------------------------
-- 5. REKAMAN AUDIO KONSULTASI (OBJECT STORAGE METADATA)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rekaman_audio (
    id_rekaman UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_konsultasi UUID NOT NULL UNIQUE REFERENCES konsultasi(id_konsultasi) ON DELETE CASCADE,
    lokasi_file TEXT NOT NULL,               -- S3 Object Key: e.g. "recordings/konsultasi-id/audio.webm"
    bucket_name VARCHAR(100) NOT NULL,        -- S3 Bucket Name
    format_audio VARCHAR(30) NOT NULL DEFAULT 'audio/webm',
    durasi_detik INT NOT NULL DEFAULT 0,
    ukuran_byte BIGINT NOT NULL DEFAULT 0,
    kualitas_audio INT NOT NULL DEFAULT 92 CHECK (kualitas_audio BETWEEN 0 AND 100),
    checksum_sha256 VARCHAR(64),              -- Integritas data rekaman
    status_transkripsi VARCHAR(50) NOT NULL DEFAULT 'READY'
        CHECK (status_transkripsi IN ('READY', 'RECORDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    status_retensi VARCHAR(30) NOT NULL DEFAULT 'AKTIF'
        CHECK (status_retensi IN ('AKTIF', 'TERJADWAL_HAPUS', 'DIHAPUS_PERMANEN')),
    direkam_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dihapus_pada TIMESTAMPTZ NULL             -- Tanggal auto-purge audio dari S3 (UU PDP)
);

-- ------------------------------------------------------------------------------
-- 6. TRANSKRIP PERCAKAPAN MEDIS (SPEECH-TO-TEXT SEGMENTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transkrip (
    id_transkrip UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_rekaman UUID NOT NULL REFERENCES rekaman_audio(id_rekaman) ON DELETE CASCADE,
    urutan INT NOT NULL DEFAULT 1,
    peran_pembicara VARCHAR(30) NOT NULL CHECK (peran_pembicara IN ('Dokter', 'Pasien', 'Keluarga', 'Lainnya')),
    offset_waktu VARCHAR(10) NOT NULL,        -- Format: '00:03', '00:08'
    teks_transkrip TEXT NOT NULL,
    confidence_rata_rata NUMERIC(4,3) NOT NULL DEFAULT 0.950,
    model_speech_to_text VARCHAR(100) NOT NULL DEFAULT 'soapi-whisper-med-id',
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 7. CATATAN KLINIS BAKU (FORMAT SOAPI)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catatan_klinis (
    id_catatan UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_konsultasi UUID NOT NULL UNIQUE REFERENCES konsultasi(id_konsultasi) ON DELETE RESTRICT,
    
    -- Struktur Baku SOAPI
    subjektif TEXT NOT NULL,                  -- S: Keluhan pasien, riwayat penyakit
    objektif TEXT NOT NULL,                   -- O: Pemeriksaan fisik & tanda vital
    asesmen TEXT NOT NULL,                    -- A: Penilaian klinis / diagnosis kerja
    rencana TEXT NOT NULL,                    -- P: Rencana terapi, farmakoterapi, jadwal kontrol
    intervensi TEXT NOT NULL,                 -- I: Edukasi pasien, konseling kepatuhan, pencegahan
    
    tanda_vital JSONB DEFAULT '{}'::jsonb,    -- { "td": "140/90", "nadi": 80, "rr": 18, "suhu": 36.5 }
    versi_model_ai VARCHAR(100) NOT NULL DEFAULT 'soapi-clinical-llm-v2',
    status_catatan VARCHAR(50) NOT NULL DEFAULT 'Draft'
        CHECK (status_catatan IN ('Draft', 'Menunggu Review', 'Disetujui')),
    
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dihapus_pada TIMESTAMPTZ NULL
);

-- ------------------------------------------------------------------------------
-- 8. MASTER DIAGNOSIS (ICD-10)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnosis (
    id_diagnosis UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_icd10 VARCHAR(20) NOT NULL UNIQUE,  -- e.g. 'I10', 'E11.9', 'K29.7'
    nama_diagnosis VARCHAR(255) NOT NULL,    -- e.g. 'Hipertensi Esensial (Primer)'
    kategori VARCHAR(100)
);

-- Tabel Junction Catatan ke Diagnosis
CREATE TABLE IF NOT EXISTS catatan_diagnosis (
    id_catatan UUID NOT NULL REFERENCES catatan_klinis(id_catatan) ON DELETE CASCADE,
    id_diagnosis UUID NOT NULL REFERENCES diagnosis(id_diagnosis) ON DELETE RESTRICT,
    jenis_diagnosis VARCHAR(30) NOT NULL DEFAULT 'Primer' CHECK (jenis_diagnosis IN ('Primer', 'Sekunder', 'Komplikasi')),
    diverifikasi_dokter BOOLEAN NOT NULL DEFAULT TRUE,
    catatan_verifikasi TEXT,
    PRIMARY KEY (id_catatan, id_diagnosis)
);

-- ------------------------------------------------------------------------------
-- 9. MASTER TINDAKAN MEDIS (ICD-9-CM)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tindakan_medis (
    id_tindakan UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_icd9cm VARCHAR(20) NOT NULL UNIQUE, -- e.g. '89.07', '89.52'
    nama_tindakan VARCHAR(255) NOT NULL,     -- e.g. 'Konsultasi dan Pemeriksaan Fisik'
    kategori VARCHAR(100)
);

-- Tabel Junction Catatan ke Tindakan
CREATE TABLE IF NOT EXISTS catatan_tindakan (
    id_catatan UUID NOT NULL REFERENCES catatan_klinis(id_catatan) ON DELETE CASCADE,
    id_tindakan UUID NOT NULL REFERENCES tindakan_medis(id_tindakan) ON DELETE RESTRICT,
    jumlah INT NOT NULL DEFAULT 1,
    diverifikasi_dokter BOOLEAN NOT NULL DEFAULT TRUE,
    catatan_verifikasi TEXT,
    PRIMARY KEY (id_catatan, id_tindakan)
);

-- ------------------------------------------------------------------------------
-- 10. PERSETUJUAN CATATAN (DOKTER APPROVAL & DIGITAL SIGNATURE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS persetujuan_catatan (
    id_persetujuan UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_catatan UUID NOT NULL UNIQUE REFERENCES catatan_klinis(id_catatan) ON DELETE CASCADE,
    id_dokter UUID NOT NULL REFERENCES dokter(id_dokter) ON DELETE RESTRICT,
    keputusan VARCHAR(50) NOT NULL DEFAULT 'Disetujui' CHECK (keputusan IN ('Disetujui', 'Perlu Revisi')),
    catatan_revisi TEXT,
    tanda_tangan_hash VARCHAR(255),          -- SHA-256 digital signature token
    diputuskan_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 11. INTEGRASI SIMRS & SATUSEHAT (SYNC LOGS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integrasi_simrs (
    id_integrasi UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_catatan UUID NOT NULL REFERENCES catatan_klinis(id_catatan) ON DELETE CASCADE,
    id_catatan_simrs VARCHAR(100),           -- Nomor Referensi dari SIMRS Rumah Sakit
    endpoint_tujuan TEXT NOT NULL,
    status_pengiriman VARCHAR(50) NOT NULL DEFAULT 'Belum dikirim'
        CHECK (status_pengiriman IN ('Belum dikirim', 'Terkirim', 'Gagal', 'Sedang Dikirim')),
    jumlah_percobaan INT NOT NULL DEFAULT 0,
    pesan_respons TEXT,
    payload_dikirim JSONB,
    dikirim_pada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 12. RIWAYAT AKTIVITAS (IMMUTABLE AUDIT TRAIL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS riwayat_aktivitas (
    id_aktivitas UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_dokter UUID REFERENCES dokter(id_dokter) ON DELETE SET NULL,
    id_konsultasi UUID REFERENCES konsultasi(id_konsultasi) ON DELETE SET NULL,
    jenis_aktivitas VARCHAR(100) NOT NULL,   -- e.g. 'MULAI_REKAM', 'SELESAI_REKAM', 'SETUJUI_SOAPI', 'SYNC_SIMRS'
    detail_aktivitas TEXT NOT NULL,
    alamat_ip VARCHAR(45),
    user_agent TEXT,
    waktu_aktivitas TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- INDEKS OPTIMASI PERFORMA & QUERY LATENSI RENDAH (< 50ms)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_pasien_rm ON pasien(nomor_rekam_medis);
CREATE INDEX IF NOT EXISTS idx_pasien_nama ON pasien(nama text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_konsultasi_pasien_waktu ON konsultasi(id_pasien, waktu_mulai DESC);
CREATE INDEX IF NOT EXISTS idx_konsultasi_dokter_status ON konsultasi(id_dokter, status);
CREATE INDEX IF NOT EXISTS idx_catatan_status ON catatan_klinis(status_catatan);
CREATE INDEX IF NOT EXISTS idx_simrs_status ON integrasi_simrs(status_pengiriman);
CREATE INDEX IF NOT EXISTS idx_transkrip_rekaman_urutan ON transkrip(id_rekaman, urutan ASC);
CREATE INDEX IF NOT EXISTS idx_audit_waktu ON riwayat_aktivitas(waktu_aktivitas DESC);

-- Partial index khusus catatan gagal SIMRS (sangat cepat untuk query alert)
CREATE INDEX IF NOT EXISTS idx_simrs_gagal ON integrasi_simrs(dikirim_pada DESC) 
WHERE status_pengiriman = 'Gagal';
