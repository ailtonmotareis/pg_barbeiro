// ===== Servidor Node.js + SQLite para Barbearia Akitas =====
// Os dados dos clientes ficam salvos no arquivo: agendamentos.db

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve arquivos estáticos (HTML, CSS, JS, vídeo, imagens)
app.use(express.static(path.join(__dirname)));

// ===== Banco de dados SQLite =====
// O arquivo agendamentos.db será criado automaticamente na primeira execução
const db = new Database(path.join(__dirname, "agendamentos.db"));

// Cria a tabela de agendamentos (executado uma vez)
db.exec(`
  CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    servico TEXT NOT NULL,
    preco INTEGER NOT NULL,
    data TEXT NOT NULL,      -- formato YYYY-MM-DD
    horario TEXT NOT NULL,   -- formato HH:MM
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// Índice para consulta rápida por data
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_agendamentos_data_horario 
  ON agendamentos(data, horario);
`);

// ===== Configuração: barbeiros, turnos e limite =====
const BARBEIROS = ["Alexandre", "Luiz", "Matheus"];

// inicio/fim em minutos desde 00:00 (usado para esconder turnos que já acabaram hoje)
const TURNOS = [
  { id: "manha", nome: "Manhã", inicio: "08:30", fim: "12:00" },
  { id: "tarde", nome: "Tarde", inicio: "13:00", fim: "18:00" },
  { id: "noite", nome: "Noite", inicio: "18:00", fim: "20:00" }
];

// Máximo de clientes por barbeiro em cada turno (30 por turno com 3 barbeiros)
const LIMITE_POR_TURNO = 10;

// Migração: adiciona colunas novas sem perder os agendamentos antigos
const colunas = db.prepare("PRAGMA table_info(agendamentos)").all().map(c => c.name);
if (!colunas.includes("barbeiro")) db.exec("ALTER TABLE agendamentos ADD COLUMN barbeiro TEXT");
if (!colunas.includes("turno")) {
  db.exec("ALTER TABLE agendamentos ADD COLUMN turno TEXT");
  // Agendamentos antigos: descobre o turno pelo horário salvo
  db.exec(`
    UPDATE agendamentos SET turno = CASE
      WHEN horario < '12:30' THEN 'manha'
      WHEN horario < '18:00' THEN 'tarde'
      ELSE 'noite' END
    WHERE turno IS NULL
  `);
}
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_agendamentos_vagas
  ON agendamentos(data, barbeiro, turno);
`);

// ===== Rotas =====

// 0) Configuração (barbeiros, turnos e limite) para o front-end
app.get("/api/config", (req, res) => {
  res.json({ barbeiros: BARBEIROS, turnos: TURNOS, limite: LIMITE_POR_TURNO });
});

// 1) Vagas de uma data, por barbeiro e turno
// GET /api/agendamentos?data=2026-11-10
// Resposta: { data, limite, vagas: { "João": { manha: { usados, restantes }, ... }, ... } }
app.get("/api/agendamentos", (req, res) => {
  const { data } = req.query;

  if (!data) {
    return res.status(400).json({ error: "Informe o parâmetro data (YYYY-MM-DD)" });
  }

  try {
    const rows = db
      .prepare(
        `SELECT barbeiro, turno, COUNT(*) AS usados
         FROM agendamentos
         WHERE data = ? AND barbeiro IS NOT NULL
         GROUP BY barbeiro, turno`
      )
      .all(data);

    const vagas = {};
    for (const b of BARBEIROS) {
      vagas[b] = {};
      for (const t of TURNOS) {
        const usados = rows.find(r => r.barbeiro === b && r.turno === t.id)?.usados || 0;
        vagas[b][t.id] = { usados, restantes: Math.max(0, LIMITE_POR_TURNO - usados) };
      }
    }

    res.json({ data, limite: LIMITE_POR_TURNO, vagas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar agendamentos" });
  }
});

// 2) Criar um novo agendamento (reserva uma vaga no turno do barbeiro)
// POST /api/agendamentos
// Body: { nome, telefone, servico, preco, data, barbeiro, turno }
const criarAgendamento = db.transaction(dados => {
  const { nome, telefone, servico, preco, data, barbeiro, turno } = dados;
  const t = TURNOS.find(x => x.id === turno);

  const { usados } = db
    .prepare("SELECT COUNT(*) AS usados FROM agendamentos WHERE data = ? AND barbeiro = ? AND turno = ?")
    .get(data, barbeiro, turno);

  if (usados >= LIMITE_POR_TURNO) return { lotado: true };

  const info = db
    .prepare(
      `INSERT INTO agendamentos (nome, telefone, servico, preco, data, horario, barbeiro, turno)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(nome, telefone, servico, preco, data, `${t.inicio}-${t.fim}`, barbeiro, turno);

  return { id: info.lastInsertRowid, posicao: usados + 1 };
});

app.post("/api/agendamentos", (req, res) => {
  const { nome, telefone, servico, preco, data, barbeiro, turno } = req.body;

  if (!nome || !telefone || !servico || !data || !barbeiro || !turno) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }
  if (!BARBEIROS.includes(barbeiro)) {
    return res.status(400).json({ error: "Barbeiro inválido" });
  }
  if (!TURNOS.some(t => t.id === turno)) {
    return res.status(400).json({ error: "Turno inválido" });
  }

  try {
    const r = criarAgendamento({ nome, telefone, servico, preco: Number(preco) || 0, data, barbeiro, turno });

    if (r.lotado) {
      return res.status(409).json({
        error: `${barbeiro} não tem mais vagas neste turno. Escolha outro turno ou outro barbeiro.`
      });
    }

    res.status(201).json({
      success: true,
      id: r.id,
      posicao: r.posicao,
      message: "Agendamento realizado com sucesso!"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar agendamento" });
  }
});

// 3) Listar todos os agendamentos (admin)
// GET /api/agendamentos/todos
app.get("/api/agendamentos/todos", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM agendamentos ORDER BY data, horario")
      .all();
    res.json({ total: rows.length, agendamentos: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar agendamentos" });
  }
});

// 4) Deletar um agendamento (admin)
// DELETE /api/agendamentos/:id
app.delete("/api/agendamentos/:id", (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare("DELETE FROM agendamentos WHERE id = ?");
    const info = stmt.run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }
    res.json({ success: true, message: "Agendamento cancelado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao cancelar agendamento" });
  }
});

// ===== Inicia o servidor =====
app.listen(PORT, () => {
  console.log(`\n🪒 Servidor da Barbearia Akitas rodando em http://localhost:${PORT}`);
  console.log(`📁 Banco de dados: ${path.join(__dirname, "agendamentos.db")}`);
  console.log(`📋 Tabela: agendamentos (nome, telefone, servico, preco, data, horario, barbeiro, turno, created_at)\n`);
});

module.exports = { app, db };
