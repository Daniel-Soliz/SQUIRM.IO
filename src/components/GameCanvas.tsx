/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameMode, SkinConfig, SnakeData, FoodDot, LeaderboardEntry } from '../types';
import { audioEngine } from './AudioEngine';
import { ArrowLeft, RefreshCw, Trophy, Zap, Compass, Users, Volume2, VolumeX } from 'lucide-react';

interface GameCanvasProps {
  mode: 'offline' | 'online';
  playerName: string;
  playerSkin: SkinConfig;
  onExit: () => void;
}

interface SparkParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  glowing: boolean;
}

const ARENA_RADIUS = 2000;
const SEGMENT_SPACING = 8;
const BASE_SPEED = 2.5;
const BOOST_SPEED = 5.0;

const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(x, y + size/4);
  ctx.bezierCurveTo(x, y - size/2, x - size, y - size/2, x - size, y + size/4);
  ctx.bezierCurveTo(x - size, y + size * 0.8, x, y + size * 1.1, x, y + size * 1.3);
  ctx.bezierCurveTo(x, y + size * 1.1, x + size, y + size * 0.8, x + size, y + size/4);
  ctx.bezierCurveTo(x + size, y - size/2, x, y - size/2, x, y + size/4);
  ctx.fill();
};

const getSegmentColor = (skin: SkinConfig, i: number): string => {
  if (skin.colors && skin.colors.length > 0) {
    return skin.colors[i % skin.colors.length];
  }
  if (skin.pattern === 'rainbow') {
    return `hsl(${(Date.now() / 25 - i * 15) % 360}, 90%, 55%)`;
  } else if (skin.pattern === 'checkered') {
    return i % 2 === 0 ? skin.primaryColor : skin.secondaryColor;
  } else if (skin.pattern === 'striped') {
    return Math.floor(i / 2) % 2 === 0 ? skin.primaryColor : skin.secondaryColor;
  } else {
    return skin.primaryColor;
  }
};

export default function GameCanvas({ mode, playerName, playerSkin, onExit }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Sound state
  const [muted, setMuted] = useState<boolean>(audioEngine.getMuted());

  const handleToggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    audioEngine.setMuted(newMuted);
  };

  // Game States
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(10);
  const [survivalTime, setSurvivalTime] = useState<number>(0); // in seconds
  const [kills, setKills] = useState<number>(0);
  const [onlinePlayersCount, setOnlinePlayersCount] = useState<number>(1);
  const [ping, setPing] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Session Leaderboard
  const [sessionLeaderboard, setSessionLeaderboard] = useState<{ name: string; score: number; isPlayer?: boolean }[]>([]);

  // Physics simulation references (held in refs for high performance 60fps loops)
  const playerSnake = useRef<SnakeData>({
    id: 'player',
    name: playerName,
    score: 10,
    skin: playerSkin,
    segments: [],
    angle: 0,
    isBoosting: false,
  });

  const foodDots = useRef<FoodDot[]>([]);
  const bots = useRef<SnakeData[]>([]);
  const otherPlayers = useRef<Map<string, SnakeData>>(new Map());
  const mousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const camera = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const particles = useRef<SparkParticle[]>([]);
  
  const spawnFoodParticles = (x: number, y: number, color: string, value: number) => {
    // Desativado a pedido do usuário
  };
  
  // Game metrics
  const gameStartTimestamp = useRef<number>(Date.now());
  const keysPressed = useRef<Set<string>>(new Set());
  const lastBoostDrop = useRef<number>(0);
  const pingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Initialize Player Snake segments in center
    const initialSegments = [];
    const length = 12;
    for (let i = 0; i < length; i++) {
      initialSegments.push({ x: 0, y: i * SEGMENT_SPACING });
    }
    playerSnake.current.segments = initialSegments;
    playerSnake.current.score = 10;
    playerSnake.current.isBoosting = false;
    playerSnake.current.angle = -Math.PI / 2;

    setScore(10);
    setSurvivalTime(0);
    setKills(0);
    setIsGameOver(false);
    setIsPlaying(true);
    gameStartTimestamp.current = Date.now();

    // Spawn initial local food if offline
    if (mode === 'offline') {
      spawnOfflineFood(400);
      spawnOfflineBots(14);
    } else {
      // Connect to multiplayer server
      connectWebSocket();
    }

    // Boosting handlers (Space key or Left Mouse Button click)
    let isSpacePressed = false;
    let isLeftMouseDown = false;

    const updateBoostState = () => {
      setBoosting(isSpacePressed || isLeftMouseDown);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
      if (e.code === 'Space') {
        isSpacePressed = true;
        updateBoostState();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
      if (e.code === 'Space') {
        isSpacePressed = false;
        updateBoostState();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { // Botão esquerdo do mouse
        const target = e.target as HTMLElement;
        // Só acelera se clicar na arena/canvas, ignorando botões do menu
        if (target && (target.tagName === 'CANVAS' || target === containerRef.current)) {
          isLeftMouseDown = true;
          updateBoostState();
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isLeftMouseDown = false;
        updateBoostState();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    // Start rendering loop
    let animFrameId: number;
    const canvas = canvasRef.current;
    if (canvas) {
      const resizeCanvas = () => {
        canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
        canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
      };
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      const renderLoop = () => {
        updatePhysics();
        drawGame();
        if (!isGameOver) {
          animFrameId = requestAnimationFrame(renderLoop);
        }
      };
      renderLoop();

      // Survival Timer
      const timer = setInterval(() => {
        if (!isGameOver) {
          setSurvivalTime(Math.floor((Date.now() - gameStartTimestamp.current) / 1000));
        }
      }, 1000);

      return () => {
        cancelAnimationFrame(animFrameId);
        window.removeEventListener('resize', resizeCanvas);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        clearInterval(timer);
        disconnectWebSocket();
      };
    }
  }, [mode, playerName, playerSkin]);

  // WebSocket connection & synchronization
  const connectWebSocket = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionError(null);
        // Send join details
        ws.send(JSON.stringify({
          type: 'join',
          name: playerName,
          skin: playerSkin,
        }));

        // Setup ping checks
        let pingStart = Date.now();
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            pingStart = Date.now();
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'pong') {
            setPing(Date.now() - (msg.timestamp || Date.now()));
          } else if (msg.type === 'welcome') {
            playerSnake.current.id = msg.id;
            foodDots.current = msg.food;
            // set starting position safely
            const head = playerSnake.current.segments[0];
            if (head) {
              head.x = msg.startX || 0;
              head.y = msg.startY || 0;
              // shift remaining segments
              for (let i = 1; i < playerSnake.current.segments.length; i++) {
                playerSnake.current.segments[i].x = head.x;
                playerSnake.current.segments[i].y = head.y + i * SEGMENT_SPACING;
              }
            }
          } else if (msg.type === 'serverUpdate') {
            // Update other players' positions
            const activeIds = new Set<string>();
            const playersList: any[] = msg.players;
            
            playersList.forEach((pData: any) => {
              if (pData.id === playerSnake.current.id) return; // skip self
              
              activeIds.add(pData.id);
              otherPlayers.current.set(pData.id, pData);
            });

            // Remove disconnected players
            for (const key of otherPlayers.current.keys()) {
              if (!activeIds.has(key)) {
                otherPlayers.current.delete(key);
              }
            }

            // Sync food array
            if (msg.food) {
              foodDots.current = msg.food;
            }

            // Update player count
            setOnlinePlayersCount(otherPlayers.current.size + 1);

            // Re-render leaderboard based on server state
            updateOnlineLeaderboard();
          } else if (msg.type === 'foodEatenBroadcast') {
            const eatenFood = foodDots.current.find(f => f.id === msg.foodId);
            if (eatenFood) {
              spawnFoodParticles(eatenFood.x, eatenFood.y, eatenFood.color, eatenFood.value);
            }
            foodDots.current = foodDots.current.filter(f => f.id !== msg.foodId);
          } else if (msg.type === 'foodSpawnedBroadcast') {
            foodDots.current.push(msg.food);
          } else if (msg.type === 'killNotification') {
            setKills(prev => prev + 1);
          }
        } catch (e) {
          console.error("Error parsing WS message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        setConnectionError("Erro de conexão com o servidor. Jogando offline como alternativa.");
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        setConnectionError("Conexão encerrada. Servidor fora do ar.");
      };
    } catch (err) {
      console.error(err);
      setConnectionError("Falha ao abrir canal WebSocket.");
    }
  };

  const disconnectWebSocket = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const setBoosting = (boosting: boolean) => {
    if (playerSnake.current.isBoosting === boosting) return;
    playerSnake.current.isBoosting = boosting;
    
    if (boosting && !isGameOver) {
      audioEngine.startBoostSound();
    } else {
      audioEngine.stopBoostSound();
    }

    // Sync boosting to server
    if (mode === 'online' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'boost',
        isBoosting: boosting,
      }));
    }
  };

  // Local Offline Simulation Helpers
  const spawnOfflineFood = (count: number) => {
    const colors = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#eab308'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * (ARENA_RADIUS - 40);
      foodDots.current.push({
        id: `food_${Math.random()}`,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        color: colors[Math.floor(Math.random() * colors.length)],
        value: Math.floor(Math.random() * 4) + 1, // weight
      });
    }
  };

  const spawnOfflineBots = (count: number) => {
    const botNames = [
      'GlitherAI', 'CobraMecanica', 'Veloz_Serpente', 'OrbeHunter', 'ViperX', 
      'BitEater', 'NeonSlither', 'MatrixWorm', 'GlowGetter', 'AlphaViper',
      'MinhocaMutante', 'SithSlither', 'LaserCobra', 'HydraBot', 'PixelPython'
    ];
    const colors = ['#f43f5e', '#a78bfa', '#fbbf24', '#22d3ee', '#f472b6', '#c084fc', '#4ade80', '#60a5fa'];
    const patterns: SkinConfig['pattern'][] = ['solid', 'checkered', 'striped', 'spotted'];
    const accessories: SkinConfig['headStyle'][] = ['none', 'glasses', 'crown', 'headphones', 'halo'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * (ARENA_RADIUS - 300);
      const startX = Math.cos(angle) * dist;
      const startY = Math.sin(angle) * dist;

      const botSegments = [];
      const botScore = Math.floor(Math.random() * 300) + 30;
      const botLength = Math.floor(botScore / 15) + 10;
      const botAngle = Math.random() * Math.PI * 2;

      for (let j = 0; j < botLength; j++) {
        botSegments.push({
          x: startX - Math.cos(botAngle) * j * SEGMENT_SPACING,
          y: startY - Math.sin(botAngle) * j * SEGMENT_SPACING,
        });
      }

      bots.current.push({
        id: `bot_${Math.random()}`,
        name: botNames[i % botNames.length] + ' [AI]',
        score: botScore,
        skin: {
          primaryColor: colors[Math.floor(Math.random() * colors.length)],
          secondaryColor: colors[Math.floor(Math.random() * colors.length)],
          pattern: patterns[Math.floor(Math.random() * patterns.length)],
          headStyle: accessories[Math.floor(Math.random() * accessories.length)],
          eyesType: 'normal',
        },
        segments: botSegments,
        angle: botAngle,
        isBoosting: false,
        isBot: true,
      });
    }
  };

  const handleBotDeath = (bot: SnakeData) => {
    // Convert bot segments to glowing food dots
    bot.segments.forEach((seg, idx) => {
      if (idx % 2 === 0) {
        foodDots.current.push({
          id: `food_drop_${Math.random()}`,
          x: seg.x + (Math.random() * 12 - 6),
          y: seg.y + (Math.random() * 12 - 6),
          color: bot.skin.primaryColor,
          value: Math.floor(Math.random() * 3) + 2,
        });
      }
    });

    audioEngine.playDeath();

    // Remove bot and respawn a new one after a delay to keep playfield active
    bots.current = bots.current.filter(b => b.id !== bot.id);
    setTimeout(() => {
      if (isPlaying && mode === 'offline') {
        spawnOfflineBots(1);
      }
    }, 4000);
  };

  // Game Physics Engine Step
  const updatePhysics = () => {
    if (isGameOver || !isPlaying) return;

    // 1. Update Player position smoothly following mouse
    const canvas = canvasRef.current;
    if (canvas) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const dx = mousePos.current.x - centerX;
      const dy = mousePos.current.y - centerY;
      const distanceToMouse = Math.hypot(dx, dy);

      // Target angle
      if (distanceToMouse > 5) {
        const targetAngle = Math.atan2(dy, dx);
        
        // Smooth rotation interpolation
        let angleDiff = targetAngle - playerSnake.current.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        const maxRotationSpeed = 0.08; // heavy steering feel
        playerSnake.current.angle += Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, angleDiff));
      }

      // Move player head
      const currentSpeed = playerSnake.current.isBoosting && playerSnake.current.score > 12 ? BOOST_SPEED : BASE_SPEED;
      const head = playerSnake.current.segments[0];
      if (head) {
        head.x += Math.cos(playerSnake.current.angle) * currentSpeed;
        head.y += Math.sin(playerSnake.current.angle) * currentSpeed;

        // Boundary Check: Colliding with circular boundary kills player!
        const distFromCenter = Math.hypot(head.x, head.y);
        if (distFromCenter >= ARENA_RADIUS) {
          triggerGameOver("Você bateu na barreira energética do mapa!");
          return;
        }

        // Boosting consume score & drop trails
        if (playerSnake.current.isBoosting && playerSnake.current.score > 12) {
          const now = Date.now();
          if (now - lastBoostDrop.current > 180) { // drops food trail every 180ms
            playerSnake.current.score -= 1;
            setScore(playerSnake.current.score);
            lastBoostDrop.current = now;

            // Tail coordinates
            const tail = playerSnake.current.segments[playerSnake.current.segments.length - 1];
            if (tail) {
              const trailFood = {
                id: `food_boost_${Math.random()}`,
                x: tail.x + Math.cos(playerSnake.current.angle + Math.PI) * 10,
                y: tail.y + Math.sin(playerSnake.current.angle + Math.PI) * 10,
                color: playerSkin.primaryColor,
                value: 1,
              };

              if (mode === 'offline') {
                foodDots.current.push(trailFood);
              } else if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'dropBoostFood',
                  food: trailFood,
                }));
              }
            }
          }
        }
      }

      // Smooth body segments physics (following segments)
      const targetLength = Math.floor(playerSnake.current.score / 12) + 12;
      adjustSnakeSegments(playerSnake.current, targetLength);

      // Camera follows player head smoothly
      if (head) {
        camera.current.x = head.x;
        camera.current.y = head.y;
      }
    }

    // 2. Local Bots AI Simulation (Solo mode only)
    if (mode === 'offline') {
      bots.current.forEach(bot => {
        // AI Decision steering
        if (!bot.isBot) return;

        // Locate nearest food
        let nearestFood: FoodDot | null = null;
        let minFoodDist = 300; // detection range

        const botHead = bot.segments[0];
        if (!botHead) return;

        foodDots.current.forEach(food => {
          const dist = Math.hypot(food.x - botHead.x, food.y - botHead.y);
          if (dist < minFoodDist) {
            minFoodDist = dist;
            nearestFood = food;
          }
        });

        // Wander / Steer towards food
        let targetAngle = bot.angle;
        if (nearestFood) {
          targetAngle = Math.atan2((nearestFood as FoodDot).y - botHead.y, (nearestFood as FoodDot).x - botHead.x);
        } else if (Math.random() < 0.03) {
          // Slowly wander randomly
          targetAngle = bot.angle + (Math.random() * 1.5 - 0.75);
        }

        // Collision avoidance AI
        // Scan other snakes (player and bots) nearby
        let obstacleNearby = false;
        const avoidObstacle = (otherSegX: number, otherSegY: number) => {
          const dist = Math.hypot(otherSegX - botHead.x, otherSegY - botHead.y);
          if (dist < 100) {
            // Steer sharp away!
            const awayAngle = Math.atan2(botHead.y - otherSegY, botHead.x - otherSegX);
            targetAngle = awayAngle + (Math.random() * 0.5 - 0.25);
            obstacleNearby = true;
          }
        };

        // Avoid Player body
        playerSnake.current.segments.forEach(seg => avoidObstacle(seg.x, seg.y));

        // Avoid other Bots bodies
        bots.current.forEach(otherBot => {
          if (otherBot.id === bot.id) return;
          otherBot.segments.forEach(seg => avoidObstacle(seg.x, seg.y));
        });

        // Avoid arena outer walls
        const centerDist = Math.hypot(botHead.x, botHead.y);
        if (centerDist > ARENA_RADIUS - 150) {
          // steer back to center
          targetAngle = Math.atan2(-botHead.y, -botHead.x);
          bot.isBoosting = true;
        } else {
          bot.isBoosting = obstacleNearby && Math.random() < 0.3; // boost to escape
        }

        // Smooth bot steering
        let angleDiff = targetAngle - bot.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        bot.angle += Math.max(-0.07, Math.min(0.07, angleDiff));

        // Move bot
        const botSpeed = bot.isBoosting && bot.score > 15 ? BOOST_SPEED : BASE_SPEED;
        botHead.x += Math.cos(bot.angle) * botSpeed;
        botHead.y += Math.sin(bot.angle) * botSpeed;

        // Bound check for bot
        if (Math.hypot(botHead.x, botHead.y) >= ARENA_RADIUS) {
          handleBotDeath(bot);
          return;
        }

        // Adjust segments length based on score
        const botTargetLength = Math.floor(bot.score / 12) + 12;
        adjustSnakeSegments(bot, botTargetLength);
      });
    }

    // 3. Collision Detections (Local client-side handling)
    const playerHead = playerSnake.current.segments[0];
    if (playerHead) {
      // A. Player eats food
      foodDots.current = foodDots.current.filter(food => {
        const dist = Math.hypot(food.x - playerHead.x, food.y - playerHead.y);
        const playerRadius = 14;
        if (dist < playerRadius + (food.value * 1.5)) {
          // Eat!
          playerSnake.current.score += food.value * 2;
          setScore(playerSnake.current.score);
          audioEngine.playEat();
          
          // Spawn colorful spark particles!
          spawnFoodParticles(food.x, food.y, food.color, food.value);

          if (mode === 'online') {
            // Notify server of food consumption
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'eatFood',
                foodId: food.id,
                scoreGain: food.value * 2,
              }));
            }
          }
          return false; // remove
        }
        return true;
      });

      // B. Local Bots eat food (Offline mode only)
      if (mode === 'offline') {
        bots.current.forEach(bot => {
          const botHead = bot.segments[0];
          if (!botHead) return;

          foodDots.current = foodDots.current.filter(food => {
            const dist = Math.hypot(food.x - botHead.x, food.y - botHead.y);
            if (dist < 13 + (food.value * 1.5)) {
              bot.score += food.value * 2;
              
              // Spawn particles when bots eat food
              spawnFoodParticles(food.x, food.y, food.color, food.value);
              return false; // remove
            }
            return true;
          });
        });
      }

      // C. Snake vs Snake body collisions
      // If player's head hits another snake's body, player dies.
      // If player's body gets hit by another snake's head, the other snake dies!
      
      // Checking collisions in Offline mode:
      if (mode === 'offline') {
        // Player head vs Bots body segments
        const playerHeadRad = 13;
        bots.current.forEach(bot => {
          // Skip first few segments near head to prevent accidental side collisions
          bot.segments.forEach((seg, idx) => {
            if (idx < 3) return; // ignore collar
            const dist = Math.hypot(seg.x - playerHead.x, seg.y - playerHead.y);
            if (dist < playerHeadRad + 11) {
              triggerGameOver(`Sua cabeça colidiu com o corpo de ${bot.name}!`);
            }
          });
        });

        // Bots heads vs Player body segments OR other bots bodies
        bots.current.forEach(bot => {
          const botHead = bot.segments[0];
          if (!botHead) return;

          // Bot head vs Player body
          playerSnake.current.segments.forEach((seg, idx) => {
            if (idx < 3) return;
            const dist = Math.hypot(seg.x - botHead.x, seg.y - botHead.y);
            if (dist < 13 + 11) {
              // Bot dies!
              handleBotDeath(bot);
              setKills(prev => prev + 1); // increment player kills
            }
          });

          // Bot head vs other Bots bodies
          bots.current.forEach(otherBot => {
            if (otherBot.id === bot.id) return;
            otherBot.segments.forEach((seg, idx) => {
              if (idx < 3) return;
              const dist = Math.hypot(seg.x - botHead.x, seg.y - botHead.y);
              if (dist < 13 + 11) {
                handleBotDeath(bot);
              }
            });
          });
        });

        // Replenish offline food if count drops
        if (foodDots.current.length < 320) {
          spawnOfflineFood(80);
        }

        // Update Offline session scoreboard
        updateOfflineLeaderboard();
      } else {
        // Online Mode Collisions
        // Player head vs other Players bodies
        otherPlayers.current.forEach(other => {
          other.segments.forEach((seg, idx) => {
            if (idx < 3) return; // avoid false triggers near head
            const dist = Math.hypot(seg.x - playerHead.x, seg.y - playerHead.y);
            if (dist < 23) { // Head radius + segment radius
              triggerGameOver(`Você colidiu com o corpo de ${other.name}!`);
            }
          });
        });

        // Send state tick to WebSocket server
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'tick',
            score: playerSnake.current.score,
            segments: playerSnake.current.segments,
            angle: playerSnake.current.angle,
          }));
        }
      }
    }
  };

  const adjustSnakeSegments = (snake: SnakeData, targetLen: number) => {
    const head = snake.segments[0];
    if (!head) return;

    // Follow spacing physics
    for (let i = 1; i < snake.segments.length; i++) {
      const dx = snake.segments[i].x - snake.segments[i - 1].x;
      const dy = snake.segments[i].y - snake.segments[i - 1].y;
      const dist = Math.hypot(dx, dy);
      if (dist > SEGMENT_SPACING) {
        const ratio = SEGMENT_SPACING / dist;
        snake.segments[i].x = snake.segments[i - 1].x + dx * ratio;
        snake.segments[i].y = snake.segments[i - 1].y + dy * ratio;
      }
    }

    // Grow / shrink segments smoothly
    if (snake.segments.length < targetLen) {
      const tail = snake.segments[snake.segments.length - 1] || head;
      snake.segments.push({ x: tail.x, y: tail.y });
    } else if (snake.segments.length > targetLen) {
      snake.segments.pop();
    }
  };

  const triggerGameOver = (reason: string) => {
    setIsGameOver(true);
    setBoosting(false);
    audioEngine.playDeath();
    audioEngine.stopBoostSound();

    // Trigger local scoreboard saving
    saveFinalScoreToLeaderboards();

    // Report death to websocket
    if (mode === 'online' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'die',
        reason: reason,
        finalScore: playerSnake.current.score,
      }));
    }
  };

  const saveFinalScoreToLeaderboards = () => {
    const finalScore = playerSnake.current.score;
    const finalName = playerName;
    const dateStr = new Date().toLocaleDateString('pt-BR');

    const entry: LeaderboardEntry = {
      name: finalName,
      score: finalScore,
      date: dateStr,
      mode: mode,
    };

    if (mode === 'offline') {
      try {
        const local = localStorage.getItem('slither_highscores_local');
        const scores: LeaderboardEntry[] = local ? JSON.parse(local) : [];
        scores.push(entry);
        scores.sort((a, b) => b.score - a.score);
        localStorage.setItem('slither_highscores_local', JSON.stringify(scores.slice(0, 15)));
      } catch (e) {
        console.error("Failed saving offline highscore:", e);
      }
    } else {
      // POST to backend API to store in global highscore!
      fetch('/api/highscores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(e => console.warn("Failed saving global online score:", e));
    }
  };

  const updateOfflineLeaderboard = () => {
    // Collect player and all bots
    const list = [
      { name: playerSnake.current.name, score: playerSnake.current.score, isPlayer: true },
      ...bots.current.map(b => ({ name: b.name, score: b.score, isPlayer: false }))
    ];
    list.sort((a, b) => b.score - a.score);
    setSessionLeaderboard(list.slice(0, 10));
  };

  const updateOnlineLeaderboard = () => {
    const list = [
      { name: playerSnake.current.name, score: playerSnake.current.score, isPlayer: true },
      ...(Array.from(otherPlayers.current.values()) as SnakeData[]).map(o => ({ name: o.name, score: o.score, isPlayer: false }))
    ];
    list.sort((a, b) => b.score - a.score);
    setSessionLeaderboard(list.slice(0, 10));
  };

  const restartGame = () => {
    audioEngine.playClick();
    
    // Re-initialize player
    const initialSegments = [];
    const length = 12;
    for (let i = 0; i < length; i++) {
      initialSegments.push({ x: 0, y: i * SEGMENT_SPACING });
    }
    playerSnake.current.segments = initialSegments;
    playerSnake.current.score = 10;
    playerSnake.current.isBoosting = false;
    playerSnake.current.angle = -Math.PI / 2;

    setScore(10);
    setSurvivalTime(0);
    setKills(0);
    setIsGameOver(false);
    setIsPlaying(true);
    gameStartTimestamp.current = Date.now();
    particles.current = [];

    if (mode === 'offline') {
      foodDots.current = [];
      bots.current = [];
      spawnOfflineFood(400);
      spawnOfflineBots(14);
    } else {
      disconnectWebSocket();
      connectWebSocket();
    }
  };

  // Canvas Drawing
  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Camera transform parameters
    const camX = camera.current.x;
    const camY = camera.current.y;
    const halfW = canvas.width / 2;
    const halfH = canvas.height / 2;

    // Helper to translate coordinate to screen space
    const toScreen = (x: number, y: number) => ({
      x: x - camX + halfW,
      y: y - camY + halfH,
    });

    // 1. Draw Grid Background (centered around camera offset)
    ctx.save();
    ctx.strokeStyle = '#1e2230';
    ctx.lineWidth = 1;
    const gridSize = 50;
    
    // Calculate start/end of grid lines based on camera coordinates
    const startX = Math.floor((camX - halfW) / gridSize) * gridSize;
    const endX = Math.ceil((camX + halfW) / gridSize) * gridSize;
    const startY = Math.floor((camY - halfH) / gridSize) * gridSize;
    const endY = Math.ceil((camY + halfH) / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
      const scr = toScreen(x, 0);
      ctx.beginPath();
      ctx.moveTo(scr.x, 0);
      ctx.lineTo(scr.x, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += gridSize) {
      const scr = toScreen(0, y);
      ctx.beginPath();
      ctx.moveTo(0, scr.y);
      ctx.lineTo(canvas.width, scr.y);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Draw Arena Boundaries (Circular energy fence)
    const arenaCenter = toScreen(0, 0);
    ctx.save();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 14;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(arenaCenter.x, arenaCenter.y, ARENA_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary decorative dotted wall
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 15]);
    ctx.beginPath();
    ctx.arc(arenaCenter.x, arenaCenter.y, ARENA_RADIUS - 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 3. Draw Food Dots (With glowing aura effects)
    foodDots.current.forEach(food => {
      // Frustum culling: don't render food if far off screen
      const scr = toScreen(food.x, food.y);
      if (scr.x < -20 || scr.x > canvas.width + 20 || scr.y < -20 || scr.y > canvas.height + 20) return;

      const size = 3 + food.value * 1.4;

      ctx.save();
      ctx.fillStyle = food.color;
      ctx.shadowColor = food.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Secondary glowing dot in core
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, size * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 4. Draw Other Snakes (Multiplayer / Bots)
    const drawOtherSnake = (snake: SnakeData) => {
      if (!snake.segments || snake.segments.length === 0) return;

      // Draw segments from tail to head
      for (let i = snake.segments.length - 1; i >= 0; i--) {
        const seg = snake.segments[i];
        if (!seg) continue;
        const scr = toScreen(seg.x, seg.y);

        // Frustum culling
        if (scr.x < -30 || scr.x > canvas.width + 30 || scr.y < -30 || scr.y > canvas.height + 30) continue;

        const isHead = i === 0;
        const radius = isHead ? 15 : Math.max(5, 12 - (i * 0.15));

        // Color algorithm based on patterns
        let segColor = getSegmentColor(snake.skin, i);

        ctx.save();
        ctx.fillStyle = segColor;
        
        // Add subtle trail engine flame if boosting
        if (snake.isBoosting) {
          ctx.shadowColor = segColor;
          ctx.shadowBlur = 15;
        } else if (snake.skin.colors && snake.skin.colors.length > 0) {
          ctx.shadowColor = segColor;
          ctx.shadowBlur = 5;
        }

        ctx.beginPath();
        ctx.arc(scr.x, scr.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw Polka dots secondary design
        if (snake.skin.pattern === 'polka' && !isHead && radius > 7) {
          ctx.fillStyle = snake.skin.secondaryColor;
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(scr.x - 2, scr.y - 2, radius * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // Render Head detail (Eyes, accessories, nickname tag)
        if (isHead) {
          drawSnakeFaceAndAccessories(ctx, scr, snake.angle, snake.skin, snake.name);
        }
      }
    };

    // Draw other online players
    otherPlayers.current.forEach(other => drawOtherSnake(other));

    // Draw bots
    if (mode === 'offline') {
      bots.current.forEach(bot => drawOtherSnake(bot));
    }

    // 5. Draw Player Snake
    if (!isGameOver) {
      const pSnake = playerSnake.current;
      for (let i = pSnake.segments.length - 1; i >= 0; i--) {
        const seg = pSnake.segments[i];
        if (!seg) continue;
        const scr = toScreen(seg.x, seg.y);

        const isHead = i === 0;
        const radius = isHead ? 15 : Math.max(5, 12 - (i * 0.15));

        let segColor = getSegmentColor(playerSkin, i);

        ctx.save();
        ctx.fillStyle = segColor;
        
        // Glow effect during boosting
        if (pSnake.isBoosting && pSnake.score > 12) {
          ctx.shadowColor = segColor;
          ctx.shadowBlur = 18;
        } else if (playerSkin.colors && playerSkin.colors.length > 0) {
          ctx.shadowColor = segColor;
          ctx.shadowBlur = 5;
        }

        ctx.beginPath();
        ctx.arc(scr.x, scr.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Polka dot design
        if (playerSkin.pattern === 'polka' && !isHead && radius > 7) {
          ctx.fillStyle = playerSkin.secondaryColor;
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(scr.x - 2, scr.y - 2, radius * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        if (isHead) {
          drawSnakeFaceAndAccessories(ctx, scr, pSnake.angle, playerSkin, pSnake.name);
        }
      }
    }

    // 6. Update and Draw Spark Particles
    particles.current = particles.current.filter(p => {
      // Physics updates
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94; // friction damping
      p.vy *= 0.94;
      p.alpha -= p.decay;

      if (p.alpha <= 0) return false;

      const scr = toScreen(p.x, p.y);
      // Frustum culling
      if (scr.x < -20 || scr.x > canvas.width + 20 || scr.y < -20 || scr.y > canvas.height + 20) return true;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.glowing) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 2.5;
      }

      ctx.beginPath();
      ctx.arc(scr.x, scr.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Glowing core for sparkles
      if (p.glowing && p.size > 2) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      return true;
    });
  };

  // Face elements helper
  const drawSnakeFaceAndAccessories = (
    ctx: CanvasRenderingContext2D, 
    scr: { x: number; y: number }, 
    angle: number, 
    skin: SkinConfig, 
    name: string
  ) => {
    // 1. Draw Eyes & Mouth based on expression
    const expr = skin.expression || 'none';
    const hasCustomExpression = skin.expression && skin.expression !== 'none';
    
    if (hasCustomExpression) {
      const drawEye = (sideOffset: number) => {
        const eyeAngle = angle + sideOffset * Math.PI / 4.2;
        const eyeDist = 8;
        const eyeX = scr.x + Math.cos(eyeAngle) * eyeDist;
        const eyeY = scr.y + Math.sin(eyeAngle) * eyeDist;

        if (expr === 'heart_eyes') {
          ctx.save();
          ctx.translate(eyeX, eyeY);
          ctx.rotate(angle);
          drawHeart(ctx, 0, -2, 4);
          ctx.restore();
        } else if (expr === 'blinking' && sideOffset === 1) {
          // Closed eye
          ctx.save();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(eyeX, eyeY, 3.5, Math.PI, 0, false);
          ctx.stroke();
          ctx.restore();
        } else if (expr === 'happy') {
          // Happy arc eyes
          ctx.save();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(eyeX, eyeY, 3.5, Math.PI * 1.1, Math.PI * 1.9, false);
          ctx.stroke();
          ctx.restore();
        } else {
          // Base eyes for Serious / Angry
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(eyeX, eyeY, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(eyeX + Math.cos(angle) * 1.0, eyeY + Math.sin(angle) * 1.0, 2.5, 0, Math.PI * 2);
          ctx.fill();

          if (expr === 'angry') {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(eyeX - 3.5, eyeY - 3.5);
            ctx.lineTo(eyeX + 2.5, eyeY - 1);
            ctx.stroke();
          }
        }
      };

      drawEye(-1);
      drawEye(1);

      // Draw Mouth
      ctx.save();
      ctx.translate(scr.x, scr.y);
      ctx.rotate(angle);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      
      if (expr === 'happy' || expr === 'heart_eyes') {
        ctx.arc(6, 0, 4, 0, Math.PI, false);
        ctx.stroke();
      } else if (expr === 'serious') {
        ctx.moveTo(4, -3);
        ctx.lineTo(4, 3);
        ctx.stroke();
      } else if (expr === 'angry') {
        ctx.arc(8, 0, 4, Math.PI, 0, false);
        ctx.stroke();
      } else if (expr === 'blinking') {
        ctx.arc(6, -1, 3, 0, Math.PI, false);
        ctx.stroke();
        
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(6, 1, 3, 4, 1.5);
        ctx.fill();
      }
      ctx.restore();
    } else {
      // Standard fallback eyes
      const drawEye = (sideOffset: number) => {
        const eyeAngle = angle + sideOffset * Math.PI / 4.2;
        const eyeDist = 8;
        const eyeX = scr.x + Math.cos(eyeAngle) * eyeDist;
        const eyeY = scr.y + Math.sin(eyeAngle) * eyeDist;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const eyeSize = skin.eyesType === 'big' ? 5.5 : skin.eyesType === 'cute' ? 4.5 : 4;
        ctx.arc(eyeX, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(eyeX + Math.cos(angle) * 1.0, eyeY + Math.sin(angle) * 1.0, eyeSize * 0.55, 0, Math.PI * 2);
        ctx.fill();

        if (skin.eyesType === 'cute') {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(eyeX - 1.2, eyeY - 1.2, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }

        if (skin.eyesType === 'angry') {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(eyeX - 3.5, eyeY - 3.5);
          ctx.lineTo(eyeX + 2.5, eyeY - 1);
          ctx.stroke();
        }
      };

      drawEye(-1);
      drawEye(1);
    }

    // 2. Draw Head Accessories
    const acc = skin.accessory || 'none';
    const hasCustomAccessory = skin.accessory && skin.accessory !== 'none';
    
    if (hasCustomAccessory) {
      ctx.save();
      ctx.translate(scr.x, scr.y);
      ctx.rotate(angle + Math.PI / 2);
      
      if (acc === 'glasses_dark') {
        ctx.fillStyle = '#111827';
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(-6, -4, 5, 3.5, 0, 0, Math.PI*2);
        ctx.ellipse(6, -4, 5, 3.5, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-2, -5);
        ctx.lineTo(2, -5);
        ctx.stroke();
      } else if (acc === 'glasses_round') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(-6, -4, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(6, -4, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(-1, -4);
        ctx.lineTo(1, -4);
        ctx.stroke();
      } else if (acc === 'glasses_cyberpunk') {
        ctx.save();
        ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(-13, -7, 26, 6, 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (acc === 'helmet_military') {
        ctx.fillStyle = '#3f6212';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 16, Math.PI * 1.15, Math.PI * 1.85, false);
        ctx.lineTo(14, -2);
        ctx.lineTo(-14, -2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-13, -1);
        ctx.bezierCurveTo(-10, 5, -5, 10, 0, 11);
        ctx.stroke();
      } else if (acc === 'helmet_futuristic') {
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -1, 16, Math.PI * 1.1, Math.PI * 1.9, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(236, 72, 153, 0.8)';
        ctx.strokeStyle = '#f472b6';
        ctx.beginPath();
        ctx.roundRect(-8, -6, 16, 5, 2.5);
        ctx.fill();
        ctx.stroke();
      } else if (acc === 'helmet_viking') {
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 16, Math.PI * 1.15, Math.PI * 1.85, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.rect(-2.5, -16, 5, 15);
        ctx.fill();
        
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-12, -8);
        ctx.bezierCurveTo(-22, -12, -22, -24, -18, -26);
        ctx.bezierCurveTo(-14, -22, -12, -15, -10, -12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(12, -8);
        ctx.bezierCurveTo(22, -12, 22, -24, 18, -26);
        ctx.bezierCurveTo(14, -22, 12, -15, 10, -12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (acc === 'crown_royal') {
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.lineTo(-9, -15);
        ctx.lineTo(-4, -8);
        ctx.lineTo(0, -19);
        ctx.lineTo(4, -8);
        ctx.lineTo(9, -15);
        ctx.lineTo(10, -2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -19, 2, 0, Math.PI*2);
        ctx.arc(-9, -15, 1.5, 0, Math.PI*2);
        ctx.arc(9, -15, 1.5, 0, Math.PI*2);
        ctx.fill();
      } else if (acc === 'crown_neon') {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.lineTo(-8, -16);
        ctx.lineTo(-4, -10);
        ctx.lineTo(0, -21);
        ctx.lineTo(4, -10);
        ctx.lineTo(8, -16);
        ctx.lineTo(10, -4);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      } else if (acc === 'crown_thorns') {
        ctx.save();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 6;
        
        ctx.beginPath();
        ctx.ellipse(0, -7, 11, 3, 0, 0, Math.PI*2);
        ctx.stroke();
        
        const drawThorn = (x: number, y: number, tx: number, ty: number) => {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        };
        
        drawThorn(-9, -7, -13, -13);
        drawThorn(-4, -6, -5, -14);
        drawThorn(0, -8, 0, -16);
        drawThorn(4, -6, 5, -14);
        drawThorn(9, -7, 13, -13);
        ctx.restore();
      } else if (acc === 'hat_top') {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.ellipse(0, -5, 15, 4, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.roundRect(-8, -21, 16, 16, [2, 2, 0, 0]);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.rect(-8, -8, 16, 3);
        ctx.fill();
      } else if (acc === 'hat_wizard') {
        ctx.fillStyle = '#1e3a8a';
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.ellipse(0, -4, 16, 4, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.lineTo(0, -25);
        ctx.lineTo(10, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(-2, -9, 1.5, 0, Math.PI*2);
        ctx.arc(3, -14, 1.2, 0, Math.PI*2);
        ctx.arc(-1, -19, 1, 0, Math.PI*2);
        ctx.fill();
      } else if (acc === 'hat_cap') {
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.arc(0, -4, 11, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#111827';
        ctx.strokeStyle = '#111827';
        ctx.beginPath();
        ctx.roundRect(-15, -6, 6, 2.5, 1);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -4, 5, Math.PI * 1.1, Math.PI * 1.9, false);
        ctx.fill();
      }
      
      ctx.restore();
    } else {
      // Fallback headStyle
      if (skin.headStyle === 'glasses') {
        ctx.fillStyle = 'rgba(5, 5, 5, 0.95)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        const drawGlass = (sideOffset: number) => {
          const eyeAngle = angle + sideOffset * Math.PI / 4.2;
          const eyeDist = 8;
          const eyeX = scr.x + Math.cos(eyeAngle) * eyeDist;
          const eyeY = scr.y + Math.sin(eyeAngle) * eyeDist;

          ctx.beginPath();
          ctx.arc(eyeX, eyeY, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        };

        drawGlass(-1);
        drawGlass(1);

        ctx.beginPath();
        ctx.moveTo(scr.x + Math.cos(angle - Math.PI/2)*3, scr.y + Math.sin(angle - Math.PI/2)*3);
        ctx.lineTo(scr.x + Math.cos(angle + Math.PI/2)*3, scr.y + Math.sin(angle + Math.PI/2)*3);
        ctx.stroke();
      } else if (skin.headStyle === 'crown') {
        ctx.save();
        ctx.translate(scr.x, scr.y);
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.moveTo(-9, -2);
        ctx.lineTo(-8, -13);
        ctx.lineTo(-3, -7);
        ctx.lineTo(0, -17);
        ctx.lineTo(3, -7);
        ctx.lineTo(8, -13);
        ctx.lineTo(9, -2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -17, 1.8, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      } else if (skin.headStyle === 'headphones') {
        ctx.save();
        ctx.translate(scr.x, scr.y);
        ctx.rotate(angle + Math.PI / 2);
        
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 16, Math.PI, 0, false);
        ctx.stroke();

        ctx.fillStyle = '#111827';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.rect(-17, -4, 4, 9);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(13, -4, 4, 9);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      } else if (skin.headStyle === 'halo') {
        ctx.save();
        ctx.translate(scr.x - Math.cos(angle)*10, scr.y - Math.sin(angle)*10);
        ctx.strokeStyle = 'rgba(251, 227, 0, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 5;

        ctx.beginPath();
        ctx.ellipse(0, -8, 10, 3.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. Draw Username Tag Text above head
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.font = 'bold 11px font-sans, sans-serif';
    
    const textWidth = ctx.measureText(name).width;
    const paddingX = 8;
    const paddingY = 4;
    const tagX = scr.x - textWidth / 2;
    const tagY = scr.y - 28;

    ctx.beginPath();
    ctx.roundRect(tagX - paddingX, tagY - 11, textWidth + paddingX * 2, 16 + paddingY, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText(name, scr.x, tagY + 4);
    ctx.restore();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      mousePos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  // Convert mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-screen bg-slate-950 overflow-hidden relative select-none"
      onMouseMove={handleMouseMove}
    >
      {/* HUD: Left Controls and Back Button */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-3">
        <button
          onClick={() => {
            setBoosting(false);
            audioEngine.playClick();
            onExit();
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white rounded-2xl transition-all cursor-pointer text-sm font-sans font-medium backdrop-blur-md shadow-lg"
        >
          <ArrowLeft size={16} />
          <span>Voltar ao Menu</span>
        </button>

        <button
          onClick={handleToggleMute}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white rounded-2xl transition-all cursor-pointer text-sm font-sans font-medium backdrop-blur-md shadow-lg"
          title={muted ? "Ativar som" : "Desativar som"}
        >
          {muted ? <VolumeX size={16} className="text-rose-400" /> : <Volume2 size={16} className="text-cyan-400" />}
          <span>{muted ? "Mudo" : "Som Ativo"}</span>
        </button>

        {/* Sync or Error Notification */}
        {connectionError && (
          <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs font-sans max-w-xs backdrop-blur-md shadow-lg animate-pulse">
            {connectionError}
          </div>
        )}
      </div>

      {/* HUD: Right Leaderboard Panel */}
      <div className="absolute top-4 right-4 z-20 w-60 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 text-xs font-sans text-slate-300 backdrop-blur-md shadow-lg">
        <h3 className="font-bold border-b border-slate-800 pb-1.5 flex items-center justify-between text-slate-100 uppercase tracking-wide">
          <span className="flex items-center gap-1.5">
            <Trophy size={14} className="text-yellow-400" /> Placar da Sala
          </span>
          {mode === 'online' && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
              <Users size={10} /> {onlinePlayersCount}
            </span>
          )}
        </h3>

        <div className="space-y-1.5 mt-2.5 max-h-[220px] overflow-y-auto">
          {sessionLeaderboard.map((entry, idx) => (
            <div
              key={`hud-ld-${idx}-${entry.name}`}
              className={`flex items-center justify-between py-1 px-2 rounded-lg ${
                entry.isPlayer 
                  ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-bold' 
                  : 'bg-slate-950/40 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                <span className="font-mono font-bold">#{idx + 1}</span>
                <span className="truncate">{entry.name}</span>
              </div>
              <span className="font-mono font-bold">{entry.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* HUD: Bottom Left Player Metrics Overlay */}
      <div className="absolute bottom-4 left-4 z-20 flex gap-4 font-mono">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-1 backdrop-blur-md shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Sua Pontuação</span>
          <span className="text-2xl font-bold font-sans text-emerald-400 leading-none">{score.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 font-sans">
            Comprimento: <b className="text-white font-mono">{Math.floor(score / 12) + 12}</b>
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-1 backdrop-blur-md shadow-lg justify-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Tempo Vivo</span>
          <span className="text-lg font-bold text-slate-200 leading-none">{formatTime(survivalTime)}</span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 font-sans">
            Eliminações: <b className="text-white font-mono">{kills}</b>
          </span>
        </div>

        {mode === 'online' && (
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-center backdrop-blur-md shadow-lg text-[10px]">
            <span className="text-slate-500 uppercase tracking-widest">Ping</span>
            <span className={`text-base font-bold leading-none mt-1 ${ping < 80 ? 'text-emerald-400' : ping < 180 ? 'text-amber-400' : 'text-red-400'}`}>
              {ping}ms
            </span>
          </div>
        )}
      </div>

      {/* HUD: Bottom Right Mini-map */}
      <div className="absolute bottom-4 right-4 z-20 bg-slate-900/85 border border-slate-800/80 rounded-2xl p-3 flex flex-col items-center backdrop-blur-md shadow-lg">
        <div className="relative w-28 h-28 rounded-full bg-slate-950 border border-slate-850 overflow-hidden flex items-center justify-center">
          {/* Circular Arena Boundary Representation */}
          <div className="absolute w-[100px] h-[100px] rounded-full border border-dashed border-emerald-500/25" />
          
          {/* Player coordinate representation */}
          <div 
            className="absolute w-2 h-2 bg-emerald-400 rounded-full border border-white animate-pulse"
            style={{
              left: `${56 + (playerSnake.current.segments[0]?.x || 0) / ARENA_RADIUS * 50 - 4}px`,
              top: `${56 + (playerSnake.current.segments[0]?.y || 0) / ARENA_RADIUS * 50 - 4}px`,
            }}
          />

          {/* Bots coordinate points */}
          {mode === 'offline' && bots.current.map(b => (
            <div 
              key={`mini-bot-${b.id}`}
              className="absolute w-1 h-1 bg-rose-500 rounded-full"
              style={{
                left: `${56 + (b.segments[0]?.x || 0) / ARENA_RADIUS * 50 - 2}px`,
                top: `${56 + (b.segments[0]?.y || 0) / ARENA_RADIUS * 50 - 2}px`,
              }}
            />
          ))}

          {/* Other players points */}
          {(Array.from(otherPlayers.current.values()) as SnakeData[]).map(p => (
            <div 
              key={`mini-other-${p.id}`}
              className="absolute w-1 h-1 bg-amber-500 rounded-full"
              style={{
                left: `${56 + (p.segments[0]?.x || 0) / ARENA_RADIUS * 50 - 2}px`,
                top: `${56 + (p.segments[0]?.y || 0) / ARENA_RADIUS * 50 - 2}px`,
              }}
            />
          ))}
        </div>
        <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase mt-1.5 flex items-center gap-1">
          <Compass size={10} /> Radar de Arena
        </span>
      </div>

      {/* HTML5 Canvas Render target */}
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block bg-slate-950 cursor-crosshair"
      />

      {/* LostPane Overlay (Game Over Modal) */}
      {isGameOver && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-30 flex items-center justify-center p-4 animate-fade-in">
          <div 
            id="lost-pane" 
            className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-[40px] p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.8)] space-y-6 animate-scale-up"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-mono tracking-[0.2em] text-red-500 uppercase font-bold">Fim de Jogo</span>
              <h2 className="text-3xl font-black font-sans text-white tracking-tight">Sua Cobra Explodiu!</h2>
            </div>

            <div className="bg-black/60 border border-white/10 p-5 rounded-[24px] space-y-4 shadow-inner">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center border-r border-white/10 py-1">
                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block mb-0.5">Pontuação</span>
                  <span className="text-2xl font-black font-sans text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.2)]">{score.toLocaleString()}</span>
                </div>
                <div className="text-center py-1">
                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block mb-0.5">Sobrevivência</span>
                  <span className="text-xl font-bold text-gray-100">{formatTime(survivalTime)}</span>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 flex justify-between items-center px-4 text-xs font-mono">
                <span className="text-gray-500">Comprimento Final:</span>
                <span className="text-gray-300 font-bold">{Math.floor(score / 12) + 12}m</span>
              </div>

              <div className="flex justify-between items-center px-4 text-xs font-mono">
                <span className="text-gray-500">Eliminações / Kills:</span>
                <span className="text-gray-300 font-bold">{kills}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={restartGame}
                className="py-4 px-6 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white rounded-full font-black text-xs tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:shadow-[0_0_30px_rgba(8,145,178,0.6)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw size={18} className="animate-spin-slow" />
                <span>Jogar Novamente</span>
              </button>

              <button
                onClick={() => {
                  audioEngine.playClick();
                  onExit();
                }}
                className="py-3 px-6 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-full font-sans font-semibold text-xs tracking-wider uppercase transition-all cursor-pointer"
              >
                Voltar ao Menu Principal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
