enum IMG {
  SKY = 'sky',
  LOGO = 'logo',
  RED = 'red',
}

export class Game extends Phaser.Scene {
  player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody

  constructor() {
    super('game')
  }

  preload() {
    this.load.image('player', 'assets/player.png')
    this.load.image('background', 'assets/background.png')
  }

  create() {
    const player = this.physics.add.sprite(400, 300, 'player')
    this.player = player

    const bg = this.add.image(0, 0, 'background').setOrigin(0, 0)
    this.cameras.main.setBounds(0, 0, bg.displayWidth, bg.displayHeight)
    this.cameras.main.startFollow(player)

    const layer = this.add.layer()
    layer.add(player)
    layer.bringToTop(player)
  }

  update(t: number, dt: number) {
    const x = this.input.mousePointer.worldX
    const y = this.input.mousePointer.worldY

    const angle = Math.atan2(y - this.player.y, x - this.player.x)
    const distance = Phaser.Math.Distance.Between(
      x,
      y,
      this.player.x,
      this.player.y
    )
    const speed = Math.min(distance / 10, 10) * dt
    const velX = Math.cos(angle) * speed
    const velY = Math.sin(angle) * speed

    this.player.setVelocity(velX, velY)
  }
}
