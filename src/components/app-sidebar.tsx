import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Building2,
  FileText,
  LayoutGrid,
  Mic,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutGrid, exact: true },
  { title: "Daftar Pasien", url: "/pasien", icon: Users, exact: false },
  { title: "Voice Scribe", url: "/voice-scribe", icon: Mic, exact: false },
  {
    title: "Riwayat Catatan",
    url: "/riwayat-catatan",
    icon: FileText,
    exact: false,
    badge: 3,
  },
  { title: "Pengaturan", url: "/pengaturan", icon: Settings, exact: false },
];

export function AppSidebar() {
  const pathname = useRouterState({
    select: (router) => router.location.pathname,
  });

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Restore collapsed preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // Ignore if localStorage unavailable
    }
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col bg-navy md:flex transition-all duration-300 ease-in-out select-none",
        isCollapsed ? "w-[72px]" : "w-60",
      )}
    >
      {/* Header with Logo and Collapse/Expand Button */}
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-3 px-2 py-5">
          <Link
            to="/"
            className="flex items-center justify-center focus:outline-none"
            title="SOAPI — Dashboard"
          >
            <div className="h-10 w-10 overflow-hidden rounded-xl flex items-center justify-start shrink-0">
              <img
                src="/logo.png"
                alt="SOAPI"
                className="h-10 w-auto max-w-none object-cover object-left"
              />
            </div>
          </Link>

          <button
            type="button"
            onClick={toggleCollapsed}
            title="Perbesar sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-foreground/70 hover:bg-navy-soft hover:text-white transition-colors cursor-pointer"
            aria-label="Perbesar sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-5">
          <Link to="/" className="flex items-center focus:outline-none">
            <img src="/logo.png" alt="SOAPI" className="h-10 w-auto object-contain" />
          </Link>

          <button
            type="button"
            onClick={toggleCollapsed}
            title="Perkecil sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-navy-foreground/70 hover:bg-navy-soft hover:text-white transition-colors cursor-pointer"
            aria-label="Perkecil sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Menu Header / Divider */}
      {isCollapsed ? (
        <div className="mx-3 my-2 border-t border-white/10" />
      ) : (
        <p className="px-5 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-foreground/50">
          Menu Utama
        </p>
      )}

      {/* Nav Menu Items */}
      <nav className={cn("flex flex-col gap-1.5", isCollapsed ? "px-2" : "px-3")}>
        {menuItems.map((item) => {
          const isActive = item.exact ? pathname === "/" : pathname.startsWith(item.url);

          if (isCollapsed) {
            return (
              <Link
                key={item.url}
                to={item.url}
                title={item.title}
                activeOptions={{ exact: item.exact }}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-xl mx-auto text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-navy-foreground hover:bg-navy-soft hover:text-white",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.badge ? (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-navy">
                    {item.badge}
                  </span>
                ) : null}
                <span className="sr-only">{item.title}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.url}
              to={item.url}
              activeOptions={{ exact: item.exact }}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-navy-foreground hover:bg-navy-soft hover:text-white",
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1">{item.title}</span>
              {item.badge ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-navy">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* "Butuh bantuan?" card */}
      <div className={cn("mt-auto", isCollapsed ? "px-2 pb-4" : "px-4 pb-5")}>
        {isCollapsed ? (
          <div className="flex justify-center">
            <button
              type="button"
              title="Butuh bantuan? Hubungi tim dukungan TI"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-soft text-navy-foreground hover:text-white hover:bg-navy-soft/80 transition-colors cursor-pointer"
            >
              <Building2 className="h-5 w-5" />
              <span className="sr-only">Bantuan TI</span>
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-navy-soft p-4">
            <Building2 className="h-5 w-5 text-navy-foreground" />
            <p className="mt-2 text-sm font-semibold text-white">Butuh bantuan?</p>
            <p className="mt-1 text-xs text-navy-foreground/70">Hubungi tim dukungan TI</p>
            <button className="mt-2 text-xs font-semibold text-primary-foreground/90 underline-offset-2 hover:underline cursor-pointer">
              Pelajari selengkapnya
            </button>
          </div>
        )}
      </div>

      {/* Hospital Footer */}
      {isCollapsed ? (
        <div
          className="flex items-center justify-center border-t border-white/10 px-2 py-4"
          title="RS Medika Utama • Jakarta Selatan"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white">
            RS
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white">
            RS
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">RS Medika Utama</p>
            <p className="text-xs text-navy-foreground/60 truncate">Jakarta Selatan</p>
          </div>
        </div>
      )}
    </aside>
  );
}
