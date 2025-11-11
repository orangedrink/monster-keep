import Phaser from 'phaser'
import BaseScene from './BaseScene.js'
import Dialog from './ui/Dialog.js'
import createFireballEffect from './effects/createFireballEffect.js'
import Slime from './topdown/sprites/Slime.js'
const FIREBALL_PROJECTILE_KEY = 'fireballProjectile'
const FIREBALL_PROJECTILE_ANIM_KEY = `${FIREBALL_PROJECTILE_KEY}_idle`
var levelScripts = [
	{
		trigger: (scene) => {
			console.log('checking createdRun trigger', scene.triggers.createdRun);
			return !scene.triggers.createdRun
		},
		action: (scene) => {
			scene.triggers.createdRun = true;
			scene.panelDialog = new Dialog(scene, {
				type: 'balloon', messages: [{
					target: scene.doctor,
					text: 'Mortal beware!!',
					rightside: false
				}, {
					target: scene.doctor,
					text: 'you have entered the monster condo!',
					rightside: true,
				}, {
					target: scene.doctor,
					text: 'I used to have a mansion but it was too much walking. got so bored.',
					rightside: true,
				}, {
					target: scene.doctor,
					text: 'explore by clicking on or touching a destination',
					rightside: true,
				}, {
					target: scene.doctor,
					text: 'pick a destinaton now',
					rightside: false,
					callback: () => {
						scene.doctor.paused = false
					}
				}]
			})
		}
	}, {
		trigger: (scene) => {
			return !scene.doctor.waypoints.length && (Math.abs(scene.doctor.x - scene.startx) > 100 || Math.abs(scene.doctor.y - scene.starty) > 100) && !scene.walked
		},
		action: (scene) => {
			scene.walked = true
			setTimeout(() => {
				scene.panelDialog = new Dialog(scene, {
					type: 'balloon', messages: [{
						target: scene.doctor,
						text: 'Great!!',
						rightside: false
					}, {
						target: scene.doctor,
						text: 'now that you can get around take a look at the menu',
						rightside: true,
					}, {
						target: scene.doctor,
						text: 'click or touch the menu bar now to open the menu',
						rightside: false,
						callback: () => {
							//scene.doctor.paused=false
							scene.add.tween({
								targets: [scene.menu],
								ease: 'Linear',
								alpha: 1,
								duration: 800,
								onComplete: () => {
									scene.doctor.paused = false
								}
							});
							//scene.doctor.y-window.innerHeight/2+10
						}
					}]
				})
			}, 300)
		}
	}
]

const titleSpells = [{
	key: 'fireball',
	label: 'Fireball',
	iconColor: 0xff6b18,
	autoTargetNearestEnemy: true,
	cooldownMs: 700,
	createIcon: (scene, { size }) => {
		ensureFireballAnimation(scene)
		const iconScale = (size / 44) * 0.7
		const icon = scene.add.sprite(size / 2, size / 2, FIREBALL_PROJECTILE_KEY)
			.setScale(iconScale)
			.setBlendMode(Phaser.BlendModes.ADD)
		icon.anims?.play(FIREBALL_PROJECTILE_ANIM_KEY)
		icon.anims?.setRepeat(-1)
		icon.setData?.('autoPlayAnimKey', FIREBALL_PROJECTILE_ANIM_KEY)
		icon.setData?.('autoPlayRepeat', -1)
		return icon
	},
	onCast: (scene, target) => {
		const start = { x: scene.doctor?.x ?? target.x, y: scene.doctor?.y ?? target.y }
		const fireProjectile = (delay = 0) => {
			ensureFireballAnimation(scene)
			const projectile = scene.add.sprite(start.x, start.y, FIREBALL_PROJECTILE_KEY)
			const baseScale = 0.32 * scene.gameScale
			projectile
				.setDepth(190)
				.setScale(baseScale)
				.setBlendMode(Phaser.BlendModes.ADD)
			projectile.anims?.play(FIREBALL_PROJECTILE_ANIM_KEY)
			projectile.anims?.setRepeat(-1)
			const finishProjectile = () => {
				createFireballEffect(scene, { x: target.x, y: target.y })
				scene.createSmokeEffect(target.x, target.y, 2, 900)
				createImpactLight(scene, target.x, target.y)
				scene.destroyEnemiesAt(target.x, target.y, 26 * scene.gameScale)
				projectile.destroy()
			}

			const startVec = new Phaser.Math.Vector2(start.x, start.y)
			const targetVec = new Phaser.Math.Vector2(target.x, target.y)
			const direction = targetVec.clone().subtract(startVec)
			const distance = direction.length()
			if (distance === 0) {
				direction.set(1, 0)
			}
			direction.normalize()
			const perp = new Phaser.Math.Vector2(-direction.y, direction.x)
			const angleRad = Phaser.Math.Angle.Between(start.x, start.y, target.x, target.y)
			projectile.setRotation(angleRad)
			const maxOffset = distance * 0.15
			const offsetMag = Phaser.Math.FloatBetween(-maxOffset, maxOffset)
			const speed = Phaser.Math.Between(460, 530)
			if (distance < 4) {
				scene.time.delayedCall(delay, finishProjectile)
				return
			}
			const travelTimeMs = (distance / speed) * 1000
			let elapsed = 0
			const startX = startVec.x
			const startY = startVec.y
			const dirX = direction.x
			const dirY = direction.y
			const perpX = perp.x
			const perpY = perp.y
			let lastSmokeEmit = 0
			const updateHandler = (time, delta) => {
				elapsed += delta
				const progress = Math.min(1, elapsed / travelTimeMs)
				const traveled = distance * progress
				const wobble = Math.sin(progress * Math.PI) * offsetMag
				const posX = startX + dirX * traveled + perpX * wobble
				const posY = startY + dirY * traveled + perpY * wobble
				projectile.setPosition(posX, posY)
				if (elapsed - lastSmokeEmit >= 60) {
					scene.createSmokeEffect(posX, posY, .75, 600)
					scene.createSparkEffect(posX, posY, 1, 3600)
					lastSmokeEmit = elapsed
				}
				if (progress >= 1) {
					scene.events.off(Phaser.Scenes.Events.UPDATE, updateHandler)
					finishProjectile()
				}
			}
			scene.time.delayedCall(delay, () => {
				scene.events.on(Phaser.Scenes.Events.UPDATE, updateHandler)
			})
		}
		[0,1,2].forEach((i) => fireProjectile(i * 90))
	},
}]

export default class TitleScene extends BaseScene {
	constructor() {
		super('title', {
			levelData: 'topdown/tiles/titleScreen.json',
			levelScripts: levelScripts,
			spells: titleSpells
		})
	}

	preload() {
		super.preload()
		this.load.aseprite(FIREBALL_PROJECTILE_KEY, 'condo/spells/fireball.png', 'condo/spells/fireball.json')
	}

	getEnemySpawnerConfigs() {
		const baseConfig = {
			spriteClass: Slime,
			interval: 1500,
			position: {
				jitterX: 32,
				jitterY: 16,
			},
			spawnConfig: {
				wanderRadius: 90,
				chaseSpeed: 16,
			},
		}
		return [
			{
				...baseConfig,
				key: 'slime-east',
				position: { ...baseConfig.position, offsetX: 640 },
			},
			{
				...baseConfig,
				key: 'slime-west',
				position: { ...baseConfig.position, offsetX: -640 },
			},
		]
	}

}

function createImpactLight(scene, x, y) {
	const light = scene.lights.addLight(x, y, 140 * scene.gameScale, 0xfff1a1, 1)
	scene.tweens.add({
		targets: light,
		intensity: { from: 1, to: 0 },
		radius: { from: 140 * scene.gameScale, to: 40 * scene.gameScale },
		duration: 260,
		ease: 'Quad.easeOut',
		onComplete: () => scene.lights.removeLight(light),
	})
}

function ensureFireballAnimation(scene) {
	if (!scene?.anims) return
	if (scene.anims.exists(FIREBALL_PROJECTILE_ANIM_KEY)) return
	const animations = scene.anims.createFromAseprite(FIREBALL_PROJECTILE_KEY) || []
	const anim = animations.find((a) => a.key === FIREBALL_PROJECTILE_ANIM_KEY)
	if (anim) {
		anim.frameRate = anim.frameRate || 12
	}
}
