// server.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs'); // Não está sendo usado para hashing, mas o import está presente.
const jwt = require('jsonwebtoken');


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

// Chave Secreta para JWT (deve ser armazenada em variáveis de ambiente em produção)
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

// Middleware de autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Middleware de autorização baseado no papel do usuário
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

// Endpoint: Login
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

        // Lógica original: comparação direta de senha (não hashed)
        const passwordMatch = (password === user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        const accessToken = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login bem-sucedido', accessToken: accessToken, role: user.role, username: user.username });

    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ error: 'Erro interno do servidor durante o login.' });
    }
});

// Endpoint: Indicadores (Dashboard Principal) - Acesso liberado para todos
app.get('/api/indicadores', (req, res) => {
    const { selectedDate } = req.query;

    let queryProducao = `SELECT HOUR(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) as hora, SUM(CAST(qtd_dados AS UNSIGNED)) as total_pecas FROM dados_hora_a_hora`;
    let queryMeta = `SELECT meta FROM meta_dia WHERE STR_TO_DATE(data_hora, '%d/%m/%Y') = CURDATE()`;
    let queryTotalPecas = `SELECT SUM(CAST(qtd_dados AS UNSIGNED)) as totalPecasProduzidas FROM dados_hora_a_hora`;
    let queryReprovados = `SELECT SUM(CAST(qtd AS UNSIGNED)) as totalReprovados FROM eficiencia WHERE flag = 'rejeitada'`;

    const queryParams = [];

    if (selectedDate) {
        queryProducao += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = STR_TO_DATE(?, '%Y-%m-%d')`;
        queryTotalPecas += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = STR_TO_DATE(?, '%Y-%m-%d')`;
        queryReprovados += ` AND DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = STR_TO_DATE(?, '%Y-%m-%d')`;
        queryMeta = `SELECT meta FROM meta_dia WHERE STR_TO_DATE(data_hora, '%d/%m/%Y') = STR_TO_DATE(?, '%Y-%m-%d')`;
        queryParams.push(selectedDate, selectedDate, selectedDate, selectedDate);
    } else {
        queryProducao += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = CURDATE()`;
        queryTotalPecas += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = CURDATE()`;
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

                db.query(queryReprovados, queryParams.slice(2, 3), (err, reprovadosResult) => {
                    if (err) {
                        console.error('Erro ao buscar total de reprovados:', err);
                        return res.status(500).json({ error: 'Erro ao buscar total de reprovados.' });
                    }

                    const totalPecasProduzidas = Number(totalPecasResult[0]?.totalPecasProduzidas) || 0;
                    const totalReprovados = Number(reprovadosResult[0]?.totalReprovados) || 0;
                    const totalAprovados = totalPecasProduzidas - totalReprovados;

                    res.json({
                        producaoPorHora,
                        metaDiaria: metaDiaria.length > 0 ? metaDiaria : [{ meta: 0 }],
                        totalPecasProduzidas,
                        totalAprovados,
                        totalReprovados
                    });
                });
            });
        });
    });
});

// Endpoint: Atualizar meta diária - Apenas para Diretoria e Coordenador
app.put('/api/meta_dia', authenticateToken, authorizeRole(['diretoria', 'coordenador']), (req, res) => {
    const { date, meta } = req.body;

    if (!date || meta === undefined || meta < 0) {
        return res.status(400).json({ error: 'Data e meta válidas são obrigatórias.' });
    }

    const checkSql = `SELECT id FROM meta_dia WHERE data_hora = ?`;
    db.query(checkSql, [date], (err, results) => {
        if (err) {
            console.error('Erro ao verificar meta existente:', err);
            return res.status(500).json({ error: 'Erro ao verificar meta diária no banco de dados.' });
        }

        if (results.length > 0) {
            const updateSql = `UPDATE meta_dia SET meta = ? WHERE id = ?`;
            db.query(updateSql, [meta, results[0].id], (err, updateResult) => {
                if (err) {
                    console.error('Erro ao atualizar meta diária:', err);
                    return res.status(500).json({ error: 'Erro ao atualizar meta diária no banco de dados.' });
                }
                res.json({ message: 'Meta diária atualizada com sucesso.' });
            });
        } else {
            const insertSql = `INSERT INTO meta_dia (data_hora, meta) VALUES (?, ?)`;
            db.query(insertSql, [date, meta], (err, insertResult) => {
                if (err) {
                    console.error('Erro ao inserir nova meta diária:', err);
                    return res.status(500).json({ error: 'Erro ao inserir nova meta diária no banco de dados.' });
                }
                res.status(201).json({ message: 'Meta diária registrada com sucesso.' });
            });
        }
    });
});


// Endpoint: Registrar Produção - Apenas para Diretoria, Coordenador e Líder
app.post('/api/producao', authenticateToken, authorizeRole(['diretoria', 'coordenador', 'lider']), (req, res) => {
    const { qtdDados, dataHora } = req.body;
    if (qtdDados === undefined || qtdDados < 0 || !dataHora) {
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

// Endpoint: Registrar Eficiência (Peças Reprovadas) - Apenas para Diretoria, Coordenador e Líder
app.post('/api/eficiencia', authenticateToken, authorizeRole(['diretoria', 'coordenador', 'lider']), (req, res) => {
    const { qtd, flag, dataHora } = req.body;
    
    if (qtd === undefined || qtd < 0 || !flag || flag !== 'rejeitada' || !dataHora) {
        return res.status(400).json({ error: 'Quantidade, flag (rejeitada) e data/hora válidas são obrigatórias para registrar eficiência.' });
    }

    const sql = 'INSERT INTO eficiencia (qtd, flag, data_hora) VALUES (?, ?, ?)';
    db.query(sql, [qtd, flag, dataHora], (err, result) => {
        if (err) {
            console.error('Erro ao inserir dados de eficiência (reprovados):', err);
            return res.status(500).json({ error: 'Erro ao registrar peças reprovadas no banco de dados.' });
        }
        res.status(201).json({ message: 'Registro de eficiência (peças reprovadas) realizado com sucesso', id: result.insertId });
    });
});

// Endpoint: Gerar Relatório de Produção por Período - Acesso liberado para todos
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
                SUM(CAST(qtd_dados AS UNSIGNED)) AS daily_produzido_total_boxes_raw
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
                SUM(CAST(qtd AS UNSIGNED)) AS daily_reprovado_total_pieces_raw
            FROM
                eficiencia
            WHERE
                flag = 'rejeitada' AND DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
            GROUP BY
                rejected_date
        )
        SELECT
            DS.report_date,
            COALESCE(MAX(PD.daily_produzido_total_boxes_raw), 0) AS total_produzido_dia,
            COALESCE(MAX(RD.daily_reprovado_total_pieces_raw), 0) AS total_reprovado_dia,
            COALESCE(MAX(MD.meta), 0) AS meta_dia_total
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

// Endpoint: Obter todos os projetos - Acesso liberado para todos
app.get("/api/projetos", async (req, res) => {
    let sql = "SELECT * FROM projetos";
    const params = [];

    try {
        const [projetos] = await db.promise().query(sql, params);

        if (projetos.length === 0) {
            return res.json([]);
        }

        const projetosComDados = await Promise.all(projetos.map(async (projeto) => {
            // Busca as etapas customizadas para o projeto
            const [customEtapas] = await db.promise().query(
                "SELECT id, ordem, nome_etapa, data_inicio, data_fim, duracao_planejada_dias FROM projeto_etapas WHERE projeto_id = ? ORDER BY ordem",
                [projeto.id]
            );

            // Busca todas as sub-etapas para o projeto
            const [subEtapas] = await db.promise().query(
                "SELECT projeto_etapa_id, concluida, data_prevista_conclusao, data_conclusao FROM sub_etapas WHERE projeto_id = ?",
                [projeto.id]
            );

            const percentuaisPorEtapa = {};
            const atrasosPorEtapa = {};
            const statusPorEtapa = {};
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (customEtapas.length === 0) {
                // Se não há etapas customizadas, o projeto é considerado 0% concluído e pendente.
                projeto.percentual_concluido = 0.00;
                projeto.status = "pendente";
                return { ...projeto, customEtapas: [], percentuaisPorEtapa: {}, atrasosPorEtapa: {}, statusPorEtapa: {} };
            }

            for (const etapa of customEtapas) {
                const subEtapasDaEtapa = subEtapas.filter(se => se.projeto_etapa_id === etapa.id);
                const totalSubEtapas = subEtapasDaEtapa.length;
                let percentage = 0;
                let isDelayedForThisStage = false;
                let stageStatus = "pendente";

                if (totalSubEtapas === 0) {
                    // Lógica para etapas sem sub-etapas (baseada nas datas da própria etapa customizada)
                    const dataInicioEtapa = etapa.data_inicio ? new Date(etapa.data_inicio) : null;
                    const dataFimEtapa = etapa.data_fim ? new Date(etapa.data_fim) : null;

                    if (dataInicioEtapa && dataFimEtapa) {
                        if (today < dataInicioEtapa) {
                            percentage = 0;
                            stageStatus = "pendente";
                        } else if (today >= dataFimEtapa) {
                            percentage = 100;
                            stageStatus = "concluído";
                        } else {
                            const totalTime = dataFimEtapa.getTime() - dataInicioEtapa.getTime();
                            const elapsedTime = today.getTime() - dataInicioEtapa.getTime();
                            percentage = Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));
                            stageStatus = "andamento";
                        }
                    } else if (dataFimEtapa && today >= dataFimEtapa) {
                        percentage = 100; // Se a data final passou e não tem sub-etapas, considera concluída
                        stageStatus = "concluído";
                    } else if (dataInicioEtapa && today >= dataInicioEtapa) {
                        percentage = 50; // Assume 50% se iniciado, mas sem data final ou sub-tarefas
                        stageStatus = "andamento";
                    } else {
                        percentage = 0;
                        stageStatus = "pendente";
                    }

                    if (dataFimEtapa && today > dataFimEtapa && percentage < 100) {
                        isDelayedForThisStage = true;
                        stageStatus = "atrasado";
                    }
                } else {
                    // Lógica para etapas COM sub-etapas
                    const concluidas = subEtapasDaEtapa.filter(se => se.concluida).length;
                    percentage = (concluidas / totalSubEtapas) * 100;

                    const hasDelayedSubTask = subEtapasDaEtapa.some(subTask => {
                        if (!subTask.concluida && subTask.data_prevista_conclusao) {
                            const subTaskDueDate = new Date(subTask.data_prevista_conclusao);
                            subTaskDueDate.setHours(0, 0, 0, 0);
                            return today > subTaskDueDate;
                        }
                        return false;
                    });
                    isDelayedForThisStage = hasDelayedSubTask;

                    const hasInProgressSubTask = subEtapasDaEtapa.some(subTask => {
                        if (!subTask.concluida) {
                            if (subTask.data_prevista_conclusao) {
                                const subTaskDueDate = new Date(subTask.data_prevista_conclusao);
                                subTaskDueDate.setHours(0,0,0,0);
                                return today <= subTaskDueDate;
                            }
                            return true; // Não tem data prevista, mas não está concluída, então está em andamento
                        }
                        return false;
                    });

                    if (percentage === 100) {
                        stageStatus = "concluído";
                    } else if (isDelayedForThisStage) {
                        stageStatus = "atrasado";
                    } else if (percentage > 0 || hasInProgressSubTask) {
                        stageStatus = "andamento";
                    } else {
                        stageStatus = "pendente";
                    }
                }
                
                percentuaisPorEtapa[etapa.id] = parseFloat(percentage.toFixed(2));
                atrasosPorEtapa[etapa.id] = isDelayedForThisStage;
                statusPorEtapa[etapa.id] = stageStatus;
            }
            
            // Calcula o percentual de conclusão geral do projeto como a média das porcentagens de cada etapa
            let sumOfStagePercentages = 0;
            let totalStagesConsidered = 0;
            for (const etapa of customEtapas) {
                sumOfStagePercentages += (percentuaisPorEtapa[etapa.id] || 0);
                totalStagesConsidered++;
            }
            let overallPercentConcluido = totalStagesConsidered > 0 ? sumOfStagePercentages / totalStagesConsidered : 0;
            projeto.percentual_concluido = parseFloat(overallPercentConcluido.toFixed(2));
            
            // Determina o status geral do projeto
            let projetoStatus = "pendente";
            const allStagesCompleted = customEtapas.length > 0 && Object.values(percentuaisPorEtapa).every(p => p === 100);
            
            if (allStagesCompleted) {
                projetoStatus = "concluído";
            } else {
                const anyStageDelayed = Object.values(atrasosPorEtapa).some(d => d === true);
                if (anyStageDelayed) {
                    projetoStatus = "atrasado";
                } else {
                    const anyStageInProgress = Object.values(statusPorEtapa).some(s => s === 'andamento');
                    const isWithinProjectDates = projeto.data_inicio && projeto.data_fim && 
                                              today >= new Date(projeto.data_inicio) && 
                                              today <= new Date(projeto.data_fim);
                    
                    if (anyStageInProgress || overallPercentConcluido > 0 || isWithinProjectDates) {
                        projetoStatus = "andamento";
                    }
                }
            }
            projeto.status = projetoStatus;
            
            return { ...projeto, customEtapas, percentuaisPorEtapa, atrasosPorEtapa, statusPorEtapa };
        }));

        res.json(projetosComDados);

    } catch (err) {
        console.error("Erro ao buscar projetos com dados:", err);
        res.status(500).json({ error: "Erro ao buscar projetos no banco de dados." });
    }
});

// Endpoint: Obter projeto por ID - Acesso liberado para todos
app.get('/api/projetos/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const [projetoResults] = await db.promise().query('SELECT * FROM projetos WHERE id = ?', [id]);
        
        if (projetoResults.length === 0) {
            return res.status(404).json({ error: 'Projeto não encontrado.' });
        }
        
        const projeto = projetoResults[0];
        
        // Busca as etapas customizadas para o projeto
        const [customEtapas] = await db.promise().query(
            "SELECT id, ordem, nome_etapa, data_inicio, data_fim, duracao_planejada_dias FROM projeto_etapas WHERE projeto_id = ? ORDER BY ordem",
            [projeto.id]
        );

        // Busca todas as sub-etapas para o projeto
        const [subEtapas] = await db.promise().query(
            "SELECT projeto_etapa_id, concluida, data_prevista_conclusao, data_conclusao FROM sub_etapas WHERE projeto_id = ?",
            [projeto.id]
        );
        
        const percentuaisPorEtapa = {};
        const atrasosPorEtapa = {};
        const statusPorEtapa = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (customEtapas.length === 0) {
             projeto.percentual_concluido = 0.00;
             projeto.status = "pendente";
             return res.json({ ...projeto, customEtapas: [], percentuaisPorEtapa: {}, atrasosPorEtapa: {}, statusPorEtapa: {} });
        }

        for (const etapa of customEtapas) {
            const subEtapasDaEtapa = subEtapas.filter(se => se.projeto_etapa_id === etapa.id);
            const totalSubEtapas = subEtapasDaEtapa.length;
            let percentage = 0;
            let isDelayedForThisStage = false;
            let stageStatus = "pendente";
            
            if (totalSubEtapas === 0) {
                const dataInicioEtapa = etapa.data_inicio ? new Date(etapa.data_inicio) : null;
                const dataFimEtapa = etapa.data_fim ? new Date(etapa.data_fim) : null;
                
                if (dataInicioEtapa && dataFimEtapa) {
                    if (today < dataInicioEtapa) {
                        percentage = 0;
                        stageStatus = "pendente";
                    } else if (today >= dataFimEtapa) {
                        percentage = 100;
                        stageStatus = "concluído";
                    } else {
                        const totalTime = dataFimEtapa.getTime() - dataInicioEtapa.getTime();
                        const elapsedTime = today.getTime() - dataInicioEtapa.getTime();
                        percentage = Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));
                        stageStatus = "andamento";
                    }
                } else if (dataFimEtapa && today >= dataFimEtapa) {
                    percentage = 100;
                    stageStatus = "concluído";
                } else if (dataInicioEtapa && today >= dataInicioEtapa) {
                    percentage = 50;
                    stageStatus = "andamento";
                } else {
                    percentage = 0;
                    stageStatus = "pendente";
                }

                if (dataFimEtapa && today > dataFimEtapa && percentage < 100) {
                    isDelayedForThisStage = true;
                    stageStatus = "atrasado";
                }
            } else {
                const concluidas = subEtapasDaEtapa.filter(se => se.concluida).length;
                percentage = (concluidas / totalSubEtapas) * 100;
                
                const hasDelayedSubTask = subEtapasDaEtapa.some(subTask => {
                    if (!subTask.concluida && subTask.data_prevista_conclusao) {
                        const subTaskDueDate = new Date(subTask.data_prevista_conclusao);
                        subTaskDueDate.setHours(0, 0, 0, 0);
                        return today > subTaskDueDate;
                    }
                    return false;
                });
                isDelayedForThisStage = hasDelayedSubTask;
                
                const hasInProgressSubTask = subEtapasDaEtapa.some(subTask => {
                    if (!subTask.concluida) {
                        if (subTask.data_prevista_conclusao) {
                            const subTaskDueDate = new Date(subTask.data_prevista_conclusao);
                            subTaskDueDate.setHours(0,0,0,0);
                            return today <= subTaskDueDate;
                        }
                        return true;
                    }
                    return false;
                });
                
                if (percentage === 100) {
                    stageStatus = "concluído";
                } else if (isDelayedForThisStage) {
                    stageStatus = "atrasado";
                } else if (percentage > 0 || hasInProgressSubTask) {
                    stageStatus = "andamento";
                } else {
                    stageStatus = "pendente";
                }
            }
            
            percentuaisPorEtapa[etapa.id] = parseFloat(percentage.toFixed(2));
            atrasosPorEtapa[etapa.id] = isDelayedForThisStage;
            statusPorEtapa[etapa.id] = stageStatus;
        }
        
        let sumOfStagePercentages = 0;
        let totalStagesConsidered = 0;
        for (const etapa of customEtapas) {
            sumOfStagePercentages += (percentuaisPorEtapa[etapa.id] || 0);
            totalStagesConsidered++;
        }
        let overallPercentConcluido = totalStagesConsidered > 0 ? sumOfStagePercentages / totalStagesConsidered : 0;
        projeto.percentual_concluido = parseFloat(overallPercentConcluido.toFixed(2));
        
        let projetoStatus = "pendente";
        const allStagesCompleted = customEtapas.length > 0 && Object.values(percentuaisPorEtapa).every(p => p === 100);
        
        if (allStagesCompleted) {
            projetoStatus = "concluído";
        } else {
            const anyStageDelayed = Object.values(atrasosPorEtapa).some(d => d === true);
            if (anyStageDelayed) {
                projetoStatus = "atrasado";
            } else {
                const anyStageInProgress = Object.values(statusPorEtapa).some(s => s === 'andamento');
                const isWithinProjectDates = projeto.data_inicio && projeto.data_fim && 
                                              today >= new Date(projeto.data_inicio) && 
                                              today <= new Date(projeto.data_fim);
                
                if (anyStageInProgress || overallPercentConcluido > 0 || isWithinProjectDates) {
                    projetoStatus = "andamento";
                }
            }
        }
        projeto.status = projetoStatus;
        
        res.json({
            ...projeto,
            customEtapas, // Envia as etapas customizadas para o frontend
            percentuaisPorEtapa,
            atrasosPorEtapa,
            statusPorEtapa
        });
        
    } catch (err) {
        console.error('Erro ao buscar projeto:', err);
        res.status(500).json({ error: 'Erro ao buscar projeto no banco de dados.' });
    }
});

// Endpoint: Obter uma etapa específica por ID (NOVO)
app.get('/api/etapas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [etapaResults] = await db.promise().query('SELECT * FROM projeto_etapas WHERE id = ?', [id]);
        if (etapaResults.length === 0) {
            return res.status(404).json({ error: 'Etapa não encontrada.' });
        }
        res.json(etapaResults[0]);
    } catch (err) {
        console.error('Erro ao buscar etapa:', err);
        res.status(500).json({ error: 'Erro ao buscar etapa no banco de dados.' });
    }
});

// Endpoint: Adicionar uma etapa a um projeto (NOVO)
app.post('/api/projetos/:id/etapas', authenticateToken, authorizeRole(['diretoria', 'coordenador']), async (req, res) => {
    const { id: projeto_id } = req.params;
    const { nome_etapa, ordem, data_inicio, data_fim, duracao_planejada_dias } = req.body;

    if (!nome_etapa || ordem === undefined || ordem < 1) {
        return res.status(400).json({ error: 'Nome da etapa e ordem são obrigatórios.' });
    }

    try {
        const [result] = await db.promise().query(
            'INSERT INTO projeto_etapas (projeto_id, ordem, nome_etapa, data_inicio, data_fim, duracao_planejada_dias) VALUES (?, ?, ?, ?, ?, ?)',
            [projeto_id, ordem, nome_etapa, data_inicio || null, data_fim || null, duracao_planejada_dias || null]
        );
        res.status(201).json({ message: 'Etapa adicionada com sucesso', id: result.insertId });
    } catch (err) {
        console.error('Erro ao adicionar etapa do projeto:', err);
        res.status(500).json({ error: 'Erro ao adicionar etapa do projeto no banco de dados.' });
    }
});

// Endpoint: Atualizar uma etapa específica (NOVO)
app.put('/api/etapas/:id', authenticateToken, authorizeRole(['diretoria', 'coordenador']), async (req, res) => {
    const { id } = req.params;
    const { nome_etapa, data_inicio, data_fim, duracao_planejada_dias, ordem } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (nome_etapa !== undefined) {
        updateFields.push('nome_etapa = ?');
        updateValues.push(nome_etapa);
    }
    if (data_inicio !== undefined) {
        updateFields.push('data_inicio = ?');
        updateValues.push(data_inicio || null);
    }
    if (data_fim !== undefined) {
        updateFields.push('data_fim = ?');
        updateValues.push(data_fim || null);
    }
    if (duracao_planejada_dias !== undefined) {
        updateFields.push('duracao_planejada_dias = ?');
        updateValues.push(duracao_planejada_dias || null);
    }
    if (ordem !== undefined) {
        updateFields.push('ordem = ?');
        updateValues.push(ordem);
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    try {
        const [result] = await db.promise().query(
            `UPDATE projeto_etapas SET ${updateFields.join(', ')} WHERE id = ?`,
            [...updateValues, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Etapa não encontrada.' });
        }
        res.json({ message: 'Etapa atualizada com sucesso' });
    } catch (err) {
        console.error('Erro ao atualizar etapa:', err);
        res.status(500).json({ error: 'Erro ao atualizar etapa no banco de dados.' });
    }
});

// Endpoint: Excluir uma etapa específica (NOVO)
app.delete('/api/etapas/:id', authenticateToken, authorizeRole(['diretoria']), async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.promise().query('DELETE FROM projeto_etapas WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Etapa não encontrada.' });
        }
        res.json({ message: 'Etapa excluída com sucesso' });
    } catch (err) {
        console.error('Erro ao excluir etapa:', err);
        res.status(500).json({ error: 'Erro ao excluir etapa no banco de dados.' });
    }
});

// Endpoint: Obter sub-etapas de um projeto (atualizado para usar projeto_etapa_id)
app.get('/api/projetos/:id/sub-etapas', (req, res) => {
    const { id: projeto_id } = req.params;
    const { etapa_id } = req.query; // Novo parâmetro: etapa_id (ID da etapa customizada)

    let sql = 'SELECT * FROM sub_etapas WHERE projeto_id = ?';
    const params = [projeto_id];

    if (etapa_id) { // Agora filtra pelo ID da etapa da tabela projeto_etapas
        sql += ' AND projeto_etapa_id = ?';
        params.push(etapa_id);
    }

    sql += ' ORDER BY id'; // Ordem por id ou data_criacao

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('Erro ao buscar sub-etapas:', err);
            return res.status(500).json({ error: 'Erro ao buscar sub-etapas no banco de dados.' });
        }
        res.json(results);
    });
});

// Endpoint: Adicionar sub-etapa a um projeto (atualizado para usar projeto_etapa_id)
app.post('/api/projetos/:id/sub-etapas', authenticateToken, authorizeRole(['diretoria', 'coordenador', 'lider']), (req, res) => {
    const { id: projeto_id } = req.params;
    const { projeto_etapa_id, descricao, data_prevista_conclusao } = req.body;

    if (!projeto_etapa_id || !descricao) { // <--- VALIDAÇÃO AQUI
        return res.status(400).json({ error: 'ID da etapa e descrição são obrigatórios.' });
    }

    const sql = 'INSERT INTO sub_etapas (projeto_id, projeto_etapa_id, descricao, data_prevista_conclusao) VALUES (?, ?, ?, ?)';
    db.query(sql, [projeto_id, projeto_etapa_id, descricao, data_prevista_conclusao || null], (err, result) => {
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

// Endpoint: Cadastrar novo projeto (atualizado para remover colunas de etapas fixas)
app.post('/api/projetos', authenticateToken, authorizeRole(['diretoria', 'coordenador']), async (req, res) => {
    const {
        nome,
        lider,
        equipe,
        data_inicio,
        data_fim
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

    const sql = `
        INSERT INTO projetos (
            nome, lider, equipe_json, data_inicio, data_fim
        ) VALUES (?, ?, ?, ?, ?)
    `;

    try {
        const [result] = await db.promise().query(sql, [
            nome, lider, equipeJsonString, data_inicio, data_fim
        ]);
        res.status(201).json({ message: 'Projeto cadastrado com sucesso', id: result.insertId });
    } catch (err) {
        console.error('Erro ao cadastrar projeto:', err);
        return res.status(500).json({ error: 'Erro ao cadastrar projeto no banco de dados.' });
    }
});

// Endpoint: Atualizar projeto (atualizado para remover colunas de etapas fixas)
app.put('/api/projetos/:id', authenticateToken, authorizeRole(['diretoria', 'coordenador']), async (req, res) => {
    const { id } = req.params;
    const {
        nome,
        lider,
        equipe,
        data_inicio,
        data_fim
    } = req.body;

    try {
        const [results] = await db.promise().query('SELECT * FROM projetos WHERE id = ?', [id]);
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Projeto não encontrado.' });
        }

        const updateFields = [];
        const updateValues = [];

        if (nome !== undefined) {
            updateFields.push('nome = ?');
            updateValues.push(nome);
        }

        if (lider !== undefined) {
            updateFields.push('lider = ?');
            updateValues.push(lider);
        }

        if (equipe !== undefined) {
            let equipeJsonString = null;
            if (typeof equipe === 'string') {
                const equipeArray = equipe.split(',').map(item => item.trim()).filter(item => item !== '');
                equipeJsonString = JSON.stringify(equipeArray);
            } else if (Array.isArray(equipe)) {
                equipeJsonString = JSON.stringify(equipe);
            }
            updateFields.push('equipe_json = ?');
            updateValues.push(equipeJsonString);
        }

        if (data_inicio !== undefined) {
            updateFields.push('data_inicio = ?');
            updateValues.push(data_inicio);
        }

        if (data_fim !== undefined) {
            updateFields.push('data_fim = ?');
            updateValues.push(data_fim);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
        }

        const sql = `UPDATE projetos SET ${updateFields.join(', ')} WHERE id = ?`;
        await db.promise().query(sql, [...updateValues, id]);
        
        res.json({ message: 'Projeto atualizado com sucesso' });

    } catch (err) {
        console.error('Erro ao atualizar projeto:', err);
        res.status(500).json({ error: 'Erro ao atualizar projeto no banco de dados.' });
    }
});

// Endpoint: Excluir projeto - Apenas para Diretoria
app.delete('/api/projetos/:id', authenticateToken, authorizeRole(['diretoria']), async (req, res) => {
    const { id } = req.params;

    try {
        const [results] = await db.promise().query('SELECT * FROM projetos WHERE id = ?', [id]);
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Projeto não encontrado.' });
        }

        await db.promise().query('DELETE FROM projetos WHERE id = ?', [id]);
        
        res.json({ message: 'Projeto excluído com sucesso' });
    } catch (err) {
        console.error('Erro ao excluir projeto:', err);
        res.status(500).json({ error: 'Erro ao excluir projeto no banco de dados.' });
    }
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});