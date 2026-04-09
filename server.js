const express = require("express");
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "public")));

// ─── In-memory sessions ───────────────────────────────────────────────────────
// sessions[pin] = { pin, name, questions, status, currentQ, players, votes, timerStart, timerDur, timer }
const sessions = {};
// clients[ws] = { pin, name, role }  (role: 'host' | 'student')
const clients = new WeakMap();

const genPin = () => String(Math.floor(100000 + Math.random() * 900000));

function broadcast(pin, msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(ws => {
    const info = clients.get(ws);
    if (info && info.pin === pin && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

function sendTo(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function sessionSnapshot(s) {
  const { timer, ...rest } = s;
  return rest;
}

// ─── WebSocket handler ────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type } = msg;

    // ── HOST: create session ──────────────────────────────────────────────
    if (type === "host:create") {
      const pin = genPin();
      sessions[pin] = {
        pin,
        name: msg.name || "Trivia",
        questions: msg.questions || [],
        status: "lobby",
        currentQ: -1,
        players: {},
        votes: {},
        timerStart: null,
        timerDur: 0,
        timer: null,
        pointsPerQ: msg.pointsPerQ || 100,
      };
      clients.set(ws, { pin, role: "host", name: "host" });
      sendTo(ws, { type: "host:created", pin, session: sessionSnapshot(sessions[pin]) });
    }

    // ── HOST: start quiz ──────────────────────────────────────────────────
    else if (type === "host:start") {
      const info = clients.get(ws);
      if (!info) return;
      const s = sessions[info.pin];
      if (!s || s.status !== "lobby") return;
      startQuestion(info.pin, 0);
    }

    // ── HOST: next question ───────────────────────────────────────────────
    else if (type === "host:next") {
      const info = clients.get(ws);
      if (!info) return;
      const s = sessions[info.pin];
      if (!s || s.status !== "reveal") return;
      const next = s.currentQ + 1;
      if (next >= s.questions.length) endQuiz(info.pin);
      else startQuestion(info.pin, next);
    }

    // ── HOST: reveal now ──────────────────────────────────────────────────
    else if (type === "host:reveal") {
      const info = clients.get(ws);
      if (!info) return;
      const s = sessions[info.pin];
      if (!s || s.status !== "question") return;
      clearTimeout(s.timer);
      revealAnswers(info.pin);
    }

    // ── HOST: cancel ──────────────────────────────────────────────────────
    else if (type === "host:cancel") {
      const info = clients.get(ws);
      if (!info) return;
      const s = sessions[info.pin];
      if (s) { clearTimeout(s.timer); delete sessions[info.pin]; }
      broadcast(info.pin, { type: "quiz:cancelled" });
    }

    // ── STUDENT: join ─────────────────────────────────────────────────────
    else if (type === "student:join") {
      const { pin, name } = msg;
      const s = sessions[pin];
      if (!s) { sendTo(ws, { type: "error", msg: "Código incorrecto ❌" }); return; }
      if (s.status !== "lobby") { sendTo(ws, { type: "error", msg: "La trivia ya comenzó" }); return; }
      if (s.players[name]) { sendTo(ws, { type: "error", msg: "Ese nombre ya está en uso" }); return; }

      s.players[name] = { score: 0, answeredIndex: -1 };
      clients.set(ws, { pin, role: "student", name });
      sendTo(ws, { type: "student:joined", name, session: sessionSnapshot(s) });
      broadcast(pin, { type: "lobby:update", players: Object.keys(s.players) });
    }

    // ── STUDENT: answer ───────────────────────────────────────────────────
    else if (type === "student:answer") {
      const info = clients.get(ws);
      if (!info) return;
      const s = sessions[info.pin];
      if (!s || s.status !== "question") return;
      const player = s.players[info.name];
      if (!player || player.answeredIndex !== -1) return; // already answered

      const idx = msg.idx;
      player.answeredIndex = idx;
      s.votes[idx] = (s.votes[idx] || 0) + 1;

      const totalAnswered = Object.values(s.players).filter(p => p.answeredIndex !== -1).length;
      broadcast(info.pin, { type: "votes:update", votes: s.votes, totalAnswered, totalPlayers: Object.keys(s.players).length });

      // Auto-reveal if everyone answered
      if (totalAnswered === Object.keys(s.players).length) {
        clearTimeout(s.timer);
        revealAnswers(info.pin);
      }
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (!info) return;
    if (info.role === "student") {
      const s = sessions[info.pin];
      if (s && s.status === "lobby") {
        delete s.players[info.name];
        broadcast(info.pin, { type: "lobby:update", players: Object.keys(s.players) });
      }
    }
  });
});

// ─── Game logic ───────────────────────────────────────────────────────────────
function startQuestion(pin, idx) {
  const s = sessions[pin];
  if (!s) return;
  const q = s.questions[idx];
  s.status = "question";
  s.currentQ = idx;
  s.votes = {};
  s.timerStart = Date.now();
  s.timerDur = q.time * 1000;
  Object.values(s.players).forEach(p => { p.answeredIndex = -1; });

  broadcast(pin, {
    type: "question:start",
    currentQ: idx,
    total: s.questions.length,
    question: { text: q.text, answers: q.answers, time: q.time },
  });

  s.timer = setTimeout(() => revealAnswers(pin), q.time * 1000);
}

function revealAnswers(pin) {
  const s = sessions[pin];
  if (!s || s.status !== "question") return;
  const q = s.questions[s.currentQ];
  const elapsed = (Date.now() - s.timerStart) / 1000;

  // Award points
  Object.values(s.players).forEach(p => {
    if (p.answeredIndex === q.correct) {
      const bonus = Math.round(s.pointsPerQ * (1 - Math.min(elapsed, q.time) / q.time) * 0.5);
      p.score += s.pointsPerQ + bonus;
    }
  });

  s.status = "reveal";
  const leaderboard = getLeaderboard(s);

  broadcast(pin, {
    type: "question:reveal",
    correct: q.correct,
    votes: s.votes,
    players: s.players,
    leaderboard,
    isLast: s.currentQ >= s.questions.length - 1,
  });
}

function endQuiz(pin) {
  const s = sessions[pin];
  if (!s) return;
  s.status = "results";
  broadcast(pin, { type: "quiz:results", leaderboard: getLeaderboard(s) });
  // Clean up after 30 min
  setTimeout(() => delete sessions[pin], 30 * 60 * 1000);
}

function getLeaderboard(s) {
  return Object.entries(s.players)
    .map(([name, p]) => ({ name, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`QuizClass running on port ${PORT}`));
