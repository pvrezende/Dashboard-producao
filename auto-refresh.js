/**
 * Código para atualização automática do dashboard a cada 10 segundos
 * 
 * Instruções:
 * 1. Adicione este código ao final do seu arquivo script.js
 * 2. Ou crie um novo arquivo auto-refresh.js e inclua-o no seu HTML após o script.js
 */

// Variável para armazenar o ID do intervalo (permite cancelar se necessário)
let autoRefreshInterval;

/**
 * Inicia a atualização automática dos dados do dashboard
 * @param {number} intervalSeconds - Intervalo em segundos entre cada atualização
 */
function startAutoRefresh(intervalSeconds = 10) {
    // Converter segundos para milissegundos
    const intervalMs = intervalSeconds * 1000;
    
    // Exibir mensagem informativa
    showToast(`Atualização automática ativada a cada ${intervalSeconds} segundos`, 'success');
    
    // Limpar qualquer intervalo existente para evitar múltiplas instâncias
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Configurar o intervalo para atualização periódica
    autoRefreshInterval = setInterval(() => {
        // Obter a data selecionada no filtro
        const selectedDate = document.getElementById('selectedDate').value;
        
        // Atualizar os dados do dashboard
        fetchIndicadores(selectedDate);
        
        // Exibir indicador visual de atualização (opcional)
        const refreshIndicator = document.createElement('div');
        refreshIndicator.textContent = 'Atualizando...';
        refreshIndicator.style.position = 'fixed';
        refreshIndicator.style.bottom = '10px';
        refreshIndicator.style.right = '10px';
        refreshIndicator.style.backgroundColor = 'rgba(0, 123, 255, 0.7)';
        refreshIndicator.style.color = 'white';
        refreshIndicator.style.padding = '5px 10px';
        refreshIndicator.style.borderRadius = '4px';
        refreshIndicator.style.fontSize = '12px';
        refreshIndicator.style.zIndex = '1000';
        document.body.appendChild(refreshIndicator);
        
        // Remover o indicador após 1 segundo
        setTimeout(() => {
            document.body.removeChild(refreshIndicator);
        }, 1000);
        
    }, intervalMs);
    
    // Adicionar botão para parar a atualização automática (opcional)
    addStopRefreshButton();
}

/**
 * Para a atualização automática
 */
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        showToast('Atualização automática desativada', 'info');
        
        // Remover o botão de parar, se existir
        const stopButton = document.getElementById('stopRefreshButton');
        if (stopButton) {
            stopButton.remove();
        }
    }
}

/**
 * Adiciona um botão para parar a atualização automática
 */
function addStopRefreshButton() {
    // Verificar se o botão já existe
    if (document.getElementById('stopRefreshButton')) {
        return;
    }
    
    // Criar o botão
    const stopButton = document.createElement('button');
    stopButton.id = 'stopRefreshButton';
    stopButton.textContent = 'Parar Atualização Automática';
    stopButton.className = 'action-button secondary';
    stopButton.style.position = 'fixed';
    stopButton.style.bottom = '20px';
    stopButton.style.right = '20px';
    stopButton.style.zIndex = '1000';
    
    // Adicionar evento de clique
    stopButton.addEventListener('click', stopAutoRefresh);
    
    // Adicionar ao corpo do documento
    document.body.appendChild(stopButton);
}

// Iniciar a atualização automática quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    // Iniciar com 10 segundos de intervalo
    startAutoRefresh(10);
});

// Reiniciar a atualização automática quando mudar de tela para o dashboard
document.querySelectorAll('.screen-selector button').forEach(button => {
    button.addEventListener('click', function() {
        // Se o botão clicado for o do dashboard (tela1)
        if (this.getAttribute('onclick').includes('tela1')) {
            // Reiniciar a atualização automática
            startAutoRefresh(10);
        } else {
            // Parar a atualização automática se mudar para outra tela
            stopAutoRefresh();
        }
    });
});
