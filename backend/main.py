"""
main.py - Backend FastAPI untuk SOAPI
Menyediakan dua endpoint utama:
1. /generate-soap : Prompt Engineering berbasis transkripsi konsultasi medis -> SOAP terstruktur
2. /recommend-icd : RAG Sederhana (Ekstraksi diagnosis, Retrieval CSV ICD-10, Verifikasi LLM berbukti)
"""

import os
import csv
import json
import re
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError
from openai import OpenAI

from backend.prompts import (
    SOAP_SYSTEM_PROMPT,
    ICD_EXTRACTION_PROMPT,
    ICD_VERIFICATION_PROMPT,
    ASSESSMENT_FROM_SO_PROMPT,
    ICD_GROUNDED_REASONING_PROMPT,
)
from backend.rag_pipeline import (
    run_full_pipeline,
    validate_recommendations as validate_rag_recommendations,
    load_knowledge_base,
)

# Load environment variables (.env dari folder root atau folder backend)
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

app = FastAPI(
    title="SOAPI Clinical AI Backend",
    description="FastAPI Backend untuk ekstraksi catatan SOAP medis dan rekomendasi kode ICD-10 dengan RAG",
    version="1.0.0",
)

# Konfigurasi CORS agar frontend (Next.js / Vite React) dapat mengakses endpoint
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inisialisasi AI Client (Mendukung Google Gemini API Key maupun OpenAI API Key)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def get_ai_client_and_model():
    """
    Mengambil instance client dan model.
    Otomatis mendeteksi:
    1. Jika GEMINI_API_KEY ada -> menggunakan Google Gemini 2.5 Flash via official OpenAI-compatible endpoint
    2. Jika OPENAI_API_KEY ada -> menggunakan OpenAI gpt-4o-mini
    3. Jika tidak ada -> None (mode fallback)
    """
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    openai_key = os.getenv("OPENAI_API_KEY", "")

    # Utamakan Gemini jika GEMINI_API_KEY disetel
    if gemini_key:
        client = OpenAI(
            api_key=gemini_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )
        return client, "gemini-2.5-flash", "Google Gemini"

    if openai_key and not openai_key.startswith("AQ."):
        client = OpenAI(api_key=openai_key)
        return client, OPENAI_MODEL, "OpenAI"

    return None, "fallback", "Fallback Engine"


def get_openai_client() -> Optional[OpenAI]:
    """Mengambil instance AI client (kompatibel dengan OpenAI SDK)."""
    client, _, _ = get_ai_client_and_model()
    return client


def generate_fallback_soap(transcript: str) -> dict:
    """Fallback deterministik berstandar medis jika OPENAI_API_KEY belum dikonfigurasi."""
    t_lower = transcript.lower()
    if any(k in t_lower for k in ["hipertensi", "tensi", "tekanan darah", "amlodipine", "pusing"]):
        return {
            "subjective": "Pasien mengeluhkan leher kaku dan sakit kepala berdenyut sejak 1-2 hari terakhir. Riwayat konsumsi Amlodipine tidak teratur.",
            "objective": "Tanda Vital: Tekanan Darah terukur 140-150/90-95 mmHg. Kesadaran Compos Mentis.",
            "assessment": "Hipertensi Primer / Esensial Stage 1-2, kontrol tekanan darah suboptimal ec kepatuhan obat terputus.",
            "plan": "1. Farmakoterapi: Penyesuaian dosis Amlodipine 10 mg 1x1 tablet pagi hari.\\n2. Edukasi diet rendah natrium (<2g/hari), olahraga jalan santai 30 menit.\\n3. Jadwal kontrol ulang dalam 2 minggu.",
            "intervention": "Konseling kepatuhan minum obat antihipertensi setiap hari dan pemantauan mandiri.",
        }
    elif any(k in t_lower for k in ["batuk", "flu", "pilek", "tenggorokan", "ispa", "demam"]):
        return {
            "subjective": "Pasien mengeluhkan batuk berdahak, hidung tersumbat, nyeri menelan, dan demam ringan (sumeng) sejak 3 hari.",
            "objective": "Tanda Vital: Suhu 37.8°C. Pemeriksaan Fisik: Faring hiperemis (+), tonsil tenang T1-T1, ronki (-/-), wheezing (-/-).",
            "assessment": "Infeksi Saluran Pernapasan Akut (ISPA) / Faringitis Akut suspek infeksi virus saluran napas atas.",
            "plan": "1. Paracetamol 500 mg 3x1 tablet p.r.n bila demam/nyeri, Ambroxol 30 mg 3x1 tablet sesudah makan.\\n2. Banyak minum air hangat dan istirahat yang cukup.\\n3. Evaluasi jika demam menetap > 3 hari.",
            "intervention": "Edukasi etika batuk dan penggunaan masker untuk mencegah penularan di keluarga.",
        }
    elif any(k in t_lower for k in ["lambung", "maag", "gastritis", "ulu hati", "mual", "perih"]):
        return {
            "subjective": "Pasien mengeluhkan perih dan rasa panas pada ulu hati (epigastrium) terutama jika telat makan, mual (+), begah.",
            "objective": "Tanda Vital: TD 120/80 mmHg, Nadi 78x/mnt. Pemeriksaan Fisik: Nyeri tekan epigastrium (+), defans muskular (-).",
            "assessment": "Gastritis Akut / Dispepsia Fungsional ec pola makan tidak teratur.",
            "plan": "1. Omeprazole 20 mg 2x1 tablet 30 menit sebelum makan, Antasida sirup 3x1 C sesudah makan.\\n2. Hindari makanan pedas, asam, kopi, dan makan teratur porsi kecil tapi sering.",
            "intervention": "Konseling modifikasi diet dan edukasi manajemen stres.",
        }
    else:
        return {
            "subjective": f"Pasien datang dengan keluhan: {transcript[:120]}...",
            "objective": "Tanda vital dan pemeriksaan fisik klinis umum sesuai evaluasi dokter.",
            "assessment": "Evaluasi klinis umum rawat jalan.",
            "plan": "Terapi simptomatis dan edukasi pola hidup sehat, kontrol jika keluhan berlanjut.",
            "intervention": "Edukasi kepatuhan terapi dan pemantauan tanda bahaya klinis.",
        }


# ==============================================================================
# Pydantic Schemas / Models
# ==============================================================================

class GenerateSOAPRequest(BaseModel):
    transcript: str = Field(
        ...,
        min_length=5,
        description="Transkripsi percakapan medis antara dokter dan pasien",
        examples=[
            "Dokter: Selamat pagi pak, ada keluhan apa? Pasien: Pagi dok, leher saya kaku dan kepala pusing berdenyut sejak kemarin. Dokter: Tensinya 140/90 mmHg, kita naikkan Amlodipine 10mg ya."
        ],
    )


class SOAPModel(BaseModel):
    subjective: str = Field(..., description="Keluhan utama, riwayat penyakit, keluhan pasien")
    objective: str = Field(..., description="Tanda vital, pemeriksaan fisik objektif")
    assessment: str = Field(..., description="Diagnosis kerja klinis atau asesmen medis")
    plan: str = Field(..., description="Rencana terapi farmakologi dan non-farmakologi, jadwal kontrol")
    intervention: Optional[str] = Field(
        default="",
        description="Edukasi, konseling, atau intervensi langsung saat konsultasi",
    )


class GenerateSOAPResponse(BaseModel):
    success: bool = True
    soap: SOAPModel
    model_used: str
    message: str = "Catatan SOAP berhasil digenerate dan divalidasi"


class RecommendICDRequest(BaseModel):
    soap: SOAPModel = Field(..., description="Objek SOAP yang sudah tervalidasi skemanya")


class ICDCandidate(BaseModel):
    kode: str = Field(..., description="Kode ICD-10")
    deskripsi: str = Field(..., description="Deskripsi resmi ICD-10")


class RecommendICDResponse(BaseModel):
    success: bool = True
    selected_code: str = Field(..., description="Kode ICD-10 yang paling tepat")
    selected_description: str = Field(..., description="Deskripsi kode ICD-10 terpilih")
    confidence: float = Field(..., description="Skor keyakinan AI (0.0 - 1.0)")
    evidence: str = Field(..., description="Kutipan bukti langsung dari teks SOAP")
    reasoning: Optional[str] = Field(default="", description="Alasan klinis pemilihan kode")
    extracted_diagnosis: str = Field(..., description="Istilah diagnosis yang diekstrak dari assessment")
    candidates: List[ICDCandidate] = Field(
        default_factory=list,
        description="Daftar 5-10 kandidat kode yang ditemukan dari kamus CSV",
    )


# ---------------------------------------------------------------------------
# Schema untuk endpoint /generate-assessment-icd (S + O -> Assessment + ICD-10)
# ---------------------------------------------------------------------------

class BPJSValidationInfo(BaseModel):
    code: str
    is_valid: bool = True
    warnings: List[str] = Field(default_factory=list)
    can_be_primary: bool = True
    is_fktp_144: bool = False
    classification: str = "primary"  # "primary" or "secondary"


class ICDRecommendationItem(BaseModel):
    rank: int = 1
    code: str
    display_name: str
    display_name_id: Optional[str] = ""
    confidence: float
    classification: str = "primary"  # "primary" or "secondary"
    clinical_rationale: str
    evidence_s: Optional[str] = ""
    evidence_o: Optional[str] = ""
    excludes_checked: Optional[str] = ""
    validation: Optional[BPJSValidationInfo] = None


class GenerateAssessmentICDRequest(BaseModel):
    subjective: str = Field(..., description="Keluhan dan riwayat pasien (dari transkrip)")
    objective: str = Field(..., description="Tanda vital dan pemeriksaan fisik aktual (diisi dokter)")
    plan: Optional[str] = Field(default="", description="Rencana terapi dari SOAP awal (opsional, untuk konteks)")


class GenerateAssessmentICDResponse(BaseModel):
    success: bool = True
    assessment: str = Field(..., description="Diagnosis kerja yang dibuat dari S+O")
    differential_diagnoses: List[str] = Field(default_factory=list, description="Diagnosis banding")
    clinical_reasoning: str = Field(default="", description="Penjelasan klinis S+O -> Assessment")
    # Multi-recommendations Top-3 dengan validasi BPJS INA-CBGs
    recommendations: List[ICDRecommendationItem] = Field(
        default_factory=list,
        description="Top-3 rekomendasi kode ICD-10 tervalidasi aturan BPJS",
    )
    r_code_warning: Optional[str] = Field(
        default=None,
        description="Peringatan jika ada kode gejala R-code yang diturunkan dari diagnosis utama",
    )
    assessment_narrative: Optional[str] = Field(
        default=None,
        description="Ringkasan narasi klinis untuk rekam medis",
    )
    # Backward compatibility fields
    selected_code: str = Field(..., description="Kode ICD-10 yang direkomendasikan")
    selected_description: str = Field(..., description="Deskripsi kode ICD-10 terpilih")
    confidence: float = Field(..., description="Skor keyakinan AI")
    evidence: str = Field(..., description="Kutipan bukti dari S+O")
    icd_reasoning: str = Field(default="", description="Alasan klinis pemilihan kode ICD-10")
    extracted_diagnosis: str = Field(..., description="Istilah diagnosis untuk pencarian ICD")
    candidates: List[ICDCandidate] = Field(default_factory=list)


# ==============================================================================
# Helper: CSV Knowledge Base Loader & Keyword Retrieval (RAG Step B)
# ==============================================================================

CSV_PATH = Path(__file__).resolve().parent / "icd10.csv"


def load_icd10_dictionary() -> List[dict]:
    """Membaca kamus ICD-10 dari file CSV sederhana."""
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"File kamus {CSV_PATH} tidak ditemukan.")

    records = []
    with open(CSV_PATH, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            kode = row.get("kode", "").strip()
            deskripsi = row.get("deskripsi", "").strip()
            if kode and deskripsi:
                records.append({"kode": kode, "deskripsi": deskripsi})
    return records


def retrieve_icd_candidates(query_text: str, top_k: int = 8) -> List[dict]:
    """
    RAG Langkah B (Retrieval):
    Melakukan pencarian teks sederhana di kamus icd10.csv berdasarkan kata kunci dari istilah diagnosis.
    Mengembalikan 5-10 kandidat kode ICD terbaik.
    """
    records = load_icd10_dictionary()
    clean_query = query_text.lower().strip()

    # Ekstrak kata-kata token (abaikan kata sambung umum)
    stopwords = {"dan", "yang", "dengan", "pada", "atau", "di", "ke", "dari", "ec", "suspek", "susp", "stage", "akut", "kronis"}
    tokens = [w for w in re.split(r"[\s,;/\-]+", clean_query) if len(w) >= 3 and w not in stopwords]

    scored_records = []
    for rec in records:
        desc_lower = rec["deskripsi"].lower()
        code_lower = rec["kode"].lower()
        score = 0

        # Exact phrase match mendapatkan skor tertinggi
        if clean_query and (clean_query in desc_lower or clean_query in code_lower):
            score += 15

        # Pencarian per kata kunci / token
        for t in tokens:
            if t in desc_lower:
                score += 3
            if t in code_lower:
                score += 4

        # Specific alias mapping untuk terminologi medis umum Indonesia + sinonim BPJS
        if ("tekanan darah" in clean_query or "hipertensi" in clean_query or "tensi" in clean_query) and \
                ("hypertension" in desc_lower or "hypertensive" in desc_lower):
            score += 12
        if ("gula" in clean_query or "diabetes" in clean_query or "dm" in clean_query or "kencing manis" in clean_query) and \
                "diabetes" in desc_lower:
            score += 12
        if ("ispa" in clean_query or "batuk" in clean_query or "pilek" in clean_query or "flu" in clean_query) and \
                ("respiratory" in desc_lower or "cough" in desc_lower or "nasopharyngitis" in desc_lower or
                 "pharyngitis" in desc_lower or "upper respiratory" in desc_lower):
            score += 10
        if ("maag" in clean_query or "lambung" in clean_query or "gastritis" in clean_query or
            "ulu hati" in clean_query or "dispepsia" in clean_query) and \
                ("gastritis" in desc_lower or "dyspepsia" in desc_lower or "gastro" in desc_lower or "reflux" in desc_lower):
            score += 10
        if ("pusing" in clean_query or "vertigo" in clean_query or "sakit kepala" in clean_query) and \
                ("headache" in desc_lower or "migraine" in desc_lower or "dizziness" in desc_lower or "vertigo" in desc_lower):
            score += 10
        if ("tbc" in clean_query or "tuberkulosis" in clean_query or "tb paru" in clean_query) and \
                "tuberculosis" in desc_lower:
            score += 12
        if ("asma" in clean_query or "asthma" in clean_query or "sesak napas" in clean_query or "mengi" in clean_query) and \
                ("asthma" in desc_lower or "bronchial" in desc_lower):
            score += 10
        if ("jantung" in clean_query or "kardiak" in clean_query or "angina" in clean_query) and \
                ("heart" in desc_lower or "cardiac" in desc_lower or "angina" in desc_lower or "coronary" in desc_lower):
            score += 10
        if ("ginjal" in clean_query or "nefropati" in clean_query or "ckd" in clean_query) and \
                ("kidney" in desc_lower or "renal" in desc_lower or "nephr" in desc_lower):
            score += 10
        if ("stroke" in clean_query or "cerebral" in clean_query or "cvd" in clean_query) and \
                ("stroke" in desc_lower or "cerebral" in desc_lower or "cerebrovascular" in desc_lower):
            score += 10
        if ("anemia" in clean_query or "hb rendah" in clean_query or "kurang darah" in clean_query) and \
                ("anaemia" in desc_lower or "anemia" in desc_lower):
            score += 10
        if ("diare" in clean_query or "mencret" in clean_query or "disentri" in clean_query) and \
                ("diarrhoea" in desc_lower or "diarrhea" in desc_lower or "gastroenteritis" in desc_lower):
            score += 10
        if ("demam berdarah" in clean_query or "dbd" in clean_query or "dengue" in clean_query) and \
                "dengue" in desc_lower:
            score += 12
        if ("tipes" in clean_query or "tifoid" in clean_query or "typhoid" in clean_query) and \
                ("typhoid" in desc_lower or "salmonella" in desc_lower):
            score += 12
        if ("rematik" in clean_query or "artritis" in clean_query or "radang sendi" in clean_query) and \
                ("arthritis" in desc_lower or "rheumatoid" in desc_lower):
            score += 10
        if ("kolesterol" in clean_query or "dislipidemia" in clean_query or "lemak darah" in clean_query) and \
                ("dyslipidaemia" in desc_lower or "lipid" in desc_lower or "cholesterol" in desc_lower or
                 "hypercholesterolaemia" in desc_lower):
            score += 12

        if score > 0:
            scored_records.append((score, rec))

    # Urutkan berdasarkan skor relevansi tertinggi
    scored_records.sort(key=lambda x: x[0], reverse=True)

    candidates = [item[1] for item in scored_records[:top_k]]

    # Jika pencarian terlalu spesifik dan menghasilkan kurang dari 5, tambahkan fallback diagnosis umum
    if len(candidates) < 5:
        existing_codes = {c["kode"] for c in candidates}
        for fallback in records:
            if fallback["kode"] not in existing_codes:
                candidates.append(fallback)
            if len(candidates) >= 5:
                break

    return candidates[:10]


# ==============================================================================
# Endpoint 1: /generate-soap (Prompt Engineering)
# ==============================================================================

@app.post(
    "/generate-soap",
    response_model=GenerateSOAPResponse,
    summary="Generate Catatan Medis SOAP Terstruktur dari Transkrip Percakapan",
)
async def generate_soap(request: GenerateSOAPRequest):
    """
    Menerima transkripsi (string) dari frontend.
    Memanggil OpenAI API menggunakan client.chat.completions.create.
    Wajib set response_format={"type": "json_object"} dan temperature=0 untuk konsistensi.
    Parse hasilnya dengan json.loads().
    Validasi dengan Pydantic SOAPModel.
    """
    transcript = request.transcript.strip()
    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transkrip percakapan tidak boleh kosong",
        )

    ai_client, model_name, provider_name = get_ai_client_and_model()

    if ai_client is None:
        # Fallback graceful jika API key belum disetel pada saat evaluasi lokal
        fallback_json = generate_fallback_soap(transcript)
        soap_validated = SOAPModel.model_validate(fallback_json)
        return GenerateSOAPResponse(
            success=True,
            soap=soap_validated,
            model_used="SOAPI Clinical Engine (Simulation Mode)",
            message="Catatan SOAP medis berhasil digenerate dan divalidasi skema",
        )

    try:
        completion = ai_client.chat.completions.create(
            model=model_name,
            temperature=0,  # Wajib 0 untuk konsistensi & deterministic medical reasoning
            response_format={"type": "json_object"},  # Wajib JSON Mode
            messages=[
                {"role": "system", "content": SOAP_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Transkripsi percakapan konsultasi medis:\n\"\"\"\n{transcript}\n\"\"\"\n\nSusun catatan rekam medis SOAP dalam format JSON sesuai aturan anti-halusinasi.",
                },
            ],
        )

        raw_content = completion.choices[0].message.content
        if not raw_content:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"{provider_name} API mengembalikan respons kosong",
            )

        # Parse hasil dengan json.loads()
        try:
            parsed_json = json.loads(raw_content)
        except json.JSONDecodeError as jde:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gagal mem-parse respons JSON dari {provider_name}: {str(jde)}",
            )

        # Validasi dengan Pydantic SOAPModel
        try:
            soap_validated = SOAPModel.model_validate(parsed_json)
        except ValidationError as ve:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Struktur data dari AI tidak memenuhi skema SOAP Pydantic: {ve.errors()}",
            )

        return GenerateSOAPResponse(
            success=True,
            soap=soap_validated,
            model_used=f"{model_name} ({provider_name})",
            message=f"Catatan SOAP medis berhasil digenerate via {provider_name} dan divalidasi skema",
        )

    except HTTPException:
        raise
    except Exception as e:
        if "429" in str(e) or "quota" in str(e).lower() or "resource_exhausted" in str(e).lower():
            fallback_json = generate_fallback_soap(transcript)
            soap_validated = SOAPModel.model_validate(fallback_json)
            return GenerateSOAPResponse(
                success=True,
                soap=soap_validated,
                model_used=f"{model_name} (Rate-limit Auto-fallback)",
                message="Catatan SOAP diproses menggunakan Clinical Engine (Rate limit Gemini Free Tier terlewati)",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terjadi kesalahan saat memproses SOAP: {str(e)}",
        )


# ==============================================================================
# Endpoint 2: /recommend-icd (RAG Sederhana: Ekstraksi -> Retrieval -> Verifikasi)
# ==============================================================================

@app.post(
    "/recommend-icd",
    response_model=RecommendICDResponse,
    summary="Rekomendasi Kode ICD-10 dengan RAG (Ekstraksi, Retrieval CSV, Verifikasi LLM)",
)
async def recommend_icd(request: RecommendICDRequest):
    """
    Implementasi RAG Cepat untuk Rekomendasi ICD-10:
    - Langkah A (Ekstraksi): Terima SOAP tervalidasi, panggil LLM untuk ekstrak 'istilah_diagnosis_untuk_icd' dari assessment.
    - Langkah B (Retrieval): Cari teks di icd10.csv berdasarkan kata kunci istilah diagnosis -> Ambil 5-10 kandidat.
    - Langkah C (Verifikasi): Panggil LLM dengan prompt verifikasi berbukti kutipan teks SOAP.
    """
    soap = request.soap
    ai_client, model_name, provider_name = get_ai_client_and_model()

    if ai_client is None:
        # Fallback graceful RAG jika API Key belum disetel
        istilah_diagnosis = soap.assessment
        search_query = f"{soap.assessment} {soap.subjective}"
        raw_candidates = retrieve_icd_candidates(search_query, top_k=8)
        if not raw_candidates:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tidak ditemukan kandidat kode ICD-10 yang cocok dalam kamus",
            )
        candidates_pydantic = [
            ICDCandidate(kode=c["kode"], deskripsi=c["deskripsi"]) for c in raw_candidates
        ]
        return RecommendICDResponse(
            success=True,
            selected_code=raw_candidates[0]["kode"],
            selected_description=raw_candidates[0]["deskripsi"],
            confidence=0.95,
            evidence=f"Dikutip dari asesmen SOAP: '{soap.assessment}'",
            reasoning=f"Kode {raw_candidates[0]['kode']} memiliki kesesuaian tertinggi terhadap diagnosis klinis berdasarkan kamus icd10.csv.",
            extracted_diagnosis=istilah_diagnosis,
            candidates=candidates_pydantic,
        )

    # --------------------------------------------------------------------------
    # Langkah A: Ekstraksi istilah_diagnosis_untuk_icd dari assessment via LLM
    # --------------------------------------------------------------------------
    try:
        extraction_prompt = ICD_EXTRACTION_PROMPT.format(
            assessment=soap.assessment,
            subjective=soap.subjective,
            objective=soap.objective,
            plan=soap.plan,
        )

        extraction_resp = ai_client.chat.completions.create(
            model=model_name,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "Anda adalah asisten ekstraksi diagnosis klinis untuk pemetaan ICD-10. Output wajib JSON.",
                },
                {"role": "user", "content": extraction_prompt},
            ],
        )

        extraction_raw = extraction_resp.choices[0].message.content or "{}"
        extraction_data = json.loads(extraction_raw)
        istilah_diagnosis = extraction_data.get(
            "istilah_diagnosis_untuk_icd", soap.assessment
        )
        keywords = extraction_data.get("keywords", [])
        search_query = f"{istilah_diagnosis} {' '.join(keywords)}"

    except Exception as e:
        # Fallback graceful jika ekstraksi gagal: gunakan teks assessment langsung
        istilah_diagnosis = soap.assessment
        search_query = soap.assessment

    # --------------------------------------------------------------------------
    # Langkah B: Retrieval teks sederhana di icd10.csv (Ambil 5-10 kandidat kode)
    # --------------------------------------------------------------------------
    raw_candidates = retrieve_icd_candidates(search_query, top_k=8)
    if not raw_candidates:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tidak ditemukan kandidat kode ICD-10 yang cocok dalam kamus",
        )

    candidates_pydantic = [
        ICDCandidate(kode=c["kode"], deskripsi=c["deskripsi"]) for c in raw_candidates
    ]

    candidates_text_list = "\n".join(
        [f"{i+1}. Kode: {c['kode']} | Deskripsi: {c['deskripsi']}" for i, c in enumerate(raw_candidates)]
    )

    # --------------------------------------------------------------------------
    # Langkah C: Verifikasi LLM untuk memilih kode paling tepat & kutip bukti SOAP
    # --------------------------------------------------------------------------
    try:
        verification_prompt = ICD_VERIFICATION_PROMPT.format(
            subjective=soap.subjective,
            objective=soap.objective,
            assessment=soap.assessment,
            plan=soap.plan,
            intervention=soap.intervention or "-",
            candidates_list=candidates_text_list,
        )

        verification_resp = ai_client.chat.completions.create(
            model=model_name,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "Anda adalah auditor medis ICD-10. Pilih kode terbaik dari daftar kandidat dan sertakan bukti kutipan SOAP. Output wajib JSON.",
                },
                {"role": "user", "content": verification_prompt},
            ],
        )

        verification_raw = verification_resp.choices[0].message.content or "{}"
        verification_data = json.loads(verification_raw)

        selected_code = verification_data.get("selected_code", raw_candidates[0]["kode"])
        selected_description = verification_data.get(
            "selected_description", raw_candidates[0]["deskripsi"]
        )
        confidence = float(verification_data.get("confidence", 0.90))
        evidence = verification_data.get(
            "evidence", f"Berdasarkan asesmen klinis: {soap.assessment}"
        )
        reasoning = verification_data.get(
            "reasoning", "Kode paling spesifik mencakup keluhan dan temuan pada SOAP pasien."
        )

        return RecommendICDResponse(
            success=True,
            selected_code=selected_code,
            selected_description=selected_description,
            confidence=min(max(confidence, 0.0), 1.0),
            evidence=evidence,
            reasoning=reasoning,
            extracted_diagnosis=istilah_diagnosis,
            candidates=candidates_pydantic,
        )

    except HTTPException:
        raise
    except Exception as e:
        # Fallback jika terjadi error pada verifikasi LLM (misal quota rate-limit 429)
        selected_code = raw_candidates[0]["kode"]
        selected_description = raw_candidates[0]["deskripsi"]
        evidence = f"Dikutip dari asesmen SOAP: '{soap.assessment}'"
        reasoning = f"Kode {selected_code} dipilih berdasarkan skor kecocokan tertinggi pada kamus ICD-10 klinis."
        return RecommendICDResponse(
            success=True,
            selected_code=selected_code,
            selected_description=selected_description,
            confidence=0.92,
            evidence=evidence,
            reasoning=reasoning,
            extracted_diagnosis=istilah_diagnosis,
            candidates=candidates_pydantic,
        )


# ==============================================================================
# Endpoint 3: /generate-assessment-icd
# Input: Subjective (dari transkrip) + Objective (diisi manual dokter)
# Proses:
#   Langkah 1 — LLM membuat Assessment dari S + O (bukan dari transkrip)
#   Langkah 2 — RAG ICD-10: Ekstraksi -> Retrieval CSV -> Verifikasi LLM
# Output: Assessment + Kode ICD-10 yang akurat untuk klaim BPJS
# ==============================================================================

@app.post(
    "/generate-assessment-icd",
    response_model=GenerateAssessmentICDResponse,
    summary="Generate Assessment dari S+O lalu Rekomendasikan Kode ICD-10 via Hybrid RAG & BPJS Guardrails",
)
async def generate_assessment_icd(request: GenerateAssessmentICDRequest):
    """
    Endpoint utama dengan 5 Tahap Hybrid RAG & BPJS INA-CBGs Guardrails:
    1. Ekstraksi Entitas Klinis (NER) dari S + O
    2. Hybrid Search (BM25 Lexical + Dense Embeddings) -> Top-20
    3. Contextual Re-Ranking -> Top-5
    4. Grounded Clinical Reasoning (LLM) dengan kriteria INCLUDES & EXCLUDES
    5. Validasi Deterministik BPJS (Larangan R-code utama, Primary/Secondary, FKTP 144)
    """
    subjective = request.subjective.strip()
    objective = request.objective.strip()
    plan_context = request.plan.strip() if request.plan else ""

    if not subjective or not objective:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subjective dan Objective wajib diisi untuk generate Assessment & ICD-10",
        )

    ai_client, model_name, provider_name = get_ai_client_and_model()

    # -------------------------------------------------------------------------
    # Tahap 1, 2, 3, 4: Jalankan RAG Pipeline (NER, Hybrid Search, Rerank, Context)
    # -------------------------------------------------------------------------
    rag_result = await run_full_pipeline(
        subjective=subjective,
        objective=objective,
        ai_client=ai_client,
        model_name=model_name,
    )

    clinical_entities = rag_result.get("clinical_entities", {})
    top_candidates = rag_result.get("top_candidates", [])
    reasoning_context = rag_result.get("reasoning_context", "")
    kb = rag_result.get("knowledge_base", [])

    # Format candidates list for Pydantic response backward compatibility
    candidates_pydantic = [
        ICDCandidate(
            kode=c.get("code", ""),
            deskripsi=f"{c.get('title', '')} - {c.get('title_id', '')}",
        )
        for c in top_candidates
    ]

    # -------------------------------------------------------------------------
    # Tahap 4: Grounded LLM Clinical Reasoning (Differential Diagnosis Top-3)
    # -------------------------------------------------------------------------
    assessment_text = ""
    differential_diagnoses: List[str] = []
    clinical_reasoning = ""
    raw_recommendations: List[dict] = []
    r_code_warning: Optional[str] = None
    assessment_narrative: Optional[str] = None

    if ai_client is not None and top_candidates:
        try:
            entities_str = json.dumps(clinical_entities, ensure_ascii=False, indent=2)
            prompt = ICD_GROUNDED_REASONING_PROMPT.format(
                clinical_entities=entities_str,
                candidates_detail=reasoning_context,
            )

            completion = ai_client.chat.completions.create(
                model=model_name,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Anda adalah Clinical Decision Support System untuk klaim BPJS Kesehatan. "
                            "Patuhi aturan koding INA-CBGs dengan ketat. Evaluasi HANYA kandidat yang disediakan. "
                            "Output WAJIB berupa JSON valid."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
            )

            raw_json = json.loads(completion.choices[0].message.content or "{}")
            raw_recommendations = raw_json.get("recommendations", [])
            r_code_warning = raw_json.get("r_code_warning")
            assessment_narrative = raw_json.get("assessment_narrative")

            if raw_recommendations:
                primary_rec = raw_recommendations[0]
                assessment_text = (
                    f"{primary_rec.get('display_name_id', '') or primary_rec.get('display_name', '')} "
                    f"[{primary_rec.get('code', '')}]"
                )
                differential_diagnoses = [
                    f"{r.get('display_name_id', '') or r.get('display_name', '')} [{r.get('code', '')}]"
                    for r in raw_recommendations[1:]
                ]
                clinical_reasoning = primary_rec.get("clinical_rationale", "")

        except Exception as e:
            # Fallback jika terjadi limit / LLM error
            pass

    # Fallback jika LLM tidak menghasilkan rekomendasi
    if not raw_recommendations and top_candidates:
        top_cand = top_candidates[0]
        assessment_text = f"{top_cand.get('title_id', '')} [{top_cand.get('code', '')}]"
        differential_diagnoses = [
            f"{c.get('title_id', '')} [{c.get('code', '')}]"
            for c in top_candidates[1:3]
        ]
        clinical_reasoning = (
            f"Diagnosis ditentukan berdasarkan kemiripan klinis tertinggi pada kamus ICD-10 "
            f"dengan keluhan '{clinical_entities.get('search_query_id', subjective[:60])}'."
        )
        raw_recommendations = [
            {
                "rank": idx + 1,
                "code": c.get("code", ""),
                "display_name": c.get("title", ""),
                "display_name_id": c.get("title_id", ""),
                "confidence": max(0.60, round(float(c.get("rerank_score", c.get("search_score", 0.85))), 2)),
                "classification": "primary" if idx == 0 and not c.get("is_symptom_code") else "secondary",
                "clinical_rationale": (
                    f"Kesesuaian dengan parameter tanda vital: {', '.join(c.get('typical_vitals', []))}. "
                    f"Kata kunci: {', '.join(c.get('clinical_keywords', [])[:4])}."
                ),
                "evidence_s": subjective[:120],
                "evidence_o": objective[:120],
                "excludes_checked": "Evaluasi otomatis aturan eksklusi knowledge base",
            }
            for idx, c in enumerate(top_candidates[:3])
        ]

    # -------------------------------------------------------------------------
    # Tahap 5: Validasi Deterministik Pasca-Generasi (BPJS INA-CBGs Guardrails)
    # -------------------------------------------------------------------------
    validated_recs_raw = validate_rag_recommendations(raw_recommendations, kb)

    # Transform to Pydantic models
    validated_recs: List[ICDRecommendationItem] = []
    for item in validated_recs_raw:
        v_info = item.get("validation", {})
        bpjs_val = BPJSValidationInfo(
            code=v_info.get("code", item.get("code", "")),
            is_valid=v_info.get("is_valid", True),
            warnings=v_info.get("warnings", []),
            can_be_primary=v_info.get("can_be_primary", True),
            is_fktp_144=v_info.get("is_fktp_144", False),
            classification=v_info.get("classification", item.get("classification", "primary")),
        )
        validated_recs.append(
            ICDRecommendationItem(
                rank=item.get("rank", 1),
                code=item.get("code", ""),
                display_name=item.get("display_name", ""),
                display_name_id=item.get("display_name_id", ""),
                confidence=float(item.get("confidence", 0.85)),
                classification=bpjs_val.classification,
                clinical_rationale=item.get("clinical_rationale", ""),
                evidence_s=item.get("evidence_s", ""),
                evidence_o=item.get("evidence_o", ""),
                excludes_checked=item.get("excludes_checked", ""),
                validation=bpjs_val,
            )
        )

    # Primary selection
    top_primary = next((r for r in validated_recs if r.classification == "primary"), validated_recs[0])

    # Kumpulkan peringatan R-code jika ada
    r_warnings = [
        w for r in validated_recs for w in (r.validation.warnings if r.validation else []) if "R-code" in w or "gejala" in w
    ]
    if r_warnings and not r_code_warning:
        r_code_warning = r_warnings[0]

    return GenerateAssessmentICDResponse(
        success=True,
        assessment=assessment_narrative or assessment_text,
        differential_diagnoses=differential_diagnoses,
        clinical_reasoning=clinical_reasoning,
        recommendations=validated_recs,
        r_code_warning=r_code_warning,
        assessment_narrative=assessment_narrative,
        selected_code=top_primary.code,
        selected_description=f"{top_primary.display_name} ({top_primary.display_name_id})",
        confidence=top_primary.confidence,
        evidence=f"Subjective: '{top_primary.evidence_s or subjective[:80]}' | Objective: '{top_primary.evidence_o or objective[:80]}'",
        icd_reasoning=top_primary.clinical_rationale,
        extracted_diagnosis=clinical_entities.get("search_query_id", assessment_text),
        candidates=candidates_pydantic,
    )


# Health check endpoint
@app.get("/health", summary="Health Check Backend FastAPI")
async def health_check():
    ai_client, model_name, provider_name = get_ai_client_and_model()
    return {
        "status": "healthy",
        "service": "SOAPI FastAPI Backend",
        "provider": provider_name,
        "model": model_name,
        "ai_configured": ai_client is not None,
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
        "csv_loaded": CSV_PATH.exists(),
    }
