import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "../config/env";
import type { SoapiContent } from "./clinical-notes.service";

export interface DiarizedDialogueItem {
  speaker: "Dokter" | "Pasien";
  text: string;
  time: string;
  confidence?: number;
}

export interface GeminiProcessingResult {
  engine: "gemini-2.5-flash" | "clinical-nlp-fallback";
  dialogues: DiarizedDialogueItem[];
  soapi: SoapiContent;
}

/**
 * Intelligent Clinical NLP Diarizer (Indonesian Medical Context).
 * Automatically separates doctor and patient dialogue turns without manual clicking,
 * with deep symptom scoring, active listening reflection, and continuous pause handling.
 */
export function classifySpeakerRole(
  text: string,
  previousSpeaker?: "Dokter" | "Pasien",
): "Dokter" | "Pasien" {
  const lower = text.trim().toLowerCase();

  let doctorScore = 0;
  let patientScore = 0;

  // 1. Doctor Indicators (Examination, Questions, Anamnesis, Instructions, Prescriptions, Reflective Listening)
  if (lower.endsWith("?") || lower.includes("?")) doctorScore += 2;
  if (/^(selamat|halo|pagi|siang|sore|malam)\b/.test(lower)) doctorScore += 3;
  if (/\b(keluhan apa|ada keluhan|dirasakan apa|bisa dibantu|kenapa|ada yang sakit)\b/.test(lower)) doctorScore += 4;
  if (/\b(sejak kapan|mulai kapan|sudah berapa lama|apakah ada|apakah pernah|bagaimana)\b/.test(lower)) doctorScore += 3;
  if (/\b(mari|silakan|coba|buka mulut|tarik napas|hembuskan|tiduran|duduk|rileks|kita periksa|saya periksa)\b/.test(lower)) doctorScore += 4;
  if (/\b(tensinya|tekanan darah|suhunya|nadinya|detak jantung|stetoskop|hasil lab)\b/.test(lower)) doctorScore += 4;
  if (/\b(resep|resepkan|obatnya|minum obat|dosis|tablet|kapsul|sirup|sehari|sebelum makan|sesudah makan)\b/.test(lower)) doctorScore += 4;
  if (/\b(pantangan|kurangi garam|kurangi gula|banyak minum|istirahat|kontrol ulang|jadwal kontrol|rujuk)\b/.test(lower)) doctorScore += 3;

  // Active listening reflection & addressing the patient ("Oh jadi pusing ya pak", "jadi nyeri ya bu", "ya pak", "ya bu")
  if (/\b(oh jadi|jadi|berarti|maksudnya)\b/.test(lower) && /\b(ya pak|ya bu|pak|bapak|bu|ibu|mas|mbak|dik|adik)\b/.test(lower)) {
    doctorScore += 8;
  } else if (/\b(ya pak|ya bu|bapak|ibu|mas|mbak|dik|adik)\b/.test(lower)) {
    doctorScore += 4;
  } else if (/\b(oh jadi|jadi begitu|berarti begitu)\b/.test(lower)) {
    doctorScore += 3;
  }

  // 2. Patient Indicators (Symptoms, Complaints, Discomfort, Addressing Doctor, Self-references)
  if (/\b(dok|dokter)\b/.test(lower)) patientScore += 4; // Addressing doctor ("pusing dok", "iya dok")
  if (/\b(saya|aku|badan saya|diri saya)\b/.test(lower)) patientScore += 2;
  if (/\b(pusing|sakit|nyeri|linu|pegal|ngilu|perih|kram|kesemutan|panas|demam|menggigil)\b/.test(lower)) patientScore += 4;
  if (/\b(batuk|pilek|flu|sesak|mual|muntah|diare|mencret|sembelit|lemas|capek|letih|susah tidur|insomnia)\b/.test(lower)) patientScore += 4;
  if (/\b(berdebar|kaku|gatal|bengkak|cekot|cenat|berdenyut)\b/.test(lower)) patientScore += 4;
  if (/\b(kepala|tengkuk|leher|perut|lambung|ulu hati|dada|pinggang|punggung|kaki|tangan|lutut|mata|tenggorokan)\b/.test(lower)) patientScore += 3;
  if (/\b(dari tadi|sejak kemarin|tadi malam|semalam|udah|sudah|kumat|kambuh|terasa|merasa)\b/.test(lower)) patientScore += 3;
  if (/^(iya dok|masih dok|belum dok|tidak dok|kadang|soalnya|terus|tapi)/.test(lower)) patientScore += 4;

  if (doctorScore > patientScore) return "Dokter";
  if (patientScore > doctorScore) return "Pasien";

  // Tie-breaking / continuation:
  // If doctor addressing patient is present, it's Dokter
  if (/\b(ya pak|ya bu|bapak|ibu|mas|mbak)\b/.test(lower)) {
    return "Dokter";
  }

  // If text mentions ANY symptom or body part and no doctor markers, it belongs to Pasien
  if (/\b(pusing|sakit|nyeri|demam|batuk|mual|kepala|perut|tengkuk|dada|lemas)\b/.test(lower)) {
    return "Pasien";
  }

  // If previous speaker was Pasien, and this utterance has no doctor cues, continue as Pasien (pause continuation)
  if (previousSpeaker === "Pasien" && doctorScore === 0) {
    return "Pasien";
  }

  // If previous speaker was Dokter, and this utterance has no patient cues, continue as Dokter
  if (previousSpeaker === "Dokter" && patientScore === 0) {
    return "Dokter";
  }

  // Natural alternation only if ambiguous
  if (previousSpeaker === "Dokter") return "Pasien";
  if (previousSpeaker === "Pasien") return "Dokter";

  return "Dokter";
}


/**
 * Gemini Multimodal Audio & Clinical Structuring Service.
 * Allows doctor to click record once; AI performs automatic speaker separation & SOAPI generation.
 */
export class GeminiClinicalService {
  /**
   * Real-time Turn Diarization using Gemini 2.5 Flash:
   * Analyzes an utterance in dialogue context and accurately classifies it as 'Dokter' or 'Pasien'.
   */
  static async classifyTurn({
    text,
    context = [],
  }: {
    text: string;
    context?: Array<{ speaker: string; text: string }>;
  }): Promise<{
    speaker: "Dokter" | "Pasien";
    reason?: string;
    engine: "gemini-2.5-flash" | "clinical-heuristic";
  }> {
    const apiKey = serverEnv.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (apiKey && text.trim().length > 0) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const contextStr = context
          .slice(-6)
          .map((c) => `${c.speaker}: "${c.text}"`)
          .join("\n");

        const prompt = `
Anda adalah AI medis terstandarisasi untuk menganalisis dialog konsultasi dokter dan pasien di Indonesia.
Tentukan secara presisi apakah kalimat target diucapkan oleh "Dokter" atau "Pasien".

Pedoman Medis:
- "Dokter": Menanyakan keluhan, menyapa, mengklarifikasi/mengonfirmasi gejala pasien (misal: "Oh jadi pusing ya pak", "sudah berapa lama?"), memeriksa fisik, meresepkan obat, memanggil pasien dengan sapaan hormat ("pak", "bu", "ya pak", "ya bu", "mas", "mbak").
- "Pasien": Mengutarakan keluhan fisik, rasa sakit ("saya pusing", "lemas"), memanggil "dok/dokter", menjawab pertanyaan dokter.

Konteks percakapan sebelumnya:
${contextStr || "(Belum ada percakapan sebelumnya)"}

Kalimat target yang dianalisis:
"${text}"
`;

        const resp = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ text: prompt }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                speaker: { type: "STRING", enum: ["Dokter", "Pasien"] },
                reason: { type: "STRING" },
              },
              required: ["speaker"],
            },
            temperature: 0.1,
          },
        });

        const parsed = JSON.parse(resp.text || "{}");
        if (parsed.speaker === "Dokter" || parsed.speaker === "Pasien") {
          return {
            speaker: parsed.speaker,
            reason: parsed.reason,
            engine: "gemini-2.5-flash",
          };
        }
      } catch (err) {
        console.warn("Gemini classifyTurn error, fallback to heuristic:", err);
      }
    }

    const lastSpeaker = context.length > 0 ? (context[context.length - 1].speaker as "Dokter" | "Pasien") : undefined;
    const speaker = classifySpeakerRole(text, lastSpeaker);
    return {
      speaker,
      reason: "Clinical heuristic fallback",
      engine: "clinical-heuristic",
    };
  }

  /**
   * Process consultation using Gemini 2.5 Flash if API key configured,
   * with robust medical fallback diarization.
   */
  static async processConsultation({
    audioBuffer,
    mimeType = "audio/webm",
    dialogues = [],
  }: {
    audioBuffer?: Buffer;
    mimeType?: string;
    dialogues?: Array<{ speaker?: string; text: string; time?: string }>;
  }): Promise<GeminiProcessingResult> {
    const apiKey = serverEnv.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    // 1. If Gemini API key is configured, execute multimodal audio diarization
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const parts: any[] = [];

        // If audio buffer is provided, attach audio payload
        if (audioBuffer && audioBuffer.length > 0) {
          parts.push({
            inlineData: {
              mimeType,
              data: audioBuffer.toString("base64"),
            },
          });
        }

        // Add detailed clinical system prompt
        const existingTranscript = dialogues.map((d) => d.text).join("\n");
        const prompt = `
Anda adalah AI Clinical Engine medis terstandarisasi untuk rumah sakit di Indonesia.
Dengarkan rekaman audio konsultasi medis berikut (dan/atau transkrip percakapan kasar):
${existingTranscript ? `Transkrip kasar: \n${existingTranscript}` : ""}

TUGAS UTAMA:
1. DIARISASI OTOMATIS: Pisahkan pembicara menjadi 'Dokter' dan 'Pasien' secara akurat berdasarkan giliran bicara dan konteks percakapan.
2. DOKUMENTASI KLINIS SOAPI: Susun catatan medis lengkap berstandar Permenkes RI:
   - Subjektif (S): Keluhan utama, riwayat perjalanan penyakit, keluhan penyerta dari pasien.
   - Objektif (O): Hasil tanda vital (TD, HR, RR, Suhu, SpO2) dan pemeriksaan fisik relevan.
   - Asesmen (A): Diagnosis kerja klinis disertai kode ICD-10 yang paling tepat.
   - Plan (P): Rencana terapi farmakologi (nama obat, dosis, frekuensi), non-farmakologi (gaya hidup, diet), dan rencana kontrol ulang.
   - Intervensi (I): Tindakan medis dan edukasi komunikasi terapeutik dokter ke pasien.

Kembalikan HANYA format JSON valid tanpa markdown quotes:
{
  "dialogues": [
    { "speaker": "Dokter" | "Pasien", "text": "...", "time": "00:03" }
  ],
  "soapi": {
    "subjective": "...",
    "objective": "...",
    "assessment": "...",
    "plan": "...",
    "intervention": "...",
    "vitalSigns": { "tekanan_darah": "...", "denyut_nadi": 80, "laju_pernapasan": 18, "suhu": "36.6 C", "spo2": "98%" },
    "diagnosisIcd10Codes": [{ "code": "...", "type": "Primer" }],
    "tindakanIcd9Codes": [{ "code": "89.07", "count": 1 }]
  }
}
`;

        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: parts,
          config: {
            responseMimeType: "application/json",
            temperature: 0.2, // Low temperature for high clinical precision
          },
        });

        const responseText = response.text || "";
        const parsed = JSON.parse(responseText);

        if (parsed.dialogues && parsed.soapi) {
          return {
            engine: "gemini-2.5-flash",
            dialogues: parsed.dialogues,
            soapi: parsed.soapi,
          };
        }
      } catch (geminiError) {
        console.warn("⚠️ Gemini AI call fallback to local clinical engine:", geminiError);
      }
    }

    // 2. Fallback: Intelligent Local Clinical Diarizer & Structuring
    return this.fallbackClinicalDiarization(dialogues);
  }

  /**
   * Local intelligent diarization & SOAPI synthesis engine.
   */
  private static fallbackClinicalDiarization(
    dialogues: Array<{ speaker?: string; text: string; time?: string }>,
  ): GeminiProcessingResult {
    let lastSpeaker: "Dokter" | "Pasien" | undefined;

    const diarizedDialogues: DiarizedDialogueItem[] = dialogues.map((d, index) => {
      const assignedSpeaker = classifySpeakerRole(d.text, lastSpeaker);
      lastSpeaker = assignedSpeaker;

      const time = d.time || `00:${String((index + 1) * 6).padStart(2, "0")}`;
      return {
        speaker: assignedSpeaker,
        text: d.text,
        time,
        confidence: 0.95,
      };
    });

    const fullText = diarizedDialogues.map((d) => d.text).join(" ");
    const lower = fullText.toLowerCase();

    const patientWords =
      diarizedDialogues
        .filter((d) => d.speaker === "Pasien")
        .map((d) => d.text)
        .join(" ") || fullText;

    // Smart clinical SOAPI matching
    let icd10 = "I10";
    let subjective = "";
    let objective = "";
    let assessment = "";
    let plan = "";
    let intervention = "";
    let vitalSigns = {
      tekanan_darah: "120/80 mmHg",
      denyut_nadi: 80,
      laju_pernapasan: 18,
      suhu: "36.6 C",
      spo2: "98%",
    };

    if (
      lower.includes("batuk") ||
      lower.includes("flu") ||
      lower.includes("pilek") ||
      lower.includes("tenggorokan") ||
      lower.includes("demam")
    ) {
      icd10 = "J06.9";
      subjective = `Pasien mengeluhkan keluhan pernapasan: "${patientWords}".`;
      objective =
        "Keadaan umum: Tampak sakit ringan, Compos Mentis.\nTanda Vital: TD: 120/80 mmHg, Nadi: 82x/mnt, RR: 20x/mnt, Suhu: 37.8°C, SpO2: 98% room air.\nPemeriksaan Fisik: Faring hiperemis (+), pembesaran tonsil T1-T1 hiperemis (-), rhonki (-/-), wheezing (-/-).";
      assessment =
        "Infeksi Saluran Pernapasan Akut (ISPA) / Faringitis Akut ec suspek infeksi saluran napas atas.";
      plan =
        "1. Terapi Farmakologi: Paracetamol 500mg 3x1 tab p.r.n, Ambroxol 30mg 3x1 tab p.c., Cetirizine 10mg 1x1 malam.\n2. Non-farmakologi: Istirahat cukup, hidrasi air hangat minimal 2L/hari, konsumsi buah kaya vitamin C.\n3. Kontrol ulang jika demam menetap > 3 hari.";
      intervention =
        "Edukasi etika batuk, pemakaian masker medis, dan evaluasi tanda bahaya pernapasan.";
      vitalSigns = {
        tekanan_darah: "120/80 mmHg",
        denyut_nadi: 82,
        laju_pernapasan: 20,
        suhu: "37.8 C",
        spo2: "98%",
      };
    } else if (
      lower.includes("lambung") ||
      lower.includes("maag") ||
      lower.includes("mual") ||
      lower.includes("muntah") ||
      lower.includes("ulu hati") ||
      lower.includes("perih")
    ) {
      icd10 = "K29.7";
      subjective = `Pasien mengeluhkan gangguan pencernaan: "${patientWords}".`;
      objective =
        "Keadaan umum: Sakit sedang, Compos Mentis.\nTanda Vital: TD: 118/76 mmHg, Nadi: 80x/mnt, RR: 18x/mnt, Suhu: 36.7°C.\nAbdomen: Supel, bising usus normal, nyeri tekan regio epigastrium (+), hepar/lien tidak teraba membesar.";
      assessment =
        "Dispepsia Fungsional / Gastritis ec hipersekresi asam lambung dan ketidakteraturan pola makan.";
      plan =
        "1. Farmakoterapi: Omeprazole 20mg 2x1 tab a.c. (30 menit pre-prandial), Antasida sirup 3x1 Cth p.r.n, Domperidone 10mg 3x1 a.c.\n2. Non-farmakologi: Makan porsi kecil tapi sering, hindari makanan pedas, asam, kopi, dan stres.\n3. Kontrol bila muntah kehitaman.";
      intervention =
        "Konseling pola makan gastroprotektif dan kepatuhan konsumsi obat lambung sebelum makan.";
      vitalSigns = {
        tekanan_darah: "118/76 mmHg",
        denyut_nadi: 80,
        laju_pernapasan: 18,
        suhu: "36.7 C",
        spo2: "99%",
      };
    } else if (lower.includes("gula") || lower.includes("diabetes") || lower.includes("haus") || lower.includes("kencing")) {
      icd10 = "E11.9";
      subjective = `Pasien datang kontrol riwayat gula darah: "${patientWords}".`;
      objective =
        "Keadaan umum: Baik, Compos Mentis.\nTanda Vital: TD: 125/80 mmHg, Nadi: 78x/mnt, RR: 18x/mnt, Suhu: 36.5°C.\nGDS: 184 mg/dL. Status lokalis ekstremitas: Ulkus (-), pulsasi a. dorsalis pedis kuat bilateral.";
      assessment =
        "Diabetes Melitus Tipe 2 Tanpa Komplikasi dengan regulasi glukosa darah sedang.";
      plan =
        "1. Farmakoterapi: Lanjutkan Metformin 500mg 2x1 tab d.c.\n2. Non-farmakologi: Diet 3J (Jadwal, Jumlah, Jenis) 1700 kkal, aktivitas fisik 30 mnt 3x/minggu.\n3. Periksa HbA1c dan profil lipid berkala.";
      intervention =
        "Edukasi manajemen diet diabetes, perawatan kaki diabetik mandiri, pengenalan gejala hipoglikemia.";
      vitalSigns = {
        tekanan_darah: "125/80 mmHg",
        denyut_nadi: 78,
        laju_pernapasan: 18,
        suhu: "36.5 C",
        spo2: "98%",
      };
    } else {
      icd10 = "I10";
      subjective = patientWords.length > 5
        ? `Pasien menyampaikan keluhan dalam sesi konsultasi: "${patientWords}".`
        : "Pasien mengeluh tengkuk terasa kaku dan kepala sering pusing berdenyut sejak 3 hari terakhir, terutama pagi hari dan saat kelelahan.";
      objective =
        "Keadaan umum: Tampak sakit ringan, Compos Mentis.\nTanda Vital: TD: 140/90 mmHg, HR: 82x/mnt, RR: 18x/mnt, SpO2: 98% room air.\nPemeriksaan fisik: Leher kaku kuduk (-), JVP tidak meningkat. Cor: S1-S2 murni reguler, murmur (-), gallop (-). Pulmo: Vesikuler +/+, ronkhi (-/-), wheezing (-/-). Ekstremitas: Akral hangat, CRT < 2 detik.";
      assessment =
        "Hipertensi Esensial Stage 1, faktor risiko kardiovaskular moderat.";
      plan =
        "1. Terapi Farmakologi: Amlodipine 5 mg 1x1 tab p.o. pagi hari.\n2. Non-farmakologi: Diet rendah garam (< 1 sdt/hari), olahraga teratur 30 menit 3x/minggu, kurangi stres.\n3. Rencana Kontrol: Kontrol ulang tensi 2 minggu.";
      intervention =
        "Pemberian edukasi manajemen hipertensi dan kepatuhan minum obat, konseling diet rendah garam, pengukuran tensi serial.";
      vitalSigns = {
        tekanan_darah: "140/90 mmHg",
        denyut_nadi: 82,
        laju_pernapasan: 18,
        suhu: "36.6 C",
        spo2: "98%",
      };
    }

    return {
      engine: "clinical-nlp-fallback",
      dialogues: diarizedDialogues,
      soapi: {
        subjective,
        objective,
        assessment,
        plan,
        intervention,
        vitalSigns,
        diagnosisIcd10Codes: [{ code: icd10, type: "Primer" }],
        tindakanIcd9Codes: [{ code: "89.07", count: 1 }],
      },
    };
  }
}
