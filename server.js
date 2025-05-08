require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_DATABASE || 'producao'
});

db.connect(err => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
        return;
    }
    console.log('Conectado ao banco de dados.');
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Endpoint: Produção hora a hora
app.get('/api/producao_horaria', (req, res) => {
    const date = req.query.date;
    if (!date) {
        return res.status(400).json({ error: 'Data é obrigatória' });
    }

    const sql = `
        SELECT 
            HOUR(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) AS hora,
            SUM(qtd_dados) AS quantidade
        FROM dados_hora_a_hora
        WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = ?
        GROUP BY hora
        ORDER BY hora
    `;

    db.query(sql, [date], (err, results) => {
        if (err) {
            console.error('Erro ao buscar produção horária:', err);
            return res.status(500).json({ error: 'Erro ao buscar dados', details: err.message });
        }

        res.json(results);
    });
});

// Endpoint: Indicadores
app.get('/api/indicadores', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const date = req.query.date || today;

    const sql = `
SELECT
(SELECT meta FROM meta_dia WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = ?) AS meta_dia,
(SELECT SUM(qtd_dados) * 12 FROM dados_hora_a_hora WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = ?) AS total_produzido,
(SELECT SUM(qtd) FROM eficiencia WHERE flag = 'produtiva' AND DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = ?) AS total_aprovados,
(SELECT SUM(qtd) FROM eficiencia WHERE flag = 'rejeitada' AND DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = ?) AS total_reprovados
`;

db.query(sql, [date, date, date, date], (err, results) => {
        if (err) {
            console.error('Erro ao buscar indicadores:', err);
            return res.status(500).json({ error: 'Erro ao buscar dados do banco de dados', details: err.message });
        }

        if (results.length > 0) {
            const data = results[0];
            const meta = data.meta_dia || 0;
            const totalProduzido = data.total_produzido || 0;
            const totalAprovados = data.total_aprovados || 0;
            const totalReprovados = data.total_reprovados || 0;

            const indicadores = {
                meta: meta,
                total_produzido: totalProduzido,
                total_aprovados: totalAprovados,
                total_reprovados: totalReprovados,
                horas_trabalhadas: 10,
                horas_paradas: 0.5
            };
            res.json(indicadores);
        } else {
            res.status(404).json({ message: 'Nenhum dado encontrado para a data especificada.' });
        }
    });
});



const PORT = process.env.PORT || 3000;

// Relatório entre datas
app.get('/api/relatorio', (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
        return res.status(400).json({ error: 'Datas "start" e "end" são obrigatórias.' });
    }

    const sql = `
        SELECT 
            SUM(CASE WHEN flag = 'produtiva' THEN qtd ELSE 0 END) AS total_aprovados,
            SUM(CASE WHEN flag = 'rejeitada' THEN qtd ELSE 0 END) AS total_reprovados,
            (SELECT SUM(qtd_dados) * 12 FROM dados_hora_a_hora 
                WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) BETWEEN ? AND ?) AS total_produzido
        FROM eficiencia
        WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) BETWEEN ? AND ?
    `;

    db.query(sql, [start, end, start, end], (err, results) => {
        if (err) {
            console.error('Erro no relatório:', err);
            return res.status(500).json({ error: 'Erro ao gerar relatório', details: err.message });
        }

        const data = results[0] || {};
        res.json({
            total_aprovados: data.total_aprovados || 0,
            total_reprovados: data.total_reprovados || 0,
            total_produzido: data.total_produzido || 0
        });
    });
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
