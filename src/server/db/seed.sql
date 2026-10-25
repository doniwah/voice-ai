-- ==============================================================================
-- SOAPI — Initial Seed Data
-- ==============================================================================

-- 1. Poliklinik
INSERT INTO poliklinik (id_poli, kode_poli, nama_poli, deskripsi)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'INT', 'Poli Penyakit Dalam', 'Poliklinik Spesialis Penyakit Dalam RS Medika Utama'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'SAR', 'Poli Saraf', 'Poliklinik Spesialis Neurologi'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'PAR', 'Poli Paru', 'Poliklinik Spesialis Pulmonologi')
ON CONFLICT (kode_poli) DO NOTHING;

-- 2. Dokter Spesialis
INSERT INTO dokter (id_dokter, nama, email, password_hash, nomor_sip, spesialisasi, inisial)
VALUES
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01',
    'dr. Arief Wijaya, Sp.PD',
    'arief.wijaya@medikautama.id',
    '$2a$12$e8w.xL9p1FqUuM7K1iXoQ.9V8yM3sO5wE1tK9sF3wM7K1iXoQ.9V8',
    'SIP.440/128/DKS/2022',
    'Spesialis Penyakit Dalam',
    'AW'
  )
ON CONFLICT (email) DO NOTHING;

-- 3. Master Pasien
INSERT INTO pasien (id_pasien, nomor_rekam_medis, nik, nama, tanggal_lahir, jenis_kelamin, nomor_telepon, golongan_darah)
VALUES
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'RM-2024-00831', '3174051208700001', 'Budi Santoso', '1970-08-12', 'Laki-laki', '081288991122', 'O+'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'RM-2023-01422', '3174052511780002', 'Siti Aminah', '1978-11-25', 'Perempuan', '081377882233', 'A+'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'RM-2022-00691', '3174051403840003', 'Ahmad Fauzi', '1984-03-14', 'Laki-laki', '081566773344', 'B+'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'RM-2024-00217', '3174050907930004', 'Dewi Lestari', '1993-07-09', 'Perempuan', '081855664455', 'AB+'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05', 'RM-2021-01903', '3174051901650005', 'Rudi Hartono', '1965-01-19', 'Laki-laki', '081944556677', 'O+'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b06', 'RM-2023-01108', '3174050204730006', 'Nurhayati', '1973-04-02', 'Perempuan', '081733445566', 'B+')
ON CONFLICT (nomor_rekam_medis) DO NOTHING;

-- 4. Master Diagnosis ICD-10
INSERT INTO diagnosis (id_diagnosis, kode_icd10, nama_diagnosis, kategori)
VALUES
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'I10', 'Hipertensi Esensial (Primer)', 'Kardiovaskular'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 'E11.9', 'Diabetes Melitus Tipe 2 Tanpa Komplikasi', 'Endokrin'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'K29.7', 'Gastritis Tidak Spesifik', 'Gastrointestinal'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c04', 'J06.9', 'Infeksi Saluran Pernapasan Akut Atas (ISPA)', 'Respirasi'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', 'E78.5', 'Dislipidemia Tidak Spesifik', 'Metabolik'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c06', 'M17.0', 'Osteoartritis Genu Primer Bilateral', 'Muskuloskeletal')
ON CONFLICT (kode_icd10) DO NOTHING;

-- 5. Master Tindakan Medis ICD-9-CM
INSERT INTO tindakan_medis (id_tindakan, kode_icd9cm, nama_tindakan, kategori)
VALUES
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', '89.07', 'Konsultasi dan Pemeriksaan Medis Komprehensif', 'Pemeriksaan'),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e02', '89.52', 'Elektrokardiografi (EKG) Rutin', 'Diagnostik'),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e03', '90.59', 'Pemeriksaan Gula Darah Sewaktu (GDS)', 'Laboratorium')
ON CONFLICT (kode_icd9cm) DO NOTHING;

-- 6. Konsultasi Pasien Budi Santoso
INSERT INTO konsultasi (id_konsultasi, id_pasien, id_dokter, id_poli, status, keluhan_utama)
VALUES (
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f01',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01',
  'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Selesai',
  'Tengkuk kaku dan pusing berdenyut sejak 2 hari'
) ON CONFLICT (id_konsultasi) DO NOTHING;

-- 7. Rekaman Audio S3 Metadata
INSERT INTO rekaman_audio (
  id_rekaman, id_konsultasi, lokasi_file, bucket_name, format_audio, durasi_detik, ukuran_byte, kualitas_audio, status_transkripsi, status_retensi
) VALUES (
  '10eebc99-9c0b-4ef8-bb6d-6bb9bd380001',
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f01',
  'recordings/2025-06-14/b0eebc99-audio-f0eebc99.webm',
  'soapi-audio-recordings',
  'audio/webm',
  35,
  563200,
  92,
  'COMPLETED',
  'AKTIF'
) ON CONFLICT (id_konsultasi) DO NOTHING;

-- 8. Transkrip Percakapan
INSERT INTO transkrip (id_rekaman, urutan, peran_pembicara, offset_waktu, teks_transkrip)
VALUES
  ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380001', 1, 'Dokter', '00:03', 'Selamat pagi Pak Budi, bagaimana kabarnya hari ini? Ada keluhan apa yang dirasakan?'),
  ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380001', 2, 'Pasien', '00:08', 'Selamat pagi dok. Ini belakangan tengkuk saya terasa kaku dan kepala sering pusing berdenyut dok, terutama kalau pagi atau lelah.'),
  ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380001', 3, 'Dokter', '00:15', 'Baik, apakah obat amlodipine yang kemarin masih rutin diminum setiap hari?'),
  ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380001', 4, 'Pasien', '00:20', 'Masih dok, tapi kadang kalau lupa suka terlewat satu hari.'),
  ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380001', 5, 'Dokter', '00:28', 'Baik, mari kita ukur tekanan darahnya dulu ya. Tensinya 140/90 mmHg. Kita sesuaikan dosisnya dan kontrol pola makannya ya.')
ON CONFLICT (id_transkrip) DO NOTHING;

-- 9. Catatan Klinis Format SOAPI
INSERT INTO catatan_klinis (
  id_catatan, id_konsultasi, subjektif, objektif, asesmen, rencana, intervensi, status_catatan, tanda_vital
) VALUES (
  '20eebc99-9c0b-4ef8-bb6d-6bb9bd380002',
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f01',
  'Pasien datang kontrol rutin tekanan darah. Mengeluhkan pusing di bagian tengkuk sejak 2 hari terakhir, tidur terasa kurang nyenyak. Riwayat konsumsi obat amlodipine 5mg teratur.',
  'TD: 145/90 mmHg, Nadi: 82x/mnt, RR: 18x/mnt, Suhu: 36.6°C. Jantung/Paru: dbn. Ekstremitas: Edema (-/-).',
  'Hipertensi Primer / Esensial Stage 1, belum terkontrol optimal. Riwayat dislipidemia.',
  'Tingkatkan dosis Amlodipine menjadi 10mg 1x1 tab pagi. Edukasi diet rendah garam dan olahraga jalan santai 30 mnt 3x seminggu. Jadwal kontrol 2 minggu.',
  'Pemberian edukasi kepatuhan minum obat harian, pembatasan asupan natrium (<2000mg/hari), serta anjuran pemantauan tensi mandiri di rumah.',
  'Disetujui',
  '{"td": "145/90", "nadi": 82, "rr": 18, "suhu": 36.6}'::jsonb
) ON CONFLICT (id_konsultasi) DO NOTHING;

-- 10. Relasi Diagnosis & Tindakan Catatan Budi Santoso
INSERT INTO catatan_diagnosis (id_catatan, id_diagnosis, jenis_diagnosis, diverifikasi_dokter)
VALUES ('20eebc99-9c0b-4ef8-bb6d-6bb9bd380002', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'Primer', true)
ON CONFLICT (id_catatan, id_diagnosis) DO NOTHING;

INSERT INTO catatan_tindakan (id_catatan, id_tindakan, diverifikasi_dokter)
VALUES ('20eebc99-9c0b-4ef8-bb6d-6bb9bd380002', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', true)
ON CONFLICT (id_catatan, id_tindakan) DO NOTHING;

-- 11. Persetujuan Dokter
INSERT INTO persetujuan_catatan (id_persetujuan, id_catatan, id_dokter, keputusan, tanda_tangan_hash)
VALUES (
  '30eebc99-9c0b-4ef8-bb6d-6bb9bd380003',
  '20eebc99-9c0b-4ef8-bb6d-6bb9bd380002',
  'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01',
  'Disetujui',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
) ON CONFLICT (id_catatan) DO NOTHING;

-- 12. Integrasi SIMRS
INSERT INTO integrasi_simrs (id_integrasi, id_catatan, id_catatan_simrs, endpoint_tujuan, status_pengiriman, jumlah_percobaan, pesan_respons)
VALUES (
  '40eebc99-9c0b-4ef8-bb6d-6bb9bd380004',
  '20eebc99-9c0b-4ef8-bb6d-6bb9bd380002',
  'SIMRS-RM-2024-00831-A1',
  'https://simrs.medikautama.id/api/v1/emr/encounter-notes',
  'Terkirim',
  1,
  'HTTP 200: Catatan klinis terverifikasi dan tercatat pada EMR RS.'
) ON CONFLICT (id_integrasi) DO NOTHING;
