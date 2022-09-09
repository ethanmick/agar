import { io } from 'socket.io-client'
import { v4 as uuid } from 'uuid'

type PositionEvent = {
  id: string
  x: number
  y: number
  size: number
}

class Player extends Phaser.Physics.Arcade.Sprite {
  public id: string = uuid()
  public size: number

  public get speed(): number {
    return this.size
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player')
    this.size = 0.5
  }
}

const id = uuid()
const socket = io(`http://localhost:9090?id=${id}`)

export class Game extends Phaser.Scene {
  dead = false
  playerGroup!: Phaser.Physics.Arcade.Group
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
    this.playerGroup = this.physics.add.group()

    const player = this.physics.add.sprite(
      Phaser.Math.Between(0, 1024),
      Phaser.Math.Between(0, 1024),
      'player'
    )
    player.setData({ id, size: 0.5 })
    player.setOrigin(0.5, 0.5)
    player.body.setCircle(64)
    this.playerGroup.add(player)

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
      this.player.setData({ size: this.size })
      this.tweens.add({
        targets: [this.player],
        scale: this.size,
        duration: 500,
      })
      const zoom = this.cameras.main.zoom - 0.15
      this.cameras.main.zoomTo(
        Phaser.Math.Clamp(zoom, 0.5, 2),
        1000,
        'Cubic.easeInOut'
      )
    })

    this.physics.add.overlap(this.playerGroup, this.playerGroup, (p1, p2) => {
      if (!p1.body.hitTest(p2.body.center.x, p2.body.center.y)) {
        return
      }
      if (p1.data.values.size > p2.data.values.size * 1.2) {
        this.playerGroup.killAndHide(p2)
        p2.body.enable = false
        // p2.destroy()
        socket.emit('destroyed', p2.data.values.id)
      }
    })

    this.playersLayer = this.add.layer()
    this.playersLayer.add(player)
    this.playersLayer.bringToTop(player)
    this.playersLayer.setDepth(1)

    this.time.addEvent({
      delay: 50,
      callback: () => {
        socket.emit('position', {
          id,
          x: this.player.x,
          y: this.player.y,
          size: this.size,
        })
      },
      loop: true,
    })

    socket.on('position', (d: PositionEvent) => {
      const player:
        | Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
        | undefined = this.playersLayer
        .getChildren()
        .find(
          (go) => go.data.values.id === d.id
        ) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody

      if (!player) {
        const player = this.physics.add.sprite(d.x, d.y, 'player')
        player.setData({ id: d.id, size: d.size })
        player.setOrigin(0.5, 0.5)
        player.body.setCircle(64)
        this.playersLayer.add(player)
        this.playerGroup.add(player)
        return
      }
      player.setPosition(d.x, d.y)
      if (player.data.values.size != d.size) {
        player.setData({ size: d.size })
        this.tweens.add({
          targets: [player],
          scale: d.size,
          duration: 500,
        })
      }
    })

    socket.on('destroyed', (remote: string) => {
      if (remote === id) {
        this.dead = true
      }
    })
  }

  update(t: number, dt: number) {
    if (this.dead) {
      this.player.destroy()
      console.log('YOU LOSE')
      return
    }

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
