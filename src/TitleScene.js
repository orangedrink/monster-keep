import BaseScene from './BaseScene.js'
import Dialog from './ui/Dialog.js'
import Slime from './topdown/sprites/Slime.js'
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
					text: 'you have entered the monster keep!',
					rightside: true,
				}, {
					target: scene.doctor,
					text: 'I used to have a mansion but it was too much walking. got so bored.',
					rightside: true,
				}, {
					target: scene.doctor,
					text: 'Anyway, explore by clicking on or touching a destination',
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
						text: 'now that you can get around take a look at your spells',
						rightside: true,
					}, {
						target: scene.doctor,
						text: 'click or touch the fireball icon to kill the slimes',
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

const titleTileSpawners = []
const titleEnemyCardDeck = [
	{ key: 'slime', label: 'Scouting Slimes', count: 5, textureKey: 'slime' },
	{ key: 'slime', label: 'Toxic Slimes', count: 10, textureKey: 'slime', tint: 0x82ffc7 },
	{ key: 'slime', label: 'Grand Slimes', count: 15, textureKey: 'slime', tint: 0xffe29a },
]

export default class TitleScene extends BaseScene {
	constructor() {
		super('title', {
			levelData: 'topdown/tiles/titleScreen.json',
			levelScripts: levelScripts,
			tileSpawners: titleTileSpawners,
			enemyCards: titleEnemyCardDeck,
		})
	}
}
