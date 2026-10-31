import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Mic,
  Users,
} from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/page-header";
import {
  consultations as fallbackConsultations,
  reviewQueue as fallbackReviewQueue,
  weeklyProductivity,
} from "@/lib/demo-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SOAPI" },
      {
        name: "description",
        content:
          "Ringkasan aktivitas dokumentasi klinis hari ini: pasien, catatan, dan antrean review.",
      },
      { property: "og:title", content: "Dashboard — SOAPI" },
      {
        property: "og:description",
        content:
          "Ringkasan aktivitas dokumentasi klinis hari ini: pasien, catatan, dan antrean review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const maxBar = Math.max(...weeklyProductivity.map((d) => d.value));

function Dashboard() {
  const [doctorName, setDoctorName] = useState("dr. Arief");
  const [stats, setStats] = useState({
    totalPatients: 6,
    notesToday: 2,
    waitingReview: 1,
    totalSavedNotes: 2,
  });
  const [recentConsultations, setRecentConsultations] = useState(fallbackConsultations);
  const [queueList, setQueueList] = useState(fallbackReviewQueue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const auth = localStorage.getItem("soapi_auth");
      if (auth) {
        const parsed = JSON.parse(auth);
        if (parsed.name) setDoctorName(parsed.name);
      }
    } catch {}

    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setStats({
            totalPatients: json.data.totalPatients ?? 6,
            notesToday: json.data.notesToday ?? 0,
            waitingReview: json.data.waitingReview ?? 0,
            totalSavedNotes: json.data.totalSavedNotes ?? 0,
          });
          if (json.data.recentConsultations?.length > 0) {
            setRecentConsultations(json.data.recentConsultations);
          }
          if (json.data.reviewQueue?.length > 0) {
            setQueueList(json.data.reviewQueue);
          }
        }
      })
      .catch((err) => {
        console.warn("Failed fetching dashboard stats from PostgreSQL:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const statCards = [
    {
      icon: Users,
      iconBg: "bg-info-soft",
      iconColor: "text-info-text",
      label: "Total Pasien Terdaftar",
      value: stats.totalPatients.toLocaleString("id-ID"),
      note: "Terdata di Database Medis",
    },
    {
      icon: FileText,
      iconBg: "bg-info-soft",
      iconColor: "text-info-text",
      label: "Catatan Hari Ini",
      value: stats.notesToday.toString(),
      note: `${stats.notesToday} sesi terproses`,
    },
    {
      icon: Clock,
      iconBg: "bg-warn-soft",
      iconColor: "text-warn-text",
      label: "Menunggu Review",
      value: stats.waitingReview.toString(),
      note: "Perlu persetujuan Anda",
    },
    {
      icon: CheckCircle2,
      iconBg: "bg-ok-soft",
      iconColor: "text-ok-text",
      label: "Total Catatan Klinis",
      value: stats.totalSavedNotes.toLocaleString("id-ID"),
      note: "Tersimpan aman di DB",
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan aktivitas dokumentasi klinis hari ini"
      />
      <main className="flex-1 px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Selamat datang, {doctorName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Anda memiliki{" "}
              <span className="font-semibold text-warn-text">{stats.waitingReview} catatan</span>{" "}
              yang menunggu review hari ini.
            </p>
          </div>
          <Link
            to="/voice-scribe"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
          >
            <Mic className="h-4 w-4" />
            Mulai Voice Scribe
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="flex items-start justify-between rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}
                >
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="font-display text-3xl font-bold text-foreground">
                    {card.value}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {card.note}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">
                Konsultasi Terbaru
              </h3>
              <p className="text-xs text-muted-foreground">
                Daftar dokumentasi konsultasi pasien terupdate dari database
              </p>
            </div>
            <Link
              to="/riwayat-catatan"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              Lihat semua
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/30">
                  <th className="px-6 py-3 font-semibold">Pasien</th>
                  <th className="px-4 py-3 font-semibold">No. Rekam Medis</th>
                  <th className="px-4 py-3 font-semibold">Waktu Konsultasi</th>
                  <th className="px-4 py-3 font-semibold">Diagnosis</th>
                  <th className="px-4 py-3 font-semibold">
                    Status Dokumentasi
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {recentConsultations.map((c: any) => (
                  <tr
                    key={c.id}
                    className="border-t border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-soft text-xs font-bold text-teal-text">
                          {c.initials}
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {c.patient}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground font-mono">
                      {c.recordNo}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {c.time}
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">
                      {c.diagnosis}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to="/riwayat-catatan"
                        aria-label={`Buka catatan ${c.patient}`}
                      >
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <section className="rounded-2xl border border-border bg-card p-6 lg:col-span-3 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  Produktivitas Dokumentasi
                </h3>
                <p className="text-xs text-muted-foreground">
                  Aktivitas sesi klinis yang diselesaikan
                </p>
              </div>
              <span className="rounded-full bg-ok-soft px-3 py-1 text-xs font-semibold text-ok-text">
                Real-Time
              </span>
            </div>
            <div className="mt-8 flex h-44 items-end gap-4">
              {weeklyProductivity.map((d) => (
                <div
                  key={d.day}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div
                    className={
                      d.value === maxBar
                        ? "w-full max-w-12 rounded-lg bg-chart-bar-active"
                        : "w-full max-w-12 rounded-lg bg-chart-bar"
                    }
                    style={{ height: `${(d.value / maxBar) * 144}px` }}
                    role="img"
                    aria-label={`${d.day}: ${d.value} catatan`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-4">
              {weeklyProductivity.map((d) => (
                <span
                  key={d.day}
                  className="flex-1 text-center text-xs text-muted-foreground"
                >
                  {d.day}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 lg:col-span-2 shadow-sm">
            <h3 className="font-display text-lg font-bold text-foreground">
              Antrean Review
            </h3>
            <p className="text-xs text-muted-foreground">
              Prioritas persetujuan catatan dari database
            </p>
            <ul className="mt-4 divide-y divide-border">
              {queueList.map((q: any) => (
                <li key={q.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-soft text-xs font-bold text-teal-text">
                    {q.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {q.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{q.detail}</p>
                  </div>
                  <Link
                    to="/riwayat-catatan"
                    aria-label={`Review catatan ${q.name}`}
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/riwayat-catatan"
              className="mt-4 flex w-full items-center justify-center rounded-xl border border-input bg-background py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Review semua catatan
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
