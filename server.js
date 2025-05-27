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

const generateDeck = () => [
    { name: 'Fogo', attack: 5 },
    { name: 'Água', attack: 3 },
    { name: 'Terra', attack: 4 },
];

const gameState = {
    players: {},
    rounds: [],
    currentRound: 0,
    names: {},
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
    gameState.players[playerId] = {
        deck: generateDeck(),
        selectedCard: null,
        score: 0,
    };

    ws.send(JSON.stringify({ type: 'welcome', playerId, deck: gameState.players[playerId].deck }));

    if (players.length === 2) {
        broadcast({ type: 'start' });
    }

    ws.on('message', (msg) => {
        const data = JSON.parse(msg);

        // 🔄 Primeira verificação: tipo 'set-name'
        if (data.type === 'set-name') {
            gameState.names[playerId] = data.name;
            ws.send(JSON.stringify({ type: 'name-confirmed', playerId }));

            if (Object.keys(gameState.names).length === 2) {
                broadcast({
                    type: 'start',
                    names: gameState.names,
                });
            }
            return;
        }

        // 🔄 Segunda verificação: tipo 'play-card'
        if (data.type === 'play-card') {
            gameState.players[playerId].selectedCard = data.card;
            readyPlayers++;

            if (readyPlayers === 2) {
                const [p1, p2] = [gameState.players[0], gameState.players[1]];
                const roundResult = {
                    p1Card: p1.selectedCard,
                    p2Card: p2.selectedCard,
                    winner: null,
                };

                if (p1.selectedCard.attack > p2.selectedCard.attack) {
                    roundResult.winner = 0;
                    p1.score++;
                } else if (p2.selectedCard.attack > p1.selectedCard.attack) {
                    roundResult.winner = 1;
                    p2.score++;
                } else {
                    roundResult.winner = -1;
                }

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

                if (gameState.rounds.length === 3) {
                    let winner = p1.score > p2.score ? 0 : (p2.score > p1.score ? 1 : -1);
                    broadcast({
                        type: 'game-over',
                        winner,
                        names: gameState.names
                    });

                    players = [];
                }
            }
        }
    });


    ws.on('close', () => {
        players = players.filter(p => p !== ws);
    });
});

server.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});
