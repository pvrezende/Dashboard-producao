let productionChart = null;
const API_BASE_URL = 'http://localhost:3000/api';
let lastReportData = null; // Variável para armazenar os dados do último relatório gerado

// Função para buscar dados da API
async function fetchData(endpoint, params = {}) {
    const url = new URL(`${API_BASE_URL}/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Erro ao buscar ${endpoint}:`, error);
        showError(`Erro ao carregar dados: ${error.message}`);
        return null;
    }
}

// Exibe erro na tela
function showError(message) {
    let container = document.getElementById('error-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'error-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.padding = '15px';
        container.style.backgroundColor = '#f44336';
        container.style.color = 'white';
        container.style.borderRadius = '5px';
        container.style.zIndex = '1000';
        document.body.appendChild(container);
    }
    container.textContent = message;
    container.style.display = 'block';
    setTimeout(() => container.style.display = 'none', 6000);
}

// Atualiza o gráfico de produção hora a hora
function updateProductionChart(hourlyData) {
    const ctx = document.getElementById('oeeChart').getContext('2d');
    if (!ctx || !hourlyData || hourlyData.length === 0) {
        if (productionChart) {
            productionChart.destroy();
            productionChart = null;
        }
        return;
    }

    if (productionChart) productionChart.destroy();

    const filteredData = hourlyData.filter(item => item.hora >= 6 && item.hora <= 16);

    const labels = filteredData.map(item => `${item.hora.toString().padStart(2, '0')}:00`);
    const data = filteredData.map(item => item.quantidade);

    const metaTotalCaixas = (window.metaPecasEstimadas || 0) / 12;
    const metaPorHora = metaTotalCaixas / 8.3;
    const metaData = filteredData.map(() => parseFloat(metaPorHora.toFixed(2)));

    const chartTimeRangeEl = document.querySelector('.chart-time-range');
    if (chartTimeRangeEl) {
        chartTimeRangeEl.textContent = `Período: 06:00 - 16:00`;
    } else {
        const timeRangeEl = document.createElement('div');
        timeRangeEl.className = 'chart-time-range';
        timeRangeEl.style.textAlign = 'center';
        timeRangeEl.style.marginBottom = '15px';
        timeRangeEl.style.fontWeight = 'bold';
        timeRangeEl.textContent = `Período: 06:00 - 16:00`;
        document.querySelector('.oee-chart-container').insertBefore(timeRangeEl, document.querySelector('.chart-container'));
    }

    productionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Produção',
                    data: data,
                    backgroundColor: 'rgba(74, 144, 226, 0.2)',
                    borderColor: 'rgba(74, 144, 226, 1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: 'rgba(74, 144, 226, 1)',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointHitRadius: 10,
                    fill: true,
                    tension: 0.1
                },
                {
                    label: 'Meta por Hora',
                    data: metaData,
                    borderColor: 'orange',
                    borderWidth: 2,
                    pointRadius: 0,
                    borderDash: [6, 4],
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: true
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Produção') {
                                const totalPecas = context.parsed.y;
                                const caixas = Math.floor(totalPecas / 12);
                                return ` (${totalPecas} cx)`;
                            } else {
                                return `Meta: ${context.parsed.y.toFixed(2)} cx`;
                            }
                        },
                        title: function(context) {
                            return `Hora: ${context[0].label}`;
                        }
                    }
                },
                legend: {
                    display: true
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Horário',
                        font: {
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantidade por caixa',
                        font: {
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

// Atualiza os indicadores no dashboard
const pecasPorCaixa = 12;

async function updateIndicators(data) {
    if (!data) return;

    const pecasEstimadasCaixasEl = document.querySelector('.indicator-card:nth-child(1) .value-box');
    const pecasEstimadasUnidadesEl = document.querySelector('.indicator-card:nth-child(1) .units');
    const pecasProduzidasCaixasEl = document.querySelector('.indicator-card:nth-child(2) .value-box');
    const pecasProduzidasUnidadesEl = document.querySelector('.indicator-card:nth-child(2) .units');
    const totalAprovadosEl = document.querySelector('.indicator-card:nth-child(3) .indicator-value');
    const qualidadeEl = document.querySelector('.indicator-card:nth-child(4) .indicator-value');
    const totalReprovadosEl = document.querySelector('.indicator-card:nth-child(5) .indicator-value');
    const reprovadosPercentEl = document.querySelector('.indicator-card:nth-child(6) .indicator-value');

    const metaDia = data.meta || 0;
    const pecasEstimadas = metaDia * pecasPorCaixa;
    window.metaPecasEstimadas = pecasEstimadas;

    const pecasProduzidas = data.total_produzido || 0;
    const totalAprovados = data.total_aprovados || 0;
    const totalReprovados = data.total_reprovados || 0;

    if (pecasEstimadasCaixasEl) pecasEstimadasCaixasEl.textContent = `${Math.floor(pecasEstimadas / pecasPorCaixa)} cx`;
    if (pecasEstimadasUnidadesEl) pecasEstimadasUnidadesEl.textContent = `${pecasEstimadas}`;
    if (pecasProduzidasCaixasEl) pecasProduzidasCaixasEl.textContent = `${Math.floor(pecasProduzidas / pecasPorCaixa)} cx`;
    if (pecasProduzidasUnidadesEl) pecasProduzidasUnidadesEl.textContent = `${pecasProduzidas}`;
    if (totalAprovadosEl) totalAprovadosEl.textContent = totalAprovados;
    if (totalReprovadosEl) totalReprovadosEl.textContent = totalReprovados;

    // Qualidade = % de aprovados sobre produzidos
    const qualidade = pecasProduzidas > 0 ? (totalAprovados / pecasProduzidas) * 100 : 0;
    if (qualidadeEl) qualidadeEl.textContent = `${qualidade.toFixed(2)}%`;

    // % Reprovados = 100% - % Aprovados
    const reprovadosPercent = 100 - qualidade;
    if (reprovadosPercentEl) reprovadosPercentEl.textContent = `${reprovadosPercent.toFixed(2)}%`;
}

// Atualiza a data e hora
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const dateTimeStr = now.toLocaleDateString('pt-BR', options);
    const dateTimeEl = document.getElementById('currentDateTime');
    if (dateTimeEl) dateTimeEl.textContent = dateTimeStr;
}

// Funções para controlar o modal
function openModal() {
    const modal = document.getElementById('reportModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Define a data inicial como 7 dias atrás e a final como hoje
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    
    document.getElementById('startDate').valueAsDate = startDate;
    document.getElementById('endDate').valueAsDate = endDate;
}

function closeModal() {
    const modal = document.getElementById('reportModal');
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Fecha o modal se clicar fora do conteúdo
window.onclick = function(event) {
    const modal = document.getElementById('reportModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Função para formatar a data
function formatDate(dateString) {
    const dateParts = dateString.split('-');
    return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
}

// Função para baixar o relatório em TXT
function downloadReport() {
    if (!lastReportData) {
        showError('Gere o relatório primeiro antes de baixar.');
        return;
    }

    const { total_aprovados, total_reprovados, total_produzido, start, end } = lastReportData;
    
    const content = `
RELATÓRIO DE PRODUÇÃO

Período: ${start} a ${end}

Aprovados: ${total_aprovados}
Reprovados: ${total_reprovados}
Total Produzido: ${total_produzido}

Gerado em: ${new Date().toLocaleString('pt-BR')}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Formata o nome do arquivo substituindo barras por traços
    const fileName = `Relatorio_Producao_${start.replace(/\//g, '-')}_a_${end.replace(/\//g, '-')}.txt`;
    
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Função principal
async function initDashboard() {
    updateDateTime();
    setInterval(updateDateTime, 1000); // Atualiza o relógio a cada 1s

    // Configurações iniciais
    const datePicker = document.getElementById('datePicker');
    datePicker.value = new Date().toISOString().split('T')[0];

    // Atualização inicial
    await updateDashboardData();

    // Configura o botão de atualização manual
    document.querySelector('.refresh-button').addEventListener('click', async () => {
        await updateDashboardData();
    });

    // Configura o filtro por data
    document.getElementById('applyDateFilter').addEventListener('click', async () => {
        const newDate = datePicker.value;
        if (!newDate) {
            showError('Selecione uma data válida.');
            return;
        }
        await updateDashboardData();
    });

    // Configura o modal de relatório
    document.getElementById('openReportPanel').addEventListener('click', openModal);
    document.querySelector('.close-modal').addEventListener('click', closeModal);

    // Configura o gerador de relatório
    document.getElementById('generateReport').addEventListener('click', async () => {
        const start = document.getElementById('startDate').value;
        const end = document.getElementById('endDate').value;
    
        if (!start || !end) {
            showError('Preencha as datas de início e fim para o relatório.');
            return;
        }
    
        try {
            const reportData = await fetchData('relatorio', { start, end });
            if (!reportData) return;
    
            const { total_aprovados, total_reprovados, total_produzido } = reportData;
    
            const formattedStart = formatDate(start);
            const formattedEnd = formatDate(end);
    
            document.getElementById('reportResult').innerHTML = `
                <div style="margin-bottom: 30px; font-size: 24px; font-weight: bold;">RELATÓRIO DE PRODUÇÃO</div>
                <div style="margin-bottom: 20px;">
                    <strong>Período:</strong> ${formattedStart} a ${formattedEnd}
                </div>
                <div style="margin-bottom: 15px; font-size: 22px;">
                    ✅ <strong>Aprovados:</strong> ${total_aprovados}
                </div>
                <div style="margin-bottom: 15px; font-size: 22px;">
                    ❌ <strong>Reprovados:</strong> ${total_reprovados}
                </div>
                <div style="margin-bottom: 15px; font-size: 22px;">
                    ⚙️ <strong>Total Produzido:</strong> ${total_produzido}
                </div>
            `;
            
            // Armazena os dados do relatório para possível download
            lastReportData = {
                total_aprovados,
                total_reprovados,
                total_produzido,
                start: formattedStart,
                end: formattedEnd
            };
        } catch (err) {
            console.error('Erro ao gerar relatório:', err);
            showError('Erro ao gerar relatório.');
        }
    });

    // Configura o botão de download
    document.getElementById('downloadReport').addEventListener('click', downloadReport);

    // Atualização automática a cada 10 segundos (10000ms)
    setInterval(async () => {
        await updateDashboardData();
    }, 10000);
}

async function updateDashboardData() {
    try {
        // Mostra estado de "carregando"
        const refreshBtn = document.querySelector('.refresh-button');
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Atualizando...';
        refreshBtn.disabled = true;

        const selectedDate = document.getElementById('datePicker').value;

        // Busca dados
        const [producaoHoraria, indicadores] = await Promise.all([
            fetchData('producao_horaria', { date: selectedDate }),
            fetchData('indicadores', { date: selectedDate })
        ]);

        // Atualiza gráficos
        if (producaoHoraria) updateProductionChart(producaoHoraria);
        if (indicadores) updateIndicators(indicadores);

    } catch (error) {
        console.error('Erro na atualização:', error);
        showError('Falha ao atualizar dados');
    } finally {
        // Restaura o botão
        const refreshBtn = document.querySelector('.refresh-button');
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar';
        refreshBtn.disabled = false;
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    window.addEventListener('resize', handleResize);
});

// Função para ajuste do tamanho do gráfico em mudanças de tela
function handleResize() {
    if (productionChart) {
        productionChart.resize();
    }
}