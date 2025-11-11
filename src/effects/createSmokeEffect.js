import Phaser from 'phaser'

const DEFAULT_INTENSITY = 1
const DEFAULT_DURATION = 1200
const MIN_INTENSITY = 0.25
const MAX_INTENSITY = 6

/**
 * Creates a lightweight tween-driven smoke/steam burst.
 * @param {Phaser.Scene} scene - Scene that owns the effect.
 * @param {object} opts - Effect options.
 * @param {number} opts.x - Spawn x coordinate.
 * @param {number} opts.y - Spawn y coordinate.
 * @param {number} [opts.intensity=1] - Strength multiplier; controls puff count, drift and size.
 * @param {number} [opts.duration=1200] - Base tween duration in ms.
 * @returns {{destroy: Function}} handle with destroy convenience.
 */
export default function createSmokeEffect(scene, opts = {}) {
	const {
		x = 0,
		y = 0,
		intensity = DEFAULT_INTENSITY,
		duration = DEFAULT_DURATION,
	} = opts

	const intensityClamped = Phaser.Math.Clamp(intensity, MIN_INTENSITY, MAX_INTENSITY)
	const puffCount = Math.max(1, Math.round(3 * intensityClamped))
	const handle = {
		destroyed: false,
		puffs: [],
		destroy() {
			if (this.destroyed) return
			this.destroyed = true
			this.puffs.forEach((puff) => puff?.destroy())
			this.puffs.length = 0
		},
	}

	for (let i = 0; i < puffCount; i++) {
		const radius = Phaser.Math.Between(6, 14) * intensityClamped * 0.5
		const puff = scene.add.circle(x, y, radius, 0xf2f2f2, 0.2)
		puff
			.setBlendMode(Phaser.BlendModes.ADD)
			.setScale(Phaser.Math.FloatBetween(0.6, 1))
		handle.puffs.push(puff)

		const horizontalDrift = Phaser.Math.Between(-16, 16) * intensityClamped
		const verticalRise = Phaser.Math.Between(28, 60) * intensityClamped
		const targetScale = Phaser.Math.FloatBetween(1.2, 1.8) * intensityClamped
		const puffDuration = Phaser.Math.Between(duration * 0.8, duration * 1.25)
		const puffDelay = i * 40 + Phaser.Math.Between(0, 80)

		scene.tweens.add({
			targets: puff,
			x: x + horizontalDrift,
			y: y - verticalRise,
			alpha: { from: puff.alpha, to: 0 },
			scale: { from: puff.scale, to: targetScale },
			duration: puffDuration,
			delay: puffDelay,
			ease: 'Sine.easeOut',
			onComplete: () => puff.destroy(),
		})
	}

	return handle
}
