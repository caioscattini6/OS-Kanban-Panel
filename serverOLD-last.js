// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = 3000;

app.use(express.static("public"));
app.use(express.json());

let ordens = [];
const backupFile = path.join(__dirname, "backup.json");

if (fs.existsSync(backupFile)) {
  try {
    const data = fs.readFileSync(backupFile, "utf-8");
    ordens = JSON.parse(data);
    console.log("Backup carregado.");
  } catch (err) {
    console.error("Erro ao carregar backup:", err.message);
  }
}

app.get("/api/os", (req, res) => {
  res.json(ordens);
});

app.post("/api/os", (req, res) => {
  const { numero, status } = req.body;
  const validStatuses = ["enviar", "aguardando", "aprovado", "semconserto", "pronto"];

  if (!numero || !status || !/^[0-9]{4}$/.test(numero)) {
    return res.status(400).json({ error: "Formato inválido." });
  }

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }

  if (ordens.find(o => o.numero === numero)) {
    return res.status(400).json({ error: "OS já existente." });
  }

  ordens.push({ numero, status, urgente: false });
  res.status(201).json({ ok: true });
});

app.put("/api/os/:numero", (req, res) => {
  const numero = req.params.numero;
  const { status } = req.body;
  const validStatuses = ["enviar", "aguardando", "aprovado", "semconserto", "pronto"];
  const os = ordens.find(o => o.numero === numero);

  if (!os) return res.status(404).json({ error: "OS não encontrada." });
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Status inválido." });

  os.status = status;
  res.json({ ok: true });
});

app.put("/api/os/urgente/:numero", (req, res) => {
  const numero = req.params.numero;
  const os = ordens.find(o => o.numero === numero);

  if (!os) return res.status(404).json({ error: "OS não encontrada." });

  os.urgente = !os.urgente;
  res.json({ ok: true, urgente: os.urgente });
});

app.delete("/api/os/:numero", (req, res) => {
  const numero = req.params.numero;
  ordens = ordens.filter(o => o.numero !== numero);
  res.json({ ok: true });
});

app.post("/api/reset", (req, res) => {
  ordens = [];
  fs.writeFileSync(backupFile, JSON.stringify(ordens, null, 2));
  res.json({ ok: true });
});

app.get("/api/save", (req, res) => {
  try {
    fs.writeFileSync(backupFile, JSON.stringify(ordens, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
