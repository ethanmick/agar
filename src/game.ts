import { io } from 'socket.io-client'
import { v4 as uuid } from 'uuid'

type Point = {
  x: number
  y: number
}

type PositionEvent = {
  id: string
  x: number
  y: number
  size: number
}

const SCALE_FACTOR = 128

class Player extends Phaser.Physics.Arcade.Sprite {
  public id: string = uuid()
  public _size: number = 64

  public get speed(): number {
    return this.size
  }

  public set size(size: number) {
    this._size = size
    this.body.radius = size
  }

  public get size() {
    return this._size
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player')
    // Required
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Continue setup
    this.setCircle(this.size)
    this.scale = this.size / SCALE_FACTOR
  }

  public isEating(p: Point) {
    return this.body.hitTest(p.x, p.y)
  }

  /**
   * Grow after eating another entity
   * @param amount
   */
  public grow(amount: number) {
    this.size += amount
    // Manually set for hitbox
    // this.body.radius = this.size
    const scale = this.size / SCALE_FACTOR
    this.scene.tweens.add({
      targets: [this],
      scale: scale,
      duration: 500,
    })
  }

  public split() {
    this.scene.input.activePointer.updateWorldPoint(this.scene.cameras.main)
    const pointer = this.scene.input.activePointer
    const { worldX: x, worldY: y } = pointer
    const angle = Math.atan2(y - this.y, x - this.x)
    const velX = Math.cos(angle)
    const velY = Math.sin(angle)

    this.size /= 2
    const blob = this.scene.physics.add.sprite(this.x, this.y, 'player')
    blob.scale = this.size / SCALE_FACTOR / 2
    blob.setVelocity(velX * 200, velY * 200)
    blob.setAcceleration(-100, -100)
  }
}

const id = uuid()
const socket = io(`http://localhost:9090?id=${id}`)

////////////////////////////////////////////
// SCENE
export class Game extends Phaser.Scene {
  dead = false
  playerGroup!: Phaser.Physics.Arcade.Group
  playersLayer!: Phaser.GameObjects.Layer
  foodLayer!: Phaser.GameObjects.Layer

  player!: Player
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
    const player = new Player(
      this,
      Phaser.Math.Between(0, 1024),
      Phaser.Math.Between(0, 1024)
    )
    this.player = player
    this.playerGroup.add(player)

    const bg = this.add
      .grid(0, 0, 14000, 14000, 128, 128, 0xffffff, 1, 0xf5f5f5)
      .setOrigin(0, 0)
    this.cameras.main.setBounds(0, 0, bg.displayWidth, bg.displayHeight)
    this.cameras.main.startFollow(player, true, 0.09, 0.09)
    this.cameras.main.zoom = 2

    this.food = this.physics.add.staticGroup({})
    this.foodLayer = this.add.layer()

    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.player.size < 64) {
        return
      }
      this.player.split()
    })

    // On Food contact, Consume
    this.physics.add.overlap(this.player, this.food, (_player, food) => {
      // https://github.com/photonstorm/phaser/issues/5882
      const player = _player as Player
      if (!player.isEating(food.body.center)) {
        return
      }

      // Destroy the food
      this.food.killAndHide(food)
      food.body.enable = false
      food.destroy()

      // Grow
      player.grow(2)

      // Adjust zoom as needed
      const z = 2 - 0.002 * player.size
      const zoom = Phaser.Math.Clamp(z, 0.5, 2)
      this.cameras.main.zoomTo(zoom, 1000, Phaser.Math.Easing.Cubic.InOut)
    })

    // On other player contact, check if one eats the other.
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

    // Broadcast player position on a cadence
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

    // Update other players
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

    // You lose
    socket.on('destroyed', (remote: string) => {
      if (remote === id) {
        this.dead = true
      }
    })
  }

  update(t: number, dt: number) {
    if (this.dead) {
      this.player.destroy()
      return
    }

    const { x, y } = this.getMouseCoords()
    const angle = Math.atan2(y - this.player.y, x - this.player.x)
    const distance = Phaser.Math.Distance.Between(
      x,
      y,
      this.player.x,
      this.player.y
    )
    // const d = Math.min(distance / 50, 10)
    // const speed = (20 - 0.02 * this.player.size) * d * dt
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

  // Works great!
  getMouseCoords(): Point {
    // Takes a Camera and updates this Pointer's worldX and worldY values so they are the result of a translation through the given Camera.
    this.input.activePointer.updateWorldPoint(this.cameras.main)
    const pointer = this.input.activePointer
    return {
      x: pointer.worldX,
      y: pointer.worldY,
    }
  }
}
