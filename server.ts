/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HIGHSCORES_FILE = path.join(process.cwd(), 'highscores.json');

// Initialize Express, HTTP, and WebSocket Servers
const app = express();
const PORT = 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/api/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  } catch (err) {
    console.error('Error handling WebSocket upgrade:', err);
  }
});

app.use(express.json());

// In-memory counter for total matches played today (persisted during server session)
let matchesToday = 1248;

// Persistent Global Leaderboard Helpers
function loadHighscores() {
  try {
    if (fs.existsSync(HIGHSCORES_FILE)) {
      const data = fs.readFileSync(HIGHSCORES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading highscores file:", e);
  }
  // Fallback seed highscores
  return [
    { name: 'HyperWorm', score: 32000, date: '01/07/2026', mode: 'online' },
    { name: 'SlitherPro', score: 25400, date: '02/07/2026', mode: 'online' },
    { name: 'MinhocaMestra', score: 18100, date: '04/07/2026', mode: 'online' },
    { name: 'NeonViper', score: 11900, date: '05/07/2026', mode: 'online' },
    { name: 'GlowStar', score: 8500, date: '06/07/2026', mode: 'online' },
  ];
}

function saveHighscores(scores: any[]) {
  try {
    fs.writeFileSync(HIGHSCORES_FILE, JSON.stringify(scores.slice(0, 20), null, 2), 'utf8');
  } catch (e) {
    console.error("Error writing highscores file:", e);
  }
}

// REST Endpoints
app.get('/api/highscores', (req, res) => {
  const scores = loadHighscores();
  res.json(scores.sort((a: any, b: any) => b.score - a.score).slice(0, 10));
});

app.post('/api/highscores', (req, res) => {
  const newEntry = req.body;
  if (!newEntry || !newEntry.name || typeof newEntry.score !== 'number') {
    return res.status(400).json({ error: 'Invalid highscore entry data' });
  }

  const scores = loadHighscores();
  scores.push({
    name: newEntry.name,
    score: newEntry.score,
    date: newEntry.date || new Date().toLocaleDateString('pt-BR'),
    mode: newEntry.mode || 'online'
  });

  scores.sort((a: any, b: any) => b.score - a.score);
  saveHighscores(scores);

  res.json({ success: true, scores: scores.slice(0, 10) });
});

// Dynamic dashboard statistics
app.get('/api/stats', (req, res) => {
  const scores = loadHighscores();
  // Find highest score in database
  const highest = scores.reduce((max: number, s: any) => s.score > max ? s.score : max, 23547);
  res.json({
    onlineCount: players.size,
    matchesToday: matchesToday,
    highestScore: highest
  });
});

app.post('/api/stats/match', (req, res) => {
  matchesToday++;
  res.json({ success: true, matchesToday });
});

app.get('/api/online-players', (req, res) => {
  res.json({ count: players.size });
});

// Multiplayer WebSocket Coordination
interface OnlinePlayer {
  id: string;
  ws: WebSocket;
  name: string;
  skin: any;
  segments: { x: number; y: number }[];
  score: number;
  angle: number;
  isBoosting: boolean;
}

interface FoodDot {
  id: string;
  x: number;
  y: number;
  color: string;
  value: number;
}

const players = new Map<string, OnlinePlayer>();
const sharedFood: FoodDot[] = [];
const ARENA_RADIUS = 2000;

// Spawn initial food layout
const FOOD_COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#eab308'];
function spawnFood(count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * (ARENA_RADIUS - 40);
    sharedFood.push({
      id: `food_srv_${Math.random()}`,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
      value: Math.floor(Math.random() * 4) + 1,
    });
  }
}
spawnFood(500); // 500 initial persistent food items

wss.on('connection', (ws: WebSocket) => {
  const playerId = `p_${Math.random().toString(36).substring(2, 9)}`;
  let joined = false;

  ws.on('message', (message: string) => {
    try {
      const msg = JSON.parse(message);

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }

      if (msg.type === 'join') {
        // Player joins the active session
        joined = true;
        matchesToday++;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * (ARENA_RADIUS - 400);
        const startX = Math.cos(angle) * dist;
        const startY = Math.sin(angle) * dist;

        const initialSegments = [];
        for (let i = 0; i < 12; i++) {
          initialSegments.push({ x: startX, y: startY + i * 8 });
        }

        const playerObj: OnlinePlayer = {
          id: playerId,
          ws: ws,
          name: msg.name || 'SemNome',
          skin: msg.skin,
          segments: initialSegments,
          score: 10,
          angle: -Math.PI / 2,
          isBoosting: false,
        };

        players.set(playerId, playerObj);

        // Welcome package containing details & complete food coordinates
        ws.send(JSON.stringify({
          type: 'welcome',
          id: playerId,
          startX: startX,
          startY: startY,
          food: sharedFood,
        }));

        // Broadcast a join log to other players
        broadcastToOthers(playerId, {
          type: 'playerJoined',
          name: playerObj.name,
        });
      }

      const player = players.get(playerId);
      if (!player) return;

      if (msg.type === 'tick') {
        player.segments = msg.segments || [];
        player.score = msg.score || 10;
        player.angle = msg.angle || 0;
      } else if (msg.type === 'boost') {
        player.isBoosting = msg.isBoosting || false;
      } else if (msg.type === 'dropBoostFood') {
        // Boost food drop added to shared grid
        const boostFood = msg.food;
        sharedFood.push(boostFood);
        broadcast({
          type: 'foodSpawnedBroadcast',
          food: boostFood,
        });
      } else if (msg.type === 'eatFood') {
        const foodId = msg.foodId;
        const index = sharedFood.findIndex(f => f.id === foodId);
        if (index !== -1) {
          sharedFood.splice(index, 1);
          
          // Broadcast lightweight removal event
          broadcast({
            type: 'foodEatenBroadcast',
            foodId: foodId,
          });

          // Spawn a replacements
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.sqrt(Math.random()) * (ARENA_RADIUS - 40);
          const newFood: FoodDot = {
            id: `food_srv_${Math.random()}`,
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
            value: Math.floor(Math.random() * 4) + 1,
          };
          sharedFood.push(newFood);
          
          broadcast({
            type: 'foodSpawnedBroadcast',
            food: newFood,
          });
        }
      } else if (msg.type === 'die') {
        // Player reports their death. Convert body segments into glowing food blobs
        const deadSegments = player.segments || [];
        deadSegments.forEach((seg, idx) => {
          if (idx % 2 === 0) {
            const foodDrop: FoodDot = {
              id: `food_drop_${Math.random()}`,
              x: seg.x + (Math.random() * 12 - 6),
              y: seg.y + (Math.random() * 12 - 6),
              color: player.skin.primaryColor || '#10b981',
              value: Math.floor(Math.random() * 3) + 2,
            };
            sharedFood.push(foodDrop);
            broadcast({
              type: 'foodSpawnedBroadcast',
              food: foodDrop,
            });
          }
        });

        // Trigger kill rewards for closest player
        findAndRewardKiller(player);

        players.delete(playerId);
      }
    } catch (e) {
      console.error("Error processing WS frame:", e);
    }
  });

  ws.on('close', () => {
    if (players.has(playerId)) {
      players.delete(playerId);
    }
  });
});

// Broadcast utilities
function broadcast(data: any) {
  const jsonStr = JSON.stringify(data);
  players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(jsonStr);
    }
  });
}

function broadcastToOthers(excludeId: string, data: any) {
  const jsonStr = JSON.stringify(data);
  players.forEach((p, id) => {
    if (id !== excludeId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(jsonStr);
    }
  });
}

// Reward system for other snakes when player dies nearby
function findAndRewardKiller(deadPlayer: OnlinePlayer) {
  const deadHead = deadPlayer.segments[0];
  if (!deadHead) return;

  let closestPlayer: OnlinePlayer | null = null;
  let closestDist = 200; // reasonable proximity limit

  players.forEach((p, id) => {
    if (id === deadPlayer.id) return;
    const pHead = p.segments[0];
    if (pHead) {
      const d = Math.hypot(pHead.x - deadHead.x, pHead.y - deadHead.y);
      if (d < closestDist) {
        closestDist = d;
        closestPlayer = p;
      }
    }
  });

  if (closestPlayer && (closestPlayer as OnlinePlayer).ws.readyState === WebSocket.OPEN) {
    (closestPlayer as OnlinePlayer).ws.send(JSON.stringify({
      type: 'killNotification',
    }));
  }
}

// Continuous Tick synchronization broadcast loop (Runs 25 frames per second)
setInterval(() => {
  if (players.size === 0) return;

  const playersList = Array.from(players.values()).map(p => ({
    id: p.id,
    name: p.name,
    skin: p.skin,
    segments: p.segments,
    score: p.score,
    angle: p.angle,
    isBoosting: p.isBoosting,
  }));

  const tickPacket = JSON.stringify({
    type: 'serverUpdate',
    players: playersList,
  });

  players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(tickPacket);
    }
  });
}, 40);

// Integrate Vite middleware for development or Static Assets for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server executing successfully on http://localhost:${PORT}`);
  });
}

startServer();
export default app;
