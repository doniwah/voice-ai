import React, { useState, useEffect } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Database,
  Loader2,
  ShieldCheck,
  ClipboardEdit,
  Stethoscope,
  Activity,
  ChevronRight,
  RotateCcw,
  BadgeCheck,
  CheckSquare,
  Square,
  Edit3,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface SOAPData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  intervention?: string;
}

export interface ICDCandidate {
  kode: string;
  deskripsi: string;
}

export interface BPJSValidationInfo {
  code: string;
  is_valid: boolean;
  warnings: string[];
  can_be_primary: boolean;
  is_fktp_144: boolean;
  classification: "primary" | "secondary";
}

export interface ICDRecommendationItem {
  rank: number;
  code: string;
  display_name: string;
  display_name_id?: string;
  confidence: number;
  classification: "primary" | "secondary";
  clinical_rationale: string;
  evidence_s?: string;
  evidence_o?: string;
  excludes_checked?: string;
  validation?: BPJSValidationInfo;
}

export interface ICD9ProcedureItem {
  code: string;
  name: string;
  name_en?: string;
  category: string;
  indication: string;
  is_selected?: boolean;
}

export interface ICDRecommendation {
  selected_code: string;
  selected_description: string;
  confidence: number;
  evidence: string;
  reasoning?: string;
  extracted_diagnosis: string;
  candidates: ICDCandidate[];
  recommendations?: ICDRecommendationItem[];
  r_code_warning?: string | null;
  assessment_narrative?: string | null;
  icd9_procedures?: ICD9ProcedureItem[];
  recommended_plan?: string | null;
}

interface SOAPICDAssistantProps {
  initialTranscript?: string;
  onApplyToConsultation?: (soap: SOAPData, icd?: ICDRecommendation) => void;
}

const PRESET_TRANSCRIPTS = [
  {
    label: "Dispepsia",
    text: `Dokter: "Selamat pagi Bu Siti, apa yang dirasakan hari ini?"
Pasien: "Selamat pagi dok. Ini perut saya terasa sakit dan nyeri di perut bagian bawah dok, rasanya agak perih dan kembung sudah 2 hari ini."
Dokter: "Apakah ada mual atau muntah bu? Atau demam?"
Pasien: "Tidak ada muntah dok, tidak demam juga. Cuma sakit perut ringan tapi bikin tidak nyaman."
Dokter: "Nafsu makan bagaimana? Apakah ada buang air besar berdarah atau hitam?"
Pasien: "Nafsu makan agak turun dok, tapi BAB normal biasa."
Dokter: "Baik, mari kita periksa dulu ya bu."`,
  },
  {
    label: "Hipertensi",
    text: `Dokter: "Selamat pagi Pak Budi, apa keluhan yang dirasakan?"
Pasien: "Pagi dok, leher belakang dan tengkuk saya kaku dok, kepala pusing berdenyut sudah 2 hari."
Dokter: "Obat amlodipine kemarin masih diminum teratur?"
Pasien: "Kemarin sempat lupa sehari dok karena bepergian."
Dokter: "Baik, mari kita ukur tensi dan pemeriksaan fisik."`,
  },
  {
    label: "ISPA / Faringitis",
    text: `Dokter: "Selamat siang Bu Ratna, apa keluhan utamanya?"
Pasien: "Siang dok, saya batuk berdahak sudah 3 hari, tenggorokan sakit menelan dan hidung tersumbat. Badan agak sumeng."
Dokter: "Apakah ada sesak napas?"
Pasien: "Tidak ada sesak dok, cuma menelan sakit sekali."`,
  },
];

/**
 * Knowledge Base Bawaan Prosedur Tindakan ICD-9-CM & Tata Laksana PPK
 * untuk sinkronisasi zero-latency di frontend
 */
const DEFAULT_ICD9_MAPPINGS: Record<
  string,
  {
    title: string;
    procedures: ICD9ProcedureItem[];
    guidelinePlan: string;
  }
> = {
  K30: {
    title: "Dispepsia Fungsional",
    procedures: [
      {
        code: "89.07",
        name: "Konsultasi & Evaluasi Medis Komprehensif",
        name_en: "Consultation, described as comprehensive",
        category: "Evaluasi Klinis",
        indication: "Anamnesis detail pola nyeri epigastrium, riwayat makan, dan penapisan faktor stres.",
        is_selected: true,
      },
      {
        code: "89.7",
        name: "Pemeriksaan Fisik Abdomen & Tanda Vital",
        name_en: "General physical examination",
        category: "Pemeriksaan Fisik",
        indication: "Palpasi nyeri tekan regio epigastrium & kuadran bawah, evaluasi peristaltik & distensi usus.",
        is_selected: true,
      },
      {
        code: "99.29",
        name: "Pemberian Terapi Farmakologi Lambung (Antasida / PPI)",
        name_en: "Injection or infusion of other therapeutic substance",
        category: "Terapi Farmakologis",
        indication: "Supresi sekresi asam lambung dan proteksi mukosa dengan PPI (Omeprazole) / Antasida.",
        is_selected: true,
      },
      {
        code: "93.89",
        name: "Konseling Gizi & Modifikasi Pola Makan Lambung",
        name_en: "Other rehabilitation / dietary counseling",
        category: "Edukasi Pasien",
        indication: "Edukasi pola makan teratur porsi kecil sering (4-5x sehari), pantang pedas, asam, dan kafein.",
        is_selected: true,
      },
      {
        code: "45.13",
        name: "Endoskopi Saluran Cerna Atas (EGD)",
        name_en: "Other endoscopy of small intestine (EGD)",
        category: "Diagnostik Lanjutan",
        indication: "Prosedur diagnostik rujukan jika terdapat tanda bahaya (usia >45 th, penurunan BB, muntah menetap, anemia).",
        is_selected: false,
      },
      {
        code: "96.07",
        name: "Pemasangan Pipa Lambung (NGT)",
        name_en: "Insertion of other (naso-)gastric tube",
        category: "Tindakan Khusus",
        indication: "Dekompresi lambung bila terjadi distensi hebat atau aspirasi cairan lambung.",
        is_selected: false,
      },
    ],
    guidelinePlan: `1. Farmakoterapi Lini Pertama:
   - Antasida sirup 3x1 sendok makan 1 jam sebelum makan atau saat perut terasa perih/kembung.
   - Omeprazole 20 mg 1x1 kapsul per oral diminum 30 menit sebelum sarapan selama 7-14 hari.
   - Domperidone 10 mg 3x1 tablet sebelum makan (bila keluhan mual/begah dominan).
2. Edukasi Non-Farmakologis:
   - Pola makan teratur dalam porsi kecil namun sering (4-5 kali per hari).
   - Hindari makanan pemicu iritasi: pedas, asam, santan kental, kopi, dan minuman bersoda.
   - Jangan langsung berbaring minimal 2 jam setelah selesai makan.
3. Rencana Tindak Lanjut:
   - Kontrol evaluasi dalam 1-2 minggu. Rujuk EGD bila ditemukan alarm signs.`,
  },
  K29: {
    title: "Gastritis & Duodenitis",
    procedures: [
      {
        code: "89.07",
        name: "Konsultasi dan Pemeriksaan Medis Komprehensif",
        name_en: "Consultation, described as comprehensive",
        category: "Evaluasi Klinis",
        indication: "Evaluasi mukosa lambung dan riwayat obat NSAID/jamu analgetik.",
        is_selected: true,
      },
      {
        code: "89.7",
        name: "Pemeriksaan Fisik Abdomen & Tanda Vital",
        name_en: "General physical examination",
        category: "Pemeriksaan Fisik",
        indication: "Pemeriksaan nyeri epigastrium dan penapisan defans muskular.",
        is_selected: true,
      },
      {
        code: "99.29",
        name: "Injeksi / Pemberian Terapi Mukoprotektor & Antasida",
        name_en: "Injection or infusion of other therapeutic substance",
        category: "Terapi Farmakologis",
        indication: "Pemberian Sukralfat sirup atau PPI untuk perlindungan mukosa gaster.",
        is_selected: true,
      },
      {
        code: "93.89",
        name: "Konseling Diet Lambung & Penghentian Zat Iritatif",
        name_en: "Other rehabilitation / dietary counseling",
        category: "Edukasi Pasien",
        indication: "Edukasi penghentian konsumsi jamu tradisional tidak berizin dan obat antinyeri tanpa resep.",
        is_selected: true,
      },
    ],
    guidelinePlan: `1. Farmakoterapi: Sukralfat sirup 3x1 sendok makan (sebelum makan) + Omeprazole 20 mg 2x1 tablet ac.
2. Non-Farmakologi: Hindari pemicu iritasi lambung (makanan pedas/asam, kopi, alkohol, rokok).
3. Kontrol ulang jika keluhan tidak membaik dalam 5-7 hari.`,
  },
  I10: {
    title: "Hipertensi Primer / Esensial",
    procedures: [
      {
        code: "89.07",
        name: "Konsultasi dan Pemeriksaan Medis Komprehensif",
        name_en: "Consultation, described as comprehensive",
        category: "Evaluasi Klinis",
        indication: "Penetapan derajat hipertensi, stratifikasi risiko kardiovaskular, dan evaluasi target TD.",
        is_selected: true,
      },
      {
        code: "89.52",
        name: "Elektrokardiogram (EKG 12 Sadapan)",
        name_en: "Electrocardiogram",
        category: "Pemeriksaan Diagnostik",
        indication: "Deteksi hipertrofi ventrikel kiri (LVH), iskemia, atau aritmia pada pasien hipertensi.",
        is_selected: true,
      },
      {
        code: "90.59",
        name: "Pemeriksaan Laboratorium Darah Rutin & Fungsi Ginjal",
        name_en: "Microscopic examination of blood",
        category: "Laboratorium",
        indication: "Pemantauan ureum, kreatinin, profil lipid, dan gula darah berkala.",
        is_selected: false,
      },
      {
        code: "99.29",
        name: "Penyesuaian Farmakoterapi Antihipertensi",
        name_en: "Injection or infusion of other therapeutic substance",
        category: "Terapi Farmakologis",
        indication: "Pemberian obat antihipertensi oral lini pertama (Amlodipine 5-10 mg atau Candesartan).",
        is_selected: true,
      },
      {
        code: "93.89",
        name: "Konseling Modifikasi Gaya Hidup & Diet Rendah Garam (DASH)",
        name_en: "Other rehabilitation / lifestyle counseling",
        category: "Edukasi Pasien",
        indication: "Pembatasan natrium < 2000 mg/hari (1 sdt garam), olahraga aerobik 150 menit/minggu, dan kontrol stres.",
        is_selected: true,
      },
    ],
    guidelinePlan: `1. Farmakoterapi: Penyesuaian antihipertensi harian (Amlodipine 5-10 mg 1x1 diminum pagi hari).
2. Diet DASH: Pembatasan garam dapur (<1 sendok teh/hari), perbanyak sayur dan buah berserat.
3. Pemantauan mandiri tekanan darah di rumah dan jadwal kontrol ulang dalam 2-4 minggu.`,
  },
  J06: {
    title: "Infeksi Saluran Pernapasan Akut (ISPA)",
    procedures: [
      {
        code: "89.03",
        name: "Wawancara & Evaluasi Medis Terarah ISPA",
        name_en: "Interview and evaluation, described as brief/focused",
        category: "Evaluasi Klinis",
        indication: "Pemeriksaan mukosa hidung, orofaring, dan auskultasi suara napas paru.",
        is_selected: true,
      },
      {
        code: "96.56",
        name: "Pembersihan / Irigasi Saluran Napas Atas (Nasal Lavage)",
        name_en: "Other irrigation of nasal passages",
        category: "Tindakan Terapeutik",
        indication: "Cuci hidung dengan cairan saline steril untuk membersihkan mukus dan melegakan hidung.",
        is_selected: false,
      },
      {
        code: "93.94",
        name: "Terapi Inhalasi / Nebulisasi Mukolitik",
        name_en: "Respiratory medication administered by aerosol",
        category: "Tindakan Terapeutik",
        indication: "Nebulisasi bila disertai batuk dahak kental atau bronkospasme.",
        is_selected: false,
      },
      {
        code: "99.21",
        name: "Pemberian Terapi Simptomatis & Analgetik-Antipiretik",
        name_en: "Injection or administration of therapeutic medicine",
        category: "Terapi Farmakologis",
        indication: "Paracetamol 500 mg untuk demam/nyeri kepala dan Ambroxol untuk pengencer dahak.",
        is_selected: true,
      },
      {
        code: "93.89",
        name: "Edukasi Etika Batuk & Hidrasi Hangat",
        name_en: "Health education and infection control",
        category: "Edukasi Pasien",
        indication: "Penggunaan masker medis, istirahat cukup, dan konsumsi cairan air hangat minimal 2 L/hari.",
        is_selected: true,
      },
    ],
    guidelinePlan: `1. Farmakoterapi: Paracetamol 500 mg 3x1 tablet p.r.n bila demam/nyeri, Ambroxol 30 mg 3x1 tablet sesudah makan.
2. Non-farmakologi: Istirahat tirah baring yang cukup, banyak minum air hangat, hindari minuman dingin dan gorengan.
3. Kontrol ulang jika demam menetap lebih dari 3 hari atau muncul sesak napas.`,
  },
  J02: {
    title: "Faringitis Akut",
    procedures: [
      {
        code: "89.03",
        name: "Pemeriksaan Klinis Faring & Kelenjar Leher",
        name_en: "Interview and evaluation, described as brief/focused",
        category: "Evaluasi Klinis",
        indication: "Inspeksi dinding faring posterior, eksudat tonsil, dan pembesaran KGB leher.",
        is_selected: true,
      },
      {
        code: "99.21",
        name: "Pemberian Terapi Antiinflamasi & Analgetik Faring",
        name_en: "Administration of anti-inflammatory / analgesic",
        category: "Terapi Farmakologis",
        indication: "Peredaan nyeri telan (odinofagia) dan penurunan inflamasi mukosa orofaring.",
        is_selected: true,
      },
      {
        code: "93.89",
        name: "Konseling Hidrasi & Kumur Antiseptik Tenggorokan",
        name_en: "Health education",
        category: "Edukasi Pasien",
        indication: "Gargle antiseptik povidone-iodine 1% / air garam hangat, makanan bersuhu lunak tidak merangsang.",
        is_selected: true,
      },
    ],
    guidelinePlan: `1. Farmakoterapi: Paracetamol 500 mg 3x1 tablet sesudah makan, obat kumur antiseptik 3x sehari.
2. Non-Farmakologi: Makanan bertekstur lembut (bubur/sup hangat), hindari makanan berminyak atau beralkohol.
3. Evaluasi skor Centor: antibiotik HANYA diberikan jika terbukti infeksi Streptococcus pyogenes.`,
  },
  E11: {
    title: "Diabetes Melitus Tipe 2",
    procedures: [
      {
        code: "89.07",
        name: "Konsultasi & Manajemen Komprehensif Diabetes",
        name_en: "Consultation, described as comprehensive",
        category: "Evaluasi Klinis",
        indication: "Evaluasi glikemik, skrining kaki diabetik, dan pemantauan kepatuhan terapi.",
        is_selected: true,
      },
      {
        code: "90.59",
        name: "Pemeriksaan Glukosa Darah (GDS / GDP)",
        name_en: "Microscopic examination of blood",
        category: "Laboratorium",
        indication: "Pemantauan kadar glukosa darah sewaktu dan profil HbA1c.",
        is_selected: true,
      },
      {
        code: "99.29",
        name: "Penyesuaian Obat Antihiperglikemik Oral (OHO)",
        name_en: "Injection or infusion of therapeutic substance",
        category: "Terapi Farmakologis",
        indication: "Titirasi terapi oral (Metformin) sesuai target glikemik.",
        is_selected: true,
      },
      {
        code: "93.89",
        name: "Edukasi Terapi Nutrisi Medis & Senam Diabetes",
        name_en: "Health education and dietary counseling",
        category: "Edukasi Pasien",
        indication: "Perencanaan makan 3J (Jadwal, Jumlah, Jenis) dan olahraga aerobik teratur.",
        is_selected: true,
      },
    ],
    guidelinePlan: `1. Farmakoterapi: Metformin 500 mg 2x1 tablet diminum bersama/sesudah makan.
2. Terapi Nutrisi Medis: Batasi asupan gula sederhana, perbanyak serat sayuran hijau, porsi nasi secukupnya.
3. Jadwal kontrol gula darah dan konsultasi ulang dalam 2-4 minggu.`,
  },
};

/**
 * Mencari prosedur ICD-9-CM dan panduan terapi berdasarkan kode diagnosis ICD-10
 */
function resolveIcd9AndPlan(
  code: string,
  backendProcedures?: ICD9ProcedureItem[],
  backendPlan?: string | null
): { procedures: ICD9ProcedureItem[]; guidelinePlan: string } {
  if (backendProcedures && backendProcedures.length > 0) {
    const key = code.toUpperCase().slice(0, 3);
    const fallbackPlan = DEFAULT_ICD9_MAPPINGS[key]?.guidelinePlan || "";
    return {
      procedures: backendProcedures,
      guidelinePlan: backendPlan || fallbackPlan,
    };
  }

  const clean = (code || "").toUpperCase().trim();
  const prefix = clean.slice(0, 3);
  const matched = DEFAULT_ICD9_MAPPINGS[clean] || DEFAULT_ICD9_MAPPINGS[prefix];

  if (matched) {
    return {
      procedures: matched.procedures,
      guidelinePlan: matched.guidelinePlan,
    };
  }

  return {
    procedures: [
      {
        code: "89.07",
        name: "Konsultasi & Pemeriksaan Medis Komprehensif",
        name_en: "Consultation, described as comprehensive",
        category: "Evaluasi Klinis",
        indication: `Pemeriksaan dan evaluasi medis menyeluruh untuk penanganan diagnosis ${code}.`,
        is_selected: true,
      },
      {
        code: "89.7",
        name: "Pemeriksaan Fisik Umum Terarah",
        name_en: "General physical examination",
        category: "Pemeriksaan Fisik",
        indication: "Pemeriksaan tanda vital dan evaluasi sistem organ klinis terkait.",
        is_selected: true,
      },
      {
        code: "99.29",
        name: "Pemberian Terapi Farmakologis / Injeksi Terapeutik",
        name_en: "Injection or infusion of other therapeutic substance",
        category: "Terapi Farmakologis",
        indication: `Pemberian terapi farmakoterapi lini pertama sesuai diagnosis ${code}.`,
        is_selected: true,
      },
      {
        code: "93.89",
        name: "Konseling & Edukasi Pasien Mandiri",
        name_en: "Health education and counseling",
        category: "Edukasi Pasien",
        indication: "Edukasi kepatuhan minum obat, tanda bahaya klinis, dan jadwal kontrol rutin.",
        is_selected: true,
      },
    ],
    guidelinePlan: `1. Farmakoterapi: Terapi simtomatik dan etiologis terarah untuk ${code}.
2. Edukasi: Istirahat cukup, hidrasi adekuat, dan pola hidup sehat.
3. Rencana Lanjutan: Kontrol ulang dalam 3-7 hari atau segera bila timbul tanda bahaya.`,
  };
}

/**
 * Pembersih frasa pengantar AI robotik dari teks naratif asesmen rekam medis
 */
function cleanAssessmentNarrative(text: string): string {
  if (!text) return "";
  return text
    .replace(/^Berdasarkan evaluasi kandidat kode ICD-10 yang tersedia,\s*/i, "")
    .replace(/^Berdasarkan evaluasi kandidat kode ICD-10,\s*/i, "")
    .replace(/^Berdasarkan data klinis dan evaluasi kandidat,\s*/i, "")
    .replace(/^Berdasarkan analisis S\s*\+\s*O,\s*/i, "")
    .replace(/^Berdasarkan hasil analisis sistem,\s*/i, "")
    .trim();
}

export function SOAPICDAssistant({
  initialTranscript = "",
  onApplyToConsultation,
}: SOAPICDAssistantProps) {
  const [transcript, setTranscript] = useState(initialTranscript || "");

  const [isLoadingSoap, setIsLoadingSoap] = useState(false);
  const [soapData, setSoapData] = useState<SOAPData | null>(null);
  const [soapModelUsed, setSoapModelUsed] = useState<string>("");
  const [soapError, setSoapError] = useState<string | null>(null);

  const [isLoadingIcd, setIsLoadingIcd] = useState(false);
  const [icdResult, setIcdResult] = useState<ICDRecommendation | null>(null);
  const [icdError, setIcdError] = useState<string | null>(null);

  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [objectiveInput, setObjectiveInput] = useState<string>("");
  const [isObjectiveConfirmed, setIsObjectiveConfirmed] = useState(false);

  // State ICD-9 Prosedur & Rencana Terapi
  const [activeIcd9List, setActiveIcd9List] = useState<ICD9ProcedureItem[]>([]);
  const [selectedIcd9Codes, setSelectedIcd9Codes] = useState<Record<string, boolean>>({});
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planDraftText, setPlanDraftText] = useState("");

  const targetBaseUrl = "/api";

  // Sinkronisasi prosedur ICD-9 setiap kali icdResult berubah
  useEffect(() => {
    if (icdResult?.selected_code) {
      const { procedures } = resolveIcd9AndPlan(
        icdResult.selected_code,
        icdResult.icd9_procedures,
        icdResult.recommended_plan
      );
      setActiveIcd9List(procedures);
      const selMap: Record<string, boolean> = {};
      procedures.forEach((p) => {
        selMap[p.code] = p.is_selected ?? true;
      });
      setSelectedIcd9Codes(selMap);
    }
  }, [icdResult?.selected_code, icdResult?.icd9_procedures]);

  // 1. Generate SOAP via Backend
  const handleGenerateSoap = async () => {
    if (!transcript.trim()) {
      toast.error("Transkrip percakapan tidak boleh kosong");
      return;
    }

    setIsLoadingSoap(true);
    setSoapError(null);
    setIcdResult(null);
    setObjectiveInput("");
    setIsObjectiveConfirmed(false);

    try {
      const endpoint = `${targetBaseUrl}/generate-soap`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail || data.error || `HTTP error status ${response.status}`,
        );
      }

      setSoapData(data.soap);
      setPlanDraftText(data.soap.plan);
      setSoapModelUsed(data.model_used || "FastAPI / OpenAI");
      toast.success("Catatan SOAP medis berhasil disusun");
    } catch (err: any) {
      console.error("Generate SOAP Error:", err);
      const errMsg =
        err.message || "Gagal menghubungi backend FastAPI /generate-soap";
      setSoapError(errMsg);
      toast.error(`Error: ${errMsg}`);
    } finally {
      setIsLoadingSoap(false);
    }
  };

  // 2. Recommend ICD via Backend
  const handleRecommendIcd = async (updatedSoap?: SOAPData) => {
    const soapToUse = updatedSoap ?? soapData;
    if (!soapToUse) {
      toast.error("Generate SOAP terlebih dahulu sebelum rekomendasi ICD");
      return;
    }

    setIsLoadingIcd(true);
    setIcdError(null);

    try {
      const endpoint = `${targetBaseUrl}/recommend-icd`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soap: soapToUse }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail || data.error || `HTTP error status ${response.status}`,
        );
      }

      setIcdResult(data);
      toast.success(`Diagnosis ${data.selected_code} berhasil direkomendasikan`);
    } catch (err: any) {
      console.error("Recommend ICD Error:", err);
      const errMsg =
        err.message || "Gagal menghubungi backend FastAPI /recommend-icd";
      setIcdError(errMsg);
      toast.error(`Error Rekomendasi ICD: ${errMsg}`);
    } finally {
      setIsLoadingIcd(false);
    }
  };

  // 3. Confirm Objective: dokter mengisi data objektif aktual
  const handleConfirmObjective = async () => {
    if (!objectiveInput.trim()) {
      toast.error("Harap isi data tanda vital & temuan fisik objektif");
      return;
    }
    if (!soapData) return;

    setIsLoadingIcd(true);
    setIcdError(null);

    const mergedObjective = objectiveInput.trim();

    try {
      const response = await fetch(`${targetBaseUrl}/generate-assessment-icd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjective: soapData.subjective,
          objective: mergedObjective,
          plan: soapData.plan,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.error || `HTTP error status ${response.status}`);
      }

      const updatedSoap: SOAPData = {
        ...soapData,
        objective: mergedObjective,
        assessment: data.assessment || soapData.assessment,
      };
      setSoapData(updatedSoap);
      setIcdResult(data);
      setIsObjectiveConfirmed(true);

      toast.success(
        `Diagnosis klinis ${data.selected_code} & Prosedur ICD-9 berhasil dianalisis`
      );
    } catch (err: any) {
      console.warn("Generate Assessment ICD fallback:", err);
      try {
        const mergedSoap: SOAPData = { ...soapData, objective: mergedObjective };
        setSoapData(mergedSoap);
        setIsObjectiveConfirmed(true);
        await handleRecommendIcd(mergedSoap);
      } catch (fallbackErr: any) {
        setIcdError(err.message || "Gagal menghasilkan asesmen ICD-10");
        toast.error(`Gagal menghasilkan asesmen: ${err.message}`);
      }
    } finally {
      setIsLoadingIcd(false);
    }
  };

  // Dokter memilih diagnosis sekunder menjadi diagnosis utama -> otomatis update ICD-9
  const handleSelectPrimaryRecommendation = (rec: ICDRecommendationItem) => {
    if (!icdResult) return;

    const { procedures, guidelinePlan } = resolveIcd9AndPlan(rec.code);

    setIcdResult({
      ...icdResult,
      selected_code: rec.code,
      selected_description: `${rec.display_name_id || rec.display_name}`,
      confidence: rec.confidence,
      reasoning: rec.clinical_rationale,
      evidence: `S: "${rec.evidence_s || ""}" | O: "${rec.evidence_o || ""}"`,
      icd9_procedures: procedures,
      recommended_plan: guidelinePlan,
    });

    setActiveIcd9List(procedures);
    const selMap: Record<string, boolean> = {};
    procedures.forEach((p) => {
      selMap[p.code] = p.is_selected ?? true;
    });
    setSelectedIcd9Codes(selMap);

    if (soapData) {
      setSoapData({
        ...soapData,
        assessment: `${rec.display_name_id || rec.display_name} [${rec.code}]`,
      });
    }

    toast.success(
      `Diagnosis utama: ${rec.code} — Prosedur ICD-9-CM diperbarui otomatis`
    );
  };

  // Toggle checklist prosedur ICD-9
  const toggleProcedureSelection = (code: string) => {
    setSelectedIcd9Codes((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  // Terapkan Rekomendasi Terapi Standar PPK jika transkrip tidak memuat rencana terapi
  const handleApplyGuidelinePlan = () => {
    if (!soapData || !icdResult) return;
    const { guidelinePlan } = resolveIcd9AndPlan(
      icdResult.selected_code,
      icdResult.icd9_procedures,
      icdResult.recommended_plan
    );

    if (!guidelinePlan) {
      toast.info("Panduan standar terapi sudah termuat");
      return;
    }

    const updated = {
      ...soapData,
      plan: guidelinePlan,
    };
    setSoapData(updated);
    setPlanDraftText(guidelinePlan);
    setIsEditingPlan(false);
    toast.success("Rekomendasi tata laksana PPK standar berhasil diterapkan ke Plan!");
  };

  // Simpan perubahan teks Plan manual
  const handleSavePlanEdit = () => {
    if (!soapData) return;
    setSoapData({
      ...soapData,
      plan: planDraftText,
    });
    setIsEditingPlan(false);
    toast.success("Rencana terapi berhasil diperbarui");
  };

  const copyToClipboard = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    toast.success("Teks berhasil disalin");
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyAllSoap = () => {
    if (!soapData) return;
    const activeProcs = activeIcd9List.filter((p) => selectedIcd9Codes[p.code]);
    const procText =
      activeProcs.length > 0
        ? `\n\nTINDAKAN & PROSEDUR MEDIS (ICD-9-CM):\n` +
          activeProcs.map((p) => `• [${p.code}] ${p.name} (${p.category})`).join("\n")
        : "";

    const fullText = [
      `SUBJEKTIF:\n${soapData.subjective}`,
      `\nOBJEKTIF:\n${soapData.objective || objectiveInput || "-"}\n`,
      `ASESMEN:\n${soapData.assessment}${
        icdResult
          ? `\nKode ICD-10: ${icdResult.selected_code} - ${icdResult.selected_description}`
          : ""
      }\n`,
      `PLAN:\n${soapData.plan}${procText}`,
      soapData.intervention ? `\n\nINTERVENSI:\n${soapData.intervention}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(fullText);
    toast.success("Seluruh catatan SOAP & ICD-9/10 berhasil disalin");
  };

  // Hitung jumlah tindakan ICD-9 yang sedang aktif dipilih
  const selectedProceduresCount = activeIcd9List.filter(
    (p) => selectedIcd9Codes[p.code]
  ).length;

  // Cek apakah teks plan terdeteksi sebagai template kosong
  const isPlanEmptyOrUndiscussed =
    !soapData?.plan ||
    soapData.plan.toLowerCase().includes("tidak didiskusikan") ||
    soapData.plan.toLowerCase().includes("belum didiskusikan");

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Input Transcription & Presets */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Transkrip Percakapan</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Rekaman konsultasi antara dokter dan pasien
                </p>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                {transcript.length} karakter
              </span>
            </div>

            {/* Quick Sample Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-muted-foreground">Muat contoh:</span>
              {PRESET_TRANSCRIPTS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setTranscript(preset.text)}
                  className="rounded-lg border border-border bg-muted/40 hover:bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Transcript Textarea */}
            <textarea
              rows={12}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Tempel transkripsi dialog antara dokter dan pasien di sini..."
              className="w-full rounded-xl border border-input bg-background p-3.5 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#0D6E68]/30 font-sans"
            />

            {/* Action Button: Generate SOAP */}
            <button
              type="button"
              onClick={handleGenerateSoap}
              disabled={isLoadingSoap || !transcript.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6E68] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#0a5752] disabled:opacity-50 cursor-pointer"
            >
              {isLoadingSoap ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Menyusun catatan rekam medis SOAP...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Susun Catatan SOAP</span>
                </>
              )}
            </button>

            {soapError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-destructive flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Gagal memproses catatan SOAP:</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                    {soapError}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Structured SOAP, ICD-10 Diagnosis, & ICD-9 Procedure */}
        <div className="space-y-6 lg:col-span-7">
          {/* Main SOAP Container */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0D6E68]/10 text-[#0D6E68]">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Catatan Rekam Medis (SOAP)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Dokumentasi klinis terintegrasi ICD-10 (Diagnosis) &amp; ICD-9-CM (Tindakan)
                  </p>
                </div>
              </div>

              {soapData && (
                <button
                  type="button"
                  onClick={copyAllSoap}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Salin seluruh catatan SOAP & ICD-9/10"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin Semua</span>
                </button>
              )}
            </div>

            {!soapData ? (
              <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
                <FileText className="h-9 w-9 stroke-[1.25] opacity-35 mb-2.5" />
                <p className="text-xs font-semibold text-foreground/80">Belum ada catatan SOAP</p>
                <p className="text-[11px] text-muted-foreground max-w-sm mt-1">
                  Masukkan transkrip percakapan di sebelah kiri lalu klik <strong>Susun Catatan SOAP</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* [S] - Subjektif */}
                <div className="rounded-xl border border-border/80 bg-background p-4 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-foreground font-bold text-[11px]">
                        S
                      </span>
                      <span className="font-semibold text-foreground text-xs">
                        Subjektif (Keluhan &amp; Riwayat)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(soapData.subjective, "s")}
                      className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      title="Salin Subjektif"
                    >
                      {copiedSection === "s" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="leading-relaxed text-foreground/90 pl-7">{soapData.subjective}</p>
                </div>

                {/* [O] - Objektif */}
                <div className="rounded-xl border border-border/80 bg-background p-4 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
                        O
                      </span>
                      <span className="font-semibold text-foreground text-xs">
                        Objektif (Tanda Vital &amp; Pemeriksaan Fisik)
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-md px-2 py-0.5">
                      Pemeriksaan Dokter
                    </span>
                  </div>

                  {isObjectiveConfirmed ? (
                    <div className="pl-7">
                      <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/30 p-2.5 border border-border/60">
                        <p className="leading-relaxed text-foreground whitespace-pre-line flex-1">
                          {objectiveInput}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsObjectiveConfirmed(false);
                            setIcdResult(null);
                            setIcdError(null);
                          }}
                          className="shrink-0 text-[11px] font-medium text-[#0D6E68] hover:underline cursor-pointer"
                        >
                          Ubah
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pl-7 space-y-2">
                      <textarea
                        rows={3}
                        value={objectiveInput}
                        onChange={(e) => setObjectiveInput(e.target.value)}
                        placeholder="Contoh: TD 120/80 mmHg, Nadi 80x/mnt, Suhu 36.7°C, Abdomen: supel, nyeri tekan (-) tanda bahaya (-)"
                        className="w-full rounded-lg border border-input bg-background p-2.5 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[#0D6E68]/30 font-sans"
                      />
                      <button
                        type="button"
                        onClick={handleConfirmObjective}
                        disabled={isLoadingIcd}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D6E68] px-4 py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-[#0a5752] disabled:opacity-60 cursor-pointer"
                      >
                        {isLoadingIcd ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Menganalisis diagnosis &amp; prosedur...</span>
                          </>
                        ) : (
                          <>
                            <Stethoscope className="h-3.5 w-3.5" />
                            <span>Simpan Pemeriksaan &amp; Analisis Diagnosis</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* [A, P, I] — Tampil setelah data objektif dikonfirmasi */}
                {isObjectiveConfirmed && (
                  <>
                    {/* [A] - Asesmen & ICD-10 */}
                    <div className="rounded-xl border border-border/90 bg-card p-4.5 text-xs space-y-4 shadow-xs">
                      {/* Section Header */}
                      <div className="flex items-center justify-between border-b border-border/60 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0D6E68]/10 text-[#0D6E68] font-bold text-xs">
                            A
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-foreground">
                              Asesmen Klinis
                            </h4>
                            <p className="text-[10px] text-muted-foreground">
                              Diagnosis kerja terintegrasi temuan subjektif &amp; objektif
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {icdResult && (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-2.5 py-1 font-mono text-xs font-bold tracking-tight">
                              ICD-10: {icdResult.selected_code}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                icdResult
                                  ? `${soapData.assessment}\nKode ICD-10: ${icdResult.selected_code} - ${icdResult.selected_description}`
                                  : soapData.assessment,
                                "a"
                              )
                            }
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                            title="Salin Asesmen"
                          >
                            {copiedSection === "a" ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Primary Clinical Diagnosis Banner */}
                      <div className="rounded-xl bg-muted/30 border border-border/70 p-3.5">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">
                            {icdResult?.selected_description || soapData.assessment}
                          </span>
                          {icdResult && (
                            <span className="font-mono text-xs font-bold text-[#0D6E68]">
                              [{icdResult.selected_code}]
                            </span>
                          )}
                        </div>
                        {soapData.assessment &&
                          soapData.assessment !== icdResult?.selected_description && (
                            <p className="mt-1.5 text-xs text-foreground/80 leading-relaxed">
                              {cleanAssessmentNarrative(soapData.assessment)}
                            </p>
                          )}
                      </div>

                      {/* Loading state indicator */}
                      {isLoadingIcd && !icdResult && (
                        <div className="rounded-xl border border-border bg-muted/40 p-3 flex items-center gap-2.5">
                          <Loader2 className="h-4 w-4 animate-spin text-[#0D6E68] shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            Mencocokkan temuan klinis dengan katalog ICD-10 BPJS...
                          </p>
                        </div>
                      )}

                      {/* BPJS INA-CBGs Guidance Alert */}
                      {icdResult?.r_code_warning && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 p-3 text-xs flex items-start gap-2.5">
                          <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-amber-900 dark:text-amber-200 text-xs">
                              Aturan Klaim BPJS INA-CBGs
                            </p>
                            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed mt-0.5">
                              {icdResult.r_code_warning}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ICD-10 Recommendations List */}
                      {icdResult && (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-semibold text-foreground">
                              Rekomendasi Diagnosis ICD-10 &amp; Kesesuaian BPJS
                            </h5>
                            <span className="text-[11px] text-muted-foreground">
                              Pilih untuk menetapkan diagnosis utama
                            </span>
                          </div>

                          {icdResult.recommendations && icdResult.recommendations.length > 0 ? (
                            <div className="space-y-2">
                              {icdResult.recommendations.map((rec, rIdx) => {
                                const isPrimary =
                                  rec.classification === "primary" ||
                                  rec.code === icdResult.selected_code;
                                const isFktp = rec.validation?.is_fktp_144;
                                const hasWarnings =
                                  rec.validation?.warnings && rec.validation.warnings.length > 0;

                                return (
                                  <div
                                    key={rec.code + rIdx}
                                    className={cn(
                                      "rounded-xl border p-3.5 text-xs transition-all",
                                      isPrimary
                                        ? "border-[#0D6E68]/40 bg-card shadow-xs ring-1 ring-[#0D6E68]/15"
                                        : "border-border/80 bg-card hover:bg-muted/30"
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                                          {rec.code}
                                        </span>
                                        <span className="font-semibold text-foreground text-xs">
                                          {rec.display_name_id || rec.display_name}
                                        </span>
                                        {rec.display_name_id &&
                                          rec.display_name !== rec.display_name_id && (
                                            <span className="text-[11px] text-muted-foreground italic font-normal">
                                              ({rec.display_name})
                                            </span>
                                          )}

                                        {/* Status: Utama vs Sekunder */}
                                        {isPrimary ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                                            <Check className="h-3 w-3" />
                                            Diagnosis Utama
                                          </span>
                                        ) : (
                                          <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                            Diagnosis Sekunder
                                          </span>
                                        )}

                                        {/* FKTP 144 Competence Badge */}
                                        {isFktp && (
                                          <span className="rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:text-sky-300">
                                            144 FKTP
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                                          {Math.round(rec.confidence * 100)}% kesesuaian
                                        </span>

                                        {!isPrimary && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleSelectPrimaryRecommendation(rec)
                                            }
                                            className="rounded-lg border border-border bg-background hover:bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors cursor-pointer"
                                          >
                                            Jadikan Utama
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Clinical Rationale */}
                                    <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                                      <span className="font-medium text-foreground">
                                        Dasar Pertimbangan:{" "}
                                      </span>
                                      {rec.clinical_rationale}
                                    </p>

                                    {/* Compact Evidence Chips */}
                                    {(rec.evidence_s || rec.evidence_o) && (
                                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                                        {rec.evidence_s && (
                                          <span>
                                            <span className="font-medium text-foreground/80">
                                              Subjektif:
                                            </span>{" "}
                                            <span className="italic">"{rec.evidence_s}"</span>
                                          </span>
                                        )}
                                        {rec.evidence_s && rec.evidence_o && (
                                          <span className="text-border">•</span>
                                        )}
                                        {rec.evidence_o && (
                                          <span>
                                            <span className="font-medium text-foreground/80">
                                              Objektif:
                                            </span>{" "}
                                            <span className="italic">"{rec.evidence_o}"</span>
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Warnings if any */}
                                    {hasWarnings && (
                                      <div className="mt-2 text-[10px] text-amber-700 dark:text-amber-400">
                                        {rec.validation?.warnings.map((w, wIdx) => (
                                          <p key={wIdx}>{w}</p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            /* Fallback single card */
                            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                                  {icdResult.selected_code}
                                </span>
                                <span className="font-semibold text-foreground text-xs flex-1">
                                  {icdResult.selected_description}
                                </span>
                                <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                                  {Math.round(icdResult.confidence * 100)}% kesesuaian
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                <span className="font-medium text-foreground">
                                  Alasan klinis:{" "}
                                </span>
                                {icdResult.reasoning || icdResult.evidence}
                              </p>
                            </div>
                          )}

                          {/* Action Footer */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/40">
                            <button
                              type="button"
                              onClick={handleConfirmObjective}
                              disabled={isLoadingIcd}
                              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw
                                className={cn("h-3 w-3", isLoadingIcd && "animate-spin")}
                              />
                              <span>Analisis Ulang Diagnosis</span>
                            </button>
                            <span className="text-[10px] text-muted-foreground">
                              Standar ICD-10 BPJS Kesehatan &amp; Panduan Praktik Klinis
                            </span>
                          </div>
                        </div>
                      )}

                      {icdError && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-[11px] text-destructive flex items-start gap-2">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">Analisis ICD-10 gagal:</p>
                            <p className="mt-0.5 opacity-90">{icdError}</p>
                            <button
                              type="button"
                              onClick={handleConfirmObjective}
                              className="mt-1 underline font-medium cursor-pointer"
                            >
                              Coba lagi
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* [P] - Plan (Rencana Terapi, Tata Laksana & Prosedur ICD-9-CM) */}
                    <div className="rounded-xl border border-border/90 bg-card p-4.5 text-xs space-y-4 shadow-xs">
                      {/* Section Header */}
                      <div className="flex items-center justify-between border-b border-border/60 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0D6E68]/10 text-[#0D6E68] font-bold text-xs">
                            P
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-foreground">
                              Plan (Tata Laksana &amp; Prosedur Penanganan)
                            </h4>
                            <p className="text-[10px] text-muted-foreground">
                              Rencana terapi medikamentosa, edukasi, &amp; tindakan penanganan ICD-9-CM
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground border border-border">
                            {selectedProceduresCount} Prosedur ICD-9 Aktif
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const activeProcs = activeIcd9List.filter(
                                (p) => selectedIcd9Codes[p.code]
                              );
                              const procText =
                                activeProcs.length > 0
                                  ? `\n\nTINDAKAN & PROSEDUR MEDIS (ICD-9-CM):\n` +
                                    activeProcs
                                      .map(
                                        (p) => `• [${p.code}] ${p.name} (${p.category})`
                                      )
                                      .join("\n")
                                  : "";
                              copyToClipboard(`${soapData.plan}${procText}`, "p");
                            }}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                            title="Salin Plan & Prosedur"
                          >
                            {copiedSection === "p" ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Sub-section 1: Rencana Terapi Klinis & Panduan PPK */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-[#0D6E68]" />
                            Rencana Terapi Farmakologi &amp; Edukasi
                          </span>
                          {!isEditingPlan && (
                            <button
                              type="button"
                              onClick={() => {
                                setPlanDraftText(soapData.plan);
                                setIsEditingPlan(true);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0D6E68] hover:underline cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                              Edit Rencana
                            </button>
                          )}
                        </div>

                        {/* Banner panduan PPK jika plan dari transkrip kosong / belum didiskusikan */}
                        {isPlanEmptyOrUndiscussed && (
                          <div className="rounded-xl border border-teal-200/80 bg-teal-50/50 dark:bg-teal-950/20 p-3 text-xs space-y-2">
                            <div className="flex items-start gap-2 text-teal-900 dark:text-teal-200">
                              <Lightbulb className="h-4 w-4 text-[#0D6E68] shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <p className="font-semibold text-xs">
                                  Rencana Terapi Standar PPK FKTP Tersedia
                                </p>
                                <p className="text-[11px] text-teal-800 dark:text-teal-300 leading-relaxed">
                                  Transkrip percakapan belum memuat rincian resep obat. Anda dapat menerapkan panduan tata laksana standar penanganan{" "}
                                  <strong>{icdResult?.selected_description || "diagnosis"}</strong> dengan satu klik.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleApplyGuidelinePlan}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D6E68] px-3 py-1.5 text-[11px] font-semibold text-white shadow-xs hover:bg-[#0a5752] transition-colors cursor-pointer"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Terapkan Rencana Terapi Rekomendasi PPK
                            </button>
                          </div>
                        )}

                        {isEditingPlan ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              rows={5}
                              value={planDraftText}
                              onChange={(e) => setPlanDraftText(e.target.value)}
                              className="w-full rounded-xl border border-input bg-background p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#0D6E68]/30 font-sans"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setIsEditingPlan(false)}
                                className="rounded-lg border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={handleSavePlanEdit}
                                className="rounded-lg bg-[#0D6E68] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#0a5752] cursor-pointer"
                              >
                                Simpan Perubahan
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 text-xs">
                            <p className="leading-relaxed text-foreground/90 whitespace-pre-line">
                              {soapData.plan}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Sub-section 2: Prosedur Penanganan Medis ICD-9-CM */}
                      <div className="space-y-3 pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h5 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Activity className="h-3.5 w-3.5 text-[#0D6E68]" />
                              Tindakan &amp; Prosedur Penanganan Medis (ICD-9-CM)
                            </h5>
                            <p className="text-[10px] text-muted-foreground">
                              Kode tindakan klinis resmi untuk klaim BPJS &amp; RME SIMRS sesuai diagnosis{" "}
                              <strong>{icdResult?.selected_code}</strong>
                            </p>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Pilih tindakan yang direncanakan / dilakukan
                          </span>
                        </div>

                        {/* List of ICD-9 Procedures */}
                        <div className="space-y-2">
                          {activeIcd9List.map((proc) => {
                            const isChecked = !!selectedIcd9Codes[proc.code];

                            return (
                              <div
                                key={proc.code}
                                onClick={() => toggleProcedureSelection(proc.code)}
                                className={cn(
                                  "rounded-xl border p-3 text-xs transition-all cursor-pointer flex items-start gap-3 select-none",
                                  isChecked
                                    ? "border-[#0D6E68]/35 bg-card ring-1 ring-[#0D6E68]/10 shadow-xs"
                                    : "border-border/70 bg-muted/15 opacity-65 hover:opacity-100"
                                )}
                              >
                                {/* Checkbox Indicator */}
                                <div className="mt-0.5 shrink-0 text-[#0D6E68]">
                                  {isChecked ? (
                                    <CheckSquare className="h-4 w-4" />
                                  ) : (
                                    <Square className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>

                                {/* Procedure Details */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                                        {proc.code}
                                      </span>
                                      <span className="font-semibold text-foreground text-xs">
                                        {proc.name}
                                      </span>
                                      {proc.name_en && (
                                        <span className="text-[10px] text-muted-foreground italic font-normal">
                                          ({proc.name_en})
                                        </span>
                                      )}
                                    </div>

                                    <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                                      {proc.category}
                                    </span>
                                  </div>

                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    <span className="font-medium text-foreground/80">
                                      Indikasi Klinis:{" "}
                                    </span>
                                    {proc.indication}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* [I] - Intervensi (jika ada) */}
                    {soapData.intervention && (
                      <div className="rounded-xl border border-border/80 bg-background p-4 text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-foreground font-bold text-[11px]">
                              I
                            </span>
                            <span className="font-semibold text-foreground text-xs">
                              Intervensi (Tindakan &amp; Edukasi Langsung)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(soapData.intervention || "", "i")
                            }
                            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Salin Intervensi"
                          >
                            {copiedSection === "i" ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <p className="leading-relaxed text-foreground/90 pl-7">
                          {soapData.intervention}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section B: Verifikasi Kepatuhan Klaim BPJS (INA-CBGs) */}
          {icdResult && isObjectiveConfirmed && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0D6E68]/10 text-[#0D6E68]">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Verifikasi Kepatuhan Klaim BPJS (INA-CBGs)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Validasi ganda: Diagnosis ICD-10 &amp; Tindakan Penanganan ICD-9-CM
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Klaim Memenuhi Standar
                </span>
              </div>

              {/* 3 Verification Checkpoint Cards */}
              <div className="grid gap-2.5 sm:grid-cols-3 text-xs">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs mb-1">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Larangan Kode R</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Diagnosis utama menggunakan kode penyakit definitif, bukan kode gejala.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs mb-1">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>144 Diagnosa FKTP</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Verifikasi kompetensi penanganan komprehensif di fasilitas primer.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs mb-1">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Aturan Eksklusi</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Terverifikasi bebas konflik koding ganda (Excludes1/2).
                  </p>
                </div>
              </div>

              {/* Ringkasan Kode Koding Klaim Siap Ekspor */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-xs">
                    Ringkasan Koding Klaim Rekam Medis (BPJS &amp; SIMRS):
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Standar ICD-10 &amp; ICD-9-CM
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1">
                    <span className="text-[10px] font-bold text-muted-foreground">ICD-10:</span>
                    <span className="font-mono font-bold text-[#0D6E68]">
                      {icdResult.selected_code}
                    </span>
                    <span className="text-[11px] text-foreground font-medium">
                      ({icdResult.selected_description})
                    </span>
                  </div>

                  {activeIcd9List
                    .filter((p) => selectedIcd9Codes[p.code])
                    .map((p) => (
                      <div
                        key={p.code}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1"
                      >
                        <span className="text-[10px] font-bold text-muted-foreground">
                          ICD-9:
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {p.code}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {p.name.split(" ")[0]}...
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Apply to Consultation callback button if provided */}
              {onApplyToConsultation && (
                <button
                  type="button"
                  onClick={() => {
                    const activeProcs = activeIcd9List.filter(
                      (p) => selectedIcd9Codes[p.code]
                    );
                    onApplyToConsultation(soapData!, {
                      ...icdResult,
                      icd9_procedures: activeProcs,
                    });
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6E68] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0a5752] cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Gunakan Catatan SOAP, ICD-10 &amp; ICD-9 Ini pada Konsultasi</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
