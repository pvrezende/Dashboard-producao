# Dashboard-producao

1 - O arquivo Dashboard-Producao.zip é o zip do do desenvolvimento web do projeto onde teremos todos os arquivos para funcionamento.
1.1 - Dentro dele voce irá encontrar o arquivo producao.sql, devemos criar um perfil com nome 'dash' no mysql : admin : root; senha:root ; localhost:3306 depois de criado podemos importar todas as tabelas para dentro desse banco.
1.2 - Tem um arquivo txt "start-dashboard" dentro dele é só seguir essas dicas que você cria o executavel ".bat" :
Como criar um .bat:
Abra o Bloco de Notas (ou qualquer editor de texto).
Digite os comandos desejados. Exemplo:

"
@echo off
echo Iniciando o servidor...
npm install
node server.js
pause
"

Esse script:
Oculta o eco dos comandos com @echo off.
Mostra uma mensagem.
Executa npm install para instalar dependências.
Inicia o servidor com node server.js.
Espera uma tecla com pause (útil para manter a janela aberta).
Salve com a extensão .bat.
Vá em "Arquivo" > "Salvar como..."
Nomeie como iniciar-servidor.bat
Escolha "Todos os arquivos" no tipo.
Clique em salvar.

2 - input de Dados.zip é o arquivo para informar os testes direto para o banco para aparecer na dashboard web. Abaixo tem instrução de uso:
2.1 - PEGAR O ARQUIVO Input de Dados
2.2 - Colocar na máquina de quem irá realizar os input
2.3 - Extrair as pastas
2.4 - Ir no arquivo Setup.ini e nomear o parâmetro server= com o nome do computador que está rodando o banco de dados, exemplo:

    arquivo Setup: 
    [dataBase]
    conexao=server=PC; port=3306; UID=root; database=producao; pwd=root;

    Nesse arquivo o parâmetro server= recebeu o nome PC, pois o nome do computador que está com o banco é Compras.

2.5 - feito isso, o apontamento está correto e já está funcional para imputar os dados.

3 - Pronto está tudo pronto para o uso : 
