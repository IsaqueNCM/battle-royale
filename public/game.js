document.addEventListener('DOMContentLoaded', () => {
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
    if (!canvas) {
        console.error('Canvas não encontrado! Verifique o HTML (id="gameCanvas")');
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Não foi possível obter o contexto 2d do canvas');
        return;
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const skinImages = new Map();
    const activePlayerSkins = new Map();

    function loadSkin(url) {
        if (skinImages.has(url)) return;
        console.log(`Tentando carregar skin de: ${url}`);
        const img = new Image();
        img.src = url;
        img.onload = () => {
            console.log(`Skin ${url} carregada com sucesso`);
            skinImages.set(url, img);
        };
        img.onerror = (e) => {
            console.error(`Erro ao carregar skin ${url}:`, e);
            skinImages.set(url, null);
        };
    }

    socket.on('playerSkins', (skins) => {
        console.log('Skins ativas recebidas:', skins);
        activePlayerSkins.clear();
        Object.entries(skins).forEach(([playerId, skinUrl]) => {
            activePlayerSkins.set(playerId, skinUrl);
            if (skinUrl) loadSkin(skinUrl);
        });
    });

    let players = [];
    let pentagons = [];
    let items = [];
    let bullets = [];
    let gameOver = false;
    let isRestarting = false;
    let gameStarted = false;
    let playerName = "Jogador" + Math.floor(Math.random() * 1000);
    let inputName = playerName;
    let topScores = [];

    let lastElimination = { killer: '', victim: '', timestamp: 0 };
    const eliminationDisplayTime = 5000;

    const bulletCooldown = 500;
    const collisionCooldown = 1000;
    let lastShotTime = 0;
    let lastCollisionTime = 0;
    let lastMoveUpdate = 0;
    const moveUpdateInterval = 50;

    const keys = { w: false, a: false, s: false, d: false };

    const ACCELERATION = 300;
    const MAX_SPEED = 150;
    const FRICTION = 150;

    let player = {
        id: null,
        name: playerName,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        velocityX: 0,
        velocityY: 0,
        angle: 0,
        isShooting: false,
        score: 0,
        hp: 200,
        playersEliminated: 0,
        yellowPentagonsEliminated: 0,
        purplePentagonsEliminated: 0
    };

    function resetGameState() {
        gameOver = false;
        isRestarting = false;
        player.hp = 200;
        player.score = 0;
        player.playersEliminated = 0;
        player.yellowPentagonsEliminated = 0;
        player.purplePentagonsEliminated = 0;
        player.x = canvas.width / 2;
        player.y = canvas.height / 2;
        player.velocityX = 0;
        player.velocityY = 0;
        keys.w = false;
        keys.a = false;
        keys.s = false;
        keys.d = false;
        bullets = [];
        console.log('Estado do jogo resetado:', { gameStarted, gameOver, playerHp: player.hp });
    }

    function drawPlayer(p) {
        const radius = 20;
        const diameter = radius * 2;

        const skinUrl = activePlayerSkins.get(p.id);
        console.log(`Desenhando jogador ${p.name} (ID: ${p.id}) com skin: ${skinUrl || 'Nenhuma'}`);
        if (skinUrl && skinImages.has(skinUrl) && skinImages.get(skinUrl) && skinImages.get(skinUrl).complete && skinImages.get(skinUrl).naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(skinImages.get(skinUrl), p.x - radius, p.y - radius, diameter, diameter);
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = p.id === player.id ? 'blue' : 'red';
            ctx.fill();
            ctx.closePath();
        }

        ctx.fillStyle = 'gray';
        ctx.fillRect(p.x - 20, p.y - 35, 40, 5);
        ctx.fillStyle = 'red';
        ctx.fillRect(p.x - 20, p.y - 35, (p.hp / 200) * 40, 5);

        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x, p.y - 45);

        const weaponLength = 30;
        const weaponX = p.x + Math.cos(p.angle) * weaponLength;
        const weaponY = p.y + Math.sin(p.angle) * weaponLength;
        
        ctx.beginPath();
        ctx.arc(weaponX, weaponY, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = p.id === player.id ? 'red' : 'black';
        ctx.fill();
        ctx.closePath();
    }

    function drawPentagon(p) {
        const radius = p.isSmall ? 10 : 20;
        const sides = 5;
        const angleStep = (2 * Math.PI) / sides;

        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = p.x + radius * Math.cos(angle);
            const y = p.y + radius * Math.sin(angle);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fillStyle = p.behavior === 'chase' ? 'purple' : 'orange';
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function drawItem(item) {
        const radius = 10;
        ctx.beginPath();
        ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();
        ctx.closePath();

        ctx.fillStyle = 'white';
        ctx.font = '900 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', item.x, item.y);
    }

    function drawBullets() {
        bullets.forEach(bullet => {
            if (bullet.active && 
                bullet.x >= 0 && bullet.x <= canvas.width && 
                bullet.y >= 0 && bullet.y <= canvas.height) {
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = 'green';
                ctx.fill();
                ctx.closePath();
            }
        });
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

    function checkCollision(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radius1 = obj1.isSmall ? 10 : (obj1.shooterId ? 5 : (obj1.type === 'heal' ? 5 : 20));
        const radius2 = obj2.isSmall ? 10 : (obj2.shooterId ? 5 : (obj2.type === 'heal' ? 5 : 20));
        return distance < radius1 + radius2;
    }

    function movePlayer(deltaTime) {
        if (gameOver || player.hp <= 0) return;

        let accelX = 0;
        let accelY = 0;

        if (keys.w) accelY -= ACCELERATION;
        if (keys.s) accelY += ACCELERATION;
        if (keys.a) accelX -= ACCELERATION;
        if (keys.d) accelX += ACCELERATION;

        player.velocityX += accelX * deltaTime;
        player.velocityY += accelY * deltaTime;

        if (!keys.a && !keys.d) {
            const frictionX = player.velocityX > 0 ? -FRICTION : FRICTION;
            player.velocityX += frictionX * deltaTime;
            if (Math.abs(player.velocityX) < 1) player.velocityX = 0;
        }
        if (!keys.w && !keys.s) {
            const frictionY = player.velocityY > 0 ? -FRICTION : FRICTION;
            player.velocityY += frictionY * deltaTime;
            if (Math.abs(player.velocityY) < 1) player.velocityY = 0;
        }

        const speed = Math.sqrt(player.velocityX * player.velocityX + player.velocityY * player.velocityY);
        if (speed > MAX_SPEED) {
            const factor = MAX_SPEED / speed;
            player.velocityX *= factor;
            player.velocityY *= factor;
        }

        player.x += player.velocityX * deltaTime;
        player.y += player.velocityY * deltaTime;

        player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
        player.y = Math.max(20, Math.min(canvas.height - 20, player.y));
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
                        damage: 5
                    });

                    lastCollisionTime = currentTime;
                }
            }
        });
    }

    function checkPlayerItemCollisions() {
        items.forEach(item => {
            const dx = player.x - item.x;
            const dy = player.y - item.y;
            const distance = Math.hypot(dx, dy);
            const attractionRadius = 30;
            const itemSpeed = 5;

            if (distance < attractionRadius) {
                const angle = Math.atan2(dy, dx);
                item.x += Math.cos(angle) * itemSpeed;
                item.y += Math.sin(angle) * itemSpeed;

                if (checkCollision(player, item)) {
                    socket.emit('itemCollected', {
                        itemId: item.id,
                        playerId: player.id
                    });
                }
            }
        });
    }

    function shoot() {
        const currentTime = Date.now();
        if (currentTime - lastShotTime > bulletCooldown && player.hp > 0) {
            lastShotTime = currentTime;

            const weaponLength = 30;
            const weaponX = player.x + Math.cos(player.angle) * weaponLength;
            const weaponY = player.y + Math.sin(player.angle) * weaponLength;

            socket.emit('shoot', {
                x: weaponX,
                y: weaponY,
                angle: player.angle,
                shooterId: player.id
            });
        }
    }

    function drawPlayers() {
        players.forEach(p => drawPlayer(p));
    }

    function updatePlayer() {
        const now = Date.now();
        if (player.hp > 0 && player.id && now - lastMoveUpdate >= moveUpdateInterval) {
            socket.emit('move', { x: player.x, y: player.y, angle: player.angle });
            lastMoveUpdate = now;
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
            console.log('Mouse down at:', Date.now());
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
                console.log('Iniciando jogo...');
                resetGameState(); // Resetar estado antes de começar
                gameStarted = true;
                playerName = inputName;
                player.name = playerName;
                loadSkin(playerName);
                socket.emit('join', { name: playerName, width: canvas.width, height: canvas.height });
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
                console.log('Reiniciando jogo...');
                resetGameState();
                gameStarted = true; // Garantir que o jogo esteja ativo após reiniciar
                playerName = newName || playerName;
                player.name = playerName;
                loadSkin(playerName);
                socket.emit('leave');
                socket.emit('join', { name: playerName, width: canvas.width, height: canvas.height });
                console.log("Game restarted with name:", playerName);
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

    let lastTime = performance.now();

    function gameLoop(timestamp) {
        try {
            const deltaTime = Math.min((timestamp - lastTime) / 1000, 0.1);
            lastTime = timestamp;

            console.log('Game loop - gameStarted:', gameStarted, 'gameOver:', gameOver, 'player.hp:', player.hp);
            console.log('Players:', players.length > 0 ? players[0].name : 'Nenhum jogador');
            console.log('Pentagons:', pentagons.length);
            console.log('Items:', items.length);
            console.log('Bullets:', bullets.length);
            
            if (player.hp <= 0 && !gameOver && gameStarted) {
                gameOver = true;
                console.log("Game Over triggered: HP <= 0");
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (!gameStarted) {
                drawStartScreen();
            } else {
                drawBullets();
                items.forEach(item => drawItem(item));
                pentagons.forEach(p => drawPentagon(p));
                drawPlayers();
                drawScoreboard();
                drawTopScores();
                if (!gameOver) {
                    movePlayer(deltaTime);
                    checkPlayerPentagonCollisions();
                    checkPlayerItemCollisions();
                    if (player.isShooting) shoot();
                    updatePlayer();
                    drawLastElimination();
                }
                if (gameOver) drawGameOver();
            }
        } catch (error) {
            console.error('Erro no gameLoop:', error.stack);
        }

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);

    socket.on('players', (updatedPlayers) => {
        console.log('Players recebidos:', updatedPlayers);
        players = updatedPlayers || [];
        const serverPlayer = players.find(p => p.id === player.id);
        if (serverPlayer) {
            const dx = serverPlayer.x - player.x;
            const dy = serverPlayer.y - player.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 50) {
                player.x += dx * 0.1;
                player.y += dy * 0.1;
                player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
                player.y = Math.max(20, Math.min(canvas.height - 20, player.y));
            }
            const previousHp = player.hp;
            player.hp = serverPlayer.hp;
            player.score = serverPlayer.score;
            console.log(`Player ${player.name} HP updated to: ${player.hp}`);
            if (previousHp > 0 && player.hp <= 0 && !gameOver && !isRestarting && gameStarted) {
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
            const skinFile = `${playerName.toLowerCase()}.png`;
            fetch(`/skins/${skinFile}`)
                .then(response => {
                    if (response.ok) {
                        loadSkin(`/skins/${skinFile}`);
                    } else {
                        console.warn(`Nenhuma skin encontrada para ${playerName}`);
                    }
                })
                .catch(err => console.error(`Erro ao verificar skin para ${playerName}:`, err));
            if (isRestarting && serverPlayer.hp > 0) {
                isRestarting = false;
                console.log("Restart completed, resuming normal play");
            }
        } else if (!gameOver && !isRestarting && gameStarted && players.length > 0) {
            gameOver = true;
            player.hp = 0;
            console.log("Game Over triggered: Player not found in server list (destroyed)");
        }
    });

    socket.on('pentagons', (updatedPentagons) => {
        console.log('Pentagons recebidos:', updatedPentagons);
        pentagons = updatedPentagons || [];
    });

    socket.on('items', (updatedItems) => {
        console.log('Items recebidos:', updatedItems);
        items = updatedItems || [];
    });

    socket.on('shoot', (bullet) => {
        console.log('Shoot received:', bullet);
        bullets.push(bullet);
    });

    socket.on('bullets', (updatedBullets) => {
        console.log('Bullets recebidos:', updatedBullets);
        bullets = updatedBullets || [];
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
});