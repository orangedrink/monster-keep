import Slime from './Slime.js'

export default class AlliedSlime extends Slime {
	constructor(scene, config = {}) {
		super(scene, { ...config, isFriendly: true })
		this.friend = true
		this.attackPower = typeof config.attackPower === 'number' ? config.attackPower : 0.35
		this.selfDamage = typeof config.selfDamage === 'number' ? config.selfDamage : 0.15
		const baseRange = 280 * (scene?.gameScale ?? 1)
		this.seekRange = typeof config.seekRange === 'number' ? config.seekRange : baseRange
		this.retargetDelay = typeof config.retargetDelay === 'number' ? config.retargetDelay : 180
		this.lastRetargetTime = 0
		this.patrolPointActive = false
	}

	updateChaseBehavior() {
		if (!this.body) return
		const target = this.resolveAllyTarget()
		if (!target) {
			this.patrolNearDoctor()
			return
		}
		const dx = target.x - this.x
		const dy = target.y - this.y
		const distance = Math.hypot(dx, dy)
		if (!distance || distance < 2) {
			this.setVelocity(0, 0)
			this.setAnimation('idle')
			return
		}
		const { vx, vy } = this.resolveVelocityToward(dx, dy, target)
		this.setVelocity(vx, vy)
		if (!vx && !vy) {
			this.setAnimation('idle')
			return
		}
		this.playMovementAnim(vx, vy)
	}

	resolveAllyTarget() {
		const scene = this.scene
		if (!scene) return null
		const now = scene.time?.now ?? (typeof performance !== 'undefined' ? performance.now() : Date.now())
		const needsRetarget = !this.currentTarget || !this.currentTarget.active || (now - this.lastRetargetTime >= this.retargetDelay)
		if (needsRetarget) {
			this.currentTarget = scene.findNearestEnemyToPoint({ x: this.x, y: this.y }, { range: this.seekRange })
			this.lastRetargetTime = now
		}
		return this.currentTarget
	}

	patrolNearDoctor() {
		if (!this.body) return
		const doctor = this.scene?.doctor
		if (!doctor) {
			this.setVelocity(0, 0)
			this.setAnimation('idle')
			return
		}
		const currentDist = Phaser.Math.Distance.Between(this.x, this.y, doctor.x, doctor.y)
		const tetherRadius = 120 * (this.scene?.gameScale ?? 1)
		const needsNewPoint = !this.patrolPoint || currentDist > tetherRadius * 1.35 || !this.patrolPointActive
		if (needsNewPoint) {
			this.stopPatrolMovement()
			this.patrolPoint = this.pickValidPatrolPoint(doctor, tetherRadius)
			this.patrolPointActive = true
			this.playMovementAnim(this.patrolPoint.x - this.x, this.patrolPoint.y - this.y)
			const patrolSpeed = Math.max(10, (this.chaseSpeed || 0) * 0.5)
			const dx = this.patrolPoint.x - this.x
			const dy = this.patrolPoint.y - this.y
			const dist = Math.hypot(dx, dy) || 1
			if (this.scene?.physics?.moveToObject) {
				this.scene.physics.moveToObject(this, this.patrolPoint, patrolSpeed)
				this.patrolMoveTimer = this.scene.time?.delayedCall?.((dist / patrolSpeed) * 1000, () => {
					this.patrolPointActive = false
					this.setAnimation('idle')
					if (this.body) {
						this.setVelocity(0, 0)
					}
					this.patrolMoveTimer = null
				})
			} else if (this.scene?.physics?.moveTo) {
				this.scene.physics.moveTo(this, this.patrolPoint.x, this.patrolPoint.y, patrolSpeed)
				this.patrolMoveTimer = this.scene.time?.delayedCall?.((dist / patrolSpeed) * 1000, () => {
					this.patrolPointActive = false
					this.setAnimation('idle')
					this.setVelocity(0, 0)
					this.patrolMoveTimer = null
				})
			} else {
				this.moveTween = this.scene?.tweens?.add({
					targets: this,
					x: this.patrolPoint.x,
					y: this.patrolPoint.y,
					duration: 1000,
					ease: 'Sine.easeInOut',
					onComplete: () => {
						this.patrolPointActive = false
						this.setAnimation('idle')
						this.setVelocity(0, 0)
						this.moveTween = null
					},
				})
			}
		}
	}

	pickValidPatrolPoint(doctor, tetherRadius) {
		const attempts = 10
		for (let i = 0; i < attempts; i++) {
			const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
		const distance = Phaser.Math.FloatBetween(tetherRadius * 0.25, tetherRadius * 0.75)
			const candidate = {
				x: doctor.x + Math.cos(angle) * distance,
				y: doctor.y + Math.sin(angle) * distance,
			}
			if (this.isValidPatrolDestination(candidate.x, candidate.y)) {
				return candidate
			}
		}
		return { x: doctor.x, y: doctor.y }
	}

	isValidPatrolDestination(x, y) {
		if (typeof this.isAreaBlockedAt === 'function' && this.isAreaBlockedAt(x, y)) {
			return false
		}
		return this.isPathClearToPoint(x, y)
	}

	isPathClearToPoint(targetX, targetY) {
		if (typeof this.isAreaBlockedAt !== 'function') {
			return true
		}
		const dx = targetX - this.x
		const dy = targetY - this.y
		const distance = Math.hypot(dx, dy)
		if (!distance) {
			return true
		}
		const tileSize = this.tileSize || (16 * (this.scene?.gameScale ?? 1))
		const stepDistance = Math.max(8, tileSize * 0.6)
		const steps = Math.max(1, Math.ceil(distance / stepDistance))
		const stepX = dx / steps
		const stepY = dy / steps
		for (let i = 1; i <= steps; i++) {
			const sampleX = this.x + stepX * i
			const sampleY = this.y + stepY * i
			if (this.isAreaBlockedAt(sampleX, sampleY)) {
				return false
			}
		}
		return true
	}

	stopPatrolMovement() {
		if (this.patrolMoveTimer) {
			this.patrolMoveTimer.remove?.()
			this.patrolMoveTimer = null
		}
		if (this.moveTween) {
			this.moveTween.stop()
			this.moveTween = null
		}
		if (this.body) {
			this.setVelocity(0, 0)
		}
		this.patrolPointActive = false
	}
}
