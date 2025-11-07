export default class Topdown {
	constructor(scene, mapdata) {
		this.mapdata = mapdata
		this.scene = scene
		scene.add.existing(this);
	}

	create() {
		//Create map ilesets and layers
		this.map = this.scene.make.tilemap({key: 'tilemap', tileWidth:16, tileHeight:16})
		this.map.setCollisionBetween(0, 10000);

		this.wallsSet = this.map.addTilesetImage('tileset', 'tileset', 16, 16)
		
		this.groundLayer = this.map.createLayer('background layer', this.wallsSet, 0, 0)
		this.groundLayer.setPipeline('Light2D')
		this.groundLayer.setScale(this.scene.gameScale)

		this.collisionLayer = this.map.createLayer('collision layer', this.wallsSet, 0, 0)
		this.collisionLayer.setScale(this.scene.gameScale)
		this.collisionLayer.setVisible(false)

		this.wallsLayer = this.map.createLayer('foreground layer', this.wallsSet, 0, 0)
		this.wallsLayer.setPipeline('Light2D')
		this.wallsLayer.setScale(this.scene.gameScale)
		this.wallsLayer.setDepth(100)

		//Use the collision layer to build the collision data that we'll pass to easystar
		this.collisionData = this.map.getLayer('collision layer')
		this.collisionData = this.collisionData.data.map((row)=>{
			return row.map((tile)=>{
				return tile.collides?1:0
			})	
		})

		//Add a light that follows the player
		this.playerLight  = this.scene.lights.addLight(500, 150, 100*this.scene.gameScale, 0x999999, 1);
	}
	update(time) {
	}
}
