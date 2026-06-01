import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

const API = "http://localhost:4000";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const SCRUM_STATUS = {
  present: { label: "Present", short: "P", bg: "#d4edda", text: "#155724" },
  absent:  { label: "Absent",  short: "A", bg: "#f8d7da", text: "#721c24" },
};

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function today() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function stringToColor(str) {
  const colors = ["#1a3a4a","#2a1a3a","#1a3a2a","#3a2a1a","#1a2a3a","#3a1a2a"];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export default function ScrumTracker({ onSwitchView, isViewOnly = false, onLogout }) {
  const t = today();
  const [viewYear, setViewYear] = useState(t.year);
  const [viewMonth, setViewMonth] = useState(t.month);
  const [showFullMonth, setShowFullMonth] = useState(false);
  const [timePeriod, setTimePeriod] = useState("month");
  const [entries, setEntries] = useState({});
  const [employees, setEmployees] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [filterEmp, setFilterEmp] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/employees`).then(r => r.json()).then(setEmployees).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/scrum?year=${viewYear}&month=${viewMonth}`)
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, [viewYear, viewMonth]);

  const days = getDaysInMonth(viewYear, viewMonth);
  const allDayNums = Array.from({ length: days }, (_, i) => i + 1);
  const isCurrentMonth = viewYear === t.year && viewMonth === t.month;
  
  let dayNums = allDayNums;
  if (timePeriod === "week" && isCurrentMonth) {
    const currentDayOfWeek = new Date(t.year, t.month, t.day).getDay();
    const weekStart = t.day - currentDayOfWeek;
    const weekEnd = weekStart + 6;
    dayNums = allDayNums.filter(d => d >= Math.max(1, weekStart) && d <= Math.min(days, weekEnd));
  } else if (timePeriod === "month") {
    dayNums = (!showFullMonth && isCurrentMonth)
      ? allDayNums.filter(d => d >= t.day)
      : allDayNums;
  }

  const visibleEmployees = filterEmp === "all" ? employees : [filterEmp];
  const filteredEmployees = searchQuery
    ? visibleEmployees.filter(emp => emp.toLowerCase().includes(searchQuery.toLowerCase()))
    : visibleEmployees;

  const key = useCallback(
    (emp, day) => `${emp}__${viewYear}-${viewMonth}-${day}`,
    [viewYear, viewMonth]
  );

  function setStatus(emp, day, status) {
    const k = key(emp, day);
    setEntries(prev => {
      if (status === null) { const n = { ...prev }; delete n[k]; return n; }
      return { ...prev, [k]: status };
    });
    setSelectedCell(null);
    fetch(`${API}/scrum`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: k, status }),
    }).catch(console.error);
  }

  const empStats = useMemo(() => {
    const stats = {};
    employees.forEach(emp => {
      let present = 0, absent = 0;
      allDayNums.forEach(d => {
        const s = entries[key(emp, d)];
        if (s === "present") present++;
        if (s === "absent") absent++;
      });
      stats[emp] = { present, absent };
    });
    return stats;
  }, [entries, employees, allDayNums, key]);

  const totalStats = useMemo(() => {
    let present = 0, absent = 0;
    employees.forEach(emp => {
      present += empStats[emp]?.present ?? 0;
      absent += empStats[emp]?.absent ?? 0;
    });
    return { present, absent };
  }, [empStats, employees]);

  const getDayOfWeek = (day) => new Date(viewYear, viewMonth, day).getDay();
  const isWeekend = (day) => { const d = getDayOfWeek(day); return d === 0 || d === 6; };
  const dayLabel = (day) => ["Su","Mo","Tu","We","Th","Fr","Sa"][getDayOfWeek(day)];

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

  const handlePeriodChange = (period) => {
    setTimePeriod(period);
    setShowFullMonth(false);
    setViewYear(t.year);
    setViewMonth(t.month);
  };

  return (
    <div style={styles.root}>
      <div style={styles.noise} />

      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTag}>DAILY STANDUP</div>
          <h1 style={styles.title}>Scrum Attendance</h1>
        </div>
        <div style={styles.statsRow}>
          {[
            { label: "Present", val: totalStats.present, color: "#28a745" },
            { label: "Absent",  val: totalStats.absent,  color: "#dc3545" },
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
        <select id="scrum-time-period" style={styles.select} value={timePeriod} onChange={e => handlePeriodChange(e.target.value)}>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>

        <div style={styles.monthNav}>
          <button style={styles.navBtn} onClick={prevMonth}>‹</button>
          <span style={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</span>
          <button style={styles.navBtn} onClick={nextMonth}>›</button>
        </div>
        <select id="scrum-emp-filter" style={styles.select} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
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
        <button style={styles.switchBtn} onClick={onSwitchView}>📋 Leave</button>
        <button style={{ ...styles.switchBtn, marginLeft: "auto" }} onClick={onLogout}>
          {isViewOnly ? "🔓 Login" : "🚪 Logout"}
        </button>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(SCRUM_STATUS).map(([k, v]) => (
          <span key={k} style={{ ...styles.legendItem, background: v.bg, color: v.text }}>{v.short} — {v.label}</span>
        ))}
        <span style={{ color: "#666", fontSize: 11 }}>· click a cell to toggle</span>
      </div>

      {loading && <div style={styles.loadingBar} />}

      {/* Grid */}
      <div style={styles.gridWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.empCol, position: "sticky", left: 0, zIndex: 3, background: "#fafafa" }}>Employee</th>
              {dayNums.map(d => (
                <th key={d} style={{
                  ...styles.th, ...styles.dayCol,
                  ...(isWeekend(d) ? { background: "#f0f0f0" } : {}),
                  ...(d === t.day && isCurrentMonth ? { color: "#f59e0b", background: "#fff8e1" } : {}),
                }}>
                  <div style={{ fontSize: 9, color: "#7a7a9a", marginBottom: 1 }}>{dayLabel(d)}</div>
                  {d}
                </th>
              ))}
              <th style={{ ...styles.th, minWidth: 80 }}>P / A</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map(emp => {
              const { present, absent } = empStats[emp] ?? { present: 0, absent: 0 };
              return (
                <tr key={emp} style={styles.tr}>
                  <td style={{ ...styles.td, ...styles.empCol, position: "sticky", left: 0, zIndex: 1, background: "#ffffff" }}>
                    <div style={styles.empName}>
                      <div style={{ ...styles.avatar, background: stringToColor(emp) }}>
                        {emp.split(" ").map(n => n[0]).join("")}
                      </div>
                      <span style={{ fontSize: 12 }}>{emp.split(" ")[0]}</span>
                    </div>
                  </td>
                  {dayNums.map(d => {
                    const s = entries[key(emp, d)];
                    const cfg = s ? SCRUM_STATUS[s] : null;
                    const isSelected = selectedCell?.emp === emp && selectedCell?.day === d;
                    return (
                      <td
                        key={d}
                        style={{
                          ...styles.td, ...styles.dayCol,
                          background: cfg ? cfg.bg : isWeekend(d) ? "#f8f8f8" : "transparent",
                          cursor: isViewOnly ? "default" : "pointer",
                          outline: isSelected ? "1px solid #f59e0b" : "none",
                        }}
                        onClick={e => {
                          if (isViewOnly) return;
                          if (isSelected) { setSelectedCell(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = rect.left + rect.width / 2;
                          const spaceBelow = window.innerHeight - rect.bottom - 4;
                          setSelectedCell({
                            emp, day: d,
                            x,
                            y: spaceBelow < 100 ? rect.top - 4 : rect.bottom + 4,
                            flipUp: spaceBelow < 100,
                          });
                        }}
                      >
                        {cfg && (
                          <span style={{ fontSize: 9, color: cfg.text, fontWeight: 700 }}>{cfg.short}</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ ...styles.td, minWidth: 80, textAlign: "center" }}>
                    <span style={{ color: "#28a745", fontWeight: 700, fontSize: 11 }}>{present}</span>
                    <span style={{ color: "#555", fontSize: 11 }}> / </span>
                    <span style={{ color: "#dc3545", fontWeight: 700, fontSize: 11 }}>{absent}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Portal picker */}
      {selectedCell && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onMouseDown={() => setSelectedCell(null)} />
          <ScrumPicker
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

function ScrumPicker({ x, y, flipUp, onSelect, onClear, current }) {
  return (
    <div
      style={{
        position: "fixed",
        left: x,
        top: flipUp ? "auto" : y,
        bottom: flipUp ? window.innerHeight - y : "auto",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: 8,
        minWidth: 130,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        overflow: "hidden",
      }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {Object.entries(SCRUM_STATUS).map(([k, v]) => (
        <button
          key={k}
          style={{
            display: "block", width: "100%", padding: "8px 14px", textAlign: "left",
            border: "none", borderBottom: "1px solid #f0f0f0", cursor: "pointer",
            fontSize: 11, background: k === current ? v.bg : "transparent", color: v.text,
            fontWeight: k === current ? 700 : 400,
          }}
          onClick={() => onSelect(k)}
        >
          {v.label}
        </button>
      ))}
      {current && (
        <button
          style={{
            display: "block", width: "100%", padding: "8px 14px", textAlign: "left",
            border: "none", cursor: "pointer", fontSize: 11,
            background: "transparent", color: "#666",
          }}
          onClick={onClear}
        >
          Clear
        </button>
      )}
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh", background: "#ffffff", color: "#1a1a1a",
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
  headerTag: { fontSize: 10, letterSpacing: 3, color: "#888", marginBottom: 4, textTransform: "uppercase" },
  title: { fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: -0.5 },
  statsRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  statCard: {
    background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: 8,
    padding: "10px 18px", textAlign: "center", minWidth: 70,
  },
  statVal: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 10, color: "#666", marginTop: 2, letterSpacing: 1 },
  controls: {
    display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
    marginBottom: 14, position: "relative", zIndex: 1,
  },
  monthNav: {
    display: "flex", alignItems: "center", gap: 8, background: "#f8f8f8",
    border: "1px solid #e0e0e0", borderRadius: 8, padding: "4px 8px",
  },
  navBtn: { background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" },
  monthLabel: { fontSize: 13, fontWeight: 600, color: "#333", minWidth: 100, textAlign: "center" },
  select: {
    background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: 8,
    color: "#333", padding: "6px 12px", fontSize: 12, cursor: "pointer", outline: "none",
  },
  searchInput: {
    background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: 8,
    color: "#333", padding: "6px 12px", fontSize: 12, outline: "none", minWidth: 180,
  },
  switchBtn: {
    background: "none", border: "1px solid #e0e0e0", borderRadius: 6,
    color: "#666", padding: "6px 14px", fontSize: 12, cursor: "pointer", marginLeft: 8,
  },
  legend: {
    display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
    marginBottom: 14, position: "relative", zIndex: 1,
  },
  legendItem: { fontSize: 10, padding: "2px 10px", borderRadius: 4, fontWeight: 600 },
  gridWrap: { overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: 10, position: "relative", zIndex: 1, width: "100%" },
  table: { borderCollapse: "collapse", width: "auto" },
  th: {
    padding: "8px 4px", textAlign: "center", fontSize: 11, color: "#666",
    fontWeight: 500, borderBottom: "1px solid #e0e0e0", borderRight: "1px solid #f0f0f0",
    background: "#fafafa",
  },
  empCol: { minWidth: 130, textAlign: "left", padding: "8px 12px" },
  dayCol: { width: 32, minWidth: 32, maxWidth: 32 },
  tr: { borderBottom: "1px solid #f0f0f0" },
  td: { padding: "5px 2px", textAlign: "center", fontSize: 10, borderRight: "1px solid #f0f0f0", position: "relative" },
  empName: { display: "flex", alignItems: "center", gap: 8, color: "#333" },
  avatar: {
    width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0,
  },
};
