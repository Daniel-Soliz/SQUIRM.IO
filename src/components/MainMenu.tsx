/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { SkinConfig, LeaderboardEntry } from '../types';
import { 
  Trophy, 
  Volume2, 
  VolumeX, 
  User, 
  Globe, 
  Sparkles, 
  ExternalLink, 
  Instagram, 
  Twitter, 
  Youtube, 
  Check, 
  Gamepad2, 
  Activity, 
  Rocket, 
  HelpCircle 
} from 'lucide-react';
import { audioEngine } from './AudioEngine';

interface MainMenuProps {
  currentSkin: SkinConfig;
  onStartGame: (mode: 'offline' | 'online', name: string) => void;
  onOpenSkinCustomizer: () => void;
  onUpdateSkin?: (skin: SkinConfig) => void;
}

export default function MainMenu({ 
  currentSkin, 
  onStartGame, 
  onOpenSkinCustomizer,
  onUpdateSkin 
}: MainMenuProps) {
  const [name, setName] = useState<string>('');
  const [muted, setMuted] = useState<boolean>(true);
  const [leaderboardTab, setLeaderboardTab] = useState<'solo' | 'global'>('solo');
  const [offlineScores, setOfflineScores] = useState<LeaderboardEntry[]>([]);
  const [onlineScores, setOnlineScores] = useState<LeaderboardEntry[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(62); // Default to matching image
  const [matchesToday, setMatchesToday] = useState<number>(1248);
  const [highestScore, setHighestScore] = useState<number>(23547);
  const [isLoadingScores, setIsLoadingScores] = useState<boolean>(false);

  // Initialize name and mute settings from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('slither_nickname');
    if (savedName) {
      setName(savedName);
    } else {
      const defaultNames = ['CobraMestra', 'AlphaSnake', 'GlowWorm', 'SerpenteNeon', 'SlitherRex'];
      setName(defaultNames[Math.floor(Math.random() * defaultNames.length)]);
    }

    setMuted(audioEngine.getMuted());

    // Fetch scores
    loadLeaderboards();
    
    // Fetch online players count
    fetchOnlinePlayerCount();
    const interval = setInterval(fetchOnlinePlayerCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadLeaderboards = async () => {
    setIsLoadingScores(true);
    // 1. Load Local Offline scores
    try {
      const local = localStorage.getItem('slither_highscores_local');
      if (local) {
        const parsed = JSON.parse(local) as LeaderboardEntry[];
        setOfflineScores(parsed.sort((a, b) => b.score - a.score).slice(0, 10));
      } else {
        // Seed default local scores to match image
        const defaults: LeaderboardEntry[] = [
          { name: 'Cobralmperial', score: 12560, date: '01/07/2026', mode: 'offline' },
          { name: 'BotVencedor', score: 8430, date: '03/07/2026', mode: 'offline' },
          { name: 'GlowMaster', score: 6210, date: '05/07/2026', mode: 'offline' },
          { name: 'MiniCobrinha', score: 3120, date: '06/07/2026', mode: 'offline' },
          { name: 'AlphaSnake', score: 950, date: '07/07/2026', mode: 'offline' },
          { name: 'SnakeKing', score: 710, date: '07/07/2026', mode: 'offline' },
        ];
        localStorage.setItem('slither_highscores_local', JSON.stringify(defaults));
        setOfflineScores(defaults);
      }
    } catch (e) {
      console.error(e);
    }

    // 2. Fetch Global Online scores from server
    try {
      const res = await fetch('/api/highscores');
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setOnlineScores(data);
        } else {
          // Fallback mocked global scores
          setOnlineScores([
            { name: 'GigaWorm', score: 28450, date: '07/07/2026', mode: 'online' },
            { name: 'HyperSnake', score: 22100, date: '07/07/2026', mode: 'online' },
            { name: 'NeonSerpent', score: 19430, date: '07/07/2026', mode: 'online' },
            { name: 'VoidWalker', score: 15300, date: '07/07/2026', mode: 'online' },
            { name: 'Cobralmperial', score: 12560, date: '07/07/2026', mode: 'online' },
          ]);
        }
      }
    } catch (e) {
      // Fallback
      setOnlineScores([
        { name: 'GigaWorm', score: 28450, date: '07/07/2026', mode: 'online' },
        { name: 'HyperSnake', score: 22100, date: '07/07/2026', mode: 'online' },
        { name: 'NeonSerpent', score: 19430, date: '07/07/2026', mode: 'online' },
        { name: 'VoidWalker', score: 15300, date: '07/07/2026', mode: 'online' },
        { name: 'Cobralmperial', score: 12560, date: '07/07/2026', mode: 'online' },
      ]);
    } finally {
      setIsLoadingScores(false);
    }
  };

  const fetchOnlinePlayerCount = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setOnlineCount(data.onlineCount !== undefined ? data.onlineCount : 62);
        setMatchesToday(data.matchesToday !== undefined ? data.matchesToday : 1248);
        setHighestScore(data.highestScore !== undefined ? data.highestScore : 23547);
      }
    } catch (e) {
      console.error("Error loading real-time statistics:", e);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.substring(0, 16);
    setName(val);
    localStorage.setItem('slither_nickname', val);
  };

  const handleToggleSound = () => {
    const nextMute = !muted;
    setMuted(nextMute);
    audioEngine.setMuted(nextMute);
    audioEngine.playClick();
  };

  const startMode = (mode: 'offline' | 'online') => {
    audioEngine.playClick();
    const finalName = name.trim() || 'SemNome';
    
    // Register match in real-time stats
    fetch('/api/stats/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(err => console.error("Error logging match:", err));

    onStartGame(mode, finalName);
  };

  // Pre-configured list of default skins to match the row of 5 skins in the image
  const defaultSkins: { id: string; color: string; pattern: 'solid' | 'striped' | 'checkered' | 'rainbow' | 'spotted'; name: string }[] = [
    { id: 'white', color: '#ffffff', pattern: 'solid', name: 'White Silver' },
    { id: 'black', color: '#1e293b', pattern: 'solid', name: 'Obsidian Black' },
    { id: 'green', color: '#10b981', pattern: 'solid', name: 'Emerald Green' },
    { id: 'purple', color: '#8b5cf6', pattern: 'solid', name: 'Neon Violet' },
    { id: 'red', color: '#ef4444', pattern: 'solid', name: 'Crimson Flame' },
  ];

  // Helper to determine if a pre-configured skin is selected
  const isSkinSelected = (skinColor: string) => {
    return currentSkin.primaryColor.toLowerCase() === skinColor.toLowerCase();
  };

  const selectSkinPreset = (color: string, pattern: 'solid' | 'striped' | 'checkered' | 'rainbow' | 'spotted') => {
    audioEngine.playClick();
    if (onUpdateSkin) {
      onUpdateSkin({
        primaryColor: color,
        secondaryColor: color === '#ffffff' ? '#cbd5e1' : '#000000',
        pattern: pattern,
        headStyle: 'none',
        eyesType: 'normal',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#070b0e] text-white flex flex-col justify-between p-4 md:p-6 relative overflow-x-hidden font-sans">
      
      {/* Header/Navigation Bar */}
      <header className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between py-4 border-b border-white/5 gap-4 z-20">
        
        {/* Left Side: Custom curvy worm logo & Title */}
        <div className="flex items-center gap-3 select-none">
          <svg className="w-8 h-8 text-white filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" viewBox="0 0 40 40" fill="none">
            {/* White wavy solid snake icon matching the design of squirm.io */}
            <circle cx="20" cy="11" r="5" fill="#ffffff" />
            <path 
              d="M20 16 C14 16, 12 19, 12 23 C12 28, 20 28, 20 31 C20 34, 16 35, 13 35" 
              stroke="#ffffff" 
              strokeWidth="5.5" 
              strokeLinecap="round" 
              fill="none" 
            />
          </svg>
          <span className="text-2xl font-black font-sans text-white tracking-tight">Squirm.io</span>
        </div>

        {/* Center: Navigation Links with beautiful white active underline */}
        <nav className="flex items-center gap-6 text-sm font-semibold text-gray-400">
          <a href="#inicio" className="text-white relative pb-1.5 transition-all">
            Início
            <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white rounded-full"></span>
          </a>
        </nav>

        {/* Right Side: Online Counter and Mute Controls / Profile button */}
        <div className="flex items-center gap-3">
          {/* Mute button directly in header */}
          <button
            onClick={handleToggleSound}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-gray-400 hover:text-white transition-all"
            title={muted ? "Ativar som" : "Desativar som"}
          >
            {muted ? <VolumeX size={15} className="text-red-400 animate-pulse" /> : <Volume2 size={15} className="text-cyan-400" />}
          </button>

          {/* Active online players pill */}
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {onlineCount} jogadores online
          </span>


        </div>
      </header>

      {/* Main Layout Grid of Cards (Aligned perfectly) */}
      <main className="w-full max-w-7xl mx-auto grid grid-cols-12 gap-6 my-auto py-8 z-10 relative">
        
        {/* HERO CARD - Left side (2/3 width) */}
        <section className="col-span-12 lg:col-span-8 bg-[#0b0f14]/80 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 md:p-12 min-h-[440px] relative overflow-hidden flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.6)] group">
          
          {/* Beautiful decorative animated 3D snake on the right side of the hero card */}
          <div className="absolute right-[-40px] top-1/2 -translate-y-1/2 w-[55%] h-[110%] pointer-events-none select-none overflow-visible hidden md:block">
            <svg className="w-full h-full animate-snake-wiggle" viewBox="0 0 320 320" fill="none">
              {/* Soft colorful glowing backgrounds */}
              <circle cx="80" cy="90" r="15" fill="#eab308" className="opacity-30 filter blur-[4px] animate-pulse" />
              <circle cx="260" cy="120" r="12" fill="#a855f7" className="opacity-40 filter blur-[4px] animate-pulse" />
              <circle cx="220" cy="270" r="16" fill="#ec4899" className="opacity-35 filter blur-[5px] animate-pulse" />
              <circle cx="60" cy="240" r="14" fill="#22c55e" className="opacity-30 filter blur-[4px]" />

              {/* White/Silver premium snake */}
              <path 
                d="M 280,30 C 270,120 180,110 180,160 C 180,210 240,210 220,260 C 205,295 140,290 125,245 C 115,215 130,195 110,185" 
                stroke="url(#silverGrad)" 
                strokeWidth="32" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="opacity-95"
              />
              <path 
                d="M 280,30 C 270,120 180,110 180,160 C 180,210 240,210 220,260 C 205,295 140,290 125,245 C 115,215 130,195 110,185" 
                stroke="url(#highlightGrad)" 
                strokeWidth="28" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="opacity-30"
              />
              
              {/* Realistic Snake Head */}
              <g transform="translate(108, 183) rotate(-38)">
                <ellipse cx="0" cy="0" rx="20" ry="16" fill="url(#silverHeadGrad)" />
                {/* Cute black eyes */}
                <circle cx="-6" cy="-4" r="4.5" fill="#000000" />
                <circle cx="-7.5" cy="-5.5" r="1.8" fill="#ffffff" />
                
                <circle cx="6" cy="-4" r="4.5" fill="#000000" />
                <circle cx="4.5" cy="-5.5" r="1.8" fill="#ffffff" />
              </g>

              {/* Gradients */}
              <defs>
                <linearGradient id="silverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className="animate-rainbow-stop1" />
                  <stop offset="45%" className="animate-rainbow-stop2" />
                  <stop offset="100%" className="animate-rainbow-stop1" />
                </linearGradient>
                <linearGradient id="highlightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="silverHeadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className="animate-rainbow-stop1" />
                  <stop offset="100%" className="animate-rainbow-stop2" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Left Textual Elements of Hero Banner */}
          <div className="space-y-4 max-w-lg z-10">
            {/* Giant Title */}
            <h1 className="text-6xl md:text-7xl font-black font-sans tracking-tighter leading-none select-none drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)] animate-float-rainbow inline-block origin-left">
              Squirm.io
            </h1>

            {/* Beautiful Subtitle */}
            <p className="text-xl font-bold text-gray-400 tracking-tight font-sans">
              Cresça. Sobreviva. Domine.
            </p>

            {/* Paragraph description */}
            <p className="text-sm text-gray-500 font-sans leading-relaxed">
              Colete orbes, derrote outros jogadores e se torne a maior serpente da arena.
            </p>
          </div>

          {/* User Controls and Actions (Nickname Input & Play CTAs) */}
          <div className="w-full max-w-xl z-10 mt-8 space-y-4">
            
            {/* Custom high-fidelity Nickname Input */}
            <div className="relative max-w-sm">
              <span className="absolute inset-y-0 left-4 flex items-center text-gray-500">
                <User size={16} />
              </span>
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="Seu Apelido..."
                maxLength={16}
                className="w-full bg-[#0d131a] border border-white/10 rounded-full pl-11 pr-4 py-3 text-sm font-semibold text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all font-sans"
              />
            </div>

            {/* Play Button Row */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
              <button
                onClick={() => startMode('offline')}
                className="flex-1 py-4 bg-white hover:bg-gray-100 text-black rounded-full font-black text-xs tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Jogar Agora
              </button>

              <button
                onClick={() => startMode('online')}
                className="flex-1 py-4 bg-transparent border border-white/20 hover:bg-white/5 hover:border-white/40 text-white rounded-full font-black text-xs tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Globe size={15} />
                Jogar Online
              </button>
            </div>
          </div>
        </section>

        {/* LEADERBOARD CARD - Right side (1/3 width) */}
        <section className="col-span-12 lg:col-span-4 bg-[#0b0f14]/80 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 shadow-[0_0_50px_rgba(0,0,0,0.6)] flex flex-col justify-between h-[440px]">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <h3 className="text-sm font-black tracking-[0.1em] text-white uppercase flex items-center gap-2">
              <Trophy className="text-yellow-400 w-4 h-4" /> Leaderboard
            </h3>
            
            {/* Solo / Global Selector tabs */}
            <div className="flex bg-black/40 p-1 rounded-full border border-white/5">
              <button
                onClick={() => setLeaderboardTab('solo')}
                className={`text-[10px] uppercase font-bold tracking-widest px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  leaderboardTab === 'solo'
                    ? 'bg-[#18202b] text-white border border-white/5'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Solo
              </button>
              <button
                onClick={() => setLeaderboardTab('global')}
                className={`text-[10px] uppercase font-bold tracking-widest px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  leaderboardTab === 'global'
                    ? 'bg-[#18202b] text-white border border-white/5'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Global
              </button>
            </div>
          </div>

          {/* Leaderboard entries table */}
          <div className="flex-1 overflow-y-auto my-3 pr-1 space-y-2">
            {isLoadingScores ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-500 font-mono">
                Carregando...
              </div>
            ) : (leaderboardTab === 'solo' ? offlineScores : onlineScores).length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-500 font-mono">
                Nenhum recorde registrado
              </div>
            ) : (
              (leaderboardTab === 'solo' ? offlineScores : onlineScores).slice(0, 6).map((entry, idx) => (
                <div
                  key={`${leaderboardTab}-${idx}-${entry.name}`}
                  className="flex items-center justify-between py-2 px-4 bg-white/[0.02] border border-white/5 rounded-2xl transition-all hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-4 text-xs font-mono font-black ${
                      idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-gray-600'
                    }`}>
                      {idx + 1}.
                    </span>
                    <span className="text-sm font-semibold text-gray-300 truncate max-w-[150px]">{entry.name}</span>
                  </div>
                  
                  {/* Scores color matches the image format exactly */}
                  <span className={`text-sm font-bold font-mono ${idx < 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {entry.score.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Bottom Link CTA Button */}
          <button 
            onClick={onOpenSkinCustomizer}
            className="w-full py-3 bg-transparent border border-white/10 hover:border-white/20 hover:bg-white/5 text-gray-300 hover:text-white rounded-2xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Ver Top Global</span>
            <ExternalLink size={12} />
          </button>
        </section>

        {/* BOTTOM COLUMN 1 - Como Jogar */}
        <section className="col-span-12 md:col-span-4 bg-[#0b0f14]/80 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 shadow-lg min-h-[220px] flex justify-between gap-2 overflow-hidden">
          
          <div className="flex flex-col justify-between flex-1">
            <h3 className="text-sm font-black font-sans text-white tracking-wider flex items-center gap-2 select-none mb-4">
              <HelpCircle className="text-gray-400 w-4 h-4" /> Como Jogar
            </h3>

            {/* Instruction steps matching the design exactly */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-white/20 text-[10px] font-mono text-gray-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-xs text-gray-400 leading-tight">
                  <strong className="text-gray-200">Mova o mouse</strong> <br/>para controlar sua serpente.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-white/20 text-[10px] font-mono text-gray-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-xs text-gray-400 leading-tight">
                  <strong className="text-gray-200">Colete orbes</strong> <br/>para crescer cada vez mais.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-white/20 text-[10px] font-mono text-gray-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-xs text-gray-400 leading-tight">
                  <strong className="text-gray-200">Evite colisões</strong> <br/>com outras cobras!
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-white/20 text-[10px] font-mono text-gray-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  4
                </span>
                <p className="text-xs text-gray-400 leading-tight">
                  <strong className="text-gray-200">Seja o maior</strong> <br/>e domine o ranking!
                </p>
              </div>
            </div>
          </div>

          {/* Right side background artwork */}
          <div className="w-20 self-center opacity-40 md:opacity-60 pointer-events-none select-none flex items-center justify-center flex-shrink-0">
            <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none">
              <path d="M90,15 C70,15 65,35 65,50 C65,65 40,75 25,65" stroke="#f8fafc" strokeWidth="12" strokeLinecap="round" fill="none" />
              <path d="M85,85 C75,65 85,50 70,35" stroke="#f43f5e" strokeWidth="10" strokeLinecap="round" fill="none" />
              <circle cx="20" cy="30" r="5" fill="#a78bfa" />
              <circle cx="50" cy="70" r="4.5" fill="#fbbf24" />
            </svg>
          </div>
        </section>

        {/* BOTTOM COLUMN 2 - Skins Row of 5 */}
        <section className="col-span-12 md:col-span-4 bg-[#0b0f14]/80 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 shadow-lg min-h-[220px] flex flex-col justify-between">
          
          <div className="flex justify-between items-center mb-4 select-none">
            <h3 className="text-sm font-black font-sans text-white tracking-wider flex items-center gap-2">
              <Rocket className="text-gray-400 w-4 h-4" /> Skins
            </h3>
            
            <button
              onClick={onOpenSkinCustomizer}
              className="text-xs font-bold text-gray-400 hover:text-white transition-all cursor-pointer underline"
            >
              Ver todas
            </button>
          </div>

          {/* Elegant row of 5 skins, exactly as in image! Clickable to change skin instantly! */}
          <div className="grid grid-cols-5 gap-2.5">
            {defaultSkins.map((skinPreset) => {
              const selected = isSkinSelected(skinPreset.color);
              return (
                <div
                  key={skinPreset.id}
                  onClick={() => selectSkinPreset(skinPreset.color, skinPreset.pattern)}
                  className={`border rounded-2xl p-2 relative flex items-center justify-center h-[90px] cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                    selected 
                      ? 'bg-white/[0.08] border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                      : 'bg-[#0d131a] border-white/10 hover:border-white/20'
                  }`}
                  title={`Selecionar skin ${skinPreset.name}`}
                >
                  {/* Dynamic skin curvy worm visual segment preview */}
                  <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                    <path
                      d="M10,30 C12,18 28,22 30,10"
                      stroke={skinPreset.color}
                      strokeWidth="8"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <circle cx="30" cy="10" r="2" fill="#000000" />
                  </svg>

                  {/* Selected Green Checkmark Overlay */}
                  {selected && (
                    <div className="absolute bottom-1 right-1 bg-emerald-500 text-black rounded-full p-0.5 flex items-center justify-center shadow">
                      <Check size={8} strokeWidth={4} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-gray-500 font-medium tracking-tight mt-3 text-center">
            Clique em qualquer cor para selecionar ou aperte <b className="text-gray-400">Ver todas</b> para customização avançada.
          </p>
        </section>

        {/* BOTTOM COLUMN 3 - Estatísticas with neon green line chart */}
        <section className="col-span-12 md:col-span-4 bg-[#0b0f14]/80 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 shadow-lg min-h-[220px] flex flex-col justify-between">
          
          <h3 className="text-sm font-black font-sans text-white tracking-wider flex items-center gap-2 select-none mb-3">
            <Activity className="text-gray-400 w-4 h-4" /> Estatísticas
          </h3>

          <div className="space-y-3.5">
            {/* Stat 1 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider block leading-none">
                  Jogadores Online
                </span>
                <span className="text-xl font-black font-mono text-cyan-400 leading-tight">
                  {onlineCount}
                </span>
              </div>
              
              {/* Mini Green line chart */}
              <svg className="w-20 h-6 text-emerald-500" viewBox="0 0 80 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M0,15 Q15,5 30,12 T60,8 T80,3" strokeLinecap="round" />
                <circle cx="80" cy="3" r="1.5" fill="currentColor" />
              </svg>
            </div>

            {/* Stat 2 */}
            <div className="flex items-center justify-between border-t border-white/5 pt-2">
              <div>
                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider block leading-none">
                  Partidas Hoje
                </span>
                <span className="text-xl font-black font-mono text-cyan-400 leading-tight">
                  {matchesToday.toLocaleString()}
                </span>
              </div>
              
              {/* Mini Green line chart */}
              <svg className="w-20 h-6 text-emerald-500" viewBox="0 0 80 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M0,18 Q15,12 30,15 T60,5 T80,9" strokeLinecap="round" />
                <circle cx="80" cy="9" r="1.5" fill="currentColor" />
              </svg>
            </div>

            {/* Stat 3 */}
            <div className="flex items-center justify-between border-t border-white/5 pt-2">
              <div>
                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider block leading-none">
                  Maior Cobra
                </span>
                <span className="text-xl font-black font-mono text-cyan-400 leading-tight">
                  {highestScore.toLocaleString()}
                </span>
              </div>
              
              {/* Mini Green line chart */}
              <svg className="w-20 h-6 text-emerald-500" viewBox="0 0 80 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M0,15 Q15,10 30,16 T60,4 T80,11" strokeLinecap="round" />
                <circle cx="80" cy="11" r="1.5" fill="currentColor" />
              </svg>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Branding & Social Media Layout matching image exactly */}
      <footer className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between py-6 border-t border-white/5 mt-10 gap-4 z-20">
        
        {/* Social Icons */}
        <div className="flex items-center gap-4">
          <a href="#" className="text-gray-500 hover:text-white transition-all">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.03c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.03A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
          </a>
          <a href="https://www.instagram.com/danielsoliz.ds/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-all">
            <Instagram size={18} />
          </a>
          <a href="#" className="text-gray-500 hover:text-white transition-all">
            <Twitter size={18} />
          </a>
          <a href="#" className="text-gray-500 hover:text-white transition-all">
            <Youtube size={18} />
          </a>
        </div>

        {/* Central Copyright info */}
        <span className="text-xs text-gray-500 font-sans tracking-tight">
          Squirm.io © 2024 - Todos os direitos reservados
        </span>

        {/* Privacy & terms links */}
        <div className="flex gap-4 text-xs text-gray-500 font-sans">
          <a href="#" className="hover:text-white transition-all">Privacidade</a>
          <a href="#" className="hover:text-white transition-all">Termos de Uso</a>
        </div>
      </footer>
    </div>
  );
}
