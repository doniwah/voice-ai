import { Search, Bell, ChevronDown } from "lucide-react";
import type { DocStatus } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-4 lg:px-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <label className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Cari pasien atau No. RM</span>
          <input
            type="search"
            placeholder="Cari pasien atau No. RM..."
            className="h-11 w-64 rounded-xl border border-input bg-card pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </label>
        <button
          type="button"
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-input bg-card text-foreground hover:bg-muted"
          aria-label="Notifikasi"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-destructive" />
        </button>
        <button
          type="button"
          className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-soft text-sm font-bold text-teal-text">
            AW
          </div>
          <div className="hidden text-left lg:block">
            <p className="text-sm font-semibold text-foreground">
              dr. Arief Wijaya, Sp.PD
            </p>
            <p className="text-xs text-muted-foreground">
              Dokter Spesialis Penyakit Dalam
            </p>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground lg:block" />
        </button>
      </div>
    </header>
  );
}

const statusStyles: Record<DocStatus, string> = {
  "Menunggu Review": "bg-warn-soft text-warn-text",
  Menunggu: "bg-warn-soft text-warn-text",
  Disetujui: "bg-ok-soft text-ok-text",
  Diperiksa: "bg-ok-soft text-ok-text",
  "Terkirim SIMRS": "bg-teal-soft text-teal-text",
  Terjadwal: "bg-info-soft text-info-text",
  Draft: "bg-draft-soft text-draft-text",
};

export function StatusBadge({
  status,
  className,
}: {
  status: DocStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        statusStyles[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
