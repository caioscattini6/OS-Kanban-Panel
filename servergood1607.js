const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.static('public'));
app.use(express.json());

let osList = [];

// Carrega dados salvos (se existirem)
if (fs.existsSync(DATA_FILE)) {
  osList = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

// Salva para disco
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(osList, null, 2));
}

// Lista todas as OSs
app.get('/api/os', (req, res) => {
  res.json(osList);
});

// Recupera OS específica
app.get('/api/os/:numero', (req, res) => {
  const os = osList.find(o => o.numero === req.params.numero);
  if (!os) return res.status(404).json({ error: 'OS não encontrada' });
  res.json(os);
});

// Adiciona nova OS
app.post('/api/os', (req, res) => {
  const { numero, status } = req.body;
  if (!numero || !status) return res.status(400).json({ error: 'Dados incompletos' });
  if (osList.find(o => o.numero === numero)) return res.status(400).json({ error: 'OS já existe' });

  osList.push({ numero, status, urgente: false, observacoes: '' });
  saveData();
  res.sendStatus(201);
});

// Atualiza status, observações ou ambos
app.put('/api/os/:numero', (req, res) => {
  const os = osList.find(o => o.numero === req.params.numero);
  if (!os) return res.status(404).json({ error: 'OS não encontrada' });

  const { status, observacoes } = req.body;
  if (status !== undefined) os.status = status;
  if (observacoes !== undefined) os.observacoes = observacoes;

  saveData();
  res.sendStatus(200);
});

// Atualiza campo urgente
app.put('/api/os/urgente/:numero', (req, res) => {
  const os = osList.find(o => o.numero === req.params.numero);
  if (!os) return res.status(404).json({ error: 'OS não encontrada' });

  os.urgente = !os.urgente;
  saveData();
  res.sendStatus(200);
});

// Exclui OS
app.delete('/api/os/:numero', (req, res) => {
  const index = osList.findIndex(o => o.numero === req.params.numero);
  if (index === -1) return res.status(404).json({ error: 'OS não encontrada' });

  osList.splice(index, 1);
  saveData();
  res.sendStatus(200);
});

// Backup manual
app.get('/backup.json', (req, res) => {
  res.download(DATA_FILE);
});

// Força salvar
app.get('/api/save', (req, res) => {
  saveData();
  res.sendStatus(200);
});

// Reset total
app.post('/api/reset', (req, res) => {
  osList = [];
  saveData();
  res.sendStatus(200);
});

// Inicia servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
