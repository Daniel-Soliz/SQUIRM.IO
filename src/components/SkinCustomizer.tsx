/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { SkinConfig } from '../types';
import { 
  Palette, 
  Sparkles, 
  Smile, 
  Crown, 
  X, 
  Plus, 
  Trash2, 
  Shuffle, 
  Save, 
  Star, 
  Check, 
  Layers, 
  Maximize2,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { audioEngine } from './AudioEngine';

interface SkinCustomizerProps {
  currentSkin: SkinConfig;
  onSave: (skin: SkinConfig) => void;
  onClose: () => void;
}

interface FavoriteSkin {
  id: string;
  name: string;
  colors: string[];
  accessory: string;
  expression: string;
}

const HARMONIOUS_COLORS = [
  '#00ff88', // neon green
  '#00e1ff', // bright cyan
  '#0084ff', // sky blue
  '#a855f7', // violet/purple
  '#ff007f', // neon pink
  '#ef4444', // crimson red
  '#f97316', // neon orange
  '#eab308', // yellow gold
  '#ffffff', // crisp white
  '#3b82f6', // blue
];

const ACCESSORIES = [
  { id: 'none', label: 'Nenhum', desc: 'Sem acessório', category: 'Nenhum' },
  // Óculos
  { id: 'glasses_dark', label: 'Óculos Escuro', desc: 'Estilo clássico badass', category: 'Óculos' },
  { id: 'glasses_round', label: 'Óculos Redondo', desc: 'Aparência intelectual', category: 'Óculos' },
  { id: 'glasses_cyberpunk', label: 'Visor Cyberpunk', desc: 'Tecnologia neon pura', category: 'Óculos' },
  // Capacetes
  { id: 'helmet_military', label: 'C. Militar', desc: 'Capacete de combate tático', category: 'Capacetes' },
  { id: 'helmet_futuristic', label: 'C. Futurista', desc: 'Vanguardista com visor rosa', category: 'Capacetes' },
  { id: 'helmet_viking', label: 'C. Viking', desc: 'Chifres de batalha nórdicos', category: 'Capacetes' },
  // Coroas
  { id: 'crown_royal', label: 'Coroa Real', desc: 'Ouro maciço com rubis', category: 'Coroas' },
  { id: 'crown_neon', label: 'Coroa Neon', desc: 'Chamas elétricas azuis', category: 'Coroas' },
  { id: 'crown_thorns', label: 'C. Espinhos', desc: 'Aura obscura e sombria', category: 'Coroas' },
  // Chapéus
  { id: 'hat_top', label: 'Cartola', desc: 'Elegância vitoriana', category: 'Chapéus' },
  { id: 'hat_wizard', label: 'Chapéu Mago', desc: 'Estrelas e feitiçaria antiga', category: 'Chapéus' },
  { id: 'hat_cap', label: 'Boné de Aba', desc: 'Boné de baseball clássico', category: 'Chapéus' },
];

const EXPRESSIONS = [
  { id: 'none', label: 'Padrão', emoji: '👀', desc: 'Olhar comum da serpente' },
  { id: 'happy', label: 'Feliz', emoji: '😊', desc: 'Olhos alegres e sorridente' },
  { id: 'serious', label: 'Sério', emoji: '😐', desc: 'Expressão focada e neutra' },
  { id: 'angry', label: 'Zangado', emoji: '😡', desc: 'Olhar de fúria e sobrancelhas' },
  { id: 'blinking', label: 'Piscando', emoji: '😉', desc: 'Piscadinha sapeca com língua' },
  { id: 'heart_eyes', label: 'Corações', emoji: '😍', desc: 'Corações apaixonantes brilhantes' },
];

export default function SkinCustomizer({ currentSkin, onSave, onClose }: SkinCustomizerProps) {
  const [colors, setColors] = useState<string[]>(
    currentSkin.colors && currentSkin.colors.length > 0 
      ? [...currentSkin.colors] 
      : [currentSkin.primaryColor, currentSkin.secondaryColor || '#00ffff']
  );
  const [activeBlockIndex, setActiveBlockIndex] = useState<number>(0);
  const [accessory, setAccessory] = useState<string>(currentSkin.accessory || 'none');
  const [expression, setExpression] = useState<string>(currentSkin.expression || 'none');
  
  // Favorites system
  const [favorites, setFavorites] = useState<FavoriteSkin[]>([]);
  const [favNameInput, setFavNameInput] = useState<string>('');
  const [showSaveFavDialog, setShowSaveFavDialog] = useState<boolean>(false);
  
  // Customization Tabs
  const [activeTab, setActiveTab] = useState<'colors' | 'accessories' | 'expressions'>('colors');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const wigglePhase = useRef<number>(0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Load favorites on mount
  useEffect(() => {
    const saved = localStorage.getItem('slither_favorite_skins');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Helper to draw heart
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

  // Preview snake rendering loop in customizer modal
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let active = true;

    const render = () => {
      if (!active) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw grid texture
      ctx.strokeStyle = '#161a24';
      ctx.lineWidth = 1;
      const gridSize = 15;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Dynamic particle grid background decoration
      ctx.fillStyle = 'rgba(6, 182, 212, 0.03)';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 80, 0, Math.PI * 2);
      ctx.fill();

      // Update phase
      wigglePhase.current += 0.08;

      // Draw wiggle snake
      const segments: { x: number; y: number }[] = [];
      const numSegments = 14;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 + 10;
      const segmentSpacing = 11;

      for (let i = 0; i < numSegments; i++) {
        const factor = i / numSegments;
        const offset = Math.sin(wigglePhase.current - i * 0.4) * 16 * (1 - factor * 0.3);
        const x = centerX - i * segmentSpacing + 10;
        const y = centerY + offset;
        segments.push({ x, y });
      }

      // Draw segments (tail to head)
      for (let i = numSegments - 1; i >= 0; i--) {
        const seg = segments[i];
        const isHead = i === 0;

        // Resolve Segment Color based on custom blocks colors
        const segColor = colors[i % colors.length] || '#00ff88';

        ctx.save();
        ctx.fillStyle = segColor;
        
        // Subtle glow effect
        ctx.shadowColor = segColor;
        ctx.shadowBlur = isHead ? 8 : 4;

        ctx.beginPath();
        const radius = isHead ? 15 : Math.max(4, 12 - i * 0.45);
        ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw face features on head
        if (isHead) {
          const headAngle = Math.atan2(segments[0].y - segments[1].y, segments[0].x - segments[1].x);
          
          // Draw expression / eyes
          if (expression !== 'none') {
            const drawEye = (sideOffset: number) => {
              const eyeAngle = headAngle + sideOffset * Math.PI / 4.2;
              const eyeDist = 8;
              const eyeX = seg.x + Math.cos(eyeAngle) * eyeDist;
              const eyeY = seg.y + Math.sin(eyeAngle) * eyeDist;

              if (expression === 'heart_eyes') {
                ctx.save();
                ctx.translate(eyeX, eyeY);
                ctx.rotate(headAngle);
                drawHeart(ctx, 0, -2, 4.5);
                ctx.restore();
              } else if (expression === 'blinking' && sideOffset === 1) {
                // Closed eye
                ctx.save();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(eyeX, eyeY, 3.5, Math.PI, 0, false);
                ctx.stroke();
                ctx.restore();
              } else if (expression === 'happy') {
                ctx.save();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(eyeX, eyeY, 3.5, Math.PI * 1.1, Math.PI * 1.9, false);
                ctx.stroke();
                ctx.restore();
              } else {
                // Base eye for Serious/Angry
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(eyeX, eyeY, 4.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(eyeX + Math.cos(headAngle) * 1.0, eyeY + Math.sin(headAngle) * 1.0, 2.5, 0, Math.PI * 2);
                ctx.fill();

                if (expression === 'angry') {
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

            // Mouth
            ctx.save();
            ctx.translate(seg.x, seg.y);
            ctx.rotate(headAngle);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            
            if (expression === 'happy' || expression === 'heart_eyes') {
              ctx.arc(6, 0, 4, 0, Math.PI, false);
              ctx.stroke();
            } else if (expression === 'serious') {
              ctx.moveTo(4, -3);
              ctx.lineTo(4, 3);
              ctx.stroke();
            } else if (expression === 'angry') {
              ctx.arc(8, 0, 4, Math.PI, 0, false);
              ctx.stroke();
            } else if (expression === 'blinking') {
              ctx.arc(6, -1, 3, 0, Math.PI, false);
              ctx.stroke();
              
              ctx.fillStyle = '#ef4444';
              ctx.beginPath();
              ctx.roundRect(6, 1, 3, 4, 1.5);
              ctx.fill();
            }
            ctx.restore();
          } else {
            // Fallback standard eyes
            const drawEye = (sideOffset: number) => {
              const eyeAngle = headAngle + sideOffset * Math.PI / 4.2;
              const eyeDist = 8;
              const eyeX = seg.x + Math.cos(eyeAngle) * eyeDist;
              const eyeY = seg.y + Math.sin(eyeAngle) * eyeDist;

              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(eyeX, eyeY, 4.5, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = '#000000';
              ctx.beginPath();
              ctx.arc(eyeX + Math.cos(headAngle) * 1.2, eyeY + Math.sin(headAngle) * 1.2, 2.5, 0, Math.PI * 2);
              ctx.fill();
            };

            drawEye(-1);
            drawEye(1);
          }

          // Draw head accessory
          if (accessory !== 'none') {
            ctx.save();
            ctx.translate(seg.x, seg.y);
            ctx.rotate(headAngle + Math.PI / 2);

            if (accessory === 'glasses_dark') {
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
            } else if (accessory === 'glasses_round') {
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
            } else if (accessory === 'glasses_cyberpunk') {
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
            } else if (accessory === 'helmet_military') {
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
            } else if (accessory === 'helmet_futuristic') {
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
            } else if (accessory === 'helmet_viking') {
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
            } else if (accessory === 'crown_royal') {
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
            } else if (accessory === 'crown_neon') {
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
            } else if (accessory === 'crown_thorns') {
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
            } else if (accessory === 'hat_top') {
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
            } else if (accessory === 'hat_wizard') {
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
            } else if (accessory === 'hat_cap') {
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
          }
        }
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      active = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [colors, accessory, expression]);

  // Color selection for active block
  const handleColorChange = (hex: string) => {
    const updated = [...colors];
    updated[activeBlockIndex] = hex;
    setColors(updated);
  };

  // Add block
  const addBlock = () => {
    if (colors.length >= 10) return;
    audioEngine.playClick();
    const newColor = HARMONIOUS_COLORS[colors.length % HARMONIOUS_COLORS.length];
    const updated = [...colors, newColor];
    setColors(updated);
    setActiveBlockIndex(updated.length - 1);
  };

  // Remove block
  const removeBlock = (index: number) => {
    if (colors.length <= 1) return; // Must keep at least 1 color
    audioEngine.playClick();
    const updated = colors.filter((_, idx) => idx !== index);
    setColors(updated);
    // Adjust active index
    if (activeBlockIndex >= updated.length) {
      setActiveBlockIndex(updated.length - 1);
    }
  };

  // Reordering controls (move left/right)
  const moveBlock = (index: number, direction: 'left' | 'right') => {
    audioEngine.playClick();
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= colors.length) return;
    
    const updated = [...colors];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    
    setColors(updated);
    setActiveBlockIndex(targetIdx);
  };

  // HTML5 Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const updated = [...colors];
    const draggedItem = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setColors(updated);
    setActiveBlockIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    audioEngine.playClick();
  };

  // Generate Harmonious Random combination
  const handleRandomize = () => {
    audioEngine.playClick();
    
    // 1. Random block count (between 3 and 7)
    const count = Math.floor(Math.random() * 5) + 3;
    
    // 2. Select beautiful random colors (ensure diversity)
    const shuffledColors = [...HARMONIOUS_COLORS].sort(() => 0.5 - Math.random());
    const randomColors = shuffledColors.slice(0, count);
    
    // 3. Random accessory (80% chance of something, 20% none)
    const usableAccessories = ACCESSORIES.map(a => a.id);
    const randomAcc = Math.random() < 0.2 
      ? 'none' 
      : usableAccessories[Math.floor(Math.random() * (usableAccessories.length - 1)) + 1];
    
    // 4. Random expression
    const randomExpr = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)].id;

    setColors(randomColors);
    setActiveBlockIndex(0);
    setAccessory(randomAcc);
    setExpression(randomExpr);
  };

  // Save Current Combination to Favorites
  const handleSaveFavorite = () => {
    if (!favNameInput.trim()) return;
    audioEngine.playClick();
    
    const newFav: FavoriteSkin = {
      id: Date.now().toString(),
      name: favNameInput.trim(),
      colors: [...colors],
      accessory,
      expression,
    };
    
    const updated = [newFav, ...favorites].slice(0, 8); // Keep max 8 favorites
    setFavorites(updated);
    localStorage.setItem('slither_favorite_skins', JSON.stringify(updated));
    setFavNameInput('');
    setShowSaveFavDialog(false);
  };

  // Delete Favorite
  const handleDeleteFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    audioEngine.playClick();
    const updated = favorites.filter(f => f.id !== id);
    setFavorites(updated);
    localStorage.setItem('slither_favorite_skins', JSON.stringify(updated));
  };

  // Load Favorite Look
  const handleLoadFavorite = (fav: FavoriteSkin) => {
    audioEngine.playClick();
    setColors([...fav.colors]);
    setAccessory(fav.accessory);
    setExpression(fav.expression);
    setActiveBlockIndex(0);
  };

  // Apply Changes
  const handleApply = () => {
    audioEngine.playClick();
    onSave({
      primaryColor: colors[0],
      secondaryColor: colors[1] || colors[0],
      pattern: 'custom_blocks',
      headStyle: accessory === 'none' ? 'none' : 'glasses', // for backward compat mapping
      eyesType: expression === 'none' ? 'normal' : 'cute', // for backward compat mapping
      colors: [...colors],
      accessory,
      expression,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div 
        id="skin-modal" 
        className="bg-[#0b0f15]/95 border border-white/10 text-white rounded-[32px] w-full max-w-5xl shadow-[0_0_80px_rgba(0,0,0,0.85)] flex flex-col lg:flex-row overflow-hidden max-h-[92vh] sm:max-h-[90vh]"
      >
        {/* Left Panel: High Fidelity Real-time Live Preview & Favorites */}
        <div className="w-full lg:w-5/12 bg-white/[0.02] p-5 sm:p-6 flex flex-col items-center justify-between border-b lg:border-b-0 lg:border-r border-white/5 relative shrink-0">
          
          <button 
            onClick={onClose}
            className="absolute top-4 left-4 lg:hidden text-slate-400 hover:text-white bg-white/10 hover:bg-white/15 p-2 rounded-full transition-all cursor-pointer"
          >
            <X size={16} />
          </button>

          <div className="flex flex-col items-center w-full">
            <span className="text-[9px] font-mono tracking-[0.3em] text-cyan-400 uppercase mb-1">Visualizador em Loop</span>
            <h2 className="text-lg font-black tracking-tight mb-4 flex items-center gap-1.5 text-slate-100">
              <Layers size={16} className="text-cyan-400" /> Seu Look Atual
            </h2>

            {/* Neon glowing viewport capsule */}
            <div className="relative rounded-3xl border border-white/10 bg-slate-950 p-2 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)]">
              <canvas 
                ref={canvasRef} 
                width={250} 
                height={230} 
                className="rounded-2xl block bg-slate-950/50"
                title="Sua serpente em movimento"
              />
              
              {/* Floating detail tag */}
              <div className="absolute bottom-4 right-4 bg-black/60 border border-white/5 px-2.5 py-1 rounded-full text-[9px] font-mono text-gray-400 tracking-wide">
                Wiggle: Ativo
              </div>
            </div>
          </div>

          {/* Favorites/Favoritos Section */}
          <div className="w-full mt-6 flex-1 flex flex-col justify-end">
            <div className="border-t border-white/5 pt-4 w-full">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase flex items-center gap-1.5">
                  <Star size={11} className="text-yellow-400 fill-yellow-400" /> Meus Visuais Saved ({favorites.length})
                </span>
                {favorites.length < 8 && !showSaveFavDialog && (
                  <button 
                    onClick={() => setShowSaveFavDialog(true)}
                    className="text-[10px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer"
                  >
                    Salvar Atual
                  </button>
                )}
              </div>

              {/* Save Dialog Popup overlay */}
              {showSaveFavDialog && (
                <div className="bg-slate-900/90 border border-cyan-500/30 p-3 rounded-2xl mb-3 flex flex-col gap-2">
                  <span className="text-[10px] text-gray-400">Dê um nome para este look:</span>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Ex: Curva Suprema, Cyber Neon..."
                      value={favNameInput}
                      onChange={(e) => setFavNameInput(e.target.value)}
                      maxLength={18}
                      className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                    <button 
                      onClick={handleSaveFavorite}
                      disabled={!favNameInput.trim()}
                      className="bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-black font-bold px-3 py-1 rounded-lg text-xs cursor-pointer"
                    >
                      Salvar
                    </button>
                    <button 
                      onClick={() => setShowSaveFavDialog(false)}
                      className="bg-white/5 hover:bg-white/10 text-gray-400 px-2 py-1 rounded-lg text-xs cursor-pointer"
                    >
                      X
                    </button>
                  </div>
                </div>
              )}

              {favorites.length === 0 ? (
                <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 text-center text-xs text-slate-500 leading-snug">
                  Nenhum visual salvo ainda. Crie combinações e clique em "Salvar Atual" para guardá-las!
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[110px] overflow-y-auto pr-1">
                  {favorites.map(fav => (
                    <div
                      key={fav.id}
                      onClick={() => handleLoadFavorite(fav)}
                      className="group flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all cursor-pointer text-left text-xs"
                    >
                      <div className="flex items-center gap-2 truncate pr-1">
                        {/* Mini dots pattern */}
                        <div className="flex -space-x-1">
                          {fav.colors.slice(0, 3).map((c, idx) => (
                            <div 
                              key={`${fav.id}-${idx}`} 
                              style={{ backgroundColor: c }} 
                              className="w-2.5 h-2.5 rounded-full border border-black"
                            />
                          ))}
                        </div>
                        <span className="font-medium text-slate-300 truncate">{fav.name}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteFavorite(e, fav.id)}
                        className="text-gray-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-all"
                        title="Deletar look"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Tab-based robust editors */}
        <div className="w-full lg:w-7/12 p-5 sm:p-6 md:p-8 flex flex-col justify-between overflow-y-auto min-h-0 max-h-[50vh] sm:max-h-[55vh] lg:max-h-[92vh]">
          
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 text-slate-100">
              <Sparkles className="text-cyan-400 w-5 h-5 animate-pulse" /> Customizar Serpente
            </h1>
            <button 
              onClick={onClose}
              className="hidden lg:block text-slate-400 hover:text-white bg-white/10 hover:bg-white/15 p-2 rounded-full transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Nav Categories Selector */}
          <div className="flex border-b border-white/5 mb-6 gap-2 sm:gap-4 overflow-x-auto pb-1 shrink-0">
            <button
              onClick={() => { audioEngine.playClick(); setActiveTab('colors'); }}
              className={`pb-3 px-1 text-xs sm:text-sm font-bold tracking-wider uppercase transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'colors' 
                  ? 'border-cyan-400 text-cyan-400' 
                  : 'border-transparent text-gray-500 hover:text-slate-300'
              }`}
            >
              <Palette size={14} /> Padrão por Blocos
            </button>
            <button
              onClick={() => { audioEngine.playClick(); setActiveTab('accessories'); }}
              className={`pb-3 px-1 text-xs sm:text-sm font-bold tracking-wider uppercase transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'accessories' 
                  ? 'border-cyan-400 text-cyan-400' 
                  : 'border-transparent text-gray-500 hover:text-slate-300'
              }`}
            >
              <Crown size={14} /> Acessórios
            </button>
            <button
              onClick={() => { audioEngine.playClick(); setActiveTab('expressions'); }}
              className={`pb-3 px-1 text-xs sm:text-sm font-bold tracking-wider uppercase transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'expressions' 
                  ? 'border-cyan-400 text-cyan-400' 
                  : 'border-transparent text-gray-500 hover:text-slate-300'
              }`}
            >
              <Smile size={14} /> Expressões
            </button>
          </div>

          {/* Content panel */}
          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            {activeTab === 'colors' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[9px] font-mono tracking-[0.25em] text-cyan-400 uppercase">
                      Sequência de Cores ({colors.length}/10 blocos)
                    </label>
                    <span className="text-[9px] text-gray-500 flex items-center gap-1">
                      <ArrowLeftRight size={10} /> Arraste para reordenar
                    </span>
                  </div>

                  {/* Drag-and-drop / clickable block sequence editor */}
                  <div className="flex flex-wrap items-center gap-2 bg-slate-950/60 p-4 border border-white/5 rounded-2xl min-h-[80px]">
                    {colors.map((color, idx) => {
                      const isActive = idx === activeBlockIndex;
                      return (
                        <div
                          key={`block-${idx}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          onClick={() => { audioEngine.playClick(); setActiveBlockIndex(idx); }}
                          style={{ backgroundColor: color }}
                          className={`w-11 h-14 rounded-xl border-2 cursor-grab active:cursor-grabbing relative flex flex-col items-center justify-between py-1 transition-all group shrink-0 ${
                            isActive 
                              ? 'border-white scale-105 shadow-lg shadow-white/10 ring-2 ring-cyan-500/50' 
                              : 'border-transparent opacity-85 hover:opacity-100 hover:scale-102'
                          }`}
                        >
                          {/* Order index Badge */}
                          <span className="text-[8px] font-mono text-black font-extrabold bg-white/80 px-1 rounded">
                            {idx + 1}
                          </span>

                          {/* Quick action: Arrow Left / Right for Accessibility */}
                          <div className="absolute inset-x-0 bottom-1 flex justify-between px-0.5 opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                            {idx > 0 && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); moveBlock(idx, 'left'); }}
                                className="w-3.5 h-3.5 rounded bg-black/80 text-white flex items-center justify-center cursor-pointer pointer-events-auto hover:bg-cyan-500 hover:text-black"
                              >
                                <ChevronLeft size={10} />
                              </button>
                            )}
                            {idx < colors.length - 1 && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); moveBlock(idx, 'right'); }}
                                className="w-3.5 h-3.5 rounded bg-black/80 text-white flex items-center justify-center cursor-pointer pointer-events-auto hover:bg-cyan-500 hover:text-black"
                              >
                                <ChevronRight size={10} />
                              </button>
                            )}
                          </div>

                          {/* Hover Delete Button */}
                          {colors.length > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeBlock(idx); }}
                              className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:scale-110 transition-all cursor-pointer pointer-events-auto shadow-md"
                              title="Remover cor"
                            >
                              <X size={8} strokeWidth={4} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Plus Button to add color */}
                    {colors.length < 10 && (
                      <button
                        onClick={addBlock}
                        className="w-11 h-14 border border-dashed border-white/20 hover:border-cyan-400 bg-white/5 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 rounded-xl transition-all cursor-pointer flex items-center justify-center group"
                        title="Adicionar Bloco de Cor"
                      >
                        <Plus size={18} className="group-hover:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Color picking block details */}
                <div className="bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-slate-300">
                      Editando Bloco #{activeBlockIndex + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div 
                        style={{ backgroundColor: colors[activeBlockIndex] }} 
                        className="w-4 h-4 rounded-full border border-black"
                      />
                      <span className="text-xs font-mono text-gray-400 uppercase">
                        {colors[activeBlockIndex]}
                      </span>
                    </div>
                  </div>

                  {/* Standard PRESET SWATCHES */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase">Paleta de Amostras</span>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {HARMONIOUS_COLORS.map(color => (
                        <button
                          key={`swatch-${color}`}
                          onClick={() => { audioEngine.playClick(); handleColorChange(color); }}
                          style={{ backgroundColor: color }}
                          className={`h-7 rounded-lg border transition-all cursor-pointer ${
                            colors[activeBlockIndex]?.toLowerCase() === color.toLowerCase()
                              ? 'border-white scale-110 shadow-md'
                              : 'border-transparent hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* ADVANCED CUSTOM PICKERS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-3 bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                      <span className="text-xs text-gray-400">Roda de Cores:</span>
                      <input
                        type="color"
                        value={colors[activeBlockIndex] || '#00ff88'}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="w-12 h-8 rounded cursor-pointer border-0 bg-transparent block"
                      />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                      <span className="text-xs text-gray-400">Hex:</span>
                      <input
                        type="text"
                        value={(colors[activeBlockIndex] || '#00FF88').toUpperCase()}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith('#') && val.length <= 7) {
                            handleColorChange(val);
                          } else if (!val.startsWith('#') && val.length <= 6) {
                            handleColorChange('#' + val);
                          }
                        }}
                        maxLength={7}
                        placeholder="#00FF88"
                        className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'accessories' && (
              <div className="space-y-6 animate-fade-in">
                {/* Categorized accessory selector */}
                {['Óculos', 'Capacetes', 'Coroas', 'Chapéus', 'Nenhum'].map(category => {
                  const filtered = ACCESSORIES.filter(a => a.category === category);
                  if (filtered.length === 0) return null;
                  return (
                    <div key={`cat-${category}`} className="space-y-2.5">
                      <h3 className="text-[10px] font-mono tracking-[0.25em] text-cyan-400 uppercase border-b border-white/5 pb-1 select-none">
                        {category}
                      </h3>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {filtered.map(acc => {
                          const isEquipped = accessory === acc.id;
                          return (
                            <button
                              key={`acc-${acc.id}`}
                              onClick={() => { audioEngine.playClick(); setAccessory(acc.id); }}
                              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer group flex flex-col justify-between h-[85px] ${
                                isEquipped 
                                  ? 'bg-cyan-500/10 border-cyan-400 shadow-md text-cyan-200' 
                                  : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/15 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex justify-between items-start w-full">
                                <span className={`text-xs font-bold ${isEquipped ? 'text-cyan-200' : 'text-slate-300'}`}>
                                  {acc.label}
                                </span>
                                {isEquipped && (
                                  <div className="bg-cyan-500 text-black rounded-full p-0.5">
                                    <Check size={8} strokeWidth={4} />
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-500 group-hover:text-gray-400 line-clamp-2 leading-tight">
                                {acc.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'expressions' && (
              <div className="space-y-3 animate-fade-in">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {EXPRESSIONS.map(expr => {
                    const isSelected = expression === expr.id;
                    return (
                      <button
                        key={`expr-${expr.id}`}
                        onClick={() => { audioEngine.playClick(); setExpression(expr.id); }}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 h-[80px] ${
                          isSelected 
                            ? 'bg-cyan-500/10 border-cyan-400 shadow-md text-cyan-200' 
                            : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/15 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-3xl select-none">{expr.emoji}</span>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex justify-between items-center">
                            <span className={`text-xs font-bold ${isSelected ? 'text-cyan-200' : 'text-slate-300'} truncate`}>
                              {expr.label}
                            </span>
                            {isSelected && (
                              <div className="bg-cyan-500 text-black rounded-full p-0.5 shrink-0">
                                <Check size={8} strokeWidth={4} />
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500 truncate mt-0.5">
                            {expr.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Row Controls */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-white/5 mt-6 shrink-0">
            {/* Left helper utility buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleRandomize}
                className="flex-1 sm:flex-initial py-3 px-4 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20 rounded-full font-bold text-xs tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-2"
                title="Combinação aleatória brilhante"
              >
                <Shuffle size={14} />
                <span>Aleatório</span>
              </button>
            </div>

            {/* Main CTA apply buttons */}
            <div className="flex-1 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10 rounded-full font-bold text-xs tracking-wider uppercase hover:text-white transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                className="flex-[1.5] py-3 px-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black hover:text-slate-900 rounded-full font-black text-xs tracking-[0.2em] shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:shadow-[0_0_35px_rgba(6,182,212,0.55)] text-white uppercase transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <Check size={14} strokeWidth={3} />
                <span>Aplicar Skin</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
