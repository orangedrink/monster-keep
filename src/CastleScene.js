import Phaser from 'phaser'
import CrtOverlayShader from './shaders/CrtOverlayShader'

const SCREEN_INSETS = { left: 0, right: 240, top: 170, bottom: 220 }
const PLAYFIELD_SCALE = 0.572
const PLAYFIELD_OFFSET = { x: 0.15, y: 0.15 }

const MAZE_COLS = 25 // odd
const MAZE_ROWS = 17 // odd

const TILE = {
	WALL: 1,
	FLOOR: 0,
	STAIRS: 2,
}
const TROLL_DELAY_BASE = 750
const TROLL_DELAY_STEP = 25
const PLAYER_MAX_HP = 30
const TROLL_DAMAGE = 5
const BASE_PROJECTILE_RANGE = 3
const WEAPON_NAMES = [
	'Sword of Sorrow', 'Obsidian Scimitar', 'Cinderbrand', 'Echo Sabre', 'Moonlit Claymore',
	'Crystal Cutlass', 'Stormcleaver', 'Ashen Falchion', 'Gloomglaive', 'Radiant Rapier',
	'Inferno Edge', 'Frostbite Saber', 'Thunderbrand', 'Velvet Voulge', 'Nightglass Nodachi',
	'Harbinger Halberd', 'Silver Thorn', 'Dragonspine Dirk', 'Celestial Scythe', 'Umbral Ulfberht',
	'Phoenix Talon', 'Tempest Greatsword', 'Grim Gale Katana', 'Astral Arming Sword', 'Viper Fang',
	'Spectral Saber', 'Lionheart Longsword', 'Bloodsong Broadsword', 'Ember Edge', 'Mistbreaker',
	'Warwind Weapon', 'Deadlight Dagger', 'Rift Razer', 'Sunforged Slayer', 'Hallowed Hookblade',
	'Galehowl Gladius', 'Ironroot Iberis', 'Platinum Pike', 'Starforge Scimitar', 'Fang of Fate',
	'Sable Sabre', 'Titan Tooth', 'Blazewarden', 'Verdant Verdict', 'Nether Needle', 'Voidbrand',
	'Ironclad Ikazuchi', 'Sapphire Spine', 'Chrono Cutlass', 'Duskhunter', 'Stormsong Spatha',
	'Mythril Mauler', 'Sunset Saber', 'Glacier Guisarme', 'Vulcan Vindicator', 'Runeedge Reaver',
	'Marrowbite', 'Cataclysm Cleaver', 'Wyrmwood Wakizashi', 'Aetherbrand', 'Cosmic Khopesh',
	'Obsidian Oathblade', 'Nebula Naginata', 'Twilight Tachi', 'Shatterstar', 'Thunderjaw',
	'Gravemind Glaive', 'Seraphim Saber', 'Blightblade', 'Runebinder', 'Luminous Lancet',
	'Bloodwyrm Brand', 'Pyre Piercer', 'Felstorm Falchion', 'Aurora Arbalest', 'Crimson Cutter',
	'Basilisk Brand', 'Feral Fangblade', 'Mirage Machete', 'Oathkeeper', 'Skyfire Saber',
	'Soulrender', 'Tempest Talwar', 'Zephyr Zweihander', 'Chaos Carver', 'Voidrend',
	'Direbrand', 'Eclipse Epee', 'Nemesis Nodachi', 'Oracle Odachi', 'Paladin Pike',
	'Quartz Quillon', 'Ravage Rapier', 'Stormveil Scythe', 'Thornlash', 'Umber Ulfberht',
	'Vanguard Voulge', 'Whisperwind', 'Xiphos of Xenith', 'Yearning Yatagan', 'Zenith Zweihander'
]

export default class CastleScene extends Phaser.Scene {
	constructor() {
		super('castle')
	}

	preload() {
		if (!this.textures.exists('screen')) {
			this.load.image('screen', 'topdown/screen.png')
		}
		if (!this.cache.shader.exists('crt-overlay')) {
			this.cache.shader.add('crt-overlay', CrtOverlayShader)
		}
	}

	create() {
		this.level = 1
		this.playerState = {
			hp: PLAYER_MAX_HP,
			facing: { x: 1, y: 0 },
			direction: 'right',
		}
		this.weaponLevel = 0
		this.projectileRange = BASE_PROJECTILE_RANGE
		this.pendingPath = []
		this.pathMoveDelay = 120
		this.lastPathMove = 0
		this.bombCount = 0
		this.bombPickup = null
		this.bombProjectile = null
		this.trollShotLine = null
		this.createScreen()
		this.createPlayfield()
		this.createHUD()
		this.registerInput()
		this.setFacing(1, 0)
		this.generateMaze()
		this.drawScene()
		this.updateBombText()
		this.createCrtOverlay()
	}

	createScreen() {
		const { width, height } = this.scale
		this.screen = this.add.image(width / 2, height / 2, 'screen')
		const scale = Math.min((width * 1.4) / this.screen.width, (height * 1.4) / this.screen.height)
		this.screen.setScale(scale)
		this.screenBounds = this.screen.getBounds()
	}

	createPlayfield() {
		const inset = SCREEN_INSETS
		const availableWidth = this.screenBounds.width - inset.left - inset.right
		const availableHeight = this.screenBounds.height - inset.top - inset.bottom
		const width = availableWidth * PLAYFIELD_SCALE
		const height = availableHeight * PLAYFIELD_SCALE
		const x = this.screenBounds.centerX - width / 2 - 90
		const y = this.screenBounds.top + inset.top + availableHeight * PLAYFIELD_OFFSET.y + 40
		this.playfield = new Phaser.Geom.Rectangle(x, y, width, height)
		this.tileSize = Math.min(width / MAZE_COLS, height / MAZE_ROWS)
		this.mapOrigin = {
			x: this.playfield.left + (width - this.tileSize * MAZE_COLS) / 2,
			y: this.playfield.top + (height - this.tileSize * MAZE_ROWS) / 2,
		}
		this.add.rectangle(
			this.playfield.centerX,
			this.playfield.centerY,
			width,
			height,
			0x000000,
			0.25
		).setStrokeStyle(2, 0x00ff9c, 0.8)
		this.graphics = this.add.graphics()
		this.graphics.setDepth(1)
	}

	createHUD() {
		const titleFont = { fontFamily: 'Silkscreen', fontSize: 18, color: '#00ff9c' }
		this.titleText = this.add.text(
			this.playfield.centerX,
			this.playfield.top - 36,
			'Neon Castle',
			titleFont
		).setOrigin(0.5)
		this.levelText = this.add.text(
			this.playfield.right-90,
			this.playfield.top - 36,
			'Level 1',
			{ ...titleFont, fontSize: 18, color: '#f05a28' }
		)
		this.bombIcon = this.add.text(
			this.playfield.right - 34,
			this.playfield.top - 38,
			'💣',
			{ fontFamily: 'sans-serif', fontSize: 26, color: '#ffffff' }
		)
			.setOrigin(0.5)
			.setInteractive({ useHandCursor: true })
			.setVisible(false)
			.setDepth(5)
		this.bombIcon.on('pointerdown', this.handleBombIconPointer, this)
		this.hpText = this.add.text(
			this.playfield.left,
			this.playfield.top - 36,
			'HP: 30',
			{ ...titleFont, fontSize: 18, color: '#ffff66' }
		)
		this.weaponText = this.add.text(
			this.playfield.centerX,
			this.playfield.bottom,
			'Weapon: Unarmed',
			{ fontFamily: 'Silkscreen', fontSize: 16, color: '#00ff9c' }
		).setOrigin(0.5, 0)
		this.bombText = this.add.text(
			this.playfield.centerX,
			this.playfield.bottom + 18,
			'Bombs: 0',
			{ fontFamily: 'Silkscreen', fontSize: 14, color: '#ffae00' }
		).setOrigin(0.5, 0)
		this.refreshBombIcon()
	}

	registerInput() {
		this.cursors = this.input.keyboard.createCursorKeys()
		this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
		this.input.on('pointerdown', this.handlePointerSelect, this)
	}

	setFacing(dx = 0, dy = 0) {
		if (!this.playerState) return
		const vector = { ...this.playerState.facing }
		if (dx !== 0 || dy !== 0) {
			vector.x = Math.sign(dx)
			vector.y = Math.sign(dy)
			if (vector.x !== 0 && vector.y !== 0) {
				// give priority to explicit vertical input when both registered
				vector.x = 0
			}
			if (vector.x === 0 && vector.y === 0) {
				vector.x = 1
			}
			this.playerState.facing = vector
		}
	}

	generateMaze() {
		const prevHp = Math.min(this.player?.hp ?? PLAYER_MAX_HP, PLAYER_MAX_HP)
		this.destroyTrollSprites()
		this.grid = Array.from({ length: MAZE_ROWS }, () => Array.from({ length: MAZE_COLS }, () => TILE.WALL))
		const carve = (x, y) => {
			this.grid[y][x] = TILE.FLOOR
			const dirs = Phaser.Utils.Array.Shuffle([
				{ dx: 0, dy: -2 },
				{ dx: 0, dy: 2 },
				{ dx: -2, dy: 0 },
				{ dx: 2, dy: 0 },
			])
			for (const { dx, dy } of dirs) {
				const nx = x + dx
				const ny = y + dy
				if (nx <= 0 || ny <= 0 || nx >= MAZE_COLS - 1 || ny >= MAZE_ROWS - 1) continue
				if (this.grid[ny][nx] === TILE.WALL) {
					this.grid[y + dy / 2][x + dx / 2] = TILE.FLOOR
					carve(nx, ny)
				}
			}
		}
		carve(1, 1)
		this.player = { x: 1, y: 1, hp: prevHp }
		this.placeStairs()
		this.ensureSprites()
		this.spawnTrolls()
		this.placePowerup()
		this.bombPickup = null
		if (this.bombPickupSprite) {
			this.bombPickupSprite.setVisible(false)
		}
		this.maybePlaceLevelBomb()
		this.updateHpText()
		this.updateWeaponText()
	}

	placeStairs() {
		let best = { x: 1, y: 1 }
		let bestDist = -1
		for (let y = 1; y < MAZE_ROWS - 1; y++) {
			for (let x = 1; x < MAZE_COLS - 1; x++) {
				if (this.grid[y][x] !== TILE.FLOOR) continue
				const dist = Phaser.Math.Distance.Squared(this.player.x, this.player.y, x, y)
				if (dist > bestDist) {
					bestDist = dist
					best = { x, y }
				}
			}
		}
		this.stairs = best
		this.grid[best.y][best.x] = TILE.STAIRS
	}

	placePowerup() {
		const spot = this.randomFloorForPowerup()
		this.powerup = spot
		this.powerupHue = Phaser.Math.Between(0, 359)
	}

	maybePlaceLevelBomb() {
		if (this.level < 10) return
		if (Phaser.Math.FloatBetween(0, 1) > 0.5) return
		const spot = this.randomFloorForPowerup()
		this.bombPickup = spot
		if (this.bombPickupSprite) {
			this.bombPickupSprite.setVisible(true)
			this.bombPickupSprite.setPosition(
				this.mapOrigin.x + spot.x * this.tileSize + this.tileSize / 2,
				this.mapOrigin.y + spot.y * this.tileSize + this.tileSize / 2
			)
		}
	}

	randomFloorForPowerup() {
		let attempts = 0
		while (attempts++ < 500) {
			const x = Phaser.Math.Between(1, MAZE_COLS - 2)
			const y = Phaser.Math.Between(1, MAZE_ROWS - 2)
			if (!this.isWalkable(x, y)) continue
			if (x === this.player.x && y === this.player.y) continue
			if (x === this.stairs.x && y === this.stairs.y) continue
			if (this.powerup && x === this.powerup.x && y === this.powerup.y) continue
			if (this.bombPickup && x === this.bombPickup.x && y === this.bombPickup.y) continue
			if (this.trolls && this.trolls.some((t) => t.x === x && t.y === y)) continue
			return { x, y }
		}
		return { x: 1, y: 1 }
	}

	ensureSprites() {
		if (!this.playerSprite) {
			this.playerSprite = this.createKnightSprite()
		} else {
			this.updateKnightScale(this.playerSprite)
		}
		if (!this.stairsSprite) {
			this.stairsSprite = this.createStairSprite()
		}
	}

	update(time, delta) {
		if (!this.cursors) return
		let moved = false
		if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
			this.pendingPath = []
			moved = this.tryMove(-1, 0)
		} else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
			this.pendingPath = []
			moved = this.tryMove(1, 0)
		} else if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
			this.pendingPath = []
			moved = this.tryMove(0, -1)
		} else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
			this.pendingPath = []
			moved = this.tryMove(0, 1)
		}

		let fired = false
		if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
			if (this.bombCount > 0 && !this.bombProjectile) {
				fired = this.throwBomb()
			} else if (this.weaponLevel > 0) {
				fired = this.fireBolt()
			}
		}
		if (!fired && this.weaponLevel > 0 && !this.boltSprite) {
			const autoDir = this.findAutoAimDirection()
			if (autoDir) {
				fired = this.fireBolt(autoDir)
			}
		}

		const autoMoved = this.processQueuedPath(time)
		const trollsMoved = this.updateTrolls(time)
		const boltActive = this.updateBolt(delta)
		const bombActive = this.updateBombProjectile(delta)
		if (moved || trollsMoved || fired || boltActive || autoMoved || bombActive) {
			this.drawScene()
		}
	}

	tryMove(dx, dy) {
		const nx = this.player.x + dx
		const ny = this.player.y + dy
		this.setFacing(dx, dy)
		if (!this.isWalkable(nx, ny)) return false
		const tile = this.grid[ny][nx]
		this.player.x = nx
		this.player.y = ny
		if (tile === TILE.STAIRS) {
			this.level += 1
			this.levelText.setText(`Level ${this.level}`)
			this.generateMaze()
		}
		this.checkPowerup()
		this.checkBombPickup()
		return true
	}

	isWalkable(x, y) {
		if (x < 0 || y < 0 || x >= MAZE_COLS || y >= MAZE_ROWS) return false
		const tile = this.grid[y][x]
		return tile === TILE.FLOOR || tile === TILE.STAIRS
	}

	checkPowerup() {
		if (!this.powerup) return
		if (this.player.x === this.powerup.x && this.player.y === this.powerup.y) {
			this.collectPowerup()
		}
	}

	collectPowerup() {
		this.weaponLevel = Math.min(this.weaponLevel + 1, WEAPON_NAMES.length)
		this.projectileRange = BASE_PROJECTILE_RANGE + this.weaponLevel
		this.powerup = null
		this.updateWeaponText()
	}

	handlePointerSelect(pointer) {
		if (!this.playfield || !this.grid) return
		if (!this.playfield.contains(pointer.x, pointer.y)) return
		const tileX = Math.floor((pointer.x - this.mapOrigin.x) / this.tileSize)
		const tileY = Math.floor((pointer.y - this.mapOrigin.y) / this.tileSize)
		if (!this.isWalkable(tileX, tileY)) return
		const path = this.findPath({ x: this.player.x, y: this.player.y }, { x: tileX, y: tileY }, 10)
		if (path && path.length > 1) {
			this.pendingPath = path.slice(1)
			this.lastPathMove = 0
		}
	}

	checkBombPickup() {
		if (!this.bombPickup) return
		if (this.player.x === this.bombPickup.x && this.player.y === this.bombPickup.y) {
			this.bombPickup = null
			if (this.bombPickupSprite) {
				this.bombPickupSprite.setVisible(false)
			}
			this.bombCount++
			this.updateBombText()
		}
	}

	drawScene() {
		this.graphics.clear()
		this.graphics.lineStyle(2, 0x00ff9c, 0.85)
		for (let y = 0; y < MAZE_ROWS; y++) {
			for (let x = 0; x < MAZE_COLS; x++) {
				if (this.grid[y][x] === TILE.WALL) {
					const px = this.mapOrigin.x + x * this.tileSize
					const py = this.mapOrigin.y + y * this.tileSize
					this.graphics.strokeRect(px, py, this.tileSize, this.tileSize)
				}
			}
		}
		this.playerSprite.setPosition(
			this.mapOrigin.x + this.player.x * this.tileSize + this.tileSize / 2,
			this.mapOrigin.y + this.player.y * this.tileSize + this.tileSize / 2
		)
		this.stairsSprite.setPosition(
			this.mapOrigin.x + this.stairs.x * this.tileSize + this.tileSize / 2,
			this.mapOrigin.y + this.stairs.y * this.tileSize + this.tileSize / 2
		)
		this.drawPowerup()
		this.drawBomb()
		this.drawTrolls()
	}

	processQueuedPath(time) {
		if (!this.pendingPath?.length) return false
		if (time - this.lastPathMove < this.pathMoveDelay) return false
		const next = this.pendingPath.shift()
		const dx = next.x - this.player.x
		const dy = next.y - this.player.y
		const moved = this.tryMove(dx, dy)
		if (!moved) {
			this.pendingPath = []
			return false
		}
		this.lastPathMove = time
		return true
	}

	drawPowerup() {
		if (!this.powerupSprite) {
			this.powerupSprite = this.createGunSprite()
		}
		if (this.powerup) {
			const color = Phaser.Display.Color.HSVToRGB((this.powerupHue % 360) / 360, 0.7, 1).color
			this.powerupSprite.setVisible(true)
			this.tintGunSprite(this.powerupSprite, color)
			this.powerupSprite.setPosition(
				this.mapOrigin.x + this.powerup.x * this.tileSize + this.tileSize / 2,
				this.mapOrigin.y + this.powerup.y * this.tileSize + this.tileSize / 2
			)
		} else if (this.powerupSprite) {
			this.powerupSprite.setVisible(false)
		}
	}

	drawBomb() {
		if (!this.bombPickupSprite) {
			this.bombPickupSprite = this.createBombSprite()
		}
		if (this.bombPickup) {
			this.bombPickupSprite.setVisible(true)
			this.bombPickupSprite.setPosition(
				this.mapOrigin.x + this.bombPickup.x * this.tileSize + this.tileSize / 2,
				this.mapOrigin.y + this.bombPickup.y * this.tileSize + this.tileSize / 2
			)
		} else {
			this.bombPickupSprite.setVisible(false)
		}
	}

	createKnightSprite(paletteOverrides = {}, scaleFactor = 1) {
		const palette = {
			helmet: 0x8dd5ff,
			visor: 0x001f33,
			body: 0x00ff9c,
			trim: 0xfff1b5,
			arm: 0x00c58f,
			shoulder: 0x8dd5ff,
			...paletteOverrides,
		}
		const container = this.add.container(0, 0)
		container.setDepth(2)
		container.scaleFactor = scaleFactor
		container.bodyParts = {
			helmet: this.add.rectangle(0, 0, 0, 0, palette.helmet),
			visor: this.add.rectangle(0, 0, 0, 0, palette.visor),
			body: this.add.rectangle(0, 0, 0, 0, palette.body),
			trim: this.add.rectangle(0, 0, 0, 0, palette.trim),
			leftShoulder: this.add.circle(0, 0, 0, palette.shoulder, 0.95),
			rightShoulder: this.add.circle(0, 0, 0, palette.shoulder, 0.95),
			leftArm: this.add.rectangle(0, 0, 0, 0, palette.arm),
			rightArm: this.add.rectangle(0, 0, 0, 0, palette.arm),
		}
		Object.values(container.bodyParts).forEach((part) => {
			part.setDepth(2)
			container.add(part)
		})
		this.updateKnightScale(container)
		this.tintKnightSprite(container, palette)
		return container
	}

	updateKnightScale(sprite) {
		if (!sprite?.bodyParts) return
		const scale = this.tileSize * (sprite.scaleFactor || 1)
		const { helmet, visor, body, trim, leftArm, rightArm, leftShoulder, rightShoulder } = sprite.bodyParts
		helmet.setSize(scale * 0.55, scale * 0.35)
		helmet.setPosition(0, -scale * 0.1)
		visor.setSize(scale * 0.4, scale * 0.08)
		visor.setPosition(0, -scale * 0.1)
		body.setSize(scale * 0.45, scale * 0.6)
		body.setPosition(0, scale * 0.2)
		trim.setSize(scale * 0.5, scale * 0.12)
		trim.setPosition(0, scale * 0.45)
		leftShoulder.setRadius(scale * 0.2)
		leftShoulder.setPosition(-scale * 0.35, scale * 0.05)
		rightShoulder.setRadius(scale * 0.2)
		rightShoulder.setPosition(scale * 0.35, scale * 0.05)
		leftArm.setSize(scale * 0.16, scale * 0.55)
		leftArm.setPosition(-scale * 0.35, scale * 0.4)
		rightArm.setSize(scale * 0.16, scale * 0.55)
		rightArm.setPosition(scale * 0.35, scale * 0.4)
	}

	tintKnightSprite(sprite, palette) {
		if (!sprite?.bodyParts) return
		const { helmet, visor, body, trim, leftArm, rightArm, leftShoulder, rightShoulder } = sprite.bodyParts
		helmet.setFillStyle(palette.helmet ?? helmet.fillColor)
		visor.setFillStyle(palette.visor ?? visor.fillColor)
		body.setFillStyle(palette.body ?? body.fillColor)
		trim.setFillStyle(palette.trim ?? trim.fillColor)
		leftArm.setFillStyle(palette.arm ?? leftArm.fillColor)
		rightArm.setFillStyle(palette.arm ?? rightArm.fillColor)
		leftShoulder.setFillStyle(palette.shoulder ?? leftShoulder.fillColor)
		rightShoulder.setFillStyle(palette.shoulder ?? rightShoulder.fillColor)
	}

	createGunSprite() {
		const container = this.add.container(0, 0)
		container.setDepth(2)
		container.parts = {
			body: this.add.rectangle(0, 0, this.tileSize * 0.6, this.tileSize * 0.18, 0xffffff),
			barrel: this.add.rectangle(this.tileSize * 0.25, -this.tileSize * 0.15, this.tileSize * 0.35, this.tileSize * 0.08, 0xffffff),
			handle: this.add.rectangle(-this.tileSize * 0.2, this.tileSize * 0.22, this.tileSize * 0.12, this.tileSize * 0.28, 0xffffff),
			muzzle: this.add.circle(this.tileSize * 0.43, -this.tileSize * 0.15, this.tileSize * 0.06, 0xffffff),
		}
		Object.values(container.parts).forEach((part) => {
			part.setDepth(2)
			container.add(part)
		})
		return container
	}

	tintGunSprite(sprite, color) {
		if (!sprite?.parts) return
		Object.values(sprite.parts).forEach((part) => part.setFillStyle(color, 1))
	}

	createStairSprite() {
		const container = this.add.container(0, 0)
		container.setDepth(2)
		const stepHeight = this.tileSize * 0.12
		const stepWidth = this.tileSize * 0.6
		container.steps = []
		for (let i = 0; i < 4; i++) {
			const step = this.add.rectangle(0, i * stepHeight - stepHeight * 1.5, stepWidth - i * this.tileSize * 0.1, stepHeight * 0.9, 0x7b7f8b)
			step.setStrokeStyle(1, 0x44474f, 0.8)
			container.add(step)
			container.steps.push(step)
		}
		const shading = this.add.rectangle(0, stepHeight * 0.5, stepWidth * 0.8, stepHeight * 0.5, 0x2a2d32, 0.6)
		container.add(shading)
		return container
	}

	spawnTrolls() {
		this.trolls = []
		const count = Math.min(1 + Math.floor(this.level / 2), 8)
		for (let i = 0; i < count; i++) {
			const spot = this.randomFloorExcluding()
			this.trolls.push({
				x: spot.x,
				y: spot.y,
				delay: Math.max(350, TROLL_DELAY_BASE - this.level * TROLL_DELAY_STEP),
				lastMove: 0,
				isShooter: this.level >= 10 && Math.random() < 0.35,
				shotDelay: 900,
				lastShot: 0,
			})
		}
	}

	randomFloorExcluding() {
		let attempts = 0
		while (attempts++ < 500) {
			const x = Phaser.Math.Between(1, MAZE_COLS - 2)
			const y = Phaser.Math.Between(1, MAZE_ROWS - 2)
			if (!this.isWalkable(x, y)) continue
			if (x === this.player.x && y === this.player.y) continue
			if (x === this.stairs.x && y === this.stairs.y) continue
			if (this.trolls && this.trolls.some((t) => t.x === x && t.y === y)) continue
			return { x, y }
		}
		return { x: 1, y: 1 }
	}

	updateTrolls(time) {
		if (!this.trolls) return false
		let moved = false
		for (const troll of this.trolls) {
			if (time - troll.lastMove < troll.delay) continue
			const directions = Phaser.Utils.Array.Shuffle([
				{ x: 1, y: 0 },
				{ x: -1, y: 0 },
				{ x: 0, y: 1 },
				{ x: 0, y: -1 },
				{ x: 0, y: 0 },
			])
			for (const dir of directions) {
				const nx = troll.x + dir.x
				const ny = troll.y + dir.y
				if (nx === this.player.x && ny === this.player.y) {
					if (this.applyDamage(TROLL_DAMAGE)) {
						return true
					}
					break
				}
				if (!this.isWalkable(nx, ny)) continue
				if (nx === this.stairs.x && ny === this.stairs.y) continue
				if (this.trolls.some((t) => t !== troll && t.x === nx && t.y === ny)) continue
				troll.x = nx
				troll.y = ny
				moved = true
				break
			}
			troll.lastMove = time
			if (troll.isShooter) {
				this.tryTrollShot(troll, time)
			}
		}
		return moved
	}

	drawTrolls() {
		if (!this.trollSprites) this.trollSprites = []
		while (this.trollSprites.length < this.trolls.length) {
			const troll = this.trolls[this.trollSprites.length] || {}
			const palette = troll.isShooter
				? {
					helmet: 0xff5e5e,
					visor: 0x2b0000,
					body: 0xff8b8b,
					trim: 0xffd0d0,
					arm: 0xcc3434,
					shoulder: 0xff5e5e,
				}
				: {
					helmet: 0x4bd37e,
					visor: 0x013b1d,
					body: 0x3dff8a,
					trim: 0xbfffd2,
					arm: 0x1f9155,
					shoulder: 0x4bd37e,
				}
			const sprite = this.createKnightSprite(palette, 0.85)
			this.trollSprites.push(sprite)
		}
		this.trollSprites.forEach((sprite, index) => {
			const troll = this.trolls[index]
			if (!troll) {
				sprite.setVisible(false)
				return
			}
			sprite.setVisible(true)
			this.updateKnightScale(sprite)
			this.tintKnightSprite(
				sprite,
				troll.isShooter
					? {
						helmet: 0xff5e5e,
						visor: 0x2b0000,
						body: 0xff8b8b,
						trim: 0xffd0d0,
						arm: 0xcc3434,
						shoulder: 0xff5e5e,
					}
					: {
						helmet: 0x4bd37e,
						visor: 0x013b1d,
						body: 0x3dff8a,
						trim: 0xbfffd2,
						arm: 0x1f9155,
						shoulder: 0x4bd37e,
					}
			)
			sprite.setPosition(
				this.mapOrigin.x + troll.x * this.tileSize + this.tileSize / 2,
				this.mapOrigin.y + troll.y * this.tileSize + this.tileSize / 2
			)
		})
	}

	destroyTrollSprites() {
		if (!this.trollSprites) return
		this.trollSprites.forEach((sprite) => sprite.destroy())
		this.trollSprites = []
	}

	updateBolt(delta) {
		if (!this.boltSprite || !this.boltSprite.active) return false
		this.boltTravelled += delta * 0.01
		const gridX = Math.floor((this.boltSprite.x - this.mapOrigin.x) / this.tileSize)
		const gridY = Math.floor((this.boltSprite.y - this.mapOrigin.y) / this.tileSize)
		if (
			gridX < 0 ||
			gridY < 0 ||
			gridX >= MAZE_COLS ||
			gridY >= MAZE_ROWS ||
			this.grid[gridY][gridX] === TILE.WALL ||
			this.boltTravelled >= this.projectileRange
		) {
			this.destroyBolt()
			return false
		}
		const troll = this.findTrollAt(gridX, gridY)
		if (troll) {
			this.removeTroll(troll)
			this.destroyBolt()
			return true
		}
		return true
	}

	destroyBolt() {
		if (this.boltSprite) {
			this.boltSprite.destroy()
			this.boltSprite = null
		}
	}

	updateBombProjectile(delta) {
		if (!this.bombProjectile || !this.bombProjectile.active) return false
		this.bombTravelled += delta * 0.01
		const gridX = Math.floor((this.bombProjectile.x - this.mapOrigin.x) / this.tileSize)
		const gridY = Math.floor((this.bombProjectile.y - this.mapOrigin.y) / this.tileSize)
		if (gridX < 0 || gridY < 0 || gridX >= MAZE_COLS || gridY >= MAZE_ROWS) {
			this.explodeBomb(gridX, gridY)
			return false
		}
		if (this.grid[gridY][gridX] === TILE.WALL) {
			this.grid[gridY][gridX] = TILE.FLOOR
			this.explodeBomb(gridX, gridY)
			return true
		}
		const troll = this.findTrollAt(gridX, gridY)
		if (troll) {
			this.removeTroll(troll)
			this.explodeBomb(gridX, gridY)
			return true
		}
		if (this.bombTravelled >= 6) {
			this.explodeBomb(gridX, gridY)
			return true
		}
		return true
	}

	destroyBombProjectile() {
		if (this.bombProjectile) {
			this.bombProjectile.destroy()
			this.bombProjectile = null
		}
	}

	explodeBomb(gridX, gridY) {
		if (this.bombProjectile?.active) {
			this.bombProjectile.destroy()
		}
		this.bombProjectile = null
		const explosion = this.add.circle(
			this.mapOrigin.x + gridX * this.tileSize + this.tileSize / 2,
			this.mapOrigin.y + gridY * this.tileSize + this.tileSize / 2,
			this.tileSize * 0.2,
			0xffd166,
			0.85
		).setDepth(3)
		this.tweens.add({
			targets: explosion,
			alpha: 0,
			scale: 3,
			duration: 250,
			onComplete: () => explosion.destroy(),
		})
		this.drawTrolls()
	}

	fireBolt(overrideDirection = null) {
		if (!this.weaponLevel) return false
		const dir = overrideDirection || this.playerState?.facing
		if (!dir) return false
		if (dir.x && dir.y) {
			// Prioritize last horizontal move if both somehow set.
			dir.y = 0
		}
		if (!dir.x && !dir.y) return false
		if (this.boltSprite) {
			this.boltSprite.destroy()
			this.boltSprite = null
		}
		this.boltSprite = this.add.circle(0, 0, this.tileSize * 0.15, 0xffff66, 1)
		this.boltSprite.setDepth(3)
		const vx = dir.x * this.tileSize * 12
		const vy = dir.y * this.tileSize * 12
		this.physics.add.existing(this.boltSprite)
		const body = this.boltSprite.body
		body.setAllowGravity(false)
		body.setVelocity(vx, vy)
		body.setCircle(this.tileSize * 0.15)
		body.setOffset(-this.tileSize * 0.15, -this.tileSize * 0.15)
		this.boltSprite.setPosition(
			this.mapOrigin.x + this.player.x * this.tileSize + this.tileSize / 2,
			this.mapOrigin.y + this.player.y * this.tileSize + this.tileSize / 2
		)
		this.boltMaxDistance = this.projectileRange
		this.boltTravelled = 0
		return true
	}

	findTrollAt(x, y) {
		return this.trolls?.find((t) => t.x === x && t.y === y) || null
	}

	removeTroll(troll) {
		const idx = this.trolls.indexOf(troll)
		if (idx !== -1) {
			this.trolls.splice(idx, 1)
		}
		this.trySpawnBomb(troll)
		this.drawTrolls()
	}

	applyDamage(amount) {
		this.player.hp = Math.max(0, this.player.hp - amount)
		this.updateHpText()
		if (this.player.hp <= 0) {
			this.handlePlayerDefeat()
			return true
		}
		return false
	}

	handlePlayerDefeat() {
		this.cameras.main.shake(150, 0.003)
		this.level = 1
		this.player.hp = PLAYER_MAX_HP
		this.weaponLevel = 0
		this.projectileRange = BASE_PROJECTILE_RANGE
		this.bombCount = 0
		this.bombPickup = null
		this.updateBombText()
		if (this.bombPickupSprite) {
			this.bombPickupSprite.setVisible(false)
		}
		this.levelText.setText('Level 1')
		this.setFacing(1, 0)
		this.updateWeaponText()
		this.generateMaze()
		this.drawScene()
	}

	updateHpText() {
		if (!this.hpText) return
		const hp = this.player?.hp ?? PLAYER_MAX_HP
		this.hpText.setText(`HP: ${hp}/${PLAYER_MAX_HP}`)
	}

	updateWeaponText() {
		if (!this.weaponText) return
		if (!this.weaponLevel) {
			this.weaponText.setText('Weapon: Unarmed')
			return
		}
		const name = WEAPON_NAMES[Math.min(this.weaponLevel, WEAPON_NAMES.length) - 1]
		this.weaponText.setText(`Weapon: ${name} (Range ${this.projectileRange})`)
	}

	updateBombText() {
		if (!this.bombText) return
		this.bombText.setText(`Bombs: ${this.bombCount}`)
		this.refreshBombIcon()
	}

	refreshBombIcon() {
		if (!this.bombIcon) return
		const hasBombs = this.bombCount > 0
		this.bombIcon.setVisible(hasBombs)
	}

	handleBombIconPointer() {
		if (!this.bombIcon?.visible) return
		if (this.bombCount > 0 && !this.bombProjectile) {
			this.throwBomb()
		}
	}

	findAutoAimDirection() {
		const directions = [
			{ x: 1, y: 0 },
			{ x: -1, y: 0 },
			{ x: 0, y: 1 },
			{ x: 0, y: -1 },
		]
		for (const dir of directions) {
			for (let step = 1; step <= this.projectileRange; step++) {
				const nx = this.player.x + dir.x * step
				const ny = this.player.y + dir.y * step
				if (nx < 0 || ny < 0 || nx >= MAZE_COLS || ny >= MAZE_ROWS) break
				if (!this.isWalkable(nx, ny)) break
				const troll = this.findTrollAt(nx, ny)
				if (troll) {
					return { x: dir.x, y: dir.y }
				}
			}
		}
		return null
	}

	findPath(start, goal, maxDistance) {
		const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
		const key = (pos) => `${pos.x},${pos.y}`
		const open = [{ pos: start, f: heuristic(start, goal) }]
		const cameFrom = new Map()
		const gScore = new Map([[key(start), 0]])

		while (open.length) {
			open.sort((a, b) => a.f - b.f)
			const current = open.shift()
			const currentKey = key(current.pos)
			const currentG = gScore.get(currentKey) ?? Infinity
			if (current.pos.x === goal.x && current.pos.y === goal.y) {
				if (currentG > maxDistance) return null
				return this.reconstructPath(cameFrom, current.pos)
			}
			for (const neighbor of this.getNeighbors(current.pos)) {
				if (!this.isWalkable(neighbor.x, neighbor.y)) continue
				const tentativeG = currentG + 1
				if (tentativeG > maxDistance) continue
				const neighborKey = key(neighbor)
				if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
					cameFrom.set(neighborKey, current.pos)
					gScore.set(neighborKey, tentativeG)
					const existing = open.find((n) => n.pos.x === neighbor.x && n.pos.y === neighbor.y)
					const fScore = tentativeG + heuristic(neighbor, goal)
					if (existing) {
						existing.f = Math.min(existing.f, fScore)
					} else {
						open.push({ pos: neighbor, f: fScore })
					}
				}
			}
		}
		return null
	}

	getNeighbors(pos) {
		return [
			{ x: pos.x + 1, y: pos.y },
			{ x: pos.x - 1, y: pos.y },
			{ x: pos.x, y: pos.y + 1 },
			{ x: pos.x, y: pos.y - 1 },
		].filter((n) => n.x >= 0 && n.y >= 0 && n.x < MAZE_COLS && n.y < MAZE_ROWS)
	}

	reconstructPath(cameFrom, current) {
		const path = [current]
		let keyPos = `${current.x},${current.y}`
		while (cameFrom.has(keyPos)) {
			const prev = cameFrom.get(keyPos)
			path.unshift(prev)
			keyPos = `${prev.x},${prev.y}`
		}
		return path
	}

	tryTrollShot(troll, time) {
		if (time - (troll.lastShot || 0) < troll.shotDelay) return
		if (troll.x === this.player.x) {
			const dy = Math.sign(this.player.y - troll.y)
			const distance = Math.abs(this.player.y - troll.y)
			if (dy !== 0 && distance <= 5 && this.lineClear(troll.x, troll.y, 0, dy, distance)) {
				troll.lastShot = time
				this.renderTrollShot(troll, { x: 0, y: dy }, distance)
				this.applyDamage(Math.ceil(TROLL_DAMAGE / 2))
			}
		} else if (troll.y === this.player.y) {
			const dx = Math.sign(this.player.x - troll.x)
			const distance = Math.abs(this.player.x - troll.x)
			if (dx !== 0 && distance <= 5 && this.lineClear(troll.x, troll.y, dx, 0, distance)) {
				troll.lastShot = time
				this.renderTrollShot(troll, { x: dx, y: 0 }, distance)
				this.applyDamage(Math.ceil(TROLL_DAMAGE / 2))
			}
		}
	}

	lineClear(x, y, dx, dy, distance) {
		for (let step = 1; step < distance; step++) {
			const nx = x + dx * step
			const ny = y + dy * step
			if (nx < 0 || ny < 0 || nx >= MAZE_COLS || ny >= MAZE_ROWS) return false
			if (this.grid[ny][nx] === TILE.WALL) return false
		}
		return true
	}

	renderTrollShot(troll, dir, distance) {
		if (!this.trollShotLine) {
			this.trollShotLine = this.add.line(0, 0, 0, 0, 0, 0, 0xff6655, 0.9)
				.setOrigin(0, 0)
				.setDepth(3)
		}
		const startX = this.mapOrigin.x + troll.x * this.tileSize + this.tileSize / 2
		const startY = this.mapOrigin.y + troll.y * this.tileSize + this.tileSize / 2
		const endX = startX + dir.x * this.tileSize * distance
		const endY = startY + dir.y * this.tileSize * distance
		this.trollShotLine.setTo(startX, startY, endX, endY)
		this.trollShotLine.setVisible(true)
		if (this.trollShotTimer) {
			this.trollShotTimer.remove(false)
		}
		this.trollShotTimer = this.time.delayedCall(200, () => {
			if (this.trollShotLine) this.trollShotLine.setVisible(false)
		})
	}

	trySpawnBomb(troll) {
		if (Phaser.Math.FloatBetween(0, 1) > 0.15) return
		if (!this.bombPickupSprite) {
			this.bombPickupSprite = this.createBombSprite()
		}
		this.bombPickup = { x: troll.x, y: troll.y }
		this.bombPickupSprite.setVisible(true)
		this.bombPickupSprite.setPosition(
			this.mapOrigin.x + this.bombPickup.x * this.tileSize + this.tileSize / 2,
			this.mapOrigin.y + this.bombPickup.y * this.tileSize + this.tileSize / 2
		)
	}

	createBombSprite() {
		const container = this.add.container(0, 0)
		container.setDepth(2)
		const shell = this.add.circle(0, 0, this.tileSize * 0.25, 0x111111)
		const highlight = this.add.circle(-this.tileSize * 0.08, -this.tileSize * 0.08, this.tileSize * 0.08, 0xffffff, 0.6)
		const fuse = this.add.rectangle(0, -this.tileSize * 0.3, this.tileSize * 0.1, this.tileSize * 0.2, 0xffd166)
		container.add(shell)
		container.add(highlight)
		container.add(fuse)
		container.setVisible(false)
		return container
	}

	throwBomb() {
		const dir = this.playerState?.facing
		if (!dir || (!dir.x && !dir.y) || this.bombCount <= 0) return false
		this.bombCount = Math.max(0, this.bombCount - 1)
		this.updateBombText()
		this.destroyBombProjectile()
		this.bombProjectile = this.add.circle(0, 0, this.tileSize * 0.18, 0xffae00, 1).setDepth(3)
		this.physics.add.existing(this.bombProjectile)
		const body = this.bombProjectile.body
		body.setAllowGravity(false)
		body.setVelocity(dir.x * this.tileSize * 10, dir.y * this.tileSize * 10)
		body.setCircle(this.tileSize * 0.18)
		body.setOffset(-this.tileSize * 0.18, -this.tileSize * 0.18)
		this.bombProjectile.setPosition(
			this.mapOrigin.x + this.player.x * this.tileSize + this.tileSize / 2,
			this.mapOrigin.y + this.player.y * this.tileSize + this.tileSize / 2
		)
		this.bombTravelled = 0
		return true
	}

	createCrtOverlay() {
		if (!this.game.renderer || this.game.renderer.type !== Phaser.WEBGL) return
		if (!this.cache.shader.exists('crt-overlay')) return

		const { width, height } = this.scale
		this.crtOverlay = this.add.shader('crt-overlay', 0, 0, width, height)
			.setOrigin(0, 0)
			.setScrollFactor(0)
			.setDepth(100)
		this.crtOverlay.setDisplaySize(width, height)
		this.animateCrtOverlay()

		if (!this.resizeHandler) {
			this.resizeHandler = this.handleResize.bind(this)
			this.scale.on('resize', this.resizeHandler)
			this.events.once('shutdown', () => {
				this.scale.off('resize', this.resizeHandler)
				this.resizeHandler = null
			})
		}
	}

	handleResize(gameSize) {
		if (!this.crtOverlay) return
		const width = gameSize?.width || this.scale.width
		const height = gameSize?.height || this.scale.height
		this.crtOverlay.setPosition(0, 0)
		this.crtOverlay.setSize(width, height)
		this.crtOverlay.setDisplaySize(width, height)
	}

	animateCrtOverlay() {
		if (!this.crtOverlay) return
		const opacityUniform = this.crtOverlay.getUniform('opacity')
		const intensityUniform = this.crtOverlay.getUniform('intensity')
		if (!opacityUniform || !intensityUniform) return
		if (this.crtOverlayFadeTween) {
			this.crtOverlayFadeTween.stop()
		}
		if (this.crtOverlayWaverTween) {
			this.crtOverlayWaverTween.stop()
			this.crtOverlayWaverTween = null
		}
		intensityUniform.value = 0.2
		opacityUniform.value = 0
		this.crtOverlayFadeTween = this.tweens.timeline({
			targets: opacityUniform,
			tweens: [{
				value: 0.2,
				duration: 600,
				ease: 'Sine.easeOut',
			}, {
				value: 0.04,
				duration: 1200,
				ease: 'Sine.easeIn',
				delay: 200,
			}],
			onComplete: () => {
				this.crtOverlayFadeTween = null
				this.crtOverlayWaverTween = this.tweens.add({
					targets: opacityUniform,
					value: { from: 0.02, to: 0.16 },
					duration: 500,
					ease: 'Sine.easeInOut',
					yoyo: true,
					repeat: -1,
					repeatDelay: 120,
				})
			}
		})
	}

}
