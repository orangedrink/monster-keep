import Phaser from 'phaser'

const DEFAULT_INTENSITY = 1
const DEFAULT_DURATION = 900
const MIN_INTENSITY = 0.2
const MAX_INTENSITY = 5

/**
 * Small green goo burst that mirrors the smoke effect but keeps to slime colors.
 */
export default function createSlimeExplosionEffect(scene, opts = {}) {
	const {
		x = 0,
		y = 0,
		intensity = DEFAULT_INTENSITY,
		duration = DEFAULT_DURATION,
	} = opts

	const clampedIntensity = Phaser.Math.Clamp(intensity, MIN_INTENSITY, MAX_INTENSITY)
	const dropletCount = Math.max(4, Math.round(5 * clampedIntensity))
	const handle = {
		destroyed: false,
		droplets: [],
		destroy() {
			if (this.destroyed) return
			this.destroyed = true
			this.droplets.forEach((d) => d?.destroy())
			this.droplets.length = 0
		},
	}

	for (let i = 0; i < dropletCount; i++) {
		const radius = Phaser.Math.Between(3, 8) * clampedIntensity * 0.35
		const alpha = Phaser.Math.FloatBetween(0.8, 1)
		const droplet = scene.add.circle(x, y, radius, 0x72ff3b, alpha)
		droplet.setBlendMode(Phaser.BlendModes.ADD)
		handle.droplets.push(droplet)

		const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
		const distance = Phaser.Math.Between(18, 64) * clampedIntensity
		const targetX = x + Math.cos(angle) * distance
		const targetY = y + Math.sin(angle) * distance
		const tweenDuration = Phaser.Math.Between(duration * 0.6, duration * 1.15)
		const startScale = Phaser.Math.FloatBetween(0.7, 1)
		const endScale = startScale * Phaser.Math.FloatBetween(1.1, 1.8)

		scene.tweens.add({
			targets: droplet,
			x: targetX,
			y: targetY,
			alpha: { from: alpha, to: 0 },
			scale: { from: startScale, to: endScale },
			duration: tweenDuration,
			ease: 'Quad.easeOut',
			onComplete: () => droplet.destroy(),
		})
	}

	return handle
}
