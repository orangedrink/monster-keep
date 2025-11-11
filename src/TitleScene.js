import Phaser from 'phaser'
import BaseScene from './BaseScene.js'
import Dialog from './ui/Dialog.js'
import createFireballEffect from './effects/createFireballEffect.js'
import Slime from './topdown/sprites/Slime.js'
import FireballSprite, { FIREBALL_PROJECTILE_KEY } from './spells/FireballSprite.js'
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
	cooldownMs: 500,
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
			const baseScale = .65 * scene.gameScale
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
			console.log(initialAngle)
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
		for(let i = 0; i<3; i++) {
			fireProjectile(i * 90)
		}
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

	create() {
		super.create()
		this.createTileNumberOverlay()
	}

	createTileNumberOverlay() {
		const map = this.topdown?.map
		if (!map) return
		const tilemapData = this.cache?.tilemap?.get(this.tilemapKey)?.data
		const backgroundLayer = tilemapData?.layers?.find(
			(layer) => layer.name === 'background layer' && Array.isArray(layer.data)
		)
		if (!backgroundLayer) return
		const tileWidth = (map.tileWidth ?? 16) * this.gameScale
		const tileHeight = (map.tileHeight ?? 16) * this.gameScale
		const width = backgroundLayer.width ?? map.width ?? 0
		const height = backgroundLayer.height ?? map.height ?? 0
		if (!width || !height) return
		const texts = []
		const style = {
			fontFamily: 'Silkscreen',
			fontSize: `${Math.max(6, 7 * this.gameScale)}px`,
			color: '#ff5555',
		}
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const index = y * width + x
				const tileValue = backgroundLayer.data[index] ?? 0
				const worldX = x * tileWidth + tileWidth / 2
				const worldY = y * tileHeight + tileHeight / 2
				const label = this.add.text(worldX, worldY, `${tileValue}`, style)
				label.setOrigin(0.5)
				label.setDepth(500)
				label.setScrollFactor(1)
				texts.push(label)
			}
		}
		this.tileNumberLabels = texts
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.tileNumberLabels?.forEach((txt) => txt.destroy())
			this.tileNumberLabels = null
		})
	}

	preload() {
		super.preload()
		this.load.spritesheet(FIREBALL_PROJECTILE_KEY, 'condo/spells/fireball.png', {
			frameWidth: 44,
			frameHeight: 13,
		})
	}

	getEnemySpawnerConfigs() {
		const baseConfig = {
			spriteClass: Slime,
			interval: 1500,
			spawnConfig: {
				wanderRadius: 90,
				chaseSpeed: 16,
			},
			position: {
				jitterX: 32,
				jitterY: 16,
			},
		}
		const tileSpawners = this.createTileSpawnerConfigs(147, baseConfig)
		if (tileSpawners.length) {
			return tileSpawners
		}
		return [
			{
				...baseConfig,
				key: 'slime-east',
				position: { ...baseConfig.position, offsetX: 240 },
			},
			{
				...baseConfig,
				key: 'slime-west',
				position: { ...baseConfig.position, offsetX: -240 },
			},
		]
	}

	createTileSpawnerConfigs(tileIndex, baseConfig) {
		const positions = this.findTileSpawnerPositions(tileIndex)
		if (!positions.length) return []
		const jitterX = (baseConfig.position?.jitterX ?? 0) * this.gameScale
		const jitterY = (baseConfig.position?.jitterY ?? 0) * this.gameScale
		return positions.map((pos, index) => ({
			key: `slime-tile${tileIndex}-${index}`,
			interval: baseConfig.interval,
			spawnHandler: (scene) => {
				const spawnX = pos.x + (jitterX ? Phaser.Math.Between(-jitterX, jitterX) : 0)
				const spawnY = pos.y + (jitterY ? Phaser.Math.Between(-jitterY, jitterY) : 0)
				scene.spawnEnemySprite(Slime, spawnX, spawnY, baseConfig.spawnConfig)
			},
		}))
	}

	findTileSpawnerPositions(tileIndex) {
		const tilemapEntry = this.cache?.tilemap?.get(this.tilemapKey)
		const data = tilemapEntry?.data
		if (!data?.layers?.length) return []
		const tileset = data.tilesets?.[0]
		const firstgid = tileset?.firstgid ?? 1
		const targetGid = firstgid + tileIndex
		const tileWidth = data.tilewidth ?? 16
		const tileHeight = data.tileheight ?? 16
		const scale = this.gameScale ?? 1
		const positions = []
		for (const layer of data.layers) {
			if (layer.type !== 'tilelayer' || !Array.isArray(layer.data)) continue
			const width = layer.width ?? data.width ?? 0
			if (!width) continue
			layer.data.forEach((gid, idx) => {
				if (gid !== targetGid) return
				const col = idx % width
				const row = Math.floor(idx / width)
				const x = (col * tileWidth + tileWidth / 2) * scale
				const y = (row * tileHeight + tileHeight / 2) * scale
				positions.push({ x, y })
			})
		}
		return positions
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
