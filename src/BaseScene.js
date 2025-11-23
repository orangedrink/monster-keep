import Phaser from 'phaser'
import Topdown from './topdown/Topdown.js'
import Doctor from './topdown/Doctor.js'
import Slime from './topdown/sprites/Slime.js'
import AlliedSlime from './topdown/sprites/AlliedSlime.js'
import Menu from './ui/Menu.js'
import createSmokeEffect from './effects/createSmokeEffect.js'
import createSparkEffect from './effects/createSparkEffect.js'
import createShadowSparkEffect from './effects/createShadowSparkEffect.js'
import createSlimeExplosionEffect from './effects/createSlimeExplosionEffect.js'
import createFireballEffect, { createImpactLight } from './effects/createFireballEffect.js'
import FireballSprite, { FIREBALL_PROJECTILE_KEY } from './spells/FireballSprite.js'
import ShadowboltSprite, { SHADOWBOLT_PROJECTILE_KEY } from './spells/ShadowboltSprite.js'

const GROW_TWEEN = {
	alpha: { from: .5, to: 1 },
	scale: { from: 0.05, to: 2 },
	duration: 180,
	ease: 'Quad.easeOut',
};


const TITLE_SPRITE_DATA = [{
	name: 'doctor',
	imageFile: 'topdown/doctor.png',
	dataFile: 'topdown/doctor.json',
	dataName: 'doctorAnim',
	frameWidth: 32,
	frameHeight: 32
}, {
	name: 'slime',
	imageFile: 'topdown/slime.png',
	dataFile: 'topdown/slime.json',
	dataName: 'slimeAnim',
	frameWidth: 20,
	frameHeight: 16
}]

const createProjectileSpellDefinition = ({
	key,
	label,
	iconColor,
	spriteClass,
	projectileScale = 0.65,
	cooldownMs = 100,
	volleyCount = 1,
	spawnSparks = true,
	spawnShadowSparks = false,
	range = Infinity,
}) => ({
	key,
	label,
	iconColor,
	autoTargetNearestEnemy: true,
	cooldownMs,
	targetRange: range,
	createIcon: (scene, { size }) => {
		const iconScale = (size / 44) * 0.7
		const icon = new spriteClass(scene, {
			x: size / 2,
			y: size / 2,
			scale: iconScale,
			depth: 151,
		})
		icon.create()
		return icon
	},
	onCast: (scene, target) => {
		const doctor = scene.doctor
		if (doctor?.setDirection) {
			doctor.setDirection(target.x, target.y)
			doctor.playAnim?.(scene.time?.now ?? 0)
		}
		const start = { x: doctor?.x ?? target.x, y: doctor?.y ?? target.y }
		const fireProjectile = (delay = 0) => {
			const baseScale = projectileScale * scene.gameScale
			const projectile = new spriteClass(scene, {
				x: start.x,
				y: start.y,
				scale: baseScale,
				depth: 190,
			})
			projectile.create()
			const finishProjectile = (impactX = target.x, impactY = target.y) => {
				createFireballEffect(scene, { x: impactX, y: impactY })
				scene.createSmokeEffect(impactX, impactY, 2, 900)
				createImpactLight(scene, impactX, impactY)
				if (spawnSparks) {
					scene.createSparkEffect(impactX, impactY, 1.4, 900)
				} else if (spawnShadowSparks) {
					scene.createShadowSparkEffect(impactX, impactY, 1, 750)
				}
				scene.destroyEnemiesAt(impactX, impactY, 26 * scene.gameScale, 0.5)
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
			const initialAngle = Phaser.Math.Angle.Between(0, 0, direction.x, direction.y)
			projectile.setRotation(initialAngle)
			const maxOffset = distance * 0.15
			let offsetMag
			const playerX = doctor?.x ?? start.x
			if (target.x < playerX) {
				offsetMag = Phaser.Math.FloatBetween(0, maxOffset)
			} else {
				offsetMag = Phaser.Math.FloatBetween(-maxOffset, 0)
			}
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
			let lastPosX = startX
			let lastPosY = startY
			let lastAngle = initialAngle
			const updateHandler = (time, delta) => {
				elapsed += delta
				const progress = Math.min(1, elapsed / travelTimeMs)
				const traveled = distance * progress
				const wobble = Math.sin(progress * Math.PI) * offsetMag
				const posX = startX + dirX * traveled + perpX * wobble
				const posY = startY + dirY * traveled + perpY * wobble
				projectile.setPosition(posX, posY)
				const deltaX = posX - lastPosX
				const deltaY = posY - lastPosY
				if (deltaX !== 0 || deltaY !== 0) {
					lastAngle = Phaser.Math.Angle.Between(0, 0, deltaX, deltaY)
					projectile.setRotation(lastAngle)
				}
				lastPosX = posX
				lastPosY = posY
				if (elapsed - lastSmokeEmit >= 60) {
					scene.createSmokeEffect(posX, posY, 0.75, 600)
					if (spawnSparks) {
						scene.createSparkEffect(posX, posY, 1, 3600)
					} else if (spawnShadowSparks) {
						scene.createShadowSparkEffect(posX, posY, 1.6, 1400)
					}
					lastSmokeEmit = elapsed
				}
				const enemyHit = scene.findEnemyNearPoint({ x: posX, y: posY }, 16 * scene.gameScale)
				if (enemyHit) {
					scene.events.off(Phaser.Scenes.Events.UPDATE, updateHandler)
					finishProjectile(enemyHit.x, enemyHit.y)
					return
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
		for (let i = 0; i < Math.max(1, volleyCount); i++) {
			fireProjectile(i * 90)
		}
	},
})

const SPELL_LIBRARY = {
fireball: createProjectileSpellDefinition({
	key: 'fireball',
	label: 'Fireball',
	iconColor: 0xff6b18,
	spriteClass: FireballSprite,
	projectileScale: 0.65,
	cooldownMs: 230,
	volleyCount: 1,
	spawnSparks: true,
	spawnShadowSparks: false,
	range: 8580,
}),
shadowbolt: createProjectileSpellDefinition({
	key: 'shadowbolt',
	label: 'Shadowbolt',
	iconColor: 0x8c76ff,
	spriteClass: ShadowboltSprite,
	projectileScale: 0.6,
	cooldownMs: 300,
	volleyCount: 2,
	spawnSparks: false,
	spawnShadowSparks: true,
	range: 320,
}),
	fireball2: {
		key: 'fireball2',
		label: 'Firewisp',
		iconColor: 0xffcf33,
		autoTargetNearestEnemy: false,
		requiresTarget: false,
		cooldownMs: 400,
		spawnSparks: true,
		spawnShadowSparks: false,
		createIcon: (scene, { size }) => {
			const iconScale = (size / 44) * 0.7
			const icon = new FireballSprite(scene, {
				x: size / 2,
				y: size / 2,
				scale: iconScale,
				depth: 151,
			})
			icon.create()
			return icon
		},

		onCast: (scene, target) => {
			const doctor = scene.doctor
			if (!doctor) return
			scene.pruneOrbitProjectiles()
			const orbitCount = 3
			const damage = 3
			const radiusBase = (scene.gameScale ?? 1)
			const desiredRadius = 28 * radiusBase
				const tangentialSpeed = 340 * radiusBase
				const followSpeed = 460 * radiusBase
				const velocitySmoothing = 0.16
			const radiusCorrection = 1.4 * radiusBase
				const followThreshold = desiredRadius * 1.8
				const reengageThreshold = desiredRadius * 1.1
				const maxDistanceFromDoctor = desiredRadius * 3
			const maxLifetime = 18000
			const hitRadius = 20 * (scene.gameScale ?? 1)
			const availableSlots = Math.max(0, scene.maxOrbitFireballs - scene.orbitProjectiles.length)
			if (!availableSlots) return
			const spawnCount = Math.min(orbitCount, availableSlots)
				for (let i = 0; i < spawnCount; i++) {
					scene.time.delayedCall(i * 140, () => {
						if (!doctor.active) return
						scene.pruneOrbitProjectiles()
						if (scene.orbitProjectiles.length >= scene.maxOrbitFireballs) return
						const projectile = new FireballSprite(scene, {
							x: doctor.x,
							y: doctor.y,
							scale: 0.55 * (scene.gameScale ?? 1),
							depth: 192,
						})
						projectile.create()
						scene.orbitProjectiles.push(projectile)
						const phase = (i / Math.max(1, spawnCount)) * Math.PI * 2
						let lifetime = 0
							let orbitMode = 'circling'
							const velocity = new Phaser.Math.Vector2(0, 0)
						function cleanup(playEffect = true) {
							scene.events.off(Phaser.Scenes.Events.UPDATE, updateHandler)
							if (projectile.active) {
								if (playEffect) {
									createFireballEffect(scene, { x: projectile.x, y: projectile.y })
									createImpactLight(scene, projectile.x, projectile.y, scene.spawnSparks ? 0x5ff1a1 : null)
								}
								projectile.destroy()
							}
							scene.pruneOrbitProjectiles()
						}
						function updateHandler(time, delta) {
							if (!projectile.active || !doctor.active) {
								cleanup(false)
								return
							}
							const dt = delta / 1000
							lifetime += delta
							let dx = projectile.x - doctor.x
							let dy = projectile.y - doctor.y
							if (dx === 0 && dy === 0) {
								dx = Math.cos(phase) * desiredRadius
								dy = Math.sin(phase) * desiredRadius
							}
							const dist = Math.hypot(dx, dy) || 1
							const normX = dx / dist
							const normY = dy / dist
							const lateralX = -normY
							const lateralY = normX
							const doctorMoving = !!doctor.moving
							if (doctorMoving) {
								if (orbitMode === 'circling' && dist > followThreshold) {
									orbitMode = 'following'
								} else if (orbitMode === 'following' && dist <= reengageThreshold) {
									orbitMode = 'circling'
								}
							} else if (orbitMode !== 'circling') {
								orbitMode = 'circling'
							}
							let desiredVx
							let desiredVy
							if (orbitMode === 'following') {
								const dirX = -normX
								const dirY = -normY
								desiredVx = dirX * followSpeed
								desiredVy = dirY * followSpeed
							} else {
								const radialAdjust = Phaser.Math.Clamp((desiredRadius - dist) / desiredRadius, -1, 1)
								desiredVx = lateralX * tangentialSpeed + normX * radiusCorrection * radialAdjust
								desiredVy = lateralY * tangentialSpeed + normY * radiusCorrection * radialAdjust
							}
							const smoothingFactor = Phaser.Math.Clamp(velocitySmoothing * (delta / 16.6667), 0, 1)
							velocity.x = Phaser.Math.Linear(velocity.x, desiredVx, smoothingFactor)
							velocity.y = Phaser.Math.Linear(velocity.y, desiredVy, smoothingFactor)
							projectile.x += velocity.x * dt
							projectile.y += velocity.y * dt
							let postDx = projectile.x - doctor.x
							let postDy = projectile.y - doctor.y
							const postDist = Math.hypot(postDx, postDy)
							if (postDist > maxDistanceFromDoctor) {
								const outwardX = postDx / postDist
								const outwardY = postDy / postDist
								projectile.x = doctor.x + outwardX * maxDistanceFromDoctor
								projectile.y = doctor.y + outwardY * maxDistanceFromDoctor
								const inwardX = -outwardX
								const inwardY = -outwardY
								velocity.set(inwardX * followSpeed, inwardY * followSpeed)
								orbitMode = 'following'
								postDx = projectile.x - doctor.x
								postDy = projectile.y - doctor.y
							}
							projectile.setRotation(Math.atan2(velocity.y, velocity.x))
							if (scene.time) {
								scene.createSmokeEffect(projectile.x, projectile.y, 0.45, 520)
								scene.createSparkEffect(projectile.x, projectile.y, 1.2, 130)
							}
							const enemy = scene.findEnemyNearPoint({ x: projectile.x, y: projectile.y }, hitRadius)
							if (enemy) {
								scene.destroyEnemiesAt(projectile.x, projectile.y, 26 * scene.gameScale, damage)
								scene.createSmokeEffect(projectile.x, projectile.y, 1.1, 500)
								scene.createSparkEffect(projectile.x, projectile.y, 1.4, 700)
								cleanup()
								return
							}
							if (lifetime >= maxLifetime) {
								cleanup()
							}
						}
						scene.events.on(Phaser.Scenes.Events.UPDATE, updateHandler)
					})
				}
			},
		},
	}

export default class BaseScene extends Phaser.Scene {
	gameScale = Math.round(window.innerWidth / 600)
	gamestate = {}
	maxOrbitFireballs = 3

	constructor(key, props) {
		super(key)
		this.spriteData = props.spriteData || TITLE_SPRITE_DATA;
		this.levelData = props.levelData;
		this.levelScripts = props.levelScripts;
		this.triggers = {};
		this.spellKeys = props.spells || ['fireball', 'shadowbolt', 'fireball2'];
		this.spellDefinitions = [];
		this.tileSpawnerPoints = props.tileSpawners || [];
		this.spellButtons = [];
		this.activeSpellKey = null;
		this.spellCursor = 'crosshair';
		this.orbitProjectiles = [];
		this.selectedTarget = null;
		this.targetMarker = null;
		this.spellUiVisible = false;
		this.spellCooldowns = {};
		this.enemySpawners = [];
		this.pendingTargetClear = false;
		this.doctorDead = false;
		this.doctorDeathHandled = false;
		this.slimeMergeOverlap = null;
		this.runTimerText = null;
		this.runTimerStart = 0;
		this.visibleSpellIndex = 0;
		this.heldSpellKey = null;
		this.heldSpellPointerId = null;
		this.heldSpellPointer = null;
		this.heldSpellButton = null;
		this._pointerWorldPoint = new Phaser.Math.Vector2()
		this.enemyCardConfigs = this.normalizeEnemyCardConfigs(props.enemyCards)
		this.enemyCardContainers = []
		this.friendlySlimes = []
		this.friendlySlimeGroup = null
		this.friendlySlimeMergeOverlap = null
		this.friendlyEnemyOverlap = null
		this.activeFriendlySpawners = []
		this.spawnCount = 0
		this.totalSpawnCount = 0
		this.uncompletedSpawns = 0
		this.completedSpawns = 0
		this.activeSpawns = 0
	}

	getSpriteData() {
		return this.spriteData ?? []
	}

	resolveSpellDefinitions(spells = []) {
		if (!Array.isArray(spells)) return []
		return spells
			.map((entry) => {
				if (typeof entry === 'string') {
					const def = SPELL_LIBRARY[entry]
					return def ? { ...def } : null
				}
				if (entry && typeof entry === 'object') {
					return entry
				}
				return null
			})
			.filter(Boolean)
	}

	normalizeEnemyCardConfigs(cards = []) {
		const baseCards = [
			{ key: 'slime', label: 'Slime Scouts', count: 6, textureKey: 'slime' },
			{ key: 'slime', label: 'Toxic Oozes', count: 14, textureKey: 'slime' },
			{ key: 'slime', label: 'Grand Slimes', count: 24, textureKey: 'slime' },
		]
		const source = Array.isArray(cards) && cards.length ? cards : baseCards
		return source
			.map((entry, idx) => {
				if (!entry) return null
				const textureKey = typeof entry.textureKey === 'string'
					? entry.textureKey
					: typeof entry.key === 'string'
						? entry.key
						: 'slime'
				const label = typeof entry.label === 'string'
					? entry.label
					: this.formatEnemyCardLabel(textureKey)
				const count = this.normalizeEnemyCardCount(entry.count)
				const frame = typeof entry.frame === 'string' || typeof entry.frame === 'number'
					? entry.frame
					: null
				const tint = typeof entry.tint === 'number'
					? entry.tint
					: typeof entry.color === 'number'
						? entry.color
						: null
				const imageScale = typeof entry.imageScale === 'number'
					? entry.imageScale
					: null
				return {
					textureKey,
					label,
					count,
					frame,
					tint,
					imageScale,
					id: entry.id ?? `${textureKey}-${idx}`,
				}
			})
			.filter(Boolean)
	}

	saveGame(key, val) {
		this.gamestate[key] = val
	}

	getPropertyValue(properties, name, defaultValue) {
		if (!properties) return defaultValue
		const prop = properties.find((p) => p.name === name)
		return prop ? prop.value : defaultValue
	}

	preload() {
		this.preloadSprites()
		this.loadCommonAssets()
		this.load.spritesheet(FIREBALL_PROJECTILE_KEY, 'condo/spells/fireball.png', {
			frameWidth: 44,
			frameHeight: 13,
		})
		this.load.atlas(SHADOWBOLT_PROJECTILE_KEY, 'topdown/shadowbolt.png', 'topdown/shadowbolt.json')

	}

	preloadSprites() {
		const spriteData = this.getSpriteData()
		if (!spriteData.length) return
		this.load.once(Phaser.Loader.Events.COMPLETE, () => {
			this.createSpriteAnimations(spriteData)
		})
		for (let i = 0; i < spriteData.length; i++) {
			const spr = spriteData[i]
			this.load.json(spr.dataName, spr.dataFile)
			this.load.spritesheet(spr.name, spr.imageFile,
				{ frameWidth: spr.frameWidth, frameHeight: spr.frameHeight }
			)
		}
	}

	createSpriteAnimations(spriteData) {
		for (let i = 0; i < spriteData.length; i++) {
			const spr = spriteData[i]
			const animData = this.cache.json.get(spr.dataName)
			if (!animData || !animData.meta || !animData.meta.frameTags) continue
			const frames = animData.meta.frameTags
			for (let tagIndex = 0; tagIndex < frames.length; tagIndex++) {
				const frame = frames[tagIndex]
				const frameArr = []
				for (let j = frame.from; j <= frame.to; j++) {
					frameArr.push(j)
				}
				if (this.anims.exists(frame.name)) continue
				this.anims.create({
					key: frame.name,
					frames: this.anims.generateFrameNumbers(spr.name, { frames: frameArr }),
					frameRate: 12
				})
			}
		}
	}

	loadCommonAssets() {
		this.load.image('tileset', 'topdown/tiles/tileset.png')
		this.load.image('screen', 'topdown/screen.png')
		this.load.image('menu', 'topdown/menubar.png')
		this.load.tilemapTiledJSON('tilemap', this.levelData)

	}
	processScripts() {
		for (let s of this.levelScripts) {
			if (s.trigger(this)) {
				s.action(this)
			}
		}
	}

	createSmokeEffect(x, y, intensity = 1, duration = 1200) {
		return createSmokeEffect(this, { x, y, intensity, duration })
	}

	createSparkEffect(x, y, intensity = 1, duration = 1200) {
		return createSparkEffect(this, { x, y, intensity, duration })
	}

	createShadowSparkEffect(x, y, intensity = 1, duration = 1200) {
		return createShadowSparkEffect(this, { x, y, intensity, duration })
	}

	createSlimeExplosion(x, y, intensity = 1.1, duration = 900) {
		return createSlimeExplosionEffect(this, { x, y, intensity, duration })
	}

	showDoctorDamage(amount = 1) {
		const doctor = this.doctor
		if (!doctor) return
		const damageValue = Math.max(0, Math.round(Math.abs(amount)))
		const text = this.add.text(doctor.x, doctor.y - 24 * this.gameScale, `-${damageValue}`, {
			fontSize: `${Math.max(16, 20 * this.gameScale)}px`,
			fontFamily: 'Silkscreen',
			color: '#ff4d4f',
		})
		text.setOrigin(0.5, 0.5)
		text.setDepth(500)
		text.setStroke('#000000', 4 * this.gameScale)
		this.tweens.add({
			targets: text,
			y: text.y - 30 * this.gameScale,
			alpha: { from: 1, to: 0 },
			scale: { from: 1, to: 1.25 },
			duration: 600,
			ease: 'Quad.easeOut',
			onComplete: () => text.destroy(),
		})
	}

	playDoctorCastAnimation() {
		const doctor = this.doctor
		if (!doctor) return
		const castFlagDuration = 250
		if (typeof doctor.triggerCastState === 'function') {
			doctor.triggerCastState(castFlagDuration)
		} else {
			doctor.casting = true
			setTimeout(() => {
				doctor.casting = false
			}, castFlagDuration)
		}
		if (!doctor.anims || typeof doctor.play !== 'function') return
		const castAnimKey = 'S-Walk'
		const frameDurationMs = 100
		const totalFrames = 3
		const totalDuration = frameDurationMs * totalFrames
		doctor.playAnim({ key: castAnimKey })
		console.log('playDoctorCastAnimation', castAnimKey)
/* 		if (this.time) {
			this.time.delayedCall(totalDuration, () => {
				if (!doctor.active) return
				if (doctor.moving) return
				doctor.play({ key: 'Idle', repeat: -1 })
			})
		}
 */	}

	spawnEnemySprite(spriteClass, x, y, config = {}) {
		if (!spriteClass) return null
		const enemyConfig = { scene: this, x, y, ...config }
		const enemy = new spriteClass(this, enemyConfig)
		if (typeof enemy.create === 'function') {
			enemy.create()
		}
		if (enemy instanceof Slime) {
			this.registerSlime(enemy)
		}
		return enemy
	}

	isSpellOnCooldown(spell) {
		if (!spell?.key || !spell.cooldownMs) return false
		if (!this.time) return false
		const expiresAt = this.spellCooldowns[spell.key] || 0
		return expiresAt > this.time.now
	}

	startSpellCooldown(spell) {
		if (!spell?.key || !spell.cooldownMs) return
		if (!this.time) return
		this.spellCooldowns[spell.key] = this.time.now + spell.cooldownMs
	}

	spawnSlimeAt(x, y, config = {}) {
		const providedScale = typeof config.scaleMultiplier === 'number' ? config.scaleMultiplier : null
		const scaleMultiplier = providedScale ?? Phaser.Math.FloatBetween(1, 1.5)
		const slime = this.spawnEnemySprite(Slime, x, y, {
			wanderRadius: config.wanderRadius ?? 60,
			moveDuration: config.moveDuration ?? 1600,
			chaseSpeed: config.chaseSpeed,
			scaleMultiplier,
		})
		if (slime?.applyScaleMultiplier) {
			slime.applyScaleMultiplier(scaleMultiplier)
		}
		return slime
	}

	spawnFriendlySlimeAt(x, y, config = {}) {
		const scaleMultiplier = typeof config.scaleMultiplier === 'number'
			? config.scaleMultiplier
			: Phaser.Math.FloatBetween(0.8, 1.2)
		const friendly = new AlliedSlime(this, {
			scene: this,
			x,
			y,
			isFriendly: true,
			scaleMultiplier,
			wanderRadius: config.wanderRadius ?? 40,
			chaseSpeed: config.chaseSpeed ?? 42 * this.gameScale,
			attackPower: config.attackPower,
			selfDamage: config.selfDamage,
			tint: config.tint,
		})
		if (typeof friendly.create === 'function') {
			friendly.create()
		}
		if (friendly.applyScaleMultiplier) {
			friendly.applyScaleMultiplier(scaleMultiplier)
		}
		this.registerFriendlySlime(friendly)
		return friendly
	}

	registerSlime(slime) {
		if (!slime) return
		if (!this.slimes) {
			this.slimes = []
		}
		this.slimes.push(slime)
		if (this.slimeGroup) {
			this.slimeGroup.add(slime)
		}
		this.setupSlimeMergeHandling()
	}

	registerFriendlySlime(slime) {
		if (!slime) return
		if (!this.friendlySlimes) {
			this.friendlySlimes = []
		}
		this.friendlySlimes.push(slime)
		if (this.friendlySlimeGroup) {
			this.friendlySlimeGroup.add(slime)
		}
	}

	setupSlimeMergeHandling() {
		if (!this.physics || !this.slimeGroup) return
		if (this.slimeMergeOverlap) return
		this.slimeMergeOverlap = this.physics.add.overlap(
			this.slimeGroup,
			this.slimeGroup,
			this.handleSlimeMerge,
			this.shouldProcessSlimeMerge,
			this,
		)
		if (this.events) {
			this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
				this.slimeMergeOverlap?.destroy?.()
				this.slimeMergeOverlap = null
			})
		}
	}

	setupFriendlySlimeMergeHandling() {
		if (!this.physics || !this.friendlySlimeGroup) return
		if (this.friendlySlimeMergeOverlap) return
		this.friendlySlimeMergeOverlap = this.physics.add.overlap(
			this.friendlySlimeGroup,
			this.friendlySlimeGroup,
			this.handleSlimeMerge,
			this.shouldProcessSlimeMerge,
			this,
		)
		if (this.events) {
			this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
				this.friendlySlimeMergeOverlap?.destroy?.()
				this.friendlySlimeMergeOverlap = null
			})
			this.events.once(Phaser.Scenes.Events.DESTROY, () => {
				this.friendlySlimeMergeOverlap?.destroy?.()
				this.friendlySlimeMergeOverlap = null
			})
		}
	}

	shouldProcessSlimeMerge(slimeA, slimeB) {
		if (slimeA?.canMergeWith?.(slimeB)) return true
		if (slimeB?.canMergeWith?.(slimeA)) return true
		return false
	}

	handleSlimeMerge(slimeA, slimeB) {
		if (!slimeA || !slimeB) return
		let result = null
		if (typeof slimeA.mergeWithSlime === 'function') {
			result = slimeA.mergeWithSlime(slimeB)
		}
		if (!result && typeof slimeB.mergeWithSlime === 'function') {
			result = slimeB.mergeWithSlime(slimeA)
		}
		if (!result) return
		this.pruneInactiveSlimes()
		this.pruneFriendlySlimes()
	}

	shouldProcessFriendlyVsEnemyCollision(friendly, enemy) {
		if (!friendly || !enemy) return false
		if (!friendly.active || !enemy.active) return false
		return true
	}

	handleFriendlySlimeCollision(friendly, enemy) {
		if (!friendly || !enemy) return
		if (!friendly.active || !enemy.active) return
		const attackPower = typeof friendly.attackPower === 'number' ? friendly.attackPower : 0.35
		const enemyDestroyed = this.handleSlimeDamage(enemy, { reduction: attackPower, survivalThreshold: 1 })
		if (enemyDestroyed && enemy?.active) {
			this.createSlimeExplosion(enemy.x, enemy.y, (this.gameScale ?? 1))
			enemy.destroy()
			this.pruneInactiveSlimes()
		}
		const selfDamage = typeof friendly.selfDamage === 'number' ? friendly.selfDamage : 0.15
		const friendlyDestroyed = this.handleSlimeDamage(friendly, { reduction: selfDamage, survivalThreshold: 0.4 })
		if (friendlyDestroyed && friendly?.active) {
			this.createSlimeExplosion(friendly.x, friendly.y, (this.gameScale ?? 1) * 0.8)
			friendly.destroy()
			this.pruneFriendlySlimes()
		}
	}

	handleSlimeDamage(slime, { reduction = 0.2, survivalThreshold = 1 } = {}) {
		if (!slime) return true
		if (typeof slime.handleHit === 'function') {
			return slime.handleHit({ reduction, survivalThreshold })
		}
		const currentScale = typeof slime.scaleMultiplier === 'number' ? slime.scaleMultiplier : 1
		const minAllowedScale = Math.max(survivalThreshold, 0.05)
		if (currentScale <= minAllowedScale) {
			return true
		}
		const updated = Math.max(currentScale - reduction, minAllowedScale)
		if (typeof slime.applyScaleMultiplier === 'function') {
			slime.applyScaleMultiplier(updated)
		} else {
			const visualScale = (this.gameScale ?? 1) * updated
			slime.setScale(visualScale)
			slime.scaleMultiplier = updated
		}
		return false
	}

	handleDoctorSlimeCollision(doctor, slime) {
		if (!doctor || !slime || !slime.active) return
		const currentHp = typeof doctor.hp === 'number' ? doctor.hp : doctor.maxHp || 0
		const damageAmount = 1
		if (typeof doctor.setHp === 'function') {
			doctor.setHp(currentHp - damageAmount)
		} else {
			doctor.hp = Math.max(0, currentHp - damageAmount)
		}
		this.showDoctorDamage(damageAmount)
		const shouldDestroy = this.handleSlimeDamage(slime)
		if (shouldDestroy && slime?.active) {
			this.createSlimeExplosion(slime.x, slime.y, (this.gameScale ?? 1) * 0.9)
			slime.destroy()
			this.pruneInactiveSlimes()
		}
	}

	pruneInactiveSlimes() {
		if (!this.slimes?.length) return
		this.slimes = this.slimes.filter((slime) => slime && slime.active)
	}

	pruneFriendlySlimes() {
		if (!this.friendlySlimes?.length) return
		this.friendlySlimes = this.friendlySlimes.filter((slime) => slime && slime.active)
	}

	disbandFriendlySlimes() {
		if (this.friendlySlimes?.length) {
			this.friendlySlimes.forEach((slime) => slime?.destroy?.())
		}
		this.friendlySlimes = []
		if (this.friendlySlimeGroup) {
			if (this.friendlySlimeGroup.children) {
				this.friendlySlimeGroup.clear(true, true)
			}
		}
		if (this.friendlyEnemyOverlap) {
			this.friendlyEnemyOverlap.destroy()
			this.friendlyEnemyOverlap = null
		}
		if (this.friendlySlimeMergeOverlap) {
			this.friendlySlimeMergeOverlap.destroy()
			this.friendlySlimeMergeOverlap = null
		}
	}

	registerFriendlySpawner(event) {
		if (!event) return
		if (!this.activeFriendlySpawners) {
			this.activeFriendlySpawners = []
		}
		this.activeFriendlySpawners.push(event)
	}

	unregisterFriendlySpawner(event) {
		if (!event || !this.activeFriendlySpawners?.length) return
		this.activeFriendlySpawners = this.activeFriendlySpawners.filter((handle) => handle && handle !== event)
	}

	disposeFriendlySpawners() {
		if (!this.activeFriendlySpawners?.length) {
			this.activeFriendlySpawners = []
			return
		}
		this.activeFriendlySpawners.forEach((event) => event?.remove?.())
		this.activeFriendlySpawners = []
	}

	destroyEnemiesAt(x, y, radius = 20 * this.gameScale, damage = 0.2) {
		if (!this.slimes?.length) return 0
		const radiusSq = radius * radius
		let destroyed = 0
		for (let i = 0; i < this.slimes.length; i++) {
			const slime = this.slimes[i]
			if (!slime?.active) continue
			const dx = slime.x - x
			const dy = slime.y - y
			if ((dx * dx + dy * dy) <= radiusSq) {
				const shouldDestroy = this.handleSlimeDamage(slime, { reduction: damage, survivalThreshold: 1.2 })
				if (!shouldDestroy) continue
				this.createSlimeExplosion(slime.x, slime.y, (this.gameScale ?? 1) * 1.2)
				slime.destroy()
				destroyed++
			}
		}
		this.slimes = this.slimes.filter((slime) => slime && slime.active)
		return destroyed
	}

	pruneOrbitProjectiles() {
		if (!this.orbitProjectiles) {
			this.orbitProjectiles = []
			return
		}
		this.orbitProjectiles = this.orbitProjectiles.filter((projectile) => projectile && projectile.active)
	}

	handleDoctorDeath() {
		if (this.doctorDeathHandled) return
		this.doctorDeathHandled = true
		this.doctorDead = true
		this.clearSpellSelection()
		this.selectedTarget = null
		this.pendingTargetClear = false
		this.clearTargetMarker()
		this.setSpellUiVisible(false)
		if (Array.isArray(this.spellButtons)) {
			this.spellButtons.forEach((btn) => btn.disableInteractive?.())
		}
		this.menu?.disableInteractive?.()
		if (this.input?.setDefaultCursor) {
			this.input.setDefaultCursor('default')
		}
		const camera = this.cameras?.main
		if (camera) {
			camera.fadeOut(1500, 0, 0, 0)
		}
		const scheduleReload = () => {
			const locationRef = typeof window !== 'undefined'
				? window.location
				: (typeof globalThis !== 'undefined' ? globalThis.location : null)
			if (locationRef?.reload) {
				locationRef.reload()
			}
		}
		if (this.time) {
			this.time.delayedCall(1000, scheduleReload)
		} else {
			setTimeout(scheduleReload, 1000)
		}
	}

	findEnemyNearPoint(point, radius = 12 * this.gameScale) {
		if (!point || !this.slimes?.length) return null
		const radiusSq = radius * radius
		for (let i = 0; i < this.slimes.length; i++) {
			const slime = this.slimes[i]
			if (!slime?.active) continue
			const dx = slime.x - point.x
			const dy = slime.y - point.y
			if ((dx * dx + dy * dy) <= radiusSq) {
				return slime
			}
		}
		return null
	}

	getEnemySpawnerConfigs() {
		return [
			...this.createTileSpawnerConfigsFromPoints(this.getTileSpawnPoints()),
			...this.getSceneEnemySpawnerConfigs(),
		]
	}

	getSceneEnemySpawnerConfigs() {
		return []
	}

	getTileSpawnPoints() {
		return Array.isArray(this.tileSpawnerPoints) ? this.tileSpawnerPoints : []
	}

	applySpawnTween(target, tweenConfig = GROW_TWEEN) {
		if (!target || !tweenConfig) return
		const deepCopy = Phaser?.Utils?.Objects?.DeepCopy
		const cloned = deepCopy
			? deepCopy(tweenConfig)
			: JSON.parse(JSON.stringify(tweenConfig))
		const config = { ...cloned, targets: target }
		const finalScaleX = typeof target.scaleX === 'number' ? target.scaleX : (target.scale ?? 1)
		const finalScaleY = typeof target.scaleY === 'number' ? target.scaleY : (target.scale ?? 1)
		const finalScale = typeof target.scale === 'number' ? target.scale : finalScaleX
		const normalizeScaleTween = (value, finalValue) => {
			if (!value || typeof value !== 'object' || typeof finalValue !== 'number') return value
			const desiredTo = typeof value.to === 'number' ? value.to : finalValue
			const factor = desiredTo ? finalValue / desiredTo : 1
			const normalized = { ...value }
			if (typeof normalized.from === 'number') {
				normalized.from *= factor
			} else {
				normalized.from = finalValue
			}
			normalized.to = finalValue
			return normalized
		}
		if (config.scale) {
			config.scale = normalizeScaleTween(config.scale, finalScale)
		}
		if (config.scaleX) {
			config.scaleX = normalizeScaleTween(config.scaleX, finalScaleX)
		}
		if (config.scaleY) {
			config.scaleY = normalizeScaleTween(config.scaleY, finalScaleY)
		}
		Object.keys(config).forEach((prop) => {
			if (prop === 'targets') return
			const value = config[prop]
			if (value && typeof value === 'object' && value.from !== undefined && prop in target) {
				target[prop] = value.from
			}
		})
		this.tweens.add(config)
	}

	createTileSpawnerConfigsFromPoints(points = []) {
		if (!points.length) return []
		const map = this.topdown?.map
		const tileWidth = map?.tileWidth ?? 16
		const tileHeight = map?.tileHeight ?? 16
		const scale = this.gameScale ?? 1
		return points
			.map((point, index) => {
				const spriteClass = point.enemyClass || Slime
				if (!spriteClass) return null
				const tileCenterX = point.x ?? ((point.tileX ?? 0) * tileWidth + tileWidth / 2)
				const tileCenterY = point.y ?? ((point.tileY ?? 0) * tileHeight + tileHeight / 2)
				const worldX = tileCenterX * scale
				const worldY = tileCenterY * scale
				const jitterX = (point.jitterX ?? 0) * scale
				const jitterY = (point.jitterY ?? 0) * scale
				const spawnTween = point.spawnTween ? { ...point.spawnTween } : GROW_TWEEN
				return {
					key: point.key || `tile-spawner-${index}`,
					interval: point.interval ?? 1500,
					position: {
						x: worldX,
						y: worldY,
						jitterX,
						jitterY,
					},
					spawnHandler: (scene, position) => {
						const spawnConfig = point.spawnConfig || {}
						const enemy = scene.spawnEnemySprite(spriteClass, position.x, position.y, spawnConfig)
						if (enemy && spawnTween) {
							scene.applySpawnTween(enemy, spawnTween)
							console.log("tween", spawnTween)
						}
					},
				}
			})
			.filter(Boolean)
	}

	initEnemySpawners() {
		const configs = this.getEnemySpawnerConfigs()
		if (!configs?.length) return
		this.enemySpawners = configs
			.map((cfg) => this.createEnemySpawner(cfg))
			.filter(Boolean)
		if (!this.enemySpawners.length) return
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.disposeEnemySpawners()
		})
	}

	createEnemySpawner(config = {}) {
		if (!this.time) return null
		const interval = Math.max(250, config.interval || 4000)
		const spawnHandler = typeof config.spawnHandler === 'function' ? config.spawnHandler : null
		const spriteClass = config.spriteClass
		const spawnTween = config.spawnTween === null ? null : (config.spawnTween || GROW_TWEEN)
		const maxSpawns = typeof config.maxSpawns === 'number'
			? Math.max(0, config.maxSpawns)
			: Infinity
		const isCompletable = Number.isFinite(maxSpawns)
		const tileSize = ((this.topdown?.map?.tileWidth) ?? 16) * (this.gameScale ?? 1)
		const activationTiles = typeof config.activationDistanceTiles === 'number'
			? Math.max(0, config.activationDistanceTiles)
			: 10
		const activationRadius = activationTiles * tileSize
		const activationRadiusSq = activationRadius > 0 ? activationRadius * activationRadius : null
		const activationAnchor = {
			x: typeof config.activationAnchor?.x === 'number'
				? config.activationAnchor.x
				: (config.position?.x ?? this.startx ?? 0),
			y: typeof config.activationAnchor?.y === 'number'
				? config.activationAnchor.y
				: (config.position?.y ?? this.starty ?? 0),
		}
		const countsTowardCompletion = config.countsTowardCompletion !== false && isCompletable
		const spawnerState = {
			key: config.key || Phaser.Utils.String.UUID(),
			maxSpawns,
			spawned: 0,
			active: false,
			isCompletable,
			completed: false,
			remainingActiveEnemies: 0,
			activationRadiusSq,
			activationAnchor,
			countsTowardCompletion,
		}
		if (countsTowardCompletion) {
			this.spawnCount++
			this.totalSpawnCount++
			this.uncompletedSpawns++
			this.updateSpawnStats()
		}
		const handle = {
			key: spawnerState.key,
			event: null,
			state: spawnerState,
			destroy: () => {
				handle.event?.remove?.()
				handle.event = null
			},
		}
		const markActivated = () => {
			if (spawnerState.active) return
			spawnerState.active = true
			this.activeSpawns++
		}
		const updateCompletion = () => {
			if (!spawnerState.isCompletable || spawnerState.completed) return
			if (spawnerState.spawned >= spawnerState.maxSpawns && spawnerState.remainingActiveEnemies <= 0) {
				spawnerState.completed = true
				if (spawnerState.countsTowardCompletion) {
					this.uncompletedSpawns = Math.max(0, this.uncompletedSpawns - 1)
					this.spawnCount = Math.max(0, this.spawnCount - 1)
					this.updateSpawnStats()
				}
			}
		}
		const trackEnemyLifecycle = (enemy) => {
			if (!enemy) return
			spawnerState.remainingActiveEnemies++
			const onDestroy = () => {
				spawnerState.remainingActiveEnemies = Math.max(0, spawnerState.remainingActiveEnemies - 1)
				updateCompletion()
			}
			if (typeof enemy.once === 'function') {
				enemy.once('destroy', onDestroy)
			} else if (typeof enemy.on === 'function') {
				enemy.on('destroy', onDestroy)
			}
		}
		const spawn = () => {
			if (spawnerState.isCompletable && spawnerState.spawned >= spawnerState.maxSpawns) {
				handle.event?.remove?.()
				return
			}
			if (spawnerState.activationRadiusSq !== null) {
				const doctor = this.doctor
				if (!doctor) {
					return
				}
				const dx = doctor.x - spawnerState.activationAnchor.x
				const dy = doctor.y - spawnerState.activationAnchor.y
				if ((dx * dx + dy * dy) > spawnerState.activationRadiusSq) {
					return
				}
				markActivated()
			}
			const position = this.resolveSpawnerPosition(config.position)
			if (!position) return
			const handleSpawnResult = (enemy) => {
				if (!enemy) return
				spawnerState.spawned++
				trackEnemyLifecycle(enemy)
				if (spawnTween) {
					this.applySpawnTween(enemy, spawnTween)
				}
				updateCompletion()
			}
			if (spawnHandler) {
				spawnHandler(this, position)
				spawnerState.spawned++
				updateCompletion()
				return
			}
			if (spriteClass) {
				const enemy = this.spawnEnemySprite(spriteClass, position.x, position.y, config.spawnConfig || {})
				handleSpawnResult(enemy)
				return
			}
			const enemy = this.spawnSlimeAt(position.x, position.y, config.spawnConfig || {})
			handleSpawnResult(enemy)
		}
		handle.event = this.time.addEvent({
			delay: interval,
			loop: true,
			callback: spawn,
		})
		return handle
	}

	updateSpawnStats() {
		this.completedSpawns = Math.max(0, this.totalSpawnCount - this.uncompletedSpawns)
	}

	resolveSpawnerPosition(position = {}) {
		const baseX = position.x ?? this.startx ?? 0
		const baseY = position.y ?? this.starty ?? 0
		const offsetX = (position.offsetX ?? 0) * this.gameScale
		const offsetY = (position.offsetY ?? 0) * this.gameScale
		const jitterX = (position.jitterX ?? 0) * this.gameScale
		const jitterY = (position.jitterY ?? 0) * this.gameScale
		const jitterValX = jitterX ? Phaser.Math.Between(-jitterX, jitterX) : 0
		const jitterValY = jitterY ? Phaser.Math.Between(-jitterY, jitterY) : 0
		return {
			x: baseX + offsetX + jitterValX,
			y: baseY + offsetY + jitterValY,
		}
	}

	disposeEnemySpawners() {
		if (!this.enemySpawners?.length) return
		this.enemySpawners.forEach((spawner) => {
			spawner?.destroy?.()
		})
		this.enemySpawners = []
	}

	create() {
		this.panelDialog = null;

		this.cameras.main.fadeIn(2000, 0, 0, 0)

		this.lights.enable().setAmbientColor(0x555555);
		this.cursors = this.input.keyboard.createCursorKeys();
		this.input.addPointer(3);
		this.input.on('pointerup', (pointer) => {
			this.handleSpellButtonRelease(pointer)
		})
		this.input.on?.('pointercancel', (pointer) => {
			this.handleSpellButtonRelease(pointer)
		})
		this.disableContextMenuForCanvas()


		this.topdown = new Topdown(this, { key: 'tilemap', tileWidth: 16, tileHeight: 16 })
		this.topdown.create()

		const centerX = (this.topdown.map.widthInPixels * this.gameScale) / 2
		const centerY = (this.topdown.map.heightInPixels * this.gameScale) / 2
		this.doctor = new Doctor(this, { scene: this, x: centerX, y: centerY })
		this.doctor.create()
		this.doctorDead = false
		this.doctorDeathHandled = false
		this.doctor.on('died', () => this.handleDoctorDeath())
		this.startx = this.doctor.x
		this.starty = this.doctor.y

		this.slimes = []
		this.slimeGroup = this.physics.add.group()
		this.physics.add.overlap(this.doctor, this.slimeGroup, this.handleDoctorSlimeCollision, null, this)
		this.friendlySlimeGroup = this.physics.add.group()
		this.friendlyEnemyOverlap = this.physics.add.overlap(
			this.friendlySlimeGroup,
			this.slimeGroup,
			this.handleFriendlySlimeCollision,
			this.shouldProcessFriendlyVsEnemyCollision,
			this,
		)
		this.setupSlimeMergeHandling()
		this.setupFriendlySlimeMergeHandling()
		const objectLayer = this.topdown.map.getObjectLayer('objects')
		if (objectLayer && Array.isArray(objectLayer.objects)) {
			objectLayer.objects.filter((obj) => obj.type === 'Door').forEach((obj) => {
				const doorX = (obj.x + (obj.width || 0) / 2) * this.gameScale
				const doorY = (obj.y + (obj.height || 0) / 2) * this.gameScale
				const doorW = (obj.width || 16) * this.gameScale
				const doorH = (obj.height || 16) * this.gameScale
				const targetSceneKey = this.getPropertyValue(obj.properties, 'scene',
					this.getPropertyValue(obj.properties, 'targetScene', null))
				if (!targetSceneKey) return
				const fadeDuration = this.getPropertyValue(obj.properties, 'fadeDuration', 1000)
				console.log(doorX, doorY, doorW, doorH, targetSceneKey)
				const doorZone = this.add.zone(doorX, doorY, doorW, doorH)
				/* const doorOutline = this.add.rectangle(doorX, doorY, doorW, doorH)
				doorOutline.setStrokeStyle(2, 0x00ff00, 1)
				doorOutline.setOrigin(0.5) */
				doorZone.setOrigin(0.5)
				this.physics.world.enable(doorZone)
				doorZone.body.setAllowGravity(false)
				doorZone.body.setImmovable(true)
				doorZone.setData('targetScene', targetSceneKey)
				doorZone.setData('fadeDuration', fadeDuration)
				doorZone.setData('used', false)
				if (!this.doorZones) this.doorZones = []
				this.doorZones.push(doorZone)
				this.physics.add.overlap(this.doctor, doorZone, (doctor, zone) => {
					if (!zone || zone.getData('used')) return
					const key = zone.getData('targetScene')
					if (!key) return
					zone.setData('used', true)
					this.clearTargetSelection()
					this.clearSpellSelection()
					const cam = this.cameras?.main
					if (cam) {
						cam.once('camerafadeoutcomplete', () => {
							this.scene.start(key)
						})
						cam.fadeOut(zone.getData('fadeDuration'), 0, 0, 0)
					} else {
						this.scene.start(key)
					}
				}, null, this)
			})
		}
		const entityLayer = this.topdown.map.getObjectLayer('enemies')
		if (entityLayer && Array.isArray(entityLayer.objects)) {
			console.log('[BaseScene] Loaded entity objects:', entityLayer.objects)
			entityLayer.objects.filter((obj) => obj.type === 'Slime').forEach((obj) => {
				const width = (obj.width || 0) * this.gameScale
				const height = (obj.height || 0) * this.gameScale
				const jitterX = width > 0 ? width / 2 : 8 * this.gameScale
				const jitterY = height > 0 ? height / 2 : 8 * this.gameScale
				const centerX = (obj.x + (obj.width || 0) / 2) * this.gameScale
				const centerY = (obj.y + (obj.height || 0) / 2) * this.gameScale
				//const squareHighlight = this.add.rectangle(centerX, centerY, jitterX, jitterY, 0xff0000, 1);
				this.createEnemySpawner({
					interval: obj.properties?.find((p) => p.name === 'interval')?.value || 3000,
					maxSpawns: obj.properties?.find((p) => p.name === 'maxSpawns')?.value,
					position: {
						x: centerX,
						y: centerY,
						jitterX,
						jitterY,
					},
					spawnConfig: {
						wanderRadius: 60 * this.gameScale,
						moveDuration: 1600,
						chaseSpeed: 32 * this.gameScale,
					},
					spawnTween: GROW_TWEEN
				})

			})
		}

		this.menu = new Menu(this, { x: this.doctor.x + window.innerWidth / 2 - 10, y: this.doctor.y - window.innerHeight / 2 + 10 - 300 })
		this.menu.create()
		this.initRunTimerOverlay()
		this.setSpellUiVisible(true)
		this.initSpellSystem()
		this.initEnemyCardDeck()
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.clearTargetSelection()
			this.disposeRunTimerOverlay()
			this.disposeFriendlySpawners()
			this.disbandFriendlySlimes()
		})
		this.events.once(Phaser.Scenes.Events.DESTROY, () => {
			this.disposeFriendlySpawners()
			this.disbandFriendlySlimes()
		})
		this.processScripts();
		this.initEnemySpawners();
	}


	update(time) {
		this.processScripts();
		this.topdown.update(time)
		this.doctor.update(time)
		this.checkForTargetArrival()
		if (this.doctor?.paused && this.selectedTarget) {
			this.clearTargetSelection()
		}
		if (this.slimes) {
			this.slimes.forEach((slime) => {
				slime.update()
			})
		}
		if (this.friendlySlimes?.length) {
			for (let i = 0; i < this.friendlySlimes.length; i++) {
				const slime = this.friendlySlimes[i]
				if (!slime) continue
				slime.update?.()
				const scale = typeof slime.getScaleValue === 'function'
					? slime.getScaleValue()
					: typeof slime.scaleMultiplier === 'number'
						? slime.scaleMultiplier
						: 1
				if (scale < 0.5) {
					this.createSlimeExplosion(slime.x, slime.y, (this.gameScale ?? 1) * 0.7)
					slime.destroy()
					continue
				}
			}
			this.pruneFriendlySlimes()
		}
		if (this.panelDialog) this.panelDialog.update()
		this.menu.update(time)
		this.updateSpellUi()
		this.updateEnemyCardDeck()
		this.updateTargetTracking()
		this.updateRunTimerDisplay()
		this.processHeldSpellCasting()

	}

	initSpellSystem() {
		this.spellDefinitions = this.resolveSpellDefinitions(this.spellKeys)
		if (!this.spellDefinitions.length) return

		this.spellButtons = this.spellDefinitions.map((spell) => this.createSpellButton(spell))
		this.setVisibleSpellIndex(this.visibleSpellIndex ?? 0)
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.spellButtons.forEach((btn) => btn.destroy())
			this.spellButtons = []
		})
	}

	createSpellButton(spell) {
		const size = 44 * this.gameScale
		const container = this.add.container(0, 0)
		container.setDepth(150)
		container.setSize(size, size)
		container.setScrollFactor(1)
		const bg = this.add.rectangle(0, 0, size, size, 0x0b0b13, 0.75)
		bg.setStrokeStyle(2, 0xffffff, 0.25)
		bg.setOrigin(0)
		const iconRadius = Math.max(16, size / 2.4)
		let icon = null
		if (typeof spell.createIcon === 'function') {
			icon = spell.createIcon(this, { size, container })
		}
		if (!icon) {
			icon = this.add.circle(size / 2, size / 2, iconRadius, spell.iconColor || 0xffc857, 1)
			icon.setBlendMode(Phaser.BlendModes.ADD)
		} else if (icon.setBlendMode) {
			icon.setBlendMode(Phaser.BlendModes.ADD)
		}
		const readyGlow = this.add.circle(size / 2, size / 2, iconRadius + 5, 0xfff2a0, 0.22)
		readyGlow.setBlendMode(Phaser.BlendModes.ADD)
		readyGlow.setVisible(false)
		const labelText = spell.label || spell.key
		const label = this.add.text(size / 2, size + 4, labelText, {
			fontSize: `${Math.max(10, 12 * this.gameScale)}px`,
			fontFamily: 'Silkscreen',
			color: '#ffffff',
		})
		label.setOrigin(0.5, 0)
		label.setDepth(151)
		const cooldownBarHeight = Math.max(1, 1 * this.gameScale)
		const cooldownBar = this.add.rectangle(size / 2, size + label.height + 4 + cooldownBarHeight / 2, size - 6 * this.gameScale, cooldownBarHeight, 0xfff2a0, 0.9)
		cooldownBar.setOrigin(0.5, 0.5)
		cooldownBar.setDepth(152)
		cooldownBar.setScale(0, 1)
		container.add([bg, readyGlow, icon, label, cooldownBar])

		const arrowStyle = {
			fontSize: `${Math.max(10, 12 * this.gameScale)}px`,
			fontFamily: 'Silkscreen',
			color: '#ffe9a3',
		}
		const arrowY = size / 2
		const arrowOffset = iconRadius + 8
		const leftArrow = this.add.text((size / 2) - arrowOffset, arrowY, '<', arrowStyle)
		leftArrow.setOrigin(1, 0.5)
		leftArrow.setDepth(152)
		leftArrow.setInteractive({ useHandCursor: true })
		leftArrow.on('pointerdown', (pointer) => {
			pointer?.event?.stopPropagation?.()
			this.cycleVisibleSpell(-1)
		})
		leftArrow.setData('blocksPointerRouting', true)
		const rightArrow = this.add.text((size / 2) + arrowOffset, arrowY, '>', arrowStyle)
		rightArrow.setOrigin(0, 0.5)
		rightArrow.setDepth(152)
		rightArrow.setInteractive({ useHandCursor: true })
		rightArrow.on('pointerdown', (pointer) => {
			pointer?.event?.stopPropagation?.()
			this.cycleVisibleSpell(1)
		})
		rightArrow.setData('blocksPointerRouting', true)
		leftArrow.setVisible(false)
		rightArrow.setVisible(false)
		if (leftArrow.input) {
			leftArrow.input.enabled = false
		}
		if (rightArrow.input) {
			rightArrow.input.enabled = false
		}
		container.add([leftArrow, rightArrow])

		const baseHeight = size + label.height + 4 + cooldownBarHeight + 2
		container.setSize(size, baseHeight)

		const hitScale = 2 // expand clickable area even more for easier tapping
		const hitWidth = size * hitScale
		const hitHeight = baseHeight * hitScale
		const offsetX = (hitWidth - size) / 2
		const offsetY = (hitHeight - baseHeight) / 2
		const hitRect = new Phaser.Geom.Rectangle(-offsetX, -offsetY, hitWidth, hitHeight)
		container.setInteractive(hitRect, Phaser.Geom.Rectangle.Contains)
		container.on('pointerdown', (pointer) => {
			pointer?.event?.stopPropagation?.()
			this.handleSpellButtonPress(spell, pointer, container)
		})
		container.on('pointerup', (pointer) => {
			this.handleSpellButtonRelease(pointer)
		})
		container.on('pointerout', (pointer) => {
			if (pointer?.isDown) {
				return
			}
			this.handleSpellButtonRelease(pointer)
		})
		container.setData('spell', spell)
		container.setData('bg', bg)
		container.setData('icon', icon)
		container.setData('readyGlow', readyGlow)
		container.setData('cooldownBar', cooldownBar)
		container.setData('iconBaseScaleX', icon?.scaleX ?? 1)
		container.setData('iconBaseScaleY', icon?.scaleY ?? 1)
		container.setData('buttonSize', size)
		container.setData('buttonHeight', baseHeight)
		container.setData('blocksPointerRouting', true)
		container.setData('leftArrow', leftArrow)
		container.setData('rightArrow', rightArrow)
		return container
	}

	initEnemyCardDeck() {
		this.disposeEnemyCardDeck()
		if (!this.enemyCardConfigs?.length) return
		this.enemyCardContainers = this.enemyCardConfigs
			.map((config, idx) => this.createEnemyCard(config, idx))
			.filter(Boolean)
		if (!this.enemyCardContainers.length) return
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.disposeEnemyCardDeck()
		})
		this.events.once(Phaser.Scenes.Events.DESTROY, () => {
			this.disposeEnemyCardDeck()
		})
		this.updateEnemyCardDeck()
	}

	createEnemyCard(config, index = 0) {
		if (!config) return null
		const width = 72 * this.gameScale * 0.5
		const height = 102 * this.gameScale * 0.5
		const container = this.add.container(0, 0)
		container.setSize(width, height)
		container.setDepth(153 + index)
		container.setScrollFactor(1)
		container.setVisible(false)
		container.setAlpha(0)
		const background = this.add.rectangle(0, 0, width, height, 0x0b0b13, 0.95)
		background.setOrigin(0)
		background.setStrokeStyle(3 * this.gameScale, 0xffffff, 0.95)
		const inset = this.add.rectangle(0, 0, width - 5 * this.gameScale, height - 5 * this.gameScale, 0xffffff, 0.06)
		inset.setOrigin(0)
		inset.setPosition(2.5 * this.gameScale, 2.5 * this.gameScale)
		const numberStyle = {
			fontSize: `${Math.max(8, 12 * this.gameScale * 0.8)}px`,
			fontFamily: 'Silkscreen',
			color: '#ffe9a3',
		}
		const topNumber = this.add.text(width / 2, Math.max(0, (4 * this.gameScale) - 5), `${config.count}`, numberStyle)
		topNumber.setOrigin(0.5, 0)
		const labelStyle = {
			fontSize: `${Math.max(8, 10 * this.gameScale)}px`,
			fontFamily: 'Silkscreen',
			color: '#ffffff',
		}
		const labelText = 'slime'
		const label = this.add.text(width / 2, height - 4 * this.gameScale, labelText, labelStyle)
		label.setOrigin(0.5, 1)
		const shadow = this.add.ellipse(width / 2, height * 0.65, width * 0.55, 6 * this.gameScale, 0x000000, 0.25)
		shadow.setOrigin(0.5)
		let enemyImage = null
			if (config.textureKey) {
				enemyImage = this.add.sprite(width / 2, height * 0.45, config.textureKey, config.frame ?? 0)
				enemyImage.setOrigin(0.5)
				const naturalWidth = enemyImage.width || 1
				const naturalHeight = enemyImage.height || 1
				const maxWidth = width * 0.55
				const maxHeight = height * 0.45
				const baseScale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight)
				const imageScale = (config.imageScale ?? 1) * baseScale
				enemyImage.setScale(imageScale)
			}
		const elements = [background, inset, shadow]
		if (enemyImage) {
			elements.push(enemyImage)
		}
		elements.push(topNumber, label)
		container.add(elements)
		container.setData('cardWidth', width)
		container.setData('cardHeight', height)
		container.setData('cardConfig', config)
		const hitPadding = 12 * this.gameScale
		const hitArea = new Phaser.Geom.Rectangle(-hitPadding, -hitPadding, width + hitPadding * 2, height + hitPadding * 2)
		container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains)
		container.on('pointerdown', (pointer) => {
			pointer?.event?.stopPropagation?.()
			this.handleEnemyCardPress(container)
		})
		container.setData('blocksPointerRouting', true)
		return container
	}

	updateEnemyCardDeck() {
		if (!this.enemyCardContainers?.length || !this.menu) return
		const anchor = this.getEnemyCardAnchor()
		if (!anchor) return
		const visible = (this.menu.alpha ?? 0) > 0.05
		const alpha = visible ? this.menu.alpha : 0
		const stackOffsetX = 10 * this.gameScale
		const stackOffsetY = 14 * this.gameScale
		const depthBase = 153
		this.enemyCardContainers.forEach((card, idx) => {
			if (!card) return
			const reverseIdx = this.enemyCardContainers.length - 1 - idx
			const x = anchor.startX + reverseIdx * stackOffsetX
			const y = anchor.startY + reverseIdx * stackOffsetY
			card.setPosition(x, y)
			card.setDepth(depthBase + reverseIdx)
			card.setVisible(visible)
			card.setAlpha(alpha)
			if (card.input) {
				card.input.enabled = visible && idx === 0
			}
		})
	}

	getEnemyCardAnchor() {
		const spellAnchor = this.computeSpellUiAnchor()
		if (!spellAnchor) return null
		const activeButton = this.spellButtons?.length
			? this.spellButtons[this.visibleSpellIndex]
			: null
		const buttonWidth = activeButton?.getData?.('buttonSize') ?? 44 * this.gameScale
		const spacing = 32 * this.gameScale
		return {
			startX: spellAnchor.startX + buttonWidth + spacing,
			startY: spellAnchor.startY,
		}
	}

	getTopEnemyCard() {
		if (!this.enemyCardContainers?.length) return null
		return this.enemyCardContainers[0]
	}

	handleEnemyCardPress(card) {
		if (!card?.visible) return
		const topCard = this.getTopEnemyCard()
		if (!topCard || topCard !== card) return
		const config = card.getData('cardConfig')
		if (!config) return
		const spawnCount = this.normalizeEnemyCardCount(config.count ?? 5)
		this.deployFriendlySpawnerFromCard(config, spawnCount)
		console.log(`[Enemy Deck] Spawning ${spawnCount} allied slimes from card: ${config.label || config.key || 'unknown'}`)
		this.animateEnemyCardUse(card, () => {
			this.removeEnemyCard(card)
		})
	}

	deployFriendlySpawnerFromCard(config = {}, overrideCount = null) {
		const total = typeof overrideCount === 'number'
			? overrideCount
			: this.normalizeEnemyCardCount(config.count ?? 5)
		if (!total || total <= 0) return
		if (!this.time) {
			for (let i = 0; i < total; i++) {
				this.spawnFriendlyUnitForConfig(config)
			}
			return
		}
		let spawned = 0
		let spawnEvent = null
		const spawnOne = () => {
			this.spawnFriendlyUnitForConfig(config)
			spawned++
			if (spawned >= total) {
				if (spawnEvent) {
					this.unregisterFriendlySpawner(spawnEvent)
					spawnEvent.remove(false)
					spawnEvent = null
				}
			}
		}
		spawnOne()
		if (spawned >= total) return
		spawnEvent = this.time.addEvent({
			delay: 160,
			loop: true,
			callback: spawnOne,
		})
		this.registerFriendlySpawner(spawnEvent)
	}

	spawnFriendlyUnitForConfig(config = {}) {
		const spawnPoint = this.getFriendlySpawnPoint()
		const offset = this.getFriendlySpawnOffset()
		const x = spawnPoint.x + offset.x
		const y = spawnPoint.y + offset.y
		const type = (config.textureKey || config.key || 'slime').toLowerCase()
		if (type.includes('slime')) {
			return this.spawnFriendlySlimeAt(x, y, {
				tint: config.tint,
				scaleMultiplier: Phaser.Math.FloatBetween(1.2, 1.8),
				attackPower: config.attackPower,
				selfDamage: config.selfDamage,
			})
		}
		return null
	}

	getFriendlySpawnPoint() {
		if (this.doctor && this.doctor.active) {
			return { x: this.doctor.x, y: this.doctor.y }
		}
		return { x: this.startx ?? 0, y: this.starty ?? 0 }
	}

	getFriendlySpawnOffset() {
		const radius = 24 * this.gameScale
		const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
		const distance = Phaser.Math.FloatBetween(radius * 0.2, radius)
		return {
			x: Math.cos(angle) * distance,
			y: Math.sin(angle) * distance,
		}
	}

	animateEnemyCardUse(card, onComplete) {
		if (!card || !this.tweens) {
			onComplete?.()
			return
		}
		this.tweens.add({
			targets: card,
			scale: { from: 1, to: 1.06 },
			alpha: { from: card.alpha ?? 1, to: (card.alpha ?? 1) * 0.9 },
			duration: 180,
			yoyo: true,
			onComplete: () => {
				card.setScale(1)
				card.setAlpha((this.menu?.alpha ?? 1))
				onComplete?.()
			},
		})
	}

	removeEnemyCard(card) {
		if (!card || !this.enemyCardContainers?.length) return
		const index = this.enemyCardContainers.indexOf(card)
		if (index === -1) return
		this.enemyCardContainers.splice(index, 1)
		card.destroy()
		this.updateEnemyCardDeck()
	}

	disposeEnemyCardDeck() {
		if (!this.enemyCardContainers?.length) {
			this.enemyCardContainers = []
			return
		}
		this.enemyCardContainers.forEach((card) => {
			card?.destroy?.()
		})
		this.enemyCardContainers = []
	}

	handleSpellButtonPress(spell, pointer, button) {
		if (!spell) return
		this.setHeldSpell(spell, pointer, button)
		this.selectSpell(spell)
	}

	handleSpellButtonRelease(pointer) {
		if (!this.heldSpellKey) return
		if (!this.doesPointerMatchHeld(pointer)) {
			return
		}
		this.clearSpellSelection()
	}

	setHeldSpell(spell, pointer, button) {
		if (!spell) {
			this.clearHeldSpell()
			return
		}
		this.heldSpellKey = spell.key
		this.heldSpellPointerId = pointer?.pointerId ?? pointer?.id ?? null
		this.heldSpellPointer = pointer || null
		this.heldSpellButton = button ?? this.findSpellButtonByKey(spell.key)
	}

	clearHeldSpell() {
		this.heldSpellKey = null
		this.heldSpellPointerId = null
		this.heldSpellPointer = null
		this.heldSpellButton = null
	}

	getHeldSpellPointer() {
		if (this.heldSpellPointer && this.pointerIdMatches(this.heldSpellPointer, this.heldSpellPointerId)) {
			return this.heldSpellPointer
		}
		if (this.heldSpellPointerId === null || !this.input) {
			return this.heldSpellPointer
		}
		const resolved = this.findPointerById(this.heldSpellPointerId)
		if (resolved) {
			this.heldSpellPointer = resolved
		}
		return this.heldSpellPointer
	}

	findPointerById(pointerId) {
		if (pointerId === null || pointerId === undefined || !this.input) return null
		const candidates = new Set()
		if (Array.isArray(this.input.pointers)) {
			this.input.pointers.forEach((ptr) => candidates.add(ptr))
		}
		const fallbackPointers = [
			this.input.activePointer,
			this.input.mousePointer,
			this.input.pointer1,
			this.input.pointer2,
			this.input.pointer3,
			this.input.pointer4,
		]
		fallbackPointers.forEach((ptr) => {
			if (ptr) candidates.add(ptr)
		})
		for (const pointer of candidates) {
			if (!pointer) continue
			if (this.pointerIdMatches(pointer, pointerId)) {
				return pointer
			}
		}
		return null
	}

	pointerIdMatches(pointer, pointerId) {
		if (!pointer) return false
		if (pointerId === null || pointerId === undefined) return true
		return pointer.pointerId === pointerId || pointer.id === pointerId
	}

	getHeldSpellButton() {
		if (this.heldSpellButton && this.heldSpellButton.scene === this) {
			return this.heldSpellButton
		}
		if (!this.heldSpellKey) return null
		const button = this.findSpellButtonByKey(this.heldSpellKey)
		this.heldSpellButton = button || null
		return this.heldSpellButton
	}

	findSpellButtonByKey(spellKey) {
		if (!spellKey || !Array.isArray(this.spellButtons)) return null
		return this.spellButtons.find((button) => button?.getData?.('spell')?.key === spellKey) || null
	}

	isPointerCurrentlyPressed(pointer) {
		if (!pointer) return false
		if (pointer.isDown) return true
		if (pointer.primaryDown) return true
		if (typeof pointer.leftButtonDown === 'function' && pointer.leftButtonDown()) return true
		if (typeof pointer.rightButtonDown === 'function' && pointer.rightButtonDown()) return true
		return false
	}

	isPointerTouchingButton(pointer, button) {
		if (!pointer || !button) return false
		if (!button.visible || button.active === false) return false
		const bounds = button.getBounds?.()
		if (!bounds) return false
		const padding = Math.max(16, 24 * this.gameScale)
		const hitRect = new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height)
		Phaser.Geom.Rectangle.Inflate(hitRect, padding, padding)
		const worldPoint = this.getPointerWorldPosition(pointer)
		if (!worldPoint) return false
		return Phaser.Geom.Rectangle.Contains(hitRect, worldPoint.x, worldPoint.y)
	}

	isHeldSpellPressActive() {
		const pointer = this.getHeldSpellPointer()
		if (!this.isPointerCurrentlyPressed(pointer)) {
			return false
		}
		const button = this.getHeldSpellButton()
		return this.isPointerTouchingButton(pointer, button)
	}

	doesPointerMatchHeld(pointer) {
		if (!pointer) return true
		if (this.heldSpellPointer && pointer === this.heldSpellPointer) {
			return true
		}
		const pointerId = pointer?.pointerId ?? pointer?.id ?? null
		if (pointerId === null || this.heldSpellPointerId === null) {
			return true
		}
		return pointerId === this.heldSpellPointerId
	}

	getPointerWorldPosition(pointer) {
		if (!pointer) return null
		const camera = this.cameras?.main
		const x = pointer.x ?? pointer.clientX ?? 0
		const y = pointer.y ?? pointer.clientY ?? 0
		if (!camera || typeof camera.getWorldPoint !== 'function') {
			return { x, y }
		}
		if (!this._pointerWorldPoint) {
			this._pointerWorldPoint = new Phaser.Math.Vector2()
		}
		camera.getWorldPoint(x, y, this._pointerWorldPoint)
		return { x: this._pointerWorldPoint.x, y: this._pointerWorldPoint.y }
	}

	selectSpell(spell) {
		if (!spell) return
		if (this.doctorDead) return
		if (this.activeSpellKey === spell.key) {
			this.clearSpellSelection()
			return
		}
		this.activeSpellKey = spell.key
		this.input.setDefaultCursor(this.spellCursor)
		this.updateSpellButtonStates()
		if (spell.requiresTarget === false) {
			const castPoint = this.doctor
				? { x: this.doctor.x, y: this.doctor.y }
				: null
			const casted = castPoint ? this.castSpellAtPoint(castPoint) : false
			if (!casted) {
				this.clearSpellSelection()
			}
			return
		}
		if (!this.selectedTarget && spell.autoTargetNearestEnemy) {
			const nearest = this.selectNearestEnemyTarget({
				range: typeof spell.targetRange === 'number' ? spell.targetRange : null,
			})
			if (!nearest && spell.requiresTarget !== false) {
				return
			}
		}
		this.attemptImmediateCast()
	}

	clearSpellSelection() {
		this.clearHeldSpell()
		this.activeSpellKey = null
		this.input.setDefaultCursor('default')
		this.updateSpellButtonStates()
	}

	updateSpellButtonStates() {
		if (!this.spellButtons.length) return
		this.spellButtons.forEach((btn) => {
			const spell = btn.getData('spell')
			const bg = btn.getData('bg')
			const readyGlow = btn.getData('readyGlow')
			const icon = btn.getData('icon')
			const cooldownBar = btn.getData('cooldownBar')
			const isReady = spell ? !this.isSpellOnCooldown(spell) : false
			const cooldownRatio = this.getSpellCooldownRatio(spell)
			const strokeWidth = 2 * (isReady ? 1.5 : 1)
			const strokeColor = isReady ? 0xfff2a0 : 0xffffff
			const strokeAlpha = isReady ? 0.9 : 0.2
			bg?.setStrokeStyle(strokeWidth, strokeColor, strokeAlpha)
			if (icon) {
				icon.setAlpha(isReady ? 1 : 0.45)
			}
			if (readyGlow) {
				const glowVisible = isReady && btn.visible
				readyGlow.setVisible(glowVisible)
				readyGlow.setAlpha(glowVisible ? 1 : 0)
			}
			if (cooldownBar) {
				const fillRatio = Phaser.Math.Clamp(cooldownRatio, 0, 1)
				cooldownBar.setScale(fillRatio, 1)
				cooldownBar.setAlpha(btn.visible ? 1 : 0)
			}
		})
	}

	updateSpellUi() {
		if (!this.spellButtons.length || !this.menu) return
		const anchor = this.computeSpellUiAnchor()
		if (!anchor) return
		const visible = (this.menu.alpha ?? 0) > 0.05
		const multipleSpells = this.spellButtons.length > 1
		this.spellButtons.forEach((btn, idx) => {
			const wasVisible = btn.visible
			const isActive = idx === this.visibleSpellIndex
			const buttonVisible = visible && isActive
			btn.setPosition(anchor.startX, anchor.startY)
			btn.setAlpha(buttonVisible ? this.menu.alpha : 0)
			btn.setVisible(buttonVisible)
			if (btn.input) {
				btn.input.enabled = buttonVisible
			}
			const leftArrow = btn.getData('leftArrow')
			const rightArrow = btn.getData('rightArrow')
			const arrowsVisible = buttonVisible && multipleSpells
			leftArrow?.setVisible(arrowsVisible)
			rightArrow?.setVisible(arrowsVisible)
			if (leftArrow?.input) {
				leftArrow.input.enabled = arrowsVisible
			}
			if (rightArrow?.input) {
				rightArrow.input.enabled = arrowsVisible
			}
			if (buttonVisible && !wasVisible) {
				this.resumeButtonIconAnimation(btn)
			} else if (!buttonVisible && wasVisible) {
				this.pauseButtonIconAnimation(btn)
			}
		})
		this.updateSpellButtonStates()
	}

	computeSpellUiAnchor() {
		if (!this.menu) return null
		const buttonSpacing = 56 * this.gameScale
		const startX = (this.menu.x - this.menu.displayWidth) + 16
		const startY = this.menu.y + this.menu.displayHeight + 12
		return { startX, startY, buttonSpacing }
	}

	getSelectableTargets() {
		const targets = []
		if (this.slimes?.length) {
			targets.push(...this.slimes)
		}
		return targets.filter((obj) => obj && obj.active)
	}

	handleTargetSelection(pointer) {
		const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
		const targetSprite = this.findSpriteTargetAt(worldPoint)
		if (targetSprite) {
			this.selectTargetSprite(targetSprite)
		} else {
			this.selectTargetPoint(worldPoint)
		}
		return true
	}

	findSpriteTargetAt(point) {
		const targets = this.getSelectableTargets()
		for (let i = targets.length - 1; i >= 0; i--) {
			const sprite = targets[i]
			if (!sprite?.active) continue
			const bounds = sprite.getBounds?.()
			if (bounds && bounds.contains(point.x, point.y)) {
				return sprite
			}
		}
		return null
	}

	selectTargetPoint(point) {
		this.selectedTarget = {
			type: 'point',
			position: { x: point.x, y: point.y },
		}
		this.applyTargetMarker(0x00ff90, point.x, point.y)
		this.createWalkConfirmEffect(point.x, point.y)
		this.doctor?.addDestinationPoint({ x: point.x, y: point.y })
		this.pendingTargetClear = true
		this.updateSelectionUI()
	}

	processHeldSpellCasting() {
		if (!this.heldSpellKey) return
		if (!this.isHeldSpellPressActive()) {
			this.clearHeldSpell()
			return
		}
		if (this.doctorDead) {
			this.clearHeldSpell()
			return
		}
		const spell = this.spellDefinitions.find((s) => s.key === this.heldSpellKey)
		if (!spell) {
			this.clearHeldSpell()
			return
		}
		if (this.isSpellOnCooldown(spell)) return
		if (!this.isHeldSpellPressActive()) {
			this.clearHeldSpell()
			return
		}
		if (this.activeSpellKey !== spell.key) {
			this.activeSpellKey = spell.key
			this.input.setDefaultCursor(this.spellCursor)
			this.updateSpellButtonStates()
		}
		if (spell.requiresTarget === false) {
			const point = this.doctor ? { x: this.doctor.x, y: this.doctor.y } : null
			if (!point) return
			this.castSpellAtPoint(point)
			return
		}
		if (!this.selectedTarget && spell.autoTargetNearestEnemy) {
			const nearest = this.selectNearestEnemyTarget({ range: spell.targetRange })
			if (!nearest) return
		}
		if (!this.selectedTarget) return
		this.attemptImmediateCast()
	}

	selectTargetSprite(sprite) {
		const locked = sprite && sprite.active ? sprite : this.findNearestEnemyToPoint({ x: sprite?.x ?? 0, y: sprite?.y ?? 0 }) || sprite
		this.selectedTarget = {
			type: 'sprite',
			sprite: locked,
		}
		this.pendingTargetClear = false
		if (locked) {
			this.applyTargetMarker(0xff3b58, locked.x, locked.y)
		}
		this.updateSelectionUI()
	}

	checkForTargetArrival() {
		if (!this.pendingTargetClear) return
		if (!this.selectedTarget || this.selectedTarget.type !== 'point') {
			this.pendingTargetClear = false
			return
		}
		const doctor = this.doctor
		if (!doctor) return
		if (doctor.waypoints?.length) return
		const pos = this.selectedTarget.position
		const dx = doctor.x - pos.x
		const dy = doctor.y - pos.y
		const threshold = 8 * this.gameScale
		if (Math.hypot(dx, dy) <= threshold) {
			this.pendingTargetClear = false
			this.clearTargetSelection()
		}
	}

	selectNearestEnemyTarget({ range = null } = {}) {
		const originX = this.doctor?.x ?? 0
		const originY = this.doctor?.y ?? 0
		const nearest = this.findNearestEnemyToPoint({ x: originX, y: originY }, { range })
		if (!nearest) return null
		this.selectTargetSprite(nearest)
		return nearest
	}

	findNearestEnemyToPoint(point, { range = null } = {}) {
		const targets = this.getSelectableTargets()
		if (!targets.length || !point) return null
		let nearest = null
		let nearestDistSq = Number.POSITIVE_INFINITY
		const maxRangeSq = typeof range === 'number' && range > 0 ? range * range : null
		for (let i = 0; i < targets.length; i++) {
			const sprite = targets[i]
			if (!sprite?.active) continue
			const dx = sprite.x - point.x
			const dy = sprite.y - point.y
			const distSq = dx * dx + dy * dy
			if (maxRangeSq !== null && distSq > maxRangeSq) continue
			if (distSq < nearestDistSq) {
				nearest = sprite
				nearestDistSq = distSq
			}
		}
		return nearest
	}

	onDestinationUnreachable(point) {
		if (!point) return
		const target = this.selectedTarget
		if (!target) return
		if (target.type === 'point' && target.position && target.position.x === point.x && target.position.y === point.y) {
			this.clearTargetSelection()
		}
	}

	applyTargetMarker(color, x, y) {
		this.clearTargetMarker()
		const marker = this.createTargetMarker(color)
		marker.container.setPosition(x, y)
		this.targetMarker = marker
	}

	createTargetMarker(color) {
		const radiusOuter = 14 * this.gameScale
		const radiusInner = 6 * this.gameScale
		const container = this.add.container(0, 0)
		container.setDepth(400)
		const outer = this.add.circle(0, 0, radiusOuter, 0x000000, 0)
		outer.setStrokeStyle(3 * this.gameScale, color, 0.9)
		const inner = this.add.circle(0, 0, radiusInner, 0x000000, 0)
		inner.setStrokeStyle(2 * this.gameScale, color, 0.5)
		container.add([outer, inner])
		const pulse = this.tweens.add({
			targets: container,
			scale: { from: 0.9, to: 1.1 },
			duration: 650,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut',
		})
		return { container, pulse }
	}

	updateTargetTracking() {
		if (!this.selectedTarget || !this.targetMarker) return
		if (this.selectedTarget.type === 'sprite') {
			const sprite = this.selectedTarget.sprite
			if (!sprite || !sprite.active) {
				this.clearTargetSelection()
				return
			}
			this.targetMarker.container.setPosition(sprite.x, sprite.y)
		} else if (this.selectedTarget.type === 'point') {
			const pos = this.selectedTarget.position
			this.targetMarker.container.setPosition(pos.x, pos.y)
		}
	}

	clearTargetSelection() {
		this.selectedTarget = null
		this.pendingTargetClear = false
		this.clearTargetMarker()
		this.updateSelectionUI()
	}

	clearTargetMarker() {
		if (!this.targetMarker) return
		this.targetMarker.pulse?.stop()
		this.targetMarker.container?.destroy()
		this.targetMarker = null
	}

	updateSelectionUI() {
		if (!this.spellUiVisible) {
			this.setSpellUiVisible(true)
		}
		this.attemptImmediateCast()
	}

	attemptImmediateCast() {
		if (this.doctorDead) return
		if (!this.activeSpellKey) return
		if (!this.selectedTarget) return
		if (this.selectedTarget.type === 'point') {
			const spell = this.spellDefinitions.find((s) => s.key === this.activeSpellKey)
			const nearest = this.findNearestEnemyToPoint(this.selectedTarget.position, { range: spell?.targetRange })
			if (nearest) {
				this.castSpellAtPoint({ x: nearest.x, y: nearest.y })
			}
		} else if (this.selectedTarget.type === 'sprite') {
			const sprite = this.selectedTarget.sprite
			const spell = this.spellDefinitions.find((s) => s.key === this.activeSpellKey)
			const targetSprite = sprite?.active ? sprite : this.findNearestEnemyToPoint({ x: sprite?.x ?? 0, y: sprite?.y ?? 0 }, { range: spell?.targetRange })
			if (targetSprite?.active) {
				this.castSpellAtPoint({ x: targetSprite.x, y: targetSprite.y })
			}
		}
	}

	castSpellAtPoint(point) {
		if (this.doctorDead) return false
		if (!point) return false
		const spell = this.spellDefinitions.find((s) => s.key === this.activeSpellKey)
		return this.executeSpellCast(spell, point)
	}

	setSpellUiVisible(visible) {
		this.spellUiVisible = visible
		if (!this.menu) return
		const alpha = visible ? 1 : 0
		this.menu.setAlpha(alpha)
		if (this.menu.input) {
			this.menu.input.enabled = visible
		}
		if (this.menu.menutext) {
			this.menu.menutext.alpha = alpha
		}
		this.updateSpellUi()
	}

	createWalkConfirmEffect(x, y) {
		const radius = 12 * this.gameScale
		const circle = this.add.circle(x, y, radius, 0x00ff90, 0.15)
		circle.setStrokeStyle(3 * this.gameScale, 0x00ff90, 0.6)
		circle.setDepth(399)
		this.tweens.add({
			targets: circle,
			scale: { from: 0.9, to: 1.4 },
			alpha: { from: 1, to: 0 },
			duration: 420,
			ease: 'Sine.easeOut',
			onComplete: () => circle.destroy(),
		})
	}

	getSpellButtonCenter(spellKey) {
		if (!spellKey || !this.spellButtons.length) return null
		const btn = this.spellButtons.find((button) => button.getData('spell')?.key === spellKey)
		if (!btn) return null
		const size = btn.getData('buttonSize') ?? 0
		return {
			x: btn.x + size / 2,
			y: btn.y + size / 2,
		}
	}

	initRunTimerOverlay() {
		this.disposeRunTimerOverlay()
		const fontSize = `${Math.max(12, 16 * this.gameScale)}px`
		this.runTimerText = this.add.text(20, 20, '00:00:000', {
			fontSize,
			fontFamily: 'Silkscreen',
			color: '#ffffff',
		})
		this.runTimerText.setOrigin(0, 0)
		this.runTimerText.setScrollFactor(0)
		this.runTimerText.setDepth(500)
		this.runTimerStart = this.getSceneTimestamp()
	}

	disposeRunTimerOverlay() {
		if (!this.runTimerText) return
		this.runTimerText.destroy()
		this.runTimerText = null
	}

	updateRunTimerDisplay() {
		if (!this.runTimerText) return
		const now = this.getSceneTimestamp()
		const elapsed = Math.max(0, now - this.runTimerStart)
		this.runTimerText.setText(this.formatElapsedTime(elapsed))
	}

	formatElapsedTime(durationMs = 0) {
		const totalMs = Math.max(0, Math.floor(durationMs))
		const minutes = Math.floor(totalMs / 60000)
		const seconds = Math.floor((totalMs % 60000) / 1000)
		const milliseconds = totalMs % 1000
		return `${this.padNumber(minutes, 2)}:${this.padNumber(seconds, 2)}:${this.padNumber(milliseconds, 3)}`
	}

	padNumber(value, length) {
		return value.toString().padStart(length, '0')
	}

	formatEnemyCardLabel(key = '') {
		if (!key) return 'Enemy'
		const parts = key.split(/[-_]/g).filter(Boolean)
		if (!parts.length) {
			return key.charAt(0).toUpperCase() + key.slice(1)
		}
		return parts
			.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
			.join(' ')
	}

	normalizeEnemyCardCount(value) {
		const allowed = [10, 20, 50]
		const numeric = typeof value === 'number' ? value : 5
		let closest = allowed[0]
		let smallestDiff = Math.abs(numeric - closest)
		for (let i = 1; i < allowed.length; i++) {
			const diff = Math.abs(numeric - allowed[i])
			if (diff < smallestDiff) {
				smallestDiff = diff
				closest = allowed[i]
			}
		}
		return closest
	}

	getSceneTimestamp() {
		if (this.time && typeof this.time.now === 'number') {
			return this.time.now
		}
		if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
			return performance.now()
		}
		return Date.now()
	}

	cycleVisibleSpell(offset = 0) {
		if (!this.spellButtons.length) return
		if (!offset) return
		this.setVisibleSpellIndex(this.visibleSpellIndex + offset)
	}

	setVisibleSpellIndex(index = 0) {
		if (!this.spellButtons.length) {
			this.visibleSpellIndex = 0
			return
		}
		const normalized = ((index % this.spellButtons.length) + this.spellButtons.length) % this.spellButtons.length
		this.visibleSpellIndex = normalized
		this.updateSpellUi()
	}

	handleSpellPointer(pointer) {
		if (!this.activeSpellKey || this.doctorDead) return false
		const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
		this.deployActiveSpellAt(worldPoint)
		return true
	}

	deployActiveSpellAt(point) {
		if (this.doctorDead) return
		const spell = this.spellDefinitions.find((s) => s.key === this.activeSpellKey)
		this.executeSpellCast(spell, point)
	}

	executeSpellCast(spell, point) {
		if (this.doctorDead) return false
		if (!point) return false
		if (!spell || typeof spell.onCast !== 'function') {
			this.clearSpellSelection()
			return false
		}
		if (this.isSpellOnCooldown(spell)) {
			return false
		}
		this.playDoctorCastAnimation()
		spell.onCast(this, { x: point.x, y: point.y })
		this.startSpellCooldown(spell)
		const holdingSpell = this.heldSpellKey && this.heldSpellKey === spell.key
		if (!spell.keepSelection && !holdingSpell) {
			this.clearSpellSelection()
		}
		return true
	}

	resumeButtonIconAnimation(btn) {
		const icon = btn?.getData?.('icon')
		if (!icon?.anims) return
		const animKey = icon.getData?.('autoPlayAnimKey') || icon.anims.currentAnim?.key
		if (!animKey) return
		icon.anims.play(animKey, true)
		const repeat = icon.getData?.('autoPlayRepeat')
		if (typeof repeat === 'number') {
			icon.anims.setRepeat(repeat)
		}
	}

	disableContextMenuForCanvas() {
		const mouse = this.input?.mouse
		if (mouse?.disableContextMenu) {
			mouse.disableContextMenu()
		}
		const canvas = this.game?.canvas
		if (!canvas) return
		const blockContextMenu = (event) => {
			if (!event) return
			const path = typeof event.composedPath === 'function' ? event.composedPath() : null
			const targetIsCanvas = event.target === canvas
				|| (Array.isArray(path) && path.includes(canvas))
			if (!targetIsCanvas) return
			event.preventDefault?.()
			event.stopPropagation?.()
		}
		if (!this._contextMenuBlocker) {
			this._contextMenuBlocker = blockContextMenu
			window?.addEventListener?.('contextmenu', this._contextMenuBlocker, true)
			document?.addEventListener?.('contextmenu', this._contextMenuBlocker, true)
			this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
				this.removeContextMenuBlocker()
			})
			this.events.once(Phaser.Scenes.Events.DESTROY, () => {
				this.removeContextMenuBlocker()
			})
		}
		canvas.oncontextmenu = (event) => {
			blockContextMenu(event)
			return false
		}
		if (canvas.style) {
			canvas.style.touchAction = 'none'
			canvas.style.msTouchAction = 'none'
		}
	}

	removeContextMenuBlocker() {
		if (!this._contextMenuBlocker) return
		window?.removeEventListener?.('contextmenu', this._contextMenuBlocker, true)
		document?.removeEventListener?.('contextmenu', this._contextMenuBlocker, true)
		this._contextMenuBlocker = null
	}

	pauseButtonIconAnimation(btn) {
		const icon = btn?.getData?.('icon')
		if (!icon?.anims?.isPlaying) return
		icon.anims.pause()
	}
	getSpellCooldownRatio(spell) {
		if (!spell?.key || !spell.cooldownMs) return 1
		if (!this.time) return 1
		const expiresAt = this.spellCooldowns[spell.key] || 0
		const remaining = expiresAt - this.time.now
		if (remaining <= 0) return 1
		const ratio = 1 - (remaining / spell.cooldownMs)
		return Phaser.Math.Clamp(ratio, 0, 1)
	}
}
