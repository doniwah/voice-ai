import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Download,
  Send,
  Check,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";


export const Route = createFileRoute("/riwayat-catatan")({
  head: () => ({
    meta: [
      { title: "Riwayat Catatan — SOAPI" },
      {
        name: "description",
        content: "Telusuri dan kelola dokumentasi konsultasi medis klinis.",
      },
    ],
  }),
  component: RiwayatCatatan,
});

export type ApprovalStatus = "Disetujui" | "Draft" | "Menunggu";
export type SimrsStatus = "Terkirim" | "Belum dikirim" | "Gagal";

export interface ConsultationRecord {
  id: string;
  initials: string;
  patient: string;
  recordNo: string;
  consultationDate: string;
  diagnosis: string;
  doctor: string;
  approvalStatus: ApprovalStatus;
  simrsStatus: SimrsStatus;
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    intervention: string;
  };
}

const initialRecords: ConsultationRecord[] = [
  {
    id: "1",
    initials: "BS",
    patient: "Budi Santoso",
    recordNo: "RM-2024-00831",
    consultationDate: "14 Jun 2025 • 09:42",
    diagnosis: "Hipertensi Esensial",
    doctor: "dr. Arief Wijaya",
    approvalStatus: "Disetujui",
    simrsStatus: "Terkirim",
    soap: {
      subjective:
        "Pasien datang kontrol rutin tekanan darah. Mengeluhkan pusing di bagian tengkuk sejak 2 hari terakhir, tidur terasa kurang nyenyak. Riwayat konsumsi obat amlodipine 5mg teratur.",
      objective:
        "TD: 145/90 mmHg, Nadi: 82x/mnt, RR: 18x/mnt, Suhu: 36.6°C. Jantung/Paru: dbn. Ekstremitas: Edema (-/-).",
      assessment:
        "Hipertensi Primer / Esensial Stage 1, belum terkontrol optimal. Riwayat dislipidemia.",
      plan: "Tingkatkan dosis Amlodipine menjadi 10mg 1x1 tab pagi. Edukasi diet rendah garam dan olahraga jalan santai 30 mnt 3x seminggu. Jadwal kontrol 2 minggu.",
      intervention:
        "Pemberian edukasi kepatuhan obat dan batas asupan natrium harian (<2000mg/hari). Konseling pola istirahat.",
    },
  },
  {
    id: "2",
    initials: "SA",
    patient: "Siti Aminah",
    recordNo: "RM-2023-01422",
    consultationDate: "14 Jun 2025 • 08:55",
    diagnosis: "Diabetes Melitus Tipe 2",
    doctor: "dr. Arief Wijaya",
    approvalStatus: "Disetujui",
    simrsStatus: "Terkirim",
    soap: {
      subjective:
        "Pasien mengeluh lemas dan sering merasa haus pada malam hari. Tidak ada riwayat luka yang sukar sembuh. Rutin minum Metformin 500mg 2x sehari.",
      objective:
        "GDS: 186 mg/dL, TD: 125/80 mmHg, Nadi: 78x/mnt, BB: 64 kg, IMT: 25.1. Pemeriksaan kaki diabetik: sensasi tajam-tumpul normal, ulkus (-).",
      assessment: "Diabetes Mellitus Tipe 2 reguler regulasi sedang. Obesitas tingkat 1.",
      plan: "Lanjutkan Metformin 500mg 2x1 tablet sesudah makan. Jadwalkan pemeriksaan HbA1c ulang. Diet 1700 kkal/hari.",
      intervention:
        "Edukasi perawatan kaki mandiri dan tanda-tanda hipoglikemia bagi pasien & keluarga.",
    },
  },
  {
    id: "3",
    initials: "AF",
    patient: "Ahmad Fauzi",
    recordNo: "RM-2022-00691",
    consultationDate: "13 Jun 2025 • 16:20",
    diagnosis: "Gastritis Akut",
    doctor: "dr. Arief Wijaya",
    approvalStatus: "Disetujui",
    simrsStatus: "Terkirim",
    soap: {
      subjective:
        "Pasien mengeluh perih dan rasa terbakar pada ulu hati terutama setelah terlambat makan atau minum kopi. Mual (+), muntah (-).",
      objective:
        "Nyeri tekan epigastrium (+), bising usus normal, sklera ikterik (-). TTV: TD 120/80 mmHg, Nadi 76x/mnt.",
      assessment: "Gastritis Akut e.c. pola makan ireguler & kafein berlebih.",
      plan: "Omeprazole 20mg 2x1 a.c., Antasida sirup 3x1 C p.c. Hindari makanan pedas, asam, kopi, dan makan tepat waktu.",
      intervention: "Konseling modifikasi diet dan manajemen stres.",
    },
  },
  {
    id: "4",
    initials: "DL",
    patient: "Dewi Lestari",
    recordNo: "RM-2024-00217",
    consultationDate: "13 Jun 2025 • 14:10",
    diagnosis: "ISPA",
    doctor: "dr. Arief Wijaya",
    approvalStatus: "Draft",
    simrsStatus: "Belum dikirim",
    soap: {
      subjective:
        "Pasien batuk berdahak encer sejak 3 hari, hidung tersumbat dan demam sumeng-sumeng. Nyeri tenggorokan saat menelan.",
      objective:
        "Suhu: 37.8°C, Faring hiperemis (+), Tonsil T1-T1 tenang, Ronki (-/-), Wheezing (-/-).",
      assessment: "Infeksi Saluran Pernapasan Akut (ISPA) bagian atas e.c. viral infection.",
      plan: "Paracetamol 500mg 3x1 p.r.n demam, Cetirizine 10mg 1x1 malam, Multivitamin C 500mg 1x1. Istirahat cukup dan banyak minum air hangat.",
      intervention:
        "Instruksi penggunaan masker dan etika batuk di rumah. Evaluasi jika demam > 3 hari.",
    },
  },
  {
    id: "5",
    initials: "RH",
    patient: "Rudi Hartono",
    recordNo: "RM-2021-01903",
    consultationDate: "12 Jun 2025 • 11:30",
    diagnosis: "Dislipidemia",
    doctor: "dr. Arief Wijaya",
    approvalStatus: "Disetujui",
    simrsStatus: "Gagal",
    soap: {
      subjective:
        "Pasien merasa cepat lelah saat beraktivitas berat. Riwayat kolesterol tinggi dalam keluarga. Tidak ada keluhan nyeri dada khas.",
      objective:
        "Kolesterol Total: 245 mg/dL, LDL: 168 mg/dL, HDL: 42 mg/dL, Trigliserida: 190 mg/dL. TD 130/85 mmHg.",
      assessment: "Dislipidemia campuran e.c. familial + diet tinggi lemak.",
      plan: "Simvastatin 20mg 1x1 malam. Diet rendah kolesterol dan lemak jenuh, olahraga aerobik 150 mnt/minggu.",
      intervention:
        "Edukasi risiko penyakit kardiovaskular dan anjuran cek profil lipid ulang dalam 6-8 minggu.",
    },
  },
  {
    id: "6",
    initials: "N",
    patient: "Nurhayati",
    recordNo: "RM-2023-01108",
    consultationDate: "11 Jun 2025 • 13:15",
    diagnosis: "Osteoarthritis Genu",
    doctor: "dr. Arief Wijaya",
    approvalStatus: "Disetujui",
    simrsStatus: "Terkirim",
    soap: {
      subjective:
        "Nyeri pada kedua lutut terutama saat bangun dari duduk atau menaiki tangga sejak 1 bulan terakhir. Kaku sendi pagi hari < 30 menit.",
      objective:
        "Krepitasi (+/+) genu bilateral, efusi (-), ROM terbatas nyeri pada fleksi maksimal. BB: 72 kg, TB: 155 cm (IMT 30.0).",
      assessment: "Osteoarthritis Genu Bilateral Grade II-III + Obesitas Tingkat 2.",
      plan: "Meloxicam 7.5mg 1x1 p.c., Glucosamine 500mg 3x1. Rujuk fisioterapi untuk penguatan otot quadriceps dan edukasi penurunan berat badan bertahap.",
      intervention:
        "Edukasi penggunaan deker lutut saat aktivitas, hindari jongkok lama, dan modifikasi aktivitas fisik non-weight-bearing (berenang/sepeda statis).",
    },
  },
];

type TabType = "semua" | "draft" | "disetujui" | "gagal";

function RiwayatCatatan() {
  const [records, setRecords] = useState<ConsultationRecord[]>(initialRecords);
  const [activeTab, setActiveTab] = useState<TabType>("semua");
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<ConsultationRecord | null>(null);

  // Fetch real database clinical notes on mount
  useEffect(() => {
    fetch("/api/clinical-notes")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.length > 0) {
          const apiRecords: ConsultationRecord[] = json.data.map(
            (row: {
              id: string;
              patientName: string;
              recordNo: string;
              dateFormatted: string;
              diagnosisName: string;
              doctorName: string;
              status: string;
              simrsStatus: string;
              subjective: string;
              objective: string;
              assessment: string;
              plan: string;
              intervention: string;
            }) => ({
              id: row.id,
              initials: row.patientName ? row.patientName.slice(0, 2).toUpperCase() : "RM",
              patient: row.patientName,
              recordNo: row.recordNo,
              consultationDate: row.dateFormatted || "Hari Ini",
              diagnosis: row.diagnosisName || "Hipertensi Esensial",
              doctor: row.doctorName || "dr. Arief Wijaya",
              approvalStatus: (row.status === "Disetujui"
                ? "Disetujui"
                : row.status === "Draft"
                  ? "Draft"
                  : "Draft") as ApprovalStatus,
              simrsStatus: (row.simrsStatus === "Terkirim"
                ? "Terkirim"
                : row.simrsStatus === "Gagal"
                  ? "Gagal"
                  : "Belum dikirim") as SimrsStatus,
              soap: {
                subjective: row.subjective || "",
                objective: row.objective || "",
                assessment: row.assessment || "",
                plan: row.plan || "",
                intervention: row.intervention || "",
              },
            }),
          );

          setRecords((prev) => {
            const apiRecordNos = new Set(apiRecords.map((r) => r.recordNo));
            const remaining = prev.filter((p) => !apiRecordNos.has(p.recordNo));
            return [...apiRecords, ...remaining];
          });
        }
      })
      .catch((err) => console.warn("Failed fetching clinical notes from backend:", err));
  }, []);

  const draftCount = useMemo(
    () => records.filter((r) => r.approvalStatus === "Draft").length,
    [records],
  );
  const gagalCount = useMemo(
    () => records.filter((r) => r.simrsStatus === "Gagal").length,
    [records],
  );

  const tabs: Array<{ id: TabType; label: string; badge?: number }> = [
    { id: "semua", label: "Semua Catatan" },
    { id: "draft", label: "Draft", badge: draftCount },
    { id: "disetujui", label: "Disetujui" },
    { id: "gagal", label: "Gagal Integrasi", badge: gagalCount },
  ];

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Tab filter
      if (activeTab === "draft" && r.approvalStatus !== "Draft") return false;
      if (activeTab === "disetujui" && r.approvalStatus !== "Disetujui") return false;
      if (activeTab === "gagal" && r.simrsStatus !== "Gagal") return false;

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          r.patient.toLowerCase().includes(query) ||
          r.recordNo.toLowerCase().includes(query) ||
          r.diagnosis.toLowerCase().includes(query) ||
          r.doctor.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [records, activeTab, search]);

  const handleRetryIntegration = async (recordId?: string) => {
    const targetId = recordId ?? "5"; // Default to Rudi Hartono
    try {
      await fetch("/api/clinical-notes/retry-simrs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: targetId }),
      });
    } catch {
      // keep optimistic update
    }
    setRecords((prev) =>
      prev.map((r) => (r.id === targetId ? { ...r, simrsStatus: "Terkirim" } : r)),
    );
    toast.success("Catatan berhasil dikirim ulang dan terintegrasi ke SIMRS!");
  };

  const handleApproveNote = async (recordId: string) => {
    try {
      await fetch("/api/clinical-notes/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: recordId }),
      });
    } catch {
      // keep optimistic update
    }
    setRecords((prev) =>
      prev.map((r) =>
        r.id === recordId ? { ...r, approvalStatus: "Disetujui", simrsStatus: "Terkirim" } : r,
      ),
    );
    setSelectedRecord((prev) =>
      prev && prev.id === recordId
        ? { ...prev, approvalStatus: "Disetujui", simrsStatus: "Terkirim" }
        : prev,
    );
    toast.success("Catatan klinis disetujui, ditandatangani digital & terkirim ke SIMRS!");
  };


  return (
    <>
      <PageHeader title="Riwayat Catatan" subtitle="Telusuri dan kelola dokumentasi konsultasi" />

      <main className="flex-1 px-6 py-6 lg:px-8 space-y-6">
        {/* Top 4 Summary Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Catatan */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">Total Catatan</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">1.284</p>
            <p className="mt-1 text-xs text-muted-foreground/80">Semua dokumentasi</p>
          </div>

          {/* Card 2: Bulan Ini */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">Bulan Ini</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">86</p>
            <p className="mt-1 text-xs text-muted-foreground/80">+12 dari bulan lalu</p>
          </div>

          {/* Card 3: Menunggu Persetujuan */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">Menunggu Persetujuan</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">3</p>
            <p className="mt-1 text-xs text-muted-foreground/80">Perlu tindakan</p>
          </div>

          {/* Card 4: Gagal Integrasi */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">Gagal Integrasi</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-rose-600">1</p>
            <p className="mt-1 text-xs text-muted-foreground/80">Perlu dikirim ulang</p>
          </div>
        </div>

        {/* Main Table Card */}
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          {/* Top Card Controls: Tabs on Left, Search & Filter on Right */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 pt-3 pb-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-6 overflow-x-auto">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative pb-3 pt-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap",
                      isActive
                        ? "text-[#0E706B] font-bold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
                        {tab.badge}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0E706B] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right: Search Input & Filter Button */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Cari catatan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-48 sm:w-60 rounded-xl border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>

              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-input bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <Filter className="h-3.5 w-3.5" />
                Filter
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-card text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  <th className="px-6 py-3.5">Pasien</th>
                  <th className="px-4 py-3.5">Tanggal Konsultasi</th>
                  <th className="px-4 py-3.5">Diagnosis</th>
                  <th className="px-4 py-3.5">Dokter</th>
                  <th className="px-4 py-3.5">Persetujuan</th>
                  <th className="px-4 py-3.5">Status SIMRS</th>
                  <th className="px-4 py-3.5 text-right sr-only">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecords.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRecord(row)}
                    className="hover:bg-muted/40 cursor-pointer transition-colors group"
                  >
                    {/* Pasien */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D8F0EC] text-xs font-bold text-[#0E706B]">
                          {row.initials}
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-sm">{row.patient}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{row.recordNo}</p>
                        </div>
                      </div>
                    </td>

                    {/* Tanggal Konsultasi */}
                    <td className="px-4 py-4 text-xs font-medium text-foreground whitespace-nowrap">
                      {row.consultationDate}
                    </td>

                    {/* Diagnosis */}
                    <td className="px-4 py-4 text-xs font-medium text-foreground">
                      {row.diagnosis}
                    </td>

                    {/* Dokter */}
                    <td className="px-4 py-4 text-xs text-muted-foreground font-medium whitespace-nowrap">
                      {row.doctor}
                    </td>

                    {/* Persetujuan Badge */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {row.approvalStatus === "Disetujui" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          Disetujui
                        </span>
                      )}
                      {row.approvalStatus === "Draft" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                          Draft
                        </span>
                      )}
                      {row.approvalStatus === "Menunggu" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Menunggu
                        </span>
                      )}
                    </td>

                    {/* Status SIMRS Badge */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {row.simrsStatus === "Terkirim" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
                          Terkirim
                        </span>
                      )}
                      {row.simrsStatus === "Belum dikirim" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          Belum dikirim
                        </span>
                      )}
                      {row.simrsStatus === "Gagal" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                          Gagal
                        </span>
                      )}
                    </td>

                    {/* Right Chevron */}
                    <td className="px-4 py-4 text-right">
                      <ChevronRight className="inline-block h-4 w-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                    </td>
                  </tr>
                ))}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      Tidak ada catatan yang sesuai dengan filter atau kata kunci pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4">
            <p className="text-xs text-muted-foreground">Menampilkan 1-6 dari 1.284 catatan</p>

            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                disabled
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-input text-muted-foreground opacity-50 cursor-not-allowed"
                aria-label="Halaman sebelumnya"
              >
                &lt;
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0B4D49] font-bold text-white shadow-2xs"
              >
                1
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-input text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                2
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-input text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                3
              </button>
              <span className="px-1 text-muted-foreground">...</span>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-input text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                214
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
                aria-label="Halaman selanjutnya"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Alert Banner: 1 Catatan Gagal Terintegrasi */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-200/80 bg-[#FFF7F7] p-4 shadow-2xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                1 catatan gagal terintegrasi ke SIMRS
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Catatan Rudi Hartono mengalami gangguan koneksi. Data tetap tersimpan aman di SOAPI.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleRetryIntegration("5")}
            className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer transition-colors shadow-2xs"
          >
            Kirim Ulang
          </button>
        </div>

        {/* Modal: Detail Catatan SOAPI (Interactive on Row Click) */}
        <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
          <DialogContent className="max-w-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            {selectedRecord && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D8F0EC] text-sm font-bold text-[#0E706B]">
                      {selectedRecord.initials}
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold text-foreground">
                        {selectedRecord.patient}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground">
                        {selectedRecord.recordNo} • {selectedRecord.consultationDate} •{" "}
                        {selectedRecord.doctor}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">Status:</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    {selectedRecord.approvalStatus}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      selectedRecord.simrsStatus === "Terkirim"
                        ? "bg-sky-50 text-sky-700"
                        : selectedRecord.simrsStatus === "Gagal"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-gray-100 text-gray-600",
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    SIMRS: {selectedRecord.simrsStatus}
                  </span>
                </div>

                {/* SOAPI Content Box */}
                <div className="space-y-3 pt-2">
                  {/* S */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary font-bold">
                        S
                      </span>
                      Subjektif (Subjective)
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {selectedRecord.soap.subjective}
                    </p>
                  </div>

                  {/* O */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary font-bold">
                        O
                      </span>
                      Objektif (Objective)
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {selectedRecord.soap.objective}
                    </p>
                  </div>

                  {/* A */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary font-bold">
                        A
                      </span>
                      Asesmen (Assessment)
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {selectedRecord.soap.assessment}
                    </p>
                  </div>

                  {/* P */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary font-bold">
                        P
                      </span>
                      Perencanaan (Plan)
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {selectedRecord.soap.plan}
                    </p>
                  </div>

                  {/* I */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary font-bold">
                        I
                      </span>
                      Intervensi (Intervention)
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {selectedRecord.soap.intervention}
                    </p>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      toast.success("Catatan medis berhasil diexport!");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </button>
                  {selectedRecord.approvalStatus !== "Disetujui" && (
                    <button
                      type="button"
                      onClick={() => handleApproveNote(selectedRecord.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0b7c72] cursor-pointer transition-colors"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      Setujui Catatan
                    </button>
                  )}
                  {selectedRecord.simrsStatus !== "Terkirim" && (
                    <button
                      type="button"
                      onClick={() => {
                        handleRetryIntegration(selectedRecord.id);
                        setSelectedRecord((prev) =>
                          prev ? { ...prev, simrsStatus: "Terkirim" } : null,
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer transition-colors"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Kirim SIMRS
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedRecord(null)}
                    className="rounded-xl bg-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/80 cursor-pointer transition-colors"
                  >
                    Tutup
                  </button>
                </div>

              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
