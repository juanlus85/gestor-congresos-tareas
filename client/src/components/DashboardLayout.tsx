import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Menu, PanelLeftClose, type LucideIcon, X } from "lucide-react";
import { useState } from "react";
import { TRPCClientError } from "@trpc/client";

export type NavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  allowedRoles: string[];
};

type DashboardLayoutProps = {
  active: string;
  onNavigate: (section: string) => void;
  items: NavigationItem[];
  role?: string;
  roleLabel?: string;
  children: React.ReactNode;
};

const APP_VERSION = "Versión v1.7. 08/09/2026";

export default function DashboardLayout({ active, onNavigate, items, role, roleLabel, children }: DashboardLayoutProps) {
  const { loading, user, logout, loginWithEmail, loginPending } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  if (loading) {
    return <div className="min-h-screen bg-[#f6f7f4] grid place-items-center text-sm text-slate-500">Cargando espacio de coordinación…</div>;
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#061a2f] grid lg:grid-cols-[1.05fr_1fr] overflow-hidden">
        <section className="relative px-7 py-12 sm:px-12 lg:px-16 xl:px-24 flex items-center z-10">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-3 text-[#dcc88c] text-xs uppercase tracking-[0.24em] font-semibold mb-10">
              <span className="w-8 h-px bg-[#c69b4a]" /> Gestor de congresos
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl text-white leading-[1.06]">Un solo lugar para <em className="text-[#e5ba65]">coordinar</em> cada congreso.</h1>
            <p className="mt-7 max-w-lg text-slate-300 leading-7">Crea tareas, categorías y grupos. Asigna el trabajo a una o varias personas y deja que cada colaborador vea sólo lo que le corresponde.</p>
            <form className="mt-8 max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm" onSubmit={async event => {
              event.preventDefault();
              setLoginError("");
              try { await loginWithEmail(email.trim().toLowerCase(), password); window.location.reload(); }
              catch (error) { setLoginError(error instanceof TRPCClientError ? error.message : "No se pudo iniciar sesión. Comprueba la conexión e inténtalo de nuevo."); }
            }}>
              <p className="text-sm font-semibold text-white">Acceso con correo</p>
              <div className="mt-4"><Label className="text-xs text-slate-300">Correo electrónico</Label><Input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 border-white/15 bg-white text-slate-900 placeholder:text-slate-400" placeholder="nombre@organizacion.es" /></div>
              <div className="mt-3"><Label className="text-xs text-slate-300">Clave</Label><Input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5 border-white/15 bg-white text-slate-900" placeholder="Tu clave" /></div>
              {loginError && <p className="mt-3 text-xs text-rose-300">{loginError}</p>}
              <Button type="submit" disabled={loginPending} className="mt-4 w-full bg-[#c79237] hover:bg-[#af7f2f] text-[#061a2f] font-semibold">{loginPending ? "Comprobando acceso…" : "Entrar"}</Button>
              <button type="button" onClick={() => startLogin()} className="mt-3 w-full text-xs text-slate-400 hover:text-white">Acceso alternativo con SSO</button>
            </form>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-400">
              <span>Tareas compartidas</span><span>•</span><span>Grupos de trabajo</span><span>•</span><span>Acceso por persona</span>
            </div>
          </div>
        </section>
        <section className="relative min-h-[320px] hidden lg:block">
          <img src="/manus-storage/7wp-omc-sevilla_f7fdcaf6.jpg" alt="Sevilla, ciudad anfitriona del congreso" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#061a2f] via-[#061a2f]/20 to-transparent" />
        </section>
      </main>
    );
  }

  const visibleItems = items.filter(item => item.allowedRoles.includes(role ?? user.role) || item.allowedRoles.includes("all"));
  return (
    <div className="min-h-screen bg-[#f6f7f4] text-[#172334]">
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#071b31] text-slate-100 transition-[width,transform] duration-200 ${compact ? "w-[76px]" : "w-[268px]"} ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="h-[82px] border-b border-white/10 px-5 flex items-center justify-between gap-3">
          <button onClick={() => { onNavigate("overview"); setIsOpen(false); }} className="text-left min-w-0">
            <p className={`text-[10px] font-semibold tracking-[0.2em] text-[#d8be77] uppercase ${compact ? "hidden" : ""}`}>Gestor de congresos</p>
            <p className={`font-serif text-xl text-white mt-1 truncate ${compact ? "hidden" : ""}`}>Tareas compartidas</p>
            {compact && <span className="font-serif text-lg text-[#e5ba65]">GC</span>}
          </button>
          <button onClick={() => setCompact(!compact)} className="hidden lg:grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Contraer menú">
            <PanelLeftClose size={17} className={compact ? "rotate-180" : ""} />
          </button>
          <button onClick={() => setIsOpen(false)} className="lg:hidden grid h-8 w-8 place-items-center text-slate-300" aria-label="Cerrar menú"><X size={20} /></button>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button key={item.id} onClick={() => { onNavigate(item.id); setIsOpen(false); }} title={compact ? item.label : undefined} className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${selected ? "bg-[#c79237] text-[#071b31] font-semibold shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
                <Icon size={18} strokeWidth={selected ? 2.4 : 1.8} className="shrink-0" />
                {!compact && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-3 py-4">
          <div className={`flex items-center gap-3 rounded-lg p-2 ${compact ? "justify-center" : ""}`}>
            <Avatar className="h-8 w-8 bg-[#2d5878] shrink-0"><AvatarFallback className="bg-[#2d5878] text-xs text-white">{user.name?.slice(0, 1).toUpperCase() ?? "U"}</AvatarFallback></Avatar>
            {!compact && <div className="min-w-0 flex-1"><p className="text-xs font-medium truncate">{user.name ?? "Usuario"}</p><p className="mt-0.5 text-[11px] text-slate-400 truncate">{roleLabel ?? "Acceso autenticado"}</p></div>}
            {!compact && <button onClick={logout} className="text-slate-400 hover:text-white" title="Cerrar sesión"><LogOut size={16} /></button>}
          </div>
          {!compact && <p className="px-2 pt-2 text-[9px] text-slate-500">{APP_VERSION}</p>}
        </div>
      </aside>
      {isOpen && <button onClick={() => setIsOpen(false)} className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" aria-label="Cerrar menú" />}
      <div className={`min-h-screen transition-[padding] duration-200 ${compact ? "lg:pl-[76px]" : "lg:pl-[268px]"}`}>
        <header className="sticky top-0 z-30 h-[66px] bg-[#f6f7f4]/92 backdrop-blur border-b border-slate-200/90 flex items-center px-4 sm:px-7 lg:px-9">
          <button onClick={() => setIsOpen(true)} className="lg:hidden mr-3 grid h-9 w-9 place-items-center rounded-md hover:bg-slate-200" aria-label="Abrir menú"><Menu size={20} /></button>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Espacio activo</div>
        </header>
        <main className="p-4 sm:p-7 lg:p-9 max-w-[1680px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
