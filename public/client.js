const socket = new WebSocket('wss://192.168.171.9:3000');
let playerId = null;
let deck = [];
let names = {};

const nameInputContainer = document.getElementById('nameInputContainer');
const statusDiv = document.getElementById('status');
const scoreboardDiv = document.getElementById('scoreboard');
const cardsDiv = document.getElementById('cards');
const resultDiv = document.getElementById('result');
const restartBtn = document.getElementById('restartBtn');
const randomInfoDiv = document.getElementById('randomInfo');

const specialCardsInfo = {
  'Tempestade': 'Remove: 3 dano',
  'Terremoto': 'Remove: 4 dano'
};


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

    randomInfoDiv.style.display = 'block';
    randomInfoDiv.innerText = 'Os valores das cartas são aleatórios para ambos os jogadores a cada partida.';
  }

  if (msg.type === 'round-result') {
  const { p1Card, p2Card, winner } = msg.data;
  const scores = msg.scores;
  names = msg.names;

  const myCard = playerId === 0 ? p1Card : p2Card;
  const opponentCard = playerId === 0 ? p2Card : p1Card;

  let specialMsg = '';
  const specialCards = ['Tempestade', 'Terremoto'];
  if (specialCards.includes(p1Card.name) || specialCards.includes(p2Card.name)) {
    specialMsg = '<br><i>(Cartas especiais reduziram o ataque do oponente!)</i>';
  }

  resultDiv.innerHTML = `
    Rodada: Você jogou <b>${myCard.name}</b> (${myCard.attack})<br/>
    Oponente jogou <b>${opponentCard.name}</b> (${opponentCard.attack})<br/>
    ${winner === -1 ? "Empate!" : (winner === playerId ? "Você venceu a rodada!" : "Você perdeu a rodada.")} 
    ${specialMsg}<br>
    Jogue novamente
  `;

  updateScoreboard(scores[0], scores[1]);
}

  if (msg.type === 'update-deck') {
    deck = msg.deck;
    renderDeck();
  }

  if (msg.type === 'game-over') {
    const { winner, names } = msg;
    let txt = winner === -1 ? 'Empate!' : (winner === playerId ? 'Você venceu o jogo!' : 'Você perdeu o jogo.');
    statusDiv.innerText = `${txt}`;
    cardsDiv.innerHTML = '';
    restartBtn.style.display = 'inline-block';
    randomInfoDiv.style.display = 'none';
  }

  if (msg.type === 'restart') {
    deck = msg.deck;
    renderDeck();
    resultDiv.innerHTML = '';
    updateScoreboard(0, 0);
    statusDiv.innerText = 'Nova partida iniciada! Selecione uma carta.';
    restartBtn.style.display = 'none';
    randomInfoDiv.style.display = 'block';
    randomInfoDiv.innerText = 'Os valores das cartas são aleatórios para ambos os jogadores a cada partida.';
  }

  if (msg.type === 'error') {
    alert(msg.message);
  }

  if (msg.type === 'opponent-disconnected') {
    statusDiv.innerText = 'Seu oponente desconectou. Aguardando novo jogador...';
    cardsDiv.innerHTML = '';
    scoreboardDiv.style.display = 'none';
    restartBtn.style.display = 'none';
    randomInfoDiv.style.display = 'none';
  }

 if (msg.type === 'welcome') {
  playerId = msg.playerId;  
  deck = msg.deck;
  renderDeck();
}
};

function renderDeck() {
  cardsDiv.innerHTML = '';
  deck.forEach(card => {
    const isSpecial = specialCardsInfo.hasOwnProperty(card.name);
    const specialText = isSpecial ? `<br><small style="color:#f7c843;">${specialCardsInfo[card.name]}</small>` : '';

    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <img src="${card.image}" alt="${card.name}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 8px;" />
      <b>${card.name} ${isSpecial ? '(especial)' : ''}</b><br/>
      Ataque: ${card.attack}
      ${specialText}
    `;
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

function restartGame() {
  socket.send(JSON.stringify({ type: 'restart' }));
  restartBtn.style.display = 'none';
  resultDiv.innerHTML = '';
  statusDiv.innerText = 'Aguardando outro jogador para reiniciar...';
}
