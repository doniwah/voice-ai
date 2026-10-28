import React, { useState } from "react";
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Stethoscope,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Database,
  Quote,
  ShieldAlert,
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

export interface ICDRecommendation {
  selected_code: string;
  selected_description: string;
  confidence: number;
  evidence: string;
  reasoning?: string;
  extracted_diagnosis: string;
  candidates: ICDCandidate[];
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

  // 2. Recommend ICD via Backend (RAG Sederhana: Ekstraksi -> Retrieval -> Verifikasi)
  const handleRecommendIcd = async () => {
    if (!soapData) {
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
        body: JSON.stringify({ soap: soapData }),
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
                <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[#0D6E68] uppercase text-[11px] tracking-wider">
                      [O] Objective (Tanda Vital &amp; Fisik)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(soapData.objective, "o")}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Salin"
                    >
                      {copiedSection === "o" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="leading-relaxed text-foreground whitespace-pre-line">
                    {soapData.objective}
                  </p>
                </div>

                {/* A - Assessment */}
                <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3.5 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-teal-800 uppercase text-[11px] tracking-wider">
                      [A] Assessment (Diagnosis Klinis)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(soapData.assessment, "a")}
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
                  <p className="leading-relaxed font-semibold text-teal-950">
                    {soapData.assessment}
                  </p>
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

                {/* Button to Trigger Step 2: ICD Recommendation */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleRecommendIcd}
                    disabled={isLoadingIcd}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-navy-soft disabled:opacity-50 cursor-pointer"
                  >
                    {isLoadingIcd ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Menjalankan RAG (Ekstraksi -&gt; CSV -&gt; Verifikasi LLM)...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        <span>2. Cari Rekomendasi Kode ICD-10 (RAG)</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section B: ICD-10 Recommendation & RAG Pipeline Visualization */}
          {icdResult && (
            <div className="rounded-2xl border border-teal-300/80 bg-card p-5 shadow-sm space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#0D6E68]" />
                  <h3 className="text-sm font-bold text-foreground">
                    Hasil Rekomendasi ICD-10 (RAG Pipeline)
                  </h3>
                </div>

                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Confidence: {Math.round(icdResult.confidence * 100)}%
                </span>
              </div>

              {/* RAG Step Highlights */}
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                {/* Langkah A: Extracted Diagnosis */}
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Langkah A: Istilah Diagnosis Diekstrak
                  </p>
                  <p className="mt-1 font-bold text-foreground">
                    {icdResult.extracted_diagnosis}
                  </p>
                </div>

                {/* Langkah B: Candidates from CSV */}
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Langkah B: Retrieval Kamus CSV (Top Kandidat)
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {icdResult.candidates.slice(0, 4).map((c, idx) => (
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
                    {icdResult.candidates.length > 4 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{icdResult.candidates.length - 4} lainnya
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Langkah C: Selected ICD-10 Code Card */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-emerald-700 px-2 py-1 font-mono text-sm font-extrabold text-white">
                      {icdResult.selected_code}
                    </span>
                    <span className="font-bold text-emerald-950 text-sm">
                      {icdResult.selected_description}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `${icdResult.selected_code} - ${icdResult.selected_description}`,
                        "icd",
                      )
                    }
                    className="text-emerald-800 hover:text-emerald-950 cursor-pointer"
                    title="Salin kode"
                  >
                    {copiedSection === "icd" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Evidence Quote */}
                <div className="rounded-lg bg-background/80 p-3 border border-emerald-500/20 text-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Quote className="h-3 w-3 text-emerald-600" />
                    Bukti Klinis Dikutip dari SOAP (Anti-Halusinasi):
                  </p>
                  <p className="mt-1 italic text-foreground font-medium">
                    "{icdResult.evidence}"
                  </p>
                </div>

                {/* Reasoning */}
                {icdResult.reasoning && (
                  <p className="text-[11px] text-emerald-900 leading-relaxed pt-1">
                    <strong>Alasan Klinis:</strong> {icdResult.reasoning}
                  </p>
                )}
              </div>

              {/* Full Candidate Pool Accordion */}
              <div className="rounded-xl border border-border p-3 text-xs">
                <p className="font-bold text-muted-foreground mb-2 text-[11px]">
                  Daftar Lengkap Kandidat Kode dari icd10.csv:
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                  {icdResult.candidates.map((c, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg border",
                        c.kode === icdResult.selected_code
                          ? "border-emerald-500 bg-emerald-50 font-bold text-emerald-950"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      <span>
                        {c.kode} — {c.deskripsi}
                      </span>
                      {c.kode === icdResult.selected_code && (
                        <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          Terpilih
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Apply to Consultation callback button if provided */}
              {onApplyToConsultation && (
                <button
                  type="button"
                  onClick={() => onApplyToConsultation(soapData, icdResult)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6E68] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0a5752] cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Gunakan Catatan SOAP &amp; ICD-10 Ini pada Konsultasi</span>
                </button>
              )}
            </div>
          )}

          {icdError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Gagal memproses rekomendasi ICD:</p>
                <p className="mt-0.5 text-[11px] opacity-90">{icdError}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
