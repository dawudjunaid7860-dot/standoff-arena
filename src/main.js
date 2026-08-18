import { Game } from './Game.js';

const game = new Game();
window.__game = game; // debug hook
game.init().catch((err) => {
  console.error('Failed to start Standoff Arena:', err);
});
