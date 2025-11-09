import Phaser from 'phaser'

import TitleWorldScene from './TitleScene'
import BasicConsoleScene from './BasicConsoleScene'
import ArkanoidScene from './ArkanoidScene'
import CastleScene from './CastleScene'

const config = {
	type: Phaser.AUTO,
	parent: 'app',
	width: window.innerWidth,
	height:window.innerHeight-4,
	backgroundColor: '#000000',
	physics: {
		default: 'arcade',
		arcade: {
			gravity: {y:0},
			//debug: true,
		},
	},
	antialias: false,
	scene: [BasicConsoleScene],
}

export default new Phaser.Game(config)
