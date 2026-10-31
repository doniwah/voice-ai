import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock, Mail, Stethoscope, ShieldCheck, ArrowRight, Activity, Hospital } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Masuk — SOAPI (AI Clinical Scribe)" },
      {
        name: "description",
        content: "Masuk ke portal SOAPI RS Medika Utama untuk dokumentasi klinis terstandar.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("arief.wijaya@medikautama.id");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    try {
      const auth = localStorage.getItem("soapi_auth");
      if (auth) {
        navigate({ to: "/" });
      }
    } catch {
      // ignore
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error("Silakan isi alamat email dan kata sandi.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal masuk. Periksa kembali email dan kata sandi.");
      }

      // Store auth session
      localStorage.setItem("soapi_auth", JSON.stringify(data.doctor));
      toast.success(data.message || `Selamat datang kembali, ${data.doctor.name}!`);

      setTimeout(() => {
        window.location.href = "/";
      }, 600);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat masuk.");
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    setEmail("arief.wijaya@medikautama.id");
    setPassword("password123");
    toast.info("Kredensial dr. Arief Wijaya telah diisi otomatis.");
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-800 font-sans">
      {/* Left Branding Panel (Dark Medical Blue / Navy) */}
      <div className="hidden lg:flex lg:w-5/12 bg-navy shrink-0 flex-col justify-between p-12 text-white relative overflow-hidden">
        {/* Background decorative glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/30">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight text-white font-display">SOAPI</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/90">
                v2.4 Pro
              </span>
            </div>
          </div>
          <p className="text-xs text-navy-foreground/70 mt-1">AI Clinical Scribe & Medical Record Assistant</p>
        </div>

        <div className="relative z-10 space-y-6 my-auto max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-medium backdrop-blur-sm border border-white/10">
            <Activity className="h-3.5 w-3.5 text-teal-300" />
            <span>Terintegrasi Database PostgreSQL Medis</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-bold font-display tracking-tight leading-tight text-white">
            Dokumentasi Klinis Cerdas, Akurat, dan Terstandar.
          </h1>

          <p className="text-sm text-navy-foreground/80 leading-relaxed">
            Meringankan beban administrasi dokter melalui pencatatan suara otomatis berformat SOAP/SOAPI, rekomendasi diagnosis ICD-10, tindakan ICD-9-CM, dan integrasi langsung ke SIMRS.
          </p>

          <div className="pt-2 grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <p className="font-semibold text-white">Standar Permenkes 24/2022</p>
              <p className="text-[11px] text-navy-foreground/60 mt-0.5">Rekam Medis Elektronik Resmi</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <p className="font-semibold text-white">Kepatuhan UU PDP</p>
              <p className="text-[11px] text-navy-foreground/60 mt-0.5">Enkripsi Data Medis Pasien</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-navy-foreground/60">
          <div className="flex items-center gap-2">
            <Hospital className="h-4 w-4 text-white/60" />
            <span>RS Medika Utama • Jakarta</span>
          </div>
          <span>© 2026 SOAPI System</span>
        </div>
      </div>

      {/* Right Form Container */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 sm:px-12 md:px-16 lg:px-20 bg-background min-h-screen">
        <div className="w-full max-w-[420px] space-y-8">
          {/* Header on Mobile/All */}
          <div>
            <div className="flex items-center gap-2.5 lg:hidden mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-foreground font-display">SOAPI</span>
                <p className="text-[11px] text-muted-foreground">AI Clinical Scribe System</p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-soft text-primary text-[11px] font-semibold mb-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Portal Masuk Tenaga Medis</span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-foreground font-display">
              Selamat Datang
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Masukkan identitas akun dokter Anda untuk mengakses rekam medis dan sistem Voice Scribe.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                Alamat Email Dokter / No. SIP
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="dokter@medikautama.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl border border-input bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Kata Sandi
                </label>
                <button
                  type="button"
                  onClick={() => toast.info("Silakan hubungi Unit TI RS Medika Utama untuk reset kata sandi.")}
                  className="text-xs font-medium text-primary hover:underline transition-colors"
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl border border-input bg-card pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none p-1.5 cursor-pointer rounded-lg transition-colors"
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Masuk ke Sistem</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Box */}
          <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-ok-base" />
                Akun Demo Spesialis Terdaftar:
              </span>
              <button
                type="button"
                onClick={handleQuickDemoLogin}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Isi Otomatis
              </button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 font-mono bg-card p-2.5 rounded-lg border border-border">
              <p><span className="text-foreground font-sans font-medium">Email:</span> arief.wijaya@medikautama.id</p>
              <p><span className="text-foreground font-sans font-medium">Sandi:</span> password123</p>
              <p><span className="text-foreground font-sans font-medium">Dokter:</span> dr. Arief Wijaya, Sp.PD</p>
            </div>
          </div>

          <div className="text-center text-[12px] text-muted-foreground">
            Sistem Keamanan Terotentikasi • PostgreSQL Database SOAPI
          </div>
        </div>
      </div>
    </div>
  );
}
