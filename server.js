const express = require("express");
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "";
let db = null;

async function connectDB() {
  if (!MONGO_URI) {
    console.warn("⚠️  MONGO_URI no configurado — usando memoria (los datos no persisten)");
    return;
  }
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db("quizclass");
    console.log("✅ MongoDB conectado");
  } catch (e) {
    console.error("❌ Error conectando MongoDB:", e.message);
  }
}

// Helpers: usa MongoDB si está disponible, si no usa memoria como respaldo
const memBank = {};

async function dbFind() {
  if (db) return db.collection("quizzes").find().sort({ createdAt: -1 }).toArray();
  return Object.values(memBank).sort((a, b) => b.createdAt - a.createdAt);
}
async function dbInsert(doc) {
  if (db) {
    const res = await db.collection("quizzes").insertOne(doc);
    return res.insertedId.toString();
  }
  const id = Date.now().toString();
  memBank[id] = { ...doc, id };
  return id;
}
async function dbFindOne(id) {
  if (db) {
    try { return await db.collection("quizzes").findOne({ _id: new ObjectId(id) }); }
    catch { return null; }
  }
  return memBank[id] || null;
}
async function dbDelete(id) {
  if (db) {
    try { await db.collection("quizzes").deleteOne({ _id: new ObjectId(id) }); }
    catch {}
  } else {
    delete memBank[id];
  }
}
async function dbUpdate(id, doc) {
  if (db) {
    try { await db.collection("quizzes").updateOne({ _id: new ObjectId(id) }, { $set: doc }); }
    catch {}
  } else {
    if (memBank[id]) memBank[id] = { ...memBank[id], ...doc };
  }
}

// ─── In-memory sessions (solo durante la sesión activa) ───────────────────────
const sessions = {};
const genPin = () => String(Math.floor(100000 + Math.random() * 900000));

// ─── REST: Auth ───────────────────────────────────────────────────────────────
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "profesor2024";

app.post("/api/auth", (req, res) => {
  const { password } = req.body;
  res.json({ ok: password === TEACHER_PASSWORD });
});

// ─── REST: Quiz Bank ──────────────────────────────────────────────────────────
app.get("/api/bank", async (req, res) => {
  try {
    const list = await dbFind();
    res.json(list.map(q => ({
      id: q._id ? q._id.toString() : q.id,
      name: q.name,
      questionCount: q.questions.length,
      createdAt: q.createdAt,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/bank", async (req, res) => {
  const { name, questions } = req.body;
  if (!name || !questions || !questions.length) return res.status(400).json({ error: "Invalid" });
  try {
    const id = await dbInsert({ name, questions, createdAt: Date.now() });
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/bank/:id", async (req, res) => {
  try {
    const q = await dbFindOne(req.params.id);
    if (!q) return res.status(404).json({ error: "Not found" });
    res.json({ id: q._id ? q._id.toString() : q.id, name: q.name, questions: q.questions, createdAt: q.createdAt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/bank/:id", async (req, res) => {
  const { name, questions } = req.body;
  if (!name || !questions || !questions.length) return res.status(400).json({ error: "Invalid" });
  try {
    await dbUpdate(req.params.id, { name, questions });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/bank/:id", async (req, res) => {
  try {
    await dbDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
const clients = new WeakMap();

function broadcast(pin, msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(ws => {
    const info = clients.get(ws);
    if (info && info.pin === pin && ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}
function sendTo(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const { type } = msg;

    if (type === "host:create") {
      const pin = genPin();
      sessions[pin] = {
        pin, name: msg.name || "Trivia",
        questions: msg.questions || [],
        status: "lobby", currentQ: -1,
        players: {}, votes: {}, timerStart: null,
        timer: null, pointsPerQ: msg.pointsPerQ || 100,
        history: [],
      };
      clients.set(ws, { pin, role: "host", name: "host" });
      sendTo(ws, { type: "host:created", pin });
    }
    else if (type === "host:start") {
      const info = clients.get(ws);
      const s = sessions[info?.pin];
      if (!s || s.status !== "lobby") return;
      startQuestion(info.pin, 0);
    }
    else if (type === "host:next") {
      const info = clients.get(ws);
      const s = sessions[info?.pin];
      if (!s || s.status !== "reveal") return;
      const next = s.currentQ + 1;
      if (next >= s.questions.length) endQuiz(info.pin);
      else startQuestion(info.pin, next);
    }
    else if (type === "host:reveal") {
      const info = clients.get(ws);
      const s = sessions[info?.pin];
      if (!s || s.status !== "question") return;
      clearTimeout(s.timer);
      revealAnswers(info.pin);
    }
    else if (type === "host:cancel") {
      const info = clients.get(ws);
      if (!info) return;
      const s = sessions[info.pin];
      if (s) { clearTimeout(s.timer); delete sessions[info.pin]; }
      broadcast(info.pin, { type: "quiz:cancelled" });
    }
    else if (type === "student:join") {
      const { pin, name } = msg;
      const s = sessions[pin];
      if (!s) { sendTo(ws, { type: "error", msg: "Código incorrecto ❌" }); return; }
      if (s.status !== "lobby") { sendTo(ws, { type: "error", msg: "La trivia ya comenzó" }); return; }
      if (s.players[name]) { sendTo(ws, { type: "error", msg: "Ese nombre ya está en uso" }); return; }
      s.players[name] = { score: 0, answeredIndex: -1 };
      clients.set(ws, { pin, role: "student", name });
      sendTo(ws, { type: "student:joined", name });
      broadcast(pin, { type: "lobby:update", players: Object.keys(s.players) });
    }
    else if (type === "student:answer") {
      const info = clients.get(ws);
      const s = sessions[info?.pin];
      if (!s || s.status !== "question") return;
      const player = s.players[info.name];
      if (!player || player.answeredIndex !== -1) return;
      const idx = msg.idx;
      player.answeredIndex = idx;
      s.votes[idx] = (s.votes[idx] || 0) + 1;
      const totalAnswered = Object.values(s.players).filter(p => p.answeredIndex !== -1).length;
      broadcast(info.pin, { type: "votes:update", votes: s.votes, totalAnswered, totalPlayers: Object.keys(s.players).length });
      if (totalAnswered === Object.keys(s.players).length) {
        clearTimeout(s.timer);
        revealAnswers(info.pin);
      }
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (!info || info.role !== "student") return;
    const s = sessions[info.pin];
    if (s && s.status === "lobby") {
      delete s.players[info.name];
      broadcast(info.pin, { type: "lobby:update", players: Object.keys(s.players) });
    }
  });
});

// ─── Game logic ───────────────────────────────────────────────────────────────
function startQuestion(pin, idx) {
  const s = sessions[pin];
  if (!s) return;
  const q = s.questions[idx];
  s.status = "question"; s.currentQ = idx;
  s.votes = {}; s.timerStart = Date.now();
  Object.values(s.players).forEach(p => { p.answeredIndex = -1; });
  broadcast(pin, {
    type: "question:start", currentQ: idx, total: s.questions.length,
    question: { text: q.text, answers: q.answers, time: q.time },
  });
  s.timer = setTimeout(() => revealAnswers(pin), q.time * 1000);
}

function revealAnswers(pin) {
  const s = sessions[pin];
  if (!s || s.status !== "question") return;
  const q = s.questions[s.currentQ];
  const elapsed = (Date.now() - s.timerStart) / 1000;
  Object.values(s.players).forEach(p => {
    if (p.answeredIndex === q.correct) {
      const bonus = Math.round(s.pointsPerQ * (1 - Math.min(elapsed, q.time) / q.time) * 0.5);
      p.score += s.pointsPerQ + bonus;
    }
  });
  s.history.push({ text: q.text, answers: q.answers, correct: q.correct, votes: { ...s.votes }, totalPlayers: Object.keys(s.players).length });
  s.status = "reveal";
  broadcast(pin, {
    type: "question:reveal",
    correct: q.correct, votes: s.votes,
    players: s.players, leaderboard: getLeaderboard(s),
    isLast: s.currentQ >= s.questions.length - 1,
  });
}

function endQuiz(pin) {
  const s = sessions[pin];
  if (!s) return;
  s.status = "results";
  broadcast(pin, { type: "quiz:results", leaderboard: getLeaderboard(s), history: s.history, quizName: s.name });
  setTimeout(() => delete sessions[pin], 30 * 60 * 1000);
}

function getLeaderboard(s) {
  return Object.entries(s.players).map(([name, p]) => ({ name, score: p.score })).sort((a, b) => b.score - a.score);
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  server.listen(PORT, () => console.log(`QuizClass running on port ${PORT}`));
});
