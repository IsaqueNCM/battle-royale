const socket = io('https://battle-royale-backend.onrender.com');
socket.on('connect', () => {
    console.log('Conectado ao servidor com sucesso!');
    player.id = socket.id;
    console.log(`Player connected with ID: ${player.id}`);
});
socket.on('connect_error', (error) => {
    console.error('Erro ao conectar ao servidor:', error);
});

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let players = [];
let bullets = [];
let pentagons = [];
let gameOver = false;
let isRestarting = false;
let gameStarted = false;
let playerName = "Jogador" + Math.floor(Math.random() * 1000);
let inputName = playerName;
let topScores = []; // Armazena os 3 melhores scores

let lastElimination = { killer: '', victim: '', timestamp: 0 };
const eliminationDisplayTime = 5000;

const speed = 5;
const bulletSpeed = 7;
const bulletCooldown = 500;
const collisionCooldown = 1000;
let lastShotTime = 0;
let lastCollisionTime = 0;

const keys = { w: false, a: false, s: false, d: false };

let player = {
    id: null,
    name: playerName,
    x: 400,
    y: 300,
    angle: 0,
    isShooting: false,
    score: 0,
    hp: 100,
    playersEliminated: 0,
    yellowPentagonsEliminated: 0,
    purplePentagonsEliminated: 0
};

function drawPlayer(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'blue';
    ctx.fill();
    ctx.closePath();

    ctx.fillStyle = 'gray';
    ctx.fillRect(p.x - 20, p.y - 35, 40, 5);
    ctx.fillStyle = 'red';
    ctx.fillRect(p.x - 20, p.y - 35, (p.hp / 100) * 40, 5);

    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, p.x, p.y - 45);

    const weaponLength = 30;
    const weaponX = p.x + Math.cos(p.angle) * weaponLength;
    const weaponY = p.y + Math.sin(p.angle) * weaponLength;
    
    ctx.beginPath();
    ctx.rect(weaponX - 5, weaponY - 5, 10, 10);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.closePath();
}

function drawPentagon(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.isSmall ? 10 : 20, 0, Math.PI * 2);
    ctx.fillStyle = p.behavior === 'chase' ? 'purple' : 'orange';
    ctx.fill();
    ctx.closePath();
}

function drawScoreboard() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(canvas.width - 150, 10, 140, 200);
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    const sortedPlayers = [...players]
        .filter(p => p && p.name && typeof p.score === 'number')
        .sort((a, b) => b.score - a.score);
    
    sortedPlayers.forEach((p, i) => {
        ctx.fillText(`${p.name}: ${p.score}`, canvas.width - 140, 30 + i * 20);
    });
}

function drawTopScores() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(canvas.width / 2 - 100, 10, 200, 80);
    ctx.fillStyle = 'black';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Melhores Pontuações', canvas.width / 2, 30);
    ctx.font = '14px Arial';
    
    topScores.forEach((entry, i) => {
        ctx.fillText(`${i + 1}. ${entry.name}: ${entry.score}`, canvas.width / 2, 50 + i * 20);
    });
}

function drawLastElimination() {
    const currentTime = Date.now();
    if (lastElimination.timestamp > 0 && (currentTime - lastElimination.timestamp) < eliminationDisplayTime) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(10, 10, 200, 50);
        ctx.fillStyle = 'black';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Última Eliminação:', 20, 30);
        ctx.fillText(`${lastElimination.killer} x ${lastElimination.victim}`, 20, 50);
    }
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(128, 128, 128, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'red';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 10;
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 150);
    ctx.shadowBlur = 0;

    ctx.font = '16px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('Um jogo produzido por Isaque do Nascimento', canvas.width / 2, canvas.height / 2 - 100);

    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    const startY = canvas.height / 2 - 80;
    const stats = [
        `Players eliminado: ${player.playersEliminated}`,
        `Inimigos roxo: ${player.purplePentagonsEliminated}`,
        `Inimigo laranja: ${player.yellowPentagonsEliminated}`,
        `Pontuação: ${player.score}`
    ];

    stats.forEach((text, index) => {
        const y = startY + index * 30;
        ctx.fillText(text, canvas.width / 2, y);
    });

    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'blue';
    ctx.fillRect(canvas.width / 2 - 120, canvas.height / 2 + 80, 240, 40);
    ctx.strokeRect(canvas.width / 2 - 120, canvas.height / 2 + 80, 240, 40);
    ctx.fillStyle = 'black';
    ctx.font = '18px Arial';
    ctx.fillText(newName, canvas.width / 2, canvas.height / 2 + 105);

    ctx.fillStyle = 'rgba(0, 200, 0, 0.9)';
    ctx.strokeStyle = 'darkgreen';
    ctx.fillRect(canvas.width / 2 - 120, canvas.height / 2 + 130, 240, 40);
    ctx.strokeRect(canvas.width / 2 - 120, canvas.height / 2 + 130, 240, 40);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('Jogar', canvas.width / 2, canvas.height / 2 + 155);

    const socialLinks = [
        { name: 'YOUTUBE', url: 'https://www.youtube.com/@GAMEPLAYS-h7t' },
        { name: 'TWITCH', url: 'https://www.twitch.tv/isaque15e' },
        { name: 'TIKTOK', url: 'https://www.tiktok.com/@gameplays_sv' },
        { name: 'GITHUB', url: 'https://github.com/IsaqueNCM' },
        { name: 'INSTAGRAM', url: 'https://www.instagram.com/izy_nobre/' }
    ];

    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('REDES SOCIAIS', canvas.width / 2, canvas.height - 65);

    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = 'black';
    const startX = canvas.width / 2 - 300;
    const y = canvas.height - 30;
    
    socialLinks.forEach((link, index) => {
        const x = startX + index * 150;
        ctx.fillText(link.name, x, y);
    });
}

function drawStartScreen() {
    ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'limegreen';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 10;
    ctx.fillText('BATALHA REAL', canvas.width / 2, canvas.height / 2 - 150);
    ctx.shadowBlur = 0;

    ctx.font = '16px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('Um jogo produzido por Isaque do Nascimento', canvas.width / 2, canvas.height / 2 - 100);

    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'blue';
    ctx.fillRect(canvas.width / 2 - 120, canvas.height / 2 - 20, 240, 40);
    ctx.strokeRect(canvas.width / 2 - 120, canvas.height / 2 - 20, 240, 40);
    ctx.fillStyle = 'black';
    ctx.font = '18px Arial';
    ctx.fillText(inputName, canvas.width / 2, canvas.height / 2 + 5);

    ctx.fillStyle = 'rgba(0, 200, 0, 0.9)';
    ctx.strokeStyle = 'darkgreen';
    ctx.fillRect(canvas.width / 2 - 120, canvas.height / 2 + 50, 240, 40);
    ctx.strokeRect(canvas.width / 2 - 120, canvas.height / 2 + 50, 240, 40);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('Jogar', canvas.width / 2, canvas.height / 2 + 75);

    const socialLinks = [
        { name: 'YOUTUBE', url: 'https://www.youtube.com/@GAMEPLAYS-h7t' },
        { name: 'TWITCH', url: 'https://www.twitch.tv/isaque15e' },
        { name: 'TIKTOK', url: 'https://www.tiktok.com/@gameplays_sv' },
        { name: 'GITHUB', url: 'https://github.com/IsaqueNCM' },
        { name: 'INSTAGRAM', url: 'https://www.instagram.com/izy_nobre/' }
    ];
    
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('REDES SOCIAIS', canvas.width / 2, canvas.height - 65);

    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = 'black';
    const startX = canvas.width / 2 - 300;
    const y = canvas.height - 30;
    
    socialLinks.forEach((link, index) => {
        const x = startX + index * 150;
        ctx.fillText(link.name, x, y);
    });
}

function drawBullets() {
    bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'green';
        ctx.fill();
        ctx.closePath();
    });
}

function checkCollision(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radius1 = obj1.isSmall ? 10 : (obj1.shooterId ? 5 : 20);
    const radius2 = obj2.isSmall ? 10 : (obj2.shooterId ? 5 : 20);
    return distance < radius1 + radius2;
}

function movePlayer() {
    if (gameOver || player.hp <= 0) return;

    let newX = player.x;
    let newY = player.y;

    if (keys.w) newY -= speed;
    if (keys.s) newY += speed;
    if (keys.a) newX -= speed;
    if (keys.d) newX += speed;

    player.x = Math.max(20, Math.min(canvas.width - 20, newX));
    player.y = Math.max(20, Math.min(canvas.height - 20, newY));
}

function checkPlayerPentagonCollisions() {
    const currentTime = Date.now();
    if (currentTime - lastCollisionTime < collisionCooldown || player.hp <= 0 || !player.id) return;

    pentagons.forEach(pentagon => {
        if (checkCollision(player, pentagon)) {
            const dx = player.x - pentagon.x;
            const dy = player.y - pentagon.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = (pentagon.isSmall ? 10 : 20) + 20;

            if (distance > 0) {
                const overlap = minDistance - distance;
                const repulsionX = (dx / distance) * (overlap / 2 + 5);
                const repulsionY = (dy / distance) * (overlap / 2 + 5);

                player.x += repulsionX;
                player.y += repulsionY;
                player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
                player.y = Math.max(20, Math.min(canvas.height - 20, player.y));

                pentagon.x -= repulsionX;
                pentagon.y -= repulsionY;
                pentagon.x = Math.max(20, Math.min(canvas.width - 20, pentagon.x));
                pentagon.y = Math.max(20, Math.min(canvas.height - 20, pentagon.y));

                socket.emit('updatePentagonPosition', {
                    pentagonId: pentagon.id,
                    x: pentagon.x,
                    y: pentagon.y
                });

                socket.emit('playerDamaged', {
                    playerId: player.id,
                    damage: 10
                });

                lastCollisionTime = currentTime;
            }
        }
    });
}

function shoot() {
    const currentTime = Date.now();
    if (currentTime - lastShotTime > bulletCooldown && player.hp > 0) {
        lastShotTime = currentTime;

        const bullet = {
            x: player.x,
            y: player.y,
            angle: player.angle,
            dx: Math.cos(player.angle) * bulletSpeed,
            dy: Math.sin(player.angle) * bulletSpeed,
            shooterId: player.id
        };

        bullets.push(bullet);
        socket.emit('shoot', { x: bullet.x, y: bullet.y, angle: bullet.angle });
    }
}

function updateBullets() {
    bullets = bullets.filter(bullet => {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;

        for (let i = 0; i < pentagons.length; i++) {
            if (checkCollision(bullet, pentagons[i])) {
                socket.emit('bulletHitPentagon', {
                    pentagonId: pentagons[i].id,
                    shooterId: bullet.shooterId
                });
                if (pentagons[i].hp <= 1) {
                    if (pentagons[i].behavior === 'chase') {
                        player.purplePentagonsEliminated++;
                    } else if (pentagons[i].behavior === 'evade') {
                        player.yellowPentagonsEliminated++;
                    }
                }
                return false;
            }
        }

        for (let i = 0; i < players.length; i++) {
            if (players[i].id !== bullet.shooterId && checkCollision(bullet, players[i])) {
                console.log(`Bullet from ${bullet.shooterId} hit player ${players[i].id}`);
                socket.emit('bulletHitPlayer', {
                    targetPlayerId: players[i].id,
                    shooterId: bullet.shooterId,
                    damage: 20
                });
                return false;
            }
        }

        return bullet.x >= 0 && bullet.x <= canvas.width && bullet.y >= 0 && bullet.y <= canvas.height;
    });
}

function drawPlayers() {
    players.forEach(p => drawPlayer(p));
}

function updatePlayer() {
    if (player.hp > 0 && player.id) {
        socket.emit('move', { x: player.x, y: player.y, angle: player.angle });
    }
}

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (!gameStarted) {
        if (mouseX >= canvas.width / 2 - 120 && mouseX <= canvas.width / 2 + 120 &&
            mouseY >= canvas.height / 2 + 50 && mouseY <= canvas.height / 2 + 90) {
            document.body.style.cursor = 'pointer';
        } else {
            document.body.style.cursor = 'default';
        }
    } else if (gameOver) {
        if (mouseX >= canvas.width / 2 - 120 && mouseX <= canvas.width / 2 + 120 &&
            mouseY >= canvas.height / 2 + 130 && mouseY <= canvas.height / 2 + 170) {
            document.body.style.cursor = 'pointer';
        } else {
            document.body.style.cursor = 'default';
        }
    } else {
        player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    }
});

canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0 && !gameOver && player.hp > 0) {
        player.isShooting = true;
    }
});

canvas.addEventListener('mouseup', () => {
    player.isShooting = false;
});

let newName = playerName;

canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    if (!gameStarted) {
        if (clickX >= canvas.width / 2 - 120 && clickX <= canvas.width / 2 + 120 &&
            clickY >= canvas.height / 2 + 50 && clickY <= canvas.height / 2 + 90) {
            gameStarted = true;
            playerName = inputName;
            player.name = playerName;
            console.log('Emitindo join para:', playerName);
            socket.emit('join', playerName);
            console.log("Game started with name:", playerName);
        } else {
            const socialLinks = [
                { name: 'YOUTUBE', url: 'https://www.youtube.com/@GAMEPLAYS-h7t' },
                { name: 'TWITCH', url: 'https://www.twitch.tv/isaque15e' },
                { name: 'TIKTOK', url: 'https://www.tiktok.com/@gameplays_sv' },
                { name: 'GITHUB', url: 'https://github.com/IsaqueNCM' },
                { name: 'INSTAGRAM', url: 'https://www.instagram.com/izy_nobre/' }
            ];
            const startX = canvas.width / 2 - 300;
            const y = canvas.height - 30;
            ctx.font = 'bold 20px Arial';
            socialLinks.forEach((link, index) => {
                const textWidth = ctx.measureText(link.name).width;
                const x = startX + index * 150;
                if (clickX >= x - 10 && clickX <= x + textWidth + 10 &&
                    clickY >= y - 25 && clickY <= y + 5) {
                    window.open(link.url, '_blank');
                }
            });
        }
    } else if (gameOver) {
        if (clickX >= canvas.width / 2 - 120 && clickX <= canvas.width / 2 + 120 &&
            clickY >= canvas.height / 2 + 130 && clickY <= canvas.height / 2 + 170) {
            gameOver = false;
            isRestarting = true;
            player.hp = 100;
            player.score = 0;
            player.playersEliminated = 0;
            player.yellowPentagonsEliminated = 0;
            player.purplePentagonsEliminated = 0;
            player.x = 400;
            player.y = 300;
            playerName = newName || playerName;
            player.name = playerName;
            bullets = [];
            socket.emit('leave');
            socket.emit('join', playerName);
            console.log("Game restarted with name:", playerName);
            keys.w = false;
            keys.a = false;
            keys.s = false;
            keys.d = false;
        } else {
            const socialLinks = [
                { name: 'YOUTUBE', url: 'https://www.youtube.com/@GAMEPLAYS-h7t' },
                { name: 'TWITCH', url: 'https://www.twitch.tv/isaque15e' },
                { name: 'TIKTOK', url: 'https://www.tiktok.com/@gameplays_sv' },
                { name: 'GITHUB', url: 'https://github.com/IsaqueNCM' },
                { name: 'INSTAGRAM', url: 'https://www.instagram.com/izy_nobre/' }
            ];
            const startX = canvas.width / 2 - 300;
            const y = canvas.height - 30;
            ctx.font = 'bold 20px Arial';
            socialLinks.forEach((link, index) => {
                const textWidth = ctx.measureText(link.name).width;
                const x = startX + index * 150;
                if (clickX >= x - 10 && clickX <= x + textWidth + 10 &&
                    clickY >= y - 25 && clickY <= y + 5) {
                    window.open(link.url, '_blank');
                }
            });
        }
    }
});

document.addEventListener('keydown', (event) => {
    if (!gameStarted) {
        if (event.key === 'Backspace' && inputName.length > 0) {
            inputName = inputName.slice(0, -1);
        } else if (event.key.length === 1 && inputName.length < 15) {
            inputName += event.key;
        }
    } else if (gameOver) {
        if (event.key === 'Backspace' && newName.length > 0) {
            newName = newName.slice(0, -1);
        } else if (event.key.length === 1 && newName.length < 15) {
            newName += event.key;
        }
    } else if (event.key in keys) {
        keys[event.key] = true;
    }
});

document.addEventListener('keyup', (event) => {
    if (event.key in keys) keys[event.key] = false;
});

function gameLoop() {
    console.log('Game loop running - gameStarted:', gameStarted, 'gameOver:', gameOver);
    console.log('Players:', players);
    console.log('Pentagons:', pentagons);
    
    if (player.hp <= 0 && !gameOver && gameStarted) {
        gameOver = true;
        console.log("Game Over triggered: HP <= 0");
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameStarted) {
        drawStartScreen();
    } else {
        drawPlayers();
        pentagons.forEach(p => drawPentagon(p));
        drawBullets();
        drawScoreboard();
        drawTopScores(); // Adiciona o ranking na tela
        if (!gameOver) {
            movePlayer();
            checkPlayerPentagonCollisions();
            if (player.isShooting) shoot();
            updateBullets();
            updatePlayer();
            drawLastElimination();
        }
        if (gameOver) drawGameOver();
    }

    requestAnimationFrame(gameLoop);
}

socket.on('players', (updatedPlayers) => {
    console.log('Players recebidos:', updatedPlayers);
    players = updatedPlayers || [];
    const serverPlayer = players.find(p => p.id === player.id);
    if (serverPlayer) {
        const previousHp = player.hp;
        player.hp = serverPlayer.hp;
        player.score = serverPlayer.score;
        console.log(`Player ${player.name} HP updated to: ${player.hp}`);
        if (previousHp > 0 && player.hp <= 0 && !gameOver && !isRestarting) {
            gameOver = true;
            console.log("Game Over triggered from server HP update");
        }
        if (player.score > 0 && (player.score % 100 === 0 || (player.score - 100 * player.playersEliminated) % 100 === 0)) {
            const newEliminations = Math.floor(player.score / 100) - player.playersEliminated;
            if (newEliminations > 0) {
                player.playersEliminated += newEliminations;
                console.log(`Player ${player.name} eliminated ${newEliminations} player(s)`);
            }
        }
    } else if (!gameOver && !isRestarting && gameStarted) {
        gameOver = true;
        player.hp = 0;
        console.log("Game Over triggered: Player not found in server list (destroyed)");
    }
    if (isRestarting && serverPlayer && serverPlayer.hp > 0) {
        isRestarting = false;
        console.log("Restart completed, resuming normal play");
    }
});

socket.on('pentagons', (updatedPentagons) => {
    console.log('Pentagons recebidos:', updatedPentagons);
    pentagons = updatedPentagons || [];
});

socket.on('shoot', (data) => {
    console.log('Shoot recebido:', data);
    if (data.id !== player.id) {
        bullets.push({
            x: data.x,
            y: data.y,
            dx: Math.cos(data.angle) * bulletSpeed,
            dy: Math.sin(data.angle) * bulletSpeed,
            shooterId: data.id
        });
    }
});

socket.on('playerEliminated', (data) => {
    if (gameStarted && !gameOver) {
        lastElimination = {
            killer: data.killerName,
            victim: data.victimName,
            timestamp: Date.now()
        };
        console.log(`Elimination received: ${data.killerName} x ${data.victimName}`);
    }
});

socket.on('topScores', (updatedTopScores) => {
    console.log('Top scores recebidos:', updatedTopScores);
    topScores = updatedTopScores || [];
});

gameLoop();