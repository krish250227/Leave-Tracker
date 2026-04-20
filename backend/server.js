const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 4000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json());

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET /employees — list all employees
app.get("/employees", (req, res) => {
  const { employees } = readData();
  res.json(employees);
});

// GET /attendance — get all attendance entries (optionally filter by ?year=&month=)
app.get("/attendance", (req, res) => {
  const { attendance } = readData();
  const { year, month } = req.query;

  if (year && month) {
    const prefix = `__${year}-${month}-`;
    const filtered = Object.fromEntries(
      Object.entries(attendance).filter(([k]) => k.includes(prefix))
    );
    return res.json(filtered);
  }

  res.json(attendance);
});

// PUT /attendance — set a single entry { key, status }
// key format: "EmployeeName__year-month-day"
// status: one of the STATUS_CONFIG keys, or null to clear
app.put("/attendance", (req, res) => {
  const { key, status } = req.body;
  if (!key) return res.status(400).json({ error: "key is required" });

  const data = readData();

  if (status === null || status === undefined) {
    delete data.attendance[key];
  } else {
    data.attendance[key] = status;
  }

  writeData(data);
  res.json({ ok: true });
});

// DELETE /attendance/:key — clear a single entry
app.delete("/attendance/:key", (req, res) => {
  const data = readData();
  delete data.attendance[decodeURIComponent(req.params.key)];
  writeData(data);
  res.json({ ok: true });
});

// GET /scrum — get scrum attendance (optionally filter by ?year=&month=)
app.get("/scrum", (req, res) => {
  const data = readData();
  const scrum = data.scrum || {};
  const { year, month } = req.query;
  if (year && month) {
    const prefix = `__${year}-${month}-`;
    return res.json(Object.fromEntries(Object.entries(scrum).filter(([k]) => k.includes(prefix))));
  }
  res.json(scrum);
});

// PUT /scrum — set a scrum entry { key, status }
// key format: "EmployeeName__year-month-day"
// status: "present" | "absent" | null
app.put("/scrum", (req, res) => {
  const { key, status } = req.body;
  if (!key) return res.status(400).json({ error: "key is required" });
  const data = readData();
  if (!data.scrum) data.scrum = {};
  if (status === null || status === undefined) delete data.scrum[key];
  else data.scrum[key] = status;
  writeData(data);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Leave Tracker API running at http://localhost:${PORT}`);
});
