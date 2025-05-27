const API_BASE_URL = 'http://localhost:3000/api';
let productionChart = null;
const pecasPorCaixa = 12; // Constante para definir quantas peças por caixa

// Global variables for user authentication
let currentUserToken = null;
let currentUserRole = null;

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

    // Se for a tela de projetos, carregar os projetos
    if (screenId === 'tela2') {
        fetchProjects();
    }
}

//deixar em tela cheia
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
        } else if (document.documentElement.msExitFullscreen) { // Corrected: msExitFullscreen
            document.exitFullscreen();
        }
    }
});


// Adicione event listeners para os botões
document.getElementById('toggleFullscreenDashboard').addEventListener('click', function() {
    toggleFullscreen('tela1');
});


// ===============================================
// New: User Authentication Functions
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
        localStorage.setItem('username', data.username); // Store username if needed for display

        closeModal('loginModal');
        document.getElementById('appContent').style.display = 'block'; // Show main content
        applyRolePermissions(); // Apply permissions based on the logged-in role
        showToast(`Bem-vindo, ${data.username}!`, 'success');

        // Initialize dashboard content after login
        updateCurrentDateTime();
        setInterval(updateCurrentDateTime, 1000);
        setupDateFilter();

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
    document.getElementById('appContent').style.display = 'none'; // Hide main content
    openModal('loginModal'); // Show login modal
    document.getElementById('loginForm').reset();
    document.getElementById('loginMessage').textContent = '';
    // Stop auto-refresh if it's running
    if (typeof stopAutoRefresh === 'function') {
        stopAutoRefresh();
    }
}

function applyRolePermissions() {
    const registerProductionBtn = document.getElementById('registerProductionBtn');
    const generateReportModalBtn = document.getElementById('generateReportModalBtn'); // This is always visible now
    const tela3Button = document.querySelector('.screen-selector button[onclick="switchScreen(\'tela3\')"]');

    // Elements within project cards (edit/delete/sub-etapas actions)
    // These will be handled dynamically when project cards are created in createProjectCard
    // and when sub-etapa actions are rendered in openSubEtapasModal.

    // Always visible to everyone (as per "Visualização (Pode ver apenas as 3 telas sem modificar nada) - nesse é aberto para todos !")
    generateReportModalBtn.style.display = 'inline-block';
    document.getElementById('toggleFullscreenDashboard').style.display = 'inline-block';

    // Register Production Button
    if (registerProductionBtn) {
        if (['diretoria', 'coordenador', 'lider'].includes(currentUserRole)) { //
            registerProductionBtn.style.display = 'inline-block';
        } else {
            registerProductionBtn.style.display = 'none';
        }
    }

    // Cadastro de Projetos (Tela 3)
    if (tela3Button) {
        if (['diretoria', 'coordenador'].includes(currentUserRole)) { //
            tela3Button.style.display = 'inline-block';
        } else {
            tela3Button.style.display = 'none';
        }
    }

    // Refresh Projects button is visible for all roles that can see Tela 2 (all roles).
    const refreshProjectsBtn = document.getElementById('refreshProjects');
    if (refreshProjectsBtn) {
        refreshProjectsBtn.style.display = 'inline-block';
    }
}


// Function to make authenticated fetch requests
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

    // Handle 401/403 responses
    if (response.status === 401 || response.status === 403) {
        showError('Sua sessão expirou ou você não tem permissão. Por favor, faça login novamente.');
        handleLogout(); // Log out the user
        throw new Error('Authentication or authorization error');
    }

    return response;
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
        const formattedToday = today.toISOString().split('T')[0]; // FormatogetFullYear()-MM-DD
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
 * @param {Array<Object>} producaoPorHora - Dados de produção por hora.
 */
function updateProductionChart(producaoPorHora) {
    const ctx = document.getElementById('productionChart').getContext('2d');

    const labels = producaoPorHora.map(item => `${String(item.hora).padStart(2, '0')}:00`);
    const data = producaoPorHora.map(item => item.total_pecas);

    // Valor fixo da meta por hora
    const metaPorHora = 8.5;

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
                    label: 'Peças Produzidas por Hora',
                    data: data,
                    backgroundColor: 'rgba(0, 123, 255, 0.5)',
                    borderColor: 'rgba(0, 123, 255, 1)',
                    borderWidth: 1,
                    order: 2 // Ordem de renderização (barras atrás da linha)
                },
                {
                    label: 'Meta por Hora',
                    data: metaData,
                    type: 'line',
                    fill: false,
                    borderColor: '#ffc107', // Amarelo
                    borderWidth: 2,
                    borderDash: [5, 5], // Linha pontilhada
                    pointRadius: 0, // Sem pontos nos dados
                    pointHoverRadius: 0, // Sem pontos ao passar o mouse
                    tension: 0, // Linha reta
                    order: 1 // Ordem de renderização (linha na frente das barras)
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
                        text: 'Total de Peças'
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
                                label += context.parsed.y + ' peças';
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

        // Reset forms to clear previous values
        document.getElementById('registerProductionForm').reset();

        // Set current date for meta input
        const today = new Date();
        const formattedToday = today.toISOString().split('T')[0];
        dataHoraMetaInput.value = formattedToday;

        // Set current date and time for production input
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);
        dataHoraProducaoInput.value = localISOTime;

        // Populate pecasEstimadasInput with current meta for the initially selected date
        // Use the date from the main dashboard filter if available, otherwise today
        const initialSelectedDate = document.getElementById('selectedDate').value || formattedToday;

        try {
            const response = await fetch(`${API_BASE_URL}/indicadores?selectedDate=${initialSelectedDate}`);
            if (response.ok) {
                const data = await response.json();
                const currentMetaBoxes = data.metaDiaria.length > 0 ? data.metaDiaria[0].meta : 0;
                pecasEstimadasInput.value = currentMetaBoxes;
            } else {
                console.error('Failed to fetch current meta for registration modal.');
                pecasEstimadasInput.value = 0; // Default if fetch fails
            }
        } catch (error) {
            console.error('Error fetching current meta:', error);
            pecasEstimadasInput.value = 0; // Default if error
        }

        // Set editability for pecasEstimadasInput and updateMetaBtn based on role
        const updateMetaBtn = document.getElementById('updateMetaBtn');
        if (['diretoria', 'coordenador'].includes(currentUserRole)) {
            pecasEstimadasInput.removeAttribute('readonly');
            pecasEstimadasInput.classList.remove('disabled-field');
            dataHoraMetaInput.removeAttribute('readonly');
            dataHoraMetaInput.classList.remove('disabled-field');
            updateMetaBtn.style.display = 'inline-block';
        } else {
            pecasEstimadasInput.setAttribute('readonly', true);
            pecasEstimadasInput.classList.add('disabled-field');
            dataHoraMetaInput.setAttribute('readonly', true);
            dataHoraMetaInput.classList.add('disabled-field');
            updateMetaBtn.style.display = 'none'; // Hide the update meta button for unauthorized roles
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
    const selectedDate = dataHoraMetaInput.value; // This will be in YYYY-MM-DD format from the input type="date"

    if (isNaN(pecasEstimadas) || pecasEstimadas < 0) {
        showError('Por favor, insira uma quantidade válida de peças estimadas para a meta.');
        return;
    }
    if (!selectedDate) {
        showError('Por favor, selecione uma data para a meta.');
        return;
    }

    // Format the date to DD/MM/YYYY before sending to the backend
    const formattedDateForDB = formatDateForDB(selectedDate); // This is where the conversion happens

    try {
        const metaUpdateResponse = await authenticatedFetch(`${API_BASE_URL}/meta_dia`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: formattedDateForDB, // Sending DD/MM/YYYY
                meta: pecasEstimadas
            }),
        });

        if (!metaUpdateResponse.ok) {
            const errorData = await metaUpdateResponse.json().catch(() => ({ error: "Erro desconhecido ao atualizar meta diária." }));
            throw new Error(errorData.error || 'Erro ao atualizar meta diária.');
        }

        showToast('Meta diária atualizada com sucesso!', 'success');
        fetchIndicadores(document.getElementById('selectedDate').value); // Refresh dashboard indicators
        // closeModal('registerModal'); // Keep modal open if user might want to register production
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
    event.preventDefault(); // Prevent default form submission

    const qtdDadosInput = document.getElementById('qtdDadosInput');
    const pecasReprovadaInput = document.getElementById('pecasReprovadaInput');
    const dataHoraProducaoInput = document.getElementById('dataHoraProducaoInput');

    const qtdDados = parseInt(qtdDadosInput.value) || 0; // Set to 0 if empty or NaN
    const pecasReprovadas = parseInt(pecasReprovadaInput.value) || 0;
    const dateObj = new Date(dataHoraProducaoInput.value);
    const dataHora = formatDateTimeForDB(dateObj); // This formats to 'DD/MM/YYYY HH:mm:ss'
    const selectedDateForRefresh = dataHoraProducaoInput.value.split('T')[0];

    // --- MODIFIED VALIDATION LOGIC ---
    if (qtdDados < 0) { // Only check for negative values
        showError('Por favor, insira uma quantidade válida de caixas produzidas (não negativa).');
        return;
    }
    if (isNaN(pecasReprovadas) || pecasReprovadas < 0) {
        showError('Por favor, insira uma quantidade válida de peças reprovadas (não negativa).');
        return;
    }

    // Check if at least one field has a positive value
    if (qtdDados === 0 && pecasReprovadas === 0) {
        showError('Por favor, insira a quantidade de caixas produzidas ou peças reprovadas para registrar.');
        return;
    }
    // --- END MODIFIED VALIDATION LOGIC ---

    try {
        // Register Production if qtdDados > 0
        if (qtdDados > 0) {
            const productionResponse = await authenticatedFetch(`${API_BASE_URL}/producao`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ qtdDados, dataHora }), // Sends dataHora as 'DD/MM/YYYY HH:mm:ss'
            });

            if (!productionResponse.ok) {
                const errorData = await productionResponse.json().catch(() => ({error: "Erro desconhecido ao registrar."}));
                throw new Error(errorData.error || 'Erro ao registrar produção.');
            }
            showToast('Produção registrada com sucesso!', 'success');
        }

        // Register Rejected Pieces if pecasReprovadas > 0
        if (pecasReprovadas > 0) {
            const eficienciaResponse = await authenticatedFetch(`${API_BASE_URL}/eficiencia`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // This is the call that failed before.
                // It now sends the 'flag' and 'dataHora' to the new dedicated endpoint.
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

        // If only one of them was submitted, give a more specific message, otherwise combine.
        if (qtdDados > 0 && pecasReprovadas > 0) {
            showToast('Produção e peças reprovadas registradas com sucesso!', 'success');
        } else if (qtdDados > 0) {
             // Already handled by specific production success toast above
        } else if (pecasReprovadas > 0) {
            // Already handled by specific rejected pieces success toast above
        }


        // Reset only the production-related fields after successful submission
        qtdDadosInput.value = '';
        pecasReprovadaInput.value = '';

        // Re-set the automatic date/time for the next entry
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        dataHoraProducaoInput.value = (new Date(now - offset)).toISOString().slice(0, 16);

        fetchIndicadores(selectedDateForRefresh); // Refresh dashboard indicators

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

    // Basic date validation
    if (!startDate || !endDate) {
        showError('Por favor, selecione as datas de início e fim para o relatório.');
        return;
    }
    if (new Date(startDate) > new Date(endDate)) {
        showError('A data de início não pode ser posterior à data de fim.');
        return;
    }

    // Use the /relatorio endpoint that supports date range
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
        let totalPiecesProducedOverall = 0;
        let totalPiecesRejectedOverall = 0;

        dailyReportData.forEach(day => {
            totalPiecesEstimatedOverall += day.meta_dia_total || 0;
            totalPiecesProducedOverall += day.total_produzido_dia || 0;
            totalPiecesRejectedOverall += day.total_reprovado_dia || 0;
        });

        const totalPiecesApprovedOverall = totalPiecesProducedOverall - totalPiecesRejectedOverall;

        let overallPercentApproved = 0;
        let overallPercentRejected = 0;

        if (totalPiecesProducedOverall > 0) {
            overallPercentApproved = ((totalPiecesApprovedOverall / totalPiecesProducedOverall) * 100).toFixed(2);
            overallPercentRejected = ((totalPiecesRejectedOverall / totalPiecesProducedOverall) * 100).toFixed(2);
        }

        const totalBoxesEstimatedOverall = Math.floor(totalPiecesEstimatedOverall / pecasPorCaixa);
        const totalBoxesProducedOverall = Math.floor(totalPiecesProducedOverall / pecasPorCaixa);

        const startDateFormatted = new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR');
        const endDateFormatted = new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR');
        const periodoTexto = startDate === endDate ?
            `${startDateFormatted}` :
            `${startDateFormatted} a ${endDateFormatted}`;

        const displayTotalPiecesProducedOverall = Number(totalPiecesProducedOverall);

        const summary = document.createElement('div');
        summary.className = 'report-summary';
        summary.innerHTML = `
            <h3>Resumo do Período: ${periodoTexto}</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Peças Estimadas:</div>
                    <div class="summary-value">${totalBoxesEstimatedOverall} cx (${totalPiecesEstimatedOverall} peças)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Peças Produzidas:</div>
                    <div class="summary-value">${totalBoxesProducedOverall} cx (${displayTotalPiecesProducedOverall} peças)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Aprovados:</div>
                    <div class="summary-value">${totalPiecesApprovedOverall} peças</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Reprovados:</div>
                    <div class="summary-value">${totalPiecesRejectedOverall} peças</div>
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
                    <th>% Reprovado</th> </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');

            dailyReportData.forEach(day => {
                const date = new Date(day.report_date).toLocaleDateString('pt-BR');
                const produzido = day.total_produzido_dia || 0;
                const reprovado = day.total_reprovado_dia || 0;
                const aprovado = produzido - reprovado;
                const meta = day.meta_dia_total || 0;

                let percentAprovadoDia = 0;
                if (produzido > 0) {
                    percentAprovadoDia = ((aprovado / produzido) * 100).toFixed(2);
                }

                let percentReprovadoDia = 0; // CALCULATE % REPROVADO
                if (produzido > 0) { // Calculate based on total produced pieces
                    percentReprovadoDia = ((reprovado / produzido) * 100).toFixed(2);
                }


                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${date}</td>
                    <td>${meta}</td>
                    <td>${produzido}</td>
                    <td>${aprovado}</td>
                    <td>${reprovado}</td>
                    <td>${percentAprovadoDia}%</td>
                    <td>${percentReprovadoDia}%</td> `;
                tbody.appendChild(row);
            });

            table.appendChild(tbody);
            detailsSection.appendChild(table);
            reportResultDiv.appendChild(detailsSection);
        }

        window.reportData = {
            summaryData: {
                totalMeta: totalPiecesEstimatedOverall,
                totalProduzido: totalPiecesProducedOverall,
                totalAprovado: totalPiecesApprovedOverall,
                totalReprovado: totalPiecesRejectedOverall,
                percentAprovados: overallPercentApproved,
                percentReprovados: overallPercentRejected,
                caixasEstimadas: totalBoxesEstimatedOverall,
                caixasProduzidas: totalBoxesProducedOverall
            },
            detailedData: dailyReportData,
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

// --- Report Download Functions ---

/**
 * Downloads the report as a TXT file.
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
    textContent += `Peças Estimadas: ${summaryData.caixasEstimadas} cx (${summaryData.totalMeta} peças)\n`;
    textContent += `Peças Produzidas: ${summaryData.caixasProduzidas} cx (${summaryData.totalProduzido} peças)\n`;
    textContent += `Total Aprovados: ${summaryData.totalAprovado} peças (${summaryData.percentAprovados}%)\n`;
    textContent += `Total Reprovados: ${summaryData.totalReprovado} peças (${summaryData.percentReprovados}%)\n\n`;

    textContent += `DETALHES POR DIA:\n`;
    textContent += `Data\tMeta(peças)\tProduzido(peças)\tAprovado(peças)\tReprovado(peças)\t% Aprovado\t% Reprovado\n`; // NEW HEADER
    detailedData.forEach(day => {
        const date = new Date(day.report_date).toLocaleDateString('pt-BR');
        const produzido = day.total_produzido_dia || 0;
        const reprovado = day.total_reprovado_dia || 0;
        const aprovado = produzido - reprovado;
        const meta = day.meta_dia_total || 0;
        let percentAprovadoDia = (produzido > 0) ? ((aprovado / produzido) * 100).toFixed(2) : 0;
        let percentReprovadoDia = (produzido > 0) ? ((reprovado / produzido) * 100).toFixed(2) : 0; // NEW CALC
        textContent += `${date}\t${meta}\t${produzido}\t${aprovado}\t${reprovado}\t${percentAprovadoDia}%\t${percentReprovadoDia}%\n`; // NEW DATA
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
 * Downloads the report as an Excel (CSV) file.
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

    // Summary section for CSV
    csvContent += `RESUMO DO PERÍODO:\n`;
    csvContent += `"Peças Estimadas (cx)","Peças Estimadas (peças)","Peças Produzidas (cx)","Peças Produzidas (peças)","Total Aprovados (peças)","% Aprovados","Total Reprovados (peças)","% Reprovados"\n`;
    csvContent += `"${summaryData.caixasEstimadas}","${summaryData.totalMeta}","${summaryData.caixasProduzidas}","${summaryData.totalProduzido}","${summaryData.totalAprovado}","${summaryData.percentAprovados}%","${summaryData.totalReprovado}","${summaryData.percentReprovados}%"\n\n`;

    // Detailed section for CSV
    csvContent += `DETALHES POR DIA:\n`;
    csvContent += `"Data","Meta (peças)","Produzido (peças)","Aprovado (peças)","Reprovado (peças)","% Aprovado","% Reprovado"\n`; // NEW HEADER
    detailedData.forEach(day => {
        const date = new Date(day.report_date).toLocaleDateString('pt-BR');
        const produzido = day.total_produzido_dia || 0;
        const reprovado = day.total_reprovado_dia || 0;
        const aprovado = produzido - reprovado;
        const meta = day.meta_dia_total || 0;
        let percentAprovadoDia = (produzido > 0) ? ((aprovado / produzido) * 100).toFixed(2) : 0;
        let percentReprovadoDia = (produzido > 0) ? ((reprovado / produzido) * 100).toFixed(2) : 0; // NEW CALC
        csvContent += `"${date}","${meta}","${produzido}","${aprovado}","${reprovado}","${percentAprovadoDia}%","${percentReprovadoDia}%"\n`; // NEW DATA
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
 * Prints the report using the browser's print functionality.
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

    // Create a printable HTML content
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
                    margin-bottom: 10px; /* for print layout */
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
                    /* Hide elements not relevant for print */
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
                        <th>% Reprovado</th> </tr>
                </thead>
                <tbody>
                    ${detailedData.map(day => `
                        <tr>
                            <td>${new Date(day.report_date).toLocaleDateString('pt-BR')}</td>
                            <td>${day.meta_dia_total || 0}</td>
                            <td>${day.total_produzido_dia || 0}</td>
                            <td>${(day.total_produzido_dia || 0) - (day.total_reprovado_dia || 0)}</td>
                            <td>${day.total_reprovado_dia || 0}</td>
                            <td>${((day.total_produzido_dia || 0) > 0) ? (((day.total_produzido_dia || 0) - (day.total_reprovado_dia || 0)) / (day.total_produzido_dia || 0) * 100).toFixed(2) : '0.00'}%</td>
                            <td>${((day.total_produzido_dia || 0) > 0) ? ((day.total_reprovado_dia || 0) / (day.total_produzido_dia || 0) * 100).toFixed(2) : '0.00'}%</td> </tr>
                    `).join('')}
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
 * Busca e exibe os projetos do backend.
 */
async function fetchProjects() {
    try {
        const response = await fetch(`${API_BASE_URL}/projetos`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar projetos. Resposta não JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar projetos.');
        }
        const projects = await response.json();

        const projectsContainer = document.getElementById('projectsContainer');
        projectsContainer.innerHTML = '';

        if (projects.length === 0) {
            projectsContainer.innerHTML = '<p class="no-projects">Nenhum projeto encontrado. Cadastre um novo projeto na aba "Cadastro de Projetos".</p>';
            return;
        }

        projects.forEach(project => {
            const projectCard = createProjectCard(project);
            projectsContainer.appendChild(projectCard);
        });

    } catch (error) {
        console.error('Erro ao carregar projetos:', error);
        showError('Erro ao carregar projetos: ' + error.message);
    }
}

/**
 * Cria um card de projeto para exibição.
 * @param {Object} project - Dados do projeto, incluindo `percentuaisPorEtapa` e `atrasosPorEtapa`.
 * @returns {HTMLElement} Elemento do card do projeto.
 */
function createProjectCard(project) {
    const card = document.createElement("div");
    card.className = "project-card";
    card.dataset.projectId = project.id;

    // Informações do projeto
    const projectInfo = document.createElement("div");
    projectInfo.className = "project-info";

    const projectName = document.createElement("div");
    projectName.className = "project-info-name";
    projectName.textContent = project.nome;

    const projectDetails = document.createElement("div");
    projectDetails.className = "project-info-details";

    // Tentar parsear a equipe JSON
    let equipe = [];
    try {
        if (project.equipe_json) {
            equipe = JSON.parse(project.equipe_json);
        }
    } catch (e) {
        console.error("Erro ao parsear equipe JSON:", e);
    }

    projectDetails.innerHTML = `
        <strong>Líder:</strong> ${project.lider}<br>
        <strong>Equipe:</strong> ${Array.isArray(equipe) ? equipe.join(", ") : "Não definida"}<br>
        <strong>Início:</strong> ${project.data_inicio ? new Date(project.data_inicio).toLocaleDateString("pt-BR") : "Não definido"}<br>
        <strong>Entrega:</strong> ${project.data_fim ? new Date(project.data_fim).toLocaleDateString("pt-BR") : "Não definido"}
    `;

    projectInfo.appendChild(projectName);
    projectInfo.appendChild(projectDetails);

    // Stepper (barra de progresso)
    const stepperWrapper = document.createElement("div");
    stepperWrapper.className = "project-stepper-wrapper";

    const stepperText = document.createElement("div");
    stepperText.className = "stepper-text";
    stepperText.innerHTML = `<strong>Progresso por Etapa:</strong>`; // Texto ajustado

    const stepperContainer = document.createElement("div");
    stepperContainer.className = "stepper-container";

    // Criar os 7 passos do stepper
    for (let i = 1; i <= 7; i++) {
        const step = document.createElement("div");
        step.className = "step";

        // Obter o percentual e status de atraso da etapa atual
        const percentage = project.percentuaisPorEtapa ? (project.percentuaisPorEtapa[i] !== undefined ? project.percentuaisPorEtapa[i] : 0) : 0;
        const isDelayed = project.atrasosPorEtapa ? (project.atrasosPorEtapa[i] === true) : false;
        const displayPercentage = Math.round(percentage);

        // Exibir a porcentagem dentro da bolinha
        step.textContent = `${displayPercentage}%`;

        // Add classes based on percentage and delay status
        // Prioritize delay status
        if (isDelayed && percentage < 100) { // Check delay first, but only if not completed
             step.classList.add("delayed"); // Red
        } else if (percentage === 100) {
            step.classList.add("completed"); // Green
        } else if (percentage > 0) { // In progress, not delayed, not 100%
            step.classList.add("active"); // Blue
        } else {
            // Percentage is 0 and not delayed: remains default grey
        }

        // Adicionar rótulo da etapa
        const stepLabel = document.createElement("div");
        stepLabel.className = "step-label";

        switch (i) {
            case 1: stepLabel.textContent = "Projeto"; break;
            case 2: stepLabel.textContent = "Compras"; break;
            case 3: stepLabel.textContent = "Usinagem"; break;
            case 4: stepLabel.textContent = "Montagem"; break;
            case 5: stepLabel.textContent = "Elétrica"; break;
            case 6: stepLabel.textContent = "Testes"; break;
            case 7: stepLabel.textContent = "Concluído"; break;
        }

        step.appendChild(stepLabel);

        // Adicionar datas de início/fim da etapa acima do step
        const stepDate = document.createElement("div");
        stepDate.className = "step-date";

        // Obter datas de início e fim da etapa
        const dataFim = project[`data_fim_etapa${i}`];

        if (dataFim) {
            stepDate.textContent = formatDate(dataFim, false);
        }

        step.appendChild(stepDate);

        // Adicionar evento de clique para mostrar sub-etapas
        step.addEventListener("click", () => {
            openSubEtapasModal(project.id, i);
        });

        stepperContainer.appendChild(step);
    }

    stepperWrapper.appendChild(stepperText);
    stepperWrapper.appendChild(stepperContainer);

    // Botões de ação
    const projectActions = document.createElement("div");
    projectActions.className = "project-actions";

    const viewButton = document.createElement("button");
    viewButton.className = "view-btn";
    viewButton.innerHTML = '<i class="fas fa-eye"></i> Detalhes';
    viewButton.addEventListener('click', () => openProjectDetailsModal(project.id));

    const editButton = document.createElement('button');
    editButton.className = 'edit-btn';
    editButton.innerHTML = '<i class="fas fa-edit"></i> Editar';
    editButton.addEventListener('click', () => openEditProjectModal(project.id));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i> Excluir';
    deleteButton.addEventListener('click', () => openDeleteConfirmModal(project.id, project.nome));

    projectActions.appendChild(viewButton);
    // Apply role-based visibility to edit and delete buttons
    if (['diretoria', 'coordenador', 'lider'].includes(currentUserRole)) { // Edit
        projectActions.appendChild(editButton);
    }
    if (['diretoria'].includes(currentUserRole)) { // Delete
        projectActions.appendChild(deleteButton);
    }

    // Montar o card completo
    card.appendChild(projectInfo);
    card.appendChild(stepperWrapper);
    card.appendChild(projectActions);

    return card;
}

/**
 * Verifica se um projeto está atrasado com base nas datas definidas.
 * @param {Object} project - Dados do projeto.
 * @returns {boolean} True se o projeto estiver atrasado, false caso contrário.
 */
function checkIfProjectDelayed(project) {
    // Se o projeto já estiver concluído (etapa 7), não está atrasado
    if (parseInt(project.etapa_atual) === 7) {
        return false;
    }

    const today = new Date();

    // Verificar se a data de entrega já passou (considerando o fim do dia)
    if (project.data_fim) {
        const dataFim = new Date(project.data_fim);
        // Ajustar para o final do dia (23:59:59.999)
        dataFim.setHours(23, 59, 59, 999);

        if (today > dataFim) {
            return true;
        }
    }

    // Verificar se a data de fim da etapa atual já passou (considerando o fim do dia)
    const dataFimEtapaAtual = project[`data_fim_etapa${project.etapa_atual}`];
    if (dataFimEtapaAtual) {
        const dataFim = new Date(dataFimEtapaAtual);
        // Ajustar para o final do dia (23:59:59.999)
        dataFim.setHours(23, 59, 59, 999);

        if (today > dataFim) {
            return true;
        }
    }

    return false;
}

/**
 * Abre o modal de detalhes do projeto.
 * @param {number} projectId - ID do projeto.
 */
async function openProjectDetailsModal(projectId) {
    try {
        const response = await fetch(`${API_BASE_URL}/projetos/${projectId}`);
        if (!response.ok) {
            throw new Error('Erro ao buscar detalhes do projeto.');
        }

        const project = await response.json();

        const detailsContent = document.getElementById('projectDetailsContent');
        detailsContent.innerHTML = '';

        // Criar conteúdo de detalhes
        const detailsHTML = `
            <div class="project-details">
                <h3>${project.nome}</h3>
                <div class="details-section">
                    <h4>Informações Gerais</h4>
                    <p><strong>Líder:</strong> ${project.lider}</p>
                    <p><strong>Etapa Atual:</strong> ${getEtapaNome(project.etapa_atual)} (${project.etapa_atual}/7)</p>
                    <p><strong>Percentual Concluido:</strong> ${parseFloat(project.percentual_concluido).toFixed(2)}%</p>
                    <p><strong>Data de Início:</strong> ${project.data_inicio ? new Date(project.data_inicio).toLocaleDateString('pt-BR') : 'Não definida'}</p>
                    <p><strong>Data de Entrega:</strong> ${project.data_fim ? new Date(project.data_fim).toLocaleDateString('pt-BR') : 'Não definida'}</p>
                </div>

                <div class="details-section">
                    <h4>Equipe</h4>
                    <p>${getEquipeFormatada(project.equipe_json)}</p>
                </div>

                <div class="details-section">
                    <h4>Cronograma de Etapas</h4>
                    <table class="details-table">
                        <thead>
                            <tr>
                                <th>Etapa</th>
                                <th>Data de Início</th>
                                <th>Data de Fim</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${getCronogramaEtapasHTML(project)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        detailsContent.innerHTML = detailsHTML;

        // Exibir o modal
        const modal = document.getElementById('projectDetailsModal');
        modal.style.display = 'flex';

    } catch (error) {
        console.error('Erro ao abrir detalhes do projeto:', error);
        showError('Erro ao abrir detalhes do projeto: ' + error.message);
    }
}

/**
 * Obtém o nome da etapa com base no número.
 * @param {number} etapaNumero - Número da etapa.
 * @returns {string} Nome da etapa.
 */
function getEtapaNome(etapaNumero) {
    switch (parseInt(etapaNumero)) {
        case 1: return 'Projeto';
        case 2: return 'Compras';
        case 3: return 'Usinagem';
        case 4: return 'Montagem';
        case 5: return 'Elétrica';
        case 6: return 'Testes';
        case 7: return 'Concluído';
        default: return 'Desconhecida';
    }
}

/**
 * Formata a equipe do projeto para exibição.
 * @param {string} equipeJson - JSON da equipe.
 * @returns {string} Equipe formatada.
 */
function getEquipeFormatada(equipeJson) {
    if (!equipeJson) return 'Nenhum membro definido';

    try {
        const equipe = JSON.parse(equipeJson);
        if (Array.isArray(equipe) && equipe.length > 0) {
            return equipe.join(', ');
        }
    } catch (e) {
        console.error('Erro ao parsear equipe JSON:', e);
    }

    return 'Nenhum membro definido';
}

/**
 * Gera o HTML do cronograma de etapas para o modal de detalhes.
 * @param {Object} project - Dados do projeto.
 * @returns {string} HTML do cronograma.
 */
function getCronogramaEtapasHTML(project) {
    let html = '';
    const etapaAtual = parseInt(project.etapa_atual);
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 1; i <= 7; i++) {
        const dataInicio = project[`data_inicio_etapa${i}`];
        const dataFim = project[`data_fim_etapa${i}`];

        let status = '';
        let statusClass = '';

        if (i === 7 && etapaAtual === 7) {
            status = 'Concluída';
            statusClass = 'status-completed';
        } else if (i < etapaAtual) {
            status = 'Concluída';
            statusClass = 'status-completed';
        } else if (i === etapaAtual) {
            status = 'Em andamento';
            statusClass = 'status-active';

            if (dataFim) {
                const etapaFimObj = new Date(dataFim);
                etapaFimObj.setHours(23,59,59,999);
                if (today > etapaFimObj) {
                    status = 'Em andamento (Atrasada)';
                    statusClass = 'status-delayed';
                }
            }
        } else {
            status = 'Pendente';
            statusClass = 'status-pending';
        }

        html += `
            <tr>
                <td>${i} - ${getEtapaNome(i)}</td>
                <td>${dataInicio ? formatDate(dataInicio, true) : 'Não definida'}</td>
                <td>${dataFim ? formatDate(dataFim, true) : 'Não definida'}</td>
                <td class="${statusClass}">${status}</td>
            </tr>
        `;
    }

    return html;
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
        document.getElementById('editProjetoEtapa').value = project.etapa_atual;

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

        // Equipe
        let equipe = [];
        try {
            if (project.equipe_json) {
                equipe = JSON.parse(project.equipe_json);
                if (Array.isArray(equipe)) {
                    document.getElementById('editProjetoEquipe').value = equipe.join(', ');
                }
            }
        } catch (e) {
            console.error('Erro ao parsear equipe JSON:', e);
        }

        // Datas das etapas
        for (let i = 1; i <= 7; i++) {
            const dataInicio = project[`data_inicio_etapa${i}`];
            const dataFim = project[`data_fim_etapa${i}`];

            const editDataInicioEtapaInput = document.getElementById(`editDataInicioEtapa${i}`);
            const editDataFimEtapaInput = document.getElementById(`editDataFimEtapa${i}`);

            // As datas das etapas não são editáveis para o perfil 'lider' neste novo requisito
            if (['lider'].includes(currentUserRole)) {
                editDataInicioEtapaInput.disabled = true;
                editDataInicioEtapaInput.classList.add('disabled-field');
                editDataFimEtapaInput.disabled = true;
                editDataFimEtapaInput.classList.add('disabled-field');
            } else {
                editDataInicioEtapaInput.disabled = false;
                editDataInicioEtapaInput.classList.remove('disabled-field');
                editDataFimEtapaInput.disabled = false;
                editDataFimEtapaInput.classList.remove('disabled-field');
            }

            if (dataInicio) {
                editDataInicioEtapaInput.value = dataInicio.replace(' ', 'T').slice(0, 16);
            } else {
                editDataInicioEtapaInput.value = '';
            }

            if (dataFim) {
                editDataFimEtapaInput.value = dataFim.replace(' ', 'T').slice(0, 16);
            } else {
                editDataFimEtapaInput.value = '';
            }
        }

        // Exibir o modal
        const modal = document.getElementById('editProjectModal');
        modal.style.display = 'flex';

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
    const etapa_atual = document.getElementById('editProjetoEtapa').value;

    let data_inicio = document.getElementById('editProjetoDataInicio').value;
    let data_fim = document.getElementById('editProjetoDataFim').value;

    // Se o usuário for 'lider', as datas de início e fim do projeto não devem ser alteradas
    if (['lider'].includes(currentUserRole)) {
        // Re-fetch original project data to ensure these fields are not overwritten
        try {
            const originalProjectResponse = await fetch(`${API_BASE_URL}/projetos/${projectId}`);
            if (originalProjectResponse.ok) {
                const originalProject = await originalProjectResponse.json();
                data_inicio = originalProject.data_inicio ? originalProject.data_inicio.split('T')[0] : '';
                data_fim = originalProject.data_fim ? originalProject.data_fim.split('T')[0] : '';
            }
        } catch (error) {
            console.warn('Could not retrieve original project dates for leader role, proceeding with current form values:', error);
        }
    }

    const datas = {};
    for (let i = 1; i <= 7; i++) {
        const dataInicioInput = document.getElementById(`editDataInicioEtapa${i}`);
        const dataFimInput = document.getElementById(`editDataFimEtapa${i}`);

        // Para o líder, as datas das etapas não devem ser alteradas. Pega o valor original.
        if (['lider'].includes(currentUserRole)) {
            // Se o campo estiver desabilitado, o valor no DOM é o que foi preenchido originalmente.
            // O backend deve ter a lógica para ignorar estas datas para 'lider' também, se for crítica.
            datas[`data_inicio_etapa${i}`] = dataInicioInput.value;
            datas[`data_fim_etapa${i}`] = dataFimInput.value;
        } else {
            // Para outros papéis, usa os valores do formulário
            if (dataInicioInput.value) {
                datas[`data_inicio_etapa${i}`] = dataInicioInput.value;
            }

            if (dataFimInput.value) {
                datas[`data_fim_etapa${i}`] = dataFimInput.value;
            }
        }
    }

    // Validar campos obrigatórios
    if (!nome || !lider || !etapa_atual) {
        showError('Nome, líder e etapa atual são obrigatórios.');
        return;
    }

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nome,
                lider,
                equipe,
                etapa_atual,
                data_inicio,
                data_fim,
                ...datas
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao atualizar projeto.' }));
            throw new Error(errorData.error || 'Erro ao atualizar projeto.');
        }

        const result = await response.json();
        showToast(result.message, 'success');
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
 * @param {number} etapaPrincipal - Número da etapa principal.
 */
async function openSubEtapasModal(projectId, etapaPrincipal) {
    try {
        const response = await fetch(`${API_BASE_URL}/projetos/${projectId}/sub-etapas?etapa=${etapaPrincipal}`);
        if (!response.ok) {
            throw new Error('Erro ao buscar sub-etapas do projeto.');
        }

        const subEtapas = await response.json();

        document.getElementById('subEtapasTitulo').textContent = `Etapa ${etapaPrincipal} - ${getEtapaNome(etapaPrincipal)}`;
        document.getElementById('subEtapasProjetoId').value = projectId;
        document.getElementById('subEtapasEtapaPrincipal').value = etapaPrincipal;

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
                        console.error("Error parsing sub-etapa due date for delay check:", e);
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
                     } catch (e) { console.error("Error parsing due date:", e); }
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
    const etapaPrincipal = document.getElementById('subEtapasEtapaPrincipal').value;
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
                etapa_principal: etapaPrincipal,
                descricao,
                data_prevista_conclusao: dataPrevista
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao adicionar sub-etapa.' }));
            throw new Error(errorData.error || 'Erro ao adicionar sub-etapa.');
        }

        const result = await response.json();
        showToast(result.message, 'success');

        openSubEtapasModal(projetoId, etapaPrincipal);

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
    const etapaPrincipal = document.getElementById("subEtapasEtapaPrincipal").value;

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

        openSubEtapasModal(projetoId, etapaPrincipal);

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
    const etapaPrincipal = document.getElementById('subEtapasEtapaPrincipal').value;

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

        openSubEtapasModal(projetoId, etapaPrincipal);

    } catch (error) {
        console.error('Erro ao excluir sub-etapa:', error);
        showError('Erro ao excluir sub-etapa: ' + error.message);
    }
}

// ===============================================
// Funções para a Tela 3 (Cadastro de Projetos)
// ===============================================

/**
 * Cadastra um novo projeto.
 * @param {Event} event - Evento do formulário.
 */
async function cadastrarProjeto(event) {
    event.preventDefault();

    const nome = document.getElementById('projetoNome').value;
    const lider = document.getElementById('projetoLider').value;
    const equipe = document.getElementById('projetoEquipe').value;
    const etapa_atual = document.getElementById('projetoEtapa').value;
    const data_inicio = document.getElementById('projetoDataInicio').value;
    const data_fim = document.getElementById('projetoDataFim').value;

    // Datas das etapas
    const datas = {};
    for (let i = 1; i <= 7; i++) {
        const dataInicio = document.getElementById(`dataInicioEtapa${i}`).value;
        const dataFim = document.getElementById(`dataFimEtapa${i}`).value;

        if (dataInicio) {
            datas[`data_inicio_etapa${i}`] = dataInicio;
        }

        if (dataFim) {
            datas[`data_fim_etapa${i}`] = dataFim;
        }
    }

    // Validar campos obrigatórios
    if (!nome || !lider) {
        showError('Nome e líder do projeto são obrigatórios.');
        return;
    }

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/projetos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nome,
                lider,
                equipe,
                etapa_atual,
                data_inicio,
                data_fim,
                ...datas
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao cadastrar projeto.' }));
            throw new Error(errorData.error || 'Erro ao cadastrar projeto.');
        }

        const result = await response.json();

        // Exibir mensagem de sucesso
        const statusMsg = document.getElementById('statusMsg');
        statusMsg.textContent = result.message;
        statusMsg.className = 'success';
        statusMsg.style.display = 'block';

        // Limpar formulário
        document.getElementById('cadastroProjetoForm').reset();

        // Esconder mensagem após alguns segundos
        setTimeout(() => {
            statusMsg.style.display = 'none';
        }, 5000);

        // Mudar para a tela de projetos e atualizar a lista
        setTimeout(() => {
            switchScreen('tela2');
            fetchProjects();
        }, 1500);

    } catch (error) {
        console.error('Erro ao cadastrar projeto:', error);

        // Exibir mensagem de erro
        const statusMsg = document.getElementById('statusMsg');
        statusMsg.textContent = 'Erro ao cadastrar projeto: ' + error.message;
        statusMsg.className = 'error';
        statusMsg.style.display = 'block';

        // Esconder mensagem após alguns segundos
        setTimeout(() => {
            statusMsg.style.display = 'none';
        }, 5000);
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

document.addEventListener('DOMContentLoaded', function() {
    // Check for existing token and role on load
    currentUserToken = localStorage.getItem('accessToken');
    currentUserRole = localStorage.getItem('userRole');

    if (currentUserToken && currentUserRole) {
        // If logged in, show app content and apply permissions
        document.getElementById('appContent').style.display = 'block';
        applyRolePermissions();
        // Initialize dashboard content
        updateCurrentDateTime();
        setInterval(updateCurrentDateTime, 1000);
        setupDateFilter();
    } else {
        // If not logged in, show login modal
        openModal('loginModal');
    }

    // Login Form Submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Logout Button
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

    // Formulário de registro de produção (agora só para produção/reprovados)
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

    // Report Download Buttons - Event Listeners
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

    // Botão de atualizar projetos
    const refreshProjectsBtn = document.getElementById('refreshProjects');
    if (refreshProjectsBtn) {
        refreshProjectsBtn.addEventListener('click', fetchProjects);
    }


    // Formulário de cadastro de projeto
    const cadastroProjetoForm = document.getElementById('cadastroProjetoForm');
    if (cadastroProjetoForm) {
        cadastroProjetoForm.addEventListener('submit', cadastrarProjeto);
    }

    // Formulário de edição de projeto
    const editProjectForm = document.getElementById('editProjectForm');
    if (editProjectForm) {
        editProjectForm.addEventListener('submit', saveProjectChanges);
    }

    // Formulário de adição de sub-etapa
    const addSubEtapaForm = document.getElementById('addSubEtapaForm');
    if (addSubEtapaForm) {
        addSubEtapaForm.addEventListener('submit', addSubEtapa);
    }

    // Carregar projetos se estiver na tela de projetos
    if (document.querySelector('.tela.active').id === 'tela2') {
        fetchProjects();
    }
});


/**
 * Abre o modal de edição de sub-etapa.
 * @param {Object} subEtapa - Objeto da sub-etapa a ser editada.
 */
function openEditSubEtapaModal(subEtapa) {
    document.getElementById("editSubEtapaId").value = subEtapa.id;
    document.getElementById("editSubEtapaProjetoId").value = document.getElementById("subEtapasProjetoId").value;
    document.getElementById("editSubEtapaEtapaPrincipal").value = document.getElementById("subEtapasEtapaPrincipal").value;
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
    const etapaPrincipal = document.getElementById("editSubEtapaEtapaPrincipal").value;
    const descricao = document.getElementById("editSubEtapaDescricao").value;
    let dataPrevista = document.getElementById("editSubEtapaDueDate").value;

    if (!descricao) {
        showError("A descrição da sub-etapa é obrigatória.");
        return;
    }

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
            const errorData = await response.json().catch(() => ({ error: "Erro desconhecido ao atualizar sub-etapa." }));
            throw new Error(errorData.error || "Erro ao atualizar sub-etapa.");
        }

        const result = await response.json();
        showToast(result.message, "success");
        closeModal("editSubEtapaModal");

        openSubEtapasModal(projetoId, etapaPrincipal);

    } catch (error) {
        console.error("Erro ao salvar alterações da sub-etapa:", error);
        showError("Erro ao salvar alterações: " + error.message);
    }
}