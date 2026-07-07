/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SkinConfig {
  primaryColor: string;
  secondaryColor: string;
  pattern: 'solid' | 'checkered' | 'striped' | 'rainbow' | 'polka' | 'spotted' | 'custom_blocks';
  headStyle: 'none' | 'glasses' | 'crown' | 'headphones' | 'halo' | string;
  eyesType: 'normal' | 'cute' | 'angry' | 'big' | string;
  
  // New customizable skin fields
  colors?: string[]; // Array of up to 10 hex colors for custom blocks
  accessory?: string; // Categoria Acessórios de cabeça
  expression?: string; // Categoria Expressões/rostinho
}

export interface SnakeData {
  id: string;
  name: string;
  score: number;
  skin: SkinConfig;
  segments: { x: number; y: number }[];
  angle: number;
  isBoosting: boolean;
  isBot?: boolean;
}

export interface FoodDot {
  id: string;
  x: number;
  y: number;
  color: string;
  value: number; // size/score weight
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
  mode: 'offline' | 'online';
}

export type GameMode = 'menu' | 'offline' | 'online';
