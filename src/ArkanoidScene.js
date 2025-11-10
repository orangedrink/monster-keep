import Phaser from 'phaser'
import CrtOverlayShader from './shaders/CrtOverlayShader'

const COLOR_PRIMARY = 0x00ff9c
const COLOR_ACCENT = 0xf05a28
const COLOR_WARNING = 0xffff66
const SCREEN_INSETS = { left: 160, right: 240, top: 170, bottom: 220 }
const PADDLE_COLOR = COLOR_PRIMARY
const BALL_COLOR = COLOR_WARNING
const BRICK_COLORS = [0xf05a28, 0xffae00, 0x00b5ff, 0x8b5cf6]
const ASCII_FONT = {
	fontFamily: 'Silkscreen',
	fontSize: 18,
	color: '#00ff9c',
	letterSpacing: 1,
}

export default class ArkanoidScene extends Phaser.Scene {
	constructor() {
		super('arkanoid')
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
		this.createScreen()
		this.createPlayfield()
		this.createAsciiBackdrop()
		this.createAsciiFrame()
		this.createHud()
		this.createPaddle()
		this.createBall()
		this.createBricks()
		this.registerColliders()
		this.registerInput()
		this.resetBall()
		this.createCrtOverlay()
	}

	createScreen() {
		const { width, height } = this.scale
		this.screen = this.add.image(width / 2, height / 2, 'screen')
		const maxWidth = width * 1.4
		const maxHeight = height * 1.4
		const scale = Math.min(maxWidth / this.screen.width, maxHeight / this.screen.height)
		this.screen.setScale(scale)
		this.screenBounds = this.screen.getBounds()
	}

	createPlayfield() {
		const inset = SCREEN_INSETS
		const availableWidth = this.screenBounds.width - inset.left - inset.right
		const availableHeight = this.screenBounds.height - inset.top - inset.bottom
		const scaleFactor = 0.5
		const width = availableWidth * scaleFactor
		const height = availableHeight * scaleFactor
		const x = this.screenBounds.left + inset.left + availableWidth * 0.15
		const y = this.screenBounds.top + inset.top + availableHeight * 0.15 + 20
		this.playfield = new Phaser.Geom.Rectangle(x, y, width, height)

		this.physics.world.setBounds(x, y, width, height, true, true, true, false)

		this.add.rectangle(
			this.playfield.centerX,
			this.playfield.centerY,
			this.playfield.width,
			this.playfield.height,
			0x000000,
			0.5
		).setStrokeStyle(2, 0x00ff9c, 0.5)
	}

	createAsciiBackdrop() {
		const charCols = Math.max(Math.floor(this.playfield.width / 24), 12)
		const charRows = Math.max(Math.floor(this.playfield.height / 24), 8)
		const rows = []
		for (let r = 0; r < charRows; r++) {
			let line = ''
			for (let c = 0; c < charCols; c++) {
				line += (c + r) % 2 === 0 ? '░' : '▒'
			}
			rows.push(line)
		}
		this.backdropText = this.add.text(
			this.playfield.left + 8,
			this.playfield.top + 8,
			rows.join('\n'),
			{
				fontFamily: 'Silkscreen',
				fontSize: 14,
				color: '#003b28',
				lineSpacing: -6,
			}
		).setAlpha(0.35)
	}

	createAsciiFrame() {
		const horizontalRepeat = Math.max(Math.floor(this.playfield.width / 14), 10)
		const topLine = '╔' + '═'.repeat(horizontalRepeat) + '╗'
		const bottomLine = '╚' + '═'.repeat(horizontalRepeat) + '╝'
		this.frameTop = this.add.text(
			this.playfield.centerX,
			this.playfield.top - 12,
			topLine,
			{ ...ASCII_FONT, fontSize: 20, color: '#00ff9c' }
		).setOrigin(0.5, 1)
		this.frameBottom = this.add.text(
			this.playfield.centerX,
			this.playfield.bottom + 12,
			bottomLine,
			{ ...ASCII_FONT, fontSize: 20, color: '#00ff9c' }
		).setOrigin(0.5, 0)
		const verticalLine = '║\n'.repeat(Math.max(Math.floor(this.playfield.height / 20), 10))
		this.frameLeft = this.add.text(
			this.playfield.left - 10,
			this.playfield.top,
			verticalLine,
			{ ...ASCII_FONT, color: '#00ff9c', fontSize: 20, lineSpacing: 3 }
		).setOrigin(1, 0)
		this.frameRight = this.add.text(
			this.playfield.right + 10,
			this.playfield.top,
			verticalLine,
			{ ...ASCII_FONT, color: '#00ff9c', fontSize: 20, lineSpacing: 3 }
		).setOrigin(0, 0)
	}

	createHud() {
		const fontConfig = { ...ASCII_FONT }
		this.score = 0
		this.lives = 3
		const hudOffset = 30
		this.scoreText = this.add.text(this.playfield.left, this.playfield.top - 32 + hudOffset, 'Score: 0', fontConfig)
		this.livesText = this.add.text(this.playfield.right, this.playfield.top - 32 + hudOffset, 'Lives: 3', { ...fontConfig, color: '#f05a28' }).setOrigin(1, 0)
		this.statusText = this.add.text(this.playfield.centerX, this.playfield.bottom + 32, 'Click to launch', { ...fontConfig, color: '#ffff66' }).setOrigin(0.5, 0)
	}

	createPaddle() {
		const width = this.playfield.width * 0.12
		const height = 12
		const paddleRect = this.add.rectangle(this.playfield.centerX, this.playfield.bottom - height * 2, width, height)
		paddleRect.setFillStyle(0x000000, 0.1)
		paddleRect.setStrokeStyle(2, COLOR_PRIMARY, 0.9)
		this.physics.add.existing(paddleRect)
		paddleRect.body.setSize(width, height, true)
		paddleRect.body.setOffset(0, 0)
		paddleRect.body.setCollideWorldBounds(true)
		paddleRect.body.setImmovable(true)
		paddleRect.body.setAllowGravity(false)
		this.paddle = paddleRect
	}

	createBall() {
		const radius = 8
		const ballCircle = this.add.circle(0, 0, radius, BALL_COLOR)
		ballCircle.setFillStyle(0xffffff, 0)
		this.physics.add.existing(ballCircle)
		const body = ballCircle.body
		body.setCircle(radius)
		body.setCollideWorldBounds(true)
		body.setBounce(1, 1)
		body.setAllowGravity(false)
		this.ball = ballCircle
		this.ballRadius = radius
		this.isBallLaunched = false
		this.ballLabel = this.add.text(this.ball.x, this.ball.y, '◆', {
			...ASCII_FONT,
			color: '#ffff66',
		}).setOrigin(0.5, 0.5)
	}

	createBricks() {
		this.bricks = []
		this.bricksGroup = this.physics.add.staticGroup()
		const rows = 4
		const cols = 8
		const brickWidth = (this.playfield.width - 40) / cols
		const brickHeight = 20
		const offsetY = this.playfield.top + 40
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const x = this.playfield.left + 20 + brickWidth / 2 + col * brickWidth
				const y = offsetY + row * (brickHeight + 10)
				const color = BRICK_COLORS[row % BRICK_COLORS.length]
				const brickRect = this.add.rectangle(x, y, brickWidth - 8, brickHeight, color)
				this.physics.add.existing(brickRect, true)
				this.bricksGroup.add(brickRect)
				brickRect.active = true
				const asciiColor = this.colorToHex(color)
				const ascii = this.add.text(x, y - 4, '[##]', {
					...ASCII_FONT,
					fontSize: 16,
					color: asciiColor,
				}).setOrigin(0.5, 0.5)
				brickRect.ascii = ascii
				this.bricks.push(brickRect)
			}
		}
	}

	registerColliders() {
		this.physics.add.collider(this.ball, this.paddle)
		this.physics.add.collider(this.ball, this.bricksGroup, this.handleBrickHit, null, this)
	}

	handleBrickHit(ball, brick) {
		if (!brick.active) return
		brick.active = false
		brick.visible = false
		brick.body.enable = false
		if (brick.ascii) {
			brick.ascii.visible = false
		}
		this.incrementScore(10)
		if (this.bricks.every((b) => !b.active)) {
			this.resetBricks()
		}
	}

	registerInput() {
		this.input.on('pointermove', (pointer) => {
			this.movePaddle(pointer.x)
		})
		this.input.on('pointerdown', () => {
			if (!this.isBallLaunched) {
				this.launchBall()
			}
		})
	}

	movePaddle(pointerX) {
		const half = this.paddle.width / 2
		const clamped = Phaser.Math.Clamp(pointerX, this.playfield.left + half, this.playfield.right - half)
		this.paddle.x = clamped
		this.paddle.body.reset(clamped, this.paddle.y)
		if (!this.isBallLaunched) {
			this.ball.x = clamped
			this.ball.y = this.paddle.y - this.paddle.height
			this.ball.body.setVelocity(0, 0)
			if (this.ballLabel) {
				this.ballLabel.setPosition(this.ball.x, this.ball.y)
			}
		}
	}

	launchBall() {
		this.isBallLaunched = true
		this.statusText.setText('')
		const speed = 180
		const angle = Phaser.Math.Between(-30, -150)
		const velocity = this.physics.velocityFromAngle(angle, speed)
		this.ball.body.setVelocity(velocity.x, velocity.y)
	}

	resetBall() {
		this.isBallLaunched = false
		this.ball.body.setVelocity(0, 0)
		this.ball.setPosition(this.paddle.x, this.paddle.y - this.paddle.height)
		if (this.ballLabel) {
			this.ballLabel.setPosition(this.ball.x, this.ball.y)
		}
		this.statusText.setText('Click to launch')
	}

	incrementScore(amount) {
		this.score += amount
		this.scoreText.setText(`Score: ${this.score}`)
	}

	loseLife() {
		this.lives -= 1
		this.livesText.setText(`Lives: ${this.lives}`)
		if (this.lives <= 0) {
			this.score = 0
			this.lives = 3
			this.scoreText.setText('Score: 0')
			this.livesText.setText('Lives: 3')
			this.resetBricks(true)
		}
		this.resetBall()
	}

	resetBricks(resetScore = false) {
		this.bricks.forEach((brick) => {
			brick.active = true
			brick.visible = true
			brick.body.enable = true
			if (brick.body instanceof Phaser.Physics.Arcade.StaticBody) {
				brick.body.updateFromGameObject()
			}
			if (brick.ascii) {
				brick.ascii.visible = true
			}
		})
		if (resetScore) {
			this.score = 0
			this.scoreText.setText('Score: 0')
		}
	}

	update() {
		this.syncAsciiSprites()
		if (!this.isBallLaunched) return
		if (this.ball.y - this.ballRadius > this.playfield.bottom) {
			this.loseLife()
		}
	}

	syncAsciiSprites() {
		if (this.ballLabel) {
			this.ballLabel.setPosition(this.ball.x, this.ball.y)
		}
	}

	colorToHex(value) {
		const { r, g, b } = Phaser.Display.Color.IntegerToRGB(value)
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
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
