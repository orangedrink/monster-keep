import Phaser from 'phaser'

export default class Slime extends Phaser.Physics.Arcade.Sprite {
	constructor(scene, config = {}) {
		const x = config.x ?? 0
		const y = config.y ?? 0
		super(scene, x, y, 'slime')

		this.scene = config.scene ?? scene
		this.home = new Phaser.Math.Vector2(x, y)
		this.wanderRadius = (config.wanderRadius ?? 60) * this.scene.gameScale
		this.moveDuration = config.moveDuration ?? 1600
		this.baseDepth = config.depth ?? 0.9

		this.scene.physics.add.existing(this)
		this.scene.add.existing(this)
		this.setScale(this.scene.gameScale)
		this.setDepth(this.baseDepth)
		this.setSize(20, 16)
	}

	create() {
		this.setPipeline('Light2D')
		this.play({ key: 'idle', repeat: -1 })
		this.currentAnim = 'idle'
		this.scheduleNextMove()
	}

	scheduleNextMove() {
		if (this.pauseEvent) {
			this.pauseEvent.remove()
		}
		this.pauseEvent = this.scene.time.delayedCall(
			Phaser.Math.Between(250, 850),
			() => this.startMove(),
		)
	}

	startMove() {
		const target = this.getRandomPoint()
		if (this.moveTween) {
			this.moveTween.stop()
		}
		this.playMovementAnim(target.x - this.x, target.y - this.y)
		this.moveTween = this.scene.tweens.add({
			targets: this,
			x: target.x,
			y: target.y,
			duration: Phaser.Math.Between(this.moveDuration * 0.6, this.moveDuration * 1.3),
			ease: 'Sine.easeInOut',
			onComplete: () => {
				this.setAnimation('idle')
				this.scheduleNextMove()
			},
		})
	}

	getRandomPoint() {
		const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
		const distance = Phaser.Math.Between(this.wanderRadius * 0.2, this.wanderRadius)
		return {
			x: this.home.x + Math.cos(angle) * distance,
			y: this.home.y + Math.sin(angle) * distance,
		}
	}

	update() {
		if (this.scene.lights && !this.light) {
			this.light = this.scene.lights.addLight(
				this.x,
				this.y,
				50 * this.scene.gameScale,
				0x66ff88,
				0.35,
			)
		}
		if (this.light) {
			this.light.setPosition(this.x, this.y)
		}
	}

	playMovementAnim(dx, dy) {
		const anim = this.getAnimForVector(dx, dy)
		this.setAnimation(anim)
	}

	getAnimForVector(dx, dy) {
		if (Math.abs(dx) > Math.abs(dy)) {
			return dx > 0 ? 'walk-e' : 'walk-w'
		}
		return dy > 0 ? 'walk-s' : 'walk-n'
	}

	setAnimation(key) {
		if (this.currentAnim === key) return
		this.currentAnim = key
		this.play({ key, repeat: -1 })
	}

	destroy(fromScene) {
		if (this.light) {
			this.scene.lights.removeLight(this.light)
			this.light = null
		}
		if (this.moveTween) {
			this.moveTween.stop()
			this.moveTween = null
		}
		if (this.pauseEvent) {
			this.pauseEvent.remove()
			this.pauseEvent = null
		}
		super.destroy(fromScene)
	}
}
