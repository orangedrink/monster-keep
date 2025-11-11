import Phaser from 'phaser'

const DEFAULT_INTENSITY = 1
const DEFAULT_DURATION = 700
const MIN_INTENSITY = 0.2
const MAX_INTENSITY = 4

/**
 * Creates a quick burst of glowing embers / sparks.
 * Inspired by createSmokeEffect but tuned for fiery, energetic debris.
 * @param {Phaser.Scene} scene
 * @param {object} opts
 * @param {number} opts.x
 * @param {number} opts.y
 * @param {number} [opts.intensity=1]
 * @param {number} [opts.duration=700]
 * @returns {{destroy: Function}}
 */
export default function createSparkEffect(scene, opts = {}) {
	const {
		x = 0,
		y = 0,
		intensity = DEFAULT_INTENSITY,
		duration = DEFAULT_DURATION,
	} = opts

	const clampedIntensity = Phaser.Math.Clamp(intensity, MIN_INTENSITY, MAX_INTENSITY)
	const sparkCount = Math.max(2, Math.round(6 * clampedIntensity))
	const handle = {
		particles: [],
		destroyed: false,
		destroy() {
			if (this.destroyed) return
			this.destroyed = true
			this.particles.forEach((spark) => spark?.destroy())
			this.particles.length = 0
		},
	}

	for (let i = 0; i < sparkCount; i++) {
		const radius = Phaser.Math.FloatBetween(2, 4) * clampedIntensity
		const colorStops = [0xff9532, 0xff5e0e]
		const tint = Phaser.Utils.Array.GetRandom(colorStops)
		const spark = scene.add.circle(x, y, radius, tint, 1)
		spark
			.setDepth(200)
			.setBlendMode(Phaser.BlendModes.ADD)
		handle.particles.push(spark)

		const driftAngle = Phaser.Math.FloatBetween(0, Math.PI * 2)
			const driftDistance = Phaser.Math.FloatBetween(24, 52) * clampedIntensity
			const driftX = Math.cos(driftAngle) * driftDistance
			const driftY = Math.sin(driftAngle) * driftDistance * 0.6
			const sparkDuration = Phaser.Math.Between(duration * 0.6, duration * 1.2)
			const delay = i * 20

			scene.tweens.add({
				targets: spark,
				x: x + driftX,
				y: y + driftY,
				alpha: { from: 1, to: 0 },
				scale: { from: 1, to: Phaser.Math.FloatBetween(0.2, 0.5) },
				duration: sparkDuration,
				delay,
			ease: 'Quad.easeOut',
			onComplete: () => spark.destroy(),
		})
	}

	return handle
}
