const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// Игровое состояние
const players = new Map();
const planets = [];
const goal = { x: 2000, y: 1500, radius: 25 };

// Генерация планет
function generatePlanets() {
    const planetCount = 30;
    const spread = 3000;
    
    for (let i = 0; i < planetCount; i++) {
        const x = (Math.random() - 0.5) * spread * 2;
        const y = (Math.random() - 0.5) * spread * 2;
        const radius = 20 + Math.random() * 60;
        const mass = radius * radius * 0.8;
        
        const colors = [
            { color: '#FF8A65', glow: '#FF5722' },
            { color: '#80DEEA', glow: '#00BCD4' },
            { color: '#CE93D8', glow: '#9C27B0' },
            { color: '#FFD54F', glow: '#FFC107' },
            { color: '#A5D6A7', glow: '#4CAF50' },
            { color: '#EF9A9A', glow: '#F44336' },
            { color: '#90CAF9', glow: '#2196F3' }
        ];
        
        const palette = colors[Math.floor(Math.random() * colors.length)];
        
        planets.push({
            x: x,
            y: y,
            radius: radius,
            mass: mass,
            color: palette.color,
            glowColor: palette.glow,
            hasRing: radius > 50 && Math.random() > 0.5
        });
    }
}

generatePlanets();

// Обработка подключений
wss.on('connection', (ws) => {
    const playerId = Math.random().toString(36).substring(7);
    
    // Создание нового игрока
    const player = {
        id: playerId,
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
        angle: 0,
        fuel: 100,
        alive: true,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        name: `Игрок ${playerId.substring(0, 4).toUpperCase()}`
    };
    
    players.set(playerId, player);
    
    // Отправка начального состояния
    ws.send(JSON.stringify({
        type: 'init',
        playerId: playerId,
        players: Array.from(players.values()),
        planets: planets,
        goal: goal
    }));
    
    // Уведомление других игроков
    broadcast({
        type: 'playerJoined',
        player: player
    }, ws);
    
    // Обработка сообщений
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'update':
                if (players.has(playerId)) {
                    const p = players.get(playerId);
                    p.x = data.x;
                    p.y = data.y;
                    p.vx = data.vx;
                    p.vy = data.vy;
                    p.angle = data.angle;
                    p.fuel = data.fuel;
                    p.alive = data.alive;
                }
                break;
                
            case 'respawn':
                if (players.has(playerId)) {
                    const p = players.get(playerId);
                    p.x = (Math.random() - 0.5) * 200;
                    p.y = (Math.random() - 0.5) * 200;
                    p.vx = 0;
                    p.vy = 0;
                    p.angle = 0;
                    p.fuel = 100;
                    p.alive = true;
                }
                break;
        }
    });
    
    // Отключение игрока
    ws.on('close', () => {
        players.delete(playerId);
        broadcast({
            type: 'playerLeft',
            playerId: playerId
        });
    });
});

// Отправка состояния всем игрокам
function broadcast(data, excludeWs = null) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Игровой цикл на сервере (обновление позиций)
setInterval(() => {
    const playersArray = Array.from(players.values());
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'state',
                players: playersArray
            }));
        }
    });
}, 50); // 20 обновлений в секунду

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌍 Откройте http://localhost:${PORT} в браузере`);
});