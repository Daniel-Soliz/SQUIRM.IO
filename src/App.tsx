/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameMode, SkinConfig } from './types';
import MainMenu from './components/MainMenu';
import SkinCustomizer from './components/SkinCustomizer';
import GameCanvas from './components/GameCanvas';

export default function App() {
  const [mode, setMode] = useState<GameMode>('menu');
  const [playerName, setPlayerName] = useState<string>('');
  const [currentSkin, setCurrentSkin] = useState<SkinConfig>({
    primaryColor: '#00ff88', // Neon green
    secondaryColor: '#00ffff', // Cyan
    pattern: 'custom_blocks',
    headStyle: 'none',
    eyesType: 'normal',
    colors: ['#00ff88', '#00e1ff', '#0084ff', '#00ff88'], // Nice modern gradient
    accessory: 'none',
    expression: 'happy',
  });
  const [isCustomizingSkin, setIsCustomizingSkin] = useState<boolean>(false);

  const handleStartGame = (gameMode: 'offline' | 'online', name: string) => {
    setPlayerName(name);
    setMode(gameMode);
  };

  const handleSaveSkin = (newSkin: SkinConfig) => {
    setCurrentSkin(newSkin);
  };

  return (
    <div className="w-full min-h-screen bg-immersive-pattern text-white select-none relative overflow-hidden">
      {/* Active Game Layout */}
      {mode === 'menu' ? (
        <MainMenu
          currentSkin={currentSkin}
          onStartGame={handleStartGame}
          onOpenSkinCustomizer={() => setIsCustomizingSkin(true)}
          onUpdateSkin={handleSaveSkin}
        />
      ) : (
        <GameCanvas
          mode={mode}
          playerName={playerName}
          playerSkin={currentSkin}
          onExit={() => setMode('menu')}
        />
      )}

      {/* Customizable Skin Modal overlay */}
      {isCustomizingSkin && (
        <SkinCustomizer
          currentSkin={currentSkin}
          onSave={handleSaveSkin}
          onClose={() => setIsCustomizingSkin(false)}
        />
      )}
    </div>
  );
}
