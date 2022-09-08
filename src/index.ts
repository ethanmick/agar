import Phaser from 'phaser'
import { Game } from './game'

export default new Phaser.Game({
  title: 'TypeScript Start',
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  physics: {
    // Setting the game physics.
    default: 'arcade',
    arcade: {
      gravity: { y: 200 },
    },
  },
  scene: [Game],
  scale: {
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})
