"use client";

import React, { useState } from "react";

// Tipe data Pydantic dari FastAPI Backend
export interface SOAPModel {
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

export interface RecommendICDResponse {
  success: boolean;
  selected_code: string;
  selected_description: string;
  confidence: number;
  evidence: string;
  reasoning?: string;
  extracted_diagnosis: string;
  candidates: ICDCandidate[];
}

export default function NextjsSOAPICDPage() {
  const [transcript, setTranscript] = useState<string>(
    `Dokter: "Selamat pagi Pak Budi, apa keluhan yang dirasakan hari ini?"\nPasien: "Pagi dok. Leher belakang saya kaku dan kepala pusing berdenyut sejak kemarin."\nDokter: "Tensinya 140/90 mmHg. Kita sesuaikan dosis Amlodipine 10mg pagi ya."`,
  );

  const [isLoadingSoap, setIsLoadingSoap] = useState(false);
  const [soapData, setSoapData] = useState<SOAPModel | null>(null);
  const [soapError, setSoapError] = useState<string | null>(null);

  const [isLoadingIcd, setIsLoadingIcd] = useState(false);
  const [icdResult, setIcdResult] = useState<RecommendICDResponse | null>(null);
  const [icdError, setIcdError] = useState<string | null>(null);

  // URL Backend FastAPI (port default 8000)
  const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://127.0.0.1:8000";

  // ============================================================================
  // Tahap 1.3: Panggil Endpoint /generate-soap
  // ============================================================================
  const handleGenerateSoap = async () => {
    if (!transcript.trim()) return;
    setIsLoadingSoap(true);
    setSoapError(null);
    setIcdResult(null);

    try {
      const response = await fetch(`${FASTAPI_URL}/generate-soap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || "Gagal membuat catatan SOAP");
      }

      setSoapData(data.soap);
    } catch (err: any) {
      setSoapError(err.message || "Koneksi ke backend FastAPI gagal");
    } finally {
      setIsLoadingSoap(false);
    }
  };

  // ============================================================================
  // Tahap 1.4: Panggil Endpoint /recommend-icd (RAG)
  // ============================================================================
  const handleRecommendIcd = async () => {
    if (!soapData) return;
    setIsLoadingIcd(true);
    setIcdError(null);

    try {
      const response = await fetch(`${FASTAPI_URL}/recommend-icd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soap: soapData }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || "Gagal mendapatkan rekomendasi ICD");
      }

      setIcdResult(data);
    } catch (err: any) {
      setIcdError(err.message || "Gagal memproses rekomendasi ICD");
    } finally {
      setIsLoadingIcd(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <header style={{ marginBottom: 24, borderBottom: "1px solid #e2e8f0", paddingBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: "bold", color: "#0f172a" }}>
          SOAPI Clinical Assistant (Next.js + FastAPI)
        </h1>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          Integrasi antarmuka Next.js ke backend FastAPI (/generate-soap &amp; /recommend-icd)
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Kolom Kiri: Input Transkrip */}
        <div>
          <h3>Transkripsi Percakapan</h3>
          <textarea
            rows={10}
            style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
          <button
            onClick={handleGenerateSoap}
            disabled={isLoadingSoap}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "10px 16px",
              backgroundColor: "#0d9488",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isLoadingSoap ? "Memproses SOAP..." : "1. Generate SOAP"}
          </button>
          {soapError && <p style={{ color: "#ef4444", fontSize: 13 }}>{soapError}</p>}
        </div>

        {/* Kolom Kanan: Tampilan SOAP & Rekomendasi ICD */}
        <div>
          <h3>Catatan Medis SOAP (Tervalidasi)</h3>
          {!soapData ? (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>Klik 'Generate SOAP' untuk melihat hasil.</p>
          ) : (
            <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <p><strong>[S] Subjective:</strong> {soapData.subjective}</p>
              <p><strong>[O] Objective:</strong> {soapData.objective}</p>
              <p><strong>[A] Assessment:</strong> {soapData.assessment}</p>
              <p><strong>[P] Plan:</strong> {soapData.plan}</p>
              {soapData.intervention && <p><strong>[I] Intervention:</strong> {soapData.intervention}</p>}

              <button
                onClick={handleRecommendIcd}
                disabled={isLoadingIcd}
                style={{
                  marginTop: 16,
                  width: "100%",
                  padding: "10px 16px",
                  backgroundColor: "#1e293b",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {isLoadingIcd ? "Mencari ICD (RAG)..." : "2. Rekomendasikan Kode ICD-10 (RAG)"}
              </button>
            </div>
          )}

          {icdResult && (
            <div style={{ marginTop: 16, background: "#ecfdf5", border: "1px solid #a7f3d0", padding: 16, borderRadius: 8 }}>
              <h4 style={{ color: "#065f46", margin: "0 0 8px 0" }}>
                Kode ICD-10 Terpilih: <strong>{icdResult.selected_code}</strong> ({Math.round(icdResult.confidence * 100)}%)
              </h4>
              <p style={{ fontSize: 14, color: "#047857" }}>{icdResult.selected_description}</p>
              <p style={{ fontSize: 12, color: "#374151" }}>
                <strong>Bukti Kutipan SOAP:</strong> "{icdResult.evidence}"
              </p>
              <p style={{ fontSize: 12, color: "#64748b" }}>
                Kandidat dievaluasi: {icdResult.candidates.map((c) => c.kode).join(", ")}
              </p>
            </div>
          )}
          {icdError && <p style={{ color: "#ef4444", fontSize: 13 }}>{icdError}</p>}
        </div>
      </div>
    </div>
  );
}
