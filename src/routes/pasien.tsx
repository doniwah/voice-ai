import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
} from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { patients, type Patient } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

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
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(patients[0]?.id ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.recordNo.toLowerCase().includes(q),
    );
  }, [query]);

  const selected: Patient =
    patients.find((p) => p.id === selectedId) ?? patients[0]!;

  return (
    <>
      <PageHeader
        title="Daftar Pasien"
        subtitle="Pilih pasien untuk memulai dokumentasi klinis"
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
              className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-muted">
              <CalendarDays className="h-4 w-4" />
              Hari ini
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-muted">
              <Filter className="h-4 w-4" />
              Semua status
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Tambah Pasien
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <section className="self-start rounded-2xl border border-border bg-card xl:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Menampilkan{" "}
                <span className="font-semibold text-foreground">
                  {filtered.length} pasien
                </span>{" "}
                terjadwal hari ini
              </p>
              <p className="text-sm text-muted-foreground">14 Juni 2025</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
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
                    const isSelected = p.id === selected.id;
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
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
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

          <aside className="self-start rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="font-display text-base font-bold text-foreground">
                Detail Pasien
              </h3>
              <button
                aria-label="Menu detail"
                className="rounded-md p-1.5 hover:bg-muted"
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="px-5 py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-soft text-lg font-bold text-teal-text">
                {selected.initials}
              </div>
              <p className="mt-3 font-display text-lg font-bold text-foreground">
                {selected.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selected.recordNo}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1 text-xs font-semibold text-ok-text">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Pasien Aktif
              </span>
            </div>
            <div className="border-t border-border px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Informasi Dasar
              </p>
              <dl className="mt-2 space-y-2 text-sm">
                {[
                  ["Jenis Kelamin", selected.gender],
                  ["Usia", `${selected.age} tahun`],
                  ["Tanggal Lahir", selected.birthDate],
                  ["Golongan Darah", selected.bloodType],
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
                Kunjungan Hari Ini
              </p>
              <div className="mt-2 flex items-start gap-3 rounded-xl bg-info-soft p-3">
                <Calendar className="mt-0.5 h-4 w-4 text-info-text" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selected.clinic}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selected.schedule} • Rawat Jalan
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t border-border px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Riwayat Terakhir
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selected.lastHistory}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selected.lastHistoryDate} • {selected.lastHistoryDoctor}
                  </p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-info-soft text-xs font-semibold text-info-text">
                  IO
                </span>
              </div>
            </div>
            <div className="border-t border-border p-5">
              <Link
                to="/voice-scribe"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Mic className="h-4 w-4" />
                Pilih Pasien &amp; Mulai Scribe
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
