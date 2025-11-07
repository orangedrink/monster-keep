import Phaser from 'phaser'
import Topdown from './topdown/Topdown.js'
import Doctor from './topdown/Doctor.js'
import Slime from './topdown/sprites/Slime.js'
import Dialog from './ui/Dialog.js'
import Menu from './ui/Menu.js'

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
		this.processScripts();
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

	}
}
