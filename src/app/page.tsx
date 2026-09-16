// src/app/page.tsx
//
// (kalm) internal ops dashboard — budget, CRM pipeline, cap table,
// compliance calendar, KPIs, and flagged-contractor reports.
//
// This is a rewrite of an original prototype that used window.storage
// (Claude.ai's Artifacts persistence API) for saving data — that API only
// exists inside a Claude.ai artifact, so it silently does nothing on a
// real deployed site. Every save/load here now goes through real API
// routes backed by Postgres via Prisma instead. All the original UI,
// layout, colors, and module logic are preserved as-is; only the data
// layer changed.
//
// Each module below fetches its own data on mount and exposes granular
// add/update/delete functions that call the matching API route, rather
// than the original single big "update the whole blob" pattern — this
// maps naturally onto real CRUD endpoints instead of one giant JSON blob.

'use client';

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Send, CheckCircle2, Shield, Users, TrendingUp,
  Clock,
  Home, Wallet, Contact, PieChart, ListChecks, Flag, Plus, X,
  ChevronRight, ChevronDown, AlertTriangle, Calendar, Trash2, Edit3,
  User, Building2, Percent, FileWarning,
  Loader2
} from "lucide-react";

/* ============================================================
   KALM OPERATING DASHBOARD
   Brand: navy 1B2A4A / steel 3D5A80 / gold 9C7A2B accent
   ============================================================ */

const COLORS = {
  navy: "#1B2A4A",
  navyLight: "#2A3D63",
  steel: "#3D5A80",
  steelLight: "#E8EEF5",
  gold: "#9C7A2B",
  goldLight: "#F4E8C9",
  green: "#1B7A3D",
  greenLight: "#DCEFDF",
  red: "#B23A3A",
  redLight: "#F8DEDE",
  amber: "#B8860B",
  amberLight: "#FBF0D9",
  grey: "#5A6472",
  greyLight: "#AEB6C2",
  bg: "#F7F9FB",
  card: "#FFFFFF",
  charcoal: "#2A2A2A",
};

const PEOPLE = {
  moiz: { name: "Moiz", role: "Finance & Tech", title: "CTO / CFO", initial: "M" },
  hassan: { name: "Hassan", role: "Legal & Ops", title: "COO", initial: "H" },
  anas: { name: "Anas", role: "Growth & Ops", title: "CMO", initial: "A" },
};

function today() { return new Date().toISOString().slice(0, 10); }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function fmtINR(n) {
  const v = Math.round(Number(n) || 0);
  return "₹" + v.toLocaleString("en-IN");
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function toDateInputValue(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}
function daysUntil(iso) {
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  const now = new Date();
  now.setHours(0,0,0,0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

/* ---------- Data layer: fetch + mutate against real API routes ---------- */

async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}
async function apiPost(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`POST ${path} failed`);
  return res.json();
}
async function apiPut(path, body) {
  const res = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`PUT ${path} failed`);
  return res.json();
}
async function apiDelete(path) {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} failed`);
  return res.json();
}

function useKalmData() {
  const [budgetItems, setBudgetItems] = useState([]);
  const [budgetCeiling, setBudgetCeiling] = useState(600000);
  const [crm, setCrm] = useState([]);
  const [equity, setEquity] = useState([]);
  const [vestingStart, setVestingStart] = useState(today());
  const [compliance, setCompliance] = useState([]);
  const [kpi, setKpi] = useState({ contractorProfiles: 0, developerAccounts: 0, verifiedProfiles: 0, platformIntroductions: 0, trialCohortActive: 0 });
  const [kpiHistory, setKpiHistory] = useState([]);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [budgetRes, settingsRes, crmRes, equityRes, complianceRes, kpiRes, historyRes, flagsRes] = await Promise.all([
          apiGet('/api/budget'),
          apiGet('/api/settings'),
          apiGet('/api/crm'),
          apiGet('/api/equity'),
          apiGet('/api/compliance'),
          apiGet('/api/kpi'),
          apiGet('/api/kpi/history'),
          apiGet('/api/flags'),
        ]);
        setBudgetItems(budgetRes);
        setBudgetCeiling(settingsRes.budgetCeiling);
        setVestingStart(toDateInputValue(settingsRes.vestingStart));
        setCrm(crmRes.map(c => ({ ...c, lastContact: toDateInputValue(c.lastContact) })));
        setEquity(equityRes);
        setCompliance(complianceRes.map(c => ({ ...c, due: toDateInputValue(c.due) })));
        setKpi(kpiRes);
        setKpiHistory(historyRes.map(h => ({ ...h, date: toDateInputValue(h.date) })));
        setFlags(flagsRes.map(f => ({ ...f, dateReported: toDateInputValue(f.dateReported) })));
      } catch (e) {
        console.error('Failed to load dashboard data', e);
      }
      setLoading(false);
    })();
  }, []);

  const withSaving = useCallback(async (fn) => {
    setSaving(true);
    try {
      return await fn();
    } finally {
      setSaving(false);
    }
  }, []);

  // Budget
  const addBudgetItem = useCallback((item) => withSaving(async () => {
    const created = await apiPost('/api/budget', item);
    setBudgetItems(prev => [...prev, created]);
  }), [withSaving]);
  const updateBudgetItem = useCallback((id, item) => withSaving(async () => {
    const updated = await apiPut(`/api/budget/${id}`, item);
    setBudgetItems(prev => prev.map(i => i.id === id ? updated : i));
  }), [withSaving]);
  const deleteBudgetItem = useCallback((id) => withSaving(async () => {
    await apiDelete(`/api/budget/${id}`);
    setBudgetItems(prev => prev.filter(i => i.id !== id));
  }), [withSaving]);

  // CRM
  const addCRMContact = useCallback((c) => withSaving(async () => {
    const created = await apiPost('/api/crm', c);
    setCrm(prev => [{ ...created, lastContact: toDateInputValue(created.lastContact) }, ...prev]);
  }), [withSaving]);
  const updateCRMContact = useCallback((id, c) => withSaving(async () => {
    const updated = await apiPut(`/api/crm/${id}`, c);
    setCrm(prev => prev.map(x => x.id === id ? { ...updated, lastContact: toDateInputValue(updated.lastContact) } : x));
  }), [withSaving]);
  const deleteCRMContact = useCallback((id) => withSaving(async () => {
    await apiDelete(`/api/crm/${id}`);
    setCrm(prev => prev.filter(x => x.id !== id));
  }), [withSaving]);

  // Settings (vesting start)
  const updateVestingStart = useCallback((newStart) => withSaving(async () => {
    await apiPut('/api/settings', { budgetCeiling, vestingStart: newStart });
    setVestingStart(newStart);
  }), [withSaving, budgetCeiling]);

  // Compliance
  const addComplianceItem = useCallback((item) => withSaving(async () => {
    const created = await apiPost('/api/compliance', item);
    setCompliance(prev => [...prev, { ...created, due: toDateInputValue(created.due) }]);
  }), [withSaving]);
  const updateComplianceItem = useCallback((id, item) => withSaving(async () => {
    const updated = await apiPut(`/api/compliance/${id}`, item);
    setCompliance(prev => prev.map(c => c.id === id ? { ...updated, due: toDateInputValue(updated.due) } : c));
  }), [withSaving]);
  const deleteComplianceItem = useCallback((id) => withSaving(async () => {
    await apiDelete(`/api/compliance/${id}`);
    setCompliance(prev => prev.filter(c => c.id !== id));
  }), [withSaving]);

  // KPI
  const updateKpi = useCallback((partial) => withSaving(async () => {
    const updated = await apiPut('/api/kpi', partial);
    setKpi(updated);
  }), [withSaving]);
  const logKpiSnapshot = useCallback(() => withSaving(async () => {
    const entry = await apiPost('/api/kpi/history', {});
    setKpiHistory(prev => [{ ...entry, date: toDateInputValue(entry.date) }, ...prev.filter(h => h.date !== toDateInputValue(entry.date))]);
  }), [withSaving]);

  // Flags
  const addFlag = useCallback((f) => withSaving(async () => {
    const created = await apiPost('/api/flags', f);
    setFlags(prev => [{ ...created, dateReported: toDateInputValue(created.dateReported) }, ...prev]);
  }), [withSaving]);
  const updateFlag = useCallback((id, f) => withSaving(async () => {
    const updated = await apiPut(`/api/flags/${id}`, f);
    setFlags(prev => prev.map(x => x.id === id ? { ...updated, dateReported: toDateInputValue(updated.dateReported) } : x));
  }), [withSaving]);
  const deleteFlag = useCallback((id) => withSaving(async () => {
    await apiDelete(`/api/flags/${id}`);
    setFlags(prev => prev.filter(x => x.id !== id));
  }), [withSaving]);

  return {
    data: { budgetItems, budgetCeiling, crm, equity, vestingStart, compliance, kpi, kpiHistory, flags },
    loading, saving,
    addBudgetItem, updateBudgetItem, deleteBudgetItem,
    addCRMContact, updateCRMContact, deleteCRMContact,
    updateVestingStart,
    addComplianceItem, updateComplianceItem, deleteComplianceItem,
    updateKpi, logKpiSnapshot,
    addFlag, updateFlag, deleteFlag,
  };
}

/* ============================================================
   SMALL UI PRIMITIVES
   ============================================================ */

function IconCircle({ Icon, size = 40, bg = COLORS.steelLight, color = COLORS.navy, iconSize = 18 }: any) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <Icon size={iconSize} color={color} strokeWidth={2} />
    </div>
  );
}

function Card({ children, style, onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.card, borderRadius: 16, padding: 16,
        boxShadow: "0 1px 3px rgba(27,42,74,0.08)", ...style,
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children, bg, color }: any) {
  return (
    <span style={{
      background: bg, color, fontSize: 11, fontWeight: 600, padding: "3px 9px",
      borderRadius: 20, display: "inline-block", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function ProgressBar({ pct, color = COLORS.steel, bg = "#E8ECF1", h = 8 }: any) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ width: "100%", height: h, background: bg, borderRadius: h }}>
      <div style={{ width: `${clamped}%`, height: h, background: color, borderRadius: h, transition: "width 0.3s" }} />
    </div>
  );
}

function SectionLabel({ children }: any) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.grey, marginBottom: 10, marginTop: 4 }}>
      {children}
    </div>
  );
}

function EmptyState({ Icon, title, body }: any) {
  return (
    <div style={{ textAlign: "center", padding: "36px 20px", color: COLORS.grey }}>
      <IconCircle Icon={Icon} size={48} iconSize={22} bg={COLORS.steelLight} color={COLORS.steel} />
      <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: COLORS.navy }}>{title}</div>
      <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.4 }}>{body}</div>
    </div>
  );
}

function Sheet({ open, onClose, title, children }: any) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(27,42,74,0.45)", zIndex: 100,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.bg, width: "100%", maxWidth: 420, maxHeight: "88%",
          borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "auto",
          padding: "18px 18px 28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.navy }}>{title}</div>
          <div onClick={onClose} style={{ padding: 6, cursor: "pointer" }}>
            <X size={20} color={COLORS.grey} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.grey, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid #DDE3EA`,
  fontSize: 14, color: COLORS.charcoal, background: COLORS.card, boxSizing: "border-box",
  fontFamily: "inherit",
};

function TextInput(props: any) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function Select({ value, onChange, options, style }: any) {
  return (
    <select value={value} onChange={onChange} style={{ ...inputStyle, ...style }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function PrimaryButton({ children, onClick, style, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? COLORS.greyLight : COLORS.navy, color: "#fff", border: "none",
        borderRadius: 12, padding: "12px 18px", fontSize: 14, fontWeight: 600,
        width: "100%", cursor: disabled ? "default" : "pointer", fontFamily: "inherit", ...style,
      }}
    >
      {children}
    </button>
  );
}
function GhostButton({ children, onClick, style, color = COLORS.red }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent", color, border: `1px solid ${color}33`,
        borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit", ...style,
      }}
    >
      {children}
    </button>
  );
}

function FAB({ onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute", right: 16, bottom: 84, width: 52, height: 52, borderRadius: "50%",
        background: COLORS.navy, display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 14px rgba(27,42,74,0.35)", cursor: "pointer", zIndex: 20,
      }}
    >
      <Plus size={24} color="#fff" strokeWidth={2.5} />
    </div>
  );
}

/* ============================================================
   BUDGET MODULE
   ============================================================ */

const BUDGET_CATEGORIES = ["Legal & Compliance", "Technology & Product", "Marketing & Advertising", "Operations", "Other"];

function budgetTotals(data) {
  const planned = data.budgetItems.reduce((s, i) => s + Number(i.planned || 0), 0);
  const spent = data.budgetItems.reduce((s, i) => s + Number(i.spent || 0), 0);
  return { planned, spent, remaining: data.budgetCeiling - spent };
}

function BudgetModule({ data, addBudgetItem, updateBudgetItem, deleteBudgetItem }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const { planned, spent, remaining } = budgetTotals(data);
  const pctUsed = (spent / data.budgetCeiling) * 100;

  const byCategory = useMemo(() => {
    const map: Record<string, { planned: number; spent: number }> = {};
    data.budgetItems.forEach((i) => {
      if (!map[i.category]) map[i.category] = { planned: 0, spent: 0 };
      map[i.category].planned += Number(i.planned || 0);
      map[i.category].spent += Number(i.spent || 0);
    });
    return map;
  }, [data.budgetItems]);

  const filtered = filterCat === "All" ? data.budgetItems : data.budgetItems.filter((i) => i.category === filterCat);

  function openNew() {
    setEditing({ id: null, category: "Legal & Compliance", item: "", planned: "", spent: "" });
    setSheetOpen(true);
  }
  function openEdit(item) {
    setEditing({ ...item });
    setSheetOpen(true);
  }
  async function saveItem() {
    if (!editing.item.trim()) return;
    const payload = { category: editing.category, item: editing.item, planned: Number(editing.planned) || 0, spent: Number(editing.spent) || 0 };
    if (editing.id) await updateBudgetItem(editing.id, payload);
    else await addBudgetItem(payload);
    setSheetOpen(false);
    setEditing(null);
  }
  async function deleteItem() {
    await deleteBudgetItem(editing.id);
    setSheetOpen(false);
    setEditing(null);
  }

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <Card style={{ marginBottom: 14, background: COLORS.navy }}>
        <div style={{ color: "#C9D4E3", fontSize: 12, fontWeight: 600 }}>TOTAL SPENT</div>
        <div style={{ color: "#fff", fontSize: 30, fontWeight: 700, marginTop: 2 }}>{fmtINR(spent)}</div>
        <div style={{ color: "#C9D4E3", fontSize: 12.5, marginTop: 2 }}>of {fmtINR(data.budgetCeiling)} ceiling</div>
        <div style={{ marginTop: 10 }}>
          <ProgressBar pct={pctUsed} color={pctUsed > 100 ? COLORS.red : COLORS.gold} bg="rgba(255,255,255,0.15)" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <div style={{ color: "#C9D4E3", fontSize: 12 }}>Planned: {fmtINR(planned)}</div>
          <div style={{ color: remaining < 0 ? "#FFB4B4" : "#C9D4E3", fontSize: 12, fontWeight: 600 }}>
            {remaining < 0 ? "Over by " + fmtINR(-remaining) : "Remaining: " + fmtINR(remaining)}
          </div>
        </div>
      </Card>

      <SectionLabel>BY CATEGORY</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {Object.entries(byCategory).map(([cat, v]) => (
          <Card key={cat} style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy }}>{cat}</span>
              <span style={{ fontSize: 12.5, color: COLORS.grey }}>{fmtINR(v.spent)} / {fmtINR(v.planned)}</span>
            </div>
            <ProgressBar pct={v.planned ? (v.spent / v.planned) * 100 : 0} color={COLORS.steel} />
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionLabel>ALL ITEMS ({filtered.length})</SectionLabel>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        {["All", ...BUDGET_CATEGORIES].map((c) => (
          <div key={c} onClick={() => setFilterCat(c)} style={{
            padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
            background: filterCat === c ? COLORS.navy : COLORS.card, color: filterCat === c ? "#fff" : COLORS.grey,
            border: `1px solid ${filterCat === c ? COLORS.navy : "#E3E7EC"}`,
          }}>{c}</div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 90 }}>
        {filtered.length === 0 && <EmptyState Icon={Wallet} title="No items yet" body="Add your first expense to start tracking." />}
        {filtered.map((i) => (
          <Card key={i.id} onClick={() => openEdit(i)} style={{ padding: 12, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, marginRight: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.navy, lineHeight: 1.3 }}>{i.item}</div>
                <div style={{ fontSize: 11.5, color: COLORS.grey, marginTop: 3 }}>{i.category}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: i.spent > i.planned ? COLORS.red : COLORS.navy }}>{fmtINR(i.spent)}</div>
                <div style={{ fontSize: 11, color: COLORS.greyLight }}>of {fmtINR(i.planned)}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <FAB onClick={openNew} />

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editing?.id ? "Edit item" : "New expense"}>
        {editing && (
          <>
            <Field label="Item">
              <TextInput value={editing.item} onChange={(e) => setEditing({ ...editing, item: e.target.value })} placeholder="e.g. Domain renewal" />
            </Field>
            <Field label="Category">
              <Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} options={BUDGET_CATEGORIES} />
            </Field>
            <Field label="Planned (₹)">
              <TextInput type="number" value={editing.planned} onChange={(e) => setEditing({ ...editing, planned: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Actually spent (₹)">
              <TextInput type="number" value={editing.spent} onChange={(e) => setEditing({ ...editing, spent: e.target.value })} placeholder="0" />
            </Field>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <PrimaryButton onClick={saveItem}>Save</PrimaryButton>
              {editing.id && <GhostButton onClick={deleteItem}><Trash2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Delete</GhostButton>}
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

/* ============================================================
   CRM MODULE
   ============================================================ */

const CRM_STAGES = ["Not Contacted", "Contacted", "Interested", "Onboarding", "Live Account", "Not Interested", "Lost/No Response"];
const CRM_TYPES = ["Developer", "Contractor"];
const CRM_SOURCES = ["Anchor — family network", "Second-ring referral", "Cold outreach", "Inbound (Instagram/LinkedIn)", "Other"];

function stageColor(stage) {
  if (stage === "Live Account") return { bg: COLORS.greenLight, color: COLORS.green };
  if (stage === "Interested" || stage === "Onboarding") return { bg: COLORS.goldLight, color: COLORS.gold };
  if (stage === "Not Interested" || stage === "Lost/No Response") return { bg: COLORS.redLight, color: COLORS.red };
  return { bg: COLORS.steelLight, color: COLORS.steel };
}

function CRMModule({ data, addCRMContact, updateCRMContact, deleteCRMContact }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterType, setFilterType] = useState("All");

  const filtered = filterType === "All" ? data.crm : data.crm.filter((c) => c.type === filterType);
  const counts = {
    total: data.crm.length,
    live: data.crm.filter((c) => c.stage === "Live Account").length,
    active: data.crm.filter((c) => !["Live Account", "Not Interested", "Lost/No Response"].includes(c.stage)).length,
  };

  function openNew() {
    setEditing({ id: null, name: "", type: "Developer", zone: "", source: CRM_SOURCES[1], owner: "anas", stage: "Not Contacted", notes: "", lastContact: today() });
    setSheetOpen(true);
  }
  function openEdit(c) { setEditing({ ...c }); setSheetOpen(true); }
  async function saveContact() {
    if (!editing.name.trim()) return;
    const payload = { name: editing.name, type: editing.type, zone: editing.zone, source: editing.source, owner: editing.owner, stage: editing.stage, notes: editing.notes, lastContact: editing.lastContact };
    if (editing.id) await updateCRMContact(editing.id, payload);
    else await addCRMContact(payload);
    setSheetOpen(false); setEditing(null);
  }
  async function deleteContact() {
    await deleteCRMContact(editing.id);
    setSheetOpen(false); setEditing(null);
  }

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Card style={{ flex: 1, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.navy }}>{counts.total}</div>
          <div style={{ fontSize: 11, color: COLORS.grey }}>Total</div>
        </Card>
        <Card style={{ flex: 1, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.green }}>{counts.live}</div>
          <div style={{ fontSize: 11, color: COLORS.grey }}>Live</div>
        </Card>
        <Card style={{ flex: 1, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.gold }}>{counts.active}</div>
          <div style={{ fontSize: 11, color: COLORS.grey }}>In progress</div>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["All", ...CRM_TYPES].map((t) => (
          <div key={t} onClick={() => setFilterType(t)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: filterType === t ? COLORS.navy : COLORS.card, color: filterType === t ? "#fff" : COLORS.grey,
            border: `1px solid ${filterType === t ? COLORS.navy : "#E3E7EC"}`,
          }}>{t}</div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 90 }}>
        {filtered.length === 0 && <EmptyState Icon={Contact} title="No contacts yet" body="Add a contractor or developer to start your pipeline." />}
        {filtered.map((c) => {
          const sc = stageColor(c.stage);
          return (
            <Card key={c.id} onClick={() => openEdit(c)} style={{ padding: 12, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, marginRight: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {c.type === "Developer" ? <Building2 size={13} color={COLORS.steel} /> : <User size={13} color={COLORS.steel} />}
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.navy }}>{c.name}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: COLORS.grey, marginTop: 4 }}>
                    {PEOPLE[c.owner]?.name || c.owner} · {c.zone || "No zone set"}
                  </div>
                </div>
                <Pill bg={sc.bg} color={sc.color}>{c.stage}</Pill>
              </div>
            </Card>
          );
        })}
      </div>

      <FAB onClick={openNew} />

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editing?.id ? "Edit contact" : "New contact"}>
        {editing && (
          <>
            <Field label="Name / Business"><TextInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Shree Constructions" /></Field>
            <Field label="Type"><Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} options={CRM_TYPES} /></Field>
            <Field label="Zone / Area"><TextInput value={editing.zone} onChange={(e) => setEditing({ ...editing, zone: e.target.value })} placeholder="e.g. Andheri East" /></Field>
            <Field label="Source"><Select value={editing.source} onChange={(e) => setEditing({ ...editing, source: e.target.value })} options={CRM_SOURCES} /></Field>
            <Field label="Owner"><Select value={editing.owner} onChange={(e) => setEditing({ ...editing, owner: e.target.value })} options={Object.keys(PEOPLE)} /></Field>
            <Field label="Stage"><Select value={editing.stage} onChange={(e) => setEditing({ ...editing, stage: e.target.value })} options={CRM_STAGES} /></Field>
            <Field label="Last contact"><TextInput type="date" value={editing.lastContact} onChange={(e) => setEditing({ ...editing, lastContact: e.target.value })} /></Field>
            <Field label="Notes"><TextInput value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Next action, context..." /></Field>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <PrimaryButton onClick={saveContact}>Save</PrimaryButton>
              {editing.id && <GhostButton onClick={deleteContact}><Trash2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Delete</GhostButton>}
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

/* ============================================================
   CAP TABLE MODULE
   ============================================================ */

function vestingCalc(vestingStart, equity) {
  const start = new Date(vestingStart + "T00:00:00");
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, Math.min(48, months));
  const cliffMet = months >= 12;
  const vestedPct = cliffMet ? months / 48 : 0;
  return { months, cliffMet, vestedPct, vestedEquity: equity * vestedPct, unvestedEquity: equity * (1 - vestedPct) };
}

function CapTableModule({ data, updateVestingStart }) {
  const [editingStart, setEditingStart] = useState(false);
  const [startDraft, setStartDraft] = useState(data.vestingStart);
  const totalEquity = data.equity.reduce((s, e) => s + e.equity, 0);

  async function saveStart() {
    await updateVestingStart(startDraft);
    setEditingStart(false);
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: COLORS.grey, fontWeight: 600 }}>VESTING START DATE</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy, marginTop: 2 }}>{fmtDate(data.vestingStart)}</div>
          </div>
          <div onClick={() => { setStartDraft(data.vestingStart); setEditingStart(true); }} style={{ cursor: "pointer" }}>
            <Edit3 size={16} color={COLORS.steel} />
          </div>
        </div>
        {editingStart && (
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <TextInput type="date" value={startDraft} onChange={(e) => setStartDraft(e.target.value)} style={{ flex: 1 }} />
            <div onClick={saveStart} style={{
              background: COLORS.navy, color: "#fff", borderRadius: 10, padding: "0 16px",
              display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>Save</div>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: COLORS.grey, marginTop: 8, lineHeight: 1.4 }}>
          48-month vesting, 12-month cliff. Not legally effective until the Founders' Agreement is signed.
        </div>
      </Card>

      <SectionLabel>EQUITY & VESTING</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.equity.map((e) => {
          const p = PEOPLE[e.person];
          const v = vestingCalc(data.vestingStart, e.equity);
          return (
            <Card key={e.id || e.person}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", background: COLORS.navy,
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14,
                }}>{p.initial}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.navy }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: COLORS.gold, fontWeight: 600 }}>{p.title} · {p.role}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.navy }}>{e.equity.toFixed(2)}%</div>
                  <div style={{ fontSize: 10.5, color: COLORS.grey }}>proposed equity</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: COLORS.grey, marginBottom: 4 }}>
                <span>Vested: {v.vestedEquity.toFixed(2)}%</span>
                <span>{v.cliffMet ? `${v.months}/48 months` : "Before cliff (12mo)"}</span>
              </div>
              <ProgressBar pct={(v.vestedEquity / e.equity) * 100} color={v.cliffMet ? COLORS.green : COLORS.amber} />
              {!v.cliffMet && (
                <div style={{ marginTop: 8, fontSize: 11, color: COLORS.amber, display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={12} /> Cliff not yet met — 0% vested until 12 months
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card style={{ marginTop: 14, background: totalEquity === 100 ? COLORS.greenLight : COLORS.redLight }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: totalEquity === 100 ? COLORS.green : COLORS.red }}>
            Total allocated equity
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: totalEquity === 100 ? COLORS.green : COLORS.red }}>
            {totalEquity.toFixed(2)}%
          </span>
        </div>
      </Card>

      <div style={{ marginTop: 16, padding: 14, background: COLORS.steelLight, borderRadius: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, marginBottom: 6 }}>Key terms</div>
        <div style={{ fontSize: 11.5, color: COLORS.grey, lineHeight: 1.5 }}>
          A founder who departs before the 12-month cliff forfeits their full equity share. After the cliff, equity vests monthly over the remaining period. Unequal future capital is treated as a repayable loan by default — not an automatic equity change — unless all three agree in writing.
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   COMPLIANCE MODULE
   ============================================================ */

function complianceStatus(item) {
  if (item.status === "done") return { label: "Done", bg: COLORS.greenLight, color: COLORS.green };
  const d = daysUntil(item.due);
  if (d < 0) return { label: "Overdue", bg: COLORS.redLight, color: COLORS.red };
  if (d <= 14) return { label: `Due in ${d}d`, bg: COLORS.amberLight, color: COLORS.amber };
  return { label: `Due in ${d}d`, bg: COLORS.steelLight, color: COLORS.steel };
}

function ComplianceModule({ data, addComplianceItem, updateComplianceItem, deleteComplianceItem }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const sorted = [...data.compliance].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    return new Date(a.due).getTime() - new Date(b.due).getTime();
  });

  function openNew() {
    setEditing({ id: null, title: "", due: addDays(30), status: "pending", owner: "hassan" });
    setSheetOpen(true);
  }
  function openEdit(c) { setEditing({ ...c }); setSheetOpen(true); }
  async function toggleDone(c) {
    await updateComplianceItem(c.id, { title: c.title, due: c.due, owner: c.owner, status: c.status === "done" ? "pending" : "done" });
  }
  async function saveItem() {
    if (!editing.title.trim()) return;
    const payload = { title: editing.title, due: editing.due, status: editing.status, owner: editing.owner };
    if (editing.id) await updateComplianceItem(editing.id, payload);
    else await addComplianceItem(payload);
    setSheetOpen(false); setEditing(null);
  }
  async function deleteItem() {
    await deleteComplianceItem(editing.id);
    setSheetOpen(false); setEditing(null);
  }

  const overdue = data.compliance.filter((c) => c.status !== "done" && daysUntil(c.due) < 0).length;
  const upcoming = data.compliance.filter((c) => c.status !== "done" && daysUntil(c.due) >= 0 && daysUntil(c.due) <= 14).length;

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Card style={{ flex: 1, textAlign: "center", padding: 12, background: overdue > 0 ? COLORS.redLight : COLORS.card }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: overdue > 0 ? COLORS.red : COLORS.navy }}>{overdue}</div>
          <div style={{ fontSize: 11, color: COLORS.grey }}>Overdue</div>
        </Card>
        <Card style={{ flex: 1, textAlign: "center", padding: 12, background: upcoming > 0 ? COLORS.amberLight : COLORS.card }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: upcoming > 0 ? COLORS.amber : COLORS.navy }}>{upcoming}</div>
          <div style={{ fontSize: 11, color: COLORS.grey }}>Due soon</div>
        </Card>
        <Card style={{ flex: 1, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.navy }}>{data.compliance.filter(c=>c.status==="done").length}</div>
          <div style={{ fontSize: 11, color: COLORS.grey }}>Done</div>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 90 }}>
        {sorted.length === 0 && <EmptyState Icon={ListChecks} title="No filings tracked" body="Add a compliance deadline to keep track of it." />}
        {sorted.map((c) => {
          const st = complianceStatus(c);
          return (
            <Card key={c.id} style={{ padding: 12, opacity: c.status === "done" ? 0.55 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div onClick={() => toggleDone(c)} style={{ marginTop: 1, cursor: "pointer" }}>
                  <CheckCircle2 size={20} color={c.status === "done" ? COLORS.green : COLORS.greyLight} fill={c.status === "done" ? COLORS.greenLight : "none"} />
                </div>
                <div style={{ flex: 1 }} onClick={() => openEdit(c)}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.navy, textDecoration: c.status === "done" ? "line-through" : "none" }}>{c.title}</div>
                  <div style={{ fontSize: 11.5, color: COLORS.grey, marginTop: 3 }}>{PEOPLE[c.owner]?.name} · Due {fmtDate(c.due)}</div>
                </div>
                {c.status !== "done" && <Pill bg={st.bg} color={st.color}>{st.label}</Pill>}
              </div>
            </Card>
          );
        })}
      </div>

      <FAB onClick={openNew} />

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editing?.id ? "Edit filing" : "New filing"}>
        {editing && (
          <>
            <Field label="Title"><TextInput value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. GST registration" /></Field>
            <Field label="Due date"><TextInput type="date" value={editing.due} onChange={(e) => setEditing({ ...editing, due: e.target.value })} /></Field>
            <Field label="Owner"><Select value={editing.owner} onChange={(e) => setEditing({ ...editing, owner: e.target.value })} options={Object.keys(PEOPLE)} /></Field>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <PrimaryButton onClick={saveItem}>Save</PrimaryButton>
              {editing.id && <GhostButton onClick={deleteItem}><Trash2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Delete</GhostButton>}
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

/* ============================================================
   KPI MODULE
   ============================================================ */

const KPI_DEFS = [
  { key: "contractorProfiles", label: "Contractor profiles", Icon: Users },
  { key: "developerAccounts", label: "Developer accounts", Icon: Building2 },
  { key: "verifiedProfiles", label: "Verified profiles", Icon: Shield },
  { key: "platformIntroductions", label: "Platform-originated introductions", Icon: Send },
  { key: "trialCohortActive", label: "Contractors in active free trial", Icon: Clock },
];

function KPIModule({ data, updateKpi, logKpiSnapshot }) {
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState("");

  function openEdit(key, current) {
    setEditingKey(key);
    setDraft(String(current));
  }
  async function save() {
    await updateKpi({ [editingKey]: Number(draft) || 0 });
    setEditingKey(null);
  }

  const introRate = data.kpi.contractorProfiles > 0
    ? ((data.kpi.platformIntroductions / data.kpi.contractorProfiles) * 100).toFixed(0)
    : 0;
  const verifiedRate = data.kpi.contractorProfiles > 0
    ? ((data.kpi.verifiedProfiles / data.kpi.contractorProfiles) * 100).toFixed(0)
    : 0;

  return (
    <div style={{ paddingBottom: 40 }}>
      <Card style={{ marginBottom: 14, background: COLORS.navy }}>
        <div style={{ color: "#C9D4E3", fontSize: 12, fontWeight: 600 }}>THE REAL SIGNAL</div>
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginTop: 4, lineHeight: 1.35 }}>
          Platform-originated introductions
        </div>
        <div style={{ color: "#fff", fontSize: 32, fontWeight: 700, marginTop: 4 }}>{data.kpi.platformIntroductions}</div>
        <div style={{ color: "#C9D4E3", fontSize: 12, marginTop: 4 }}>
          The metric that actually indicates product-market fit — everything else is a leading indicator.
        </div>
      </Card>

      <SectionLabel>SNAPSHOT</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {KPI_DEFS.map(({ key, label, Icon }) => (
          <Card key={key} onClick={() => openEdit(key, data.kpi[key])} style={{ padding: 12, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <IconCircle Icon={Icon} size={38} iconSize={17} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy }}>{label}</div>
              </div>
              {editingKey === key ? (
                <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <TextInput
                    type="number"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    style={{ width: 60, padding: "6px 8px", textAlign: "center" }}
                    autoFocus
                  />
                  <div onClick={save} style={{ background: COLORS.navy, color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>OK</div>
                </div>
              ) : (
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.navy }}>{data.kpi[key]}</div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Card style={{ flex: 1, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.steel }}>{verifiedRate}%</div>
          <div style={{ fontSize: 10.5, color: COLORS.grey, marginTop: 2 }}>of profiles verified</div>
        </Card>
        <Card style={{ flex: 1, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.steel }}>{introRate}%</div>
          <div style={{ fontSize: 10.5, color: COLORS.grey, marginTop: 2 }}>intros per contractor</div>
        </Card>
      </div>

      <div style={{ marginTop: 14 }}>
        <GhostButton onClick={logKpiSnapshot} color={COLORS.steel} style={{ width: "100%" }}>
          <Calendar size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          Log today's snapshot to history
        </GhostButton>
      </div>

      {data.kpiHistory && data.kpiHistory.length > 0 && (
        <>
          <SectionLabel>HISTORY</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.kpiHistory.slice(0, 10).map((h) => (
              <Card key={h.id || h.date} style={{ padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.navy, marginBottom: 4 }}>{fmtDate(h.date)}</div>
                <div style={{ fontSize: 11, color: COLORS.grey }}>
                  {h.contractorProfiles} contractors · {h.developerAccounts} developers · {h.platformIntroductions} intros
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   FLAGS / REPORTS MODULE
   ============================================================ */

const FLAG_STAGES = ["Reported", "Investigating", "Confirmed", "Disputed / Unclear", "Resolved — Removed", "Resolved — No Action"];

function flagColor(stage) {
  if (stage === "Reported" || stage === "Investigating") return { bg: COLORS.amberLight, color: COLORS.amber };
  if (stage === "Confirmed" || stage === "Resolved — Removed") return { bg: COLORS.redLight, color: COLORS.red };
  if (stage === "Resolved — No Action") return { bg: COLORS.greenLight, color: COLORS.green };
  return { bg: COLORS.steelLight, color: COLORS.steel };
}

function FlagsModule({ data, addFlag, updateFlag, deleteFlag }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  function openNew() {
    setEditing({ id: null, contractorName: "", reportedBy: "", stage: "Reported", dateReported: today(), notes: "" });
    setSheetOpen(true);
  }
  function openEdit(f) { setEditing({ ...f }); setSheetOpen(true); }
  async function saveFlag() {
    if (!editing.contractorName.trim()) return;
    const payload = { contractorName: editing.contractorName, reportedBy: editing.reportedBy, stage: editing.stage, dateReported: editing.dateReported, notes: editing.notes };
    if (editing.id) await updateFlag(editing.id, payload);
    else await addFlag(payload);
    setSheetOpen(false); setEditing(null);
  }
  async function deleteFlagItem() {
    await deleteFlag(editing.id);
    setSheetOpen(false); setEditing(null);
  }

  const open = data.flags.filter(f => !f.stage.startsWith("Resolved")).length;

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <Card style={{ marginBottom: 14, background: open > 0 ? COLORS.redLight : COLORS.greenLight }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconCircle Icon={open > 0 ? AlertTriangle : CheckCircle2} bg={open > 0 ? "#F3C6C6" : "#B9E0C3"} color={open > 0 ? COLORS.red : COLORS.green} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: open > 0 ? COLORS.red : COLORS.green }}>{open} open</div>
            <div style={{ fontSize: 11.5, color: COLORS.grey }}>reports needing action</div>
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 90 }}>
        {data.flags.length === 0 && <EmptyState Icon={Flag} title="No reports on file" body="If a developer reports a contractor issue, log it here." />}
        {data.flags.map((f) => {
          const fc = flagColor(f.stage);
          return (
            <Card key={f.id} onClick={() => openEdit(f)} style={{ padding: 12, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, marginRight: 10 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.navy }}>{f.contractorName}</div>
                  <div style={{ fontSize: 11.5, color: COLORS.grey, marginTop: 3 }}>Reported {fmtDate(f.dateReported)}{f.reportedBy ? " · by " + f.reportedBy : ""}</div>
                </div>
                <Pill bg={fc.bg} color={fc.color}>{f.stage}</Pill>
              </div>
            </Card>
          );
        })}
      </div>

      <FAB onClick={openNew} />

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editing?.id ? "Edit report" : "New report"}>
        {editing && (
          <>
            <Field label="Contractor name"><TextInput value={editing.contractorName} onChange={(e) => setEditing({ ...editing, contractorName: e.target.value })} /></Field>
            <Field label="Reported by (developer)"><TextInput value={editing.reportedBy} onChange={(e) => setEditing({ ...editing, reportedBy: e.target.value })} /></Field>
            <Field label="Date reported"><TextInput type="date" value={editing.dateReported} onChange={(e) => setEditing({ ...editing, dateReported: e.target.value })} /></Field>
            <Field label="Stage"><Select value={editing.stage} onChange={(e) => setEditing({ ...editing, stage: e.target.value })} options={FLAG_STAGES} /></Field>
            <Field label="Notes"><TextInput value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="What happened, evidence, next step..." /></Field>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <PrimaryButton onClick={saveFlag}>Save</PrimaryButton>
              {editing.id && <GhostButton onClick={deleteFlagItem}><Trash2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Delete</GhostButton>}
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

/* ============================================================
   ROLE-SPECIFIC HOME VIEWS
   ============================================================ */

function HomeHeader({ person }: any) {
  const p = PEOPLE[person];
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, color: COLORS.grey, fontWeight: 500 }}>Welcome back</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.navy, marginTop: 2 }}>{p.name}</div>
      <div style={{ fontSize: 12.5, color: COLORS.gold, fontWeight: 600, marginTop: 2 }}>{p.title} · {p.role}</div>
    </div>
  );
}

function MetricRow({ Icon, label, value, sub, onClick, valueColor }: any) {
  return (
    <Card onClick={onClick} style={{ padding: 14, cursor: onClick ? "pointer" : "default", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconCircle Icon={Icon} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.grey }}>{label}</div>
          {sub && <div style={{ fontSize: 10.5, color: COLORS.greyLight, marginTop: 1 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: valueColor || COLORS.navy }}>{value}</div>
        {onClick && <ChevronRight size={16} color={COLORS.greyLight} />}
      </div>
    </Card>
  );
}

function MoizHome({ data, setTab }) {
  const { spent, remaining } = budgetTotals(data);
  const pctUsed = (spent / data.budgetCeiling) * 100;
  const overdueCompliance = data.compliance.filter(c => c.status !== "done" && daysUntil(c.due) < 0 && c.owner === "moiz").length;
  const verifiedRate = data.kpi.contractorProfiles > 0 ? Math.round((data.kpi.verifiedProfiles / data.kpi.contractorProfiles) * 100) : 0;

  return (
    <div>
      <HomeHeader person="moiz" />
      <Card style={{ marginBottom: 14, background: pctUsed > 90 ? COLORS.red : COLORS.navy }}>
        <div style={{ color: "#D9E0EA", fontSize: 12, fontWeight: 600 }}>BUDGET — SPENT VS CEILING</div>
        <div style={{ color: "#fff", fontSize: 26, fontWeight: 700, marginTop: 2 }}>{fmtINR(spent)}</div>
        <div style={{ marginTop: 8 }}><ProgressBar pct={pctUsed} bg="rgba(255,255,255,0.18)" color={COLORS.gold} /></div>
        <div style={{ color: "#D9E0EA", fontSize: 11.5, marginTop: 6 }}>{fmtINR(remaining)} remaining of {fmtINR(data.budgetCeiling)}</div>
      </Card>
      <SectionLabel>QUICK VIEW</SectionLabel>
      <MetricRow Icon={Shield} label="Verified profiles" sub="of total contractor profiles" value={`${verifiedRate}%`} onClick={() => setTab("kpi")} />
      <MetricRow Icon={Send} label="Platform introductions" sub="the core product signal" value={data.kpi.platformIntroductions} onClick={() => setTab("kpi")} />
      <MetricRow Icon={FileWarning} label="Your compliance items overdue" value={overdueCompliance} valueColor={overdueCompliance > 0 ? COLORS.red : COLORS.green} onClick={() => setTab("compliance")} />
      <MetricRow Icon={Flag} label="Open reports" value={data.flags.filter(f => !f.stage.startsWith("Resolved")).length} onClick={() => setTab("flags")} />
    </div>
  );
}

function HassanHome({ data, setTab }) {
  const overdue = data.compliance.filter(c => c.status !== "done" && daysUntil(c.due) < 0);
  const dueSoon = data.compliance.filter(c => c.status !== "done" && daysUntil(c.due) >= 0 && daysUntil(c.due) <= 14);
  const totalEquity = data.equity.reduce((s, e) => s + e.equity, 0);
  const openFlags = data.flags.filter(f => !f.stage.startsWith("Resolved"));

  return (
    <div>
      <HomeHeader person="hassan" />
      <Card style={{ marginBottom: 14, background: overdue.length > 0 ? COLORS.red : COLORS.navy }}>
        <div style={{ color: "#D9E0EA", fontSize: 12, fontWeight: 600 }}>COMPLIANCE STATUS</div>
        <div style={{ color: "#fff", fontSize: 26, fontWeight: 700, marginTop: 2 }}>
          {overdue.length > 0 ? `${overdue.length} overdue` : "All on track"}
        </div>
        <div style={{ color: "#D9E0EA", fontSize: 11.5, marginTop: 6 }}>{dueSoon.length} due in the next 14 days</div>
      </Card>
      <SectionLabel>QUICK VIEW</SectionLabel>
      {overdue.slice(0, 2).map(c => (
        <MetricRow key={c.id} Icon={AlertTriangle} label={c.title} value="" sub={`Was due ${fmtDate(c.due)}`} valueColor={COLORS.red} onClick={() => setTab("compliance")} />
      ))}
      <MetricRow Icon={Percent} label="Total equity allocated" value={`${totalEquity.toFixed(1)}%`} valueColor={totalEquity === 100 ? COLORS.green : COLORS.red} onClick={() => setTab("captable")} />
      <MetricRow Icon={Flag} label="Open reports" value={openFlags.length} valueColor={openFlags.length > 0 ? COLORS.red : COLORS.green} onClick={() => setTab("flags")} />
      <MetricRow Icon={ListChecks} label="Filings tracked" value={data.compliance.length} onClick={() => setTab("compliance")} />
    </div>
  );
}

function AnasHome({ data, setTab }) {
  const live = data.crm.filter(c => c.stage === "Live Account").length;
  const active = data.crm.filter(c => !["Live Account", "Not Interested", "Lost/No Response"].includes(c.stage)).length;
  const needsFollowUp = data.crm.filter(c => {
    if (["Live Account", "Not Interested", "Lost/No Response"].includes(c.stage)) return false;
    const d = daysUntil(c.lastContact);
    return d <= -7;
  });

  return (
    <div>
      <HomeHeader person="anas" />
      <Card style={{ marginBottom: 14, background: COLORS.navy }}>
        <div style={{ color: "#D9E0EA", fontSize: 12, fontWeight: 600 }}>PIPELINE</div>
        <div style={{ display: "flex", gap: 18, marginTop: 8 }}>
          <div>
            <div style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>{live}</div>
            <div style={{ color: "#D9E0EA", fontSize: 11 }}>live accounts</div>
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>{active}</div>
            <div style={{ color: "#D9E0EA", fontSize: 11 }}>in progress</div>
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>{data.crm.length}</div>
            <div style={{ color: "#D9E0EA", fontSize: 11 }}>total contacts</div>
          </div>
        </div>
      </Card>
      <SectionLabel>QUICK VIEW</SectionLabel>
      <MetricRow Icon={Clock} label="Contacts not followed up in 7+ days" value={needsFollowUp.length} valueColor={needsFollowUp.length > 0 ? COLORS.amber : COLORS.green} onClick={() => setTab("crm")} />
      <MetricRow Icon={Send} label="Platform introductions" sub="tap to update" value={data.kpi.platformIntroductions} onClick={() => setTab("kpi")} />
      <MetricRow Icon={Users} label="Developer accounts" value={data.kpi.developerAccounts} onClick={() => setTab("kpi")} />
      <MetricRow Icon={Wallet} label="Marketing spent" value={fmtINR(data.budgetItems.filter(i => i.category === "Marketing & Advertising").reduce((s,i)=>s+Number(i.spent||0),0))} onClick={() => setTab("budget")} />
    </div>
  );
}

/* ============================================================
   APP SHELL
   ============================================================ */

const TABS = [
  { key: "home", label: "Home", Icon: Home },
  { key: "budget", label: "Budget", Icon: Wallet },
  { key: "crm", label: "Pipeline", Icon: Contact },
  { key: "captable", label: "Equity", Icon: PieChart },
  { key: "compliance", label: "Filings", Icon: ListChecks },
  { key: "kpi", label: "KPIs", Icon: TrendingUp },
  { key: "flags", label: "Reports", Icon: Flag },
];

const MODULE_TITLES = {
  budget: "Budget & Expenses",
  crm: "Contractor & Developer Pipeline",
  captable: "Equity & Vesting",
  compliance: "Compliance Calendar",
  kpi: "KPIs",
  flags: "Reports & Flags",
};

export default function KalmDashboard() {
  const {
    data, loading, saving,
    addBudgetItem, updateBudgetItem, deleteBudgetItem,
    addCRMContact, updateCRMContact, deleteCRMContact,
    updateVestingStart,
    addComplianceItem, updateComplianceItem, deleteComplianceItem,
    updateKpi, logKpiSnapshot,
    addFlag, updateFlag, deleteFlag,
  } = useKalmData();
  const [person, setPerson] = useState("moiz");
  const [tab, setTab] = useState("home");
  const [switcherOpen, setSwitcherOpen] = useState(false);

  if (loading) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: COLORS.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <Loader2 size={28} color={COLORS.steel} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const bottomTabs = TABS;

  return (
    <div style={{
      maxWidth: 430, margin: "0 auto", height: "100vh", background: COLORS.bg,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "center",
        background: COLORS.bg, flexShrink: 0,
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.navy, letterSpacing: -0.5 }}>(kalm)</div>
        <div onClick={() => setSwitcherOpen(true)} style={{
          display: "flex", alignItems: "center", gap: 6, background: COLORS.card, padding: "6px 10px 6px 6px",
          borderRadius: 20, cursor: "pointer", boxShadow: "0 1px 3px rgba(27,42,74,0.08)",
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%", background: COLORS.navy, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
          }}>{PEOPLE[person].initial}</div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.navy }}>{PEOPLE[person].name}</span>
          <ChevronDown size={13} color={COLORS.grey} />
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "6px 16px 16px" }}>
        {tab !== "home" && (
          <div style={{ fontSize: 19, fontWeight: 700, color: COLORS.navy, margin: "8px 0 14px" }}>
            {MODULE_TITLES[tab]}
          </div>
        )}
        {tab === "home" && person === "moiz" && <MoizHome data={data} setTab={setTab} />}
        {tab === "home" && person === "hassan" && <HassanHome data={data} setTab={setTab} />}
        {tab === "home" && person === "anas" && <AnasHome data={data} setTab={setTab} />}
        {tab === "budget" && <BudgetModule data={data} addBudgetItem={addBudgetItem} updateBudgetItem={updateBudgetItem} deleteBudgetItem={deleteBudgetItem} />}
        {tab === "crm" && <CRMModule data={data} addCRMContact={addCRMContact} updateCRMContact={updateCRMContact} deleteCRMContact={deleteCRMContact} />}
        {tab === "captable" && <CapTableModule data={data} updateVestingStart={updateVestingStart} />}
        {tab === "compliance" && <ComplianceModule data={data} addComplianceItem={addComplianceItem} updateComplianceItem={updateComplianceItem} deleteComplianceItem={deleteComplianceItem} />}
        {tab === "kpi" && <KPIModule data={data} updateKpi={updateKpi} logKpiSnapshot={logKpiSnapshot} />}
        {tab === "flags" && <FlagsModule data={data} addFlag={addFlag} updateFlag={updateFlag} deleteFlag={deleteFlag} />}
      </div>

      <div style={{
        display: "flex", background: COLORS.card, borderTop: "1px solid #EBEEF2",
        padding: "8px 4px calc(8px + env(safe-area-inset-bottom, 0px))", flexShrink: 0,
      }}>
        {bottomTabs.map(({ key, label, Icon }) => (
          <div
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "4px 2px", cursor: "pointer",
            }}
          >
            <Icon size={19} color={tab === key ? COLORS.navy : COLORS.greyLight} strokeWidth={tab === key ? 2.4 : 2} />
            <span style={{ fontSize: 9.5, fontWeight: tab === key ? 700 : 500, color: tab === key ? COLORS.navy : COLORS.greyLight }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <Sheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} title="Switch view">
        {Object.entries(PEOPLE).map(([key, p]) => (
          <Card
            key={key}
            onClick={() => { setPerson(key); setSwitcherOpen(false); setTab("home"); }}
            style={{
              padding: 14, marginBottom: 8, cursor: "pointer",
              border: person === key ? `2px solid ${COLORS.navy}` : "2px solid transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", background: COLORS.navy, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700,
              }}>{p.initial}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy }}>{p.name}</div>
                <div style={{ fontSize: 12, color: COLORS.gold, fontWeight: 600 }}>{p.title} · {p.role}</div>
              </div>
              {person === key && <CheckCircle2 size={18} color={COLORS.navy} />}
            </div>
          </Card>
        ))}
        <div style={{ fontSize: 11, color: COLORS.grey, textAlign: "center", marginTop: 10, lineHeight: 1.4 }}>
          All data is shared across everyone — switching only changes your home screen.
        </div>
      </Sheet>

      {saving && (
        <div style={{
          position: "absolute", top: 10, right: 14, fontSize: 10, color: COLORS.greyLight,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      )}
    </div>
  );
}
