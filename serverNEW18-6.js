// server.js com validação de status
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'backup.json');
let ordemServico = [];

const STATUS_VALIDOS = [
  "entrada",
  "enviar",
  "aguardando",
  "aprovado",
  "andamento",
  "agordem",
  "rma",
  "pronto",
  "semconserto"
];

// Carrega dados existentes
if (fs.existsSync(DATA_FILE)) {
  ordemServico = JSON.parse(fs.readFileSync(DATA_FILE));
}

// Retorna todas as OS
app.get('/api/os', (req, res) => {
  res.json(ordemServico);
});

// Cria nova OS
app.post('/api/os', (req, res) => {
  const { numero, status } = req.body;
  if (!numero || !status || !STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ error: 'Número ou status inválido' });
  }
  if (ordemServico.find(o => o.numero === numero)) {
    return res.status(400).json({ error: 'OS já existente' });
  }
  ordemServico.push({ numero, status, urgente: false, observacoes: "" });
  res.status(201).json({ success: true });
});

// Atualiza status, urgente ou observações
app.put('/api/os/:numero', (req, res) => {
  const numero = req.params.numero;
  const index = ordemServico.findIndex(o => o.numero === numero);
  if (index === -1) return res.status(404).json({ error: 'OS não encontrada' });

  const { status, urgente, observacoes } = req.body;

  if (status && !STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  if (status) ordemServico[index].status = status;
  if (typeof urgente === 'boolean') ordemServico[index].urgente = urgente;
  if (typeof observacoes === 'string') ordemServico[index].observacoes = observacoes;

  res.json({ success: true });
});

// Alterna flag de urgente
app.put('/api/os/urgente/:numero', (req, res) => {
  const numero = req.params.numero;
  const os = ordemServico.find(o => o.numero === numero);
  if (!os) return res.status(404).json({ error: 'OS não encontrada' });
  os.urgente = !os.urgente;
  res.json({ success: true });
});

// Retorna dados de uma OS
app.get('/api/os/:numero', (req, res) => {
  const os = ordemServico.find(o => o.numero === req.params.numero);
  if (!os) return res.status(404).json({ error: 'OS não encontrada' });
  res.json(os);
});

// Arquiva OS (substitui exclusão)
app.post('/api/arquivar/:numero', (req, res) => {
  const numero = req.params.numero;
  const index = ordemServico.findIndex(o => o.numero === numero);
  if (index === -1) return res.status(404).json({ error: 'OS não encontrada' });

  const arquivadasPath = path.join(__dirname, 'arquivo_os.json');
  let arquivo = [];
  if (fs.existsSync(arquivadasPath)) {
    arquivo = JSON.parse(fs.readFileSync(arquivadasPath));
  }
  arquivo.push(ordemServico[index]);
  fs.writeFileSync(arquivadasPath, JSON.stringify(arquivo, null, 2));

  ordemServico.splice(index, 1);
  res.json({ success: true });
});
app.delete('/api/os/:numero', (req, res) => {
  const index = ordemServico.findIndex(o => o.numero === req.params.numero);
  if (index === -1) return res.status(404).json({ error: 'OS não encontrada' });
  ordemServico.splice(index, 1);
  res.json({ success: true });
});

// Salvar backup manual
app.get('/api/save', (req, res) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(ordemServico, null, 2));
  res.json({ success: true });
});

// Download do backup
app.get('/backup.json', (req, res) => {
  res.download(DATA_FILE);
});

// Resetar painel
app.post('/api/reset', (req, res) => {
  ordemServico = [];
  fs.writeFileSync(DATA_FILE, JSON.stringify(ordemServico, null, 2));
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
