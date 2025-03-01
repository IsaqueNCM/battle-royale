const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let players = [];
let pentagons = [];

function createPentagon() {
    const possibleSpeeds = [0.5, 1, 1.5, 2];
    const speed = possibleSpeeds[Math.floor(Math.random() * possibleSpeeds.length)];
    const behavior = Math.random() < 0.5 ? 'chase' : 'evade';
    return {
        id: Math.random().toString(36).substr(2, 9),
        x: Math.random() * 760 + 20,
        y: Math.random() * 560 + 20,
        size: 20,
        speed: speed,
        angle: Math.random() * Math.PI * 2,
        hp: 10,
        isSmall: false,
        lastDirectionChange: Date.now(),
        behavior: behavior
    };
}

for (let i = 0; i < 5; i++) {
    pentagons.push(createPentagon());
}

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Novo jogador conectado:', socket.id);

    socket.on('join', (playerName) => {
        players = players.filter(p => p.id !== socket.id);
        const newPlayer = {
            id: socket.id,
            name: playerName,
            x: 300,
            y: 300,
            angle: 0,
            score: 0,
            hp: 100
        };
        players.push(newPlayer);
        io.emit('players', players);
        io.emit('pentagons', pentagons);
    });

    socket.on('leave', () => {
        console.log(`Jogador ${socket.id} solicitou sair`);
        players = players.filter(p => p.id !== socket.id);
        io.emit('players', players);
    });

    socket.on('move', (data) => {
        const player = players.find(p => p.id === socket.id);
        if (player && player.hp > 0) {
            player.x = data.x;
            player.y = data.y;
            player.angle = data.angle;
            io.emit('players', players);
        }
    });

    socket.on('shoot', (data) => {
        io.emit('shoot', {
            id: socket.id,
            x: data.x,
            y: data.y,
            angle: data.angle
        });
    });

    socket.on('bulletHitPentagon', (data) => {
        const pentagon = pentagons.find(p => p.id === data.pentagonId);
        if (pentagon) {
            pentagon.hp -= 1;
            console.log(`Pentagon ${pentagon.id} hit! HP remaining: ${pentagon.hp}`);
            if (pentagon.hp <= 0) {
                console.log(`Pentagon ${pentagon.id} destroyed!`);
                const shooter = players.find(p => p.id === data.shooterId);
                if (shooter) {
                    shooter.score += pentagon.isSmall ? 15 : 30;
                    console.log(`Score updated for ${shooter.name}: ${shooter.score}`);
                    if (!pentagon.isSmall && Math.random() < 0.5) {
                        pentagons.push({
                            id: Math.random().toString(36).substr(2, 9),
                            x: pentagon.x,
                            y: pentagon.y,
                            size: 10,
                            speed: pentagon.speed / 2,
                            angle: Math.random() * Math.PI * 2,
                            hp: 5,
                            isSmall: true,
                            lastDirectionChange: Date.now(),
                            behavior: pentagon.behavior
                        });
                        pentagons.push({
                            id: Math.random().toString(36).substr(2, 9),
                            x: pentagon.x,
                            y: pentagon.y,
                            size: 10,
                            speed: pentagon.speed / 2,
                            angle: Math.random() * Math.PI * 2,
                            hp: 5,
                            isSmall: true,
                            lastDirectionChange: Date.now(),
                            behavior: pentagon.behavior
                        });
                        console.log('Spawned two small pentagons');
                    }
                }
                pentagons = pentagons.filter(p => p.id !== pentagon.id);
            }
            io.emit('pentagons', pentagons);
            io.emit('players', players);
        }
    });

    socket.on('playerDamaged', (data) => {
        console.log(`Received playerDamaged event: ${JSON.stringify(data)}`);
        if (!data.playerId) {
            console.log('Error: playerId not provided in playerDamaged event');
            return;
        }
        const player = players.find(p => p.id === data.playerId);
        if (player) {
            player.hp = Math.max(0, player.hp - data.damage);
            console.log(`Player ${player.name} took ${data.damage} damage! HP remaining: ${player.hp}`);
            if (player.hp <= 0) {
                console.log(`Player ${player.name} destroyed by collision!`);
                players = players.filter(p => p.id !== player.id);
            }
            io.emit('players', players);
        } else {
            console.log(`Player not found: ${data.playerId}`);
        }
    });

    socket.on('bulletHitPlayer', (data) => {
        console.log(`Received bulletHitPlayer event: ${JSON.stringify(data)}`);
        const targetPlayer = players.find(p => p.id === data.targetPlayerId);
        const shooter = players.find(p => p.id === data.shooterId);
        if (targetPlayer && shooter && targetPlayer.id !== shooter.id) {
            targetPlayer.hp = Math.max(0, targetPlayer.hp - data.damage);
            console.log(`Player ${targetPlayer.name} hit by ${shooter.name}! HP remaining: ${targetPlayer.hp}`);
            if (targetPlayer.hp <= 0) {
                shooter.score += 100;
                console.log(`Player ${targetPlayer.name} destroyed by ${shooter.name}! Shooter score: ${shooter.score}`);
                // Emitir evento de eliminação para todos os clientes
                io.emit('playerEliminated', {
                    killerName: shooter.name,
                    victimName: targetPlayer.name
                });
                players = players.filter(p => p.id !== targetPlayer.id);
            }
            io.emit('players', players);
        } else {
            console.log(`Invalid bulletHitPlayer event: target ${data.targetPlayerId}, shooter ${data.shooterId}`);
        }
    });

    socket.on('updatePentagonPosition', (data) => {
        const pentagon = pentagons.find(p => p.id === data.pentagonId);
        if (pentagon) {
            pentagon.x = data.x;
            pentagon.y = data.y;
            console.log(`Pentagon ${pentagon.id} repositioned to x: ${pentagon.x}, y: ${pentagon.y}`);
            io.emit('pentagons', pentagons);
        }
    });

    socket.on('disconnect', () => {
        console.log('Jogador desconectado:', socket.id);
        players = players.filter(player => player.id !== socket.id);
        io.emit('players', players);
    });
});

function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

setInterval(() => {
    pentagons = pentagons.filter(p => p.hp > 0);
    const largePentagons = pentagons.filter(p => !p.isSmall).length;
    if (largePentagons < 5) {
        const newPentagon = createPentagon();
        pentagons.push(newPentagon);
        console.log(`Spawned new large pentagon. Total large pentagons: ${largePentagons + 1}`);
    }

    pentagons.forEach(p => {
        const nearestPlayer = players.reduce((closest, pl) => {
            const dist = Math.hypot(pl.x - p.x, pl.y - p.y);
            return (!closest || dist < Math.hypot(closest.x - p.x, closest.y - p.y)) ? pl : closest;
        }, null);

        if (nearestPlayer) {
            const targetAngle = Math.atan2(nearestPlayer.y - p.y, nearestPlayer.x - p.x);
            if (p.behavior === 'chase') {
                let angleDiff = targetAngle - p.angle;
                angleDiff = normalizeAngle(angleDiff);
                p.angle += angleDiff * 0.1;
            } else if (p.behavior === 'evade') {
                const distance = Math.hypot(nearestPlayer.x - p.x, nearestPlayer.y - p.y);
                if (distance < 100) {
                    const escapeAngle = Math.atan2(p.y - nearestPlayer.y, p.x - nearestPlayer.x);
                    let angleDiff = escapeAngle - p.angle;
                    angleDiff = normalizeAngle(angleDiff);
                    p.angle += angleDiff * 0.1;
                }
            }
        }

        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;

        if (p.x < 20 || p.x > 780 || p.y < 20 || p.y > 580) {
            if (nearestPlayer) {
                const correctedAngle = Math.atan2(nearestPlayer.y - p.y, nearestPlayer.x - p.x);
                p.angle = correctedAngle;
            } else {
                p.angle = p.angle + Math.PI + (Math.random() - 0.5) * Math.PI / 2;
            }
            p.x = Math.max(20, Math.min(780, p.x));
            p.y = Math.max(20, Math.min(580, p.y));
        }

        const now = Date.now();
        if (now - p.lastDirectionChange > (2000 + Math.random() * 3000)) {
            p.angle += (Math.random() - 0.5) * Math.PI / 2;
            p.lastDirectionChange = now;
        }
    });
    io.emit('pentagons', pentagons);
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});