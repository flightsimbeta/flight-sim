import './style.css';
import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);

// Menü görünür, oyun bekleme modunda
// İlk teleport ile başlatılacak
(window as any).__game = game;

game.start();
