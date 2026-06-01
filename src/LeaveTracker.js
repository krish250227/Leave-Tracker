import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

const API = "http://localhost:4000";

const STATUS_CONFIG = {
  present:   { label: "Present",         short: "P",   bg: "#d4edda", text: "#155724", val: 1,   leave: 0   },
  absent:    { label: "Absent",          short: "A",   bg: "#f8d7da", text: "#721c24", val: -1,  leave: 1   },
  halfday:   { label: "Half Day",        short: "HD",  bg: "#fff3cd", text: "#856404", val: 0.5, leave: 0.5 },
  wfh:       { label: "Work From Home",  short: "WFH", bg: "#d1ecf1", text: "#0c5460", val: 1,   leave: 0   },
  sick:      { label: "Sick Leave",      short: "SL",  bg: "#e2d9f3", text: "#5a2a82", val: -1,  leave: 1   },
  planned:   { label: "Planned Leave",   short: "PL",  bg: "#d1f2eb", text: "#0e6655", val: -1,  leave: 1   },
  unplanned: { label: "Unplanned Leave", short: "UPL", bg: "#f8d7da", text: "#721c24", val: -1,  leave: 1   },
  holiday:   { label: "Holiday",         short: "HOL", bg: "#fff4e5", text: "#cc8800", val: 0,   leave: 0   },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function today() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

export default function LeaveTracker({ onSwitchView, isViewOnly = false, onLogout }) {
  const t = today();
  const [viewYear, setViewYear] = useState(t.year);
  const [viewMonth, setViewMonth] = useState(t.month);
  const [entries, setEntries] = useState({});
  const [employees, setEmployees] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [filterEmp, setFilterEmp] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalFilter, setModalFilter] = useState(null);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [newEmpName, setNewEmpName] = useState("");
  const [empError, setEmpError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/employees`)
      .then(r => r.json())
      .then(setEmployees)
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/attendance?year=${viewYear}&month=${viewMonth}`)
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, [viewYear, viewMonth]);

  const days = getDaysInMonth(viewYear, viewMonth);
  const allDayNums = Array.from({ length: days }, (_, i) => i + 1);
  const isCurrentMonth = viewYear === t.year && viewMonth === t.month;

  const key = useCallback(
    (emp, day) => `${emp}__${viewYear}-${viewMonth}-${day}`,
    [viewYear, viewMonth]
  );

  const empLeave = useMemo(() => {
    const totals = {};
    employees.forEach(emp => {
      let leave = 0;
      allDayNums.forEach(d => {
        const s = entries[key(emp, d)];
        if (s) leave += STATUS_CONFIG[s].leave;
      });
      totals[emp] = leave;
    });
    return totals;
  }, [entries, employees, allDayNums, key]);

  const totalStats = useMemo(() => {
    let present = 0, leave = 0, wfh = 0, flagged = 0;
    if (isCurrentMonth) {
      employees.forEach(emp => {
        const s = entries[key(emp, t.day)];
        if (s === "present") present++;
        if (s === "wfh") wfh++;
        if (STATUS_CONFIG[s]?.leave > 0) leave++;
        if (empLeave[emp] > 2) flagged++;
      });
    }
    return { present, leave, wfh, flagged };
  }, [entries, employees, isCurrentMonth, empLeave, allDayNums, key, t.day]);

  const modalEmployees = useMemo(() => {
    if (!modalFilter) return [];
    return employees.filter(emp => {
      const s = entries[key(emp, t.day)];
      if (modalFilter === "present") return s === "present";
      if (modalFilter === "wfh") return s === "wfh";
      if (modalFilter === "leave") return STATUS_CONFIG[s]?.leave > 0;
      if (modalFilter === "flagged") return empLeave[emp] > 2;
      return false;
    });
  }, [modalFilter, entries, employees, empLeave, key, t.day]);

  let visibleEmployees = filterEmp === "all" ? employees : [filterEmp];
  visibleEmployees = searchQuery
    ? visibleEmployees.filter(emp => emp.toLowerCase().startsWith(searchQuery.toLowerCase()))
    : visibleEmployees;

  function addEmployee() {
    const name = newEmpName.trim();
    if (!name) return setEmpError("Name cannot be empty");
    fetch(`${API}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(r => r.json()).then(d => {
      if (d.error) return setEmpError(d.error);
      setEmployees(prev => [...prev, name]);
      setNewEmpName("");
      setEmpError("");
    }).catch(console.error);
  }

  function removeEmployee(name) {
    fetch(`${API}/employees/${encodeURIComponent(name)}`, { method: "DELETE" })
      .then(() => setEmployees(prev => prev.filter(e => e !== name)))
      .catch(console.error);
  }

  function setStatus(emp, day, status) {
    const k = key(emp, day);
    setEntries(prev => {
      if (status === null) { const next = { ...prev }; delete next[k]; return next; }
      return { ...prev, [k]: status };
    });
    setSelectedCell(null);
    fetch(`${API}/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: k, status }),
    }).catch(console.error);
  }

  const getDayOfWeek = (day) => new Date(viewYear, viewMonth, day).getDay();
  const isWeekend = (day) => { const d = getDayOfWeek(day); return d === 0 || d === 6; };
  const dayLabel = (day) => ["Su","Mo","Tu","We","Th","Fr","Sa"][getDayOfWeek(day)];

  const handleMonthChange = (e) => {
    const [year, month] = e.target.value.split("-").map(Number);
    setViewYear(year);
    setViewMonth(month);
  };

  const STAT_CARDS = [
    { label: "Present", val: totalStats.present, color: "#28a745", filter: "present" },
    { label: "Leave",   val: totalStats.leave,   color: "#dc3545", filter: "leave" },
    { label: "WFH",     val: totalStats.wfh,     color: "#17a2b8", filter: "wfh" },
    { label: "Flagged", val: totalStats.flagged, color: "#fd7e14", filter: "flagged" },
  ];

  return (
    <div style={styles.root}>
      <div style={styles.noise} />

      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTag}>ATTENDANCE MANAGEMENT FOR TEAM NTH ♡</div>
          <h1 style={styles.title}>Leave Tracker</h1>
        </div>
        <div style={styles.statsRow}>
          {STAT_CARDS.map(s => (
            <div
              key={s.label}
              style={{
                ...styles.statCard,
                cursor: isCurrentMonth ? "pointer" : "default",
                opacity: isCurrentMonth ? 1 : 0.5,
              }}
              onClick={() => isCurrentMonth && setModalFilter(s.filter)}
            >
              <div style={{ ...styles.statVal, color: s.color }}>{s.val}</div>
              <div style={styles.statLabel}>{s.label} Today</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <select
          style={styles.select}
          value={`${viewYear}-${viewMonth}`}
          onChange={handleMonthChange}
        >
          {Array.from({ length: 24 }, (_, i) => {
            const date = new Date(t.year, t.month - 12 + i);
            const y = date.getFullYear();
            const m = date.getMonth();
            return (
              <option key={`${y}-${m}`} value={`${y}-${m}`}>
                {MONTHS[m]} {y}
              </option>
            );
          })}
        </select>

        <select style={styles.select} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
          <option value="all">All Employees</option>
          {employees.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <input
          type="text"
          placeholder="Search employees..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />

        <button style={styles.tabBtn} onClick={() => { setShowEmpModal(true); setEmpError(""); }} disabled={isViewOnly}>👤 Manage</button>
        <button style={styles.tabBtn} onClick={onSwitchView}>🔄 Scrum</button>
        <button style={{ ...styles.tabBtn, marginLeft: "auto" }} onClick={onLogout}>
          {isViewOnly ? "🔓 Login" : "🚪 Logout"}
        </button>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <span key={k} style={{ ...styles.legendItem, background: v.bg, color: v.text }}>
            {v.short}
          </span>
        ))}
        <span style={{ color: "#888", fontSize: 11 }}>· click a cell to set status · flag = leave &gt; 2 days</span>
      </div>

      {loading && <div style={styles.loadingBar} />}

      {/* Grid */}
      <div style={styles.gridWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.empCol, position: "sticky", left: 0, zIndex: 3, background: "#e8e8e8" }}>Employee</th>
              {allDayNums.map(d => (
                <th key={d} style={{
                  ...styles.th, ...styles.dayCol,
                  ...(isWeekend(d) ? { background: "#ddd" } : {}),
                  ...(d === t.day && isCurrentMonth ? { color: "#f59e0b", background: "#f5f0dc" } : {}),
                }}>
                  <div style={{ fontSize: 9, color: "#666", marginBottom: 1 }}>{dayLabel(d)}</div>
                  {d}
                </th>
              ))}
              <th style={{ ...styles.th, ...styles.sumCol }}>Leave</th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map(emp => {
              const leave = empLeave[emp] ?? 0;
              const flagged = leave > 2;
              return (
                <tr key={emp} style={styles.tr}>
                  <td style={{ ...styles.td, ...styles.empCol, position: "sticky", left: 0, zIndex: 1, background: "#efefef" }}>
                    <div style={styles.empName}>
                      <div style={{ ...styles.avatar, background: stringToColor(emp) }}>
                        {emp.split(" ").map(n => n[0]).join("")}
                      </div>
                      <span style={{ fontSize: 12 }}>{emp.split(" ")[0]}</span>
                    </div>
                  </td>
                  {allDayNums.map(d => {
                    const s = entries[key(emp, d)];
                    const cfg = s ? STATUS_CONFIG[s] : null;
                    const isSelected = selectedCell?.emp === emp && selectedCell?.day === d;
                    return (
                      <td
                        key={d}
                        style={{
                          ...styles.td, ...styles.dayCol,
                          background: cfg ? cfg.bg : isWeekend(d) ? "#ddd" : "transparent",
                          cursor: isViewOnly ? "default" : "pointer",
                          outline: isSelected ? "1px solid #f59e0b" : "none",
                          position: "relative",
                          zIndex: isSelected ? 20 : "auto",
                        }}
                        onClick={e => {
                          if (isViewOnly) return;
                          if (isSelected) { setSelectedCell(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const centerX = rect.left + rect.width / 2;
                          const bottomY = rect.bottom + 4;
                          const topY = rect.top - 4;
                          const flipUp = window.innerHeight - bottomY < 250;
                          setSelectedCell({ emp, day: d, x: centerX, y: flipUp ? topY : bottomY, flipUp });
                        }}
                      >
                        {cfg && (
                          <span style={{ fontSize: 9, color: cfg.text, fontWeight: 700, letterSpacing: 0.3 }}>
                            {cfg.short}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ ...styles.td, ...styles.sumCol }}>
                    <span style={{
                      ...styles.sumBadge,
                      color: flagged ? "#721c24" : leave > 0 ? "#856404" : "#155724",
                      background: flagged ? "#f8d7da" : leave > 0 ? "#fff3cd" : "#d4edda",
                    }}>
                      {leave.toFixed(0)}
                      {flagged && <span style={styles.flagDot}>!</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Manage Employees Modal */}
      {showEmpModal && createPortal(
        <div style={styles.modalOverlay} onMouseDown={() => setShowEmpModal(false)}>
          <div style={styles.modalBox} onMouseDown={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#222" }}>Manage Employees</span>
              <button style={styles.modalClose} onClick={() => setShowEmpModal(false)}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Full name..."
                value={newEmpName}
                onChange={e => { setNewEmpName(e.target.value); setEmpError(""); }}
                onKeyDown={e => e.key === "Enter" && addEmployee()}
                style={{ ...styles.searchInput, flex: 1, minWidth: 0 }}
              />
              <button style={{ ...styles.tabBtn, background: "#1a3a2a", color: "#4ade80", border: "none" }} onClick={addEmployee}>+ Add</button>
            </div>
            {empError && <div style={{ color: "#f87171", fontSize: 11, marginBottom: 8 }}>{empError}</div>}
            {employees.map(emp => (
              <div key={emp} style={styles.modalRow}>
                <div style={{ ...styles.avatar, background: stringToColor(emp) }}>
                  {emp.split(" ").map(n => n[0]).join("")}
                </div>
                <span style={{ fontSize: 13, color: "#222", flex: 1 }}>{emp}</span>
                <button
                  style={{ background: "none", border: "1px solid #f87171", color: "#f87171", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}
                  onClick={() => removeEmployee(emp)}
                >Remove</button>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Stat Modal */}
      {modalFilter && createPortal(
        <div style={styles.modalOverlay} onClick={() => setModalFilter(null)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={{ color: STAT_CARDS.find(s => s.filter === modalFilter)?.color, fontWeight: 700, fontSize: 14 }}>
                {STAT_CARDS.find(s => s.filter === modalFilter)?.label} Today — {t.day} {MONTHS[t.month]} {t.year}
              </span>
              <button style={styles.modalClose} onClick={() => setModalFilter(null)}>✕</button>
            </div>
            {modalEmployees.length === 0
              ? <div style={{ color: "#888", fontSize: 12, padding: "12px 0" }}>No employees</div>
              : modalEmployees.map(emp => (
                <div key={emp} style={styles.modalRow}>
                  <div style={{ ...styles.avatar, background: stringToColor(emp) }}>
                    {emp.split(" ").map(n => n[0]).join("")}
                  </div>
                  <span style={{ fontSize: 13, color: "#222" }}>{emp}</span>
                </div>
              ))
            }
          </div>
        </div>,
        document.body
      )}

      {/* Cell Status Picker */}
      {selectedCell && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onMouseDown={() => setSelectedCell(null)} />
          <StatusPicker
            x={selectedCell.x}
            y={selectedCell.y}
            flipUp={selectedCell.flipUp}
            current={entries[key(selectedCell.emp, selectedCell.day)]}
            onSelect={st => setStatus(selectedCell.emp, selectedCell.day, st)}
            onClear={() => setStatus(selectedCell.emp, selectedCell.day, null)}
          />
        </>,
        document.body
      )}
    </div>
  );
}

function StatusPicker({ x, y, flipUp, onSelect, onClear, current }) {
  return (
    <div
      style={{
        ...styles.picker,
        position: "fixed",
        left: x,
        top: flipUp ? "auto" : y,
        bottom: flipUp ? window.innerHeight - y : "auto",
        transform: "translateX(-50%)",
        zIndex: 1000,
      }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
        <button
          key={k}
          style={{
            ...styles.pickerBtn,
            background: k === current ? v.bg : "transparent",
            color: k === current ? v.text : "#333",
            fontWeight: k === current ? 700 : 400,
          }}
          onClick={() => onSelect(k)}
        >
          {v.label}
        </button>
      ))}
      {current && (
        <button style={{ ...styles.pickerBtn, color: "#6b7280" }} onClick={onClear}>Clear</button>
      )}
    </div>
  );
}

function stringToColor(str) {
  const colors = ["#1a3a4a","#2a1a3a","#1a3a2a","#3a2a1a","#1a2a3a","#3a1a2a"];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

const styles = {
  root: {
    minHeight: "100vh", background: "#e0e0e0", color: "#1a1a1a",
    fontFamily: "'DM Mono', 'Fira Mono', 'Courier New', monospace",
    padding: "24px 20px", position: "relative", overflow: "hidden",
  },
  noise: {
    position: "fixed", inset: 0,
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
    pointerEvents: "none", zIndex: 0,
  },
  loadingBar: {
    position: "fixed", top: 0, left: 0, right: 0, height: 2,
    background: "linear-gradient(90deg, #4ade80, #60a5fa)", zIndex: 100,
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 20, flexWrap: "wrap", gap: 16, position: "relative", zIndex: 1,
  },
  headerTag: { fontSize: 10, letterSpacing: 3, color: "#777", marginBottom: 4, textTransform: "uppercase" },
  title: { fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: -0.5 },
  statsRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  statCard: {
    background: "#f0f0f0", border: "1px solid #ccc", borderRadius: 8,
    padding: "10px 18px", textAlign: "center", minWidth: 70,
    transition: "box-shadow 0.15s",
  },
  statVal: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 10, color: "#666", marginTop: 2, letterSpacing: 1 },
  controls: {
    display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
    marginBottom: 14, position: "relative", zIndex: 1,
  },
  select: {
    background: "#f0f0f0", border: "1px solid #ccc", borderRadius: 8,
    color: "#333", padding: "6px 12px", fontSize: 12, cursor: "pointer", outline: "none",
  },
  searchInput: {
    background: "#f0f0f0", border: "1px solid #ccc", borderRadius: 8,
    color: "#333", padding: "6px 12px", fontSize: 12, outline: "none", minWidth: 180,
  },
  tabBtn: {
    background: "none", border: "1px solid #ccc", borderRadius: 6,
    color: "#555", padding: "6px 14px", fontSize: 12, cursor: "pointer",
  },
  legend: {
    display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end",
    marginBottom: 14, position: "relative", zIndex: 1,
  },
  legendItem: { fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 700, letterSpacing: 0.5 },
  gridWrap: { overflowX: "auto", border: "1px solid #000", borderRadius: 10, position: "relative", zIndex: 1, width: "100%" },
  table: { borderCollapse: "collapse", width: "auto" },
  th: {
    padding: "8px 4px", textAlign: "center", fontSize: 11, color: "#555",
    fontWeight: 500, borderBottom: "1px solid #000", borderRight: "1px solid #000",
    background: "#e8e8e8",
  },
  empCol: { minWidth: 130, textAlign: "left", padding: "8px 12px" },
  dayCol: { width: 32, minWidth: 32, maxWidth: 32 },
  sumCol: { minWidth: 70, width: 70 },
  tr: { borderBottom: "1px solid #000" },
  td: { padding: "5px 2px", textAlign: "center", fontSize: 10, borderRight: "1px solid #000", position: "relative" },
  empName: { display: "flex", alignItems: "center", gap: 8, color: "#333" },
  avatar: {
    width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0,
  },
  sumBadge: { display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: "1px solid currentColor" },
  flagDot: { display: "inline-block", fontSize: 10, fontWeight: 900, color: "#f87171" },
  picker: {
    background: "#ffffff", border: "1px solid #ddd", borderRadius: 8,
    minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", overflow: "hidden",
  },
  pickerBtn: {
    display: "block", width: "100%", padding: "7px 14px", textAlign: "left",
    border: "none", cursor: "pointer", fontSize: 11, borderBottom: "1px solid #f0f0f0",
    background: "transparent",
  },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  modalBox: {
    background: "#fff", borderRadius: 12, padding: "20px 24px", minWidth: 280,
    maxWidth: 400, boxShadow: "0 12px 40px rgba(0,0,0,0.2)", maxHeight: "70vh", overflowY: "auto",
  },
  modalHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
  },
  modalClose: {
    background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#888",
  },
  modalRow: {
    display: "flex", alignItems: "center", gap: 10, padding: "7px 0",
    borderBottom: "1px solid #f0f0f0",
  },
};
