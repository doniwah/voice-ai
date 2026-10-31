"""
rag_pipeline.py — Pipeline RAG (Retrieval-Augmented Generation) Produksi
untuk Rekomendasi Kode ICD-10 pada Sistem Pendukung Keputusan Klinis BPJS Kesehatan.

Pipeline ini memproses input Subjective (keluhan pasien) + Objective (tanda vital
dan pemeriksaan fisik oleh dokter) untuk menghasilkan rekomendasi kode ICD-10
yang akurat dan sesuai aturan klaim BPJS.

Arsitektur Pipeline (5 Langkah):
    1. Ekstraksi Entitas Klinis (NER) via LLM + fallback regex
    2. Hybrid Search: BM25 (sparse/lexical) + Dense Embeddings (semantic)
    3. Cross-Encoder Reranking
    4. Penyiapan Konteks Penalaran Klinis (untuk LLM di main.py)
    5. Validasi Deterministik sesuai aturan BPJS

Catatan Teknis:
    - Model embedding dan cross-encoder dimuat secara lazy (singleton)
    - Embedding knowledge base di-cache setelah komputasi pertama
    - Semua langkah memiliki fallback graceful agar pipeline tidak pernah crash
    - Mendukung teks klinis bilingual (Indonesia + Inggris/Latin)

Author: SOAPI Clinical AI Team
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import time
from pathlib import Path
from typing import Any, Optional

import numpy as np

# ==============================================================================
# Logging
# ==============================================================================

logger = logging.getLogger("rag_pipeline")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(
        logging.Formatter("[%(asctime)s] %(levelname)s %(name)s: %(message)s")
    )
    logger.addHandler(_handler)

# ==============================================================================
# Konstanta & Path
# ==============================================================================

KB_PATH = Path(__file__).resolve().parent / "icd10_knowledge.json"

# ==============================================================================
# Singleton / Lazy-Loaded Resources
# ==============================================================================

_embedding_model: Any = None
_cross_encoder_model: Any = None
_kb_embeddings: Optional[np.ndarray] = None
_knowledge_base: Optional[list[dict]] = None
_kb_texts_for_embedding: Optional[list[str]] = None

# Flag untuk menandai jika model gagal dimuat (jangan coba lagi)
_embedding_model_failed: bool = False
_cross_encoder_model_failed: bool = False


def get_embedding_model() -> Any:
    """
    Memuat model embedding secara lazy (singleton).
    Menggunakan paraphrase-multilingual-MiniLM-L12-v2 yang mendukung Bahasa Indonesia.

    Returns:
        SentenceTransformer model atau None jika gagal dimuat.
    """
    global _embedding_model, _embedding_model_failed
    if _embedding_model_failed:
        return None
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer

            logger.info("Mencoba memuat model embedding lokal (safetensors) ...")
            t0 = time.time()
            # Gunakan local_files_only agar tidak blocking unduhan besar di runtime
            _embedding_model = SentenceTransformer(
                "paraphrase-multilingual-MiniLM-L12-v2",
                local_files_only=True,
            )
            logger.info(
                "Model embedding berhasil dimuat dalam %.2f detik", time.time() - t0
            )
        except Exception as exc:
            logger.info("Model sentence-transformers offline/belum di-cache (%s). Hybrid search beralih ke BM25 + Medical Semantic Matcher.", str(exc)[:80])
            _embedding_model_failed = True
            return None
    return _embedding_model


def get_cross_encoder_model() -> Any:
    """
    Memuat model cross-encoder secara lazy (singleton).
    Menggunakan cross-encoder/ms-marco-multilingual-MiniLM-L12-v2
    untuk reranking pasangan (query, dokumen).

    Returns:
        CrossEncoder model atau None jika gagal dimuat.
    """
    global _cross_encoder_model, _cross_encoder_model_failed
    if _cross_encoder_model_failed:
        return None
    if _cross_encoder_model is None:
        try:
            from sentence_transformers import CrossEncoder

            logger.info("Mencoba memuat model cross-encoder lokal ...")
            t0 = time.time()
            _cross_encoder_model = CrossEncoder(
                "cross-encoder/ms-marco-multilingual-MiniLM-L12-v2",
                local_files_only=True,
            )
            logger.info(
                "Model cross-encoder berhasil dimuat dalam %.2f detik",
                time.time() - t0,
            )
        except Exception as exc:
            logger.info("Model cross-encoder offline/belum di-cache (%s). Reranking menggunakan skor relevansi hybrid klinis.", str(exc)[:80])
            _cross_encoder_model_failed = True
            return None
    return _cross_encoder_model


def load_knowledge_base() -> list[dict]:
    """
    Memuat knowledge base ICD-10 dari file JSON (singleton).
    File berisi array objek dengan skema lengkap termasuk clinical_keywords,
    synonyms_id, severity_indicators, typical_vitals, dsb.

    Returns:
        List[dict] — daftar entri ICD-10 dari knowledge base.

    Raises:
        FileNotFoundError: Jika file icd10_knowledge.json tidak ditemukan.
    """
    global _knowledge_base
    if _knowledge_base is not None:
        return _knowledge_base

    if not KB_PATH.exists():
        raise FileNotFoundError(
            f"File knowledge base tidak ditemukan: {KB_PATH}. "
            "Pastikan icd10_knowledge.json ada di folder backend/."
        )

    logger.info("Memuat knowledge base ICD-10 dari %s ...", KB_PATH)
    t0 = time.time()
    with open(KB_PATH, "r", encoding="utf-8") as f:
        _knowledge_base = json.load(f)
    logger.info(
        "Knowledge base dimuat: %d entri dalam %.2f detik",
        len(_knowledge_base),
        time.time() - t0,
    )
    return _knowledge_base


def _build_kb_text(entry: dict) -> str:
    """
    Menggabungkan field-field penting dari sebuah entri KB menjadi satu string
    untuk keperluan embedding dan pencarian teks.

    Args:
        entry: Satu entri dari knowledge base ICD-10.

    Returns:
        String gabungan dari title, title_id, clinical_keywords, synonyms_id, includes.
    """
    parts: list[str] = []
    parts.append(entry.get("code", ""))
    parts.append(entry.get("title", ""))
    parts.append(entry.get("title_id", ""))
    for kw in entry.get("clinical_keywords", []):
        parts.append(kw)
    for syn in entry.get("synonyms_id", []):
        parts.append(syn)
    for inc in entry.get("includes", []):
        parts.append(inc)
    return " ".join(parts)


def get_kb_embeddings() -> Optional[np.ndarray]:
    """
    Menghitung embedding untuk seluruh knowledge base (di-cache setelah komputasi pertama).
    Menggunakan model embedding multilingual.

    Returns:
        np.ndarray berisi embedding seluruh entri KB, atau None jika model tidak tersedia.
    """
    global _kb_embeddings, _kb_texts_for_embedding

    if _kb_embeddings is not None:
        return _kb_embeddings

    model = get_embedding_model()
    if model is None:
        return None

    kb = load_knowledge_base()
    if not kb:
        return None

    logger.info("Menghitung embedding untuk %d entri knowledge base ...", len(kb))
    t0 = time.time()

    _kb_texts_for_embedding = [_build_kb_text(entry) for entry in kb]
    _kb_embeddings = model.encode(
        _kb_texts_for_embedding,
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )

    logger.info(
        "Embedding KB selesai dihitung dalam %.2f detik (shape: %s)",
        time.time() - t0,
        _kb_embeddings.shape,
    )
    return _kb_embeddings


# ==============================================================================
# NER Prompt (tightly coupled dengan pipeline, didefinisikan inline)
# ==============================================================================

_NER_SYSTEM_PROMPT = """Anda adalah sistem NER (Named Entity Recognition) klinis untuk ekstraksi entitas medis terstruktur dari data Subjective dan Objective pasien di fasilitas kesehatan Indonesia.

Tugas Anda:
- Ekstrak seluruh entitas klinis dari teks S (Subjective) dan O (Objective)
- Hasilkan query pencarian bilingual (Indonesia & Inggris) untuk pencarian ICD-10
- Tentukan severity berdasarkan gabungan gejala dan tanda vital

ATURAN:
1. HANYA ekstrak informasi yang SECARA EKSPLISIT disebutkan dalam teks.
2. DILARANG mengarang gejala, tanda vital, atau temuan yang tidak ada.
3. Jika informasi tidak tersedia, kosongkan field atau isi "tidak disebutkan".
4. search_query_en dan search_query_id harus berupa frasa pencarian yang efektif untuk menemukan kode ICD-10 yang tepat — sertakan istilah medis standar."""

_NER_USER_PROMPT = """Ekstrak entitas klinis dari data berikut:

=== SUBJECTIVE (Keluhan Pasien) ===
{subjective}

=== OBJECTIVE (Tanda Vital & Pemeriksaan Fisik) ===
{objective}

Output WAJIB berupa JSON murni (tanpa markdown) dengan struktur:
{{
  "gejala_utama": ["gejala utama 1", "gejala utama 2"],
  "gejala_penyerta": ["gejala penyerta 1"],
  "onset": "durasi/onset jika disebutkan",
  "frekuensi": "frekuensi jika disebutkan",
  "riwayat_penyakit": ["riwayat relevan"],
  "tanda_vital": {{
    "td": "tekanan darah jika ada",
    "nadi": "nadi jika ada",
    "suhu": "suhu jika ada",
    "rr": "respiratory rate jika ada",
    "spo2": "saturasi oksigen jika ada"
  }},
  "temuan_fisik": ["temuan pemeriksaan fisik"],
  "severity": "ringan / sedang / berat / kritis",
  "search_query_en": "english ICD-10 search query with medical terms",
  "search_query_id": "query pencarian ICD-10 dalam bahasa Indonesia dengan istilah medis"
}}"""


# ==============================================================================
# Langkah 1: Ekstraksi Entitas Klinis (NER)
# ==============================================================================


async def extract_clinical_entities(
    subjective: str,
    objective: str,
    ai_client: Any,
    model_name: str,
) -> dict:
    """
    Langkah 1 Pipeline RAG — Ekstraksi Entitas Klinis (NER).

    Menggunakan LLM (Gemini 2.5 Flash via OpenAI-compatible API) untuk mengekstrak
    entitas klinis terstruktur dari teks Subjective dan Objective pasien.
    Jika LLM gagal, menggunakan fallback regex/heuristik.

    Args:
        subjective: Teks keluhan pasien (anamnesis).
        objective: Teks tanda vital dan pemeriksaan fisik.
        ai_client: Instance OpenAI client (compatible dengan Gemini).
        model_name: Nama model LLM yang digunakan.

    Returns:
        Dict berisi entitas klinis terstruktur:
        - gejala_utama, gejala_penyerta, onset, frekuensi
        - riwayat_penyakit, tanda_vital, temuan_fisik
        - severity, search_query_en, search_query_id
    """
    t0 = time.time()
    logger.info("Langkah 1: Memulai ekstraksi entitas klinis (NER) ...")

    # Coba ekstraksi via LLM
    if ai_client is not None:
        try:
            user_prompt = _NER_USER_PROMPT.format(
                subjective=subjective,
                objective=objective,
            )
            response = ai_client.chat.completions.create(
                model=model_name,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _NER_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )

            raw_content = response.choices[0].message.content or "{}"
            entities = json.loads(raw_content)

            # Validasi field minimal
            if not entities.get("gejala_utama") and not entities.get("search_query_id"):
                logger.warning(
                    "LLM NER mengembalikan output kosong, menggunakan fallback."
                )
                entities = _extract_entities_fallback(subjective, objective)
            else:
                logger.info(
                    "Langkah 1 selesai via LLM dalam %.2f detik. "
                    "Gejala utama: %s",
                    time.time() - t0,
                    entities.get("gejala_utama", []),
                )
            return entities

        except Exception as exc:
            logger.warning(
                "LLM NER gagal (%s), menggunakan fallback regex/heuristik.",
                str(exc)[:100],
            )

    # Fallback regex/heuristik
    entities = _extract_entities_fallback(subjective, objective)
    logger.info(
        "Langkah 1 selesai via fallback dalam %.2f detik.", time.time() - t0
    )
    return entities


def _extract_entities_fallback(subjective: str, objective: str) -> dict:
    """
    Fallback ekstraksi entitas klinis menggunakan regex dan heuristik sederhana.
    Digunakan ketika LLM NER tidak tersedia atau gagal.

    Args:
        subjective: Teks keluhan pasien.
        objective: Teks tanda vital dan pemeriksaan fisik.

    Returns:
        Dict entitas klinis (best-effort dari regex).
    """
    combined = f"{subjective} {objective}".lower()

    # Ekstrak tanda vital dengan regex
    tanda_vital: dict[str, str] = {}
    td_match = re.search(
        r"(?:td|tekanan\s*darah)[:\s]*(\d{2,3}[/\\]\d{2,3})\s*(?:mmhg)?",
        combined,
    )
    if td_match:
        tanda_vital["td"] = td_match.group(1)

    nadi_match = re.search(
        r"(?:nadi|hr|heart\s*rate)[:\s]*(\d{2,3})\s*(?:x/m|bpm)?",
        combined,
    )
    if nadi_match:
        tanda_vital["nadi"] = nadi_match.group(1)

    suhu_match = re.search(
        r"(?:suhu|temp)[:\s]*(\d{2}[.,]\d)\s*(?:°?[cC])?",
        combined,
    )
    if suhu_match:
        tanda_vital["suhu"] = suhu_match.group(1).replace(",", ".")

    spo2_match = re.search(
        r"(?:spo2|saturasi|sat\s*o2)[:\s]*(\d{2,3})\s*%?",
        combined,
    )
    if spo2_match:
        tanda_vital["spo2"] = spo2_match.group(1)

    rr_match = re.search(
        r"(?:rr|resp|napas)[:\s]*(\d{1,2})\s*(?:x/m)?",
        combined,
    )
    if rr_match:
        tanda_vital["rr"] = rr_match.group(1)

    # Ekstrak kata kunci gejala dari subjective
    stopwords = {
        "pasien",
        "mengeluh",
        "mengeluhkan",
        "dengan",
        "yang",
        "dan",
        "atau",
        "sejak",
        "sudah",
        "dari",
        "pada",
        "ini",
        "itu",
        "ada",
        "tidak",
        "saya",
        "dok",
        "dokter",
        "keluhan",
        "hari",
        "minggu",
        "bulan",
        "tahun",
        "kali",
        "sering",
        "kadang",
        "pernah",
        "belum",
        "juga",
        "lagi",
        "bisa",
        "sangat",
        "agak",
        "terasa",
        "merasa",
        "seperti",
        "sekitar",
    }
    subj_words = re.split(r"[\s,;.]+", subjective.lower())
    gejala = [w for w in subj_words if len(w) >= 4 and w not in stopwords]
    # Deduplicate while preserving order
    seen: set[str] = set()
    gejala_unique: list[str] = []
    for g in gejala:
        if g not in seen:
            seen.add(g)
            gejala_unique.append(g)

    # Onset extraction
    onset = ""
    onset_match = re.search(
        r"sejak\s+(\d+\s*(?:hari|minggu|bulan|tahun|jam)(?:\s*(?:yang\s*lalu|terakhir|ini))?)",
        combined,
    )
    if onset_match:
        onset = onset_match.group(1).strip()

    # Frekuensi extraction
    frekuensi = ""
    freq_match = re.search(
        r"(\d+\s*(?:kali|x)\s*(?:/|per|sehari|seminggu)[^\s,.]*)",
        combined,
    )
    if freq_match:
        frekuensi = freq_match.group(1).strip()

    # Severity heuristic
    severity = "sedang"
    severe_terms = [
        "berat",
        "parah",
        "kritis",
        "sesak berat",
        "tidak sadar",
        "syok",
        "kejang",
    ]
    mild_terms = ["ringan", "sedikit", "agak", "sumeng"]
    if any(t in combined for t in severe_terms):
        severity = "berat"
    elif any(t in combined for t in mild_terms):
        severity = "ringan"

    # Build search queries
    search_terms = gejala_unique[:8]
    search_query_id = " ".join(search_terms) if search_terms else subjective[:120]
    search_query_en = search_query_id  # Fallback: sama dengan ID

    return {
        "gejala_utama": gejala_unique[:5],
        "gejala_penyerta": gejala_unique[5:10],
        "onset": onset,
        "frekuensi": frekuensi,
        "riwayat_penyakit": [],
        "tanda_vital": tanda_vital,
        "temuan_fisik": [],
        "severity": severity,
        "search_query_en": search_query_en,
        "search_query_id": search_query_id,
    }


# ==============================================================================
# Langkah 2: Hybrid Search (BM25 + Dense Embeddings)
# ==============================================================================


def _tokenize(text: str) -> list[str]:
    """
    Tokenisasi sederhana untuk BM25: lowercasing, split pada non-alfanumerik,
    filter token pendek.

    Args:
        text: Teks yang akan ditokenisasi.

    Returns:
        List token hasil tokenisasi.
    """
    text = text.lower()
    tokens = re.split(r"[^\w]+", text)
    return [t for t in tokens if len(t) >= 2]


def hybrid_search(
    clinical_entities: dict,
    knowledge_base: list[dict],
    top_k: int = 20,
) -> list[dict]:
    """
    Langkah 2 Pipeline RAG — Pencarian Hybrid (BM25 + Dense Embeddings).

    Menggabungkan pencarian leksikal (BM25) dan semantik (cosine similarity
    pada embedding multilingual) untuk menemukan kandidat kode ICD-10 yang
    paling relevan dengan profil klinis pasien.

    Skor fusi: 0.4 * BM25_normalized + 0.6 * embedding_score

    Args:
        clinical_entities: Dict entitas klinis dari Langkah 1 (NER).
        knowledge_base: List entri knowledge base ICD-10.
        top_k: Jumlah kandidat teratas yang dikembalikan (default: 20).

    Returns:
        List[dict] — Top-K entri KB diurutkan berdasarkan skor fusi (descending).
        Setiap entri ditambahkan field 'search_score'.
    """
    t0 = time.time()
    logger.info(
        "Langkah 2: Memulai hybrid search (BM25 + Dense) pada %d entri KB ...",
        len(knowledge_base),
    )

    # ---- Bangun query teks dari entitas klinis ----
    query_parts: list[str] = []
    query_parts.append(clinical_entities.get("search_query_en", ""))
    query_parts.append(clinical_entities.get("search_query_id", ""))
    for g in clinical_entities.get("gejala_utama", []):
        query_parts.append(g)
    for g in clinical_entities.get("gejala_penyerta", []):
        query_parts.append(g)
    # Tambahkan temuan fisik
    for tf in clinical_entities.get("temuan_fisik", []):
        query_parts.append(tf)

    query_text = " ".join(part for part in query_parts if part)
    if not query_text.strip():
        logger.warning("Query teks kosong, mengembalikan entri KB pertama sebagai fallback.")
        return knowledge_base[:top_k]

    query_tokens = _tokenize(query_text)

    # ---- BM25 Sparse Search ----
    bm25_scores = _bm25_search(query_tokens, knowledge_base)

    # ---- Dense Embedding Search ----
    embedding_scores = _dense_search(query_text, knowledge_base)

    # ---- Fusi Skor ----
    n = len(knowledge_base)

    # Normalisasi BM25 ke [0, 1]
    bm25_max = max(bm25_scores) if bm25_scores and max(bm25_scores) > 0 else 1.0
    bm25_min = min(bm25_scores) if bm25_scores else 0.0
    bm25_range = bm25_max - bm25_min if bm25_max > bm25_min else 1.0
    bm25_normalized = [
        (s - bm25_min) / bm25_range for s in bm25_scores
    ]

    # Embedding scores sudah di-normalisasi (cosine similarity di [0, 1] setelah normalize)
    # Tetap normalisasi untuk safety
    if embedding_scores:
        emb_max = max(embedding_scores) if max(embedding_scores) > 0 else 1.0
        emb_min = min(embedding_scores)
        emb_range = emb_max - emb_min if emb_max > emb_min else 1.0
        emb_normalized = [
            (s - emb_min) / emb_range for s in embedding_scores
        ]
    else:
        # Jika embedding tidak tersedia, gunakan BM25 saja
        emb_normalized = [0.0] * n

    # Combined: 0.4 * BM25 + 0.6 * Embedding
    combined_scores: list[float] = []
    for i in range(n):
        bm25_part = bm25_normalized[i] if i < len(bm25_normalized) else 0.0
        emb_part = emb_normalized[i] if i < len(emb_normalized) else 0.0

        # Jika embedding tidak tersedia, gunakan BM25 100%
        if not embedding_scores:
            score = bm25_part
        else:
            score = 0.4 * bm25_part + 0.6 * emb_part
        combined_scores.append(score)

    # Sort berdasarkan combined score descending
    scored_entries = list(zip(combined_scores, range(n)))
    scored_entries.sort(key=lambda x: x[0], reverse=True)

    results: list[dict] = []
    for score, idx in scored_entries[:top_k]:
        entry = dict(knowledge_base[idx])  # shallow copy
        entry["search_score"] = round(score, 4)
        results.append(entry)

    logger.info(
        "Langkah 2 selesai dalam %.2f detik. Top-3 kode: %s",
        time.time() - t0,
        [r.get("code", "?") for r in results[:3]],
    )
    return results


def _bm25_search(
    query_tokens: list[str],
    knowledge_base: list[dict],
) -> list[float]:
    """
    Pencarian BM25 (sparse/lexical) terhadap knowledge base.
    Menggunakan library rank_bm25, dengan fallback manual jika library tidak tersedia.

    Args:
        query_tokens: Token-token dari query pencarian.
        knowledge_base: Daftar entri knowledge base ICD-10.

    Returns:
        List[float] — Skor BM25 untuk setiap entri KB (urutan sama dengan input).
    """
    # Bangun corpus: tokenisasi dari field-field penting setiap entri KB
    corpus: list[list[str]] = []
    for entry in knowledge_base:
        doc_text = _build_kb_text(entry)
        corpus.append(_tokenize(doc_text))

    try:
        from rank_bm25 import BM25Okapi

        bm25 = BM25Okapi(corpus)
        scores = bm25.get_scores(query_tokens)
        return scores.tolist()

    except ImportError:
        logger.warning(
            "Library rank_bm25 tidak tersedia, menggunakan BM25 manual sederhana."
        )
        return _bm25_manual(query_tokens, corpus)
    except Exception as exc:
        logger.warning("BM25 library error (%s), fallback ke manual.", exc)
        return _bm25_manual(query_tokens, corpus)


def _bm25_manual(
    query_tokens: list[str],
    corpus: list[list[str]],
    k1: float = 1.5,
    b: float = 0.75,
) -> list[float]:
    """
    Implementasi BM25 Okapi manual sederhana sebagai fallback.

    Args:
        query_tokens: Token-token query.
        corpus: List of tokenized documents.
        k1: BM25 term frequency saturation parameter.
        b: BM25 document length normalization parameter.

    Returns:
        List[float] — Skor BM25 per dokumen.
    """
    n_docs = len(corpus)
    if n_docs == 0:
        return []

    # Average document length
    doc_lens = [len(doc) for doc in corpus]
    avgdl = sum(doc_lens) / n_docs if n_docs > 0 else 1.0

    # Document frequency per token
    df: dict[str, int] = {}
    for doc in corpus:
        unique_tokens = set(doc)
        for t in unique_tokens:
            df[t] = df.get(t, 0) + 1

    scores: list[float] = []
    for i, doc in enumerate(corpus):
        score = 0.0
        dl = doc_lens[i]
        # Term frequency in this doc
        tf_map: dict[str, int] = {}
        for t in doc:
            tf_map[t] = tf_map.get(t, 0) + 1

        for qt in query_tokens:
            if qt not in tf_map:
                continue
            tf_val = tf_map[qt]
            doc_freq = df.get(qt, 0)
            # IDF with smoothing
            idf = math.log((n_docs - doc_freq + 0.5) / (doc_freq + 0.5) + 1.0)
            # BM25 TF component
            tf_component = (tf_val * (k1 + 1)) / (
                tf_val + k1 * (1 - b + b * dl / avgdl)
            )
            score += idf * tf_component

        scores.append(score)

    return scores


def _dense_search(
    query_text: str,
    knowledge_base: list[dict],
) -> list[float]:
    """
    Pencarian semantik menggunakan dense embeddings (cosine similarity).
    Pre-compute dan cache embedding KB pada pemanggilan pertama.

    Args:
        query_text: Teks query gabungan dari entitas klinis.
        knowledge_base: Daftar entri knowledge base ICD-10.

    Returns:
        List[float] — Skor cosine similarity untuk setiap entri KB.
        List kosong jika model embedding tidak tersedia.
    """
    model = get_embedding_model()
    if model is None:
        logger.info(
            "Model embedding tidak tersedia, hybrid search hanya menggunakan BM25."
        )
        return []

    kb_emb = get_kb_embeddings()
    if kb_emb is None:
        return []

    # Encode query
    query_emb = model.encode(
        [query_text],
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )

    # Cosine similarity (embeddings sudah dinormalisasi, dot product = cosine sim)
    similarities = np.dot(kb_emb, query_emb.T).flatten()

    return similarities.tolist()


# ==============================================================================
# Langkah 3: Cross-Encoder Reranking
# ==============================================================================


def rerank_candidates(
    query_profile: str,
    candidates: list[dict],
    top_k: int = 5,
) -> list[dict]:
    """
    Langkah 3 Pipeline RAG — Reranking menggunakan Cross-Encoder.

    Menggunakan model cross-encoder multilingual untuk memberikan skor relevansi
    yang lebih akurat pada pasangan (profil_klinis, deskripsi_kandidat).

    Jika cross-encoder tidak tersedia, mengembalikan kandidat berdasarkan
    skor hybrid search asli (tanpa reranking).

    Args:
        query_profile: Teks profil klinis pasien (gabungan gejala, tanda vital, dsb).
        candidates: List kandidat dari hybrid search (sudah ada search_score).
        top_k: Jumlah kandidat teratas setelah reranking (default: 5).

    Returns:
        List[dict] — Top-K kandidat setelah reranking, ditambah field 'rerank_score'.
    """
    t0 = time.time()
    logger.info(
        "Langkah 3: Memulai cross-encoder reranking pada %d kandidat ...",
        len(candidates),
    )

    if not candidates:
        return []

    cross_encoder = get_cross_encoder_model()
    if cross_encoder is None:
        logger.info(
            "Cross-encoder tidak tersedia, menggunakan skor hybrid search langsung."
        )
        # Return top_k candidates sorted by existing search_score
        sorted_candidates = sorted(
            candidates,
            key=lambda x: x.get("search_score", 0),
            reverse=True,
        )
        results = sorted_candidates[:top_k]
        for r in results:
            r["rerank_score"] = r.get("search_score", 0.0)
        return results

    try:
        # Bangun pasangan (query_profile, candidate_description)
        pairs: list[list[str]] = []
        for cand in candidates:
            cand_text = (
                f"{cand.get('code', '')} - {cand.get('title', '')} "
                f"({cand.get('title_id', '')}). "
                f"Keywords: {', '.join(cand.get('clinical_keywords', [])[:10])}. "
                f"Sinonim: {', '.join(cand.get('synonyms_id', [])[:5])}."
            )
            pairs.append([query_profile, cand_text])

        # Score semua pasangan
        ce_scores = cross_encoder.predict(pairs)
        if hasattr(ce_scores, "tolist"):
            ce_scores = ce_scores.tolist()

        # Gabungkan skor dan sort
        scored = list(zip(ce_scores, range(len(candidates))))
        scored.sort(key=lambda x: x[0], reverse=True)

        results: list[dict] = []
        for score, idx in scored[:top_k]:
            entry = dict(candidates[idx])
            entry["rerank_score"] = round(float(score), 4)
            results.append(entry)

        logger.info(
            "Langkah 3 selesai dalam %.2f detik. Top-3 kode: %s",
            time.time() - t0,
            [r.get("code", "?") for r in results[:3]],
        )
        return results

    except Exception as exc:
        logger.error(
            "Cross-encoder reranking gagal (%s), fallback ke skor hybrid.",
            str(exc)[:100],
        )
        sorted_candidates = sorted(
            candidates,
            key=lambda x: x.get("search_score", 0),
            reverse=True,
        )
        results = sorted_candidates[:top_k]
        for r in results:
            r["rerank_score"] = r.get("search_score", 0.0)
        return results


# ==============================================================================
# Langkah 4: Penyiapan Konteks Penalaran Klinis
# ==============================================================================


def prepare_reasoning_context(
    clinical_entities: dict,
    top_candidates: list[dict],
) -> str:
    """
    Langkah 4 Pipeline RAG — Menyiapkan konteks terstruktur untuk penalaran
    klinis LLM di main.py.

    Memformat Top-5 kandidat ICD-10 beserta metadata lengkap dari knowledge base
    (includes, excludes, severity_indicators, typical_vitals) menjadi prompt context
    yang akan digunakan oleh LLM untuk membuat keputusan akhir.

    Args:
        clinical_entities: Dict entitas klinis dari Langkah 1 (NER).
        top_candidates: List Top-5 kandidat dari Langkah 3 (reranking).

    Returns:
        String konteks terstruktur siap digunakan sebagai bagian prompt LLM.
    """
    t0 = time.time()
    logger.info("Langkah 4: Menyiapkan konteks penalaran klinis ...")

    lines: list[str] = []

    # ---- Profil Klinis Pasien ----
    lines.append("=== PROFIL KLINIS PASIEN ===")
    gejala_utama = clinical_entities.get("gejala_utama", [])
    gejala_penyerta = clinical_entities.get("gejala_penyerta", [])
    onset = clinical_entities.get("onset", "")
    frekuensi = clinical_entities.get("frekuensi", "")
    tanda_vital = clinical_entities.get("tanda_vital", {})
    temuan_fisik = clinical_entities.get("temuan_fisik", [])
    severity = clinical_entities.get("severity", "")

    lines.append(f"Gejala Utama: {', '.join(gejala_utama) if gejala_utama else 'Tidak teridentifikasi'}")
    if gejala_penyerta:
        lines.append(f"Gejala Penyerta: {', '.join(gejala_penyerta)}")
    if onset:
        lines.append(f"Onset: {onset}")
    if frekuensi:
        lines.append(f"Frekuensi: {frekuensi}")
    if tanda_vital:
        tv_parts = [f"{k.upper()}: {v}" for k, v in tanda_vital.items() if v]
        if tv_parts:
            lines.append(f"Tanda Vital: {', '.join(tv_parts)}")
    if temuan_fisik:
        lines.append(f"Temuan Fisik: {', '.join(temuan_fisik)}")
    if severity:
        lines.append(f"Tingkat Keparahan: {severity}")

    lines.append("")

    # ---- Kandidat ICD-10 ----
    lines.append("=== KANDIDAT KODE ICD-10 (Top-5 dari RAG Pipeline) ===")
    for i, cand in enumerate(top_candidates, 1):
        lines.append(f"\n--- Kandidat #{i} ---")
        lines.append(f"Kode: {cand.get('code', '?')}")
        lines.append(f"Judul (EN): {cand.get('title', '-')}")
        lines.append(f"Judul (ID): {cand.get('title_id', '-')}")
        lines.append(f"Chapter: {cand.get('chapter', '-')} | Block: {cand.get('block', '-')}")

        # is_fktp_144
        fktp = cand.get("is_fktp_144")
        if fktp is not None:
            lines.append(f"Termasuk 144 Diagnosa FKTP: {'Ya ✓' if fktp else 'Tidak'}")

        lines.append(f"Bisa Diagnosis Utama: {'Ya' if cand.get('can_be_primary', True) else 'Tidak (hanya sekunder)'}")

        is_symptom = cand.get("is_symptom_code", False)
        if is_symptom:
            lines.append("⚠️ Ini adalah kode gejala (symptom code / R-code)")

        # Includes
        includes = cand.get("includes", [])
        if includes:
            lines.append(f"Includes: {'; '.join(includes[:5])}")

        # Excludes
        excludes = cand.get("excludes", [])
        if excludes:
            lines.append(f"Excludes: {'; '.join(excludes[:5])}")

        # Severity indicators
        sev = cand.get("severity_indicators", [])
        if sev:
            lines.append(f"Indikator Keparahan: {'; '.join(sev[:5])}")

        # Typical vitals
        tv = cand.get("typical_vitals", [])
        if tv:
            lines.append(f"Tanda Vital Tipikal: {'; '.join(tv[:5])}")

        # Clinical keywords
        keywords = cand.get("clinical_keywords", [])
        if keywords:
            lines.append(f"Kata Kunci Klinis: {', '.join(keywords[:8])}")

        # Dagger-asterisk
        da = cand.get("dagger_asterisk")
        if da:
            lines.append(f"Dagger/Asterisk: {da}")

        # Skor
        rerank = cand.get("rerank_score")
        search = cand.get("search_score")
        if rerank is not None:
            lines.append(f"Skor Relevansi (rerank): {rerank}")
        elif search is not None:
            lines.append(f"Skor Relevansi (search): {search}")

    context = "\n".join(lines)
    logger.info(
        "Langkah 4 selesai dalam %.2f detik. Konteks: %d karakter.",
        time.time() - t0,
        len(context),
    )
    return context


# ==============================================================================
# Langkah 5: Validasi Deterministik (Aturan BPJS)
# ==============================================================================


def validate_recommendations(
    recommendations: list[dict],
    knowledge_base: Optional[list[dict]] = None,
) -> list[dict]:
    """
    Langkah 5 Pipeline RAG — Validasi Deterministik sesuai Aturan BPJS.

    Menerapkan aturan hard-coded untuk memastikan rekomendasi kode ICD-10
    valid dan sesuai ketentuan klaim BPJS Kesehatan:
    1. Code Existence Check — Verifikasi kode ada di knowledge base
    2. R-code Warning — Kode gejala tidak boleh jadi diagnosis utama jika ada kode spesifik
    3. Excludes Conflict Check — Cek konflik antar kode yang direkomendasikan
    4. Dagger-Asterisk Check — Kode asterisk harus dilengkapi kode dagger
    5. can_be_primary Check — Kode yang hanya bisa sekunder harus ditandai
    6. is_fktp_144 Info — Info apakah kode sesuai untuk klaim FKTP

    Args:
        recommendations: List[dict] — Daftar rekomendasi kode ICD-10.
            Setiap dict minimal memiliki key 'code'.
        knowledge_base: List[dict] — Knowledge base ICD-10 lengkap (opsional, auto-load jika None).

    Returns:
        List[dict] — Rekomendasi dengan field 'validation' ditambahkan.
    """
    t0 = time.time()
    logger.info(
        "Langkah 5: Memulai validasi deterministik pada %d rekomendasi ...",
        len(recommendations),
    )

    if not recommendations:
        return []

    if knowledge_base is None:
        knowledge_base = load_knowledge_base()

    # Index KB by code untuk lookup cepat
    kb_index: dict[str, dict] = {}
    for entry in knowledge_base:
        code = entry.get("code", "").strip().upper()
        if code:
            kb_index[code] = entry

    # Kumpulkan semua kode yang direkomendasikan
    all_recommended_codes = {
        rec.get("code", "").strip().upper() for rec in recommendations
    }

    # Cek apakah ada kode spesifik (non R-code) dalam rekomendasi
    has_specific_disease_code = any(
        code and not code.startswith("R") for code in all_recommended_codes
    )

    validated: list[dict] = []

    for i, rec in enumerate(recommendations):
        code = rec.get("code", "").strip().upper()
        warnings: list[str] = []
        is_valid = True
        can_be_primary = True
        is_fktp_144 = False
        classification = "primary" if i == 0 else "secondary"

        # ---- 1. Code Existence Check ----
        kb_entry = kb_index.get(code)
        if kb_entry is None:
            warnings.append(
                f"⚠️ Kode {code} tidak ditemukan dalam knowledge base ICD-10. "
                "Pastikan kode valid sebelum mengajukan klaim BPJS."
            )
            is_valid = False
            # Tetap lanjut validasi lainnya meskipun kode tidak ditemukan
            result = dict(rec)
            result["validation"] = {
                "code": code,
                "is_valid": is_valid,
                "warnings": warnings,
                "can_be_primary": can_be_primary,
                "is_fktp_144": is_fktp_144,
                "classification": classification,
            }
            validated.append(result)
            continue

        # ---- 2. R-code Warning ----
        is_symptom_code = kb_entry.get("is_symptom_code", False)
        if is_symptom_code and code.startswith("R") and classification == "primary":
            if has_specific_disease_code:
                warnings.append(
                    "⚠️ Kode gejala R-code tidak boleh menjadi diagnosis utama "
                    "jika diagnosis spesifik tersedia. BPJS akan menolak klaim."
                )
                is_valid = False

        # ---- 3. Excludes Conflict Check ----
        excludes = kb_entry.get("excludes", [])
        if excludes:
            for other_code in all_recommended_codes:
                if other_code == code:
                    continue
                other_entry = kb_index.get(other_code)
                if other_entry is None:
                    continue
                other_title = other_entry.get("title", "").lower()
                other_title_id = other_entry.get("title_id", "").lower()
                other_code_lower = other_code.lower()

                for excl_term in excludes:
                    excl_lower = excl_term.lower()
                    if (
                        excl_lower in other_title
                        or excl_lower in other_title_id
                        or other_code_lower in excl_lower
                        or excl_lower == other_code_lower
                    ):
                        warnings.append(
                            f"⚠️ Konflik excludes: Kode {code} mengecualikan "
                            f"'{excl_term}', namun kode {other_code} "
                            f"({other_entry.get('title', '')}) juga direkomendasikan. "
                            "Periksa kembali kombinasi diagnosis."
                        )
                        break  # Satu warning per pasangan kode cukup

        # ---- 4. Dagger-Asterisk Check ----
        dagger_asterisk = kb_entry.get("dagger_asterisk")
        if dagger_asterisk == "asterisk":
            warnings.append(
                f"⚠️ Kode {code} adalah kode asterisk (*). "
                "Kode dagger (†) yang bersesuaian HARUS disertakan "
                "sebagai diagnosis utama agar klaim BPJS valid."
            )
        elif dagger_asterisk == "dagger":
            # Info saja, tidak invalid
            warnings.append(
                f"ℹ️ Kode {code} adalah kode dagger (†). "
                "Pastikan kode asterisk (*) yang bersesuaian disertakan "
                "sebagai diagnosis tambahan jika diperlukan."
            )

        # ---- 5. can_be_primary Check ----
        can_be_primary = kb_entry.get("can_be_primary", True)
        if not can_be_primary and classification == "primary":
            warnings.append(
                f"⚠️ Kode {code} ({kb_entry.get('title', '')}) tidak dapat digunakan "
                "sebagai diagnosis utama. Kode ini hanya boleh menjadi diagnosis "
                "sekunder/tambahan."
            )
            classification = "secondary"

        # ---- 6. is_fktp_144 Info ----
        is_fktp_144 = kb_entry.get("is_fktp_144", False)

        # Bangun hasil validasi
        result = dict(rec)
        result["validation"] = {
            "code": code,
            "is_valid": is_valid and len([w for w in warnings if "⚠️" in w]) == 0,
            "warnings": warnings,
            "can_be_primary": can_be_primary,
            "is_fktp_144": is_fktp_144,
            "classification": classification,
        }
        validated.append(result)

    # Hitung ringkasan
    valid_count = sum(
        1 for v in validated if v.get("validation", {}).get("is_valid", False)
    )
    logger.info(
        "Langkah 5 selesai dalam %.2f detik. %d/%d rekomendasi valid.",
        time.time() - t0,
        valid_count,
        len(validated),
    )
    return validated


# Alias fungsi untuk kemudahan impor & kompatibilitas
validate_bpjs_guardrails = validate_recommendations


# ==============================================================================
# Pipeline Lengkap
# ==============================================================================


async def run_full_pipeline(
    subjective: str,
    objective: str,
    ai_client: Any,
    model_name: str,
) -> dict:
    """
    Menjalankan pipeline RAG lengkap untuk rekomendasi kode ICD-10.

    Pipeline terdiri dari 4 langkah (validasi dilakukan terpisah di main.py
    setelah LLM reasoning):
        1. NER extraction — Ekstraksi entitas klinis dari S+O
        2. Hybrid search — BM25 + Dense Embedding untuk pencarian kandidat
        3. Cross-encoder reranking — Reranking Top-20 menjadi Top-5
        4. Prepare reasoning context — Format konteks untuk penalaran LLM

    Args:
        subjective: Teks keluhan pasien (Subjective dari SOAP).
        objective: Teks tanda vital dan pemeriksaan fisik (Objective dari SOAP).
        ai_client: Instance OpenAI-compatible client (atau None untuk fallback).
        model_name: Nama model LLM yang digunakan.

    Returns:
        Dict berisi:
        - clinical_entities: Hasil NER (dict)
        - top_candidates: Top-5 kandidat ICD-10 setelah reranking (list[dict])
        - reasoning_context: Konteks terstruktur untuk prompt LLM (str)
        - knowledge_base: Referensi ke KB untuk validasi selanjutnya (list[dict])
        - pipeline_timing: Dict berisi waktu eksekusi setiap langkah (ms)
    """
    pipeline_start = time.time()
    timing: dict[str, float] = {}

    logger.info("=" * 60)
    logger.info("MEMULAI PIPELINE RAG ICD-10")
    logger.info("=" * 60)

    # ---- Load Knowledge Base ----
    try:
        kb = load_knowledge_base()
    except FileNotFoundError as exc:
        logger.error("Knowledge base tidak ditemukan: %s", exc)
        return {
            "clinical_entities": {},
            "top_candidates": [],
            "reasoning_context": "Knowledge base ICD-10 tidak tersedia.",
            "knowledge_base": [],
            "pipeline_timing": {},
            "error": str(exc),
        }

    # ---- Langkah 1: NER ----
    t1 = time.time()
    clinical_entities = await extract_clinical_entities(
        subjective=subjective,
        objective=objective,
        ai_client=ai_client,
        model_name=model_name,
    )
    timing["step1_ner_ms"] = round((time.time() - t1) * 1000, 1)

    # ---- Langkah 2: Hybrid Search ----
    t2 = time.time()
    search_results = hybrid_search(
        clinical_entities=clinical_entities,
        knowledge_base=kb,
        top_k=20,
    )
    timing["step2_hybrid_search_ms"] = round((time.time() - t2) * 1000, 1)

    # ---- Langkah 3: Cross-Encoder Reranking ----
    t3 = time.time()
    # Bangun profil klinis untuk reranking
    profile_parts: list[str] = []
    for g in clinical_entities.get("gejala_utama", []):
        profile_parts.append(g)
    for g in clinical_entities.get("gejala_penyerta", []):
        profile_parts.append(g)
    tv = clinical_entities.get("tanda_vital", {})
    if tv:
        for k, v in tv.items():
            if v:
                profile_parts.append(f"{k}: {v}")
    for tf in clinical_entities.get("temuan_fisik", []):
        profile_parts.append(tf)
    profile_parts.append(clinical_entities.get("search_query_en", ""))
    profile_parts.append(clinical_entities.get("search_query_id", ""))
    query_profile = " ".join(p for p in profile_parts if p)

    top_candidates = rerank_candidates(
        query_profile=query_profile,
        candidates=search_results,
        top_k=5,
    )
    timing["step3_rerank_ms"] = round((time.time() - t3) * 1000, 1)

    # ---- Langkah 4: Prepare Reasoning Context ----
    t4 = time.time()
    reasoning_context = prepare_reasoning_context(
        clinical_entities=clinical_entities,
        top_candidates=top_candidates,
    )
    timing["step4_context_ms"] = round((time.time() - t4) * 1000, 1)

    # ---- Total ----
    timing["total_pipeline_ms"] = round((time.time() - pipeline_start) * 1000, 1)

    logger.info(
        "PIPELINE RAG SELESAI — Total: %.0f ms (NER: %.0f ms, Search: %.0f ms, "
        "Rerank: %.0f ms, Context: %.0f ms)",
        timing["total_pipeline_ms"],
        timing["step1_ner_ms"],
        timing["step2_hybrid_search_ms"],
        timing["step3_rerank_ms"],
        timing["step4_context_ms"],
    )
    logger.info("=" * 60)

    return {
        "clinical_entities": clinical_entities,
        "top_candidates": top_candidates,
        "reasoning_context": reasoning_context,
        "knowledge_base": kb,
        "pipeline_timing": timing,
    }
