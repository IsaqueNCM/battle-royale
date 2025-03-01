# Documentação do Jogo "Batalha Real"

## Visão Geral

"Batalha Real" é um jogo multiplayer online desenvolvido em JavaScript, utilizando HTML5 Canvas para renderização no cliente e Node.js com Socket.IO para comunicação em tempo real no servidor. O jogo permite que múltiplos jogadores controlem personagens em uma arena, atirem balas, eliminem inimigos (pentágonos) e outros jogadores, competindo por pontuações exibidas em um ranking. O objetivo é sobreviver, acumular pontos e alcançar as melhores posições no placar.

O projeto é dividido em duas partes principais:
- **Backend**: Hospedado em `battle-royale-backend` (atualmente em Render) e responsável por gerenciar o estado do jogo, sincronizar jogadores e pentágonos, e atualizar pontuações.
- **Frontend**: Hospedado em `BATTLE-ROYALE` (atualmente em Vercel) e responsável pela interface do usuário, controles e renderização gráfica.

## Hierarquia de Pastas
BATTLE-ROYALE
├── battle-royale-backend
│   ├── package.json       # Configuração do backend principal (Render)
│   └── server.js          # Código do servidor principal (Render)
├── public                 # Pasta do frontend
│   ├── game.js            # Lógica do cliente (controles, renderização)
│   ├── index.html         # Estrutura HTML do jogo
│   └── style.css          # Estilos visuais do jogo
├── server                 # Backend alternativo (local)
│   ├── package.json       # Configuração do backend alternativo
│   └── server.js          # Código do servidor alternativo
└── package.json           # Configuração do frontend (raiz do projeto)

### Observações
- A pasta `vattle-royale` é a pasta principal e está hospedada em `https://batalha-real.vercel.app`.
- A pasta `battle-royale-backend` é o backend principal hospedado em `https://battle-royale-backend.onrender.com`.
- A pasta `server` contém um backend alternativo, para realização de testes locais.
- A pasta `public` contém os arquivos do frontend.

#### Arquivos

### Raiz do Projeto
- **`package.json`**
  - **Descrição**: Arquivo de configuração do frontend (raiz do projeto).
  - **Conteúdo**: Define o nome (`battle-royale-frontend`), versão, descrição, script de inicialização (`serve public`) e dependência (`serve` para servir os arquivos estáticos).
  - **Função**: Permite rodar o frontend localmente com `npm start`.

### Pasta `battle-royale-backend`
- **`package.json`**
  - **Descrição**: Arquivo de configuração do backend principal.
  - **Conteúdo**: Define o nome (`battle-royale-backend`), versão, descrição, script de inicialização (`node server.js`) e dependências (`express` e `socket.io`).
  - **Função**: Configura o ambiente do servidor hospedado no Render.
- **`server.js`**
  - **Descrição**: Código principal do servidor backend (Render).
  - **Conteúdo**: Implementa um servidor com Express e Socket.IO, gerenciando jogadores, pentágonos, e pontuações (top 3). Inclui lógica de movimento dos pentágonos a 30 FPS, colisões, disparos e eliminações.
  - **Função**: Sincroniza o estado do jogo entre os clientes e atualiza o ranking.

### Pasta `public` (Frontend)
- **`game.js`**
  - **Descrição**: Lógica principal do cliente.
  - **Conteúdo**: Conecta-se ao servidor via Socket.IO, renderiza o jogo no Canvas, gerencia controles (movimento WASD, disparos com mouse), colisões locais e exibe telas de início/fim.
  - **Função**: Executa a interface e a interação do jogador com o jogo.
- **`index.html`**
  - **Descrição**: Estrutura HTML do jogo.
  - **Conteúdo**: Define o layout básico com um Canvas de 800x600 pixels e importa `socket.io`, `game.js` e `style.css`.
  - **Função**: Serve como base para a renderização gráfica.
- **`style.css`**
  - **Descrição**: Estilos visuais do jogo.
  - **Conteúdo**: Define o layout centralizado do Canvas, fontes (Arial) e cores de fundo.
  - **Função**: Estiliza a interface do jogo.

### Pasta `server` (Backend Alternativo)
- **`package.json`**
  - **Descrição**: Arquivo de configuração do backend alternativo.
  - **Conteúdo**: Igual ao `battle-royale-backend/package.json`, com dependências `express` e `socket.io`.
  - **Função**: Configura um servidor alternativo, possivelmente para testes locais.
- **`server.js`**
  - **Descrição**: Código do servidor alternativo.
  - **Conteúdo**: Similar ao `battle-royale-backend/server.js`, mas sem o ranking (`topScores`), com 5 pentágonos iniciais, atualização a 60 FPS e serve arquivos estáticos de `public`.
  - **Função**: Provavelmente usado para desenvolvimento local ou testes.

## Funcionalidades Principais

### Frontend (`public/game.js`)
1. **Conexão com o Servidor**: Usa Socket.IO para conectar ao backend em `https://battle-royale-backend.onrender.com`.
2. **Renderização**:
   - Jogadores (círculos azuis com barra de HP).
   - Pentágonos (roxos perseguidores ou laranjas evasivos).
   - Balas (círculos verdes).
   - Placar lateral e ranking superior.
3. **Controles**:
   - **Movimento**: Teclas WASD.
   - **Mira**: Movimento do mouse.
   - **Disparo**: Clique esquerdo (com cooldown de 500ms).
4. **Telas**:
   - **Início**: Campo de nome e botão "Jogar".
   - **Fim**: Estatísticas do jogo (eliminações, pontuação) e opção de reiniciar.
5. **Client-Side Prediction**: Movimenta o jogador localmente antes da confirmação do servidor, com correção se a diferença exceder 20 unidades.

### Backend (`battle-royale-backend/server.js`)
1. **Gerenciamento de Jogadores**:
   - Adiciona/removes jogadores via eventos `join` e `leave`.
   - Atualiza posições e ângulos via `move`.
2. **Pentágonos**:
   - Spawna até 3 pentágonos grandes (HP 10) e pequenos (HP 5) após destruição.
   - Movimenta pentágonos a 30 FPS com comportamentos "chase" (persegue) ou "evade" (foge).
3. **Colisões e Danos**:
   - Balas contra pentágonos (`bulletHitPentagon`).
   - Balas contra jogadores (`bulletHitPlayer`).
   - Jogadores contra pentágonos (`playerDamaged`).
4. **Ranking**: Mantém os 3 melhores scores (`topScores`) e os atualiza quando um jogador morre.

### Backend Alternativo (`server/server.js`)
- Similar ao backend principal, mas:
  - Mantém 5 pentágonos grandes.
  - Atualiza a 60 FPS.
  - Não possui ranking.
  - Serve arquivos estáticos de `public`.

## Configuração e Execução

### Pré-requisitos
- **Node.js**: Versão 16.x ou superior.
- **npm**: Gerenciador de pacotes do Node.js.

### Backend (`battle-royale-backend`)
1. **Instalação**:
   cd battle-royale-backend
   npm install

2. **Execução local**:
    npm start
    Servidor roda em http://localhost:3000.

3. **Deploy no Render**:
Faça push para https://github.com/IsaqueNCM/battle-royale-backend.
Configure no Render com o comando npm start e porta 3000.

### Frontend (public)
1. **Instalação**:
    cd BATTLE-ROYALE
    npm install

2. **Execução local**:
    npm start
    npm start
    Abre em http://localhost:3000 (necessita do backend rodando).