import Phaser from 'phaser'

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
		this.createScreen()
		this.createPlayfield()
		this.createHUD()
		this.registerInput()
		this.setFacing(1, 0)
		this.generateMaze()
		this.drawScene()
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
		const titleFont = { fontFamily: 'Silkscreen', fontSize: 22, color: '#00ff9c' }
		this.titleText = this.add.text(
			this.playfield.centerX,
			this.playfield.top - 36,
			'Neon Maze',
			titleFont
		).setOrigin(0.5)
		this.levelText = this.add.text(
			this.playfield.right,
			this.playfield.top - 36,
			'Level 1',
			{ ...titleFont, fontSize: 18, color: '#ff6388' }
		).setOrigin(1, 0.5)
		this.hpText = this.add.text(
			this.playfield.left,
			this.playfield.top - 36,
			'HP: 30',
			{ ...titleFont, fontSize: 18, color: '#ffff66' }
		)
		this.weaponText = this.add.text(
			this.playfield.centerX,
			this.playfield.bottom + 20,
			'Weapon: Unarmed',
			{ fontFamily: 'Silkscreen', fontSize: 16, color: '#00ff9c' }
		).setOrigin(0.5, 0)
	}

	registerInput() {
		this.cursors = this.input.keyboard.createCursorKeys()
		this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
	}

	setFacing(dx = 0, dy = 0) {
		if (!this.playerState) return
		const vector = {
			x: dx !== 0 ? Math.sign(dx) : this.playerState.facing.x,
			y: dy !== 0 ? Math.sign(dy) : this.playerState.facing.y,
		}
		// prevent diagonal stored states
		if (vector.x !== 0 && vector.y !== 0) {
			vector.y = 0
		}
		if (vector.x === 0 && vector.y === 0) {
			vector.x = 1
		}
		this.playerState.facing = vector
		if (vector.x === 1) this.playerState.direction = 'right'
		else if (vector.x === -1) this.playerState.direction = 'left'
		else if (vector.y === 1) this.playerState.direction = 'down'
		else if (vector.y === -1) this.playerState.direction = 'up'
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
	}

	randomFloorForPowerup() {
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

	ensureSprites() {
		if (!this.playerSprite) {
			this.playerSprite = this.createKnightSprite()
		} else {
			this.updateKnightScale(this.playerSprite)
		}
		if (!this.stairsSprite) {
			const size = this.tileSize * 0.6
			this.stairsSprite = this.add.triangle(0, 0, 0, size, size, size, size / 2, 0, 0xffff66, 0.95)
			this.stairsSprite.setDepth(2)
		}
	}

	update(time, delta) {
		if (!this.cursors) return
		let moved = false
		if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) moved = this.tryMove(-1, 0)
		else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) moved = this.tryMove(1, 0)
		else if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) moved = this.tryMove(0, -1)
		else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) moved = this.tryMove(0, 1)

		let fired = false
		if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
			fired = this.fireBolt()
		}

		const trollsMoved = this.updateTrolls(time)
		const boltActive = this.updateBolt(delta)
		if (moved || trollsMoved || fired || boltActive) {
			this.drawScene()
		}
	}

	tryMove(dx, dy) {
		const nx = this.player.x + dx
		const ny = this.player.y + dy
		if (!this.isWalkable(nx, ny)) return false
		const tile = this.grid[ny][nx]
		this.player.x = nx
		this.player.y = ny
		this.setFacing(dx, dy)
		if (tile === TILE_STAIRS) {
			this.level += 1
			this.levelText.setText(`Level ${this.level}`)
			this.generateMaze()
		}
		this.checkPowerup()
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
		this.drawTrolls()
	}

	drawPowerup() {
		if (!this.powerupSprite) {
			this.powerupSprite = this.add.star(0, 0, 5, this.tileSize * 0.12, this.tileSize * 0.25, 0xfff066, 0.95)
			this.powerupSprite.setDepth(2)
		}
		if (this.powerup) {
			this.powerupSprite.setVisible(true)
			this.powerupSprite.setPosition(
				this.mapOrigin.x + this.powerup.x * this.tileSize + this.tileSize / 2,
				this.mapOrigin.y + this.powerup.y * this.tileSize + this.tileSize / 2
			)
		} else {
			this.powerupSprite.setVisible(false)
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
		}
		return moved
	}

	drawTrolls() {
		if (!this.trollSprites) this.trollSprites = []
		while (this.trollSprites.length < this.trolls.length) {
			const sprite = this.createKnightSprite(
				{
					helmet: 0x4bd37e,
					visor: 0x013b1d,
					body: 0x3dff8a,
					trim: 0xbfffd2,
					arm: 0x1f9155,
					shoulder: 0x4bd37e,
				},
				0.85
			)
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

	fireBolt() {
		const dir = this.playerState?.facing
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
}
