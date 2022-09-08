export class Game extends Phaser.Scene {
  playersLayer!: Phaser.GameObjects.Layer
  foodLayer!: Phaser.GameObjects.Layer

  player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  size: number = 0.5

  last: number = 0
  food!: Phaser.Physics.Arcade.StaticGroup

  constructor() {
    super('game')
  }

  preload() {
    this.load.image('player', 'assets/player.png')

    for (let i = 1; i < 10; i++) {
      this.load.image(`food_${i}`, `assets/food_${i}.png`)
    }
  }

  create() {
    const player = this.physics.add.sprite(400, 300, 'player')
    player.setOrigin(0.5, 0.5)
    player.body.setCircle(64)

    player.scale = this.size
    this.player = player

    const bg = this.add
      .grid(0, 0, 14000, 14000, 128, 128, 0xffffff, 1, 0xf5f5f5)
      .setOrigin(0, 0)
    // const bg = this.add.image(0, 0, 'background').setOrigin(0, 0)
    this.cameras.main.setBounds(0, 0, bg.displayWidth, bg.displayHeight)
    this.cameras.main.startFollow(player, true, 0.09, 0.09)
    this.cameras.main.zoom = 2

    this.food = this.physics.add.staticGroup({})
    this.foodLayer = this.add.layer()

    this.physics.add.overlap(this.player, this.food, (player, food) => {
      if (!player.body.hitTest(food.body.center.x, food.body.center.y)) {
        return
      }

      this.food.killAndHide(food)
      food.body.enable = false
      this.size += 0.1
      this.tweens.add({
        targets: [this.player],
        size: 128,
        duration: 500,
      })
      const zoom = this.cameras.main.zoom - 0.15
      this.cameras.main.zoomTo(
        Phaser.Math.Clamp(zoom, 0.5, 2),
        1000,
        'Cubic.easeInOut'
      )
    })

    this.playersLayer = this.add.layer()
    this.playersLayer.add(player)
    this.playersLayer.bringToTop(player)
    this.playersLayer.setDepth(1)
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

    if (t - this.last > 1000) {
      const i = Phaser.Math.Between(1, 9)
      const foodX = Phaser.Math.Between(0, 1024)
      const foodY = Phaser.Math.Between(0, 1024)
      const created: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody =
        this.food.create(foodX, foodY, `food_${i}`)
      created.setCircle(16)
      created.setOrigin(0.5, 0.5)
      // const food = this.physics.add.sprite()
      // this.foodLayer.add(food)
      this.food.add(created)
      this.last = t
    }
  }
}
