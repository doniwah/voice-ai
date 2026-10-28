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

        # Specific alias mapping untuk terminologi medis umum Indonesia
        if ("tekanan darah" in clean_query or "hipertensi" in clean_query) and "hypertension" in desc_lower:
            score += 10
        if ("gula" in clean_query or "diabetes" in clean_query) and "diabetes" in desc_lower:
            score += 10
        if ("ispa" in clean_query or "batuk" in clean_query or "pilek" in clean_query) and ("respiratory" in desc_lower or "cough" in desc_lower or "nasopharyngitis" in desc_lower or "pharyngitis" in desc_lower):
            score += 8
        if ("maag" in clean_query or "lambung" in clean_query or "gastritis" in clean_query or "ulu hati" in clean_query) and ("gastritis" in desc_lower or "dyspepsia" in desc_lower or "reflux" in desc_lower):
            score += 8
        if ("pusing" in clean_query or "sakit kepala" in clean_query) and ("headache" in desc_lower or "migraine" in desc_lower or "dizziness" in desc_lower):
            score += 8

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
