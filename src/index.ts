import Phaser from 'phaser'
import { Game } from './game'

export default new Phaser.Game({
  title: 'Multiplayer 02',
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      debug: true,
      gravity: { y: 0 },
    },
  },
  scene: [Game],
  scale: {
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})
