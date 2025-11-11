import Phaser from 'phaser'

export const FIREBALL_PARTICLE_TEXTURE_KEY = 'spell-fireball-pixel'

export function ensureFireballParticleTexture(scene) {
	if (scene.textures.exists(FIREBALL_PARTICLE_TEXTURE_KEY)) return FIREBALL_PARTICLE_TEXTURE_KEY
	const gfx = scene.make.graphics({ add: false })
	const width = 48
	const height = 2
	gfx.fillStyle(0xfff8da, 1)
	gfx.fillRoundedRect(0, 0, width, height, height * 2)
	gfx.fillStyle(0xffc857, 1)
	gfx.fillRoundedRect(width * 0.2, height * 0.2, width * 0.65, height * 0.6, height * 0.3)
	gfx.fillStyle(0xff5e0e, 0.9)
	gfx.fillRoundedRect(width * 0.45, height * 0.3, width * 0.45, height * 0.4, height * 0.2)
	gfx.generateTexture(FIREBALL_PARTICLE_TEXTURE_KEY, width, height)
	gfx.destroy()
	return FIREBALL_PARTICLE_TEXTURE_KEY
}

export default function createFireballEffect(scene, opts = {}) {
	const {
		x = 0,
		y = 0,
		radius = 14,
		duration = 420,
	} = opts

	const particleTexture = ensureFireballParticleTexture(scene)
	const explosion = scene.add.particles(x, y, particleTexture, {
		x,
		y,
		quantity: 18,
		lifespan: { min: 260, max: 520 },
		speed: { min: 80, max: 220 },
		scale: { start: 0.5, end: 0 },
		alpha: { start: 1, end: 0 },
		rotate: { min: 0, max: 360 },
		tint: [0xfff2a6, 0xffc857, 0xff7b00, 0xff3c00],
		blendMode: Phaser.BlendModes.ADD,
		gravityY: 0,
		on: false,
	})
	explosion.setDepth(181)
	explosion.explode(20, x, y)

	const embers = scene.add.particles(x, y, particleTexture, {
		x,
		y,
		frequency: 30,
		lifespan: { min: 180, max: 320 },
		speed: { min: 10, max: 40 },
		scale: { start: 0.25, end: 0 },
		tint: [0xfff6c5, 0xffd166, 0xff5e0e],
		blendMode: Phaser.BlendModes.ADD,
		alpha: { start: 0.9, end: 0 },
	})
	embers.setDepth(180)
	scene.time.delayedCall(duration, () => embers.stop())
	scene.time.delayedCall(duration + 400, () => embers.destroy())

	const core = scene.add.circle(x, y, radius, 0xff6b00, 0.95)
	core.setBlendMode(Phaser.BlendModes.ADD).setDepth(182)
	const halo = scene.add.circle(x, y, radius * 2.6, 0xffd166, 0.35)
	halo.setBlendMode(Phaser.BlendModes.ADD).setDepth(180)

	scene.tweens.add({
		targets: [core, halo],
		scale: { from: 0.65, to: 1.6 },
		alpha: { from: 1, to: 0 },
		duration,
		ease: 'Cubic.easeOut',
		onComplete: () => {
			core.destroy()
			halo.destroy()
		},
	})

	scene.time.delayedCall(duration + 500, () => explosion.destroy())

	return {
		_emitters: [explosion, embers],
		destroyed: false,
		destroy() {
			if (this.destroyed) return
			this.destroyed = true
			core.destroy()
			halo.destroy()
			this._emitters.forEach((emitter) => {
				emitter?.stop(true)
				emitter?.destroy()
			})
		},
	}
}
