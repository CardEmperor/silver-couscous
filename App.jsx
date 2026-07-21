import { useState, useEffect } from "react";

/* ------------------------------------------------------------------
   PhD DOSSIER — application tracker (standalone / GitHub Pages build)
   Palette: Ink #182338 | Paper #F5F6F2 | Cardinal #8C2F39
            Brass #A8853C | Slate #5C6B7A
   Type:    Fraunces (display) / Public Sans (body) / IBM Plex Mono (data)
------------------------------------------------------------------- */

const INK = "#182338";
const PAPER = "#F5F6F2";
const CARD = "#FFFFFF";
const CARDINAL = "#8C2F39";
const BRASS = "#A8853C";
const SLATE = "#5C6B7A";
const LINE = "#DDE0D9";

const STATUSES = [
  { id: "researching", label: "Researching", bg: "#EEF1F6", fg: "#3D4E6B" },
  { id: "preparing", label: "Preparing", bg: "#F6EFDF", fg: "#7A5E1E" },
  { id: "submitted", label: "Submitted", bg: "#E7EFE8", fg: "#2F5D3A" },
  { id: "interview", label: "Interview", bg: "#EFE7F2", fg: "#5B3A6E" },
  { id: "admitted", label: "Admitted", bg: "#E3F0E6", fg: "#1F6B33" },
  { id: "rejected", label: "Rejected", bg: "#F4E6E6", fg: "#8C2F39" },
];

const STORE_KEY = "phd-dossier-programs-v1";
const KEY_STORE = "phd-dossier-api-key";

const emptyProgram = (university, program) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  university: university.trim(),
  program: program.trim(),
  status: "researching",
  deadline: "",
  fee: "",
  feeWaiver: "",
  selection: "",
  placements: "",
  notes: "",
  professors: [],
  students: [],
  sources: [],
  lastResearched: null,
});

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,)?\s+(\d{4})|(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})\/(\d{4})/i
  );
  if (!m) return null;
  let d;
  if (m[1]) d = new Date(`${m[1]} ${m[2]}, ${m[3]}`);
  else if (m[4]) d = new Date(+m[4], +m[5] - 1, +m[6]);
  else d = new Date(+m[9], +m[7] - 1, +m[8]);
  if (isNaN(d)) return null;
  return Math.ceil((d - new Date()) / 86400000);
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* ---------------- localStorage helpers ---------------- */
function loadPrograms() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function savePrograms(programs) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(programs));
    return true;
  } catch {
    return false;
  }
}

/* ---------------- AI research call ---------------- */
async function researchWithAI(apiKey, university, program) {
  const prompt = `Research the PhD program "${program}" at "${university}" using web search. Search the department site, faculty pages, graduate admissions pages, and public social/academic profiles (Google Scholar, LinkedIn, X/Twitter, personal sites).

Find:
1. 5-8 professors in this program who advise PhD students: name, one short research-area phrase, personal/lab website URL.
2. 3-6 current PhD students: name and a public link (personal site, Scholar, LinkedIn, or X).
3. The next application deadline (month day, year).
4. Application fee amount and fee-waiver availability/criteria, briefly.
5. Typical admitted-student profile or stated requirements (GPA, GRE policy, publications, admission rate if published) in 2-3 concise sentences.
6. Recent PhD graduate placements (companies, faculty positions) in 1-2 concise sentences.

Respond with ONLY minified JSON, no markdown fences, no preamble:
{"professors":[{"name":"","area":"","url":""}],"students":[{"name":"","url":""}],"deadline":"","fee":"","feeWaiver":"","selection":"","placements":"","sources":["url1","url2"]}
Keep every string short. If something is not findable, use "" or [].`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }
  const data = await response.json();
  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in response");
  return JSON.parse(clean.slice(start, end + 1));
}

/* ---------------- small pieces ---------------- */
function StatusPill({ status, onChange }) {
  const s = STATUSES.find((x) => x.id === status) || STATUSES[0];
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: s.bg,
        color: s.fg,
        border: "none",
        borderRadius: 999,
        padding: "4px 12px",
        fontFamily: "'Public Sans', sans-serif",
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {STATUSES.map((x) => (
        <option key={x.id} value={x.id}>
          {x.label}
        </option>
      ))}
    </select>
  );
}

function SectionHead({ children, action }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        borderBottom: `1px solid ${LINE}`,
        paddingBottom: 6,
        marginBottom: 12,
        marginTop: 28,
      }}
    >
      <h3
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 17,
          fontWeight: 600,
          color: INK,
          margin: 0,
          letterSpacing: "0.01em",
        }}
      >
        {children}
      </h3>
      {action}
    </div>
  );
}

function PersonRow({ person, onDelete }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: `1px dashed ${LINE}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: INK }}>{person.name}</div>
        {person.area && <div style={{ fontSize: 12.5, color: SLATE }}>{person.area}</div>}
      </div>
      {person.url ? (
        <a
          href={person.url}
          target="_blank"
          rel="noreferrer"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11.5,
            color: CARDINAL,
            textDecoration: "none",
            borderBottom: `1px solid ${CARDINAL}`,
            whiteSpace: "nowrap",
          }}
        >
          {hostOf(person.url)} ↗
        </a>
      ) : (
        <span style={{ fontSize: 11.5, color: "#AAB2A9" }}>no link</span>
      )}
      <button
        onClick={onDelete}
        aria-label={`Remove ${person.name}`}
        style={{
          border: "none",
          background: "none",
          color: "#B9BFB6",
          cursor: "pointer",
          fontSize: 14,
          padding: 2,
        }}
      >
        ✕
      </button>
    </div>
  );
}

function AddPersonForm({ onAdd, withArea }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [url, setUrl] = useState("");
  const inputStyle = {
    border: `1px solid ${LINE}`,
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 12.5,
    fontFamily: "'Public Sans', sans-serif",
    background: "#FBFBF9",
    minWidth: 0,
  };
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
      <input
        style={{ ...inputStyle, flex: "1 1 110px" }}
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {withArea && (
        <input
          style={{ ...inputStyle, flex: "1 1 110px" }}
          placeholder="Research area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
      )}
      <input
        style={{ ...inputStyle, flex: "2 1 150px" }}
        placeholder="https://…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        onClick={() => {
          if (!name.trim()) return;
          onAdd({ name: name.trim(), area: area.trim(), url: url.trim() });
          setName("");
          setArea("");
          setUrl("");
        }}
        style={{
          border: `1px solid ${INK}`,
          background: "none",
          color: INK,
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Add
      </button>
    </div>
  );
}

function EditableBlock({ label, value, onChange, mono }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: SLATE,
          }}
        >
          {label}
        </span>
        <button
          onClick={() => {
            if (editing) onChange(draft);
            setEditing(!editing);
          }}
          style={{
            border: "none",
            background: "none",
            color: CARDINAL,
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {editing ? "Save" : "Edit"}
        </button>
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            border: `1px solid ${LINE}`,
            borderRadius: 6,
            padding: 8,
            fontSize: 13.5,
            fontFamily: "'Public Sans', sans-serif",
            marginTop: 4,
            boxSizing: "border-box",
          }}
        />
      ) : (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: value ? INK : "#A9B0A7",
            fontFamily: mono ? "'IBM Plex Mono', monospace" : "'Public Sans', sans-serif",
            whiteSpace: "pre-wrap",
          }}
        >
          {value || "Not recorded yet — run AI research or edit."}
        </p>
      )}
    </div>
  );
}

/* ---------------- API key panel ---------------- */
function KeyPanel({ apiKey, onSave, onClear, onClose }) {
  const [draft, setDraft] = useState(apiKey);
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${INK}`,
        borderRadius: 10,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          color: SLATE,
          marginBottom: 8,
        }}
      >
        ANTHROPIC API KEY — POWERS AI RESEARCH
      </div>
      <input
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="sk-ant-…"
        style={{
          width: "100%",
          border: `1px solid ${LINE}`,
          borderRadius: 6,
          padding: "8px 10px",
          fontSize: 13,
          fontFamily: "'IBM Plex Mono', monospace",
          background: "#FBFBF9",
          marginBottom: 10,
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            onSave(draft.trim());
            onClose();
          }}
          style={{
            background: INK,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "7px 14px",
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          Save key
        </button>
        <button
          onClick={() => {
            setDraft("");
            onClear();
          }}
          style={{
            background: "none",
            border: `1px solid ${LINE}`,
            color: SLATE,
            borderRadius: 6,
            padding: "7px 12px",
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          Clear
        </button>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: SLATE,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: SLATE, lineHeight: 1.6, marginTop: 10, marginBottom: 0 }}>
        Get a key at console.anthropic.com → API keys. It is stored only in this
        browser's localStorage and sent only to api.anthropic.com. Without a key you
        can still track everything manually.
      </p>
    </div>
  );
}

/* ---------------- main app ---------------- */
export default function App() {
  const [programs, setPrograms] = useState(loadPrograms);
  const [activeId, setActiveId] = useState(() => loadPrograms()[0]?.id ?? null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORE) || "");
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [uni, setUni] = useState("");
  const [prog, setProg] = useState("");
  const [researching, setResearching] = useState({});
  const [banner, setBanner] = useState(null);

  /* persist on every change */
  useEffect(() => {
    if (!savePrograms(programs)) {
      setBanner({ kind: "error", text: "Could not save to browser storage — changes may be lost on reload." });
    }
  }, [programs]);

  const active = programs.find((p) => p.id === activeId) || null;

  const update = (id, patch) =>
    setPrograms((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addProgram = () => {
    if (!uni.trim() || !prog.trim()) return;
    const p = emptyProgram(uni, prog);
    setPrograms((ps) => [p, ...ps]);
    setActiveId(p.id);
    setUni("");
    setProg("");
  };

  const removeProgram = (id) => {
    setPrograms((ps) => {
      const next = ps.filter((p) => p.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const saveKey = (k) => {
    setApiKey(k);
    try {
      localStorage.setItem(KEY_STORE, k);
    } catch {
      /* storage unavailable */
    }
  };
  const clearKey = () => {
    setApiKey("");
    try {
      localStorage.removeItem(KEY_STORE);
    } catch {
      /* storage unavailable */
    }
  };

  const runResearch = async (p) => {
    if (!apiKey) {
      setShowKeyPanel(true);
      setBanner({ kind: "error", text: "Add your Anthropic API key first — AI research needs it. Everything else works without one." });
      return;
    }
    setResearching((r) => ({ ...r, [p.id]: true }));
    setBanner(null);
    try {
      const res = await researchWithAI(apiKey, p.university, p.program);
      update(p.id, {
        professors: Array.isArray(res.professors) ? res.professors : p.professors,
        students: Array.isArray(res.students) ? res.students : p.students,
        deadline: res.deadline || p.deadline,
        fee: res.fee || p.fee,
        feeWaiver: res.feeWaiver || p.feeWaiver,
        selection: res.selection || p.selection,
        placements: res.placements || p.placements,
        sources: Array.isArray(res.sources) ? res.sources : p.sources,
        lastResearched: new Date().toISOString().slice(0, 10),
      });
      setBanner({ kind: "ok", text: `Research updated for ${p.university}. Verify details on official pages before applying.` });
    } catch (e) {
      setBanner({ kind: "error", text: `Research failed (${e.message}). Try again, or fill fields manually with Edit.` });
    }
    setResearching((r) => ({ ...r, [p.id]: false }));
  };

  const dleft = active ? daysUntil(active.deadline) : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: PAPER,
        color: INK,
        fontFamily: "'Public Sans', sans-serif",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        .dossier-grid { display: grid; grid-template-columns: 290px 1fr; gap: 24px; }
        @media (max-width: 820px) { .dossier-grid { grid-template-columns: 1fr; } }
        a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 2px solid ${CARDINAL}; outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        .prog-item:hover { background: #EFF1EB; }
      `}</style>

      {/* header */}
      <header
        style={{
          borderBottom: `2px solid ${INK}`,
          padding: "22px 20px 16px",
          maxWidth: 1160,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontWeight: 700,
                fontSize: 30,
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              PhD Dossier
            </h1>
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11.5,
                color: SLATE,
                letterSpacing: "0.06em",
              }}
            >
              {programs.length} PROGRAM{programs.length === 1 ? "" : "S"} TRACKED
            </span>
          </div>
          <button
            onClick={() => setShowKeyPanel((v) => !v)}
            style={{
              background: "none",
              border: `1px solid ${apiKey ? "#2F5D3A" : LINE}`,
              color: apiKey ? "#2F5D3A" : SLATE,
              borderRadius: 999,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {apiKey ? "● API key set" : "○ Set API key"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "20px 20px 60px" }}>
        {showKeyPanel && (
          <KeyPanel
            apiKey={apiKey}
            onSave={saveKey}
            onClear={clearKey}
            onClose={() => setShowKeyPanel(false)}
          />
        )}

        {banner && (
          <div
            role="status"
            style={{
              background: banner.kind === "ok" ? "#E7EFE8" : "#F4E6E6",
              color: banner.kind === "ok" ? "#2F5D3A" : CARDINAL,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>{banner.text}</span>
            <button
              onClick={() => setBanner(null)}
              style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        <div className="dossier-grid">
          {/* -------- sidebar -------- */}
          <aside>
            <div
              style={{
                background: CARD,
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  color: SLATE,
                  marginBottom: 8,
                }}
              >
                ADD A PROGRAM
              </div>
              <input
                value={uni}
                onChange={(e) => setUni(e.target.value)}
                placeholder="University (e.g., Stanford)"
                style={{
                  width: "100%",
                  border: `1px solid ${LINE}`,
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontSize: 13.5,
                  marginBottom: 8,
                  background: "#FBFBF9",
                }}
              />
              <input
                value={prog}
                onChange={(e) => setProg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addProgram()}
                placeholder="Program (e.g., CS PhD)"
                style={{
                  width: "100%",
                  border: `1px solid ${LINE}`,
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontSize: 13.5,
                  marginBottom: 10,
                  background: "#FBFBF9",
                }}
              />
              <button
                onClick={addProgram}
                style={{
                  width: "100%",
                  background: INK,
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "9px 0",
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: "pointer",
                }}
              >
                Add to dossier
              </button>
            </div>

            {programs.map((p) => {
              const s = STATUSES.find((x) => x.id === p.status) || STATUSES[0];
              const dl = daysUntil(p.deadline);
              return (
                <button
                  key={p.id}
                  className="prog-item"
                  onClick={() => setActiveId(p.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: p.id === activeId ? CARD : "transparent",
                    border: p.id === activeId ? `1px solid ${INK}` : `1px solid ${LINE}`,
                    borderLeft: `4px solid ${p.id === activeId ? CARDINAL : LINE}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    marginBottom: 8,
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15 }}>
                    {p.university}
                  </div>
                  <div style={{ fontSize: 12.5, color: SLATE }}>{p.program}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: s.bg,
                        color: s.fg,
                        borderRadius: 999,
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "2px 8px",
                      }}
                    >
                      {s.label}
                    </span>
                    {dl !== null && (
                      <span
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 10.5,
                          color: dl < 30 ? CARDINAL : BRASS,
                          fontWeight: 500,
                        }}
                      >
                        {dl >= 0 ? `${dl}d left` : "passed"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </aside>

          {/* -------- active dossier -------- */}
          <section>
            {!active ? (
              <div
                style={{
                  border: `1px dashed ${LINE}`,
                  borderRadius: 10,
                  padding: "60px 24px",
                  textAlign: "center",
                  color: SLATE,
                }}
              >
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: INK, marginBottom: 6 }}>
                  Your dossier is empty
                </div>
                <div style={{ fontSize: 13.5 }}>
                  Add a university and program on the left, then run AI research to pull
                  faculty, students, deadlines, waivers, and placements from the web.
                </div>
              </div>
            ) : (
              <div>
                {/* folder tab — signature element */}
                <div
                  style={{
                    display: "inline-block",
                    background: CARD,
                    border: `1px solid ${LINE}`,
                    borderBottom: "none",
                    borderRadius: "10px 10px 0 0",
                    padding: "8px 18px 6px",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    color: SLATE,
                    marginLeft: 18,
                  }}
                >
                  FILE · {active.university.toUpperCase().slice(0, 24)}
                </div>
                <div
                  style={{
                    background: CARD,
                    border: `1px solid ${LINE}`,
                    borderRadius: 10,
                    padding: "22px 24px 28px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          fontFamily: "'Fraunces', serif",
                          fontSize: 26,
                          fontWeight: 700,
                          margin: "0 0 2px",
                        }}
                      >
                        {active.university}
                      </h2>
                      <div style={{ fontSize: 15, color: SLATE }}>{active.program}</div>
                      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <StatusPill status={active.status} onChange={(v) => update(active.id, { status: v })} />
                        <button
                          onClick={() => runResearch(active)}
                          disabled={!!researching[active.id]}
                          style={{
                            background: researching[active.id] ? "#C9CFC6" : CARDINAL,
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "7px 14px",
                            fontWeight: 600,
                            fontSize: 12.5,
                            cursor: researching[active.id] ? "wait" : "pointer",
                          }}
                        >
                          {researching[active.id]
                            ? "Researching the web…"
                            : active.lastResearched
                            ? "Refresh AI research"
                            : "Run AI research"}
                        </button>
                        <button
                          onClick={() => removeProgram(active.id)}
                          style={{
                            background: "none",
                            border: `1px solid ${LINE}`,
                            color: SLATE,
                            borderRadius: 6,
                            padding: "7px 12px",
                            fontSize: 12.5,
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      {active.lastResearched && (
                        <div
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: 10.5,
                            color: "#9AA39A",
                            marginTop: 8,
                          }}
                        >
                          last researched {active.lastResearched}
                        </div>
                      )}
                    </div>

                    {/* deadline stamp */}
                    <div
                      style={{
                        border: `2px dashed ${dleft !== null && dleft < 30 ? CARDINAL : BRASS}`,
                        color: dleft !== null && dleft < 30 ? CARDINAL : BRASS,
                        borderRadius: 8,
                        padding: "10px 16px",
                        transform: "rotate(-2deg)",
                        textAlign: "center",
                        fontFamily: "'IBM Plex Mono', monospace",
                        minWidth: 130,
                      }}
                    >
                      <div style={{ fontSize: 10, letterSpacing: "0.12em" }}>DEADLINE</div>
                      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>
                        {active.deadline || "—"}
                      </div>
                      {dleft !== null && (
                        <div style={{ fontSize: 11, marginTop: 2 }}>
                          {dleft >= 0 ? `${dleft} days remain` : "date passed"}
                        </div>
                      )}
                    </div>
                  </div>

                  <SectionHead>Application details</SectionHead>
                  <EditableBlock label="Deadline" value={active.deadline} onChange={(v) => update(active.id, { deadline: v })} mono />
                  <EditableBlock label="Application fee" value={active.fee} onChange={(v) => update(active.id, { fee: v })} mono />
                  <EditableBlock label="Fee waiver" value={active.feeWaiver} onChange={(v) => update(active.id, { feeWaiver: v })} />

                  <SectionHead>Faculty</SectionHead>
                  {active.professors.length === 0 && (
                    <div style={{ fontSize: 13, color: "#A9B0A7" }}>No professors recorded yet.</div>
                  )}
                  {active.professors.map((pr, i) => (
                    <PersonRow
                      key={i}
                      person={pr}
                      onDelete={() =>
                        update(active.id, { professors: active.professors.filter((_, j) => j !== i) })
                      }
                    />
                  ))}
                  <AddPersonForm withArea onAdd={(pp) => update(active.id, { professors: [...active.professors, pp] })} />

                  <SectionHead>Current PhD students</SectionHead>
                  {active.students.length === 0 && (
                    <div style={{ fontSize: 13, color: "#A9B0A7" }}>No students recorded yet.</div>
                  )}
                  {active.students.map((st, i) => (
                    <PersonRow
                      key={i}
                      person={st}
                      onDelete={() =>
                        update(active.id, { students: active.students.filter((_, j) => j !== i) })
                      }
                    />
                  ))}
                  <AddPersonForm onAdd={(pp) => update(active.id, { students: [...active.students, pp] })} />

                  <SectionHead>Selection profile</SectionHead>
                  <EditableBlock
                    label="Past selection highlights / requirements"
                    value={active.selection}
                    onChange={(v) => update(active.id, { selection: v })}
                  />

                  <SectionHead>PhD placements</SectionHead>
                  <EditableBlock
                    label="Where graduates land"
                    value={active.placements}
                    onChange={(v) => update(active.id, { placements: v })}
                  />

                  <SectionHead>My notes</SectionHead>
                  <EditableBlock label="Notes" value={active.notes} onChange={(v) => update(active.id, { notes: v })} />

                  {active.sources.length > 0 && (
                    <>
                      <SectionHead>Sources</SectionHead>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {active.sources.map((s, i) => (
                          <a
                            key={i}
                            href={s}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                              fontSize: 11,
                              color: SLATE,
                              border: `1px solid ${LINE}`,
                              borderRadius: 999,
                              padding: "3px 10px",
                              textDecoration: "none",
                            }}
                          >
                            {hostOf(s)}
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        <footer
          style={{
            marginTop: 28,
            fontSize: 11.5,
            color: "#9AA39A",
            fontFamily: "'IBM Plex Mono', monospace",
            lineHeight: 1.6,
          }}
        >
          AI research pulls from public web sources — department pages, Google Scholar,
          LinkedIn, X, and personal sites. Some social profiles are login-gated and may
          not surface. Always confirm deadlines and fees on the official admissions page.
          Data lives in this browser's localStorage.
        </footer>
      </main>
    </div>
  );
}
