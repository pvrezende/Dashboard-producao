// script.js
const API_BASE_URL = 'http://localhost:3000/api';
let productionChart = null;
const pecasPorCaixa = 12; // Constante: 12 peças equivalem a 1 caixa

// Variáveis globais para autenticação do usuário
let currentUserToken = null;
let currentUserRole = null;

// Variável para armazenar o ID do intervalo de atualização automática dos projetos (para tela2)
let autoRefreshProjectsInterval; 

// Variável para armazenar o ID do intervalo de atualização automática do dashboard (para tela1)
let autoRefreshDashboardInterval; 

// Variável para o contador de etapas dinâmicas (usado no cadastro e edição)
let dynamicEtapaCounter = 0;


// ===============================================
// Funções de Utilidade (Globais)
// ===============================================

/**
 * Exibe uma mensagem de notificação temporária na tela.
 * Gerencia um único wrapper para empilhar múltiplos toasts.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - O tipo da mensagem ('success', 'error', 'info', 'warning').
 * @param {number} duration - Duração em milissegundos que a mensagem ficará visível.
 */
function showNotification(message, type = 'info', duration = 3000) {
    let wrapper = document.getElementById('notification-wrapper');

    // Cria o wrapper se ele não existir
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'notification-wrapper';
        document.body.appendChild(wrapper);
    }

    const notification = document.createElement('div');
    notification.textContent = message;
    notification.classList.add('notification-message', type);

    wrapper.appendChild(notification);

    // Força o reflow para garantir a transição de entrada
    // eslint-disable-next-line no-unused-vars
    const reflow = notification.offsetWidth;

    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', function handler() {
            notification.remove();
            notification.removeEventListener('transitionend', handler);
        }, { once: true });
    }, duration);
}

function showError(message, duration = 5000) {
    showNotification(message, 'error', duration);
}

function showToast(message, type = 'success', duration = 3000) {
    showNotification(message, type, duration);
}

/**
 * Fecha um modal específico.
 * @param {string} modalId - O ID do modal a ser fechado.
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Formata uma data para exibição amigável
 * @param {string} dateString - String de data no formato ISO ou similar
 * @param {boolean} includeTime - Se deve incluir o horário
 * @returns {string} Data formatada.
 */
function formatDate(dateString, includeTime = false) {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const options = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };

    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }

    return date.toLocaleDateString('pt-BR', options);
}


/**
 * Alterna entre telas
 * @param {string} screenId - ID da tela a ser exibida.
 */
function switchScreen(screenId) {
    // Remover classe active de todos os botões e telas
    document.querySelectorAll('.screen-selector button').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelectorAll('.tela').forEach(screen => {
        screen.classList.remove('active');
    });

    // Adicionar classe active ao botão e tela selecionados
    document.querySelector(`.screen-selector button[onclick="switchScreen('${screenId}')"]`).classList.add('active');
    document.getElementById(screenId).classList.add('active');

    // Gerenciar a atualização automática de projetos (Tela 2)
    if (screenId === 'tela2') {
        fetchProjects(); // Carrega os projetos na mudança para a Tela 2
        startAutoRefreshProjects(10); // Inicia a atualização automática para a Tela 2 (a cada 10 segundos)
        stopAutoRefreshDashboard(); // Para o auto-refresh do dashboard se mudar para tela2
    } else {
        stopAutoRefreshProjects(); // Para a atualização automática de projetos se mudar para outra tela
    }

    // Gerenciar a atualização automática do dashboard (Tela 1)
    if (screenId === 'tela1') {
        setupDateFilter(); // Garante que a data e indicadores sejam carregados
        startAutoRefreshDashboard(10); // Inicia a atualização automática para o dashboard
    } else {
        stopAutoRefreshDashboard(); // Para o auto-refresh do dashboard se mudar para outra tela
    }
}

// Lógica de tela cheia para o dashboard principal (Tela 1)
document.getElementById('toggleFullscreenDashboard').addEventListener('click', function() {
    if (!document.fullscreenElement) {
        // Se não está em tela cheia, entra em tela cheia
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        }
    } else {
        // Se já está em tela cheia, sai do fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.documentElement.msExitFullscreen) {
            document.exitFullscreen();
        }
    }
});
// ===============================================
// Funções de Autenticação de Usuário
// ===============================================

async function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginMessage = document.getElementById('loginMessage');

    const username = usernameInput.value;
    const password = passwordInput.value;

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            loginMessage.textContent = data.error || 'Erro no login.';
            loginMessage.className = 'status-message error';
            return;
        }

        currentUserToken = data.accessToken;
        currentUserRole = data.role;

        localStorage.setItem('accessToken', currentUserToken);
        localStorage.setItem('userRole', currentUserRole);
        localStorage.setItem('username', data.username); // Armazenar o nome de usuário se necessário para exibição

        closeModal('loginModal');
        document.getElementById('appContent').style.display = 'block'; // Mostrar o conteúdo principal
        applyRolePermissions(); // Aplicar permissões com base no perfil logado
        showToast(`Bem-vindo, ${data.username}!`, 'success');

        // Inicializar o conteúdo do dashboard principal e iniciar o auto-refresh para Tela 1
        updateCurrentDateTime();
        setInterval(updateCurrentDateTime, 1000); // Atualiza data/hora no header continuamente
        
        // As funções startAutoRefreshDashboard e fetchIndicadores serão chamadas via switchScreen('tela1')
        // no DOMContentLoaded ou ao clicar no botão Dashboard.

    } catch (error) {
        console.error('Erro de rede ou servidor:', error);
        loginMessage.textContent = 'Erro ao conectar ao servidor.';
        loginMessage.className = 'status-message error';
    }
}

function handleLogout() {
    currentUserToken = null;
    currentUserRole = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    showToast('Sessão encerrada.', 'info');
    document.getElementById('appContent').style.display = 'none'; // Esconder o conteúdo principal
    openModal('loginModal'); // Mostrar o modal de login
    document.getElementById('loginForm').reset();
    document.getElementById('loginMessage').textContent = '';
    // Parar todas as atualizações automáticas ao deslogar
    stopAutoRefreshProjects();
    stopAutoRefreshDashboard();
}

function applyRolePermissions() {
    const registerProductionBtn = document.getElementById('registerProductionBtn');
    const generateReportModalBtn = document.getElementById('generateReportModalBtn'); // Este é sempre visível agora
    const tela3Button = document.querySelector('.screen-selector button[onclick="switchScreen(\'tela3\')"]');

    // Elementos dentro dos cards de projeto (ações de editar/excluir/sub-etapas)
    // Estes serão tratados dinamicamente quando os cards de projeto forem criados em createProjectCard
    // e quando as ações de sub-etapa forem renderizadas em openSubEtapasModal.

    // Sempre visível para todos (conforme "Visualização (Pode ver apenas as 3 telas sem modificar nada) - nesse é aberto para todos !")
    generateReportModalBtn.style.display = 'inline-block';
    document.getElementById('toggleFullscreenDashboard').style.display = 'inline-block';

    // Botão de Registrar Produção
    if (registerProductionBtn) {
        if (['diretoria', 'coordenador', 'lider'].includes(currentUserRole)) {
            registerProductionBtn.style.display = 'inline-block';
        } else {
            registerProductionBtn.style.display = 'none';
        }
    }

// Cadastro de Projetos (Tela 3)
    if (tela3Button) {
        if (['diretoria', 'coordenador'].includes(currentUserRole)) {
            tela3Button.style.display = 'inline-block';
        } else {
            tela3Button.style.display = 'none';
        }
    }

    // O botão Atualizar Projetos é visível para todos os perfis que podem ver a Tela 2 (todos os perfis).
    const refreshProjectsBtn = document.getElementById('refreshProjects');
    if (refreshProjectsBtn) {
        refreshProjectsBtn.style.display = 'inline-block';
    }
}


// Função para fazer requisições fetch autenticadas
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    // Lida com respostas 401/403
    if (response.status === 401 || response.status === 403) {
        showError('Sua sessão expirou ou você não tem permissão. Por favor, faça login novamente.');
        handleLogout(); // Faz logout do usuário
        throw new Error('Erro de autenticação ou autorização');
    }

    return response;
}

/**
 * Alterna a visibilidade de um campo de entrada de senha.
 * @param {string} inputId - O ID do campo de entrada de senha.
 * @param {HTMLElement} buttonElement - O elemento do botão que acionou a alternância.
 */
function togglePasswordVisibility(inputId, buttonElement) {
    const passwordInput = document.getElementById(inputId);
    const icon = buttonElement.querySelector('i');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}


// ===============================================
// Funções para a Tela 1 (Dashboard)
// ===============================================

/**
 * Atualiza a data e hora atual no dashboard.
 */
function updateCurrentDateTime() {
    const now = new Date();
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const dateTimeElement = document.getElementById('currentDateTime');
    if (dateTimeElement) {
        dateTimeElement.textContent = now.toLocaleDateString('pt-BR', options);
    }
}

/**
 * Configura o evento de mudança para o filtro de data única.
 */
function setupDateFilter() {
    const selectedDateInput = document.getElementById('selectedDate');
    if (selectedDateInput) {
        // Define a data atual como padrão
        const today = new Date();
        const formattedToday = today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        selectedDateInput.value = formattedToday;

        // Adiciona evento de mudança para atualizar os dados quando a data for alterada
        selectedDateInput.addEventListener('change', function() {
            fetchIndicadores(this.value);
        });

        // Carrega os dados iniciais
        fetchIndicadores(selectedDateInput.value);
    }
}

/**
 * Função para formatar a data e hora para o formato 'DD/MM/YYYY HH:mm:ss' que o banco espera.
 * @param {Date} dateObj - Objeto Date a ser formatado.
 * @returns {string} Data formatada.
 */
function formatDateTimeForDB(dateObj) {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Mês é 0-indexed
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Função para formatar uma data para o formato 'DD/MM/YYYY' que o banco espera.
 * @param {string} dateString - String de data no formato 'YYYY-MM-DD' (ex: '2025-05-15').
 * @returns {string} Data formatada para 'DD/MM/YYYY'.
 */
function formatDateForDB(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

/**
 * Busca e exibe os indicadores do backend (produção por hora, meta, total de peças).
 * @param {string} selectedDate - Data selecionada para o filtro (YYYY-MM-DD).
 */
async function fetchIndicadores(selectedDate = null) {
    let url = `${API_BASE_URL}/indicadores`;
    const params = new URLSearchParams();
    if (selectedDate) {
        params.append('selectedDate', selectedDate);
    }
    if (params.toString()) {
        url += `?${params.toString()}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar indicadores. Resposta não JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar indicadores.');
        }
        const data = await response.json();

        const caixasEstimadas = data.metaDiaria.length > 0 ? data.metaDiaria[0].meta : 0;
        const metaTotal = caixasEstimadas * pecasPorCaixa;

        const caixasProduzidas = data.totalPecasProduzidas || 0;
        const totalProduzido = caixasProduzidas * pecasPorCaixa;

        const totalReprovados = data.totalReprovados || 0;

        const totalAprovados = totalProduzido - totalReprovados;

        let percentAprovados = 0;
        let percentReprovados = 0;

        if (totalProduzido > 0) {
            percentAprovados = ((totalAprovados / totalProduzido) * 100).toFixed(2);
            percentReprovados = ((totalReprovados / totalProduzido) * 100).toFixed(2);
        }

        // Atualizar valores nos cards
        document.getElementById('totalCaixasEstimadas').textContent = caixasEstimadas;
        document.getElementById('totalPecasEstimadas').textContent = metaTotal;

        document.getElementById('totalCaixasProduzidas').textContent = caixasProduzidas;
        document.getElementById('totalPecasProduzidasValue').textContent = totalProduzido;

        document.getElementById('pecasAprovadasHoje').textContent = totalAprovados;
        document.getElementById('percentAprovados').textContent = percentAprovados;

        document.getElementById('totalReprovados').textContent = totalReprovados;
        document.getElementById('percentReprovados').textContent = percentReprovados;


        if (document.getElementById('productionChart')) {
            updateProductionChart(data.producaoPorHora);
        }

    } catch (error) {
        console.error('Erro ao carregar indicadores:', error);
        showError('Erro ao carregar indicadores: ' + error.message);
    }
}


/**
 * Atualiza o gráfico de produção por hora.
 * @param {Array<Object>} producaoPorHora - Dados de produção por hora (onde total_pecas é na verdade total de caixas).
 */
function updateProductionChart(producaoPorHora) {
    const ctx = document.getElementById('productionChart').getContext('2d');

    // Ajustar aqui: Se total_pecas do backend é na verdade "caixas", então os labels devem ser "Caixas"
    const labels = producaoPorHora.map(item => `${String(item.hora).padStart(2, '0')}:00`);
    const data = producaoPorHora.map(item => item.total_pecas); // 'total_pecas' aqui são as caixas

    // Valor fixo da meta por hora (assumindo que a meta também é em caixas por hora)
    const metaPorHora = 8.5; // Ajuste este valor se sua meta for de peças por hora, não caixas.

    // Criar um array com o mesmo tamanho dos labels, preenchido com o valor da meta
    const metaData = Array(labels.length).fill(metaPorHora);

    if (productionChart) {
        productionChart.destroy();
    }

    productionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Caixas Produzidas por Hora', // **ATUALIZADO**
                    data: data,
                    backgroundColor: 'rgba(0, 123, 255, 0.5)',
                    borderColor: 'rgba(0, 123, 255, 1)',
                    borderWidth: 1,
                    order: 2
                },
                {
                    label: 'Meta por Hora (Caixas)', // **ATUALIZADO**
                    data: metaData,
                    type: 'line',
                    fill: false,
                    borderColor: '#ffc107',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Total de Caixas' // **ATUALIZADO**
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Hora do Dia'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                // Se for o dataset de caixas produzidas ou meta, adicionar 'caixas'
                                if (context.dataset.label.includes('Caixas') || context.dataset.label.includes('Meta')) {
                                    label += context.parsed.y + ' caixas'; // **ATUALIZADO**
                                } else {
                                    label += context.parsed.y + ' peças'; // Para outros casos, se houver
                                }
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Abre o modal de registro de produção.
 */
async function openRegisterModal() {
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        registerModal.style.display = 'flex';

        const pecasEstimadasInput = document.getElementById('pecasEstimadasInput');
        const dataHoraMetaInput = document.getElementById('dataHoraMetaInput');
        const dataHoraProducaoInput = document.getElementById('dataHoraProducaoInput');

        // Resetar formulários para limpar valores anteriores
        document.getElementById('registerProductionForm').reset();

        // Definir a data atual para o input de meta
        const today = new Date();
        const formattedToday = today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        dataHoraMetaInput.value = formattedToday;

        // Definir a data e hora atual para o input de produção
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);
        dataHoraProducaoInput.value = localISOTime;

        // Popular pecasEstimadasInput com a meta atual para a data inicialmente selecionada
        // Usar a data do filtro do dashboard principal se disponível, caso contrário, a data de hoje
        const initialSelectedDate = document.getElementById('selectedDate').value || formattedToday;

        try {
            const response = await fetch(`${API_BASE_URL}/indicadores?selectedDate=${initialSelectedDate}`);
            if (response.ok) {
                const data = await response.json();
                const currentMetaBoxes = data.metaDiaria.length > 0 ? data.metaDiaria[0].meta : 0;
                pecasEstimadasInput.value = currentMetaBoxes;
            } else {
                console.error('Falha ao buscar a meta atual para o modal de registro.');
                pecasEstimadasInput.value = 0; // Padrão se a busca falhar
            }
        } catch (error) {
            console.error('Erro ao buscar a meta atual:', error);
            pecasEstimadasInput.value = 0; // Padrão em caso de erro
        }

        // Definir editabilidade para pecasEstimadasInput e updateMetaBtn com base no perfil
        const updateMetaBtn = document.getElementById('updateMetaBtn');
        if (['diretoria', 'coordenador'].includes(currentUserRole)) {
            pecasEstimadasInput.removeAttribute('readonly');
            pecasEstimadasInput.classList.remove('disabled-field');
            dataHoraMetaInput.removeAttribute('readonly');
            dataHoraMetaInput.classList.add('disabled-field'); // A data da meta continua desabilitada para edição
            updateMetaBtn.style.display = 'inline-block';
        } else {
            pecasEstimadasInput.setAttribute('readonly', true);
            pecasEstimadasInput.classList.add('disabled-field');
            dataHoraMetaInput.setAttribute('readonly', true);
            dataHoraMetaInput.classList.add('disabled-field');
            updateMetaBtn.style.display = 'none'; // Ocultar o botão de atualização de meta para perfis não autorizados
        }
    }
}

/**
 * Função para ATUALIZAR APENAS as peças estimadas (meta diária).
 */
async function updateDailyMeta() {
    const pecasEstimadasInput = document.getElementById('pecasEstimadasInput');
    const dataHoraMetaInput = document.getElementById('dataHoraMetaInput');

    const pecasEstimadas = parseInt(pecasEstimadasInput.value);
    const selectedDate = dataHoraMetaInput.value; // Isso estará no formato YYYY-MM-DD vindo do input type="date"

    if (isNaN(pecasEstimadas) || pecasEstimadas < 0) {
        showError('Por favor, insira uma quantidade válida de peças estimadas para a meta.');
        return;
    }
    if (!selectedDate) {
        showError('Por favor, selecione uma data para a meta.');
        return;
    }

    // Formatar a data para DD/MM/YYYY antes de enviar para o backend
    const formattedDateForDB = formatDateForDB(selectedDate); // É aqui que a conversão acontece

    try {
        const metaUpdateResponse = await authenticatedFetch(`${API_BASE_URL}/meta_dia`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: formattedDateForDB, // Enviando DD/MM/YYYY
                meta: pecasEstimadas
            }),
        });

        if (!metaUpdateResponse.ok) {
            const errorData = await metaUpdateResponse.json().catch(() => ({ error: "Erro desconhecido ao atualizar meta diária." }));
            throw new Error(errorData.error || 'Erro ao atualizar meta diária.');
        }

        showToast('Meta diária atualizada com sucesso!', 'success');
        fetchIndicadores(document.getElementById('selectedDate').value); // Atualizar os indicadores do dashboard
        // closeModal('registerModal'); // Manter o modal aberto se o usuário quiser registrar a produção
    } catch (error) {
        console.error('Erro ao atualizar meta diária:', error);
        showError('Erro ao atualizar meta diária: ' + error.message);
    }
}


/**
 * Função para registrar produção (apenas peças produzidas e reprovadas).
 * Envia os dados para o backend.
 */
async function registerProduction(event) {
    event.preventDefault(); // Prevenir o envio padrão do formulário

    const qtdDadosInput = document.getElementById('qtdDadosInput');
    const pecasReprovadaInput = document.getElementById('pecasReprovadaInput');
    const dataHoraProducaoInput = document.getElementById('dataHoraProducaoInput');

    const qtdDados = parseInt(qtdDadosInput.value) || 0; // Definir como 0 se vazio ou NaN
    const pecasReprovadas = parseInt(pecasReprovadaInput.value) || 0;
    const dateObj = new Date(dataHoraProducaoInput.value);
    const dataHora = formatDateTimeForDB(dateObj); // Isso formata para 'DD/MM/YYYY HH:mm:ss'
    const selectedDateForRefresh = dataHoraProducaoInput.value.split('T')[0];

    // --- Lógica de Validação Modificada ---
    if (qtdDados < 0) { // Verificar apenas valores negativos
        showError('Por favor, insira uma quantidade válida de caixas produzidas (não negativa).');
        return;
    }
    if (isNaN(pecasReprovadas) || pecasReprovadas < 0) {
        showError('Por favor, insira uma quantidade válida de peças reprovadas (não negativa).');
        return;
    }

    // Verificar se pelo menos um campo tem um valor positivo
    if (qtdDados === 0 && pecasReprovadas === 0) {
        showError('Por favor, insira a quantidade de caixas produzidas ou peças reprovadas para registrar.');
        return;
    }
    // --- Fim da Lógica de Validação Modificada ---

    try {
        // Registrar Produção se qtdDados > 0
        if (qtdDados > 0) {
            const productionResponse = await authenticatedFetch(`${API_BASE_URL}/producao`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ qtdDados, dataHora }), // Envia dataHora como 'DD/MM/YYYY HH:mm:ss'
            });

            if (!productionResponse.ok) {
                const errorData = await productionResponse.json().catch(() => ({error: "Erro desconhecido ao registrar."}));
                throw new Error(errorData.error || 'Erro ao registrar produção.');
            }
            showToast('Produção registrada com sucesso!', 'success');
        }

        // Registrar Peças Rejeitadas se pecasReprovadas > 0
        if (pecasReprovadas > 0) {
            const eficienciaResponse = await authenticatedFetch(`${API_BASE_URL}/eficiencia`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Essa é a chamada que falhou antes.
                // Agora envia a 'flag' e 'dataHora' para o novo endpoint dedicado.
                body: JSON.stringify({ qtd: pecasReprovadas, flag: 'rejeitada', dataHora }),
            });
            if (!eficienciaResponse.ok) {
                const errorData = await eficienciaResponse.json().catch(() => ({error: "Erro desconhecido ao registrar peças reprovadas."}));
                console.error('Erro ao registrar peças reprovadas:', errorData.error);
                showError('Houve um erro ao registrar peças reprovadas: ' + errorData.error);
            } else {
                showToast('Peças reprovadas registradas com sucesso!', 'success');
            }
        }


        // Se apenas um deles foi enviado, dar uma mensagem mais específica, caso contrário, combinar.
        if (qtdDados > 0 && pecasReprovadas > 0) {
            showToast('Produção e peças reprovadas registradas com sucesso!', 'success');
        } else if (qtdDados > 0) {
             // Já tratado pelo toast de sucesso de produção específico acima
        } else if (pecasReprovadas > 0) {
            // Já tratado pelo toast de sucesso de peças reprovadas específico acima
        }


        // Resetar apenas os campos relacionados à produção após o envio bem-sucedido
        qtdDadosInput.value = '';
        pecasReprovadaInput.value = '';

        // Redefinir a data/hora automática para a próxima entrada
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        dataHoraProducaoInput.value = (new Date(now - offset)).toISOString().slice(0, 16);

        fetchIndicadores(selectedDateForRefresh); // Atualizar os indicadores do dashboard

    } catch (error) {
        console.error('Erro:', error);
        showError(error.message);
    }
}

/**
 * Função para gerar e exibir o relatório de produção.
 * Busca dados do endpoint /relatorio para permitir relatórios por intervalo de datas.
 */
async function generateReport() {
    const reportStartDateInput = document.getElementById('reportStartDate');
    const reportEndDateInput = document.getElementById('reportEndDate');
    const startDate = reportStartDateInput.value;
    const endDate = reportEndDateInput.value;
    const reportModalContent = document.querySelector('#reportModal .modal-content');

    // Validação básica de datas
    if (!startDate || !endDate) {
        showError('Por favor, selecione as datas de início e fim para o relatório.');
        reportModalContent.classList.remove('fullscreen-report');
        return;
    }
    if (new Date(startDate) > new Date(endDate)) {
        showError('A data de início não pode ser posterior à data de fim.');
        reportModalContent.classList.remove('fullscreen-report');
        return;
    }

    let url = `${API_BASE_URL}/relatorio`;
    const params = new URLSearchParams();
    params.append('startDate', startDate);
    params.append('endDate', endDate);
    url += `?${params.toString()}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.error || 'Erro desconhecido ao buscar dados para o relatório.';
            throw new Error(errorMessage);
        }
        const dailyReportData = await response.json();

        const reportResultDiv = document.getElementById('reportResult');
        reportResultDiv.innerHTML = '';
        reportResultDiv.style.display = 'block';

        document.getElementById('downloadOptions').style.display = 'block';

        let totalPiecesEstimatedOverall = 0;
        let totalPiecesProducedOverall = 0; // Este é o total de CAIXAS produzidas
        let totalPiecesRejectedOverall = 0; // Este é o total de PEÇAS reprovadas

        dailyReportData.forEach(day => {
            totalPiecesEstimatedOverall += Number(day.meta_dia_total) || 0; // Meta em CAIXAS
            totalPiecesProducedOverall += Number(day.total_produzido_dia) || 0; // Produzido em CAIXAS
            totalPiecesRejectedOverall += Number(day.total_reprovado_dia) || 0; // Reprovado em PEÇAS
        });

        const totalPiecesApprovedOverall = (totalPiecesProducedOverall * pecasPorCaixa) - totalPiecesRejectedOverall; // Aprovados em PEÇAS

        let overallPercentApproved = 0;
        let overallPercentRejected = 0;

        if ((totalPiecesProducedOverall * pecasPorCaixa) > 0) { // Calcular % com base em peças produzidas
            overallPercentApproved = (totalPiecesApprovedOverall / (totalPiecesProducedOverall * pecasPorCaixa) * 100).toFixed(2);
            overallPercentRejected = (totalPiecesRejectedOverall / (totalPiecesProducedOverall * pecasPorCaixa) * 100).toFixed(2);
        }

        const formattedTotalBoxesEstimatedOverall = Math.round(totalPiecesEstimatedOverall).toLocaleString('pt-BR');
        const formattedTotalPiecesEstimatedOverall = Math.round(totalPiecesEstimatedOverall * pecasPorCaixa).toLocaleString('pt-BR');

        const formattedTotalBoxesProducedOverall = Math.round(totalPiecesProducedOverall).toLocaleString('pt-BR');
        const formattedTotalPiecesProducedInUnits = Math.round(totalPiecesProducedOverall * pecasPorCaixa).toLocaleString('pt-BR');
        
        const formattedTotalPiecesApprovedOverall = Math.round(totalPiecesApprovedOverall).toLocaleString('pt-BR');
        const formattedTotalPiecesRejectedOverall = Math.round(totalPiecesRejectedOverall).toLocaleString('pt-BR');

        const startDateFormatted = new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR');
        const endDateFormatted = new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR');
        const periodoTexto = startDate === endDate ?
            `${startDateFormatted}` :
            `${startDateFormatted} a ${endDateFormatted}`;

        const summary = document.createElement('div');
        summary.className = 'report-summary';
        summary.innerHTML = `
            <h3>Resumo do Período: ${periodoTexto}</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Peças Estimadas:</div>
                    <div class="summary-value">${formattedTotalBoxesEstimatedOverall} cx (${formattedTotalPiecesEstimatedOverall} peças)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Peças Produzidas:</div>
                    <div class="summary-value">${formattedTotalBoxesProducedOverall} cx (${formattedTotalPiecesProducedInUnits} peças)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Aprovados:</div>
                    <div class="summary-value">${formattedTotalPiecesApprovedOverall} peças</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Reprovados:</div>
                    <div class="summary-value">${formattedTotalPiecesRejectedOverall} peças</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">% Aprovados:</div>
                    <div class="summary-value">${overallPercentApproved}%</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">% Reprovados:</div>
                    <div class="summary-value">${overallPercentRejected}%</div>
                </div>
            </div>
        `;

        reportResultDiv.appendChild(summary);

        if (dailyReportData.length > 0) {
            const detailsSection = document.createElement('div');
            detailsSection.className = 'report-details';

            const detailsTitle = document.createElement('h3');
            detailsTitle.textContent = 'Detalhes Diários';
            detailsSection.appendChild(detailsTitle);

            const table = document.createElement('table');
            table.className = 'report-table';

            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Data</th>
                    <th>Meta (peças)</th>
                    <th>Produzido (peças)</th>
                    <th>Aprovado (peças)</th>
                    <th>Reprovado (peças)</th>
                    <th>% Aprovado</th>
                    <th>% Reprovado</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');

            dailyReportData.forEach(day => {
                const date = new Date(day.report_date).toLocaleDateString('pt-BR');
                const meta = Number(day.meta_dia_total) || 0; // Meta em caixas
                const produzidoCaixas = Number(day.total_produzido_dia) || 0; // Produzido em caixas
                const reprovadoPecas = Number(day.total_reprovado_dia) || 0; // Reprovado em peças

                const produzidoPecas = produzidoCaixas * pecasPorCaixa; // Converter para peças
                const aprovadoPecas = produzidoPecas - reprovadoPecas;

                let percentAprovadoDia = 0;
                let percentReprovadoDia = 0; 

                if (produzidoPecas > 0) {
                    percentAprovadoDia = (aprovadoPecas / produzidoPecas * 100).toFixed(2);
                    percentReprovadoDia = (reprovadoPecas / produzidoPecas * 100).toFixed(2);
                }

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${date}</td>
                    <td>${Math.round(meta * pecasPorCaixa).toLocaleString('pt-BR')}</td> <td>${Math.round(produzidoPecas).toLocaleString('pt-BR')}</td>
                    <td>${Math.round(aprovadoPecas).toLocaleString('pt-BR')}</td>
                    <td>${Math.round(reprovadoPecas).toLocaleString('pt-BR')}</td>
                    <td>${percentAprovadoDia}%</td>
                    <td>${percentReprovadoDia}%</td>
                </tr>
            `;
                tbody.appendChild(row);
            });

            table.appendChild(tbody);
            detailsSection.appendChild(table);
            reportResultDiv.appendChild(detailsSection);
        }

        window.reportData = {
            summaryData: {
                totalMeta: totalPiecesEstimatedOverall, // Total de caixas estimadas
                totalProduzido: totalPiecesProducedOverall, // Total de caixas produzidas
                totalAprovado: totalPiecesApprovedOverall, // Total de peças aprovadas
                totalReprovado: totalPiecesRejectedOverall, // Total de peças reprovadas
                percentAprovados: overallPercentApproved,
                percentReprovados: overallPercentRejected,
                caixasEstimadas: totalPiecesEstimatedOverall, // Corrigido para ser caixas
                caixasProduzidas: totalPiecesProducedOverall // Corrigido para ser caixas
            },
            detailedData: dailyReportData, // Dados diários brutos (caixas para produzido, peças para reprovado)
            startDate: startDate,
            endDate: endDate
        };

    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        if (typeof showError === 'function') {
            showError('Erro ao gerar relatório: ' + error.message);
        } else {
            console.error('Função showError não definida.');
            alert('Erro ao gerar relatório: ' + error.message);
        }

        const reportResultDiv = document.getElementById('reportResult');
        reportResultDiv.innerHTML = `<p style="color: red;">Erro ao gerar relatório: ${error.message}</p>`;
        reportResultDiv.style.display = 'block';
        document.getElementById('downloadOptions').style.display = 'none';
    }
}

// --- Funções de Download de Relatório ---

/**
 * Faz o download do relatório como um arquivo TXT.
 */
function downloadReportTxt() {
    if (!window.reportData) {
        showError('Nenhum dado de relatório para baixar.');
        return;
    }

    const { summaryData, detailedData, startDate, endDate } = window.reportData;

    const startDateFormatted = new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const endDateFormatted = new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const periodoTexto = startDate === endDate ? `${startDateFormatted}` : `${startDateFormatted} a ${endDateFormatted}`;

    let textContent = `RELATÓRIO DE PRODUÇÃO\n`;
    textContent += `Período: ${periodoTexto}\n\n`;

    textContent += `RESUMO DO PERÍODO:\n`;
    textContent += `Peças Estimadas: ${summaryData.caixasEstimadas.toLocaleString('pt-BR')} cx (${Math.round(summaryData.totalMeta * pecasPorCaixa).toLocaleString('pt-BR')} peças)\n`;
    textContent += `Peças Produzidas: ${summaryData.caixasProduzidas.toLocaleString('pt-BR')} cx (${Math.round(summaryData.totalProduzido * pecasPorCaixa).toLocaleString('pt-BR')} peças)\n`;
    textContent += `Total Aprovados: ${Math.round(summaryData.totalAprovado).toLocaleString('pt-BR')} peças (${summaryData.percentAprovados}%)\n`;
    textContent += `Total Reprovados: ${Math.round(summaryData.totalReprovado).toLocaleString('pt-BR')} peças (${summaryData.percentReprovados}%)\n\n`;

    textContent += `DETALHES POR DIA:\n`;
    textContent += `Data\tMeta (peças)\tProduzido (peças)\tAprovado (peças)\tReprovado (peças)\t% Aprovado\t% Reprovado\n`;
    detailedData.forEach(day => {
        const date = new Date(day.report_date).toLocaleDateString('pt-BR');
        const metaPecas = (Number(day.meta_dia_total) || 0) * pecasPorCaixa;
        const produzidoPecas = (Number(day.total_produzido_dia) || 0) * pecasPorCaixa;
        const reprovadoPecas = Number(day.total_reprovado_dia) || 0;
        const aprovadoPecas = produzidoPecas - reprovadoPecas;
        let percentAprovadoDia = (produzidoPecas > 0) ? (aprovadoPecas / produzidoPecas * 100).toFixed(2) : 0;
        let percentReprovadoDia = (produzidoPecas > 0) ? (reprovadoPecas / produzidoPecas * 100).toFixed(2) : 0;
        textContent += `${date}\t${Math.round(metaPecas).toLocaleString('pt-BR')}\t${Math.round(produzidoPecas).toLocaleString('pt-BR')}\t${Math.round(aprovadoPecas).toLocaleString('pt-BR')}\t${Math.round(reprovadoPecas).toLocaleString('pt-BR')}\t${percentAprovadoDia}%\t${percentReprovadoDia}%\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_producao_${periodoTexto.replace(/[/ ]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Relatório TXT gerado com sucesso!', 'success');
}

/**
 * Faz o download do relatório como um arquivo Excel (CSV).
 */
function downloadReportExcel() {
    if (!window.reportData) {
        showError('Nenhum dado de relatório para baixar.');
        return;
    }

    const { summaryData, detailedData, startDate, endDate } = window.reportData;

    const startDateFormatted = new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const endDateFormatted = new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const periodoTexto = startDate === endDate ? `${startDateFormatted}` : `${startDateFormatted} a ${endDateFormatted}`;

    let csvContent = `RELATÓRIO DE PRODUÇÃO\n`;
    csvContent += `Período: ${periodoTexto}\n\n`;

    // Seção de resumo para CSV
    csvContent += `RESUMO DO PERÍODO:\n`;
    csvContent += `"Peças Estimadas (cx)","Peças Estimadas (peças)","Peças Produzidas (cx)","Peças Produzidas (peças)","Total Aprovados (peças)","% Aprovados","Total Reprovados (peças)","% Reprovados"\n`;
    csvContent += `"${summaryData.caixasEstimadas.toLocaleString('pt-BR')}","${Math.round(summaryData.totalMeta * pecasPorCaixa).toLocaleString('pt-BR')}","${summaryData.caixasProduzidas.toLocaleString('pt-BR')}","${Math.round(summaryData.totalProduzido * pecasPorCaixa).toLocaleString('pt-BR')}","${Math.round(summaryData.totalAprovado).toLocaleString('pt-BR')}","${summaryData.percentAprovados}%","${Math.round(summaryData.totalReprovado).toLocaleString('pt-BR')}","${summaryData.percentReprovados}%"\n\n`;

    // Seção detalhada para CSV
    csvContent += `DETALHES POR DIA:\n`;
    csvContent += `"Data","Meta (peças)","Produzido (peças)","Aprovado (peças)","Reprovado (peças)","% Aprovado","% Reprovado"\n`;
    detailedData.forEach(day => {
        const date = new Date(day.report_date).toLocaleDateString('pt-BR');
        const metaPecas = (Number(day.meta_dia_total) || 0) * pecasPorCaixa;
        const produzidoPecas = (Number(day.total_produzido_dia) || 0) * pecasPorCaixa;
        const reprovadoPecas = (Number(day.total_reprovado_dia) || 0); // Reprovado já vem em peças
        const aprovadoPecas = produzidoPecas - reprovadoPecas;
        let percentAprovadoDia = (produzidoPecas > 0) ? (aprovadoPecas / produzidoPecas * 100).toFixed(2) : 0;
        let percentReprovadoDia = (produzidoPecas > 0) ? (reprovadoPecas / produzidoPecas * 100).toFixed(2) : 0;
        csvContent += `"${date}","${Math.round(metaPecas).toLocaleString('pt-BR')}","${Math.round(produzidoPecas).toLocaleString('pt-BR')}","${Math.round(aprovadoPecas).toLocaleString('pt-BR')}","${Math.round(reprovadoPecas).toLocaleString('pt-BR')}","${percentAprovadoDia}%","${percentReprovadoDia}%"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_producao_${periodoTexto.replace(/[/ ]/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Relatório Excel (CSV) gerado com sucesso!', 'success');
}

/**
 * Imprime o relatório usando a funcionalidade de impressão do navegador.
 */
function printReport() {
    if (!window.reportData) {
        showError('Nenhum dado de relatório para imprimir.');
        return;
    }

    const { summaryData, detailedData, startDate, endDate } = window.reportData;

    const startDateFormatted = new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const endDateFormatted = new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const periodoTexto = startDate === endDate ? `${startDateFormatted}` : `${startDateFormatted} a ${endDateFormatted}`;

    // Criar conteúdo HTML imprimível
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Produção</title>
            <style>
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
                    margin-bottom: 10px; /* para layout de impressão */
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
                @media print {
                    /* Ocultar elementos não relevantes para impressão */
                    .download-options, .action-buttons-container { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>RELATÓRIO DE PRODUÇÃO</h1>
            <h3 style="text-align: center;">Período: ${periodoTexto}</h3>

            <h2>RESUMO DO PERÍODO</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Peças Estimadas:</div>
                    <div class="summary-value">${Math.round(summaryData.totalMeta).toLocaleString('pt-BR')} cx (${Math.round(summaryData.totalMeta * pecasPorCaixa).toLocaleString('pt-BR')} peças)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Peças Produzidas:</div>
                    <div class="summary-value">${Math.round(summaryData.totalProduzido).toLocaleString('pt-BR')} cx (${Math.round(summaryData.totalProduzido * pecasPorCaixa).toLocaleString('pt-BR')} peças)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Aprovados:</div>
                    <div class="summary-value">${Math.round(summaryData.totalAprovado).toLocaleString('pt-BR')} peças</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Reprovados:</div>
                    <div class="summary-value">${Math.round(summaryData.totalReprovado).toLocaleString('pt-BR')} peças</div>
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
                        <th>% Reprovado</th>
                    </tr>
                </thead>
                <tbody>
                    ${detailedData.map(day => {
                        const date = new Date(day.report_date).toLocaleDateString('pt-BR');
                        const metaPecas = (Number(day.meta_dia_total) || 0) * pecasPorCaixa;
                        const produzidoPecas = (Number(day.total_produzido_dia) || 0) * pecasPorCaixa;
                        const reprovadoPecas = (Number(day.total_reprovado_dia) || 0); // Reprovado já vem em peças
                        const aprovadoPecas = produzidoPecas - reprovadoPecas;

                        let percentAprovadoDia = 0;
                        let percentReprovadoDia = 0; 
                        if (produzidoPecas > 0) {
                            percentAprovadoDia = (aprovadoPecas / produzidoPecas * 100).toFixed(2);
                            percentReprovadoDia = (reprovadoPecas / produzidoPecas * 100).toFixed(2);
                        }

                        return `
                            <tr>
                                <td>${date}</td>
                                <td>${Math.round(metaPecas).toLocaleString('pt-BR')}</td>
                                <td>${Math.round(produzidoPecas).toLocaleString('pt-BR')}</td>
                                <td>${Math.round(aprovadoPecas).toLocaleString('pt-BR')}</td>
                                <td>${Math.round(reprovadoPecas).toLocaleString('pt-BR')}</td>
                                <td>${percentAprovadoDia}%</td>
                                <td>${percentReprovadoDia}%</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        showToast('Relatório enviado para impressão!', 'success');
    } else {
        showError('Falha ao abrir janela de impressão. Verifique se o bloqueador de pop-ups está ativo.');
    }
}


// ===============================================
// Funções para a Tela 2 (Status do Projeto)
// ===============================================

/**
 * Busca e exibe os projetos do backend, com opção de filtro por nome.
 * Se um termo de busca for fornecido, os projetos que correspondem serão movidos para o topo.
 * @param {string} [searchTerm=''] - Termo de busca para filtrar projetos por nome.
 */
async function fetchProjects(searchTerm = '') {
    try {
        // Sempre buscar todos os projetos do backend.
        const response = await fetch(`${API_BASE_URL}/projetos`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar projetos. Resposta não JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar projetos.');
        }
        let allProjects = await response.json(); // Pega todos os projetos do backend

        const projectsContainer = document.getElementById('projectsContainer');
        projectsContainer.innerHTML = ''; // Limpa o container antes de renderizar

        if (allProjects.length === 0) {
            projectsContainer.innerHTML = '<p class="no-projects">Nenhum projeto encontrado. Cadastre um novo projeto na aba "Cadastro de Projetos".</p>';
            return;
        }

        let projectsToDisplay = [];

        // Garanta que searchTerm é uma string antes de chamar trim()
        const currentSearchTerm = String(searchTerm).trim();

        // Se houver um termo de busca, reordene os projetos localmente
        if (currentSearchTerm !== '') {
            const lowerCaseSearchTerm = currentSearchTerm.toLowerCase();
            const matchingProjects = [];
            const otherProjects = [];

            allProjects.forEach(project => {
                if (project.nome.toLowerCase().includes(lowerCaseSearchTerm)) {
                    matchingProjects.push(project);
                } else {
                    otherProjects.push(project);
                }
            });

            projectsToDisplay = matchingProjects.concat(otherProjects);

            if (matchingProjects.length === 0) {
                 projectsContainer.innerHTML = `<p class="no-projects">Nenhum projeto encontrado com o nome "${currentSearchTerm}".</p>`;
                 return;
            }
        } else {
            // Se não houver termo de busca, exibe todos os projetos na ordem original do backend
            projectsToDisplay = allProjects;
        }

        projectsToDisplay.forEach(project => {
            const projectCard = createProjectCard(project);
            projectsContainer.appendChild(projectCard);
        });

    } catch (error) {
        console.error('Erro ao carregar projetos:', error);
        showError('Erro ao carregar projetos: ' + error.message);
    }
}

// Função para criar um card de projeto com percentual e status atualizados
function createProjectCard(projeto) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.projectId = projeto.id;

    // Seção de informações do projeto
    const infoSection = document.createElement('div');
    infoSection.className = 'project-info';

    const projectName = document.createElement('div');
    projectName.className = 'project-info-name';
    projectName.textContent = projeto.nome;

    const projectDetails = document.createElement('div');
    projectDetails.className = 'project-info-details';

    // Formatação das datas
    const dataInicioProjeto = projeto.data_inicio ? formatDate(projeto.data_inicio) : 'Não definida';
    const dataFimProjeto = projeto.data_fim ? formatDate(projeto.data_fim) : 'Não definida';

    // Extrair equipe do JSON
    let equipeText = '';
    try {
        if (projeto.equipe_json) {
            const equipe = JSON.parse(projeto.equipe_json);
            equipeText = Array.isArray(equipe) ? equipe.join(', ') : equipe;
        }
    } catch (e) {
        console.error('Erro ao parsear equipe JSON:', e);
        equipeText = projeto.equipe_json || '';
    }

    projectDetails.innerHTML = `
        <strong>Líder:</strong> ${projeto.lider}<br>
        <strong>Equipe:</strong> ${equipeText}<br>
        <strong>Início:</strong> ${dataInicioProjeto}<br>
        <strong>Entrega:</strong> ${dataFimProjeto}
    `;

    infoSection.appendChild(projectName);
    infoSection.appendChild(projectDetails);

    // Seção do stepper (barra de progresso)
    const stepperWrapper = document.createElement('div');
    stepperWrapper.className = 'project-stepper-wrapper';

    const stepperContainer = document.createElement('div');
    stepperContainer.className = 'stepper-container';

    // --- MODIFICAÇÃO CHAVE AQUI: Iterar sobre etapas customizadas ---
    if (projeto.customEtapas && projeto.customEtapas.length > 0) {
        projeto.customEtapas.forEach((etapa, index) => {
            const percentual = projeto.percentuaisPorEtapa[etapa.id] || 0;
            const stageStatus = projeto.statusPorEtapa[etapa.id] || 'pendente';

            const step = document.createElement('div');
            step.className = 'step';
            
            // Lógica atualizada para colorir a bolinha
            if (percentual === 100) {
                step.classList.add('completed');
            } else if (stageStatus === 'atrasado') {
                step.classList.add('delayed');
            } else if (stageStatus === 'andamento' || percentual > 0) {
                step.classList.add('active');
            }

            step.textContent = `${percentual}%`;

            // NOVO: Adicionar Data de Início da Etapa
            const stepStartDate = document.createElement('div');
            stepStartDate.className = 'step-start-date';
            stepStartDate.textContent = etapa.data_inicio ? formatDate(etapa.data_inicio) : 'Sem Início'; // Formata a data
            step.appendChild(stepStartDate);

            // NOVO: Adicionar Data de Fim da Etapa (reutilizando step-date)
            const stepEndDate = document.createElement('div');
            stepEndDate.className = 'step-date'; // Mantém a classe existente
            stepEndDate.textContent = etapa.data_fim ? formatDate(etapa.data_fim) : 'Sem Fim'; // Formata a data
            step.appendChild(stepEndDate);

            const stepLabel = document.createElement('div');
            stepLabel.className = 'step-label';
            stepLabel.textContent = etapa.nome_etapa; // Usar nome_etapa da etapa customizada

            step.appendChild(stepLabel);
            stepperContainer.appendChild(step);

            // Adicionar evento de clique à "bolinha" da etapa para abrir o modal de sub-etapas
            step.addEventListener('click', () => {
                openSubEtapasModal(projeto.id, etapa.id); // Passar o ID da etapa customizada
            });

            // Adicionar linha conectora entre os steps (exceto para o último)
            if (index < projeto.customEtapas.length - 1) {
                const connector = document.createElement('div');
                connector.className = 'step-connector';
                stepperContainer.appendChild(connector);
            }
        });
    } else {
        // Mensagem se não houver etapas customizadas
        const noStagesMsg = document.createElement('p');
        noStagesMsg.textContent = 'Nenhuma etapa definida para este projeto.';
        noStagesMsg.style.textAlign = 'center';
        noStagesMsg.style.color = 'var(--text-muted-color)';
        stepperContainer.appendChild(noStagesMsg);
    }
    // --- FIM DA MODIFICAÇÃO CHAVE ---

    stepperWrapper.appendChild(stepperContainer);

    // Seção de ações
    const actionsSection = document.createElement('div');
    actionsSection.className = 'project-actions';

    // Botão de detalhes
    const detailsButton = document.createElement('button');
    detailsButton.className = 'action-button info';
    detailsButton.innerHTML = '<i class="fas fa-info-circle"></i> Detalhes';
    detailsButton.addEventListener('click', () => openProjectDetailsModal(projeto.id));

    // Botão de editar (visível apenas para diretoria e coordenador)
    const editButton = document.createElement('button');
    editButton.className = 'action-button primary';
    editButton.innerHTML = '<i class="fas fa-edit"></i> Editar';
    editButton.addEventListener('click', () => openEditProjectModal(projeto.id));

    // Botão de excluir (visível apenas para diretoria)
    const deleteButton = document.createElement('button');
    deleteButton.className = 'action-button danger';
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i> Excluir';
    deleteButton.addEventListener('click', () => openDeleteConfirmModal(projeto.id, projeto.nome));

    // Adicionar botões com base nas permissões
    actionsSection.appendChild(detailsButton);
    
    const userRole = localStorage.getItem('userRole');
    if (['diretoria', 'coordenador'].includes(userRole)) {
        actionsSection.appendChild(editButton);
    }
    
    if (userRole === 'diretoria') {
        actionsSection.appendChild(deleteButton);
    }

    // Montar o card completo
    card.appendChild(infoSection);
    card.appendChild(stepperWrapper);
    card.appendChild(actionsSection);

    return card;
}

/**
 * Abre o modal de detalhes do projeto
 * @param {number} projectId - ID do projeto
 */
async function openProjectDetailsModal(projectId) {
    try {
        const response = await fetch(`${API_BASE_URL}/projetos/${projectId}`);
        if (!response.ok) {
            throw new Error('Erro ao buscar detalhes do projeto');
        }
        
        const projeto = await response.json();
        
        const modal = document.getElementById('projectDetailsModal');
        const projectDetailsContent = document.getElementById('projectDetailsContent');
        projectDetailsContent.innerHTML = ''; // Limpa o conteúdo anterior

        // Extrair equipe do JSON
        let equipeText = '';
        try {
            if (projeto.equipe_json) {
                const equipe = JSON.parse(projeto.equipe_json);
                equipeText = Array.isArray(equipe) ? equipe.join(', ') : equipe;
            }
        } catch (e) {
            console.error('Erro ao parsear equipe JSON:', e);
            equipeText = projeto.equipe_json || '';
        }
        
        // Determinar a classe CSS para o status geral do projeto
        let statusClass = '';
        switch (projeto.status) {
            case 'pendente':
                statusClass = 'status-pending';
                break;
            case 'andamento':
                statusClass = 'status-in-progress';
                break;
            case 'atrasado':
                statusClass = 'status-delayed';
                break;
            case 'concluído':
                statusClass = 'status-completed';
                break;
            default:
                statusClass = '';
        }
        
        projectDetailsContent.innerHTML = `
            <div class="project-details-container">
                <div class="project-details-header">
                    <h3>${projeto.nome}</h3>
                </div>
                
                <div class="project-details-sections">
                    <div class="project-details-section">
                        <h4>Informações Gerais</h4>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Líder:</span>
                                <span class="info-value">${projeto.lider}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Percentual Concluído:</span>
                                <span class="info-value">${projeto.percentual_concluido}%</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Data de Início:</span>
                                <span class="info-value">${projeto.data_inicio ? formatDate(projeto.data_inicio) : 'Não definida'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Data de Entrega:</span>
                                <span class="info-value">${projeto.data_fim ? formatDate(projeto.data_fim) : 'Não definida'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Status:</span>
                                <span class="info-value ${statusClass}">${projeto.status.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="project-details-section">
                        <h4>Equipe</h4>
                        <p>${equipeText || 'Nenhum membro definido'}</p>
                    </div>
                    
                    <div class="project-details-section">
                        <h4>Cronograma de Etapas</h4>
                        <table class="details-table">
                            <thead>
                                <tr>
                                    <th>Ordem</th>
                                    <th>Etapa</th>
                                    <th>Data de Início</th>
                                    <th>Data de Fim</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="etapasTableBody">
                                ${getEtapasTableRows(projeto)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        modal.querySelector('.modal-content').classList.add('show'); // Adiciona classe 'show'
        
        // Adicionar event listener ao botão 'Fechar' deste modal específico
        const closeBtn = modal.querySelector('.close-modal-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                closeModal('projectDetailsModal');
            });
        }
        const closeSpan = modal.querySelector('.close-modal');
        if (closeSpan) {
            closeSpan.addEventListener('click', () => {
                closeModal('projectDetailsModal');
            });
        }

    } catch (error) {
        console.error('Erro ao abrir detalhes do projeto:', error);
        showError('Erro ao carregar detalhes do projeto: ' + error.message);
    }
}

// Função auxiliar para gerar as linhas da tabela de etapas nos detalhes
function getEtapasTableRows(projeto) {
    let rows = '';
    
    if (!projeto.customEtapas || projeto.customEtapas.length === 0) {
        return '<tr><td colspan="5" style="text-align: center;">Nenhuma etapa definida para este projeto.</td></tr>';
    }

    projeto.customEtapas.forEach(etapa => {
        const dataInicio = etapa.data_inicio ? formatDate(etapa.data_inicio, true) : 'Não definida';
        const dataFim = etapa.data_fim ? formatDate(etapa.data_fim, true) : 'Não definida';
        
        let status = projeto.statusPorEtapa ? projeto.statusPorEtapa[etapa.id] : 'Pendente';
        let statusClass = '';
        
        switch (status) {
            case 'pendente':
                statusClass = 'status-pending';
                status = 'Pendente';
                break;
            case 'andamento':
                statusClass = 'status-in-progress';
                status = 'Em Andamento';
                break;
            case 'atrasado':
                statusClass = 'status-delayed';
                status = 'Atrasado';
                break;
            case 'concluído':
                statusClass = 'status-completed';
                status = 'Concluído';
                break;
            default:
                statusClass = 'status-pending';
                status = 'Pendente';
        }
        
        rows += `
            <tr>
                <td>${etapa.ordem}</td>
                <td>${etapa.nome_etapa}</td>
                <td>${dataInicio}</td>
                <td>${dataFim}</td>
                <td><span class="${statusClass}">${status}</span></td>
            </tr>
        `;
    });
    
    return rows;
}


/**
 * Abre o modal de edição de projeto.
 * @param {number} projectId - ID do projeto.
 */
async function openEditProjectModal(projectId) {
    try {
        const response = await fetch(`${API_BASE_URL}/projetos/${projectId}`);
        if (!response.ok) {
            throw new Error('Erro ao buscar dados do projeto para edição.');
        }

        const project = await response.json();

        // Preencher o formulário de edição
        document.getElementById('editProjectId').value = project.id;
        document.getElementById('editProjetoNome').value = project.nome;
        document.getElementById('editProjetoLider').value = project.lider;
        document.getElementById('editProjetoEquipe').value = project.equipe_json ? JSON.parse(project.equipe_json).join(', ') : '';

        const editDataInicioInput = document.getElementById('editProjetoDataInicio');
        const editDataFimInput = document.getElementById('editProjetoDataFim');

        // Lógica para desabilitar campos para o perfil 'lider'
        if (['lider'].includes(currentUserRole)) {
            editDataInicioInput.disabled = true;
            editDataInicioInput.classList.add('disabled-field');
            editDataFimInput.disabled = true;
            editDataFimInput.classList.add('disabled-field');
        } else {
            editDataInicioInput.disabled = false;
            editDataInicioInput.classList.remove('disabled-field');
            editDataFimInput.disabled = false;
            editDataFimInput.classList.remove('disabled-field');
        }

        // Datas gerais
        if (project.data_inicio) {
            editDataInicioInput.value = project.data_inicio.split('T')[0];
        } else {
            editDataInicioInput.value = '';
        }

        if (project.data_fim) {
            editDataFimInput.value = project.data_fim.split('T')[0];
        } else {
            editDataFimInput.value = '';
        }

        // --- MODIFICAÇÃO CHAVE: Carregar e renderizar etapas customizadas ---
        const editEtapasContainer = document.getElementById('editEtapasContainer');
        editEtapasContainer.innerHTML = ''; // Limpar etapas antigas

        if (project.customEtapas && project.customEtapas.length > 0) {
            // Guarda os IDs das etapas originais para comparação posterior
            editEtapasContainer.dataset.originalEtapaIds = JSON.stringify(project.customEtapas.map(e => e.id));

            project.customEtapas.sort((a, b) => a.ordem - b.ordem).forEach((etapa) => {
                // Ao carregar, cada etapa existente já terá um dataset.etapaId
                addDynamicEtapaField('editEtapasContainer', 'edit_', etapa);
            });
        } else {
            editEtapasContainer.dataset.originalEtapaIds = JSON.stringify([]); // Nenhuma etapa original
            // Se não houver etapas, adicione uma etapa padrão vazia para começar
            addDynamicEtapaField('editEtapasContainer', 'edit_');
        }
        updateEtapaOrder('editEtapasContainer'); // Garante que a ordem visual esteja correta
        // --- FIM DA MODIFICAÇÃO CHAVE ---

        // Exibir o modal
        const modal = document.getElementById('editProjectModal');
        modal.style.display = 'flex';
        modal.querySelector('.modal-content').classList.add('show'); // Adiciona classe 'show'

    } catch (error) {
        console.error('Erro ao abrir edição do projeto:', error);
        showError('Erro ao abrir edição do projeto: ' + error.message);
    }
}

/**
 * Salva as alterações de um projeto.
 * @param {Event} event - Evento do formulário.
 */
async function saveProjectChanges(event) {
    event.preventDefault();

    const projectId = document.getElementById('editProjectId').value;
    const nome = document.getElementById('editProjetoNome').value;
    const lider = document.getElementById('editProjetoLider').value;
    const equipe = document.getElementById('editProjetoEquipe').value;

    let data_inicio = document.getElementById('editProjetoDataInicio').value;
    let data_fim = document.getElementById('editProjetoDataFim').value;

    // Se o usuário for 'lider', as datas de início e fim do projeto não devem ser alteradas
    if (['lider'].includes(currentUserRole)) {
        try {
            const originalProjectResponse = await fetch(`${API_BASE_URL}/projetos/${projectId}`);
            if (originalProjectResponse.ok) {
                const originalProject = await originalProjectResponse.json();
                data_inicio = originalProject.data_inicio ? originalProject.data_inicio.split('T')[0] : '';
                data_fim = originalProject.data_fim ? originalProject.data_fim.split('T')[0] : '';
            }
        } catch (error) {
            console.warn('Não foi possível recuperar as datas originais do projeto para o perfil de líder, prosseguindo com os valores atuais do formulário:', error);
        }
    }

    // Validar campos obrigatórios do projeto principal
    if (!nome || !lider) {
        showError('Nome e líder do projeto são obrigatórios.');
        return;
    }

    try {
        // 1. Atualizar o projeto principal
        const projectUpdateResponse = await authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome,
                lider,
                equipe,
                data_inicio: data_inicio || null,
                data_fim: data_fim || null,
            })
        });

        if (!projectUpdateResponse.ok) {
            const errorData = await projectUpdateResponse.json().catch(() => ({ error: 'Erro desconhecido ao atualizar projeto.' }));
            throw new Error(errorData.error || 'Erro ao atualizar projeto.');
        }

        // 2. Processar as etapas customizadas (novas/existentes/removidas)
        const etapasToProcess = [];
        const etapasInputs = document.querySelectorAll('#editEtapasContainer .etapa-dynamic-item');
        
        etapasInputs.forEach((item, index) => {
            const etapaId = item.dataset.etapaId || null; // Null se for uma nova etapa
            const nomeEtapa = item.querySelector('.nome-etapa-input').value;
            const dataInicio = item.querySelector('.data-inicio-etapa-input').value;
            const dataFim = item.querySelector('.data-fim-etapa-input').value;

            if (!nomeEtapa) {
                 showError(`O nome da etapa #${index + 1} é obrigatório.`);
                 throw new Error('Nome da etapa não pode ser vazio.'); // Para parar o loop
            }

            etapasToProcess.push({
                id: etapaId,
                nome_etapa: nomeEtapa,
                ordem: index + 1, // A ordem é baseada na posição atual no formulário
                data_inicio: dataInicio || null,
                data_fim: dataFim || null,
                _isDeleted: item.dataset.isDeleted === 'true' // Usar a flag de exclusão
            });
        });

        // Primeiro, obtenha as etapas atuais do banco de dados para o projeto
        const currentStagesResponse = await authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}`);
        const currentProjectData = await currentStagesResponse.json();
        const existingStageIds = new Set(currentProjectData.customEtapas.map(etapa => etapa.id));
        const stagesToKeepIds = new Set(etapasToProcess.filter(e => e.id && !e._isDeleted).map(e => e.id));

        // Excluir etapas que foram removidas no frontend (mas existiam no BD)
        for (const existingId of existingStageIds) {
            if (!stagesToKeepIds.has(existingId)) {
                await authenticatedFetch(`${API_BASE_URL}/etapas/${existingId}`, {
                    method: 'DELETE'
                });
            }
        }

        // Adicionar ou atualizar etapas
        for (const etapa of etapasToProcess) {
            if (etapa._isDeleted) continue; // Já lidado acima

            if (etapa.id) { // Etapa existente
                await authenticatedFetch(`${API_BASE_URL}/etapas/${etapa.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(etapa)
                });
            } else { // Nova etapa
                await authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/etapas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projeto_id: projectId, // O ID do projeto é necessário para novas etapas
                        nome_etapa: etapa.nome_etapa,
                        ordem: etapa.ordem,
                        data_inicio: etapa.data_inicio,
                        data_fim: etapa.data_fim
                    })
                });
            }
        }

        showToast('Projeto e etapas atualizados com sucesso!', 'success');
        closeModal('editProjectModal');
        fetchProjects(); // Atualizar a lista de projetos

    } catch (error) {
        console.error('Erro ao salvar alterações do projeto:', error);
        showError('Erro ao salvar alterações: ' + error.message);
    }
}

/**
 * Abre o modal de confirmação de exclusão de projeto.
 * @param {number} projectId - ID do projeto.
 * @param {string} projectName - Nome do projeto.
 */
function openDeleteConfirmModal(projectId, projectName) {
    document.getElementById('deleteProjectName').textContent = projectName;

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    confirmDeleteBtn.onclick = () => deleteProject(projectId);

    const modal = document.getElementById('confirmDeleteModal');
    modal.style.display = 'flex';
}

/**
 * Exclui um projeto.
 * @param {number} projectId - ID do projeto.
 * @returns {Promise<void>}
 */
async function deleteProject(projectId) {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao excluir projeto.' }));
            throw new Error(errorData.error || 'Erro ao excluir projeto.');
        }

        const result = await response.json();
        showToast(result.message, 'success');
        closeModal('confirmDeleteModal');
        fetchProjects(); // Atualizar a lista de projetos

    } catch (error) {
        console.error('Erro ao excluir projeto:', error);
        showError('Erro ao excluir projeto: ' + error.message);
    }
}

/**
 * Abre o modal de sub-etapas.
 * @param {number} projectId - ID do projeto.
 * @param {number} etapaId - ID da etapa principal (agora é o ID da tabela projeto_etapas).
 */
async function openSubEtapasModal(projectId, etapaId) {
    try {
        // Buscar o nome da etapa a partir do backend (ou do objeto projeto se disponível)
        const etapaResponse = await fetch(`${API_BASE_URL}/etapas/${etapaId}`);
        if (!etapaResponse.ok) {
            throw new Error('Erro ao buscar nome da etapa.');
        }
        const etapaData = await etapaResponse.json();

        const response = await fetch(`${API_BASE_URL}/projetos/${projectId}/sub-etapas?etapa_id=${etapaId}`);
        if (!response.ok) {
            throw new Error('Erro ao buscar sub-etapas do projeto.');
        }

        const subEtapas = await response.json();

        document.getElementById('subEtapasTitulo').textContent = etapaData.nome_etapa; // Exibe o nome customizado
        document.getElementById('subEtapasProjetoId').value = projectId;
        document.getElementById('subEtapasEtapaId').value = etapaId; // Armazena o ID da etapa customizada

        const subEtapasList = document.getElementById('subEtapasList');
        subEtapasList.innerHTML = '';

        if (subEtapas.length === 0) {
            subEtapasList.innerHTML = '<p class="no-sub-etapas">Nenhuma sub-etapa cadastrada para esta etapa.</p>';
        } else {
            subEtapas.forEach(subEtapa => {
                const subEtapaItem = document.createElement('div');
                subEtapaItem.className = 'sub-etapa-item';
                subEtapaItem.dataset.id = subEtapa.id;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let isSubEtapaDelayed = false;
                if (!subEtapa.concluida && subEtapa.data_prevista_conclusao) {
                    try {
                        const dueDate = new Date(subEtapa.data_prevista_conclusao);
                        dueDate.setHours(0, 0, 0, 0);
                        if (dueDate < today) {
                            isSubEtapaDelayed = true;
                        }
                    } catch (e) {
                        console.error("Erro ao analisar a data de vencimento da sub-etapa para verificação de atraso:", e);
                    }
                }

                if (subEtapa.concluida) {
                    subEtapaItem.classList.add('sub-etapa-concluida-visual');
                } else if (isSubEtapaDelayed) {
                    subEtapaItem.classList.add('sub-etapa-atrasada');
                } else {
                    subEtapaItem.classList.add('sub-etapa-em-andamento');
                }

                const descricao = document.createElement('div');
                descricao.className = 'sub-etapa-descricao';
                descricao.textContent = subEtapa.descricao;

                if (subEtapa.concluida) {
                    descricao.innerHTML += ' <span class="sub-etapa-concluida">(Concluída)</span>';
                }

                const actions = document.createElement('div');
                actions.className = 'sub-etapa-actions';

                if (['diretoria', 'coordenador', 'lider'].includes(currentUserRole)) {
                    const editBtn = document.createElement('button');
                    editBtn.className = 'edit-btn small';
                    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                    editBtn.title = 'Editar sub-etapa';
                    editBtn.addEventListener('click', () => openEditSubEtapaModal(subEtapa));
                    actions.appendChild(editBtn);
                }

                if (['diretoria', 'coordenador', 'lider'].includes(currentUserRole)) {
                    if (!subEtapa.concluida) {
                        const completeBtn = document.createElement('button');
                        completeBtn.className = 'complete-btn small';
                        completeBtn.innerHTML = '<i class="fas fa-check"></i>';
                        completeBtn.title = 'Marcar como concluída';
                        completeBtn.addEventListener('click', () => updateSubEtapaStatus(subEtapa.id, true));
                        actions.appendChild(completeBtn);
                    } else {
                        const uncompleteBtn = document.createElement('button');
                        uncompleteBtn.className = 'uncomplete-btn small';
                        uncompleteBtn.innerHTML = '<i class="fas fa-undo"></i>';
                        uncompleteBtn.title = 'Marcar como não concluída';
                        uncompleteBtn.addEventListener('click', () => updateSubEtapaStatus(subEtapa.id, false));
                        actions.appendChild(uncompleteBtn);
                    }
                }

                if (['diretoria'].includes(currentUserRole)) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-btn small';
                    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                    deleteBtn.title = 'Excluir sub-etapa';
                    deleteBtn.addEventListener('click', () => deleteSubEtapa(subEtapa.id));
                    actions.appendChild(deleteBtn);
                }

                subEtapaItem.appendChild(descricao);

                const dueDateDiv = document.createElement('div');
                dueDateDiv.className = 'sub-etapa-due-date';
                let dueDateText = 'Sem data prevista';
                if (subEtapa.data_prevista_conclusao) {
                     try {
                         const dateStr = subEtapa.data_prevista_conclusao.split('T')[0];
                         const date = new Date(dateStr + 'T00:00:00Z');
                         if (!isNaN(date.getTime())) {
                             dueDateText = `Previsto: ${date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
                         }
                     } catch (e) { console.error("Erro ao analisar a data de vencimento:", e); }
                }
                dueDateDiv.textContent = dueDateText;
                subEtapaItem.appendChild(dueDateDiv);

                subEtapaItem.appendChild(actions);
                subEtapasList.appendChild(subEtapaItem);
            });
        }

        document.getElementById('subEtapaDescricao').value = '';
        document.getElementById('newSubEtapaDueDate').value = '';

        const addSubEtapaFormContainer = document.querySelector('.sub-etapas-form');
        if (['diretoria', 'coordenador', 'lider'].includes(currentUserRole)) {
            addSubEtapaFormContainer.style.display = 'block';
        } else {
            addSubEtapaFormContainer.style.display = 'none';
        }

        const modal = document.getElementById('subEtapasModal');
        modal.style.display = 'flex';
        modal.querySelector('.modal-content').classList.add('show'); // Adiciona classe 'show'

    } catch (error) {
        console.error('Erro ao abrir modal de sub-etapas:', error);
        showError('Erro ao abrir sub-etapas: ' + error.message);
    }
}

/**
 * Adiciona uma nova sub-etapa.
 * @param {Event} event - Evento do formulário.
 */
async function addSubEtapa(event) {
    event.preventDefault();

    const projetoId = document.getElementById('subEtapasProjetoId').value;
    const etapaId = document.getElementById('subEtapasEtapaId').value; // Usar o ID da etapa customizada
    const descricao = document.getElementById('subEtapaDescricao').value;
    const dataPrevista = document.getElementById('newSubEtapaDueDate').value;

    if (!descricao) {
        showError('A descrição da sub-etapa é obrigatória.');
        return;
    }

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/projetos/${projetoId}/sub-etapas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                projeto_etapa_id: etapaId, // Enviar o ID da etapa customizada
                descricao,
                data_prevista_conclusao: dataPrevista || null
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao adicionar sub-etapa.' }));
            throw new Error(errorData.error || 'Erro ao adicionar sub-etapa.');
        }

        const result = await response.json();
        showToast(result.message, 'success');

        openSubEtapasModal(projetoId, etapaId); // Reabrir o modal para atualizar a lista

    } catch (error) {
        console.error('Erro ao adicionar sub-etapa:', error);
        showError('Erro ao adicionar sub-etapa: ' + error.message);
    }
}

/**
 * Atualiza o status (concluída/não concluída) de uma sub-etapa.
 * @param {number} subEtapaId - ID da sub-etapa.
 * @param {boolean} concluida - Novo status de conclusão.
 */
async function updateSubEtapaStatus(subEtapaId, concluida) {
    const projetoId = document.getElementById("subEtapasProjetoId").value;
    const etapaId = document.getElementById("subEtapasEtapaId").value; // Usar o ID da etapa customizada

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/sub-etapas/${subEtapaId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                concluida: concluida,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Erro desconhecido ao atualizar status da sub-etapa." }));
            throw new Error(errorData.error || "Erro ao atualizar status da sub-etapa.");
        }

        const result = await response.json();
        showToast(result.message, "success");

        openSubEtapasModal(projetoId, etapaId); // Reabrir o modal para atualizar a lista

    } catch (error) {
        console.error("Erro ao atualizar status da sub-etapa:", error);
        showError("Erro ao atualizar status: " + error.message);
    }
}


/**
 * Exclui uma sub-etapa.
 * @param {number} subEtapaId - ID da sub-etapa.
 */
async function deleteSubEtapa(subEtapaId) {
    const projetoId = document.getElementById('subEtapasProjetoId').value;
    const etapaId = document.getElementById('subEtapasEtapaId').value; // Usar o ID da etapa customizada

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/sub-etapas/${subEtapaId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao excluir sub-etapa.' }));
            throw new Error(errorData.error || 'Erro ao excluir sub-etapa.');
        }

        const result = await response.json();
        showToast(result.message, 'success');

        openSubEtapasModal(projetoId, etapaId); // Reabrir o modal para atualizar a lista

    } catch (error) {
        console.error('Erro ao excluir sub-etapa:', error);
        showError('Erro ao excluir sub-etapa: ' + error.message);
    }
}

// ===============================================
// Funções para a Tela 3 (Cadastro de Projetos)
// ===============================================

/**
 * Adiciona um novo campo de etapa dinamicamente a um container.
 * @param {string} containerId - ID do container onde adicionar a etapa.
 * @param {string} [prefix=''] - Prefixo para IDs de campos (ex: 'edit_').
 * @param {object} [etapaData=null] - Dados de uma etapa existente para pré-preencher.
 */
function addDynamicEtapaField(containerId, prefix = '', etapaData = null) {
    const container = document.getElementById(containerId);
    
    const newEtapaDiv = document.createElement('div');
    newEtapaDiv.className = 'etapa-item etapa-dynamic-item';
    
    if (etapaData) {
        newEtapaDiv.dataset.etapaId = etapaData.id; // Armazena o ID da etapa existente
        newEtapaDiv.dataset.isNew = 'false'; // Indica que não é uma nova etapa
        newEtapaDiv.dataset.isDeleted = 'false'; // Garante que não está marcada para exclusão ao carregar
    } else {
        newEtapaDiv.dataset.etapaId = 'null'; // Para novas etapas, não há ID ainda
        newEtapaDiv.dataset.isNew = 'true';
        newEtapaDiv.dataset.isDeleted = 'false';
    }

    // A ordem será atualizada pela função updateEtapaOrder()
    const nomeEtapaValue = etapaData ? etapaData.nome_etapa : '';
    const dataInicioValue = etapaData && etapaData.data_inicio ? etapaData.data_inicio.replace(' ', 'T').slice(0, 16) : '';
    const dataFimValue = etapaData && etapaData.data_fim ? etapaData.data_fim.replace(' ', 'T').slice(0, 16) : '';

    newEtapaDiv.innerHTML = `
        <h4>Etapa <span class="etapa-order"></span>:
            <input type="text" class="nome-etapa-input" value="${nomeEtapaValue}" placeholder="Nome da Etapa" required>
        </h4>
        <div class="form-row">
            <div class="form-group">
                <label>De:</label>
                <input type="datetime-local" class="data-inicio-etapa-input" value="${dataInicioValue}">
            </div>
            <div class="form-group">
                <label>Até:</label>
                <input type="datetime-local" class="data-fim-etapa-input" value="${dataFimValue}">
            </div>
        </div>
        <button type="button" class="action-button danger remove-etapa-btn">Remover Etapa</button>
    `;
    container.appendChild(newEtapaDiv);

    // Aplicar permissões aos campos de data e nome das etapas
    const dataInicioInput = newEtapaDiv.querySelector('.data-inicio-etapa-input');
    const dataFimInput = newEtapaDiv.querySelector('.data-fim-etapa-input');
    const nomeEtapaInput = newEtapaDiv.querySelector('.nome-etapa-input');
    const removeBtn = newEtapaDiv.querySelector('.remove-etapa-btn');

    if (['lider'].includes(currentUserRole)) {
        // Líder não pode editar nome, datas ou remover etapas
        nomeEtapaInput.disabled = true;
        nomeEtapaInput.classList.add('disabled-field');
        dataInicioInput.disabled = true;
        dataInicioInput.classList.add('disabled-field');
        dataFimInput.disabled = true;
        dataFimInput.classList.add('disabled-field');
        removeBtn.style.display = 'none';
    } else {
        nomeEtapaInput.disabled = false;
        nomeEtapaInput.classList.remove('disabled-field');
        dataInicioInput.disabled = false;
        dataInicioInput.classList.remove('disabled-field');
        dataFimInput.disabled = false;
        dataFimInput.classList.remove('disabled-field');
        removeBtn.style.display = 'inline-block';
    }

    // Adicionar evento para o botão de remover desta nova etapa
    removeBtn.addEventListener('click', (event) => {
        const itemToRemove = event.target.closest('.etapa-dynamic-item');
        
        // Se a etapa tem um ID do banco de dados, não removemos, apenas marcamos para exclusão
        if (itemToRemove.dataset.etapaId && itemToRemove.dataset.etapaId !== 'null') {
            if (confirm('Tem certeza que deseja excluir esta etapa? Isso removerá todas as sub-etapas vinculadas.')) {
                itemToRemove.dataset.isDeleted = 'true';
                itemToRemove.style.display = 'none'; // Esconde visualmente
                updateEtapaOrder(containerId); // Reordena os números das etapas visíveis
            }
        } else {
            // Se for uma nova etapa (ainda não salva no BD), pode remover diretamente
            itemToRemove.remove();
            updateEtapaOrder(containerId); // Reordena os números das etapas visíveis
        }
    });

    updateEtapaOrder(containerId); // Garante que as ordens estejam corretas após adicionar
}

/**
 * Atualiza os números de ordem das etapas dinâmicas no frontend.
 * @param {string} containerId - ID do container das etapas.
 */
function updateEtapaOrder(containerId) {
    const container = document.getElementById(containerId);
    const etapas = container.querySelectorAll('.etapa-dynamic-item:not([data-is-deleted="true"])'); // Apenas visíveis
    etapas.forEach((etapaDiv, index) => {
        etapaDiv.querySelector('.etapa-order').textContent = index + 1;
    });
    // Não precisamos de um dynamicEtapaCounter global aqui, o length de 'etapas' já nos dá o número de etapas visíveis.
}


/**
 * Cadastra um novo projeto.
 * @param {Event} event - Evento do formulário.
 */
async function cadastrarProjeto(event) {
    event.preventDefault();

    const nome = document.getElementById('projetoNome').value;
    const lider = document.getElementById('projetoLider').value;
    const equipe = document.getElementById('projetoEquipe').value;
    const data_inicio = document.getElementById('projetoDataInicio').value;
    const data_fim = document.getElementById('projetoDataFim').value;

    if (!nome || !lider) {
        showError('Nome e líder do projeto são obrigatórios.');
        return;
    }

    const etapasInputs = document.querySelectorAll('#etapasContainer .etapa-dynamic-item');
    const etapasToSave = [];
    
    for (let i = 0; i < etapasInputs.length; i++) {
        const item = etapasInputs[i];
        const nomeEtapa = item.querySelector('.nome-etapa-input').value.trim();
        if (!nomeEtapa) {
            showError(`O nome da etapa #${i + 1} é obrigatório. Por favor, preencha ou remova a etapa.`);
            return;
        }
        etapasToSave.push({
            nome_etapa: nomeEtapa,
            ordem: i + 1,
            data_inicio: item.querySelector('.data-inicio-etapa-input').value || null,
            data_fim: item.querySelector('.data-fim-etapa-input').value || null,
        });
    }

    if (etapasToSave.length === 0) {
        showError('Por favor, adicione pelo menos uma etapa para o projeto.');
        return;
    }

    try {
        // 1. Cadastrar o projeto principal
        const projectResponse = await authenticatedFetch(`${API_BASE_URL}/projetos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome, lider, equipe,
                data_inicio: data_inicio || null,
                data_fim: data_fim || null,
            }),
        });

        if (!projectResponse.ok) {
            const errorData = await projectResponse.json().catch(() => ({ error: 'Erro desconhecido ao cadastrar projeto.' }));
            throw new Error(errorData.error || 'Erro ao cadastrar projeto.');
        }

        const projectResult = await projectResponse.json();
        const newProjectId = projectResult.id;

        // 2. Cadastrar as etapas dinâmicas vinculadas ao novo projeto
        const promises = [];
        for (const etapa of etapasToSave) {
            promises.push(authenticatedFetch(`${API_BASE_URL}/projetos/${newProjectId}/etapas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(etapa)
            }));
        }
        await Promise.all(promises); // Espera todas as etapas serem criadas

        showToast('Projeto e etapas cadastrados com sucesso!', 'success');

        // Limpar formulário
        document.getElementById('cadastroProjetoForm').reset();
        document.getElementById('etapasContainer').innerHTML = '';
        addDynamicEtapaField('etapasContainer'); // Adiciona uma etapa padrão vazia de volta

        // Mudar para a tela de projetos e atualizar a lista
        // O fetchProjects irá buscar os projetos *com as etapas reais e seus IDs reais*
        setTimeout(() => {
            switchScreen('tela2');
            fetchProjects(); // Recarrega os projetos e o stepper será renderizado com IDs corretos
        }, 1500);

    } catch (error) {
        console.error('Erro ao cadastrar projeto:', error);
        showError('Erro ao cadastrar projeto: ' + error.message);
    }
}

/**
 * Abre o modal de edição de projeto.
 * @param {number} projectId - ID do projeto.
 */
async function openEditProjectModal(projectId) {
    try {
        const response = await fetch(`${API_BASE_URL}/projetos/${projectId}`);
        if (!response.ok) {
            throw new Error('Erro ao buscar dados do projeto para edição.');
        }

        const project = await response.json();

        // Preencher o formulário de edição do projeto principal
        document.getElementById('editProjectId').value = project.id;
        document.getElementById('editProjetoNome').value = project.nome;
        document.getElementById('editProjetoLider').value = project.lider;
        document.getElementById('editProjetoEquipe').value = project.equipe_json ? JSON.parse(project.equipe_json).join(', ') : '';

        const editDataInicioInput = document.getElementById('editProjetoDataInicio');
        const editDataFimInput = document.getElementById('editProjetoDataFim');

        // Desabilitar campos de data do projeto para o perfil 'lider'
        if (['lider'].includes(currentUserRole)) {
            editDataInicioInput.disabled = true;
            editDataInicioInput.classList.add('disabled-field');
            editDataFimInput.disabled = true;
            editDataFimInput.classList.add('disabled-field');
        } else {
            editDataInicioInput.disabled = false;
            editDataInicioInput.classList.remove('disabled-field');
            editDataFimInput.disabled = false;
            editDataFimInput.classList.remove('disabled-field');
        }

        // Preencher datas gerais
        editDataInicioInput.value = project.data_inicio ? project.data_inicio.split('T')[0] : '';
        editDataFimInput.value = project.data_fim ? project.data_fim.split('T')[0] : '';

        // --- Carregar e renderizar etapas customizadas existentes ---
        const editEtapasContainer = document.getElementById('editEtapasContainer');
        editEtapasContainer.innerHTML = ''; // Limpar etapas antigas

        if (project.customEtapas && project.customEtapas.length > 0) {
            // Ordenar etapas pela ordem antes de renderizar
            project.customEtapas.sort((a, b) => a.ordem - b.ordem).forEach((etapa) => {
                // Ao carregar, cada etapa existente já terá um dataset.etapaId
                addDynamicEtapaField('editEtapasContainer', 'edit_', etapa);
            });
        } else {
            // Se não houver etapas, adicione uma etapa padrão vazia para começar
            addDynamicEtapaField('editEtapasContainer', 'edit_');
        }
        updateEtapaOrder('editEtapasContainer'); // Garante que a ordem visual esteja correta
        // --- FIM DA MODIFICAÇÃO CHAVE ---

        // Exibir o modal
        const modal = document.getElementById('editProjectModal');
        modal.style.display = 'flex';
        modal.querySelector('.modal-content').classList.add('show');

    } catch (error) {
        console.error('Erro ao abrir edição do projeto:', error);
        showError('Erro ao abrir edição do projeto: ' + error.message);
    }
}

/**
 * Salva as alterações de um projeto, incluindo etapas.
 * Gerencia a atualização do projeto principal, e a adição, atualização e exclusão de etapas.
 * @param {Event} event - Evento do formulário.
 */
async function saveProjectChanges(event) {
    event.preventDefault();

    const projectId = document.getElementById('editProjectId').value;
    const nome = document.getElementById('editProjetoNome').value;
    const lider = document.getElementById('editProjetoLider').value;
    const equipe = document.getElementById('editProjetoEquipe').value;

    let data_inicio = document.getElementById('editProjetoDataInicio').value;
    let data_fim = document.getElementById('editProjetoDataFim').value;

    // Se o usuário for 'lider', as datas de início e fim do projeto não devem ser alteradas
    if (['lider'].includes(currentUserRole)) {
        try {
            const originalProjectResponse = await fetch(`${API_BASE_URL}/projetos/${projectId}`);
            if (originalProjectResponse.ok) {
                const originalProject = await originalProjectResponse.json();
                data_inicio = originalProject.data_inicio ? originalProject.data_inicio.split('T')[0] : '';
                data_fim = originalProject.data_fim ? originalProject.data_fim.split('T')[0] : '';
            }
        } catch (error) {
            console.warn('Não foi possível recuperar as datas originais do projeto para o perfil de líder, prosseguindo com os valores atuais do formulário:', error);
        }
    }

    if (!nome || !lider) {
        showError('Nome e líder do projeto são obrigatórios.');
        return;
    }

    try {
        // 1. Atualizar o projeto principal
        const projectUpdateResponse = await authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome,
                lider,
                equipe,
                data_inicio: data_inicio || null,
                data_fim: data_fim || null,
            })
        });

        if (!projectUpdateResponse.ok) {
            const errorData = await projectUpdateResponse.json().catch(() => ({ error: 'Erro desconhecido ao atualizar projeto.' }));
            throw new Error(errorData.error || 'Erro ao atualizar projeto.');
        }

        // 2. Processar as etapas customizadas (novas/existentes/removidas)
        const editEtapasContainer = document.getElementById('editEtapasContainer');
        const currentEtapasElements = editEtapasContainer.querySelectorAll('.etapa-dynamic-item'); // Todos os elementos de etapa no formulário

        const promises = [];
        const originalEtapaIds = new Set(); // Para acompanhar quais IDs existiam no BD originalmente
        // Primeiro, obtenha os IDs das etapas que já existiam no BD para este projeto
        const currentProjectResponse = await authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}`);
        const currentProjectData = await currentProjectResponse.json();
        if (currentProjectData.customEtapas) {
            currentProjectData.customEtapas.forEach(etapa => originalEtapaIds.add(etapa.id));
        }

        const etapasInFormIds = new Set(); // Para acompanhar quais IDs estão no formulário AGORA

        // Iterar sobre as etapas no formulário para identificar o que fazer
        currentEtapasElements.forEach((item, index) => {
            const etapaId = item.dataset.etapaId === 'null' ? null : parseInt(item.dataset.etapaId); // ID da etapa (null para nova)
            const isMarkedForDeletion = item.dataset.isDeleted === 'true';
            const nomeEtapa = item.querySelector('.nome-etapa-input').value.trim();
            const dataInicio = item.querySelector('.data-inicio-etapa-input').value;
            const dataFim = item.querySelector('.data-fim-etapa-input').value;

            if (isMarkedForDeletion) {
                // Se a etapa estava no BD e foi marcada para exclusão, adiciona a promessa de DELETE
                if (etapaId && originalEtapaIds.has(etapaId)) {
                    promises.push(authenticatedFetch(`${API_BASE_URL}/etapas/${etapaId}`, {
                        method: 'DELETE'
                    }).then(res => {
                        if (!res.ok) {
                            console.error(`Falha ao excluir etapa ${etapaId}:`, res.statusText);
                            throw new Error(`Falha ao excluir etapa ${etapaId}`);
                        }
                    }));
                }
            } else {
                // Etapa não marcada para exclusão: validar e preparar para ADD/PUT
                if (!nomeEtapa) {
                    showError(`O nome da etapa #${index + 1} é obrigatório. As alterações não foram salvas.`);
                    throw new Error('Nome da etapa não pode ser vazio.'); // Aborta o processo
                }

                const etapaData = {
                    nome_etapa: nomeEtapa,
                    ordem: index + 1, // A ordem é baseada na posição atual no formulário
                    data_inicio: dataInicio || null,
                    data_fim: dataFim || null,
                };

                if (etapaId && originalEtapaIds.has(etapaId)) {
                    // Etapa existente (no BD e no formulário), fazer PUT
                    promises.push(authenticatedFetch(`${API_BASE_URL}/etapas/${etapaId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(etapaData)
                    }).then(res => {
                        if (!res.ok) {
                            console.error(`Falha ao atualizar etapa ${etapaId}:`, res.statusText);
                            throw new Error(`Falha ao atualizar etapa ${etapaId}`);
                        }
                    }));
                    etapasInFormIds.add(etapaId); // Marca que essa etapa do BD está no formulário
                } else {
                    // Nova etapa (não estava no BD), fazer POST
                    promises.push(authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/etapas`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projeto_id: projectId,
                            ...etapaData
                        })
                    }).then(res => {
                        if (!res.ok) {
                            console.error(`Falha ao adicionar nova etapa:`, res.statusText);
                            throw new Error(`Falha ao adicionar nova etapa`);
                        }
                    }));
                }
            }
        });
        
        // Executar todas as operações no banco de dados
        await Promise.all(promises);

        showToast('Projeto e etapas atualizados com sucesso!', 'success');
        closeModal('editProjectModal');
        fetchProjects(); // Atualizar a lista de projetos

    } catch (error) {
        console.error('Erro ao salvar alterações do projeto:', error);
        showError('Erro ao salvar alterações: ' + error.message);
    }
}


// ===============================================
// Inicialização e Event Listeners
// ===============================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.querySelector('.modal-content').classList.add('show');
    }
}

// Funções para controle da atualização automática de projetos (Tela 2)
/**
 * Inicia a atualização automática dos dados da tela de projetos.
 * @param {number} intervalSeconds - Intervalo em segundos entre cada atualização.
 */
function startAutoRefreshProjects(intervalSeconds = 10) {
    stopAutoRefreshProjects(); // Garantir que não haja intervalos duplicados
    const intervalMs = intervalSeconds * 1000;
    autoRefreshProjectsInterval = setInterval(() => {
        // Obter o termo de busca atual para manter o filtro/ordenação
        const searchTerm = document.getElementById('projectSearchInput').value;
        fetchProjects(searchTerm);
        // showToast('Projetos atualizados automaticamente!', 'info', 1500); // Feedback suave
    }, intervalMs);
    showToast(`Atualização automática de projetos ativada (${intervalSeconds}s)!`, 'success', 2000);
}

/**
 * Para a atualização automática dos dados da tela de projetos.
 */
function stopAutoRefreshProjects() {
    if (autoRefreshProjectsInterval) {
        clearInterval(autoRefreshProjectsInterval);
        autoRefreshProjectsInterval = null;
        showToast('Atualização automática de projetos desativada.', 'info', 1500);
    }
}

// NOVO: Funções para controle da atualização automática do dashboard (Tela 1)
/**
 * Inicia a atualização automática dos dados do dashboard.
 * @param {number} intervalSeconds - Intervalo em segundos entre cada atualização.
 */
function startAutoRefreshDashboard(intervalSeconds = 10) {
    stopAutoRefreshDashboard(); // Garantir que não haja intervalos duplicados
    const intervalMs = intervalSeconds * 1000;

    // Criar/atualizar o botão de parar atualização
    let stopButton = document.getElementById('stopRefreshButton');
    if (!stopButton) {
        stopButton = document.createElement('button');
        stopButton.id = 'stopRefreshButton';
        stopButton.textContent = 'Parar Atualização Automática';
        stopButton.className = 'action-button secondary';
        stopButton.style.position = 'fixed';
        stopButton.style.bottom = '20px';
        stopButton.style.right = '20px';
        stopButton.style.zIndex = '1000';
        stopButton.addEventListener('click', stopAutoRefreshDashboard);
        document.body.appendChild(stopButton);
    } else {
        stopButton.style.display = 'inline-block'; // Mostra o botão se já existe mas estava oculto
    }

    autoRefreshDashboardInterval = setInterval(() => {
        const selectedDate = document.getElementById('selectedDate').value;
        fetchIndicadores(selectedDate);
        // showToast('Dashboard atualizado automaticamente!', 'info', 1500);
    }, intervalMs);
    showToast(`Atualização automática do dashboard ativada (${intervalSeconds}s)!`, 'success', 2000);
}

/**
 * Para a atualização automática do dashboard.
 */
function stopAutoRefreshDashboard() {
    if (autoRefreshDashboardInterval) {
        clearInterval(autoRefreshDashboardInterval);
        autoRefreshDashboardInterval = null;
        showToast('Atualização automática do dashboard desativada.', 'info', 1500);
        const stopButton = document.getElementById('stopRefreshButton');
        if (stopButton) {
            stopButton.style.display = 'none'; // Oculta o botão
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Verificar token e perfil existentes ao carregar
    currentUserToken = localStorage.getItem('accessToken');
    currentUserRole = localStorage.getItem('userRole');

    if (currentUserToken && currentUserRole) {
        // Se logado, mostrar o conteúdo do aplicativo e aplicar permissões
        document.getElementById('appContent').style.display = 'block';
        applyRolePermissions();
        updateCurrentDateTime();
        setInterval(updateCurrentDateTime, 1000); // Atualiza data/hora no header continuamente

        // Determine a tela ativa inicial (se houver) e inicie o auto-refresh apropriado
        const initialActiveScreen = document.querySelector('.tela.active');
        if (initialActiveScreen && initialActiveScreen.id === 'tela1') {
            setupDateFilter(); // Garante que o dashboard carregue seus dados iniciais
            startAutoRefreshDashboard(10);
        } else if (initialActiveScreen && initialActiveScreen.id === 'tela2') {
            fetchProjects();
            startAutoRefreshProjects(10);
        }
        // Se não houver tela ativa definida, ou for tela3, nenhum auto-refresh é iniciado por padrão.

    } else {
        // Se não logado, mostrar o modal de login
        openModal('loginModal');
    }

    // Envio do formulário de Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Botão de Logout
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Event listeners para modais
    document.querySelectorAll('.close-modal, .close, .close-modal-btn').forEach(element => {
        element.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Fechar modal ao clicar fora do conteúdo
    window.addEventListener('click', function(event) {
        document.querySelectorAll('.modal').forEach(modal => {
            if (event.target === modal && modal.id !== 'loginModal') {
                modal.style.display = 'none';
            }
        });
    });

    // Botão de registrar produção
    const registerProductionBtn = document.getElementById('registerProductionBtn');
    if (registerProductionBtn) {
        registerProductionBtn.addEventListener('click', openRegisterModal);
    }

    // Novo: Botão para atualizar meta dentro do modal de registro
    const updateMetaButton = document.getElementById('updateMetaBtn');
    if (updateMetaButton) {
        updateMetaButton.addEventListener('click', updateDailyMeta);
    }

    // Formulário de registro de produção (agora apenas para produção/reprovados)
    const registerProductionForm = document.getElementById('registerProductionForm');
    if (registerProductionForm) {
        registerProductionForm.addEventListener('submit', registerProduction);
    }

    // Botão de gerar relatório
    const generateReportModalBtn = document.getElementById('generateReportModalBtn');
    if (generateReportModalBtn) {
        generateReportModalBtn.addEventListener('click', function() {
            const modal = document.getElementById('reportModal');
            if (modal) {
                const today = new Date();
                const lastMonth = new Date();
                lastMonth.setMonth(today.getMonth() - 1);

                document.getElementById('reportStartDate').value = lastMonth.toISOString().split('T')[0];
                document.getElementById('reportEndDate').value = today.toISOString().split('T')[0];

                document.getElementById('reportResult').innerHTML = '';
                document.getElementById('reportResult').style.display = 'none';
                document.getElementById('downloadOptions').style.display = 'none';

                modal.style.display = 'flex';
            }
        });
    }

    // Botão de gerar relatório dentro do modal
    const generateReportBtn = document.getElementById('generateReportBtn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateReport);
    }

    // Botões de Download de Relatório - Event Listeners
    const downloadTxtBtn = document.getElementById('downloadTxt');
    const downloadExcelBtn = document.getElementById('downloadExcel');
    const printReportBtn = document.getElementById('printReport');

    if (downloadTxtBtn) {
        downloadTxtBtn.addEventListener('click', downloadReportTxt);
    }
    if (downloadExcelBtn) {
        downloadExcelBtn.addEventListener('click', downloadReportExcel);
    }
    if (printReportBtn) {
        printReportBtn.addEventListener('click', printReport);
    }

    // Botão de busca de projetos
    const searchProjectsBtn = document.getElementById('searchProjectsBtn');
    if (searchProjectsBtn) {
        searchProjectsBtn.addEventListener('click', function() {
            const searchTerm = document.getElementById('projectSearchInput').value;
            fetchProjects(searchTerm); // Chama a função com o termo de busca
        });
    }

    // Opcional: Buscar ao pressionar Enter no campo de busca
    const projectSearchInput = document.getElementById('projectSearchInput');
    if (projectSearchInput) {
        projectSearchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                const searchTerm = this.value;
                fetchProjects(searchTerm);
            }
        });
    }

    // Botão de atualizar projetos (agora apenas limpa a busca e aciona a atualização automática)
    const refreshProjectsBtn = document.getElementById('refreshProjects');
    if (refreshProjectsBtn) {
        refreshProjectsBtn.addEventListener('click', function() {
            document.getElementById('projectSearchInput').value = ''; // Limpa o campo de busca
            fetchProjects(''); // Recarrega todos os projetos (ignora o termo de busca)
            showToast('Projetos atualizados manualmente!', 'info', 1500);
        });
    }

    // Formulário de cadastro de projeto
    const cadastroProjetoForm = document.getElementById('cadastroProjetoForm');
    if (cadastroProjetoForm) {
        cadastroProjetoForm.addEventListener('submit', cadastrarProjeto);
        // Adicionar uma etapa padrão ao carregar o formulário de cadastro
        addDynamicEtapaField('etapasContainer');
        document.getElementById('addEtapaBtn').addEventListener('click', () => addDynamicEtapaField('etapasContainer'));
    }

    // Formulário de edição de projeto
    const editProjectForm = document.getElementById('editProjectForm');
    if (editProjectForm) {
        editProjectForm.addEventListener('submit', saveProjectChanges);
        document.getElementById('editAddEtapaBtn').addEventListener('click', () => addDynamicEtapaField('editEtapasContainer'));
    }

    // Formulário de adição de sub-etapa
    const addSubEtapaForm = document.getElementById('addSubEtapaForm');
    if (addSubEtapaForm) {
        addSubEtapaForm.addEventListener('submit', addSubEtapa);
    }
});


/**
 * Abre o modal de edição de sub-etapa.
 * @param {Object} subEtapa - Objeto da sub-etapa a ser editada.
 */
function openEditSubEtapaModal(subEtapa) {
    document.getElementById("editSubEtapaId").value = subEtapa.id;
    document.getElementById("editSubEtapaProjetoId").value = document.getElementById("subEtapasProjetoId").value;
    document.getElementById("editSubEtapaEtapaId").value = document.getElementById("subEtapasEtapaId").value; // Usa o ID da etapa customizada
    document.getElementById("editSubEtapaDescricao").value = subEtapa.descricao;

    const editSubEtapaDueDateInput = document.getElementById("editSubEtapaDueDate");

    if (['lider'].includes(currentUserRole)) {
        editSubEtapaDueDateInput.disabled = true;
        editSubEtapaDueDateInput.classList.add('disabled-field');
    } else {
        editSubEtapaDueDateInput.disabled = false;
        editSubEtapaDueDateInput.classList.remove('disabled-field');
    }

    let formattedDate =
        subEtapa.data_prevista_conclusao ? subEtapa.data_prevista_conclusao.split("T")[0] : "";
    editSubEtapaDueDateInput.value = formattedDate;

    const modal = document.getElementById("editSubEtapaModal");
    modal.style.display = "flex";
    modal.querySelector('.modal-content').classList.add('show'); // Adiciona classe 'show'

    const form = document.getElementById("editSubEtapaForm");
    form.onsubmit = null;
    form.onsubmit = saveSubEtapaChanges;
}

/**
 * Salva as alterações de uma sub-etapa.
 * @param {Event} event - Evento do formulário.
 */
async function saveSubEtapaChanges(event) {
    event.preventDefault();

    const subEtapaId = document.getElementById("editSubEtapaId").value;
    const projetoId = document.getElementById("editSubEtapaProjetoId").value;
    const etapaId = document.getElementById("editSubEtapaEtapaId").value; // Usa o ID da etapa customizada
    const descricao = document.getElementById("editSubEtapaDescricao").value;
    let dataPrevista = document.getElementById("editSubEtapaDueDate").value;

    if (!descricao) {
        showError("A descrição da sub-etapa é obrigatória.");
        return;
    }

    // Se o usuário for 'lider', a data prevista não deve ser alterada. Pega o valor original.
    if (['lider'].includes(currentUserRole)) {
        try {
            const originalSubEtapaResponse = await fetch(`${API_BASE_URL}/sub-etapas/${subEtapaId}`);
            if (originalSubEtapaResponse.ok) {
                const originalSubEtapa = await originalSubEtapaResponse.json();
                dataPrevista = originalSubEtapa.data_prevista_conclusao ? originalSubEtapa.data_prevista_conclusao.split("T")[0] : '';
            }
        } catch (error) {
            console.warn('Não foi possível obter a data prevista original da sub-etapa para o perfil de líder, prosseguindo com o valor atual do formulário:', error);
        }
    }

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/sub-etapas/${subEtapaId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                descricao: descricao,
                data_prevista_conclusao: dataPrevista || null,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Erro desconhecido ao atualizar status da sub-etapa." }));
            throw new Error(errorData.error || "Erro ao atualizar status da sub-etapa.");
        }

        const result = await response.json();
        showToast(result.message, "success");
        closeModal("editSubEtapaModal");

        openSubEtapasModal(projetoId, etapaId); // Reabrir o modal para atualizar a lista

    } catch (error) {
        console.error("Erro ao salvar alterações da sub-etapa:", error);
        showError("Erro ao salvar alterações: " + error.message);
    }
}