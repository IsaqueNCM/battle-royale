const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let players = [];
let player = { x: 400, y: 300, angle: 0, isShooting: false, id: null, score: 0, hp: 100, nome:"player" };
let bullets = [];
let pentagons = [];
let gameOver = false;

const speed = 5;
const bulletSpeed = 7;
const bulletCooldown = 500;
let lastShotTime = 0;
const keys = { w: false, a: false, s: false, d: false };

// Solicitar nome do jogador
const playerName = prompt("Digite seu nome:");
socket.emit('join', playerName);
player.nome = playerName


//testar modificação -------------------------------------------------
function drawPlayer(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'blue';
    ctx.fill();
    
    // Barra de vida
    ctx.fillStyle = 'red';
    ctx.fillRect(p.x - 20, p.y - 30, p.hp * 0.4, 5);
    
    // Nome
    ctx.fillStyle = 'black';
    ctx.fillText(p.name, p.x - 20, p.y - 40);
}

function drawPentagon(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.isSmall ? 10 : 20, 0, Math.PI * 2);
    ctx.fillStyle = 'orange';
    ctx.fill();
}

function drawScoreboard() {
    ctx.fillStyle = 'white';
    ctx.fillRect(canvas.width - 150, 10, 140, 200);
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    sortedPlayers.forEach((p, i) => {
        ctx.fillText(`${p.name}: ${p.score}`, canvas.width - 140, 30 + i * 20);
    });
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.fillText('Game Over', canvas.width/2 - 80, canvas.height/2 - 40);
    ctx.font = '20px Arial';
    ctx.fillText(`Pontos: ${player.score}`, canvas.width/2 - 60, canvas.height/2);
    ctx.fillText('Clique para reiniciar', canvas.width/2 - 100, canvas.height/2 + 40);
}

function checkCollision(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (obj1.size || 20) + (obj2.size || 20);
}

function movePlayer() {
    if (gameOver || player.hp <= 0) return;
    
    let newX = player.x;
    let newY = player.y;
    
    if (keys.w) newY -= speed;
    if (keys.s) newY += speed;
    if (keys.a) newX -= speed;
    if (keys.d) newX += speed;

    // Verificar colisão com outros jogadores
    const willCollide = players.some(p => p.id !== player.id && 
        checkCollision({x: newX, y: newY}, p));
    
    if (!willCollide) {
        player.x = Math.max(20, Math.min(canvas.width - 20, newX));
        player.y = Math.max(20, Math.min(canvas.height - 20, newY));
    }
}

function gameLoop() {
    if (player.hp <= 0) gameOver = true;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!gameOver) {
        movePlayer();
        if (player.isShooting) shoot();
        updateBullets();
    }
    
    players.forEach(p => drawPlayer(p));
    pentagons.forEach(p => drawPentagon(p));
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'green';
        ctx.fill();
    });
    
    drawScoreboard();
    if (gameOver) drawGameOver();
    
    if (!gameOver) updatePlayer();
    requestAnimationFrame(gameLoop);
}

socket.on('players', (updatedPlayers) => {
    players = updatedPlayers;
    player = players.find(p => p.id === socket.id) || player;
});

socket.on('pentagons', (updatedPentagons) => {
    pentagons = updatedPentagons;
});

socket.on('shoot', (data) => {
    bullets.push({
        x: data.x,
        y: data.y,
        dx: Math.cos(data.angle) * bulletSpeed,
        dy: Math.sin(data.angle) * bulletSpeed,
        shooterId: data.id
    });
});

canvas.addEventListener('click', () => {
    if (gameOver) {
        gameOver = false;
        player.hp = 100;
        player.score = 0;
        player.x = 400;
        player.y = 300;
        socket.emit('move', { x: player.x, y: player.y, angle: player.angle });
    }
});

// Colisão e dano
setInterval(() => {
    if (gameOver) return;
    
    // Colisão com pentágonos
    pentagons.forEach(p => {
        if (checkCollision(player, p)) {
            player.hp -= 5;
            p.x = Math.random() * 760 + 20;
            p.y = Math.random() * 560 + 20;
        }
    });
    
    // Colisão com balas
    bullets = bullets.filter(b => {
        if (b.shooterId !== player.id && checkCollision(player, b)) {
            player.hp -= 5;
            return false;
        }
        return true;
    });
    
    // Colisão balas com pentágonos
    bullets.forEach((b, bIndex) => {
        pentagons.forEach((p, pIndex) => {
            if (checkCollision(b, p)) {
                p.hp--;
                bullets.splice(bIndex, 1);
                if (p.hp <= 0) {
                    if (!p.isSmall && Math.random() < 0.5) {
                        pentagons.push({
                            ...createPentagon(),
                            size: 10,
                            hp: 5,
                            isSmall: true
                        });
                        pentagons.push({
                            ...createPentagon(),
                            size: 10,
                            hp: 5,
                            isSmall: true
                        });
                    }
                    pentagons.splice(pIndex, 1);
                    if (b.shooterId === player.id) {
                        player.score += p.isSmall ? 15 : 30;
                    }
                }
            }
        });
    });
}, 1000 / 60);

// Adicionar as funções existentes restantes (drawPlayer, shoot, etc.)
// ... ( manter as funções existentes que não foram modificadas)

gameLoop();