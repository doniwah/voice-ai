import { useState, useEffect } from "react";
import { Search, Bell, ChevronDown, LogOut, Settings, User } from "lucide-react";
import type { DocStatus } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const [doctor, setDoctor] = useState({
    name: "dr. Arief Wijaya, Sp.PD",
    specialty: "Dokter Spesialis Penyakit Dalam",
    initials: "AW",
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    try {
      const auth = localStorage.getItem("soapi_auth");
      if (auth) {
        const parsed = JSON.parse(auth);
        setDoctor({
          name: parsed.name || "dr. Arief Wijaya, Sp.PD",
          specialty: parsed.specialty || "Dokter Spesialis Penyakit Dalam",
          initials: parsed.initials || "AW",
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("soapi_auth");
      toast.success("Anda berhasil keluar dari sistem.");
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    } catch {
      window.location.href = "/login";
    }
  };

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
          onClick={() => toast.info("Tidak ada notifikasi baru saat ini.")}
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-input bg-card text-foreground hover:bg-muted cursor-pointer"
          aria-label="Notifikasi"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-destructive" />
        </button>

        {/* Doctor Profile Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted cursor-pointer transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-soft text-sm font-bold text-teal-text">
              {doctor.initials}
            </div>
            <div className="hidden text-left lg:block">
              <p className="text-sm font-semibold text-foreground">
                {doctor.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {doctor.specialty}
              </p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground lg:block" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground">Masuk sebagai</p>
                <p className="text-sm font-semibold text-foreground truncate">{doctor.name}</p>
              </div>
              <Link
                to="/pengaturan"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Profil & Akun</span>
              </Link>
              <Link
                to="/pengaturan"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Pengaturan Sistem</span>
              </Link>
              <div className="border-t border-border my-1" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-left"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar dari Sistem</span>
              </button>
            </div>
          )}
        </div>
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
