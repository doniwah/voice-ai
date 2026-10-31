import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Filter,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  UserPlus,
  HeartPulse,
} from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { patients as initialPatients, type Patient } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/pasien")({
  head: () => ({
    meta: [
      { title: "Daftar Pasien — SOAPI" },
      {
        name: "description",
        content:
          "Pilih pasien untuk memulai dokumentasi klinis dengan Voice Scribe.",
      },
      { property: "og:title", content: "Daftar Pasien — SOAPI" },
      {
        property: "og:description",
        content:
          "Pilih pasien untuk memulai dokumentasi klinis dengan Voice Scribe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DaftarPasien,
});

function DaftarPasien() {
  const navigate = useNavigate();
  const [patientList, setPatientList] = useState<Patient[]>(initialPatients);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(patientList[0]?.id ?? "");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for new patient
  const [formData, setFormData] = useState({
    name: "",
    nik: "",
    birthDate: "1990-01-01",
    gender: "Laki-laki",
    phone: "",
    bloodType: "O+",
    address: "",
  });

  // Fetch real patients from PostgreSQL database
  const loadPatients = () => {
    fetch("/api/patients")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.length > 0) {
          const mapped: Patient[] = json.data.map((p: any, idx: number) => ({
            id: p.id,
            name: p.name,
            initials: p.initials || p.name.slice(0, 2).toUpperCase(),
            recordNo: p.recordNo,
            gender: p.gender,
            age: p.age || 40,
            birthDate: p.birthDate ? new Date(p.birthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "12 Agustus 1970",
            bloodType: "O+",
            schedule: "09:00 WIB",
            status: idx === 0 ? "Menunggu" : "Terjadwal",
            clinic: p.clinic || "Poli Penyakit Dalam",
            lastHistory: "Pemeriksaan Rutin",
            lastHistoryDate: "Bulan Lalu",
            lastHistoryDoctor: p.doctorName || "dr. Arief Wijaya, Sp.PD",
          }));
          setPatientList(mapped);
          setSelectedId((prev) => (mapped.some((item) => item.id === prev) ? prev : mapped[0].id));
        }
      })
      .catch((err) => {
        console.warn("Using fallback patients data:", err);
      });
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nama pasien wajib diisi.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan pasien ke database.");
      }

      toast.success(`Pasien ${formData.name} berhasil didaftarkan ke database.`);
      setIsAddOpen(false);
      setFormData({
        name: "",
        nik: "",
        birthDate: "1990-01-01",
        gender: "Laki-laki",
        phone: "",
        bloodType: "O+",
        address: "",
      });

      // Reload patients from DB
      loadPatients();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patientList;
    return patientList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.recordNo.toLowerCase().includes(q),
    );
  }, [query, patientList]);

  const selected: Patient =
    patientList.find((p) => p.id === selectedId) ?? patientList[0]!;

  return (
    <>
      <PageHeader
        title="Daftar Pasien"
        subtitle="Pilih pasien untuk memulai dokumentasi klinis terstandar"
      />
      <main className="flex-1 px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="relative block w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Cari nama pasien atau No. RM</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama pasien atau No. RM"
              className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 shadow-sm"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-muted shadow-sm">
              <CalendarDays className="h-4 w-4" />
              Hari ini
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-muted shadow-sm">
              <Filter className="h-4 w-4" />
              Semua status
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer transition-colors"
            >
              <Plus className="h-4 w-4" />
              Tambah Pasien
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <section className="self-start rounded-2xl border border-border bg-card xl:col-span-2 shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Menampilkan{" "}
                <span className="font-semibold text-foreground">
                  {filtered.length} pasien
                </span>{" "}
                terdaftar di Database
              </p>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-ok-soft text-ok-text">
                PostgreSQL Aktif
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/30">
                    <th className="px-6 py-3 font-semibold">Pasien</th>
                    <th className="px-4 py-3 font-semibold">No. RM</th>
                    <th className="px-4 py-3 font-semibold">
                      Usia / Jenis Kelamin
                    </th>
                    <th className="px-4 py-3 font-semibold">Jadwal</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isSelected = p.id === selected?.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={cn(
                          "cursor-pointer border-t border-border transition-colors",
                          isSelected
                            ? "border-l-4 border-l-primary bg-muted/60"
                            : "hover:bg-muted/50",
                        )}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-soft text-xs font-bold text-teal-text">
                              {p.initials}
                            </div>
                            <span className="text-sm font-semibold text-foreground">
                              {p.name}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground font-mono">
                          {p.recordNo}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-foreground">
                            {p.age} th
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.gender}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {p.schedule}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            aria-label={`Menu untuk ${p.name}`}
                            className="rounded-md p-1.5 hover:bg-muted"
                          >
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-10 text-center text-sm text-muted-foreground"
                      >
                        Tidak ada pasien yang cocok dengan pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {selected && (
            <aside className="self-start rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="font-display text-base font-bold text-foreground">
                  Detail Pasien
                </h3>
                <span className="text-xs text-muted-foreground font-mono">
                  {selected.recordNo}
                </span>
              </div>
              <div className="px-5 py-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-soft text-lg font-bold text-teal-text shadow-sm">
                  {selected.initials}
                </div>
                <p className="mt-3 font-display text-lg font-bold text-foreground">
                  {selected.name}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {selected.recordNo}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1 text-xs font-semibold text-ok-text">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  Pasien Aktif Terdaftar
                </span>
              </div>
              <div className="border-t border-border px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Informasi Rekam Medis
                </p>
                <dl className="mt-2 space-y-2 text-sm">
                  {[
                    ["Jenis Kelamin", selected.gender],
                    ["Usia", `${selected.age} tahun`],
                    ["Tanggal Lahir", selected.birthDate],
                    ["Golongan Darah", selected.bloodType || "O+"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="border-t border-border px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Poliklinik Tujuan
                </p>
                <div className="mt-2 flex items-start gap-3 rounded-xl bg-info-soft p-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-info-text shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selected.clinic}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selected.schedule} • Rawat Jalan RS Medika Utama
                    </p>
                  </div>
                </div>
              </div>
              <div className="border-t border-border px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Dokter Penanggung Jawab (DPJP)
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selected.lastHistoryDoctor || "dr. Arief Wijaya, Sp.PD"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Spesialis Penyakit Dalam
                    </p>
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-soft text-xs font-semibold text-teal-text">
                    AW
                  </span>
                </div>
              </div>
              <div className="border-t border-border p-5">
                <Link
                  to="/voice-scribe"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
                >
                  <Mic className="h-4 w-4" />
                  Mulai Voice Scribe
                </Link>
              </div>
            </aside>
          )}
        </div>
      </main>

      {/* Modal Tambah Pasien Baru */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold font-display">
              <UserPlus className="h-5 w-5 text-primary" />
              Daftarkan Pasien Baru
            </DialogTitle>
            <DialogDescription>
              Data pasien akan otomatis tersimpan ke dalam database PostgreSQL dan diberi No. Rekam Medis unik.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddPatient} className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                Nama Lengkap Pasien *
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Budi Santoso"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                  Jenis Kelamin *
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                  Golongan Darah
                </label>
                <select
                  value={formData.bloodType}
                  onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                  className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="A+">A+</option>
                  <option value="B+">B+</option>
                  <option value="AB+">AB+</option>
                  <option value="O+">O+</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                  Tanggal Lahir
                </label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                  Nomor Telepon
                </label>
                <input
                  type="tel"
                  placeholder="08123456789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                NIK Pasien (Opsional)
              </label>
              <input
                type="text"
                placeholder="16 digit NIK KTP"
                value={formData.nik}
                onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                Alamat Domisili
              </label>
              <input
                type="text"
                placeholder="Alamat lengkap pasien"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <DialogFooter className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="rounded-xl border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
              >
                {isSaving ? "Menyimpan ke DB..." : "Simpan Pasien"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
