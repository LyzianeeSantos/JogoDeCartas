const socket = new WebSocket(`ws://${location.host}`);
let playerId = null;
let deck = [];
let names = {};

const nameInputContainer = document.getElementById('nameInputContainer');
const statusDiv = document.getElementById('status');
const scoreboardDiv = document.getElementById('scoreboard');
const cardsDiv = document.getElementById('cards');
const resultDiv = document.getElementById('result');

function sendName() {
  const name = document.getElementById('playerName').value.trim();
  if (name) {
    socket.send(JSON.stringify({ type: 'set-name', name }));
    nameInputContainer.style.display = 'none';
    statusDiv.style.display = 'block';
    statusDiv.innerText = 'Aguardando outro jogador...';
  }
}

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'name-confirmed') {
    playerId = msg.playerId;
  }

  if (msg.type === 'start') {
    names = msg.names;
    statusDiv.innerText = 'Jogo começou! Selecione uma carta.';
    updateScoreboard(0, 0);
  }

  if (msg.type === 'round-result') {
    const { p1Card, p2Card, winner } = msg.data;
    const scores = msg.scores;
    names = msg.names;

    const myCard = playerId === 0 ? p1Card : p2Card;
    const opponentCard = playerId === 0 ? p2Card : p1Card;

    resultDiv.innerHTML = `
      Rodada: Você jogou <b>${myCard.name}</b> (${myCard.attack})<br/>
      Oponente jogou <b>${opponentCard.name}</b> (${opponentCard.attack})<br/>
      ${winner === -1 ? "Empate!" : (winner === playerId ? "Você venceu a rodada!" : "Você perdeu a rodada.")}
    `;

    updateScoreboard(scores[0], scores[1]);

    deck = deck.filter(c => c.name !== myCard.name);
    renderDeck();
  }

  if (msg.type === 'game-over') {
    const { winner, names } = msg;
    let txt = winner === -1 ? 'Empate!' : (winner === playerId ? 'Você venceu o jogo!' : 'Você perdeu o jogo.');
    statusDiv.innerText = `${txt}`;
    cardsDiv.innerHTML = '';
  }

  if (msg.type === 'welcome') {
    deck = msg.deck;
    renderDeck();
  }

  if (msg.type === 'error') {
    alert(msg.message);
  }
};

function renderDeck() {
  cardsDiv.innerHTML = '';
  deck.forEach(card => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<b>${card.name}</b><br/>Ataque: ${card.attack}`;
    div.onclick = () => {
      socket.send(JSON.stringify({ type: 'play-card', card }));
      cardsDiv.querySelectorAll('.card').forEach(c => c.classList.add('disabled'));
      statusDiv.innerText = 'Esperando oponente...';
    };
    cardsDiv.appendChild(div);
  });
}

function updateScoreboard(score1, score2) {
  scoreboardDiv.style.display = 'block';
  scoreboardDiv.innerHTML = `
    <h3>Placar</h3>
    <p>${names[0] || 'Jogador 1'}: ${score1} x ${score2} :${names[1] || 'Jogador 2'}</p>
  `;
}
