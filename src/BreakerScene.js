import BaseScene from './BaseScene.js'
import Dialog from './ui/Dialog.js'
import createWaterFlowEffect from './effects/createWaterFlowEffect.js';


const DRAINS_CLEARED_KEY = 'drainsCleared';
const objectScripts = {
	'breaker': (scene)=>{
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
