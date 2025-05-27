require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs'); // Add bcrypt for password hashing
const jwt = require('jsonwebtoken'); // Add jsonwebtoken for tokens

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// Conexão com banco de dados
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

// Secret for JWT (should be in .env in a real application)
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

// Middleware de autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // No token

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Invalid token
        req.user = user;
        next();
    });
}

// Middleware de autorização
function authorizeRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Acesso negado: Você não tem permissão para realizar esta ação.' });
        }
        next();
    };
}

// Endpoint: Página principal
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// New: Login Endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
    }

    try {
        const [users] = await db.promise().query('SELECT * FROM usuarios WHERE username = ?', [username]);

        if (users.length === 0) {
            return res.status(401).json({ error: 'Usuário não encontrado.' });
        }

        const user = users[0];

        // Compare plain text password (for now, will change this in a later step)
        // In a real application, you'd compare the hashed password
        const passwordMatch = (password === user.password_hash); // Temporarily compare plain text

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        // Generate JWT
        const accessToken = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login bem-sucedido', accessToken: accessToken, role: user.role, username: user.username });

    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ error: 'Erro interno do servidor durante o login.' });
    }
});

// Endpoint: Indicadores (Dashboard Principal) - Visualização para todos (aberto)
app.get('/api/indicadores', (req, res) => {
    const { selectedDate } = req.query;

    let queryProducao = `SELECT HOUR(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) as hora, SUM(qtd_dados) as total_pecas FROM dados_hora_a_hora`;
    let queryMeta = `SELECT meta FROM meta_dia WHERE STR_TO_DATE(data_hora, '%d/%m/%Y') = CURDATE()`;
    let queryTotalPecas = `SELECT SUM(qtd_dados) as totalPecasProduzidas FROM dados_hora_a_hora`;
    let queryAprovados = `SELECT SUM(qtd_dados) as totalAprovados FROM dados_hora_a_hora`;
    let queryReprovados = `SELECT SUM(qtd) as totalReprovados FROM eficiencia WHERE flag = 'rejeitada'`;

    const queryParams = [];

    if (selectedDate) {
        queryProducao += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = STR_TO_DATE(?, '%Y-%m-%d')`;
        queryTotalPecas += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = STR_TO_DATE(?, '%Y-%m-%d')`;
        queryAprovados += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = STR_TO_DATE(?, '%Y-%m-%d')`;
        queryReprovados += ` AND DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = STR_TO_DATE(?, '%Y-%m-%d')`;
        queryMeta = `SELECT meta FROM meta_dia WHERE STR_TO_DATE(data_hora, '%d/%m/%Y') = STR_TO_DATE(?, '%Y-%m-%d')`;
        queryParams.push(selectedDate, selectedDate, selectedDate, selectedDate, selectedDate);
    } else {
        queryProducao += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = CURDATE()`;
        queryTotalPecas += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = CURDATE()`;
        queryAprovados += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = CURDATE()`;
        queryReprovados += ` AND DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = CURDATE()`;
    }

    queryProducao += ` GROUP BY HOUR(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) ORDER BY hora ASC`;


    db.query(queryProducao, queryParams.slice(0, 1), (err, producaoPorHora) => {
        if (err) {
            console.error('Erro ao buscar produção por hora:', err);
            return res.status(500).json({ error: 'Erro ao buscar produção por hora.' });
        }

        db.query(queryMeta, selectedDate ? [selectedDate] : [], (err, metaDiaria) => {
            if (err) {
                console.error('Erro ao buscar meta diária:', err);
                return res.status(500).json({ error: 'Erro ao buscar meta diária.' });
            }

            db.query(queryTotalPecas, queryParams.slice(1, 2), (err, totalPecasResult) => {
                if (err) {
                    console.error('Erro ao buscar total de peças:', err);
                    return res.status(500).json({ error: 'Erro ao buscar total de peças.' });
                }

                db.query(queryAprovados, queryParams.slice(2, 3), (err, aprovadosResult) => {
                    if (err) {
                        console.error('Erro ao buscar total de aprovados:', err);
                        return res.status(500).json({ error: 'Erro ao buscar total de aprovados.' });
                    }

                    db.query(queryReprovados, queryParams.slice(3, 4), (err, reprovadosResult) => {
                        if (err) {
                            console.error('Erro ao buscar total de reprovados:', err);
                            return res.status(500).json({ error: 'Erro ao buscar total de reprovados.' });
                        }

                        const totalPecasProduzidas = totalPecasResult[0]?.totalPecasProduzidas || 0;
                        const totalAprovados = aprovadosResult[0]?.totalAprovados || 0;
                        const totalReprovados = reprovadosResult[0]?.totalReprovados || 0;
                        
                        // Calcular percentuais
                        const percentAprovados = totalPecasProduzidas > 0 ? (totalAprovados / totalPecasProduzidas) * 100 : 0;
                        const percentReprovados = (totalAprovados + totalReprovados) > 0 ? (totalReprovados / (totalAprovados + totalReprovados)) * 100 : 0;

                        res.json({
                            producaoPorHora,
                            metaDiaria: metaDiaria.length > 0 ? metaDiaria : [{ meta: 0 }],
                            totalPecasProduzidas,
                            totalAprovados,
                            totalReprovados,
                            percentAprovados,
                            percentReprovados
                        });
                    });
                });
            });
        });
    });
});

// Endpoint: Registrar Produção - Apenas para Diretoria, Coordenador e Líder
app.post('/api/producao', authenticateToken, authorizeRole(['diretoria', 'coordenador', 'lider']), (req, res) => {
    const { qtdDados, dataHora } = req.body;
    if (!qtdDados || !dataHora) {
        return res.status(400).json({ error: 'Quantidade de dados e data/hora são obrigatórios.' });
    }

    const sql = 'INSERT INTO dados_hora_a_hora (qtd_dados, data_hora) VALUES (?, ?)';
    db.query(sql, [qtdDados, dataHora], (err, result) => {
        if (err) {
            console.error('Erro ao inserir dados de produção:', err);
            return res.status(500).json({ error: 'Erro ao registrar produção no banco de dados.' });
        }
        res.status(201).json({ message: 'Produção registrada com sucesso', id: result.insertId });
    });
});

// Endpoint: Gerar Relatório de Produção por Período - Visualização para todos (aberto)
app.get('/api/relatorio', (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'As datas de início e fim são obrigatórias para gerar o relatório.' });
    }

    const sql = `
        WITH RECURSIVE DateSeries AS (
            SELECT STR_TO_DATE(?, '%Y-%m-%d') AS report_date
            UNION ALL
            SELECT DATE_ADD(report_date, INTERVAL 1 DAY)
            FROM DateSeries
            WHERE DATE_ADD(report_date, INTERVAL 1 DAY) <= STR_TO_DATE(?, '%Y-%m-%d')
        ),
        ProducedData AS (
            SELECT
                DATE_FORMAT(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s'), '%Y-%m-%d') AS produced_date,
                SUM(qtd_dados) AS daily_produzido_total_boxes /* This is sum of boxes */
            FROM
                dados_hora_a_hora
            WHERE
                DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
            GROUP BY
                produced_date
        ),
        RejectedData AS (
            SELECT
                DATE_FORMAT(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s'), '%Y-%m-%d') AS rejected_date,
                SUM(qtd) AS daily_reprovado_total_pieces /* This is sum of pieces */
            FROM
                eficiencia
            WHERE
                flag = 'rejeitada' AND DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
            GROUP BY
                rejected_date
        )
        SELECT
            DS.report_date,
            COALESCE(MAX(PD.daily_produzido_total_boxes), 0) * 12 AS total_produzido_dia, /* Convert to pieces here */
            COALESCE(MAX(RD.daily_reprovado_total_pieces), 0) AS total_reprovado_dia, /* Already in pieces */
            COALESCE(MAX(MD.meta), 0) * 12 AS meta_dia_total /* Convert meta (boxes) to pieces here */
        FROM
            DateSeries DS
        LEFT JOIN
            ProducedData PD ON DS.report_date = PD.produced_date
        LEFT JOIN
            RejectedData RD ON DS.report_date = RD.rejected_date
        LEFT JOIN
            meta_dia MD ON DS.report_date = STR_TO_DATE(MD.data_hora, '%d/%m/%Y')
        GROUP BY
            DS.report_date
        ORDER BY
            DS.report_date ASC;
    `;

    db.query(sql, [
        startDate, endDate,
        startDate, endDate,
        startDate, endDate
    ], (err, results) => {
        if (err) {
            console.error('Erro ao gerar relatório:', err);
            return res.status(500).json({ error: 'Erro ao buscar dados para o relatório.' });
        }
        res.json(results);
    });
});

// Endpoint: Obter todos os projetos - Visualização para todos (aberto)
app.get("/api/projetos", async (req, res) => { // This endpoint is open
    try {
        const [projetos] = await db.promise().query("SELECT * FROM projetos");

        if (projetos.length === 0) {
            return res.json([]);
        }

        const projetosComDados = await Promise.all(projetos.map(async (projeto) => {
            const [subEtapas] = await db.promise().query(
                "SELECT etapa_principal, concluida, data_prevista_conclusao FROM sub_etapas WHERE projeto_id = ?",
                [projeto.id]
            );

            const percentuaisPorEtapa = {};
            const atrasosPorEtapa = {};
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const totalStages = 7;
            const currentStageNumber = parseInt(projeto.etapa_atual);

            let completedMainStagesCount = 0;

            for (let i = 1; i <= totalStages; i++) {
                const subEtapasDaEtapa = subEtapas.filter(se => se.etapa_principal === i);
                const totalSubEtapas = subEtapasDaEtapa.length;
                let percentage = 0;
                let isDelayedForThisStage = false; 

                if (totalSubEtapas === 0) {
                    if (currentStageNumber > i) {
                        percentage = 100;
                    } else {
                        percentage = 0;
                        if (currentStageNumber === i && projeto[`data_fim_etapa${i}`]) {
                             const stepDeadline = new Date(projeto[`data_fim_etapa${i}`]);
                             stepDeadline.setHours(23, 59, 59, 999);
                             if (today > stepDeadline) {
                                 isDelayedForThisStage = true;
                             }
                        }
                    }
                } else {
                    const concluidas = subEtapasDaEtapa.filter(se => se.concluida).length;
                    percentage = (concluidas / totalSubEtapas) * 100;

                    if (percentage < 100) {
                        const hasDelayedSubTask = subEtapasDaEtapa.some(subTask => {
                            if (!subTask.concluida && subTask.data_prevista_conclusao) {
                                const subTaskDueDate = new Date(subTask.data_prevista_conclusao);
                                subTaskDueDate.setHours(23, 59, 59, 999);
                                return today > subTaskDueDate;
                            }
                            return false;
                        });

                        isDelayedForThisStage = hasDelayedSubTask; 
                    } else {
                        isDelayedForThisStage = false;
                    }
                }

                percentuaisPorEtapa[i] = percentage;
                atrasosPorEtapa[i] = isDelayedForThisStage; 

                if (percentage === 100) {
                    completedMainStagesCount++;
                }
            }

            let overallPercentConcluido = (completedMainStagesCount / totalStages) * 100;
            if (completedMainStagesCount === totalStages) { 
                overallPercentConcluido = 100;
            }
            projeto.percentual_concluido = overallPercentConcluido.toFixed(2); 

            let isProjectOverallDelayed = false;
            if (projeto.data_fim) {
                const projectOverallDeadline = new Date(projeto.data_fim);
                projectOverallDeadline.setHours(23, 59, 59, 999); 
                if (today > projectOverallDeadline && overallPercentConcluido < 100) {
                    isProjectOverallDelayed = true;
                }
            }

            return { ...projeto, percentuaisPorEtapa, atrasosPorEtapa };
        }));

        res.json(projetosComDados);

    } catch (err) {
        console.error("Erro ao buscar projetos com dados:", err);
        res.status(500).json({ error: "Erro ao buscar projetos no banco de dados." });
    }
});

// Endpoint: Obter projeto por ID - Visualização para todos (aberto)
app.get('/api/projetos/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM projetos WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('Erro ao buscar projeto:', err);
            return res.status(500).json({ error: 'Erro ao buscar projeto no banco de dados.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Projeto não encontrado.' });
        }
        res.json(results[0]);
    });
});

// Endpoint: Obter sub-etapas de um projeto - Visualização para todos (aberto)
app.get('/api/projetos/:id/sub-etapas', (req, res) => {
    const { id } = req.params;
    const { etapa } = req.query;
    
    let sql = 'SELECT * FROM sub_etapas WHERE projeto_id = ?';
    const params = [id];
    
    if (etapa) {
        sql += ' AND etapa_principal = ?';
        params.push(etapa);
    }
    
    sql += ' ORDER BY etapa_principal, id';
    
    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('Erro ao buscar sub-etapas:', err);
            return res.status(500).json({ error: 'Erro ao buscar sub-etapas no banco de dados.' });
        }
        res.json(results);
    });
});

// Endpoint: Adicionar sub-etapa a um projeto - Apenas para Diretoria, Coordenador e Líder
app.post('/api/projetos/:id/sub-etapas', authenticateToken, authorizeRole(['diretoria', 'coordenador', 'lider']), (req, res) => {
    const { id } = req.params;
    const { etapa_principal, descricao, data_prevista_conclusao } = req.body;
    
    if (!etapa_principal || !descricao) {
        return res.status(400).json({ error: 'Etapa principal e descrição são obrigatórios.' });
    }
    
    const sql = 'INSERT INTO sub_etapas (projeto_id, etapa_principal, descricao, data_prevista_conclusao) VALUES (?, ?, ?, ?)';
    db.query(sql, [id, etapa_principal, descricao, data_prevista_conclusao || null], (err, result) => {
        if (err) {
            console.error('Erro ao adicionar sub-etapa:', err);
            return res.status(500).json({ error: 'Erro ao adicionar sub-etapa no banco de dados.' });
        }
        res.status(201).json({ message: 'Sub-etapa adicionada com sucesso', id: result.insertId });
    });
});

// Endpoint: Atualizar sub-etapa - Apenas para Diretoria, Coordenador e Líder
app.put('/api/sub-etapas/:id', authenticateToken, authorizeRole(['diretoria', 'coordenador', 'lider']), (req, res) => {
    const { id } = req.params;
    const { descricao, concluida, data_prevista_conclusao } = req.body;
    
    const updateFields = [];
    const updateValues = [];
    
    if (descricao !== undefined) {
        updateFields.push('descricao = ?');
        updateValues.push(descricao);
    }
    
    if (data_prevista_conclusao !== undefined) {
        updateFields.push('data_prevista_conclusao = ?');
        updateValues.push(data_prevista_conclusao === '' ? null : data_prevista_conclusao);
    }
    
    if (concluida !== undefined) {
        updateFields.push('concluida = ?');
        updateValues.push(concluida ? 1 : 0);
        
        if (concluida) {
            updateFields.push('data_conclusao = NOW()');
        } else {
            updateFields.push('data_conclusao = NULL');
        }
    }
    
    if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }
    
    const sql = `UPDATE sub_etapas SET ${updateFields.join(', ')} WHERE id = ?`;
    db.query(sql, [...updateValues, id], (err) => {
        if (err) {
            console.error('Erro ao atualizar sub-etapa:', err);
            return res.status(500).json({ error: 'Erro ao atualizar sub-etapa no banco de dados.' });
        }
        res.json({ message: 'Sub-etapa atualizada com sucesso' });
    });
});

// Endpoint: Excluir sub-etapa - Apenas para Diretoria
app.delete('/api/sub-etapas/:id', authenticateToken, authorizeRole(['diretoria']), (req, res) => {
    const { id } = req.params;
    
    db.query('DELETE FROM sub_etapas WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Erro ao excluir sub-etapa:', err);
            return res.status(500).json({ error: 'Erro ao excluir sub-etapa no banco de dados.' });
        }
        res.json({ message: 'Sub-etapa excluída com sucesso' });
    });
});

// Endpoint: Cadastrar novo projeto - Apenas para Diretoria e Coordenador
app.post('/api/projetos', authenticateToken, authorizeRole(['diretoria', 'coordenador']), (req, res) => {
    const { 
        nome, 
        lider, 
        equipe, 
        etapa_atual = 1, 
        data_inicio, 
        data_fim,
        data_inicio_etapa1, data_fim_etapa1, 
        data_inicio_etapa2, data_fim_etapa2,
        data_inicio_etapa3, data_fim_etapa3,
        data_inicio_etapa4, data_fim_etapa4,
        data_inicio_etapa5, data_fim_etapa5,
        data_inicio_etapa6, data_fim_etapa6,
        data_inicio_etapa7, data_fim_etapa7,
        duracao_etapa1, duracao_etapa2, duracao_etapa3, 
        duracao_etapa4, duracao_etapa5, duracao_etapa6, duracao_etapa7
    } = req.body;
    
    if (!nome || !lider) {
        return res.status(400).json({ error: 'Nome e líder do projeto são obrigatórios.' });
    }

    let equipeJsonString = null;
    if (equipe) {
        if (typeof equipe === 'string') {
            const equipeArray = equipe.split(',').map(item => item.trim()).filter(item => item !== '');
            equipeJsonString = JSON.stringify(equipeArray);
        } else if (Array.isArray(equipe)) {
            equipeJsonString = JSON.stringify(equipe);
        }
    }

    const percentualConcluido = ((parseInt(etapa_atual) - 1) / 7) * 100;

    const sql = `
        INSERT INTO projetos (
            nome, lider, equipe_json, etapa_atual, data_inicio, data_fim, 
            percentual_concluido,
            data_inicio_etapa1, data_fim_etapa1, 
            data_inicio_etapa2, data_fim_etapa2,
            data_inicio_etapa3, data_fim_etapa3,
            data_inicio_etapa4, data_fim_etapa4,
            data_inicio_etapa5, data_fim_etapa5,
            data_inicio_etapa6, data_fim_etapa6,
            data_inicio_etapa7, data_fim_etapa7,
            duracao_etapa1, duracao_etapa2, duracao_etapa3, 
            duracao_etapa4, duracao_etapa5, duracao_etapa6, duracao_etapa7
        ) VALUES (
            ?, ?, ?, ?, ?, ?, 
            ?,
            ?, ?, 
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, ?, 
            ?, ?, ?, ?
        )
    `;
    
    db.query(sql, [
        nome, lider, equipeJsonString, parseInt(etapa_atual), data_inicio, data_fim, 
        percentualConcluido,
        data_inicio_etapa1, data_fim_etapa1, 
        data_inicio_etapa2, data_fim_etapa2,
        data_inicio_etapa3, data_fim_etapa3,
        data_inicio_etapa4, data_fim_etapa4,
        data_inicio_etapa5, data_fim_etapa5,
        data_inicio_etapa6, data_fim_etapa6,
        data_inicio_etapa7, data_fim_etapa7,
        duracao_etapa1, duracao_etapa2, duracao_etapa3, 
        duracao_etapa4, duracao_etapa5, duracao_etapa6, duracao_etapa7
    ], (err, result) => {
        if (err) {
            console.error('Erro ao cadastrar projeto:', err);
            return res.status(500).json({ error: 'Erro ao cadastrar projeto no banco de dados.' });
        }
        res.status(201).json({ message: 'Projeto cadastrado com sucesso', id: result.insertId });
    });
});

// Endpoint: Atualizar projeto existente - Apenas para Diretoria, Coordenador e Líder
app.put('/api/projetos/:id', authenticateToken, authorizeRole(['diretoria', 'coordenador', 'lider']), (req, res) => {
    const { id } = req.params;
    const { 
        nome, 
        lider, 
        equipe, 
        etapa_atual,
        data_inicio,
        data_fim,
        data_inicio_etapa1, data_fim_etapa1,
        data_inicio_etapa2, data_fim_etapa2,
        data_inicio_etapa3, data_fim_etapa3,
        data_inicio_etapa4, data_fim_etapa4,
        data_inicio_etapa5, data_fim_etapa5,
        data_inicio_etapa6, data_fim_etapa6,
        data_inicio_etapa7, data_fim_etapa7,
        duracao_etapa1, duracao_etapa2, duracao_etapa3,
        duracao_etapa4, duracao_etapa5, duracao_etapa6, duracao_etapa7
    } = req.body;

    if (!nome || !lider || !etapa_atual) {
        return res.status(400).json({ error: 'Nome, líder e etapa atual são obrigatórios para atualização.' });
    }

    let equipeJsonString = null;
    if (equipe) {
        if (typeof equipe === 'string') {
            const equipeArray = equipe.split(',').map(item => item.trim()).filter(item => item !== '');
            equipeJsonString = JSON.stringify(equipeArray);
        } else if (Array.isArray(equipe)) {
            equipeJsonString = JSON.stringify(equipe);
        } else {
            return res.status(400).json({ error: 'Formato de equipe inválido. Deve ser uma string ou um array.' });
        }
    }

    const percentualConcluido = ((parseInt(etapa_atual) - 1) / 7) * 100;

    const sql = `
        UPDATE projetos
        SET nome = ?, 
            lider = ?, 
            equipe_json = ?, 
            etapa_atual = ?,
            data_inicio = ?,
            data_fim = ?,
            percentual_concluido = ?,
            data_inicio_etapa1 = ?, data_fim_etapa1 = ?,
            data_inicio_etapa2 = ?, data_fim_etapa2 = ?,
            data_inicio_etapa3 = ?, data_fim_etapa3 = ?,
            data_inicio_etapa4 = ?, data_fim_etapa4 = ?,
            data_inicio_etapa5 = ?, data_fim_etapa5 = ?,
            data_inicio_etapa6 = ?, data_fim_etapa6 = ?,
            data_inicio_etapa7 = ?, data_fim_etapa7 = ?,
            duracao_etapa1 = ?, duracao_etapa2 = ?, duracao_etapa3 = ?,
            duracao_etapa4 = ?, duracao_etapa5 = ?, duracao_etapa6 = ?, duracao_etapa7 = ?
        WHERE id = ?
    `;

    db.query(sql, [
        nome, 
        lider, 
        equipeJsonString, 
        parseInt(etapa_atual),
        data_inicio,
        data_fim,
        percentualConcluido,
        data_inicio_etapa1, data_fim_etapa1,
        data_inicio_etapa2, data_fim_etapa2,
        data_inicio_etapa3, data_fim_etapa3,
        data_inicio_etapa4, data_fim_etapa4,
        data_inicio_etapa5, data_fim_etapa5,
        data_inicio_etapa6, data_fim_etapa6,
        data_inicio_etapa7, data_fim_etapa7,
        duracao_etapa1, duracao_etapa2, duracao_etapa3,
        duracao_etapa4, duracao_etapa5, duracao_etapa6, duracao_etapa7,
        id
    ], (err) => {
        if (err) {
            console.error('Erro ao atualizar projeto:', err);
            return res.status(500).json({ error: 'Erro ao atualizar projeto no banco de dados.' });
        }
        res.json({ message: 'Projeto atualizado com sucesso' });
    });
});

// Endpoint: Deletar projeto - Apenas para Diretoria
app.delete('/api/projetos/:id', authenticateToken, authorizeRole(['diretoria']), (req, res) => {
    const { id } = req.params;
    
    db.query('DELETE FROM projetos WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Erro ao excluir projeto:', err);
            return res.status(500).json({ error: 'Erro ao excluir projeto no banco de dados.' });
        }
        res.json({ message: 'Projeto excluído com sucesso' });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

// Endpoint: Gerar PDF do relatório (usando FPDF2 em vez de pdfkit)
app.post('/api/relatorio/pdf', async (req, res) => {
    const { data, summaryData, startDate, endDate } = req.body;

    if (!data || !summaryData || !startDate || !endDate) {
        return res.status(400).json({ error: 'Dados insuficientes para gerar o PDF.' });
    }

    try {
        const startDateFormatted = new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR');
        const endDateFormatted = new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR');
        
        // Construct the HTML content (similar to what you have now)
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Produção</title>
                <style>
                    /* Include all relevant CSS from styles.css here or link it if accessible by Puppeteer */
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1, h2 { color: #007bff; text-align: center; }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 15px;
                        margin-bottom: 30px;
                    }
                    .summary-item {
                        border: 1px solid #ddd;
                        padding: 15px;
                        border-left: 4px solid #007bff;
                    }
                    .summary-label {
                        font-weight: bold;
                        color: #666;
                        margin-bottom: 5px;
                    }
                    .summary-value {
                        font-size: 1.2em;
                        font-weight: bold;
                        color: #333;
                    }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                    thead { background-color: #f8f9fa; }
                </style>
            </head>
            <body>
                <h1>RELATÓRIO DE PRODUÇÃO</h1>
                <h3 style="text-align: center;">Período: ${startDateFormatted} até ${endDateFormatted}</h3>
                
                <h2>RESUMO DO PERÍODO</h2>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">Peças Estimadas:</div>
                        <div class="summary-value">${summaryData.caixasEstimadas} cx (${summaryData.totalMeta} peças)</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Peças Produzidas:</div>
                        <div class="summary-value">${summaryData.caixasProduzidas} cx (${summaryData.totalProduzido} peças)</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Total Aprovados:</div>
                        <div class="summary-value">${summaryData.totalAprovado} peças</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Total Reprovados:</div>
                        <div class="summary-value">${summaryData.totalReprovado} peças</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">% Aprovados:</div>
                        <div class="summary-value">${summaryData.percentAprovados}%</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">% Reprovados:</div>
                        <div class="summary-value">${summaryData.percentReprovados}%</div>
                    </div>
                </div>
                
                <h2>DETALHES POR DIA</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Meta (peças)</th>
                            <th>Produzido (peças)</th>
                            <th>Aprovado (peças)</th>
                            <th>Reprovado (peças)</th>
                            <th>% Aprovado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(item => `
                            <tr>
                                <td>${new Date(item.report_date).toLocaleDateString('pt-BR')}</td>
                                <td>${item.meta_dia_total || 0}</td>
                                <td>${item.total_produzido_dia || 0}</td>
                                <td>${(item.total_produzido_dia || 0) - (item.total_reprovado_dia || 0)}</td>
                                <td>${item.total_reprovado_dia || 0}</td>
                                <td>${((item.total_produzido_dia || 0) > 0) ? (((item.total_produzido_dia || 0) - (item.total_reprovado_dia || 0)) / (item.total_produzido_dia || 0) * 100).toFixed(2) : '0.00'}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true }); // printBackground for colors

        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=relatorio_producao_${startDateFormatted.replace(/\//g, '_')}_${endDateFormatted.replace(/\//g, '_')}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Erro ao gerar relatório PDF:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório PDF.' });
    }
});