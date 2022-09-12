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

const SPRITE_IMAGE_RADIUS = 64

/**
 * A player is a group of orbs. The orbs are controlled all at once with the
 * input. When all orbs have been destroyed, the player is dead.
 */
class Player extends Phaser.Physics.Arcade.Group {
  public id: string

  public get orbs() {
    return this.children as unknown as Phaser.Structs.Set<Orb>
  }

  public get x(): number {
    return Phaser.Math.Average(this.orbs.entries.map((o) => o.x))
  }

  public get y(): number {
    return Phaser.Math.Average(this.orbs.entries.map((o) => o.y))
  }

  constructor(
    world: Phaser.Physics.Arcade.World,
    scene: Game,
    x: number,
    y: number
  ) {
    super(world, scene)
    this.id = uuid()
    this.add(new Orb(scene, x, y, 16))
    scene.physics.add.collider(this, this, undefined, (o1, o2) => {
      const orb1 = o1 as Orb
      const orb2 = o2 as Orb
      return !(orb1.canReform && orb2.canReform)
    })
    scene.physics.add.overlap(this, this, (o1, o2) => {
      const orb = o1 as Orb
      if (orb.isEating(o2.body.center)) {
        orb.grow(o2.body.radius)
        this.killAndHide(o2)
        o2.destroy()
      }
    })
    this.defaults = {} as any

    this.addListener('reform', (o: Orb) => {
      this
    })
  }

  public isAlive(): boolean {
    return this.orbs.size > 0
  }

  public split() {
    const added = this.orbs.entries
      .map((o) => o.split())
      .filter((o) => !!o) as Orb[]
    this.addMultiple(added)
  }

  public moveTo(dt: number, x: number, y: number) {
    this.orbs.each((o) => o.moveTo(dt, x, y))
  }
}

class Orb extends Phaser.Physics.Arcade.Sprite {
  public readonly id: string
  public spawned: boolean = false
  public canReform: boolean = true

  public get speed(): number {
    return 16 - 0.05 * this.body.radius
  }

  constructor(scene: Game, x: number, y: number, radius: number) {
    super(scene, x, y, 'player')
    this.id = uuid()
    // Required
    scene.add.existing(this)
    scene.physics.add.existing(this)
    // // Layers
    scene.layers.players.add(this)
    scene.layers.players.bringToTop(this)

    // Continue setup
    this.scale = radius / SPRITE_IMAGE_RADIUS
    this.setCircle(radius / this.scale)
    this.body.radius = radius
    this.setBounce(1, 1)

    // this.emit()
    this.scene.time.addEvent({
      delay: 200,
      callback: () => {
        this.body.checkCollision.none = false
      },
    })

    this.scene.time.addEvent({
      delay: 10 * 1000,
      callback: () => {
        this.canReform = true
      },
    })
  }

  public isEating(p: Point) {
    return this.body.hitTest(p.x, p.y)
  }

  public moveTo(dt: number, x: number, y: number) {
    if (this.spawned) {
      if (this.body.velocity.length() > 200) {
        return
      }
      this.spawned = false
      this.body.checkCollision.none = false
    }
    const angle = Math.atan2(y - this.y, x - this.x)
    const distance = Phaser.Math.Clamp(
      Phaser.Math.Distance.Between(x, y, this.x, this.y) / 100,
      0,
      1
    )
    // const d = Math.min(distance / 50, 10)
    // const speed = (20 - 0.02 * this.player.size) * d * dt
    // const speed = Math.min(distance / 10, 10) * dt
    const velX = Math.cos(angle) * this.speed * distance * dt
    const velY = Math.sin(angle) * this.speed * distance * dt
    this.setVelocity(velX, velY)
  }

  /**
   * Grow after eating another entity
   * @param amount the radius to grow by
   */
  public grow(amount: number) {
    const radius = this.scale * SPRITE_IMAGE_RADIUS + amount
    const scale = radius / SPRITE_IMAGE_RADIUS
    this.body.radius = radius
    this.scene.tweens.add({
      targets: [this],
      scale: scale,
      duration: 250,
    })
  }

  public split(): Orb | undefined {
    if (this.body.radius < 20) {
      return
    }
    this.scene.input.activePointer.updateWorldPoint(this.scene.cameras.main)
    const pointer = this.scene.input.activePointer
    const { worldX: x, worldY: y } = pointer
    const angle = Math.atan2(y - this.y, x - this.x)
    const velX = Math.cos(angle)
    const velY = Math.sin(angle)

    const radius = (this.scale * SPRITE_IMAGE_RADIUS) / 2
    const scale = radius / SPRITE_IMAGE_RADIUS
    this.body.radius = radius

    this.scene.tweens.add({
      targets: [this],
      scale: scale,
      duration: 200,
    })

    const spawn = new Orb(this.scene as Game, this.x, this.y, this.body.radius)
    spawn.setVelocity(velX * 700, velY * 700)
    spawn.setDamping(true)
    spawn.setDrag(0.4)
    spawn.spawned = true
    spawn.canReform = false
    spawn.body.checkCollision.none = true
    return spawn
  }
}

type Layers = {
  food: Phaser.GameObjects.Layer
  players: Phaser.GameObjects.Layer
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//////////////////////////////////// SCENE ////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
export class Game extends Phaser.Scene {
  layers!: Layers
  player!: Player
  last: number = 0
  food!: Phaser.Physics.Arcade.StaticGroup

  constructor() {
    super('agar')
  }

  preload() {
    this.load.image('player', 'assets/player.png')
    for (let i = 1; i < 10; i++) {
      this.load.image(`food_${i}`, `assets/food_${i}.png`)
    }
  }

  create() {
    // Create layers for depth layering
    this.layers = {
      food: this.add.layer(),
      players: this.add.layer(),
    }
    this.layers.players.depth = 1

    // Create Player
    this.player = new Player(
      this.physics.world,
      this,
      Phaser.Math.Between(0, 1024),
      Phaser.Math.Between(0, 1024)
    )
    this.input.keyboard.on('keydown-SPACE', () => this.player.split())

    // Create Background Grid
    const bg = this.add
      .grid(0, 0, 14000, 14000, 128, 128, 0xffffff, 1, 0xf5f5f5)
      .setOrigin(0, 0)

    // Setup Main Camera
    this.cameras.main.setBounds(0, 0, bg.displayWidth, bg.displayHeight)
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09)
    this.cameras.main.zoom = 2

    this.food = this.physics.add.staticGroup({})

    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    ////////////////////////////// CONSUME FOOD ///////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    this.physics.add.overlap(this.player, this.food, (orb, food) => {
      // We really want these arguments to be generic, but alas
      // https://github.com/photonstorm/phaser/issues/5882
      const o = orb as Orb
      if (!o.isEating(food.body.center)) {
        return
      }

      // Destroy the food
      this.food.killAndHide(food)
      food.destroy()

      // TODO: Give food different amounts
      // Grow
      o.grow(2)

      // Adjust zoom as needed
      const z = 2 - 0.002 * o.body.radius
      const zoom = Phaser.Math.Clamp(z, 0.5, 2)
      this.cameras.main.zoomTo(zoom, 1000, Phaser.Math.Easing.Cubic.InOut)
    })

    const socket = io(`http://localhost:9090?id=${this.player.id}`)

    // On other player contact, check if one eats the other.
    // this.physics.add.overlap(this.playerGroup, this.playerGroup, (p1, p2) => {
    //   if (!p1.body.hitTest(p2.body.center.x, p2.body.center.y)) {
    //     return
    //   }
    //   if (p1.data.values.size > p2.data.values.size * 1.2) {
    //     this.playerGroup.killAndHide(p2)
    //     p2.body.enable = false
    //     // p2.destroy()
    //     socket.emit('destroyed', p2.data.values.id)
    //   }
    // })

    // // Broadcast player position on a cadence
    // this.time.addEvent({
    //   delay: 50,
    //   callback: () => {
    //     socket.emit('position', {
    //       id,
    //       x: this.player.x,
    //       y: this.player.y,
    //       size: this.size,
    //     })
    //   },
    //   loop: true,
    // })

    // Update other players
    socket.on('position', (d: PositionEvent) => {
      const player:
        | Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
        | undefined = this.layers.players
        .getChildren()
        .find(
          (go) => go.data.values.id === d.id
        ) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody

      if (!player) {
        const player = this.physics.add.sprite(d.x, d.y, 'player')
        player.setData({ id: d.id, size: d.size })
        player.setOrigin(0.5, 0.5)
        player.body.setCircle(64)
        this.layers.players.add(player)
        // this.playerGroup.add(player)
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
      if (remote === this.player.id) {
        // this.dead = true
      }
    })
  }

  /////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////// UPDATE ///////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////
  update(t: number, dt: number) {
    // if (this.dead) {
    //   this.player.destroy()
    //   return
    // }
    const { x, y } = this.getMouseCoords()
    this.player.moveTo(dt, x, y)

    if (t - this.last > 1000) {
      const i = Phaser.Math.Between(1, 9)
      const foodX = Phaser.Math.Between(0, 1024)
      const foodY = Phaser.Math.Between(0, 1024)
      const created: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody =
        this.food.create(foodX, foodY, `food_${i}`)

      created.setCircle(16)
      created.setOrigin(0.5, 0.5)
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
