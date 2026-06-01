const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

let db;

async function getDb() {
  if (!db) {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db("leavetracker");
  }
  return db;
}

const USERS = [
  { email: "harsh.koushk@mobifly.tech", password: "admin123", name: "Harsh Koushk" },
  { email: "user@example.com", password: "user123", name: "User" },
];

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  const user = USERS.find(u => u.email === email && u.password === password);
  if (user) res.json({ ok: true, user: { email: user.email, name: user.name } });
  else res.status(401).json({ error: "Invalid email or password" });
});

app.get("/employees", async (req, res) => {
  const db = await getDb();
  const doc = await db.collection("employees").findOne({ _id: "list" });
  res.json(doc?.employees || []);
});

app.post("/employees", async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  const trimmed = name.trim();
  const db = await getDb();
  const doc = await db.collection("employees").findOne({ _id: "list" });
  const employees = doc?.employees || [];
  if (employees.includes(trimmed)) return res.status(409).json({ error: "already exists" });
  await db.collection("employees").updateOne(
    { _id: "list" },
    { $push: { employees: trimmed } },
    { upsert: true }
  );
  res.json({ ok: true });
});

app.delete("/employees/:name", async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const db = await getDb();
  await db.collection("employees").updateOne(
    { _id: "list" },
    { $pull: { employees: name } }
  );
  res.json({ ok: true });
});

app.get("/attendance", async (req, res) => {
  const { year, month } = req.query;
  const db = await getDb();
  const query = year && month ? { key: { $regex: `__${year}-${month}-` } } : {};
  const docs = await db.collection("attendance").find(query).toArray();
  const result = {};
  docs.forEach(d => { result[d.key] = d.status; });
  res.json(result);
});

app.put("/attendance", async (req, res) => {
  const { key, status } = req.body;
  if (!key) return res.status(400).json({ error: "key is required" });
  const db = await getDb();
  if (status === null || status === undefined) {
    await db.collection("attendance").deleteOne({ key });
  } else {
    await db.collection("attendance").updateOne({ key }, { $set: { key, status } }, { upsert: true });
  }
  res.json({ ok: true });
});

app.get("/scrum", async (req, res) => {
  const { year, month } = req.query;
  const db = await getDb();
  const query = year && month ? { key: { $regex: `__${year}-${month}-` } } : {};
  const docs = await db.collection("scrum").find(query).toArray();
  const result = {};
  docs.forEach(d => { result[d.key] = d.status; });
  res.json(result);
});

app.put("/scrum", async (req, res) => {
  const { key, status } = req.body;
  if (!key) return res.status(400).json({ error: "key is required" });
  const db = await getDb();
  if (status === null || status === undefined) {
    await db.collection("scrum").deleteOne({ key });
  } else {
    await db.collection("scrum").updateOne({ key }, { $set: { key, status } }, { upsert: true });
  }
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
