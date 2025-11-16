import Phaser from 'phaser'

const DEFAULT_INTENSITY = 1
const DEFAULT_DURATION = 600
const MIN_INTENSITY = 0.2
const MAX_INTENSITY = 3

export default function createShadowSparkEffect(scene, opts = {}) {
	const {
		x = 0,
		y = 0,
		intensity = DEFAULT_INTENSITY,
		duration = DEFAULT_DURATION,
	} = opts

	const clampedIntensity = Phaser.Math.Clamp(intensity, MIN_INTENSITY, MAX_INTENSITY)
	const sparkCount = Math.max(2, Math.round(3 * clampedIntensity))
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
		const radius = Phaser.Math.FloatBetween(1.5, 3) * clampedIntensity
		const colorStops = [0xa7ff5f, 0x7df23c, 0x79ff8b]
		const tint = Phaser.Utils.Array.GetRandom(colorStops)
		const spark = scene.add.circle(x, y, radius, tint, 0.9)
		spark
			.setDepth(200)
			.setBlendMode(Phaser.BlendModes.ADD)
		handle.particles.push(spark)

		const driftAngle = Phaser.Math.FloatBetween(0, Math.PI * 2)
		const driftDistance = Phaser.Math.FloatBetween(28, 56) * clampedIntensity
		const driftX = Math.cos(driftAngle) * driftDistance
		const driftY = Math.sin(driftAngle) * driftDistance * 0.6
		const sparkDuration = Phaser.Math.Between(duration * 0.5, duration * 0.85)
		const delay = i * 20

		scene.tweens.add({
			targets: spark,
			x: x + driftX,
			y: y + driftY,
			alpha: { from: 0.9, to: 0 },
			scale: { from: 1, to: Phaser.Math.FloatBetween(0.15, 0.4) },
			duration: sparkDuration,
			delay,
			ease: 'Quad.easeOut',
			onComplete: () => spark.destroy(),
		})
	}

	return handle
}
