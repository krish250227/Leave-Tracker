import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

const API = "http://localhost:4000";

const STATUS_CONFIG = {
  present:   { label: "Present",         short: "P",   bg: "#1a3a2a", text: "#4ade80", val: 1,   leave: 0   },
  absent:    { label: "Absent",          short: "A",   bg: "#3a1a1a", text: "#f87171", val: -1,  leave: 1   },
  halfday:   { label: "Half Day",        short: "HD",  bg: "#3a2e1a", text: "#fbbf24", val: 0.5, leave: 0.5 },
  wfh:       { label: "Work From Home",  short: "WFH", bg: "#1a2a3a", text: "#60a5fa", val: 1,   leave: 0   },
  sick:      { label: "Sick Leave",      short: "SL",  bg: "#2e1a3a", text: "#c084fc", val: -1,  leave: 1   },
  planned:   { label: "Planned Leave",   short: "PL",  bg: "#1a3a2e", text: "#34d399", val: -1,  leave: 1   },
  unplanned: { label: "Unplanned Leave", short: "UPL", bg: "#2a1800", text: "#d97706", val: -1,  leave: 1   },
  holiday:   { label: "Holiday",         short: "HOL", bg: "#2e1f10", text: "#c8a97e", val: 0,   leave: 0   },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function today() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

export default function LeaveTracker({ onSwitchView }) {
  const t = today();
  const [viewYear, setViewYear] = useState(t.year);
  const [viewMonth, setViewMonth] = useState(t.month);
  // null = default (start from today), true = user explicitly picked a month (show full)
  const [showFullMonth, setShowFullMonth] = useState(false);
  const [entries, setEntries] = useState({});
  const [employees, setEmployees] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [filterEmp, setFilterEmp] = useState("all");
  const [tab, setTab] = useState("grid");
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

  // If viewing current month and user hasn't manually picked a month, start from today
  const isCurrentMonth = viewYear === t.year && viewMonth === t.month;
  const dayNums = (!showFullMonth && isCurrentMonth)
    ? allDayNums.filter(d => d >= t.day)
    : allDayNums;

  const visibleEmployees = filterEmp === "all" ? employees : [filterEmp];

  const key = useCallback(
    (emp, day) => `${emp}__${viewYear}-${viewMonth}-${day}`,
    [viewYear, viewMonth]
  );

  function setStatus(emp, day, status) {
    const k = key(emp, day);
    setEntries(prev => {
      if (status === null) {
        const next = { ...prev }; delete next[k]; return next;
      }
      return { ...prev, [k]: status };
    });
    setSelectedCell(null);

    fetch(`${API}/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: k, status }),
    }).catch(console.error);
  }

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
  }, [entries, viewYear, viewMonth, days, employees]);

  const getDayOfWeek = (day) => new Date(viewYear, viewMonth, day).getDay();
  const isWeekend = (day) => { const d = getDayOfWeek(day); return d === 0 || d === 6; };
  const dayLabel = (day) => ["Su","Mo","Tu","We","Th","Fr","Sa"][getDayOfWeek(day)];

  const listEntries = useMemo(() => {
    return Object.entries(entries)
      .map(([k, status]) => {
        const [emp, dateStr] = k.split("__");
        const [y, m, d] = dateStr.split("-").map(Number);
        return { emp, year: y, month: m, day: d, status, key: k };
      })
      .filter(e => e.year === viewYear && e.month === viewMonth)
      .filter(e => filterEmp === "all" || e.emp === filterEmp)
      .sort((a, b) => a.day - b.day || a.emp.localeCompare(b.emp));
  }, [entries, viewYear, viewMonth, filterEmp]);

  const totalStats = useMemo(() => {
    let present = 0, leave = 0, wfh = 0, flagged = 0;
    employees.forEach(emp => {
      allDayNums.forEach(d => {
        const s = entries[key(emp, d)];
        if (s === "present") present++;
        if (s === "wfh") wfh++;
        if (STATUS_CONFIG[s]?.leave > 0) leave++;
      });
      if (empLeave[emp] > 2) flagged++;
    });
    return { present, leave, wfh, flagged };
  }, [entries, viewYear, viewMonth, days, employees]);

  const prevMonth = () => {
    setShowFullMonth(true);
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    setShowFullMonth(true);
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div style={styles.root}>
      <div style={styles.noise} />

      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTag}>ATTENDANCE MANAGEMENT FOR TEAM NTH ♡</div>
          <h1 style={styles.title}>Leave Tracker </h1>
        </div>
        <div style={styles.statsRow}>
          {[
            { label: "Present", val: totalStats.present, color: "#4ade80" },
            { label: "Leave",   val: totalStats.leave,   color: "#f87171" },
            { label: "WFH",     val: totalStats.wfh,     color: "#60a5fa" },
            { label: "Flagged", val: totalStats.flagged, color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} style={styles.statCard}>
              <div style={{ ...styles.statVal, color: s.color }}>{s.val}</div>
              <div style={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.monthNav}>
          <button style={styles.navBtn} onClick={prevMonth}>‹</button>
          <span style={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</span>
          <button style={styles.navBtn} onClick={nextMonth}>›</button>
        </div>

        <select id="emp-filter" style={styles.select} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
          <option value="all">All Employees</option>
          {employees.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <div style={styles.tabGroup}>
          {["grid","list"].map(t2 => (
            <button
              key={t2}
              style={{ ...styles.tabBtn, ...(tab === t2 ? styles.tabBtnActive : {}) }}
              onClick={() => setTab(t2)}
            >
              {t2 === "grid" ? "⊞ Grid" : "≡ List"}
            </button>
          ))}
          <button style={{ ...styles.tabBtn, marginLeft: 8 }} onClick={onSwitchView}>
            🔄 Scrum
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <span key={k} style={{ ...styles.legendItem, background: v.bg, color: v.text }}>
            {v.short}
          </span>
        ))}
        <span style={{ color: "#6b7280", fontSize: 11 }}>· click a cell to set status · flag = leave &gt; 2 days</span>
      </div>

      {loading && <div style={styles.loadingBar} />}

      {/* Grid View */}
      {tab === "grid" && (
        <div style={styles.gridWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.empCol, position: "sticky", left: 0, zIndex: 3, background: "#20203a" }}>Employee</th>
                {dayNums.map(d => (
                  <th key={d} style={{
                    ...styles.th, ...styles.dayCol,
                    ...(isWeekend(d) ? { background: "#2a2a48" } : {}),
                    ...(d === t.day && viewMonth === t.month && viewYear === t.year ? { color: "#f59e0b", background: "#2e2a1a" } : {}),
                  }}>
                    <div style={{ fontSize: 9, color: "#555", marginBottom: 1 }}>{dayLabel(d)}</div>
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
                    <td style={{ ...styles.td, ...styles.empCol, position: "sticky", left: 0, zIndex: 1, background: "#1a1a2e" }}>
                      <div style={styles.empName}>
                        <div style={{ ...styles.avatar, background: stringToColor(emp) }}>
                          {emp.split(" ").map(n => n[0]).join("")}
                        </div>
                        <span style={{ fontSize: 12 }}>{emp.split(" ")[0]}</span>
                      </div>
                    </td>
                    {dayNums.map(d => {
                      const s = entries[key(emp, d)];
                      const cfg = s ? STATUS_CONFIG[s] : null;
                      const isSelected = selectedCell?.emp === emp && selectedCell?.day === d;
                      return (
                        <td
                          key={d}
                          style={{
                            ...styles.td, ...styles.dayCol,
                            background: cfg ? cfg.bg : isWeekend(d) ? "#252540" : "transparent",
                            cursor: "pointer",
                            outline: isSelected ? "1px solid #f59e0b" : "none",
                            position: "relative",
                            zIndex: isSelected ? 20 : "auto",
                          }}
                          onClick={e => {
                            if (isSelected) { setSelectedCell(null); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const centerX = rect.left + rect.width / 2;
                            const bottomY = rect.bottom + 4;
                            const topY = rect.top - 4;
                            // Check if there's enough space below (assume picker height ~250px)
                            const spaceBelow = window.innerHeight - bottomY;
                            const flipUp = spaceBelow < 250;
                            setSelectedCell({ 
                              emp, 
                              day: d, 
                              x: centerX, 
                              y: flipUp ? topY : bottomY,
                              flipUp 
                            });
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
                        color: flagged ? "#f87171" : leave > 0 ? "#fbbf24" : "#4ade80",
                        background: flagged ? "#2a0e0e" : leave > 0 ? "#2a1f00" : "#0e2a14",
                      }}>
                        {leave.toFixed(1)}
                        {flagged && <span style={styles.flagDot} title="Leave > 2 days">!</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* List View */}
      {tab === "list" && (
        <div style={styles.listWrap}>
          {listEntries.length === 0 && (
            <div style={styles.empty}>No entries for {MONTHS[viewMonth]} {viewYear}</div>
          )}
          {listEntries.map(e => {
            const cfg = STATUS_CONFIG[e.status];
            const flagged = empLeave[e.emp] > 2;
            return (
              <div key={e.key} style={styles.listRow}>
                <div style={{ ...styles.avatar, background: stringToColor(e.emp), flexShrink: 0 }}>
                  {e.emp.split(" ").map(n => n[0]).join("")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5" }}>
                    {e.emp}
                    {flagged && <span style={{ marginLeft: 6, color: "#f87171", fontSize: 10 }}>▲ FLAGGED</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#555" }}>
                    {e.day} {MONTHS[viewMonth]} {viewYear}
                  </div>
                </div>
                <span style={{ ...styles.listBadge, background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                <button style={styles.delBtn} onClick={() => setStatus(e.emp, e.day, null)}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {selectedCell && createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            onMouseDown={() => setSelectedCell(null)}
          />
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
            color: v.text,
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
    minHeight: "100vh", background: "#1a1a2e", color: "#e5e5e5",
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
    background: "linear-gradient(90deg, #4ade80, #60a5fa)",
    zIndex: 100,
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 20, flexWrap: "wrap", gap: 16, position: "relative", zIndex: 1,
  },
  headerTag: { fontSize: 10, letterSpacing: 3, color: "#7a7a9a", marginBottom: 4, textTransform: "uppercase" },
  title: { fontSize: 28, fontWeight: 700, color: "#f0f0ff", letterSpacing: -0.5 },
  statsRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  statCard: {
    background: "#252540", border: "1px solid #3a3a5c", borderRadius: 8,
    padding: "10px 18px", textAlign: "center", minWidth: 70,
  },
  statVal: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 10, color: "#7a7a9a", marginTop: 2, letterSpacing: 1 },
  controls: {
    display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
    marginBottom: 14, position: "relative", zIndex: 1,
  },
  monthNav: {
    display: "flex", alignItems: "center", gap: 8, background: "#252540",
    border: "1px solid #3a3a5c", borderRadius: 8, padding: "4px 8px",
  },
  navBtn: { background: "none", border: "none", color: "#9a9ab8", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" },
  monthLabel: { fontSize: 13, fontWeight: 600, color: "#ddd", minWidth: 100, textAlign: "center" },
  select: {
    background: "#252540", border: "1px solid #3a3a5c", borderRadius: 8,
    color: "#ddd", padding: "6px 12px", fontSize: 12, cursor: "pointer", outline: "none",
  },
  tabGroup: { display: "flex", gap: 4 },
  tabBtn: {
    background: "none", border: "1px solid #3a3a5c", borderRadius: 6,
    color: "#7a7a9a", padding: "6px 14px", fontSize: 12, cursor: "pointer",
  },
  tabBtnActive: { background: "#2e2e50", color: "#ddd", borderColor: "#5a5a8a" },
  legend: {
    display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
    marginBottom: 14, position: "relative", zIndex: 1,
  },
  legendItem: { fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 700, letterSpacing: 0.5 },
  gridWrap: { overflowX: "auto", border: "1px solid #3a3a5c", borderRadius: 10, position: "relative", zIndex: 1, width: "100%" },
  table: { borderCollapse: "collapse", width: "auto" },
  th: {
    padding: "8px 4px", textAlign: "center", fontSize: 11, color: "#8a8aaa",
    fontWeight: 500, borderBottom: "1px solid #3a3a5c", borderRight: "1px solid #2e2e4e",
    background: "#20203a",
  },
  empCol: { minWidth: 130, textAlign: "left", padding: "8px 12px" },
  dayCol: { width: 32, minWidth: 32, maxWidth: 32 },
  sumCol: { minWidth: 70, width: 70 },
  tr: { borderBottom: "1px solid #2e2e4e" },
  td: { padding: "5px 2px", textAlign: "center", fontSize: 10, borderRight: "1px solid #2e2e4e", position: "relative" },
  empName: { display: "flex", alignItems: "center", gap: 8, color: "#ccc" },
  avatar: {
    width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#aaa", flexShrink: 0,
  },
  sumBadge: { display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 },
  flagDot: { display: "inline-block", fontSize: 10, fontWeight: 900, color: "#f87171" },
  picker: {
    background: "#252540", border: "1px solid #3a3a5c", borderRadius: 8,
    minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", overflow: "hidden",
  },
  pickerBtn: {
    display: "block", width: "100%", padding: "7px 14px", textAlign: "left",
    border: "none", cursor: "pointer", fontSize: 11, borderBottom: "1px solid #2e2e4e",
    background: "transparent",
  },
  listWrap: { display: "flex", flexDirection: "column", gap: 6, position: "relative", zIndex: 1 },
  listRow: {
    display: "flex", alignItems: "center", gap: 12, background: "#20203a",
    border: "1px solid #3a3a5c", borderRadius: 8, padding: "10px 14px",
  },
  listBadge: { fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600, flexShrink: 0 },
  delBtn: {
    background: "none", border: "1px solid #3a3a5c", color: "#7a7a9a",
    cursor: "pointer", borderRadius: 6, padding: "4px 8px", fontSize: 11,
  },
  empty: { textAlign: "center", color: "#5a5a7a", padding: "40px 0", fontSize: 13 },
};
