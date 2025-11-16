import Phaser from 'phaser'

export const SHADOWBOLT_PROJECTILE_KEY = 'shadowboltProjectile'
export const SHADOWBOLT_PROJECTILE_ANIM_KEY = `${SHADOWBOLT_PROJECTILE_KEY}_idle`

export default class ShadowboltSprite extends Phaser.GameObjects.Sprite {
	constructor(scene, config = {}) {
		const x = config.x ?? 0
		const y = config.y ?? 0
		super(scene, x, y, SHADOWBOLT_PROJECTILE_KEY, 'ShadowBolt_0 0.png')

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
		ShadowboltSprite.ensureAnimation(this.scene)
		this.play({ key: SHADOWBOLT_PROJECTILE_ANIM_KEY, repeat: -1 })
		this.setData('autoPlayAnimKey', SHADOWBOLT_PROJECTILE_ANIM_KEY)
		this.setData('autoPlayRepeat', -1)
		return this
	}

	static ensureAnimation(scene) {
		if (!scene?.anims) return
		if (scene.anims.exists(SHADOWBOLT_PROJECTILE_ANIM_KEY)) return
		scene.anims.create({
			key: SHADOWBOLT_PROJECTILE_ANIM_KEY,
			frames: scene.anims.generateFrameNames(SHADOWBOLT_PROJECTILE_KEY, {
				start: 0,
				end: 3,
				prefix: 'ShadowBolt_0 ',
				suffix: '.png',
			}),
			frameRate: 12,
			repeat: -1,
		})
	}
}
