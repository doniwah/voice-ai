import React, { useState } from "react";
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Database,
  Quote,
  Loader2,
  ShieldCheck,
  ClipboardEdit,
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
}

interface SOAPICDAssistantProps {
  initialTranscript?: string;
  onApplyToConsultation?: (soap: SOAPData, icd?: ICDRecommendation) => void;
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

  const targetBaseUrl = "/api";

  // 1. Generate SOAP via Backend (Prompt Engineering + JSON Mode + Pydantic validation)
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
      setSoapModelUsed(data.model_used || "FastAPI / OpenAI");
      toast.success("Catatan medis SOAP berhasil digenerate dan divalidasi Pydantic!");
    } catch (err: any) {
      console.error("Generate SOAP Error:", err);
      const errMsg =
        err.message || "Gagal menghubungi backend FastAPI /generate-soap";
      setSoapError(errMsg);
      toast.error(`Error Generate SOAP: ${errMsg}`);
    } finally {
      setIsLoadingSoap(false);
    }
  };

  // 2. Recommend ICD via Backend (RAG: Ekstraksi -> Retrieval -> Verifikasi)
  // Accepts optional updatedSoap to include doctor's manually-filled Objective
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
      toast.success(
        `Kode ICD-10 ${data.selected_code} berhasil direkomendasikan dengan bukti teks SOAP!`,
      );
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

  // 3. Confirm Objective: doctor fills manual objective -> call /api/generate-assessment-icd
  const handleConfirmObjective = async () => {
    if (!objectiveInput.trim()) {
      toast.error("Harap isi data Objective (tanda vital & fisik) terlebih dahulu");
      return;
    }
    if (!soapData) return;

    setIsLoadingIcd(true);
    setIcdError(null);

    const mergedObjective = objectiveInput.trim();

    try {
      toast.info("Menganalisis S + O dengan Hybrid RAG ICD-10 & Validasi BPJS...");
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

      // Update SOAP Data dengan Asesmen yang digenerate langsung dari kombinasi S + O
      const updatedSoap: SOAPData = {
        ...soapData,
        objective: mergedObjective,
        assessment: data.assessment || soapData.assessment,
      };
      setSoapData(updatedSoap);
      setIcdResult(data);
      setIsObjectiveConfirmed(true);

      toast.success(
        `Diagnosis & Rekomendasi ICD-10 ${data.selected_code} berhasil dianalisis dengan aturan BPJS!`
      );
    } catch (err: any) {
      console.warn("Generate Assessment ICD notice, attempting fallback:", err);
      // Fallback gracefully jika endpoint khusus belum siap
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

  // Human-in-the-loop: Dokter dapat memilih diagnosis sekunder menjadi diagnosis utama
  const handleSelectPrimaryRecommendation = (rec: ICDRecommendationItem) => {
    if (!icdResult) return;
    setIcdResult({
      ...icdResult,
      selected_code: rec.code,
      selected_description: `${rec.display_name} (${rec.display_name_id || ""})`,
      confidence: rec.confidence,
      reasoning: rec.clinical_rationale,
      evidence: `S: "${rec.evidence_s || ""}" | O: "${rec.evidence_o || ""}"`,
    });
    if (soapData) {
      setSoapData({
        ...soapData,
        assessment: `${rec.display_name_id || rec.display_name} [${rec.code}]`,
      });
    }
    toast.success(`Diagnosis utama diubah ke: ${rec.code} - ${rec.display_name_id || rec.display_name}`);
  };

  const copyToClipboard = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    toast.success("Berhasil disalin ke clipboard!");
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Input Transcription & Presets */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Transkripsi Percakapan Medis
              </label>
              <span className="text-[11px] text-muted-foreground">
                {transcript.length} karakter
              </span>
            </div>

            {/* Transcript Textarea */}
            <textarea
              rows={12}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Ketik atau tempel transkripsi percakapan antara Dokter dan Pasien di sini..."
              className="w-full rounded-xl border border-input bg-background p-3.5 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
            />

            {/* Action Button: Generate SOAP */}
            <button
              type="button"
              onClick={handleGenerateSoap}
              disabled={isLoadingSoap || !transcript.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6E68] px-5 py-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#0a5752] disabled:opacity-50 cursor-pointer"
            >
              {isLoadingSoap ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Memanggil FastAPI /generate-soap...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>1. Generate SOAP (Prompt Engineering)</span>
                </>
              )}
            </button>

            {soapError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Gagal memproses SOAP:</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                    {soapError}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Pastikan server FastAPI berjalan:{" "}
                    <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">
                      uvicorn backend.main:app --port 8000 --reload
                    </code>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Structured SOAP & ICD RAG Recommendation */}
        <div className="space-y-6 lg:col-span-7">
          {/* Section A: Validated SOAP Model */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#0D6E68]" />
                <h3 className="text-sm font-bold text-foreground">
                  Catatan Medis SOAP (Pydantic Validated)
                </h3>
              </div>

              {soapModelUsed && (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Model: {soapModelUsed} (temp=0)
                </span>
              )}
            </div>

            {!soapData ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <FileText className="h-8 w-8 stroke-[1.5] opacity-40 mb-2" />
                <p className="text-xs font-medium">Belum ada catatan SOAP yang digenerate.</p>
                <p className="text-[11px] opacity-70 mt-0.5">
                  Klik tombol <strong>Generate SOAP</strong> di sebelah kiri untuk memulai.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* S - Subjective */}
                <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[#0D6E68] uppercase text-[11px] tracking-wider">
                      [S] Subjective (Keluhan &amp; Riwayat)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(soapData.subjective, "s")}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Salin"
                    >
                      {copiedSection === "s" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="leading-relaxed text-foreground">{soapData.subjective}</p>
                </div>

                {/* O - Objective */}
                <div className="rounded-xl border border-amber-400/50 bg-amber-50/60 p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-amber-700 uppercase text-[11px] tracking-wider">
                      [O] Objective (Tanda Vital &amp; Fisik)
                    </span>
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">
                      Isi manual oleh dokter
                    </span>
                  </div>
                  {isObjectiveConfirmed ? (
                    <div className="flex items-start justify-between gap-2">
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
                        className="shrink-0 text-[10px] font-semibold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <>
                      <textarea
                        rows={4}
                        value={objectiveInput}
                        onChange={(e) => setObjectiveInput(e.target.value)}
                        placeholder={
                          soapData.objective
                            ? `Panduan AI: "${soapData.objective}"\n\nSilakan isi tanda vital aktual pasien (TD, nadi, suhu, SpO2, pemeriksaan fisik, dll.)...`
                            : "Masukkan tanda vital & temuan fisik (TD, nadi, suhu, SpO2, pemeriksaan fisik, dll.)..."
                        }
                        className="w-full rounded-lg border border-amber-300 bg-white p-2.5 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-amber-400/40 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleConfirmObjective}
                        disabled={isLoadingIcd}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-amber-700 disabled:opacity-60 cursor-pointer"
                      >
                        {isLoadingIcd ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Menjalankan RAG ICD-10...</span>
                          </>
                        ) : (
                          <>
                            <ClipboardEdit className="h-3.5 w-3.5" />
                            <span>Konfirmasi Objective &amp; Generate Kode ICD-10</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* A, P, I — hanya tampil setelah Objective dikonfirmasi */}
                {isObjectiveConfirmed && (
                  <>
                    {/* A - Assessment + ICD-10 Inline */}
                    <div className={cn(
                      "rounded-xl border p-4 text-xs space-y-3.5",
                      icdResult
                        ? "border-emerald-400/60 bg-emerald-50/40"
                        : "border-teal-500/30 bg-teal-500/5"
                    )}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-teal-800 uppercase text-[11px] tracking-wider">
                          [A] Assessment (Diagnosis Klinis dari S + O)
                        </span>
                        <div className="flex items-center gap-2">
                          {isLoadingIcd && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              RAG BPJS berjalan...
                            </span>
                          )}
                          {icdResult && (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                              <ShieldCheck className="h-3 w-3" />
                              ICD-10: {icdResult.selected_code}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(
                              icdResult
                                ? `${soapData.assessment}\n\nKode ICD-10 Utama: ${icdResult.selected_code} — ${icdResult.selected_description}`
                                : soapData.assessment,
                              "a"
                            )}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Salin"
                          >
                            {copiedSection === "a" ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="leading-relaxed font-semibold text-teal-950 text-sm">
                        {soapData.assessment}
                      </p>

                      {/* Loading state indicator */}
                      {isLoadingIcd && !icdResult && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-2.5">
                          <Loader2 className="h-4 w-4 animate-spin text-amber-600 shrink-0" />
                          <div>
                            <p className="text-[11px] font-bold text-amber-700">Menganalisis S + O dengan Hybrid RAG &amp; Validasi BPJS...</p>
                            <p className="text-[10px] text-amber-600 mt-0.5">
                              NER Entitas → Hybrid Search (BM25 + Semantic) → Reranking → Cek Aturan BPJS INA-CBGs
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Warning Banner: Kepatuhan Aturan Klaim BPJS (INA-CBGs) */}
                      {icdResult?.r_code_warning && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs flex items-start gap-2.5">
                          <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-amber-900 text-[11px]">
                              Kepatuhan Aturan Koding Klaim BPJS (INA-CBGs)
                            </p>
                            <p className="text-[10px] text-amber-800 leading-relaxed mt-0.5">
                              {icdResult.r_code_warning}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Rekomendasi Kode ICD-10 (Top-3 Berdasarkan S + O) */}
                      {icdResult && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Rekomendasi Kode ICD-10 (Tervalidasi Aturan BPJS):
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Human-in-the-Loop (Dokter dapat memilih)
                            </span>
                          </div>

                          {/* Jika ada recommendations array (Top-3 dari pipeline baru) */}
                          {icdResult.recommendations && icdResult.recommendations.length > 0 ? (
                            <div className="space-y-2">
                              {icdResult.recommendations.map((rec, rIdx) => {
                                const isPrimary = rec.classification === "primary" || rec.code === icdResult.selected_code;
                                const isFktp = rec.validation?.is_fktp_144;
                                const hasWarnings = rec.validation?.warnings && rec.validation.warnings.length > 0;

                                return (
                                  <div
                                    key={rec.code + rIdx}
                                    className={cn(
                                      "rounded-xl border p-3 text-xs transition-all",
                                      isPrimary
                                        ? "border-emerald-500 bg-white shadow-xs ring-1 ring-emerald-500/30"
                                        : "border-border bg-card/80 hover:bg-muted/30"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                                          #{rec.rank || rIdx + 1}
                                        </span>
                                        <span className="rounded-lg bg-emerald-700 px-2 py-0.5 font-mono text-sm font-extrabold text-white">
                                          {rec.code}
                                        </span>
                                        <span className="font-bold text-foreground text-xs">
                                          {rec.display_name_id || rec.display_name}
                                        </span>

                                        {/* Status Diagnosis Utama vs Sekunder */}
                                        <span
                                          className={cn(
                                            "rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider",
                                            isPrimary
                                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                              : "bg-slate-100 text-slate-700 border border-slate-300"
                                          )}
                                        >
                                          {isPrimary ? "Diagnosis Utama" : "Diagnosis Sekunder"}
                                        </span>

                                        {/* FKTP 144 Tag */}
                                        {isFktp && (
                                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200">
                                            ✓ 144 Diagnosa FKTP
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <span className={cn(
                                          "text-[10px] font-bold rounded-full px-2 py-0.5",
                                          rec.confidence >= 0.85
                                            ? "bg-emerald-100 text-emerald-800"
                                            : rec.confidence >= 0.70
                                              ? "bg-yellow-100 text-yellow-800"
                                              : "bg-red-100 text-red-800"
                                        )}>
                                          {Math.round(rec.confidence * 100)}% Match
                                        </span>

                                        {!isPrimary && (
                                          <button
                                            type="button"
                                            onClick={() => handleSelectPrimaryRecommendation(rec)}
                                            className="text-[10px] font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg px-2 py-1 transition-colors cursor-pointer"
                                          >
                                            Jadikan Utama
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Clinical Rationale */}
                                    <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                                      <strong className="text-foreground">Alasan Klinis:</strong> {rec.clinical_rationale}
                                    </p>

                                    {/* Evidence quotes if available */}
                                    {(rec.evidence_s || rec.evidence_o) && (
                                      <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-muted-foreground bg-muted/40 rounded-lg p-2 border border-border/60">
                                        {rec.evidence_s && (
                                          <div className="flex-1 min-w-[200px]">
                                            <span className="font-bold text-teal-800">Bukti Subjektif:</span> "{rec.evidence_s}"
                                          </div>
                                        )}
                                        {rec.evidence_o && (
                                          <div className="flex-1 min-w-[200px]">
                                            <span className="font-bold text-amber-800">Bukti Objektif:</span> "{rec.evidence_o}"
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Warnings if any */}
                                    {hasWarnings && (
                                      <div className="mt-1 text-[10px] text-amber-700">
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
                            /* Fallback single card display jika data dari endpoint lama */
                            <div className="rounded-xl border border-emerald-400/50 bg-white p-3 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="rounded-lg bg-emerald-700 px-2.5 py-1 font-mono text-sm font-extrabold text-white">
                                  {icdResult.selected_code}
                                </span>
                                <span className="font-bold text-emerald-900 text-xs flex-1">
                                  {icdResult.selected_description}
                                </span>
                                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800">
                                  {Math.round(icdResult.confidence * 100)}% confidence
                                </span>
                              </div>
                              <p className="text-[10px] text-emerald-900 leading-relaxed">
                                <span className="font-bold">Alasan klinis:</span> {icdResult.reasoning || icdResult.evidence}
                              </p>
                            </div>
                          )}

                          {/* Re-run button */}
                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={handleConfirmObjective}
                              disabled={isLoadingIcd}
                              className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 underline cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Jalankan Ulang RAG ICD-10
                            </button>
                            <span className="text-[10px] text-muted-foreground">
                              Model: Hybrid (BM25 + Semantic) &amp; INA-CBGs Guardrails
                            </span>
                          </div>
                        </div>
                      )}

                      {icdError && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-[11px] text-destructive flex items-start gap-2">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">RAG ICD-10 gagal:</p>
                            <p className="mt-0.5 opacity-90">{icdError}</p>
                            <button
                              type="button"
                              onClick={handleConfirmObjective}
                              className="mt-1 underline font-semibold cursor-pointer"
                            >
                              Coba lagi
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* P - Plan */}
                    <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-[#0D6E68] uppercase text-[11px] tracking-wider">
                          [P] Plan (Rencana Terapi &amp; Kontrol)
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(soapData.plan, "p")}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Salin"
                        >
                          {copiedSection === "p" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="leading-relaxed text-foreground whitespace-pre-line">
                        {soapData.plan}
                      </p>
                    </div>

                    {/* I - Intervention (if present) */}
                    {soapData.intervention && (
                      <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-[#0D6E68] uppercase text-[11px] tracking-wider">
                            [I] Intervention (Edukasi &amp; Tindakan)
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(soapData.intervention || "", "i")}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Salin"
                          >
                            {copiedSection === "i" ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <p className="leading-relaxed text-foreground">
                          {soapData.intervention}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section B: Detail RAG Pipeline & Aturan BPJS */}
          {icdResult && isObjectiveConfirmed && (
            <div className="rounded-2xl border border-teal-300/80 bg-card p-5 shadow-sm space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#0D6E68]" />
                  <h3 className="text-sm font-bold text-foreground">
                    Detail Pipeline RAG ICD-10 (BPJS INA-CBGs Compliant)
                  </h3>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  {Math.round(icdResult.confidence * 100)}% Match
                </span>
              </div>

              {/* 4 Pipeline Stages Summary */}
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                {/* Tahap 1: Ekstraksi Entitas Klinis */}
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Tahap 1: Ekstraksi Entitas Klinis (NER S + O)
                  </p>
                  <p className="mt-1 font-bold text-foreground">
                    {icdResult.extracted_diagnosis}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Keluhan utama, durasi, tanda vital objektif terukur
                  </p>
                </div>

                {/* Tahap 2 & 3: Hybrid Search & Reranking */}
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Tahap 2 &amp; 3: Hybrid Search (BM25 + Dense)
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {icdResult.candidates.slice(0, 5).map((c, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[10px]",
                          c.kode === icdResult.selected_code
                            ? "bg-[#0D6E68] text-white font-bold"
                            : "bg-background text-foreground border border-border",
                        )}
                        title={c.deskripsi}
                      >
                        {c.kode}
                      </span>
                    ))}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    BM25 Okapi lexical + semantic relevance
                  </p>
                </div>
              </div>

              {/* Tahap 4 & 5: BPJS INA-CBGs Guardrails Status */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3.5 text-xs space-y-1.5">
                <p className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  Tahap 4 &amp; 5: Validasi Aturan Koding BPJS INA-CBGs
                </p>
                <div className="grid gap-2 sm:grid-cols-3 text-[10px] pt-1">
                  <div className="rounded-lg bg-background p-2 border border-border">
                    <span className="font-bold text-foreground">Larangan Kode R:</span>
                    <p className="text-muted-foreground mt-0.5">
                      Kode gejala dilarang menjadi diagnosis utama jika ada kausalitas.
                    </p>
                  </div>
                  <div className="rounded-lg bg-background p-2 border border-border">
                    <span className="font-bold text-foreground">FKTP 144 Diagnosa:</span>
                    <p className="text-muted-foreground mt-0.5">
                      Verifikasi kompetensi penanganan tuntas di faskes primer.
                    </p>
                  </div>
                  <div className="rounded-lg bg-background p-2 border border-border">
                    <span className="font-bold text-foreground">Aturan Excludes:</span>
                    <p className="text-muted-foreground mt-0.5">
                      Pencegahan konflik tumpang tindih diagnosis ganda.
                    </p>
                  </div>
                </div>
              </div>

              {/* Apply to Consultation callback button if provided */}
              {onApplyToConsultation && (
                <button
                  type="button"
                  onClick={() => onApplyToConsultation(soapData!, icdResult)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6E68] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#0a5752] cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Gunakan Catatan SOAP &amp; ICD-10 Ini pada Konsultasi</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
