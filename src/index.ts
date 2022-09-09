import Phaser from 'phaser'
import { Game } from './game'

export default new Phaser.Game({
  title: 'Multiplayer 02',
  type: Phaser.AUTO,
  parent: 'game',
  width: 1400,
  height: 900,
  physics: {
    default: 'arcade',
    arcade: {
      debug: true,
      gravity: { y: 0 },
    },
  },
  scene: [Game],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})
