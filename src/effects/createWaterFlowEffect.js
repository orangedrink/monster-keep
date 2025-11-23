import Phaser from 'phaser'

function resolveWorldMetrics(scene) {
	const tileHeight = scene?.topdown?.map?.tileHeight ?? 16
	const tileWidth = scene?.topdown?.map?.tileWidth ?? 16
	const scale = scene?.gameScale ?? 1
	const mapWidthTiles = scene?.topdown?.map?.width ?? (scene?.topdown?.map?.widthInPixels
		? scene.topdown.map.widthInPixels / tileWidth
		: 0)
	const mapWidthPixels = Math.max(
		(scene?.topdown?.map?.widthInPixels ?? 0),
		(mapWidthTiles || 0) * tileWidth,
		scene?.cameras?.main?.width ?? 0,
		800,
	)
	const worldWidth = mapWidthPixels * scale
	return { tileHeight, tileWidth, scale, worldWidth, mapWidthTiles }
}

/**
 * Creates a world-space, rectangular water overlay that scrolls with the camera.
 * @param {Phaser.Scene} scene
 * @param {object} opts
 * @param {number} [opts.y=0] Tile-space Y coordinate (top of the band)
 * @param {number} [opts.height=5] Tile-space height of the flow band
 * @returns {{ destroy: Function }}
 */
export default function createWaterFlowEffect(scene, opts = {}) {
/* 	if (!scene || typeof scene.add !== 'function') {
		return { destroy() {} }
	} */

	const {
		y = 0,
		height = 5,
		x = 0,
		width = null,
		color = 0x1b5fa7,
	} = opts

	const metrics = resolveWorldMetrics(scene)
	const tileHeight = metrics.tileHeight
	const tileWidth = metrics.tileWidth
	const scale = metrics.scale
	const defaultWorldWidth = metrics.worldWidth
	const defaultWidthTiles = metrics.mapWidthTiles ?? (defaultWorldWidth / (tileWidth * scale))
	const halfTileHeight = 0.5 * tileHeight * scale
	const halfTileWidth = 0.5 * tileWidth * scale
	const worldTop = y * tileHeight * scale
	const heightTiles = Math.max(1, height)
	const worldHeight = Math.max(4, heightTiles * tileHeight * scale)
	const hasCustomWidth = typeof width === 'number' && width > 0
	const widthTiles = hasCustomWidth ? Math.max(1, width) : defaultWidthTiles
	const resolvedWidth = widthTiles * tileWidth * scale + 20
	const startTileX = typeof x === 'number' ? x : 0
	const worldX = (startTileX * tileWidth * scale) - 10
	const worldWidth = resolvedWidth

	// Create rounded rectangle graphics for base water
	const baseGraphics = scene.add.graphics()
	baseGraphics.fillStyle(color, 0.48)
	baseGraphics.fillRoundedRect(worldX, worldTop, worldWidth, worldHeight, 8)
	baseGraphics.setDepth(40)
	baseGraphics.setBlendMode(Phaser.BlendModes.SCREEN)
	baseGraphics.setScrollFactor(1, 1)

	// Add top white border line
	const topBorder = scene.add.graphics()
	topBorder.lineStyle(1, 0xffffff, 0.4)
	topBorder.lineBetween(worldX + 8, worldTop, worldX + worldWidth - 8, worldTop)
	topBorder.setDepth(44)
	topBorder.setScrollFactor(1, 1)

	// Add bottom white border line
	const bottomBorder = scene.add.graphics()
	bottomBorder.lineStyle(1, 0xffffff, 0.4)
	bottomBorder.lineBetween(worldX + 8, worldTop + worldHeight, worldX + worldWidth - 8, worldTop + worldHeight)
	bottomBorder.setDepth(44)
	bottomBorder.setScrollFactor(1, 1)

	const foamRect = scene.add.rectangle(worldX, worldTop, worldWidth, worldHeight, 0xffffff, 0.18)
	foamRect.setOrigin(0, 0)
	foamRect.setDepth(41)
	foamRect.setBlendMode(Phaser.BlendModes.ADD)
	foamRect.setScrollFactor(1, 1)

	const shimmerRect = scene.add.rectangle(worldX, worldTop, worldWidth, worldHeight * 0.35, 0xb9e5ff, 0.25)
	shimmerRect.setOrigin(0, 0)
	shimmerRect.setDepth(42)
	shimmerRect.setBlendMode(Phaser.BlendModes.ADD)
	shimmerRect.setScrollFactor(1, 1)

	const foamTween = scene.tweens.add({
		targets: foamRect,
		alpha: { from: 0.26, to: 0.08 },
		y: { from: worldTop - worldHeight * 0.05, to: worldTop + worldHeight * 0.05 },
		duration: 1800,
		ease: 'Sine.easeInOut',
		yoyo: true,
		repeat: -1,
	})

	const shimmerTween = scene.tweens.add({
		targets: shimmerRect,
		alpha: { from: 0.35, to: 0.05 },
		y: { from: worldTop + worldHeight * 0.05, to: worldTop + worldHeight * 0.25 },
		duration: 1400,
		ease: 'Sine.easeInOut',
		yoyo: true,
		repeat: -1,
	})

	const bubbles = []
	const spawnBubble = () => {
		if (!scene || !scene.add || handle.destroyed) {
			return
		}
		const radius = Phaser.Math.FloatBetween(2, 4) * scale
		const startX = worldX - Phaser.Math.FloatBetween(4, 8) * scale
		const startY = worldTop + Phaser.Math.FloatBetween(0, worldHeight)
		const bubble = scene.add.circle(startX, startY, radius, 0xd6fbff, 0.45)
		bubble.setDepth(43)
		bubble.setBlendMode(Phaser.BlendModes.ADD)
		bubble.setScrollFactor(1, 1)
		bubbles.push(bubble)
		const duration = Phaser.Math.Between(2200, 3600)
		scene.tweens.add({
			targets: bubble,
			x: worldX + worldWidth + Phaser.Math.FloatBetween(16, 28) * scale,
			y: startY + Phaser.Math.FloatBetween(-worldHeight * 0.12, worldHeight * 0.12),
			alpha: { from: 0.6, to: 0 },
			scale: { from: 1, to: 0.3 },
			duration,
			ease: 'Sine.easeOut',
			onComplete: () => {
				bubble.destroy()
				const idx = bubbles.indexOf(bubble)
				if (idx !== -1) {
					bubbles.splice(idx, 1)
				}
			},
		})
	}

	const bubbleTimer = scene.time?.addEvent({
		delay: 260,
		loop: true,
		callback: spawnBubble,
	})

	const collisionHandle = applyWaterCollision(scene, startTileX, y, widthTiles, heightTiles)

	console.log('[WaterFlowEffect] Created water overlay', {
		image: baseGraphics,
		y,
		height,
		x,
		width,
		worldTop,
		worldHeight,
		worldX,
		worldWidth,
	})

	const handle = {
		destroyed: false,
		destroy() {
			if (this.destroyed) return
			this.destroyed = true
			foamTween?.stop()
			shimmerTween?.stop()
			bubbleTimer?.remove()
			collisionHandle?.restore?.()
			bubbles.forEach((bubble) => bubble?.destroy())
			bubbles.length = 0
			baseGraphics?.destroy()
			topBorder?.destroy()
			bottomBorder?.destroy()
			foamRect?.destroy()
			shimmerRect?.destroy()
		},
	}

	const cleanup = () => handle.destroy()
	if (scene?.sys?.events) {
		scene.sys.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
		scene.sys.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
	}

	return handle
}

function applyWaterCollision(scene, startX, startY, widthTiles, heightTiles) {
	const layer = scene?.topdown?.collisionLayer
	const collisionData = scene?.topdown?.collisionData
	if (!layer || !collisionData?.length) {
		return null
	}
	const maxRows = collisionData.length
	const maxCols = collisionData[0]?.length ?? 0
	const beginX = Math.floor(startX)
	const beginY = Math.floor(startY)
	const width = Math.max(1, Math.ceil(widthTiles))
	const height = Math.max(1, Math.ceil(heightTiles))
	const modified = []
	for (let dy = 0; dy < height; dy++) {
		const tileY = beginY + dy
		if (tileY < 0 || tileY >= maxRows) continue
		for (let dx = 0; dx < width; dx++) {
			const tileX = beginX + dx
			if (tileX < 0 || tileX >= maxCols) continue
			const prevValue = collisionData[tileY][tileX]
			collisionData[tileY][tileX] = 1
			const tile = layer.getTileAt(tileX, tileY)
			const prevCollides = tile ? tile.collides : null
			if (tile) {
				tile.setCollision(true, true, true, true)
			}
			modified.push({ tileX, tileY, prevValue, tile, prevCollides })
		}
	}
	return {
		restore() {
			modified.forEach(({ tileX, tileY, prevValue, tile, prevCollides }) => {
				if (collisionData[tileY]) {
					collisionData[tileY][tileX] = prevValue
				}
				if (tile) {
					if (prevCollides) {
						tile.setCollision(true, true, true, true)
					} else {
						tile.resetCollision()
					}
				}
			})
		},
	}
}
