import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { User, Building2, Settings, Send, Bell, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/pengaturan")({
  head: () => ({
    meta: [
      { title: "Pengaturan — SOAPI" },
      {
        name: "description",
        content:
          "Preferensi akun, identitas profesional, fasilitas, dan integrasi SIMRS.",
      },
      { property: "og:title", content: "Pengaturan — SOAPI" },
      {
        property: "og:description",
        content:
          "Preferensi akun, identitas profesional, fasilitas, dan integrasi SIMRS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pengaturan,
});

type SettingsTab =
  | "profil"
  | "fasilitas"
  | "preferensi"
  | "integrasi"
  | "notifikasi";

interface NavItem {
  id: SettingsTab;
  label: string;
  icon: typeof User;
}

const navItems: NavItem[] = [
  { id: "profil", label: "Profil & Akun", icon: User },
  { id: "fasilitas", label: "Informasi Fasilitas", icon: Building2 },
  { id: "preferensi", label: "Preferensi Scribe", icon: Settings },
  { id: "integrasi", label: "Integrasi SIMRS", icon: Send },
  { id: "notifikasi", label: "Notifikasi", icon: Bell },
];

function Pengaturan() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profil");

  // Form states for Profil & Akun
  const [fullName, setFullName] = useState("dr. Arief Wijaya, Sp.PD");
  const [sipNumber, setSipNumber] = useState("503/1824/SIP-D/2024");
  const [email, setEmail] = useState("arief.wijaya@medikautama.id");
  const [phone, setPhone] = useState("+62 812 3456 7890");
  const [specialty, setSpecialty] = useState("Penyakit Dalam");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // States for Informasi Fasilitas
  const [facilityName, setFacilityName] = useState("RS Medika Utama");
  const [facilityType, setFacilityType] = useState("Rumah Sakit Umum (Tipe B)");
  const [facilityCode, setFacilityCode] = useState("3171012");
  const [department, setDepartment] = useState("Poli Penyakit Dalam");
  const [facilityAddress, setFacilityAddress] = useState(
    "Jl. Jend. Sudirman Kav. 24-25, Karet Semanggi, Setiabudi, Jakarta Selatan 12930",
  );
  const [facilityPhone, setFacilityPhone] = useState("+62 21 5790 1234");

  // States for Preferensi Scribe
  const [autoSendSimrs, setAutoSendSimrs] = useState(true);
  const [noteLanguage, setNoteLanguage] = useState("id");
  const [defaultFormat, setDefaultFormat] = useState("SOAP");
  const [summaryDetail, setSummaryDetail] = useState("standard");
  const [keepOriginalAudio, setKeepOriginalAudio] = useState(true);
  const [autoMedicalJargon, setAutoMedicalJargon] = useState(true);

  // States for Integrasi SIMRS
  const [simrsEndpoint, setSimrsEndpoint] = useState(
    "https://simrs.medikautama.id/api/v1/fhir",
  );
  const [clientId, setClientId] = useState("MEDIKA-PROD-99812-JKT");
  const [syncInterval, setSyncInterval] = useState("realtime");

  // States for Notifikasi
  const [notifyTranscriptionDone, setNotifyTranscriptionDone] = useState(true);
  const [notifyNewPatient, setNotifyNewPatient] = useState(true);
  const [notifyReviewReminder, setNotifyReviewReminder] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [dailyEmailDigest, setDailyEmailDigest] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran file melebihi 2 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarPreview(event.target?.result as string);
      toast.success("Foto profil berhasil diperbarui!");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (tabName: string) => {
    toast.success(`Perubahan ${tabName} berhasil disimpan!`);
  };

  return (
    <>
      <PageHeader
        title="Pengaturan"
        subtitle="Preferensi akun dan integrasi klinis"
      />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Left Navigation Card */}
          <nav
            aria-label="Menu Pengaturan"
            className="w-full shrink-0 rounded-2xl border border-border bg-card p-3 shadow-xs lg:w-64"
          >
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-sm transition-colors",
                      isActive
                        ? "bg-teal-soft/80 font-semibold text-primary"
                        : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Right Main Content Card */}
          <div className="flex-1 rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8">
            {/* Tab: Profil & Akun */}
            {activeTab === "profil" && (
              <div>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">
                    Profil & Akun
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Kelola informasi identitas profesional Anda.
                  </p>
                </div>

                <div className="my-6 border-b border-border/80" />

                {/* Avatar Section */}
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-soft text-base font-bold text-teal-text">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Foto Profil"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "AW"
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarChange}
                      accept="image/png, image/jpeg, image/jpg"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Ubah foto
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      JPG atau PNG. Maksimal 2 MB.
                    </p>
                  </div>
                </div>

                {/* Form Fields */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave("Profil & Akun");
                  }}
                  className="mt-6"
                >
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    {/* Nama Lengkap */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Nomor SIP */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Nomor SIP
                      </label>
                      <input
                        type="text"
                        value={sipNumber}
                        onChange={(e) => setSipNumber(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Nomor Telepon */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Nomor Telepon
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Spesialisasi (Full width) */}
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Spesialisasi
                      </label>
                      <input
                        type="text"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      type="submit"
                      className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99]"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tab: Informasi Fasilitas */}
            {activeTab === "fasilitas" && (
              <div>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">
                    Informasi Fasilitas
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Kelola data faskes tempat Anda bertugas dan integrasi poli.
                  </p>
                </div>

                <div className="my-6 border-b border-border/80" />

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave("Informasi Fasilitas");
                  }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Nama Fasilitas
                      </label>
                      <input
                        type="text"
                        value={facilityName}
                        onChange={(e) => setFacilityName(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Kode Faskes (Kemenkes)
                      </label>
                      <input
                        type="text"
                        value={facilityCode}
                        onChange={(e) => setFacilityCode(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Tipe Fasilitas
                      </label>
                      <input
                        type="text"
                        value={facilityType}
                        onChange={(e) => setFacilityType(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Departemen / Poli
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Nomor Telepon Faskes
                      </label>
                      <input
                        type="tel"
                        value={facilityPhone}
                        onChange={(e) => setFacilityPhone(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Alamat Lengkap Fasilitas
                      </label>
                      <textarea
                        rows={3}
                        value={facilityAddress}
                        onChange={(e) => setFacilityAddress(e.target.value)}
                        className="w-full rounded-xl border border-input bg-card p-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99]"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tab: Preferensi Scribe */}
            {activeTab === "preferensi" && (
              <div>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">
                    Preferensi Scribe
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sesuaikan pengaturan pencatatan klinis otomatis dan format SOAP.
                  </p>
                </div>

                <div className="my-6 border-b border-border/80" />

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave("Preferensi Scribe");
                  }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Format Catatan Default
                      </label>
                      <select
                        value={defaultFormat}
                        onChange={(e) => setDefaultFormat(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="SOAP">Format SOAP (Standar)</option>
                        <option value="SOAPI">Format SOAPI (Lengkap)</option>
                        <option value="POMR">Problem Oriented Medical Record (POMR)</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Bahasa Transkripsi & Catatan
                      </label>
                      <select
                        value={noteLanguage}
                        onChange={(e) => setNoteLanguage(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="id">Bahasa Indonesia</option>
                        <option value="en">English (Medical)</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Kedalaman Ringkasan AI
                      </label>
                      <select
                        value={summaryDetail}
                        onChange={(e) => setSummaryDetail(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="concise">Ringkas Padat</option>
                        <option value="standard">Standar Klinis</option>
                        <option value="detailed">Komprehensif & Mendalam</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Kirim otomatis ke SIMRS
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Catatan otomatis disinkronisasi ke rekam medis rumah sakit setelah Anda setujui
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoSendSimrs}
                        onClick={() => setAutoSendSimrs((v) => !v)}
                        className={cn(
                          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                          autoSendSimrs ? "bg-primary" : "bg-muted-foreground/30",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow-xs",
                            autoSendSimrs ? "right-0.5" : "left-0.5",
                          )}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Simpan rekaman audio asli
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Menyimpan berkas rekaman suara konsultasi untuk audit dan verifikasi lanjutan
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={keepOriginalAudio}
                        onClick={() => setKeepOriginalAudio((v) => !v)}
                        className={cn(
                          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                          keepOriginalAudio ? "bg-primary" : "bg-muted-foreground/30",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow-xs",
                            keepOriginalAudio ? "right-0.5" : "left-0.5",
                          )}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Standardisasi terminologi medis
                        </p>
                        <p className="text-xs text-muted-foreground">
                          AI otomatis mengonversi keluhan umum pasien ke istilah medis baku ICD-10
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoMedicalJargon}
                        onClick={() => setAutoMedicalJargon((v) => !v)}
                        className={cn(
                          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                          autoMedicalJargon ? "bg-primary" : "bg-muted-foreground/30",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow-xs",
                            autoMedicalJargon ? "right-0.5" : "left-0.5",
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99]"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tab: Integrasi SIMRS */}
            {activeTab === "integrasi" && (
              <div>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">
                    Integrasi SIMRS
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Kelola koneksi jembatan API dan sinkronisasi rekam medis elektronik (RME).
                  </p>
                </div>

                <div className="my-6 border-b border-border/80" />

                {/* Status Box */}
                <div className="mb-6 flex items-center justify-between rounded-xl border border-ok-text/20 bg-ok-soft/30 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-ok-text" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Status Koneksi: Terhubung
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Terakhir disinkronkan 3 menit yang lalu • Latensi 42ms
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-ok-soft px-3 py-1 text-xs font-semibold text-ok-text">
                    Online
                  </span>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave("Integrasi SIMRS");
                  }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Provider SIMRS
                      </label>
                      <input
                        type="text"
                        disabled
                        value="MedikaTech Cloud (HL7 FHIR v4.0.1)"
                        className="h-11 w-full rounded-xl border border-input bg-muted/40 px-4 text-sm text-foreground"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Interval Sinkronisasi
                      </label>
                      <select
                        value={syncInterval}
                        onChange={(e) => setSyncInterval(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="realtime">Real-time (Otomatis)</option>
                        <option value="5min">Setiap 5 Menit</option>
                        <option value="15min">Setiap 15 Menit</option>
                        <option value="manual">Manual Saja</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        URL Endpoint FHIR / SIMRS
                      </label>
                      <input
                        type="url"
                        value={simrsEndpoint}
                        onChange={(e) => setSimrsEndpoint(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Client ID / Faskes Key
                      </label>
                      <input
                        type="text"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        API Secret Token
                      </label>
                      <input
                        type="password"
                        defaultValue="••••••••••••••••••••••••••••••••"
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99]"
                    >
                      Simpan Perubahan
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.success("Tes koneksi berhasil! Respon SIMRS 200 OK.")}
                      className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      Uji Koneksi SIMRS
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tab: Notifikasi */}
            {activeTab === "notifikasi" && (
              <div>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">
                    Notifikasi
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Atur preferensi pemberitahuan untuk aktivitas klinis Anda.
                  </p>
                </div>

                <div className="my-6 border-b border-border/80" />

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave("Notifikasi");
                  }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Notifikasi transkripsi selesai
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Dapatkan peringatan ketika AI selesai menyusun catatan medis SOAP
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifyTranscriptionDone}
                      onClick={() => setNotifyTranscriptionDone((v) => !v)}
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                        notifyTranscriptionDone ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow-xs",
                          notifyTranscriptionDone ? "right-0.5" : "left-0.5",
                        )}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Peringatan antrean pasien masuk
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pemberitahuan saat perawat mendaftarkan pasien berikutnya di poli
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifyNewPatient}
                      onClick={() => setNotifyNewPatient((v) => !v)}
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                        notifyNewPatient ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow-xs",
                          notifyNewPatient ? "right-0.5" : "left-0.5",
                        )}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Pengingat reviu catatan medis
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pemberitahuan jika ada catatan draft yang belum disetujui lebih dari 2 jam
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifyReviewReminder}
                      onClick={() => setNotifyReviewReminder((v) => !v)}
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                        notifyReviewReminder ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow-xs",
                          notifyReviewReminder ? "right-0.5" : "left-0.5",
                        )}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Efek suara audio scribe
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bunyi nada saat mulai merekam, menjeda, atau selesai merekam konsultasi
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={soundEffects}
                      onClick={() => setSoundEffects((v) => !v)}
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                        soundEffects ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow-xs",
                          soundEffects ? "right-0.5" : "left-0.5",
                        )}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Ringkasan harian via email
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Kirimkan rekapitulasi jumlah konsultasi dan status berkas medis setiap sore
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={dailyEmailDigest}
                      onClick={() => setDailyEmailDigest((v) => !v)}
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                        dailyEmailDigest ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow-xs",
                          dailyEmailDigest ? "right-0.5" : "left-0.5",
                        )}
                      />
                    </button>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99]"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
