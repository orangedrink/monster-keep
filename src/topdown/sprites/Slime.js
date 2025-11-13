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
		this.chaseSpeed = (config.chaseSpeed ?? 16) * this.scene.gameScale
		this.baseDepth = config.depth ?? 0.9
		this.tileSize = 16 * this.scene.gameScale
		this.lookAheadDistance = this.tileSize * 0.6

		this.scene.physics.add.existing(this)
		this.scene.add.existing(this)
		this.scaleMultiplier = typeof config.scaleMultiplier === 'number'
			? config.scaleMultiplier
			: 1
		this.applyScaleMultiplier(this.scaleMultiplier)
		this.setDepth(this.baseDepth)
	}

	applyScaleMultiplier(multiplier = 1) {
		this.scaleMultiplier = multiplier
		const visualScale = (this.scene?.gameScale ?? 1) * this.scaleMultiplier
		this.setScale(visualScale * 0.5)
		const bodyWidth = this.width * .5
		const bodyHeight = this.height * .5
		if (this.body?.setSize) {
			this.body.setSize(bodyWidth, bodyHeight)
		} else {
			this.setSize(bodyWidth, bodyHeight)
		}
	}

	create() {
		this.setPipeline('Light2D')
		this.play({ key: 'idle', repeat: -1 })
		this.currentAnim = 'idle'
		this.setVelocity(0, 0)
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
		this.updateChaseBehavior()
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

	updateChaseBehavior() {
		const doctor = this.scene?.doctor
		if (!doctor) {
			this.setVelocity(0, 0)
			this.setAnimation('idle')
			return
		}
		const dx = doctor.x - this.x
		const dy = doctor.y - this.y
		const distance = Math.hypot(dx, dy)
		if (!distance || distance < 2) {
			this.setVelocity(0, 0)
			this.setAnimation('idle')
			return
		}
		const { vx, vy } = this.resolveVelocityToward(dx, dy, doctor)
		this.setVelocity(vx, vy)
		if (!vx && !vy) {
			this.setAnimation('idle')
			return
		}
		this.playMovementAnim(vx, vy)
	}

	destroy(fromScene) {
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

	resolveVelocityToward(dx, dy, doctor) {
		const speed = this.chaseSpeed
		const collisionData = this.scene?.topdown?.collisionData
		if (!collisionData?.length) {
			const distance = Math.hypot(dx, dy) || 1
			return {
				vx: (dx / distance) * speed,
				vy: (dy / distance) * speed,
			}
		}
		const direction = new Phaser.Math.Vector2(dx, dy)
		if (!direction.lengthSq()) {
			return { vx: 0, vy: 0 }
		}
		direction.normalize()
		const desiredX = direction.x * speed
		const desiredY = direction.y * speed
		if (this.canMoveWithVelocity(desiredX, desiredY)) {
			return { vx: desiredX, vy: desiredY }
		}
		const axisOrder = Math.abs(dx) > Math.abs(dy) ? ['x', 'y'] : ['y', 'x']
		for (const axis of axisOrder) {
			const axisVelocity = axis === 'x' ? desiredX : desiredY
			if (axisVelocity === 0) continue
			const candidate = axis === 'x'
				? { vx: axisVelocity, vy: 0 }
				: { vx: 0, vy: axisVelocity }
			if (this.canMoveWithVelocity(candidate.vx, candidate.vy)) {
				return candidate
			}
		}
		const slideVelocity = this.findSlideVelocity(doctor)
		if (slideVelocity) {
			return slideVelocity
		}
		return { vx: 0, vy: 0 }
	}

	findSlideVelocity(target) {
		if (!target) return null
		const speed = this.chaseSpeed
		const options = [
			{ vx: speed, vy: 0 },
			{ vx: -speed, vy: 0 },
			{ vx: 0, vy: speed },
			{ vx: 0, vy: -speed },
		]
		options.sort((a, b) => {
			return this.getProjectedDistanceToTarget(a.vx, a.vy, target) - this.getProjectedDistanceToTarget(b.vx, b.vy, target)
		})
		for (const option of options) {
			if (this.canMoveWithVelocity(option.vx, option.vy)) {
				return option
			}
		}
		return null
	}

	getProjectedDistanceToTarget(vx, vy, target) {
		const projected = this.getProjectedPosition(vx, vy, this.tileSize)
		return Phaser.Math.Distance.Between(projected.x, projected.y, target.x, target.y)
	}

	canMoveWithVelocity(vx, vy) {
		if (!vx && !vy) return true
		const projected = this.getProjectedPosition(vx, vy)
		return !this.isAreaBlockedAt(projected.x, projected.y)
	}

	getProjectedPosition(vx, vy, distance = this.lookAheadDistance) {
		const magnitude = Math.hypot(vx, vy)
		if (!magnitude) {
			return { x: this.x, y: this.y }
		}
		const scale = distance / magnitude
		return {
			x: this.x + vx * scale,
			y: this.y + vy * scale,
		}
	}

		isAreaBlockedAt(x, y) {
			const halfW = (this.body?.width ?? this.width ?? 16) / 10
			const halfH = (this.body?.height ?? this.height ?? 16) / 10
			const points = [
				{ x, y },
				{ x: x - halfW, y },
				{ x: x + halfW, y },
				{ x, y: y - halfH },
				{ x, y: y + halfH },
				{ x: x - halfW, y: y - halfH },
				{ x: x + halfW, y: y - halfH },
				{ x: x - halfW, y: y + halfH },
				{ x: x + halfW, y: y + halfH },
			]
			return points.some((point) => this.isBlockedAt(point.x, point.y))
		}

	isBlockedAt(worldX, worldY) {
		const data = this.scene?.topdown?.collisionData
		if (!data?.length) {
			return false
		}
		const tileX = Math.floor(worldX / this.tileSize)
		const tileY = Math.floor(worldY / this.tileSize)
		if (tileY < 0 || tileX < 0) return true
		const row = data[tileY]
		if (!row) return true
		const tile = row[tileX]
		return tile === 1
	}
}
