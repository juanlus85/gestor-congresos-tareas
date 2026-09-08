import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout, { type NavigationItem } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Archive, ArrowRight, BadgeCheck, Banknote, BookOpenText, CalendarDays, CheckCircle2, ChevronRight,
  CircleAlert, ClipboardCheck, Clock3, FileText, Filter, FolderOpen, LayoutDashboard, ListTodo,
  Loader2, MapPin, MessageSquareText, Network, Plus, Search, ShieldCheck, Sparkles, Users, X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Task = {
  id: number; externalId: string; phase: string; workBlock: string; title: string; description: string | null;
  observations: string | null; status: string; committee: string | null; responsible: string | null;
  coResponsible1: string | null; coResponsible2: string | null; support: string | null; priority: string;
  scope: string | null; platformModule: string | null; team: string | null; plannedStart: string | null;
  dueDate: string | null; actualClose: string | null; deliverable: string | null; dependencies: string | null;
  risk: string | null; decisionRequired: string | null; assignedAtMeeting: string | null; costEstimate: string | null;
  costActual: string | null; progress: number; localEligible: boolean; localWorkstream: string | null;
};

type Member = { id: number; name: string; email?: string | null; role: string; committee: string | null; position: string | null; active: boolean };

type Section = "overview" | "tasks" | "local" | "meetings" | "documents" | "members" | "finance";

const ALL_PRIVILEGED = ["admin", "direction", "local_member", "scientific", "technical", "collaborator", "viewer", "user"];
const STATUS_OPTIONS = ["Pendiente", "En curso", "Resuelta", "Bloqueada", "Revisar", "No aplica", "Adjudicada a otro comité"];
const ROLE_OPTIONS = [
  ["direction", "Dirección"], ["local_member", "Comité local"], ["scientific", "Comité científico"],
  ["technical", "Secretaría técnica"], ["collaborator", "Colaborador/a"], ["viewer", "Consulta"], ["admin", "Administración"],
] as const;
const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLE_OPTIONS);

function statusStyle(status: string) {
  if (status === "Resuelta") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "En curso") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "Bloqueada") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "Revisar") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function priorityStyle(priority: string) {
  if (priority === "Alta") return "text-rose-700 bg-rose-50 border-rose-200";
  if (priority === "Media") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}

function exportTasksCsv(tasks: Task[]) {
  const columns: Array<[string, keyof Task]> = [
    ["Código", "externalId"], ["Fase", "phase"], ["Bloque de trabajo", "workBlock"], ["Actividad", "title"],
    ["Estado", "status"], ["Comité responsable", "committee"], ["Responsable", "responsible"], ["Prioridad", "priority"],
    ["Avance", "progress"], ["Ámbito local", "localWorkstream"], ["Fecha límite", "dueDate"], ["Entregable", "deliverable"],
  ];
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const content = [columns.map(([label]) => escape(label)).join(","), ...tasks.map(task => columns.map(([, key]) => escape(task[key])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "matriz-7wp-omc-filtrada.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, helper, tone, icon: Icon }: { label: string; value: number | string; helper: string; tone: string; icon: typeof ClipboardCheck }) {
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(22,35,52,0.04)]">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.08em] uppercase text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-[#172334]">{value}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={19} /></span></div>
    <p className="mt-3 text-xs text-slate-500">{helper}</p>
  </div>;
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof FileText; title: string; body: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-500"><Icon size={21} /></span><h3 className="mt-4 font-semibold text-slate-800">{title}</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{body}</p></div>;
}

function TaskTable({ tasks, onOpen, compact = false }: { tasks: Task[]; onOpen: (task: Task) => void; compact?: boolean }) {
  if (!tasks.length) return <EmptyState icon={ListTodo} title="No hay tareas con estos criterios" body="Ajusta los filtros o crea una tarea nueva si tu perfil dispone de permisos." />;
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(22,35,52,0.035)]">
    <table className="min-w-[900px] w-full text-left">
      <thead><tr className="border-b border-slate-100 text-[11px] tracking-[0.08em] uppercase text-slate-500">
        <th className="px-5 py-3.5 font-semibold">Tarea</th><th className="px-4 py-3.5 font-semibold">Bloque</th><th className="px-4 py-3.5 font-semibold">Responsable</th><th className="px-4 py-3.5 font-semibold">Estado</th><th className="px-4 py-3.5 font-semibold">Avance</th><th className="px-4 py-3.5 font-semibold">Prioridad</th>
      </tr></thead>
      <tbody className="divide-y divide-slate-100">
        {tasks.map(task => <tr key={task.id} onClick={() => onOpen(task)} className="group cursor-pointer hover:bg-[#fbfaf7] transition-colors">
          <td className="px-5 py-4 max-w-[370px]"><div className="flex gap-3"><span className="mt-0.5 text-[10px] font-bold tracking-wide text-[#9b7333] shrink-0">{task.externalId}</span><div><p className="text-sm font-medium text-slate-800 group-hover:text-[#9b7333] leading-5">{task.title}</p>{!compact && <p className="mt-1 text-xs text-slate-500 truncate">{task.phase}</p>}</div></div></td>
          <td className="px-4 py-4 text-xs text-slate-600">{task.workBlock}</td><td className="px-4 py-4 text-xs text-slate-600 max-w-[180px] truncate">{task.responsible || "Sin asignar"}</td>
          <td className="px-4 py-4"><Badge variant="outline" className={`${statusStyle(task.status)} font-medium whitespace-nowrap`}>{task.status}</Badge></td>
          <td className="px-4 py-4 w-[130px]"><div className="flex items-center gap-2"><Progress value={task.progress} className="h-1.5 w-16" /><span className="text-xs tabular-nums text-slate-500">{task.progress}%</span></div></td>
          <td className="px-4 py-4"><Badge variant="outline" className={`${priorityStyle(task.priority)} font-medium`}>{task.priority}</Badge></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function TaskDialog({ task, role, onClose }: { task: Task | null; role: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [form, setForm] = useState<Partial<Task>>({});
  const notes = trpc.tasks.notes.useQuery({ taskId: task?.id ?? 0 }, { enabled: Boolean(task) });
  const update = trpc.tasks.update.useMutation({ onSuccess: () => { toast.success("Tarea actualizada"); utils.tasks.list.invalidate(); utils.workspace.dashboard.invalidate(); utils.workspace.localSummary.invalidate(); } });
  const addNote = trpc.tasks.addNote.useMutation({ onSuccess: () => { setNote(""); notes.refetch(); toast.success("Actualización añadida"); } });
  if (!task) return null;
  const canEdit = ["admin", "direction"].includes(role) || (role !== "viewer" && role !== "user");
  const save = () => update.mutate({ id: task.id, data: form });
  const field = (key: keyof Task) => (form[key] ?? task[key] ?? "") as string;
  const detailRows = [
    ["Comité responsable", task.committee], ["Ámbito", task.scope], ["Módulo", task.platformModule], ["Equipo", task.team],
    ["Co-responsable", task.coResponsible1], ["Apoyo", task.coResponsible2 || task.support], ["Inicio previsto", task.plannedStart], ["Límite previsto", task.dueDate], ["Cierre real", task.actualClose], ["Entregable / evidencia", task.deliverable], ["Dependencias", task.dependencies], ["Riesgo si se retrasa", task.risk], ["Decisión requerida", task.decisionRequired], ["Asignada en reunión", task.assignedAtMeeting], ["Coste estimado", task.costEstimate], ["Coste real", task.costActual],
  ].filter(([, value]) => value);
  return <Dialog open={Boolean(task)} onOpenChange={open => !open && onClose()}><DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0">
    <div className="p-6 sm:p-8 border-b border-slate-100 bg-[#fbfaf7]"><div className="flex flex-wrap items-start gap-3 pr-8"><span className="text-xs font-bold tracking-[0.08em] text-[#9b7333]">{task.externalId}</span><Badge variant="outline" className={statusStyle(task.status)}>{task.status}</Badge><Badge variant="outline" className={priorityStyle(task.priority)}>{task.priority}</Badge></div><DialogHeader className="mt-4"><DialogTitle className="font-serif text-2xl leading-tight text-[#172334]">{task.title}</DialogTitle><DialogDescription className="pt-2 text-sm leading-6">{task.description || "Sin descripción adicional."}</DialogDescription></DialogHeader></div>
    <div className="p-6 sm:p-8 grid gap-7 lg:grid-cols-[1.05fr_.95fr]">
      <section className="space-y-6">
        <div><p className="section-kicker">Seguimiento operativo</p><div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div><Label>Estado</Label><Select disabled={!canEdit} value={field("status")} onValueChange={value => setForm(prev => ({ ...prev, status: value }))}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Prioridad</Label><Select disabled={!canEdit} value={field("priority")} onValueChange={value => setForm(prev => ({ ...prev, priority: value }))}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{["Alta", "Media", "Baja"].map(priority => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
          <div className="sm:col-span-2"><Label>Responsable de ejecución</Label><Input disabled={!canEdit} className="mt-1.5" value={field("responsible")} onChange={e => setForm(prev => ({ ...prev, responsible: e.target.value || null }))} /></div>
          <div className="sm:col-span-2"><div className="flex justify-between"><Label>Indicador de avance</Label><span className="text-xs font-semibold text-[#9b7333]">{Number(form.progress ?? task.progress)}%</span></div><input disabled={!canEdit} className="mt-3 w-full accent-[#a7772f]" type="range" min="0" max="100" step="5" value={Number(form.progress ?? task.progress)} onChange={e => setForm(prev => ({ ...prev, progress: Number(e.target.value) }))} /><Progress value={Number(form.progress ?? task.progress)} className="mt-2 h-2" /></div>
          <div className="sm:col-span-2"><Label>Observaciones</Label><Textarea disabled={!canEdit} className="mt-1.5 min-h-24" value={field("observations")} onChange={e => setForm(prev => ({ ...prev, observations: e.target.value || null }))} /></div>
          {canEdit && <Button onClick={save} disabled={update.isPending} className="sm:col-span-2 justify-center bg-[#173c59] hover:bg-[#102f48]">{update.isPending && <Loader2 className="mr-2 animate-spin" size={16} />}Guardar seguimiento</Button>}
        </div></div>
        <div><p className="section-kicker">Actualizaciones y acuerdos</p><div className="mt-3 space-y-3">{notes.data?.length ? notes.data.map(item => <div key={item.id} className="rounded-xl bg-slate-50 px-4 py-3"><div className="flex justify-between gap-3 text-xs"><span className="font-medium text-slate-700">{item.authorName}</span><span className="text-slate-400">{new Date(item.createdAt).toLocaleString("es-ES")}</span></div><p className="mt-1.5 text-sm leading-6 text-slate-600">{item.body}</p></div>) : <p className="text-sm text-slate-500">Todavía no hay actualizaciones.</p>}</div>
        {canEdit && <div className="mt-4 flex gap-2"><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Añadir avance, acuerdo o incidencia…" className="min-h-20" /><Button onClick={() => note.trim() && addNote.mutate({ taskId: task.id, body: note })} disabled={addNote.isPending} size="icon" className="shrink-0 bg-[#173c59] hover:bg-[#102f48]"><ArrowRight size={18} /></Button></div>}</div>
      </section>
      <section className="rounded-2xl border border-slate-200 p-5 h-fit"><p className="section-kicker">Ficha completa</p><dl className="mt-4 divide-y divide-slate-100">{detailRows.map(([label, value]) => <div key={label} className="py-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">{label}</dt><dd className="mt-1 text-sm leading-5 text-slate-700 whitespace-pre-wrap">{value}</dd></div>)}</dl></section>
    </div>
  </DialogContent></Dialog>;
}

function NewTaskDialog({ open, onClose, role }: { open: boolean; onClose: () => void; role: string }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ externalId: "", title: "", phase: "0. Arranque", workBlock: "Gobernanza", committee: "Local Organizing Committee", priority: "Media", responsible: "", localEligible: role === "local_member", localWorkstream: "Coordinación local" });
  const create = trpc.tasks.create.useMutation({ onSuccess: () => { utils.tasks.list.invalidate(); utils.workspace.dashboard.invalidate(); utils.workspace.localSummary.invalidate(); toast.success("Tarea creada correctamente"); onClose(); } });
  return <Dialog open={open} onOpenChange={value => !value && onClose()}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Nueva tarea</DialogTitle><DialogDescription>Incluye una clave única y asigna el comité responsable.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div><Label>Código</Label><Input className="mt-1.5" placeholder="T9-001" value={form.externalId} onChange={e => setForm({ ...form, externalId: e.target.value })} /></div><div><Label>Prioridad</Label><Select value={form.priority} onValueChange={value => setForm({ ...form, priority: value })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{["Alta", "Media", "Baja"].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div className="sm:col-span-2"><Label>Actividad</Label><Input className="mt-1.5" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div><div><Label>Fase</Label><Input className="mt-1.5" value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })} /></div><div><Label>Bloque de trabajo</Label><Input className="mt-1.5" value={form.workBlock} onChange={e => setForm({ ...form, workBlock: e.target.value })} /></div><div className="sm:col-span-2"><Label>Comité responsable</Label><Input className="mt-1.5" value={form.committee} onChange={e => setForm({ ...form, committee: e.target.value })} /></div><div className="sm:col-span-2"><Label>Responsable de ejecución</Label><Input className="mt-1.5" value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} /></div></div><Button disabled={!form.externalId || !form.title || create.isPending} onClick={() => create.mutate({ ...form, responsible: form.responsible || null, localWorkstream: form.localEligible ? form.localWorkstream : null })} className="bg-[#173c59] hover:bg-[#102f48]">Crear tarea</Button></DialogContent></Dialog>;
}

export default function Home() {
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [phaseFilter, setPhaseFilter] = useState("Todas");
  const [localGroup, setLocalGroup] = useState<string | null>(null);
  const access = trpc.workspace.access.useQuery(undefined, { enabled: Boolean(user) });
  const dashboard = trpc.workspace.dashboard.useQuery(undefined, { enabled: Boolean(user) });
  const taskQuery = trpc.tasks.list.useQuery(undefined, { enabled: Boolean(user) });
  const localSummary = trpc.workspace.localSummary.useQuery(undefined, { enabled: Boolean(user) && ["admin", "direction", "local_member"].includes(access.data?.role ?? "") });
  const role = access.data?.role ?? user?.role ?? "viewer";
  const tasks = (taskQuery.data ?? []) as Task[];
  const phases = useMemo(() => Array.from(new Set(tasks.map(task => task.phase))), [tasks]);
  const filteredTasks = useMemo(() => tasks.filter(task => {
    const needle = taskSearch.toLowerCase().trim();
    const matchesText = !needle || [task.externalId, task.title, task.workBlock, task.responsible, task.committee].filter(Boolean).join(" ").toLowerCase().includes(needle);
    return matchesText && (statusFilter === "Todas" || task.status === statusFilter) && (phaseFilter === "Todas" || task.phase === phaseFilter) && (!localGroup || task.localWorkstream === localGroup);
  }), [tasks, taskSearch, statusFilter, phaseFilter, localGroup]);

  const nav: NavigationItem[] = [
    { id: "overview", label: "Visión general", icon: LayoutDashboard, allowedRoles: ALL_PRIVILEGED },
    { id: "tasks", label: "Matriz de tareas", icon: ListTodo, allowedRoles: ALL_PRIVILEGED },
    { id: "local", label: "Comité local", icon: Network, allowedRoles: ["admin", "direction", "local_member"] },
    { id: "meetings", label: "Reuniones y acuerdos", icon: CalendarDays, allowedRoles: ["admin", "direction", "local_member", "scientific", "technical"] },
    { id: "documents", label: "Documentos", icon: FolderOpen, allowedRoles: ALL_PRIVILEGED },
    { id: "finance", label: "Finanzas y patrocinios", icon: Banknote, allowedRoles: ["admin", "direction"] },
    { id: "members", label: "Personas y permisos", icon: Users, allowedRoles: ["admin"] },
  ];
  const showNewTask = ["admin", "direction", "local_member", "scientific", "technical"].includes(role);
  const content = () => {
    if (section === "tasks") return <TasksView tasks={filteredTasks} rawTasks={tasks} search={taskSearch} setSearch={setTaskSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} phaseFilter={phaseFilter} setPhaseFilter={setPhaseFilter} phases={phases} clearGroup={() => setLocalGroup(null)} localGroup={localGroup} onOpen={setSelectedTask} onCreate={() => setNewTaskOpen(true)} canCreate={showNewTask} />;
    if (section === "local") return <LocalView data={localSummary.data} loading={localSummary.isLoading} onOpen={setSelectedTask} onViewGroup={name => { setLocalGroup(name); setSection("tasks"); }} />;
    if (section === "meetings") return <MeetingsView role={role} />;
    if (section === "documents") return <DocumentsView role={role} />;
    if (section === "members") return <MembersView />;
    if (section === "finance") return <FinanceView onOpen={setSelectedTask} />;
    return <OverviewView data={dashboard.data} loading={dashboard.isLoading} onOpen={setSelectedTask} onNavigate={setSection} />;
  };

  return <DashboardLayout active={section} onNavigate={value => setSection(value as Section)} items={nav} role={role} roleLabel={access.data?.label}>{content()}<TaskDialog task={selectedTask} role={role} onClose={() => setSelectedTask(null)} /><NewTaskDialog open={newTaskOpen} onClose={() => setNewTaskOpen(false)} role={role} /></DashboardLayout>;
}

function PageHeading({ eyebrow, title, body, action }: { eyebrow: string; title: string; body: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-kicker">{eyebrow}</p><h1 className="mt-2 font-serif text-3xl sm:text-4xl text-[#172334] tracking-tight">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-500 max-w-2xl">{body}</p></div>{action}</div>;
}

function OverviewView({ data, loading, onOpen, onNavigate }: { data: any; loading: boolean; onOpen: (task: Task) => void; onNavigate: (section: Section) => void }) {
  if (loading || !data) return <div className="h-64 grid place-items-center"><Loader2 className="animate-spin text-[#a7772f]" /></div>;
  const activity = [
    ["Arranque", "0. Arranque", "Definiciones institucionales y gobierno"], ["Planificación", "1. Planificación general", "Sede, fechas, presupuesto y patrocinio"], ["Programa", "2. Programa científico", "Call for papers y revisión científica"], ["Operación", "7. Ejecución", "Atención en sede y resolución de incidencias"],
  ];
  return <>
    <PageHeading eyebrow="Vista de dirección" title="El congreso, bajo control." body="Seguimiento consolidado del plan maestro. La matriz incorpora las tareas, dependencias y responsables del documento de trabajo." action={<div className="rounded-xl bg-[#e9efe9] px-4 py-3 text-xs text-[#406147]"><span className="font-semibold">Próximo hito</span><br />Congreso · 1–4 septiembre 2027</div>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Tareas visibles" value={data.taskCount} helper={`${data.blocks} bloques de trabajo`} tone="bg-[#e8eef4] text-[#275170]" icon={ClipboardCheck} /><StatCard label="En curso" value={data.inProgress} helper={`${data.pending} pendientes de activar`} tone="bg-blue-50 text-blue-700" icon={Clock3} /><StatCard label="Prioridad alta" value={data.highPriority} helper="No resueltas" tone="bg-rose-50 text-rose-700" icon={CircleAlert} /><StatCard label="Decisiones" value={data.decisions} helper="Pendientes de criterio" tone="bg-amber-50 text-amber-700" icon={Sparkles} /></div>
    <div className="mt-7 grid gap-6 xl:grid-cols-[1.45fr_.85fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_4px_18px_rgba(22,35,52,0.035)]"><div className="flex items-center justify-between"><div><p className="section-kicker">Prioridades abiertas</p><h2 className="mt-1 text-lg font-semibold text-slate-800">Próximas tareas a coordinar</h2></div><button onClick={() => onNavigate("tasks")} className="text-xs font-semibold text-[#9b7333] hover:text-[#76531b]">Ver matriz <ChevronRight className="inline" size={15} /></button></div><div className="mt-4 divide-y divide-slate-100">{data.nextTasks.map((task: Task) => <button onClick={() => onOpen(task)} key={task.id} className="w-full py-3.5 text-left flex gap-3 hover:bg-[#fbfaf7] rounded-lg px-2 -mx-2"><span className="mt-0.5 text-[10px] font-bold text-[#9b7333]">{task.externalId}</span><span className="flex-1 min-w-0"><span className="block text-sm font-medium text-slate-700 truncate">{task.title}</span><span className="mt-1 block text-xs text-slate-500">{task.workBlock} · {task.responsible || "Sin asignar"}</span></span><Badge variant="outline" className={`${statusStyle(task.status)} shrink-0 h-fit`}>{task.status}</Badge></button>)}</div></section>
      <section className="rounded-2xl bg-[#123752] p-6 text-white overflow-hidden relative"><div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full border border-[#d1a757]/30" /><p className="relative text-xs tracking-[.12em] uppercase font-semibold text-[#e0bd70]">Comité local</p><h2 className="relative mt-2 font-serif text-2xl">Asignación por bloques</h2><p className="relative mt-3 text-sm leading-6 text-slate-300">El espacio local reúne <strong className="text-white">{data.localCount} tareas</strong> agrupadas por carga y ámbito para facilitar la distribución entre sus miembros.</p><Button onClick={() => onNavigate("local")} className="relative mt-6 bg-[#d1a757] text-[#102d45] hover:bg-[#c49a4c]">Abrir plan local <ArrowRight className="ml-2" size={16} /></Button></section></div>
    <section className="mt-7"><div className="mb-4 flex items-center gap-3"><p className="section-kicker">Ruta de trabajo</p><span className="h-px flex-1 bg-slate-200" /></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{activity.map(([title, phase, body], index) => <div key={title} className="relative rounded-xl border border-slate-200 bg-white p-4"><span className="text-xs font-bold text-[#a7772f]">0{index + 1}</span><h3 className="mt-2 font-semibold text-slate-800">{title}</h3><p className="mt-1 text-xs text-slate-500">{phase}</p><p className="mt-3 text-xs leading-5 text-slate-600">{body}</p></div>)}</div></section>
  </>;
}

function TasksView({ tasks, rawTasks, search, setSearch, statusFilter, setStatusFilter, phaseFilter, setPhaseFilter, phases, clearGroup, localGroup, onOpen, onCreate, canCreate }: { tasks: Task[]; rawTasks: Task[]; search: string; setSearch: (v: string) => void; statusFilter: string; setStatusFilter: (v: string) => void; phaseFilter: string; setPhaseFilter: (v: string) => void; phases: string[]; clearGroup: () => void; localGroup: string | null; onOpen: (t: Task) => void; onCreate: () => void; canCreate: boolean }) {
  return <><PageHeading eyebrow="Plan maestro" title="Matriz de tareas" body={`${rawTasks.length} tareas disponibles según los permisos del perfil. Selecciona una fila para consultar la ficha completa, responsables, riesgos y evidencias.`} action={<div className="flex gap-2"><Button variant="outline" onClick={() => exportTasksCsv(tasks)} className="bg-white"><Archive className="mr-2" size={16} />Exportar</Button>{canCreate && <Button onClick={onCreate} className="bg-[#173c59] hover:bg-[#102f48]"><Plus className="mr-2" size={16} />Nueva tarea</Button>}</div>} />
  {localGroup && <div className="mb-4 flex items-center justify-between rounded-xl border border-[#dfc48e] bg-[#fff9eb] px-4 py-3 text-sm text-[#6b5221]"><span>Filtro activo: <strong>{localGroup}</strong></span><button onClick={clearGroup} className="flex items-center gap-1 text-xs font-semibold"><X size={14} /> Quitar filtro</button></div>}
  <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_180px_230px]"><div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9 border-0 bg-slate-50" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código, actividad, bloque o responsable…" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><Filter size={15} className="mr-2 text-slate-400" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Todas">Todos los estados</SelectItem>{STATUS_OPTIONS.map(status => <SelectItem value={status} key={status}>{status}</SelectItem>)}</SelectContent></Select><Select value={phaseFilter} onValueChange={setPhaseFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Todas">Todas las fases</SelectItem>{phases.map(phase => <SelectItem value={phase} key={phase}>{phase}</SelectItem>)}</SelectContent></Select></div>
  <p className="mb-3 text-xs text-slate-500"><strong className="text-slate-700">{tasks.length}</strong> tareas mostradas</p><TaskTable tasks={tasks} onOpen={onOpen} /></>;
}

function LocalView({ data, loading, onOpen, onViewGroup }: { data: any; loading: boolean; onOpen: (t: Task) => void; onViewGroup: (name: string) => void }) {
  if (loading || !data) return <div className="h-64 grid place-items-center"><Loader2 className="animate-spin text-[#a7772f]" /></div>;
  return <><PageHeading eyebrow="Copia de trabajo del Comité Local" title="Distribuir para avanzar" body={`Las ${data.total} tareas donde interviene el comité local se han agrupado por contenido y carga aproximada. Esta propuesta puede convertirse en adjudicaciones de responsables desde cada ficha.`} />
  <div className="mb-6 rounded-2xl bg-[#173c59] px-5 py-5 text-white sm:flex sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.11em] text-[#e4c17d]">Propuesta de agrupación</p><p className="mt-1 font-serif text-xl">7 bloques homogéneos para la próxima reunión</p></div><div className="mt-3 sm:mt-0 flex gap-5 text-sm"><span><strong className="text-[#e4c17d]">{data.total}</strong> tareas</span><span><strong className="text-[#e4c17d]">{data.groups.reduce((sum: number, group: any) => sum + group.high, 0)}</strong> prioritarias</span></div></div>
  <div className="grid gap-4 lg:grid-cols-2">{data.groups.map((group: any, index: number) => <article key={group.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_18px_rgba(22,35,52,0.035)]"><div className="flex gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f4ead2] text-sm font-bold text-[#8d6423]">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h2 className="font-serif text-xl text-[#172334]">{group.name}</h2><span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{group.total} tareas</span></div><div className="mt-3 grid grid-cols-4 gap-2 text-center"><div className="rounded-lg bg-slate-50 p-2"><p className="text-base font-semibold">{group.pending}</p><p className="text-[10px] text-slate-500">Pend.</p></div><div className="rounded-lg bg-blue-50 p-2"><p className="text-base font-semibold text-blue-700">{group.active}</p><p className="text-[10px] text-slate-500">Curso</p></div><div className="rounded-lg bg-emerald-50 p-2"><p className="text-base font-semibold text-emerald-700">{group.done}</p><p className="text-[10px] text-slate-500">Cerr.</p></div><div className="rounded-lg bg-rose-50 p-2"><p className="text-base font-semibold text-rose-700">{group.high}</p><p className="text-[10px] text-slate-500">Alta</p></div></div><div className="mt-4 flex items-center justify-between gap-4"><p className="text-xs text-slate-500 truncate">Ej.: {group.tasks.slice(0, 2).map((task: Task) => task.title).join(" · ")}</p><button onClick={() => onViewGroup(group.name)} className="shrink-0 text-xs font-semibold text-[#9b7333]">Ver bloque <ChevronRight className="inline" size={14} /></button></div></div></div></article>)}</div>
  <section className="mt-7"><p className="section-kicker mb-3">Tareas para asignar en la reunión</p><TaskTable tasks={data.groups.flatMap((group: any) => group.tasks).filter((task: Task) => task.status !== "Resuelta" && (!task.responsible || task.responsible.toLowerCase().includes("pendiente"))).slice(0, 12)} onOpen={onOpen} compact /></section></>;
}

function MeetingsView({ role }: { role: string }) {
  const utils = trpc.useUtils(); const meetings = trpc.meetings.list.useQuery(); const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", scheduledAt: "", committee: "Local Organizing Committee", agenda: "" });
  const create = trpc.meetings.create.useMutation({ onSuccess: () => { utils.meetings.list.invalidate(); toast.success("Reunión registrada"); setOpen(false); } }); const canEdit = ["admin", "direction", "local_member", "technical"].includes(role);
  return <><PageHeading eyebrow="Gobernanza" title="Reuniones y acuerdos" body="Agenda, actas y acuerdos asociados a la coordinación. Las decisiones concretas se enlazan desde la ficha de cada tarea." action={canEdit ? <Button onClick={() => setOpen(true)} className="bg-[#173c59] hover:bg-[#102f48]"><Plus className="mr-2" size={16} />Programar reunión</Button> : undefined} />
  {meetings.isLoading ? <div className="h-40 grid place-items-center"><Loader2 className="animate-spin" /></div> : meetings.data?.length ? <div className="grid gap-3">{meetings.data.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8eef4] text-[#275170]"><CalendarDays size={20} /></div><div className="flex-1"><h2 className="font-semibold text-slate-800">{item.title}</h2><p className="mt-1 text-xs text-slate-500">{item.committee} · {item.scheduledAt}</p>{item.agenda && <p className="mt-2 text-sm text-slate-600">{item.agenda}</p>}</div><Badge variant="outline" className="w-fit bg-blue-50 text-blue-700 border-blue-200">{item.status}</Badge></article>)}</div> : <EmptyState icon={CalendarDays} title="Aún no hay reuniones registradas" body="Programa la siguiente reunión del comité y deja trazabilidad de sus acuerdos." />}
  <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Programar reunión</DialogTitle><DialogDescription>Registra la cita y su agenda inicial.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Título</Label><Input className="mt-1.5" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div><div><Label>Fecha y hora</Label><Input className="mt-1.5" placeholder="DD/MM/AAAA HH:MM" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} /></div><div><Label>Comité</Label><Input className="mt-1.5" value={form.committee} onChange={e => setForm({ ...form, committee: e.target.value })} /></div><div><Label>Agenda</Label><Textarea className="mt-1.5" value={form.agenda} onChange={e => setForm({ ...form, agenda: e.target.value })} /></div><Button disabled={!form.title || !form.scheduledAt} onClick={() => create.mutate({ ...form, agenda: form.agenda || null })} className="w-full bg-[#173c59] hover:bg-[#102f48]">Guardar reunión</Button></div></DialogContent></Dialog></>;
}

function DocumentsView({ role }: { role: string }) {
  const utils = trpc.useUtils(); const documents = trpc.documents.list.useQuery(); const [open, setOpen] = useState(false); const [form, setForm] = useState({ title: "", category: "Documento de trabajo", url: "", owner: "", visibility: "Comités" }); const canEdit = ["admin", "direction", "local_member", "scientific", "technical"].includes(role);
  const create = trpc.documents.create.useMutation({ onSuccess: () => { utils.documents.list.invalidate(); toast.success("Documento registrado"); setOpen(false); } });
  return <><PageHeading eyebrow="Repositorio" title="Documentos y enlaces" body="Registro compartido de actas, contratos, programas, evidencias y enlaces de trabajo. La carga de ficheros puede centralizarse mediante los enlaces del repositorio institucional." action={canEdit ? <Button onClick={() => setOpen(true)} className="bg-[#173c59] hover:bg-[#102f48]"><Plus className="mr-2" size={16} />Añadir registro</Button> : undefined} />
  {documents.data?.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{documents.data.map(document => <article key={document.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f4ead2] text-[#8d6423]"><FileText size={19} /></span><div className="min-w-0"><Badge variant="outline" className="mb-2 text-[10px] bg-slate-50 text-slate-500">{document.category}</Badge><h2 className="font-semibold text-slate-800 truncate">{document.title}</h2><p className="mt-1 text-xs text-slate-500">{document.owner || "Sin responsable"} · {document.visibility}</p></div></div>{document.url && <a className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#9b7333] hover:text-[#76531b]" href={document.url} target="_blank" rel="noreferrer">Abrir enlace <ArrowRight size={13} /></a>}</article>)}</div> : <EmptyState icon={FolderOpen} title="Repositorio listo para organizar" body="Registra enlaces a las carpetas institucionales, versiones en inglés y evidencias de cada tarea." />}
  <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Añadir documento o enlace</DialogTitle><DialogDescription>Guarda la referencia sin duplicar el fichero.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Título</Label><Input className="mt-1.5" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div><div><Label>Categoría</Label><Input className="mt-1.5" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div><div><Label>URL</Label><Input className="mt-1.5" type="url" placeholder="https://…" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} /></div><div><Label>Responsable</Label><Input className="mt-1.5" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} /></div><Button disabled={!form.title || !form.category} onClick={() => create.mutate({ ...form, url: form.url || null, owner: form.owner || null })} className="w-full bg-[#173c59] hover:bg-[#102f48]">Registrar</Button></div></DialogContent></Dialog></>;
}

function MembersView() {
  const utils = trpc.useUtils(); const members = trpc.members.list.useQuery(); const [open, setOpen] = useState(false); const [form, setForm] = useState({ name: "", email: "", role: "local_member", committee: "Local Organizing Committee", position: "" });
  const create = trpc.members.create.useMutation({ onSuccess: () => { utils.members.list.invalidate(); toast.success("Usuario invitado y perfil creado"); setOpen(false); } }); const update = trpc.members.update.useMutation({ onSuccess: () => { utils.members.list.invalidate(); toast.success("Permisos actualizados"); } });
  return <><PageHeading eyebrow="Administración" title="Personas y permisos" body="Crea perfiles antes de que accedan al espacio. El perfil se aplicará al iniciar sesión con el correo indicado; así cada comité verá sólo su ámbito de trabajo." action={<Button onClick={() => setOpen(true)} className="bg-[#173c59] hover:bg-[#102f48]"><Plus className="mr-2" size={16} />Crear usuario</Button>} />
  <div className="mb-5 rounded-xl border border-[#dfc48e] bg-[#fff9eb] p-4 text-sm leading-6 text-[#6b5221]"><ShieldCheck className="mr-2 inline text-[#9b7333]" size={17} /><strong>Modelo de permisos.</strong> Dirección y Administración acceden al plan completo; Comité local, Científico y Secretaría técnica a su ámbito; Colaborador/a sólo a tareas asignadas; Consulta sólo a su panel autorizado.</div>
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="min-w-[780px] w-full text-left"><thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-[.08em] text-slate-500"><th className="px-5 py-3">Persona</th><th className="px-4 py-3">Comité</th><th className="px-4 py-3">Cargo</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Acceso</th></tr></thead><tbody className="divide-y divide-slate-100">{(members.data as Member[] | undefined)?.map(member => <tr key={member.id}><td className="px-5 py-4"><p className="text-sm font-medium text-slate-800">{member.name}</p>{member.email && <p className="mt-1 text-xs text-slate-500">{member.email}</p>}</td><td className="px-4 py-4 text-xs text-slate-600">{member.committee || "—"}</td><td className="px-4 py-4 text-xs text-slate-600">{member.position || "—"}</td><td className="px-4 py-4"><Select value={member.role} onValueChange={value => update.mutate({ id: member.id, role: value as any, email: member.email ?? null })}><SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger><SelectContent>{ROLE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></td><td className="px-4 py-4"><button onClick={() => update.mutate({ id: member.id, active: !member.active })} className="text-left"><Badge variant="outline" className={member.active ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}>{member.active ? "Activo · suspender" : "Suspendido · activar"}</Badge></button></td></tr>)}</tbody></table></div>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Crear usuario</DialogTitle><DialogDescription>El correo sirve para asignar automáticamente el perfil cuando la persona acceda.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Nombre completo</Label><Input className="mt-1.5" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div><div><Label>Correo</Label><Input className="mt-1.5" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div><div><Label>Perfil</Label><Select value={form.role} onValueChange={value => setForm({ ...form, role: value })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{ROLE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label>Comité</Label><Input className="mt-1.5" value={form.committee} onChange={e => setForm({ ...form, committee: e.target.value })} /></div><div><Label>Cargo</Label><Input className="mt-1.5" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></div><Button disabled={!form.name || !form.email} onClick={() => create.mutate({ ...form, email: form.email || null, committee: form.committee || null, position: form.position || null, role: form.role as any })} className="w-full bg-[#173c59] hover:bg-[#102f48]">Crear perfil</Button></div></DialogContent></Dialog></>;
}

function FinanceView({ onOpen }: { onOpen: (task: Task) => void }) {
  const finance = trpc.finance.summary.useQuery(); const tasks = (finance.data ?? []) as Task[]; const active = tasks.filter(task => task.status !== "Resuelta");
  return <><PageHeading eyebrow="Acceso restringido" title="Finanzas y patrocinios" body="Seguimiento de las tareas de presupuesto, cuotas, proveedores, ayudas y patrocinios. Los importes se mantienen en la ficha y en sus evidencias documentales." />
  <div className="grid gap-4 md:grid-cols-3"><StatCard label="Tareas financieras" value={tasks.length} helper="Incluidas en la matriz" tone="bg-[#e8eef4] text-[#275170]" icon={Banknote} /><StatCard label="Abiertas" value={active.length} helper="Pendientes o en curso" tone="bg-amber-50 text-amber-700" icon={Clock3} /><StatCard label="Resueltas" value={tasks.length - active.length} helper="Con seguimiento registrado" tone="bg-emerald-50 text-emerald-700" icon={CheckCircle2} /></div><section className="mt-7"><TaskTable tasks={tasks} onOpen={onOpen} /></section></>;
}
