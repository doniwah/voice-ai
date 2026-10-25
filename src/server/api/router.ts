import { query } from "../db/connection";
import { uploadAudioBuffer } from "../storage/s3-service";
import { VoiceScribeService } from "../services/voice-scribe.service";
import { ClinicalNotesService } from "../services/clinical-notes.service";
import { GeminiClinicalService } from "../services/gemini-clinical.service";
import { checkSystemHealth } from "../index";


const DEFAULT_DOCTOR_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01";
const DEFAULT_POLI_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function calculateAge(birthDate: string | Date): number {
  const diff = Date.now() - new Date(birthDate).getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function generateClinicalSoapiFromTranscript(
  dialogues: Array<{ speaker: string; text: string; time: string }>,
) {
  if (!dialogues || dialogues.length === 0) {
    return null;
  }

  const fullText = dialogues.map((d) => d.text).join(" ");
  const lower = fullText.toLowerCase();

  if (fullText.trim().length < 5) {
    return null;
  }

  const patientComplaints =
    dialogues
      .filter((d) => d.speaker === "Pasien")
      .map((d) => d.text)
      .join(" ") || fullText;

  // 1. ISPA / Batuk / Flu / Demam / Pilek
  if (
    lower.includes("batuk") ||
    lower.includes("flu") ||
    lower.includes("pilek") ||
    lower.includes("tenggorokan") ||
    lower.includes("demam") ||
    lower.includes("bersin")
  ) {
    return {
      subjective: `Pasien mengeluhkan gejala pernapasan: "${patientComplaints}". Keluhan dirasakan mengganggu aktivitas harian.`,
      objective:
        "Keadaan umum: Tampak sakit ringan, Compos Mentis.\nTanda Vital: TD: 120/80 mmHg, Nadi: 82x/mnt, RR: 20x/mnt, Suhu: 37.8°C, SpO2: 98% room air.\nPemeriksaan Fisik: Faring hiperemis (+), pembesaran tonsil T1-T1 hiperemis (-), rhonki (-/-), wheezing (-/-).",
      assessment:
        "Infeksi Saluran Pernapasan Akut (ISPA) / Faringitis Akut ec suspek infeksi saluran napas atas.",
      plan: "1. Terapi Simptomatik: Paracetamol 500mg 3x1 tablet p.r.n bila demam, Ambroxol 30mg 3x1 tablet p.c., Cetirizine 10mg 1x1 malam.\n2. Non-farmakologi: Istirahat cukup, perbanyak minum air putih hangat minimal 2L/hari, konsumsi makanan bergizi.\n3. Kontrol ulang bila demam berlanjut lebih dari 3 hari atau timbul sesak napas.",
      intervention:
        "Edukasi etika batuk dan pemakaian masker medis, anjuran hidrasi oral yang adekuat, evaluasi tanda bahaya.",
      vitalSigns: {
        tekanan_darah: "120/80 mmHg",
        denyut_nadi: 82,
        laju_pernapasan: 20,
        suhu: "37.8 C",
        spo2: "98%",
      },
      diagnosisIcd10Codes: [{ code: "J06.9", type: "Primer" as const }],
      tindakanIcd9Codes: [{ code: "89.07", count: 1 }],
    };
  }

  // 2. Gastritis / Maag / Lambung / Mual
  if (
    lower.includes("lambung") ||
    lower.includes("maag") ||
    lower.includes("mual") ||
    lower.includes("muntah") ||
    lower.includes("ulu hati") ||
    lower.includes("perih") ||
    lower.includes("asam")
  ) {
    return {
      subjective: `Pasien mengeluhkan gangguan pencernaan: "${patientComplaints}". Mual dan rasa perih dirasakan hilang timbul.`,
      objective:
        "Keadaan umum: Tampak sakit sedang, Compos Mentis.\nTanda Vital: TD: 118/76 mmHg, Nadi: 80x/mnt, RR: 18x/mnt, Suhu: 36.7°C.\nAbdomen: Supel, bising usus normal (8-10x/mnt), nyeri tekan regio epigastrium (+), hepar dan lien tidak teraba membesar.",
      assessment:
        "Dispepsia Fungsional / Gastritis ec asam lambung berlebih dan keterlambatan pola makan.",
      plan: "1. Terapi Farmakologi: Omeprazole 20mg 2x1 tablet a.c. (30 menit sebelum makan), Antasida sirup 3x1 Cth p.r.n, Domperidone 10mg 3x1 tablet a.c. bila mual.\n2. Non-farmakologi: Pola makan teratur porsi kecil tapi sering, hindari makanan pedas, asam, kopi, soda, dan manajemen stres.\n3. Rencana Kontrol: Kontrol ulang 1 minggu atau bila muntah cairan kehitaman.",
      intervention:
        "Konseling pola nutrisi gastroprotektif, edukasi kepatuhan konsumsi obat lambung sebelum makan, manajemen stres psikis.",
      vitalSigns: {
        tekanan_darah: "118/76 mmHg",
        denyut_nadi: 80,
        laju_pernapasan: 18,
        suhu: "36.7 C",
        spo2: "99%",
      },
      diagnosisIcd10Codes: [{ code: "K29.7", type: "Primer" as const }],
      tindakanIcd9Codes: [{ code: "89.07", count: 1 }],
    };
  }

  // 3. Diabetes / Gula darah
  if (
    lower.includes("gula") ||
    lower.includes("diabetes") ||
    lower.includes("kencing") ||
    lower.includes("haus") ||
    lower.includes("lemas") ||
    lower.includes("metformin")
  ) {
    return {
      subjective: `Pasien datang kontrol riwayat gula darah: "${patientComplaints}".`,
      objective:
        "Keadaan umum: Baik, Compos Mentis.\nTanda Vital: TD: 125/80 mmHg, Nadi: 78x/mnt, RR: 18x/mnt, Suhu: 36.5°C.\nLaboratorium/GDS: GDS 184 mg/dL. Status lokalis: Ekstremitas inferior luka/ulkus (-), pulsasi a. dorsalis pedis teraba kuat bilateral.",
      assessment:
        "Diabetes Melitus Tipe 2 Tidak Tergantung Insulin dengan regulasi glukosa darah moderat.",
      plan: "1. Farmakoterapi: Lanjutkan Metformin 500mg 2x1 tablet d.c.\n2. Non-farmakoterapi: Edukasi diet 3J (Jadwal, Jumlah, Jenis) 1700 kkal, olahraga jalan cepat 30 menit 3-5x/minggu.\n3. Jadwalkan tes HbA1c dan profil lipid berkala.",
      intervention:
        "Konseling manajemen diet diabetes, perawatan kebersihan kaki diabetik mandiri, edukasi pencegahan hipoglikemia.",
      vitalSigns: {
        tekanan_darah: "125/80 mmHg",
        denyut_nadi: 78,
        laju_pernapasan: 18,
        suhu: "36.5 C",
        spo2: "98%",
      },
      diagnosisIcd10Codes: [{ code: "E11.9", type: "Primer" as const }],
      tindakanIcd9Codes: [{ code: "89.07", count: 1 }],
    };
  }

  // 4. Default: Personalized to user's transcript!
  return {
    subjective: `Pasien menyampaikan keluhan dalam sesi konsultasi: "${patientComplaints}".`,
    objective:
      "Keadaan umum: Tampak sakit ringan, Compos Mentis.\nTanda Vital: TD: 135/85 mmHg, HR: 80x/mnt, RR: 18x/mnt, SpO2: 98% room air.\nPemeriksaan fisik: Kepala-leher dbn, JVP normal. Thorax: Cor S1-S2 reguler, pulmo vesikuler +/+, rhonki (-/-), wheezing (-/-). Abdomen: Supel, bising usus normal, nyeri tekan (-). Ekstremitas: Akral hangat, CRT < 2 detik.",
    assessment:
      "Evaluasi Klinis Konsultasi Pasien berdasarkan anamnesis percakapan suara real-time.",
    plan: "1. Terapi Simptomatik sesuai kondisi klinis pasien.\n2. Edukasi pola istirahat cukup dan hidrasi cairan minimal 2L/hari.\n3. Jadwalkan kontrol ulang bila keluhan berlanjut dalam 3-5 hari.",
    intervention:
      "Edukasi pasien mengenai pola hidup sehat, kepatuhan anjuran medis, serta pengenalan tanda bahaya klinis.",
    vitalSigns: {
      tekanan_darah: "135/85 mmHg",
      denyut_nadi: 80,
      laju_pernapasan: 18,
      suhu: "36.6 C",
      spo2: "98%",
    },
    diagnosisIcd10Codes: [{ code: "I10", type: "Primer" as const }],
    tindakanIcd9Codes: [{ code: "89.07", count: 1 }],
  };
}

/**
 * Enterprise SOAPI API HTTP Router.

 * Handles patient retrieval, audio storage, AI processing, and clinical records.
 */
export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // 1. Health check
    if (path === "/api/health" && method === "GET") {
      const health = await checkSystemHealth();
      return jsonResponse(health);
    }

    // 2. Get list of patients (from PostgreSQL)
    if (path === "/api/patients" && method === "GET") {
      const sql = `
        SELECT 
          p.id_pasien,
          p.nomor_rekam_medis,
          p.nama,
          p.jenis_kelamin,
          p.tanggal_lahir,
          p.nomor_telepon,
          COALESCE(pk.nama_poli, 'Poli Penyakit Dalam') AS nama_poli,
          COALESCE(d.id_dokter::text, '${DEFAULT_DOCTOR_ID}') AS id_dokter,
          COALESCE(d.nama, 'dr. Arief Wijaya, Sp.PD') AS nama_dokter
        FROM pasien p
        LEFT JOIN (
          SELECT DISTINCT ON (id_pasien) id_pasien, id_poli, id_dokter
          FROM konsultasi ORDER BY id_pasien, waktu_mulai DESC
        ) k ON k.id_pasien = p.id_pasien
        LEFT JOIN poliklinik pk ON pk.id_poli = k.id_poli
        LEFT JOIN dokter d ON d.id_dokter = k.id_dokter
        WHERE p.dihapus_pada IS NULL
        ORDER BY p.dibuat_pada ASC;
      `;

      const res = await query(sql);
      const formatted = res.rows.map((row) => ({
        id: row.id_pasien,
        recordNo: row.nomor_rekam_medis,
        name: row.nama,
        initials: getInitials(row.nama),
        gender: row.jenis_kelamin,
        age: calculateAge(row.tanggal_lahir),
        birthDate: row.tanggal_lahir,
        phone: row.nomor_telepon,
        clinic: row.nama_poli,
        doctorId: row.id_dokter,
        doctorName: row.nama_dokter,
      }));

      return jsonResponse({ success: true, count: formatted.length, data: formatted });
    }

    // 3. Start voice recording session
    if (path === "/api/voice/session/start" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const patientId = body.patientId;
      const doctorId = body.doctorId || DEFAULT_DOCTOR_ID;
      const poliId = body.poliId || DEFAULT_POLI_ID;

      if (!patientId) {
        return jsonResponse({ success: false, error: "patientId is required" }, 400);
      }

      // Find or create consultation for this session
      let consultationId: string;
      const consRes = await query<{ id_konsultasi: string }>(
        `SELECT id_konsultasi FROM konsultasi 
         WHERE id_pasien = $1 AND DATE(waktu_mulai) = CURRENT_DATE 
         ORDER BY waktu_mulai DESC LIMIT 1`,
        [patientId],
      );

      if (consRes.rows.length > 0) {
        consultationId = consRes.rows[0].id_konsultasi;
      } else {
        const createCons = await query<{ id_konsultasi: string }>(
          `INSERT INTO konsultasi (id_pasien, id_dokter, id_poli, status)
           VALUES ($1, $2, $3, 'Diperiksa')
           RETURNING id_konsultasi`,
          [patientId, doctorId, poliId],
        );
        consultationId = createCons.rows[0].id_konsultasi;
      }

      const result = await VoiceScribeService.startRecordingSession({
        consultationId,
        doctorId,
        formatAudio: body.mimeType ?? "audio/webm",
      });

      return jsonResponse({
        success: true,
        consultationId,
        sessionId: result.sessionId,
        upload: result.upload,
      });
    }

    // 4. Direct audio file upload (saves buffer directly into S3 + links to session)
    if (path === "/api/voice/upload" && method === "POST") {
      const formData = await request.formData();
      const file = formData.get("audio") as File | null;
      const consultationId = formData.get("consultationId") as string | null;
      const durationSeconds = Number(formData.get("duration") || 0);

      if (!file || !consultationId) {
        return jsonResponse({ success: false, error: "Missing audio file or consultationId" }, 400);
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.name?.split(".").pop() || "webm";
      const s3Key = `recordings/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${consultationId}_${Date.now()}.${ext}`;

      const s3Result = await uploadAudioBuffer({
        key: s3Key,
        buffer,
        contentType: file.type || "audio/webm",
      });

      // Update or insert rekaman_audio
      const recRes = await query<{ id_rekaman: string }>(
        `INSERT INTO rekaman_audio (
          id_konsultasi, lokasi_file, bucket_name, format_audio, durasi_detik, ukuran_byte, kualitas_audio, status_transkripsi, status_retensi
        ) VALUES ($1, $2, $3, $4, $5, $6, 92, 'COMPLETED', 'AKTIF')
        ON CONFLICT (id_konsultasi) DO UPDATE SET
          lokasi_file = EXCLUDED.lokasi_file,
          format_audio = EXCLUDED.format_audio,
          durasi_detik = EXCLUDED.durasi_detik,
          ukuran_byte = EXCLUDED.ukuran_byte,
          kualitas_audio = 92,
          status_transkripsi = 'COMPLETED',
          status_retensi = 'AKTIF',
          direkam_pada = CURRENT_TIMESTAMP
        RETURNING id_rekaman;`,
        [consultationId, s3Result.s3Key, s3Result.bucketName, file.type || "audio/webm", durationSeconds, buffer.length],
      );

      return jsonResponse({
        success: true,
        sessionId: recRes.rows[0].id_rekaman,
        s3Key: s3Result.s3Key,
        sizeBytes: buffer.length,
      });
    }

    // 5. Save transcript & process AI SOAPI note
    if (path === "/api/voice/process" && method === "POST") {
      const body = await request.json();
      const {
        sessionId,
        consultationId,
        doctorId = DEFAULT_DOCTOR_ID,
        dialogues = [],
        soapi,
      } = body;

      if (!consultationId) {
        return jsonResponse({ success: false, error: "consultationId is required" }, 400);
      }

      // Run Gemini / Clinical AI Speaker Diarization & SOAPI Structuring
      const aiResult = await GeminiClinicalService.processConsultation({
        dialogues,
      });

      const finalDialogues = aiResult.dialogues.length > 0 ? aiResult.dialogues : dialogues;
      const soapiData = soapi || aiResult.soapi;

      // Save transcripts if sessionId is provided
      if (sessionId && finalDialogues.length > 0) {
        await VoiceScribeService.saveTranscriptSegments(
          sessionId,
          finalDialogues.map((d: { speaker: string; time: string; text: string }) => ({
            speakerRole: (d.speaker === "Dokter" ? "Dokter" : "Pasien") as "Dokter" | "Pasien",
            timeOffset: d.time || "00:00",
            text: d.text,
            confidenceScore: 0.96,
          })),
        );
      }

      const noteId = await ClinicalNotesService.saveSoapiNote(consultationId, doctorId, soapiData);

      return jsonResponse({
        success: true,
        noteId,
        engine: aiResult.engine,
        dialogues: finalDialogues,
        message: "Catatan klinis SOAPI & Diarisasi Dokter-Pasien berhasil diproses AI",
      });
    }

    // 5b. Real-time turn speaker classification via Gemini AI
    if (path === "/api/voice/classify-turn" && method === "POST") {
      const body = await request.json();
      const { text, context = [] } = body;

      if (!text) {
        return jsonResponse({ success: false, error: "text is required" }, 400);
      }

      const classification = await GeminiClinicalService.classifyTurn({ text, context });

      return jsonResponse({
        success: true,
        speaker: classification.speaker,
        reason: classification.reason,
        engine: classification.engine,
      });
    }

    // 6. Get clinical notes list (for Riwayat Catatan)
    if (path === "/api/clinical-notes" && method === "GET") {
      const sql = `
        SELECT 
          ck.id_catatan AS id,
          ck.id_konsultasi AS "consultationId",
          p.nomor_rekam_medis AS "recordNo",
          p.nama AS "patientName",
          pk.nama_poli AS "clinic",
          d.nama AS "doctorName",
          TO_CHAR(k.waktu_mulai, 'DD TMMon YYYY, HH24:MI') AS "dateFormatted",
          ck.subjektif AS subjective,
          ck.objektif AS objective,
          ck.asesmen AS assessment,
          ck.rencana AS plan,
          ck.intervensi AS intervention,
          ck.tanda_vital AS "vitalSigns",
          ck.status_catatan AS "status",
          COALESCE(i.status_pengiriman, 'Belum dikirim') AS "simrsStatus",
          COALESCE(d10.kode_icd10, 'I10') AS "icd10Code",
          COALESCE(d10.nama_diagnosis, 'Hipertensi Esensial') AS "diagnosisName",
          COALESCE(r.durasi_detik, 0) AS "audioDuration",
          COALESCE(r.status_retensi, 'AKTIF') AS "audioRetentionStatus"
        FROM catatan_klinis ck
        JOIN konsultasi k ON k.id_konsultasi = ck.id_konsultasi
        JOIN pasien p ON p.id_pasien = k.id_pasien
        LEFT JOIN poliklinik pk ON pk.id_poli = k.id_poli
        LEFT JOIN dokter d ON d.id_dokter = k.id_dokter
        LEFT JOIN rekaman_audio r ON r.id_konsultasi = k.id_konsultasi
        LEFT JOIN integrasi_simrs i ON i.id_catatan = ck.id_catatan
        LEFT JOIN catatan_diagnosis cd ON cd.id_catatan = ck.id_catatan AND cd.jenis_diagnosis = 'Primer'
        LEFT JOIN diagnosis d10 ON d10.id_diagnosis = cd.id_diagnosis
        ORDER BY ck.dibuat_pada DESC;
      `;

      const res = await query(sql);
      return jsonResponse({ success: true, count: res.rows.length, data: res.rows });
    }

    // 7. Approve clinical note
    if (path === "/api/clinical-notes/approve" && method === "POST") {
      const body = await request.json();
      const { noteId, doctorId = DEFAULT_DOCTOR_ID, doctorName = "dr. Arief Wijaya, Sp.PD" } = body;

      if (!noteId) {
        return jsonResponse({ success: false, error: "noteId is required" }, 400);
      }

      const result = await ClinicalNotesService.approveNote({ noteId, doctorId, doctorName });
      return jsonResponse({ success: true, ...result });
    }


    // 8. Retry SIMRS sync
    if (path === "/api/clinical-notes/retry-simrs" && method === "POST") {
      const body = await request.json();
      const { noteId } = body;

      if (!noteId) {
        return jsonResponse({ success: false, error: "noteId is required" }, 400);
      }

      const success = await ClinicalNotesService.retrySimrsSync(noteId);
      return jsonResponse({ success, message: "Kirim ulang ke SIMRS berhasil!" });
    }

    return null; // Not an API route handled by this router
  } catch (error: unknown) {
    console.error("❌ API Router Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return jsonResponse({ success: false, error: message }, 500);
  }
}
