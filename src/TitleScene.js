import BaseScene from './BaseScene.js'
import Dialog from './ui/Dialog.js'
import Slime from './topdown/sprites/Slime.js'
import { FIREBALL_PROJECTILE_KEY } from './spells/FireballSprite.js'
var levelScripts = [
	{
		trigger: (scene) => {
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

const slimeTween = {
		alpha: { from: 0, to: 1 },
		scale: { from: 0.05, to: 2 },
		duration: 180,
		ease: 'Quad.easeOut',
	};

const titleTileSpawners = [{
	key: 'slime-grate-1',
	tileX: 7,
	tileY: 7,
	enemyClass: Slime,
	interval: 2500,
	jitterX: 8,
	jitterY: 7,
	spawnConfig: {
		wanderRadius: 90,
		chaseSpeed: 26,
	},
	spawnTween: slimeTween,
}, {
	key: 'slime-grate-2',
	tileX: 32,
	tileY: 7,
	enemyClass: Slime,
	interval: 2500,
	jitterX: 8,
	jitterY: 8,
	spawnConfig: {
		wanderRadius: 90,
		chaseSpeed: 26,
	},
	spawnTween: slimeTween,
},{
	key: 'slime-grate-3',
	tileX: 57,
	tileY: 7,
	enemyClass: Slime,
	interval: 2500,
	jitterX: 8,
	jitterY: 8,
	spawnConfig: {
		wanderRadius: 90,
		chaseSpeed: 26,
	},
	spawnTween: slimeTween,
}]

export default class TitleScene extends BaseScene {
	constructor() {
		super('title', {
			levelData: 'topdown/tiles/titleScreen.json',
			levelScripts: levelScripts,
			spells: ['fireball'],
			tileSpawners: titleTileSpawners,
		})
	}

	create() {
		super.create()
	}

	preload() {
		super.preload()
		this.load.spritesheet(FIREBALL_PROJECTILE_KEY, 'condo/spells/fireball.png', {
			frameWidth: 44,
			frameHeight: 13,
		})
	}

}
