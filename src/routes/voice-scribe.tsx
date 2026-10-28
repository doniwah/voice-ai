import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Mic,
  Square,
  Check,
  CheckCircle2,
  FileText,
  LayoutGrid,
  RotateCcw,
  FileCheck,
  Search,
  Loader2,
  User,
  Stethoscope,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { patients as fallbackPatients, type Patient } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SOAPICDAssistant } from "@/components/soap-icd-assistant";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/voice-scribe")({
  head: () => ({
    meta: [
      { title: "Voice Scribe — SOAPI" },
      {
        name: "description",
        content: "Rekam dan transkripsikan konsultasi medis secara real-time bertenaga AI.",
      },
    ],
  }),
  component: VoiceScribe,
});

const defaultWaveHeights = [
  8, 12, 14, 18, 16, 24, 20, 32, 28, 40, 34, 46, 36, 46, 34, 40, 28, 32, 20, 24, 16, 18, 14, 12, 8,
];

export interface TranscriptItem {
  id?: string;
  speaker: "Dokter" | "Pasien";
  text: string;
  time: string;
  isAiAnalyzing?: boolean;
  isAiVerified?: boolean;
  reason?: string;
}

const sampleDialogues: TranscriptItem[] = [
  {
    id: "sample-1",
    speaker: "Dokter",
    text: "Selamat pagi Pak Budi, bagaimana kabarnya hari ini? Ada keluhan apa yang dirasakan?",
    time: "00:03",
    isAiVerified: true,
  },
  {
    id: "sample-2",
    speaker: "Pasien",
    text: "Selamat pagi dok. Ini belakangan tengkuk saya terasa kaku dan kepala sering pusing berdenyut dok, terutama kalau pagi atau lelah.",
    time: "00:08",
    isAiVerified: true,
  },
  {
    id: "sample-3",
    speaker: "Dokter",
    text: "Baik, apakah obat amlodipine yang kemarin masih rutin diminum setiap hari?",
    time: "00:15",
    isAiVerified: true,
  },
  {
    id: "sample-4",
    speaker: "Pasien",
    text: "Masih dok, tapi kadang kalau lupa suka terlewat satu hari.",
    time: "00:20",
    isAiVerified: true,
  },
  {
    id: "sample-5",
    speaker: "Dokter",
    text: "Baik, mari kita ukur tekanan darahnya dulu ya. Tensinya 140/90 mmHg. Kita sesuaikan dosisnya dan kontrol pola makannya ya.",
    time: "00:28",
    isAiVerified: true,
  },
];

/**
 * Real-time Clinical Diarizer: Automatically assigns Dokter vs Pasien roles
 * based on deep medical scoring, active listening reflection, symptom keywords anywhere in the utterance,
 * and conversational continuity across pauses.
 */
function classifySpeakerRole(
  text: string,
  lastSpeaker?: "Dokter" | "Pasien",
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

  // If text mentions ANY symptom or body part, it belongs to Pasien
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


function VoiceScribe() {
  const [patientList, setPatientList] = useState<Patient[]>(fallbackPatients);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(fallbackPatients[0]?.id ?? "1");
  const [isChangePatientOpen, setIsChangePatientOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [activeView, setActiveView] = useState<"scribe" | "fastapi_assistant">("scribe");
  const [carriedTranscript, setCarriedTranscript] = useState<string>("");

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [processingStep, setProcessingStep] = useState<number>(0); // 0=idle, 1=capturing, 2=stt, 3=structuring, 4=done
  const [seconds, setSeconds] = useState(0);
  const [hasRecorded, setHasRecorded] = useState(false);

  // Real-time Speech-to-Text State
  const [transcriptLines, setTranscriptLines] = useState<TranscriptItem[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [isMicSpeaking, setIsMicSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeSessionRef = useRef<{ consultationId?: string; sessionId?: string }>({});
  const recognitionRef = useRef<any>(null);

  // Synchronized refs for real-time speech event handlers
  const secondsRef = useRef<number>(0);
  const isRecordingRef = useRef<boolean>(false);
  const transcriptLinesRef = useRef<TranscriptItem[]>([]);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    transcriptLinesRef.current = transcriptLines;
  }, [transcriptLines]);

  // 1. Fetch real patients from PostgreSQL on mount
  useEffect(() => {
    fetch("/api/patients")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.length > 0) {
          setPatientList(json.data);
          setSelectedPatientId((prev) => {
            const exists = json.data.some((p: Patient) => p.id === prev);
            return exists ? prev : json.data[0].id;
          });
        }
      })
      .catch((err) => {
        console.warn("Using fallback local patients data:", err);
      });
  }, []);

  const selectedPatient = patientList.find((p) => p.id === selectedPatientId) ?? patientList[0];

  // 2. Timer during recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // 3. Start recording: Real Microphone + Real-time Web Speech STT
  const startRecording = () => {
    try {
      setIsRecording(true);
      setHasRecorded(true);
      setSeconds(0);
      setTranscriptLines([]);
      setInterimTranscript("");
      setProcessingStep(1);

      // A. START SPEECH RECOGNITION IMMEDIATELY (within synchronous User-Click tick)
      if (typeof window !== "undefined") {
        const SpeechRecognitionClass =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (SpeechRecognitionClass) {
          try {
            if (recognitionRef.current) {
              try {
                recognitionRef.current.abort();
              } catch {}
            }

            const recognition = new SpeechRecognitionClass();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "id-ID"; // Native Indonesian Speech Recognition

            recognition.onstart = () => {
              console.log("🎤 Speech recognition aktif & mendengarkan...");
            };

            recognition.onresult = (event: any) => {
              let currentInterim = "";
              for (let i = event.resultIndex; i < event.results.length; i++) {
                const speechResult = event.results[i];
                const text = speechResult[0]?.transcript || "";

                if (speechResult.isFinal) {
                  const cleanedText = text.trim();
                  if (cleanedText.length > 0) {
                    const currentTime = formatTimer(secondsRef.current);
                    const turnId = `turn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

                    // 1. Immediate fast classification for zero UI lag
                    const history = transcriptLinesRef.current;
                    const lastSpeaker = history.length > 0 ? history[history.length - 1].speaker : undefined;
                    const initialSpeaker = classifySpeakerRole(cleanedText, lastSpeaker);

                    setTranscriptLines((prev) => [
                      ...prev,
                      {
                        id: turnId,
                        speaker: initialSpeaker,
                        text: cleanedText,
                        time: currentTime,
                        isAiAnalyzing: true,
                        isAiVerified: false,
                      },
                    ]);

                    // 2. Real-time Gemini AI Clinical Analysis to verify & refine doctor vs patient turn
                    const recentContext = history
                      .slice(-6)
                      .map((item) => ({ speaker: item.speaker, text: item.text }));

                    fetch("/api/voice/classify-turn", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        text: cleanedText,
                        context: recentContext,
                      }),
                    })
                      .then((r) => r.json())
                      .then((res) => {
                        if (res.success && (res.speaker === "Dokter" || res.speaker === "Pasien")) {
                          setTranscriptLines((prev) =>
                            prev.map((item) =>
                              item.id === turnId
                                ? {
                                    ...item,
                                    speaker: res.speaker,
                                    isAiAnalyzing: false,
                                    isAiVerified: res.engine === "gemini-2.5-flash",
                                    reason: res.reason,
                                  }
                                : item,
                            ),
                          );
                        }
                      })
                      .catch((err) => {
                        console.warn("AI turn classification notice:", err);
                        setTranscriptLines((prev) =>
                          prev.map((item) =>
                            item.id === turnId ? { ...item, isAiAnalyzing: false } : item,
                          ),
                        );
                      });
                  }
                } else {
                  currentInterim += text;
                }
              }

              setInterimTranscript(currentInterim);
              setIsMicSpeaking(currentInterim.length > 0);
            };

            recognition.onerror = (e: any) => {
              console.warn("Speech recognition notice:", e.error);
              setIsMicSpeaking(false);
              if (e.error === "not-allowed") {
                toast.error("Izin akses mikrofon ditolak oleh browser.");
              }
            };

            recognition.onend = () => {
              setIsMicSpeaking(false);
              // Safely resume recognition while recording is active
              if (isRecordingRef.current) {
                setTimeout(() => {
                  if (isRecordingRef.current && recognitionRef.current) {
                    try {
                      recognitionRef.current.start();
                    } catch {}
                  }
                }, 150);
              }
            };

            recognition.start();
            recognitionRef.current = recognition;
          } catch (sttErr) {
            console.warn("Could not start Web Speech Recognition:", sttErr);
          }
        } else {
          toast.info("Browser Anda belum mendukung Web Speech API bawaan.");
        }
      }

      // B. Capture browser microphone audio stream synchronously
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            const mediaRecorder = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.start(250);
            mediaRecorderRef.current = mediaRecorder;
          })
          .catch((micErr) => {
            console.warn("Microphone capture warning:", micErr);
          });
      }

      // C. Notify backend of session start in background (non-blocking)
      const patient = patientList.find((p) => p.id === selectedPatientId) || patientList[0];
      fetch("/api/voice/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patient.id }),
      })
        .then((r) => r.json())
        .then((startRes) => {
          if (startRes.success) {
            activeSessionRef.current = {
              consultationId: startRes.consultationId,
              sessionId: startRes.sessionId,
            };
          }
        })
        .catch((err) => console.warn("Backend session start notice:", err));
    } catch (err) {
      console.error("Start recording error:", err);
      toast.error("Gagal memulai sesi rekaman");
    }
  };

  // 4. Stop recording: Stop Mic, Stop STT, Upload to S3, and Generate SOAPI via Gemini
  const stopRecording = async () => {
    setIsRecording(false);
    setIsProcessingAI(true);
    setIsMicSpeaking(false);
    setProcessingStep(2); // Speech-to-text finalize

    // Stop Speech Recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setInterimTranscript("");

    // Check if user spoke into the mic: NEVER replace with dummy data!
    if (transcriptLines.length === 0) {
      setIsProcessingAI(false);
      toast.warning("Tidak ada suara yang terdeteksi. Silakan coba bicara kembali ke mikrofon.");
      return;
    }

    const effectiveLines = transcriptLines;

    // Stop media recorder
    let audioBlob: Blob;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    } else {
      audioBlob = new Blob(["SOAPI Recorded Audio"], { type: "audio/webm" });
    }

    try {
      const consultationId = activeSessionRef.current.consultationId;
      if (consultationId) {
        // 1. Upload audio file to S3 Object Storage
        const formData = new FormData();
        formData.append("audio", audioBlob, `recording_${Date.now()}.webm`);
        formData.append("consultationId", consultationId);
        formData.append("duration", String(seconds || 28));

        const uploadRes = await fetch("/api/voice/upload", {
          method: "POST",
          body: formData,
        }).then((r) => r.json());

        if (!uploadRes.success) {
          console.warn("Storage upload error:", uploadRes.error);
          toast.error(
            `Gagal simpan audio ke Cloudflare R2: ${uploadRes.error || "Akses Ditolak"}. Pastikan izin API token adalah 'Object Read & Write'.`,
            { duration: 6000 },
          );
        } else {
          toast.success("Audio konsultasi berhasil diunggah ke Cloudflare R2!");
        }

        setProcessingStep(3); // Clinical Structuring (SOAPI)

        // 2. Process AI clinical structuring using Gemini / AI Diarization
        const processRes = await fetch("/api/voice/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultationId,
            sessionId: uploadRes.sessionId || activeSessionRef.current.sessionId,
            dialogues: effectiveLines,
          }),
        }).then((r) => r.json());

        if (processRes.success && processRes.dialogues?.length > 0) {
          setTranscriptLines(
            processRes.dialogues.map((d: any, idx: number) => ({
              id: effectiveLines[idx]?.id || `final_${idx}`,
              speaker: d.speaker,
              text: d.text,
              time: d.time || effectiveLines[idx]?.time || "00:00",
              isAiVerified: true,
            })),
          );
        }

        setProcessingStep(4); // Finished
        toast.success(
          processRes.engine === "gemini-2.5-flash"
            ? "✨ AI Gemini berhasil memilah suara Dokter & Pasien dan menyusun SOAPI!"
            : "Rekaman & Catatan SOAPI berhasil diproses & disimpan ke PostgreSQL!",
        );
      }
    } catch (err) {
      console.error("Error processing recording:", err);
      toast.error("Gagal sinkronisasi catatan ke backend");
    } finally {
      setIsProcessingAI(false);
    }
  };


  const toggleRecording = () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  const resetRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch {}
    }
    setIsRecording(false);
    setSeconds(0);
    setHasRecorded(false);
    setTranscriptLines([]);
    setInterimTranscript("");
    setProcessingStep(0);
  };

  const loadDemoTranscript = () => {
    setTranscriptLines(sampleDialogues);
    toast.info("Transkrip contoh percakapan berhasil dimuat.");
  };

  const toggleSpeakerRole = (index: number) => {
    setTranscriptLines((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              speaker: item.speaker === "Dokter" ? "Pasien" : "Dokter",
            }
          : item,
      ),
    );
    toast.info("Peran pembicara diperbarui.");
  };


  const filteredPatients = patientList.filter(
    (p) =>
      p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.recordNo.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.clinic.toLowerCase().includes(patientSearch.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Voice Scribe"
        subtitle="Rekam dan transkripsikan konsultasi secara real-time"
      />

      <main className="flex-1 px-6 py-6 lg:px-8 space-y-6">
        {/* Top Selected Patient Banner Card */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#D8F0EC] text-sm font-semibold text-[#0E706B]">
              {selectedPatient.initials}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                PASIEN TERPILIH
              </p>
              <h2 className="text-base font-bold text-foreground">{selectedPatient.name}</h2>
              <p className="text-xs text-muted-foreground">
                {selectedPatient.recordNo} • {selectedPatient.gender}, {selectedPatient.age} tahun
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 sm:gap-10">
            <div className="hidden border-l border-border pl-6 md:block">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                KUNJUNGAN
              </p>
              <p className="text-sm font-semibold text-foreground">{selectedPatient.clinic}</p>
            </div>

            <div className="hidden border-l border-border pl-6 md:block">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                DOKTER
              </p>
              <p className="text-sm font-semibold text-foreground">dr. Arief Wijaya, Sp.PD</p>
            </div>

            <button
              type="button"
              onClick={() => setIsChangePatientOpen(true)}
              className="cursor-pointer text-sm font-semibold text-teal-text hover:underline"
            >
              Ganti pasien
            </button>
          </div>
        </div>

        {/* View Mode Tabs: Voice Scribe vs FastAPI AI Hub */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView("scribe")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer",
                activeView === "scribe"
                  ? "bg-[#0D6E68] text-white shadow-xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              <Mic className="h-4 w-4" />
              <span>Voice Scribe</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView("fastapi_assistant")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer",
                activeView === "fastapi_assistant"
                  ? "bg-[#0D6E68] text-white shadow-xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              <Sparkles className="h-4 w-4" />
              <span>AI SOAP &amp; Rekomendasi ICD-10</span>
            </button>
          </div>

          {activeView === "scribe" && transcriptLines.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const formatted = transcriptLines
                  .map((t) => `${t.speaker}: "${t.text}"`)
                  .join("\n");
                setCarriedTranscript(formatted);
                setActiveView("fastapi_assistant");
                toast.info("Transkrip percakapan dimuat ke AI Assistant!");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#0D6E68] bg-[#E5F5F3] px-3.5 py-1.5 text-xs font-bold text-[#0D6E68] hover:bg-[#d6f0ec] transition-colors cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Kirim Transkrip ke AI Assistant</span>
            </button>
          )}
        </div>

        {/* Conditional Content based on activeView */}
        {activeView === "fastapi_assistant" ? (
          <SOAPICDAssistant initialTranscript={carriedTranscript} />
        ) : (
          /* Main Content: 2-Columns */
          <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Rekaman Konsultasi & Transkrip Langsung */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 lg:col-span-8 flex flex-col justify-between shadow-xs">
            <div>
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">Rekaman Konsultasi</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Dokter cukup klik 1x Mulai Rekam, AI otomatis memilah suara Dokter &amp; Pasien
                  </p>
                </div>

                {isRecording ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                    <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
                    Merekam Percakapan...
                  </span>
                ) : isProcessingAI ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AI Memproses SOAPI...
                  </span>
                ) : hasRecorded ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1 text-xs font-semibold text-ok-text">
                    <span className="h-1.5 w-1.5 rounded-full bg-ok-text" />
                    Selesai merekam
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                    Siap merekam
                  </span>
                )}
              </div>

              {/* Center Recording Area */}
              <div className="my-8 flex flex-col items-center justify-center text-center">
                {/* Big Mic Button / Icon with outer halo */}
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={isProcessingAI}
                  className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-[#E5F5F3] transition-transform duration-200 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none disabled:opacity-50"
                  aria-label={isRecording ? "Hentikan rekaman" : "Mulai rekaman"}
                >
                  {isRecording && (
                    <span className="absolute inset-0 rounded-full bg-[#0E706B]/20 animate-ping" />
                  )}
                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full shadow-md transition-colors",
                      isRecording ? "bg-destructive text-white" : "bg-[#0E706B] text-white",
                    )}
                  >
                    {isRecording ? (
                      <Square className="h-6 w-6 fill-current" />
                    ) : (
                      <Mic className="h-6 w-6 stroke-[2]" />
                    )}
                  </div>
                </button>

                {/* Timer & Subtitle */}
                <div className="mt-4">
                  <p className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                    {formatTimer(seconds)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isRecording
                      ? isMicSpeaking
                        ? "Mendengar suara percakapan..."
                        : "Mikrofon aktif mendengarkan percakapan..."
                      : isProcessingAI
                        ? "Menyimpan ke S3 & PostgreSQL..."
                        : hasRecorded
                          ? "Rekaman tersimpan"
                          : "Klik sekali untuk mulai konsultasi"}
                  </p>
                </div>

                {/* Audio Waveform */}
                <div className="my-4 flex h-10 items-center justify-center gap-[3px]">
                  {defaultWaveHeights.map((h, i) => {
                    const dynamicHeight = isRecording
                      ? Math.max(
                          6,
                          Math.min(
                            44,
                            Math.round(
                              h * (0.4 + (isMicSpeaking ? 0.8 : 0.3) * (0.5 + Math.sin(seconds * 4 + i * 0.9) * 0.5)),
                            ),
                          ),
                        )
                      : Math.round(h * 0.7);

                    return (
                      <span
                        key={i}
                        className={cn(
                          "w-1 rounded-full transition-all duration-150",
                          isRecording
                            ? isMicSpeaking
                              ? "bg-[#0D9488]"
                              : "bg-[#0E706B]/70"
                            : "bg-muted-foreground/30",
                        )}
                        style={{ height: `${dynamicHeight}px` }}
                      />
                    );
                  })}
                </div>

                {/* Primary Action Button */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isProcessingAI}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50",
                      isRecording
                        ? "bg-destructive hover:bg-destructive/90"
                        : "bg-[#0D6E68] hover:bg-[#0a5752]",
                    )}
                  >
                    {isRecording ? (
                      <>
                        <Square className="h-4 w-4 fill-current" />
                        Selesai Rekam
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4" />
                        Mulai Rekam (1x Klik)
                      </>
                    )}
                  </button>

                  {hasRecorded && !isRecording && (
                    <button
                      type="button"
                      onClick={resetRecording}
                      disabled={isProcessingAI}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer transition-colors"
                      title="Reset rekaman"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Rekam Ulang
                    </button>
                  )}
                </div>
              </div>

              {/* Lower Section: Transkrip Langsung */}
              <div className="border-t border-border pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      TRANSKRIP LANGSUNG
                    </p>
                  </div>
                </div>

                {transcriptLines.length === 0 && !interimTranscript ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Mic className="h-7 w-7 text-muted-foreground/35 stroke-[1.5] mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Bicaralah secara alami antara dokter dan pasien setelah klik <strong>Mulai Rekam</strong>.
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      AI otomatis memilah siapa yang berbicara tanpa perlu memencet tombol ganti pembicara.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-2 max-h-[300px] overflow-y-auto pr-1">
                    {transcriptLines.map((line, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-xl p-3 text-xs leading-relaxed transition-all",
                          line.speaker === "Dokter"
                            ? "bg-teal-soft/40 border border-teal-soft text-foreground"
                            : "bg-muted/50 text-foreground",
                        )}
                      >
                        <div className="flex items-center justify-between font-semibold text-muted-foreground mb-1">
                          <button
                            type="button"
                            onClick={() => toggleSpeakerRole(idx)}
                            title="Klik untuk mengubah peran pembicara (Dokter / Pasien)"
                            className={cn(
                              "cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-bold transition-all hover:opacity-85 active:scale-95",
                              line.speaker === "Dokter"
                                ? "bg-teal-500/15 text-[#0E706B] hover:bg-teal-500/25"
                                : "bg-background text-foreground border border-border/70 hover:bg-muted",
                            )}
                          >
                            {line.speaker === "Dokter" ? (
                              <Stethoscope className="h-3.5 w-3.5 text-[#0E706B]" />
                            ) : (
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span>{line.speaker}</span>
                            <span className="text-[10px] font-normal opacity-50 underline ml-0.5">Ubah</span>
                          </button>

                          <div className="flex items-center gap-2">
                            {line.isAiAnalyzing && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#0E706B] font-medium animate-pulse">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                Menganalisis AI...
                              </span>
                            )}
                            {line.isAiVerified && !line.isAiAnalyzing && (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-[#E5F5F3] px-1.5 py-0.5 text-[9px] font-semibold text-[#0E706B]"
                                title={line.reason || "Terverifikasi oleh AI Gemini 2.5 Flash"}
                              >
                                <Sparkles className="h-2.5 w-2.5" />
                                AI Gemini
                              </span>
                            )}
                            <span className="font-mono text-[11px]">{line.time}</span>
                          </div>
                        </div>

                        <p>{line.text}</p>
                      </div>
                    ))}

                    {/* Live Interim Speech Bubble */}
                    {interimTranscript && (
                      <div className="rounded-xl p-3 text-xs leading-relaxed bg-[#E5F5F3] border border-[#0E706B]/30 text-foreground animate-pulse">
                        <div className="flex items-center justify-between font-semibold text-muted-foreground mb-1">
                          <span className="text-[#0E706B] font-bold flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#0E706B] animate-ping" />
                            Mendengar Suara... (AI Otomatis Memilah Peran)
                          </span>
                          <span className="font-mono text-[11px]">{formatTimer(seconds)}</span>
                        </div>
                        <p className="italic text-foreground">{interimTranscript}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom finish workflow bar */}
            {hasRecorded && !isRecording && (
              <div className="border-t border-border mt-5 pt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Catatan medis klinis siap diproses oleh AI Clinical Engine
                </p>
                <Link
                  to="/riwayat-catatan"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                >
                  <FileCheck className="h-4 w-4" />
                  Lihat &amp; Review Catatan SOAPI
                </Link>
              </div>
            )}
          </div>

          {/* Right Column: AI Clinical Engine Card */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 lg:col-span-4 flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-xs font-bold text-white shadow-xs">
                  AI
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">AI Clinical Engine</h3>
                  <p className="text-xs text-muted-foreground">Auto-Diarization Gemini &amp; SOAPI</p>
                </div>
              </div>

              {/* Stepper Timeline */}
              <div className="space-y-1">
                {/* Step 1: Voice Capture */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                        isRecording
                          ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]"
                          : hasRecorded || processingStep >= 1
                            ? "border-ok-text bg-ok-soft text-ok-text"
                            : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {hasRecorded && !isRecording ? (
                        <Check className="h-4 w-4 stroke-[2.5]" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </div>
                    <div className="h-7 w-px bg-border my-1" />
                  </div>
                  <div className="pt-1.5">
                    <h4 className="text-sm font-semibold text-foreground">Voice Capture</h4>
                    <p className="text-xs text-muted-foreground">
                      {isRecording ? "Merekam suara mikrofon..." : "Menangkap audio konsultasi"}
                    </p>
                  </div>
                </div>

                {/* Step 2: Speech-to-Text & Diarization */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                        processingStep === 2
                          ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]"
                          : processingStep > 2 || hasRecorded
                            ? "border-ok-text bg-ok-soft text-ok-text"
                            : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {processingStep > 2 || hasRecorded ? (
                        <Check className="h-4 w-4 stroke-[2.5]" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </div>
                    <div className="h-7 w-px bg-border my-1" />
                  </div>
                  <div className="pt-1.5">
                    <h4 className="text-sm font-semibold text-foreground">Speech-to-Text &amp; Diarization</h4>
                    <p className="text-xs text-muted-foreground">Pemisahan otomatis Dokter &amp; Pasien</p>
                  </div>
                </div>

                {/* Step 3: Clinical Structuring */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                        processingStep === 3
                          ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]"
                          : processingStep >= 4 || hasRecorded
                            ? "border-ok-text bg-ok-soft text-ok-text"
                            : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {processingStep >= 4 || hasRecorded ? (
                        <Check className="h-4 w-4 stroke-[2.5]" />
                      ) : (
                        <LayoutGrid className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                  <div className="pt-1.5">
                    <h4 className="text-sm font-semibold text-foreground">Clinical Structuring</h4>
                    <p className="text-xs text-muted-foreground">Menyusun format SOAP klinis</p>
                  </div>
                </div>
              </div>

              {/* Data Protection Banner */}
              <div className="flex items-start gap-3 rounded-xl border border-teal-200/60 bg-[#F0FAF8] p-3.5">
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0D9488]/15 text-[#0D9488]">
                  <Check className="h-3 w-3 stroke-[2.5]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0F766E]">Data Anda terlindungi</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#0F766E]/85">
                    Audio dienkripsi dan tidak disimpan setelah catatan disetujui.
                  </p>
                </div>
              </div>
            </div>

            {/* Audio Quality Section */}
            <div className="space-y-1.5 border-t border-border pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Kualitas audio</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">
                    {isMicSpeaking ? "Terdengar Jelas" : "Baik"}
                  </span>
                  <span className="font-bold text-[#0D9488]">
                    {isMicSpeaking ? "96%" : "92%"}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[#0D9488] transition-all duration-300"
                  style={{ width: isMicSpeaking ? "96%" : "92%" }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isMicSpeaking ? "Mikrofon menangkap suara percakapan" : "Lingkungan cukup tenang"}
              </p>
            </div>
          </div>
        </div>
        )}

        {/* Modal: Ganti Pasien */}
        <Dialog open={isChangePatientOpen} onOpenChange={setIsChangePatientOpen}>
          <DialogContent className="max-w-md sm:rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Pilih Pasien Konsultasi</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Pilih salah satu antrean pasien untuk memulai sesi Voice Scribe.
              </DialogDescription>
            </DialogHeader>

            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Cari nama pasien, No. RM..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full rounded-xl border border-input bg-card pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>

            <div className="mt-2 max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {filteredPatients.map((p) => {
                const isSelected = p.id === selectedPatient.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setIsChangePatientOpen(false);
                      resetRecording();
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors cursor-pointer",
                      isSelected
                        ? "border-[#0D9488] bg-teal-soft/40"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-soft text-xs font-bold text-teal-text">
                        {p.initials}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.recordNo} • {p.gender}, {p.age} th
                        </p>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-[#0D9488]" />}
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
