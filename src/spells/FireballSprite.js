import Phaser from 'phaser'

export const FIREBALL_PROJECTILE_KEY = 'fireballProjectile'
export const FIREBALL_PROJECTILE_ANIM_KEY = `${FIREBALL_PROJECTILE_KEY}_idle`

export default class FireballSprite extends Phaser.GameObjects.Sprite {
	constructor(scene, config = {}) {
		const x = config.x ?? 0
		const y = config.y ?? 0
		super(scene, x, y, FIREBALL_PROJECTILE_KEY)

		this.scene = scene
		this.baseScale = config.scale ?? 1
		this.baseDepth = config.depth ?? 190
		this.baseBlendMode = config.blendMode ?? Phaser.BlendModes.ADD
		this.autoAdd = config.autoAdd ?? true

		if (this.autoAdd) {
			this.scene.add.existing(this)
		}

		this.setScale(this.baseScale)
		this.setDepth(this.baseDepth)
		this.setBlendMode(this.baseBlendMode)
	}

	create() {
		FireballSprite.ensureAnimation(this.scene)
		this.play({ key: FIREBALL_PROJECTILE_ANIM_KEY, repeat: -1 })
		this.setData('autoPlayAnimKey', FIREBALL_PROJECTILE_ANIM_KEY)
		this.setData('autoPlayRepeat', -1)
		return this
	}

	pauseAnimation() {
		if (this.anims?.isPlaying) {
			this.anims.pause()
		}
	}

	resumeAnimation() {
		if (!this.anims) return
		if (this.anims.isPaused) {
			this.anims.resume()
		} else if (!this.anims.isPlaying) {
			this.play({ key: FIREBALL_PROJECTILE_ANIM_KEY, repeat: -1 })
		}
	}

	static ensureAnimation(scene) {
		if (!scene?.anims) return
		if (scene.anims.exists(FIREBALL_PROJECTILE_ANIM_KEY)) return
		scene.anims.create({
			key: FIREBALL_PROJECTILE_ANIM_KEY,
			frames: scene.anims.generateFrameNumbers(FIREBALL_PROJECTILE_KEY, { start: 0, end: 3 }),
			frameRate: 12,
			repeat: -1,
		})
	}
}
