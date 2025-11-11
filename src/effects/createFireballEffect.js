import Phaser from 'phaser'

export const FIREBALL_PARTICLE_TEXTURE_KEY = 'spell-fireball-pixel'


export default function createFireballEffect(scene, opts = {}) {
	const {
		x = 0,
		y = 0,
		radius = 14,
		duration = 420,
	} = opts

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


	return {
		_emitters: [],
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

export function createImpactLight(scene, x, y) {
	const light = scene.lights.addLight(x, y, 140 * scene.gameScale, 0xfff1a1, 1)
	scene.tweens.add({
		targets: light,
		intensity: { from: 1, to: 0 },
		radius: { from: 140 * scene.gameScale, to: 40 * scene.gameScale },
		duration: 260,
		ease: 'Quad.easeOut',
		onComplete: () => scene.lights.removeLight(light),
	})
	return light
}
