import BaseScene from './BaseScene.js'
import Dialog from './ui/Dialog.js'
import createWaterFlowEffect from './effects/createWaterFlowEffect.js';


const DRAINS_CLEARED_KEY = 'drainsCleared';
const objectScripts = {
	'breaker': (scene) => {
		console.log('breaker object script triggered');
		scene.scene.start('basic-console', { memory: 8 });
	}
}
const eventScripts = [
	{
		trigger: (scene) => {
			return !scene.triggers.createdWater && !scene.gamestate[DRAINS_CLEARED_KEY];
		},
		action: (scene) => {
			scene.triggers.createdWater = true;
			createWaterFlowEffect(scene, {
				x: 28,
				y: 57,
				height: 2,
				width: 4
			});
			scene.time.delayedCall(200, () => {
				const dialog = new Dialog(scene, scene.panelDialog = new Dialog(scene, {
					type: 'balloon', messages: [{
						target: scene.doctor,
						text: 'Oh dear!',
						rightside: false
					}, {
						target: scene.doctor,
						text: 'This room isn\'t draining properly! The drains must be clogged with slime..',
						rightside: true,
						callback: () => {
							scene.doctor.paused = false
						}
					}]
				}))
			});
		}
	}
];

export default class BreakerScene extends BaseScene {
	constructor() {
		super('breaker-room', {
			levelData: 'topdown/tiles/breaker.json',
			levelScripts: eventScripts,
			tileSpawners: [],
			enemyCards: [],
			objectScripts: objectScripts,
		})
	}

	init(data = {}) {
		super.init?.(data)
	}


}
