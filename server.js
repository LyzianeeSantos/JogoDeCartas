const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

let players = [];
let readyPlayers = 0;

const baseCardTypes = [
  { name: 'Fogo', img: '/imagens/fogo.png' },
  { name: 'Água', img: '/imagens/agua.png' },
  { name: 'Terra', img: '/imagens/terra.png' },
  { name: 'Raio', img: '/imagens/raio.png' },
  { name: 'Tempestade', img: '/imagens/tempestade.png' },
  { name: 'Terremoto', img: '/imagens/terremoto.png' },
  { name: 'Lava', img: '/imagens/lava.png' },
  { name: 'Ar', img: '/imagens/Ar.png' },
];

const generateCardPool = () => {
  return baseCardTypes.map(card => ({
    name: card.name,
    attack: Math.floor(Math.random() * 12) + 1,
    image: card.img
  }));
};

const drawRandomDeck = (cardPool, count = 3) => {
  const shuffled = [...cardPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const gameState = {
  players: {},
  rounds: [],
  currentRound: 0,
  names: {},
  sharedCardPool: null
};

const broadcast = (msg) => {
  players.forEach(p => p.send(JSON.stringify(msg)));
};

wss.on('connection', (ws) => {
  if (players.length >= 2) {
    ws.send(JSON.stringify({ type: 'error', message: 'Sala cheia' }));
    ws.close();
    return;
  }

    const playerId = players.length;
  players.push(ws);
  console.log(`Jogador ${playerId} conectado.`);

     if (!gameState.sharedCardPool) {
    gameState.sharedCardPool = generateCardPool();
  }

    gameState.players[playerId] = {
    deck: drawRandomDeck(gameState.sharedCardPool),
    selectedCard: null,
    score: 0,
    wantsRestart: false
  };

    ws.send(JSON.stringify({ type: 'welcome', playerId, deck: gameState.players[playerId].deck }));

  if (players.length === 2) {
    broadcast({ type: 'start' });
  }

    ws.on('message', (msg) => {
    const data = JSON.parse(msg);

    if (data.type === 'set-name') {
      gameState.names[playerId] = data.name;
      ws.send(JSON.stringify({ type: 'name-confirmed', playerId }));
      console.log(`Jogador ${playerId} definiu nome como: ${data.name}`);

      if (Object.keys(gameState.names).length === 2) {
        broadcast({
          type: 'start',
          names: gameState.names,
        });
      }
      return;
    }

        if (data.type === 'play-card') {
      gameState.players[playerId].selectedCard = data.card;
      readyPlayers++;

      if (readyPlayers === 2) {
        const [p1, p2] = [gameState.players[0], gameState.players[1]];

        let p1Attack = p1.selectedCard.attack;
        let p2Attack = p2.selectedCard.attack;

        // Efeitos especiais
        if (p2.selectedCard.name === 'Tempestade') p1Attack = Math.max(0, p1Attack - 3);
        if (p1.selectedCard.name === 'Tempestade') p2Attack = Math.max(0, p2Attack - 3);

        if (p2.selectedCard.name === 'Terremoto') p1Attack = Math.max(0, p1Attack - 4);
        if (p1.selectedCard.name === 'Terremoto') p2Attack = Math.max(0, p2Attack - 4);

        const roundResult = {
          p1Card: { ...p1.selectedCard, attack: p1Attack },
          p2Card: { ...p2.selectedCard, attack: p2Attack },
          winner: null,
        };

        if (p1Attack > p2Attack) {
          roundResult.winner = 0;
          p1.score++;
        } else if (p2Attack > p1Attack) {
          roundResult.winner = 1;
          p2.score++;
        } else {
          roundResult.winner = -1;
        }

         
         p1.deck = p1.deck.filter(c => c.name !== p1.selectedCard.name);
        p2.deck = p2.deck.filter(c => c.name !== p2.selectedCard.name);

        gameState.rounds.push(roundResult);
        readyPlayers = 0;
        p1.selectedCard = null;
        p2.selectedCard = null;

        broadcast({
          type: 'round-result',
          data: roundResult,
          scores: [p1.score, p2.score],
          names: gameState.names
        });

        players.forEach((playerWs, i) => {
          playerWs.send(JSON.stringify({
            type: 'update-deck',
            deck: gameState.players[i].deck
          }));
        });

                if (gameState.rounds.length === 3) {
          let winner = p1.score > p2.score ? 0 : (p2.score > p1.score ? 1 : -1);
          broadcast({
            type: 'game-over',
            winner,
            names: gameState.names
          });
        }
      }
    }

     if (data.type === 'restart') {
      console.log(`Jogador ${playerId} pediu para reiniciar`);
      gameState.players[playerId].wantsRestart = true;

      if (
        gameState.players[0]?.wantsRestart &&
        gameState.players[1]?.wantsRestart
      ) {
        console.log("Reiniciando partida...");
        gameState.sharedCardPool = generateCardPool();

        gameState.players[0] = {
          deck: drawRandomDeck(gameState.sharedCardPool),
          selectedCard: null,
          score: 0,
          wantsRestart: false
        };
        gameState.players[1] = {
          deck: drawRandomDeck(gameState.sharedCardPool),
          selectedCard: null,
          score: 0,
          wantsRestart: false
        };

        gameState.rounds = [];
        readyPlayers = 0;

        players.forEach((p, i) => {
          p.send(JSON.stringify({
            type: 'restart',
            deck: gameState.players[i].deck
          }));
        });
      }
    }
  });


     ws.on('close', () => {
    console.log(`Jogador ${playerId} desconectado.`);
    players = players.filter(p => p !== ws);
    delete gameState.players[playerId];
    delete gameState.names[playerId];
    readyPlayers = 0;
    gameState.rounds = [];
    gameState.sharedCardPool = null;

    players.forEach(p => p.send(JSON.stringify({ type: 'opponent-disconnected' })));
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});




