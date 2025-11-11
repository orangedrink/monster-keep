import Phaser from 'phaser'
import Topdown from './topdown/Topdown.js'
import Doctor from './topdown/Doctor.js'
import Slime from './topdown/sprites/Slime.js'
import Menu from './ui/Menu.js'
import createSmokeEffect from './effects/createSmokeEffect.js'
import createSparkEffect from './effects/createSparkEffect.js'

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

export default class BaseScene extends Phaser.Scene {
	gameScale = Math.round(window.innerWidth / 600)
	gamestate = {}

	constructor(key, props) {
		super(key)
		this.spriteData = props.spriteData || TITLE_SPRITE_DATA;
		this.levelData = props.levelData;
		this.levelScripts = props.levelScripts;
		this.triggers = {};
		this.spellDefinitions = props.spells || [];
		this.spellButtons = [];
		this.activeSpellKey = null;
		this.spellCursor = 'crosshair';
		this.selectedTarget = null;
		this.targetMarker = null;
		this.spellUiVisible = false;
		this.spellCooldowns = {};
		this.enemySpawners = [];
	}

	getSpriteData() {
		return this.spriteData ?? []
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
		return []
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
		const spawn = () => {
			const position = this.resolveSpawnerPosition(config.position)
			if (!position) return
			if (spawnHandler) {
				spawnHandler(this, position)
				return
			}
			if (spriteClass) {
				this.spawnEnemySprite(spriteClass, position.x, position.y, config.spawnConfig || {})
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
		const entityLayer = this.topdown.map.getObjectLayer('entities')
		if (entityLayer && entityLayer.objects) {
			entityLayer.objects.filter((obj) => obj.type === 'slime').forEach((obj) => {
				const slime = new Slime(this, {
					scene: this,
					x: obj.x * this.gameScale,
					y: obj.y * this.gameScale,
					wanderRadius: this.getPropertyValue(obj.properties, 'wanderRadius', 60),
					moveDuration: this.getPropertyValue(obj.properties, 'moveDuration', 1600),
				})
				slime.create()
				this.slimes.push(slime)
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
		if (!this.spellDefinitions.length) return

		this.spellButtons = this.spellDefinitions.map((spell, index) => this.createSpellButton(spell, index))
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.spellButtons.forEach((btn) => btn.destroy())
			this.spellButtons = []
		})
	}

	createSpellButton(spell, index) {
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
			icon = this.add.circle(size / 2, size / 2, iconRadius, spell.iconColor || 0xffc857, 0.85)
			icon.setBlendMode(Phaser.BlendModes.ADD)
		} else if (icon.setBlendMode) {
			icon.setBlendMode(Phaser.BlendModes.ADD)
		}
		const labelText = spell.label || spell.key
		const label = this.add.text(size / 2, size + 4, labelText, {
			fontSize: `${Math.max(10, 12 * this.gameScale)}px`,
			fontFamily: 'Silkscreen',
			color: '#ffffff',
		})
		label.setOrigin(0.5, 0)
		label.setDepth(151)
		container.add([bg, icon, label])
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
			const icon = btn.getData('icon')
			const isSelected = spell.key === this.activeSpellKey
			bg.setStrokeStyle(2 * (isSelected ? 1.5 : 1), isSelected ? 0xfff2a0 : 0xffffff, isSelected ? 0.9 : 0.25)
			if (icon?.setScale) {
				icon.setScale(isSelected ? 1.1 : 1)
			}
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
			if (this.shouldConfirmWalk(worldPoint)) {
				this.confirmWalkToPoint(this.selectedTarget.position)
			} else {
				this.selectTargetPoint(worldPoint)
			}
		}
		return true
	}

	shouldConfirmWalk(point) {
		if (!this.selectedTarget || this.selectedTarget.type !== 'point') return false
		const prev = this.selectedTarget.position
		const threshold = 18 * this.gameScale
		const dx = point.x - prev.x
		const dy = point.y - prev.y
		return Math.hypot(dx, dy) <= threshold
	}

	confirmWalkToPoint(point) {
		if (!point) return
		this.doctor.addDestinationPoint({ x: point.x, y: point.y })
		this.createWalkConfirmEffect(point.x, point.y)
		this.clearTargetSelection()
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
		this.updateSelectionUI()
	}

	selectTargetSprite(sprite) {
		this.selectedTarget = {
			type: 'sprite',
			sprite,
		}
		this.applyTargetMarker(0xff3b58, sprite.x, sprite.y)
		this.updateSelectionUI()
	}

	selectNearestEnemyTarget() {
		const targets = this.getSelectableTargets()
		if (!targets.length) return null
		const originX = this.doctor?.x ?? 0
		const originY = this.doctor?.y ?? 0
		let nearest = null
		let nearestDistSq = Number.POSITIVE_INFINITY
		for (let i = 0; i < targets.length; i++) {
			const sprite = targets[i]
			if (!sprite?.active) continue
			const dx = sprite.x - originX
			const dy = sprite.y - originY
			const distSq = dx * dx + dy * dy
			if (distSq < nearestDistSq) {
				nearest = sprite
				nearestDistSq = distSq
			}
		}
		if (!nearest) return null
		this.selectTargetSprite(nearest)
		return nearest
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
			this.castSpellAtPoint(this.selectedTarget.position)
		} else if (this.selectedTarget.type === 'sprite') {
			const sprite = this.selectedTarget.sprite
			if (sprite?.active) {
				this.castSpellAtPoint({ x: sprite.x, y: sprite.y })
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
