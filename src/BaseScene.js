import Phaser from 'phaser'
import Topdown from './topdown/Topdown.js'
import Doctor from './topdown/Doctor.js'
import Slime from './topdown/sprites/Slime.js'
import Menu from './ui/Menu.js'
import createSmokeEffect from './effects/createSmokeEffect.js'
import createSparkEffect from './effects/createSparkEffect.js'
import createFireballEffect, { createImpactLight } from './effects/createFireballEffect.js'
import FireballSprite from './spells/FireballSprite.js'
import { FIREBALL_PROJECTILE_KEY } from './spells/FireballSprite.js'

const GROW_TWEEN = {
	alpha: { from: 0, to: 1 },
	scale: { from: 0.05, to: 1 },
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

const SPELL_LIBRARY = {
	fireball: {
		key: 'fireball',
		label: 'Fireball',
		iconColor: 0xff6b18,
		autoTargetNearestEnemy: true,
		cooldownMs: 100,
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
			const start = { x: scene.doctor?.x ?? target.x, y: scene.doctor?.y ?? target.y }
			const fireProjectile = (delay = 0) => {
				const baseScale = 0.65 * scene.gameScale
				const projectile = new FireballSprite(scene, {
					x: start.x,
					y: start.y,
					scale: baseScale,
					depth: 190,
				})
				projectile.create()
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
				const initialAngle = Phaser.Math.Angle.Between(0, 0, direction.x, direction.y)
				projectile.setRotation(initialAngle)
				const maxOffset = distance * 0.15
				let offsetMag
				const playerX = scene.doctor?.x ?? start.x
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
			for (let i = 0; i < 1; i++) {
				fireProjectile(i * 90)
			}
		},
	},
}

export default class BaseScene extends Phaser.Scene {
	gameScale = Math.round(window.innerWidth / 600)
	gamestate = {}

	constructor(key, props) {
		super(key)
		this.spriteData = props.spriteData || TITLE_SPRITE_DATA;
		this.levelData = props.levelData;
		this.levelScripts = props.levelScripts;
		this.triggers = {};
		this.spellKeys = props.spells || ['fireball'];
		this.spellDefinitions = [];
		this.tileSpawnerPoints = props.tileSpawners || [];
		this.spellButtons = [];
		this.activeSpellKey = null;
		this.spellCursor = 'crosshair';
		this.selectedTarget = null;
		this.targetMarker = null;
		this.spellUiVisible = false;
		this.spellCooldowns = {};
		this.enemySpawners = [];
		this.pendingTargetClear = false;
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
		const slime = this.spawnEnemySprite(Slime, x, y, {
			wanderRadius: config.wanderRadius ?? 60,
			moveDuration: config.moveDuration ?? 1600,
			chaseSpeed: config.chaseSpeed,
		})
		return slime
	}

	registerSlime(slime) {
		if (!slime) return
		if (!this.slimes) {
			this.slimes = []
		}
		this.slimes.push(slime)
	}

	destroyEnemiesAt(x, y, radius = 20 * this.gameScale) {
		if (!this.slimes?.length) return 0
		const radiusSq = radius * radius
		let destroyed = 0
		for (let i = 0; i < this.slimes.length; i++) {
			const slime = this.slimes[i]
			if (!slime?.active) continue
			const dx = slime.x - x
			const dy = slime.y - y
			if ((dx * dx + dy * dy) <= radiusSq) {
				slime.destroy()
				destroyed++
			}
		}
		this.slimes = this.slimes.filter((slime) => slime && slime.active)
		return destroyed
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
		const config = { ...tweenConfig, targets: target }
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
		const interval = Math.max(250, config.interval ?? 4000)
		const spawnHandler = typeof config.spawnHandler === 'function' ? config.spawnHandler : null
		const spriteClass = config.spriteClass
		const spawnTween = config.spawnTween === null ? null : (config.spawnTween || GROW_TWEEN)
		const spawn = () => {
			const position = this.resolveSpawnerPosition(config.position)
			if (!position) return
			if (spawnHandler) {
				spawnHandler(this, position)
				return
			}
			if (spriteClass) {
				const enemy = this.spawnEnemySprite(spriteClass, position.x, position.y, config.spawnConfig || {})
				if (enemy && spawnTween) {
					this.applySpawnTween(enemy, spawnTween)
				}
				return
			}
			this.spawnSlimeAt(position.x, position.y, config.spawnConfig || {})
		}
		const event = this.time.addEvent({
			delay: interval,
			loop: true,
			callback: spawn,
		})
		return {
			key: config.key || Phaser.Utils.String.UUID(),
			event,
			destroy: () => event?.remove?.(),
		}
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


		this.topdown = new Topdown(this, { key: 'tilemap', tileWidth: 16, tileHeight: 16 })
		this.topdown.create()

		const centerX = (this.topdown.map.widthInPixels * this.gameScale) / 2
		const centerY = (this.topdown.map.heightInPixels * this.gameScale) / 2
		this.doctor = new Doctor(this, { scene: this, x: centerX, y: centerY })
		this.doctor.create()
		this.startx = this.doctor.x
		this.starty = this.doctor.y

		this.slimes = []
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
				this.createEnemySpawner({
					interval: obj.properties?.find((p) => p.name === 'interval')?.value || 3000,
					position: {
						x: centerX,
						y: centerY,
						jitterX,
						jitterY,
					},
					spawnConfig: {
						wanderRadius: 60 * this.gameScale,
						moveDuration: 1600,
						chaseSpeed: 16 * this.gameScale,
					},
				})

			})
		}

		this.menu = new Menu(this, { x: this.doctor.x + window.innerWidth / 2 - 10, y: this.doctor.y - window.innerHeight / 2 + 10 - 300 })
		this.menu.create()
		this.setSpellUiVisible(true)
		this.initSpellSystem()
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.clearTargetSelection()
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
		if (this.panelDialog) this.panelDialog.update()
		this.menu.update(time)
		this.updateSpellUi()
		this.updateTargetTracking()

	}

	initSpellSystem() {
		this.spellDefinitions = this.resolveSpellDefinitions(this.spellKeys)
		if (!this.spellDefinitions.length) return

		this.spellButtons = this.spellDefinitions.map((spell) => this.createSpellButton(spell))
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
		container.add([bg, readyGlow, icon, label])
		const baseHeight = size + label.height + 4
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
			this.selectSpell(spell)
		})
		container.setData('spell', spell)
		container.setData('bg', bg)
		container.setData('icon', icon)
		container.setData('readyGlow', readyGlow)
		container.setData('iconBaseScaleX', icon?.scaleX ?? 1)
		container.setData('iconBaseScaleY', icon?.scaleY ?? 1)
		container.setData('buttonSize', size)
		container.setData('buttonHeight', size + label.height + 4)
		container.setData('blocksPointerRouting', true)
		return container
	}

	selectSpell(spell) {
		if (!spell) return
		if (this.activeSpellKey === spell.key) {
			this.clearSpellSelection()
			return
		}
		this.activeSpellKey = spell.key
		this.input.setDefaultCursor(this.spellCursor)
		this.updateSpellButtonStates()
		if (!this.selectedTarget && spell.autoTargetNearestEnemy) {
			this.selectNearestEnemyTarget()
		}
		this.attemptImmediateCast()
	}

	clearSpellSelection() {
		this.activeSpellKey = null
		this.input.setDefaultCursor('default')
		this.updateSpellButtonStates()
	}

	updateSpellButtonStates() {
		if (!this.spellButtons.length) return
		this.spellButtons.forEach((btn) => {
			const spell = btn.getData('spell')
			const bg = btn.getData('bg')
			const isSelected = spell.key === this.activeSpellKey
			bg.setStrokeStyle(2 * (isSelected ? 1.5 : 1), isSelected ? 0xfff2a0 : 0xffffff, isSelected ? 0.9 : 0.25)
			btn.setAlpha(this.menu?.alpha ?? 1)
		})
	}

	updateSpellUi() {
		if (!this.spellButtons.length || !this.menu) return
		const anchor = this.computeSpellUiAnchor()
		if (!anchor) return
		const visible = (this.menu.alpha ?? 0) > 0.05
		this.spellButtons.forEach((btn, idx) => {
			const wasVisible = btn.visible
			btn.setPosition(anchor.startX + idx * anchor.buttonSpacing, anchor.startY)
			btn.setAlpha(this.menu.alpha)
			btn.setVisible(visible)
			if (btn.input) {
				btn.input.enabled = visible
			}
			if (visible && !wasVisible) {
				this.resumeButtonIconAnimation(btn)
			} else if (!visible && wasVisible) {
				this.pauseButtonIconAnimation(btn)
			}
		})
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

	selectNearestEnemyTarget() {
		const originX = this.doctor?.x ?? 0
		const originY = this.doctor?.y ?? 0
		const nearest = this.findNearestEnemyToPoint({ x: originX, y: originY })
		if (!nearest) return null
		this.selectTargetSprite(nearest)
		return nearest
	}

	findNearestEnemyToPoint(point) {
		const targets = this.getSelectableTargets()
		if (!targets.length || !point) return null
		let nearest = null
		let nearestDistSq = Number.POSITIVE_INFINITY
		for (let i = 0; i < targets.length; i++) {
			const sprite = targets[i]
			if (!sprite?.active) continue
			const dx = sprite.x - point.x
			const dy = sprite.y - point.y
			const distSq = dx * dx + dy * dy
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
		if (!this.activeSpellKey) return
		if (!this.selectedTarget) return
		if (this.selectedTarget.type === 'point') {
			const nearest = this.findNearestEnemyToPoint(this.selectedTarget.position)
			if (nearest) {
				this.castSpellAtPoint({ x: nearest.x, y: nearest.y })
			}
		} else if (this.selectedTarget.type === 'sprite') {
			const sprite = this.selectedTarget.sprite
			const targetSprite = sprite?.active ? sprite : this.findNearestEnemyToPoint({ x: sprite?.x ?? 0, y: sprite?.y ?? 0 })
			if (targetSprite?.active) {
				this.castSpellAtPoint({ x: targetSprite.x, y: targetSprite.y })
			}
		}
	}

	castSpellAtPoint(point) {
		if (!point) return
		const spell = this.spellDefinitions.find((s) => s.key === this.activeSpellKey)
		this.executeSpellCast(spell, point)
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

	handleSpellPointer(pointer) {
		if (!this.activeSpellKey) return false
		const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
		this.deployActiveSpellAt(worldPoint)
		return true
	}

	deployActiveSpellAt(point) {
		const spell = this.spellDefinitions.find((s) => s.key === this.activeSpellKey)
		this.executeSpellCast(spell, point)
	}

	executeSpellCast(spell, point) {
		if (!point) return false
		if (!spell || typeof spell.onCast !== 'function') {
			this.clearSpellSelection()
			return false
		}
		if (this.isSpellOnCooldown(spell)) {
			return false
		}
		spell.onCast(this, { x: point.x, y: point.y })
		this.startSpellCooldown(spell)
		if (!spell.keepSelection) {
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

	pauseButtonIconAnimation(btn) {
		const icon = btn?.getData?.('icon')
		if (!icon?.anims?.isPlaying) return
		icon.anims.pause()
	}
}
