import Phaser from 'phaser'

import TitleWorldScene from './TitleScene'
import BasicConsoleScene from './BasicConsoleScene'
import ArkanoidScene from './ArkanoidScene'
import CastleScene from './CastleScene'

const config = {
	type: Phaser.AUTO,
	parent: 'app',
	width: 1366,
	height: 635,
	scale: {
		mode: Phaser.Scale.FIT, // Scale the canvas to fit the available space while maintaining aspect ratio
		autoCenter: Phaser.Scale.CENTER_BOTH, // Center the game canvas horizontally and vertically
		parent: 'game-container' // Optional: ID of the parent HTML element for the canvas
	},
	backgroundColor: '#000000',
	physics: {
		default: 'arcade',
		arcade: {
			gravity: { y: 0 },
			//debug: true,
		},
	},
	antialias: false,
	scene: [BasicConsoleScene],
}

export default new Phaser.Game(config)
