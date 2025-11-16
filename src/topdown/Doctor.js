import EasyStar from 'easystarjs'


export default class Doctor extends Phaser.Physics.Arcade.Sprite {
    //The distance away from the dest in x or y that player can be from dest and still face up/dn or east/west. 
    //Also used to know when dest is reached
    DIRECTIONMARGIN = 10*this.scene.gameScale
    INITSPEED = 80
    DRAG = .1
    
    easystar = new EasyStar.js();

    waypoints = []
    dest = {}
    tweens = []
    direction={
        y:0,
        x:0
    }
    navigationLight
    intensity
    animStarted = 0
    paused = false
	hitReacting = false
	hitAnimationKey = null
	isDead = false
	casting = false
	castStateTimer = null

    //Plays the correct animation based on the direction.x and direction.y
    playAnim(time){
		if (this.hitReacting) return
        //current animation so we can check that we aren't restarting on that's playing already
        let curr = this.anims.getName() 
        if(this.direction.x==1&&this.direction.y==1){
            if(curr!=='SE-Walk') {
                this.play({key:'SE-Walk', repeat:-1})
            }
        } 
        if(this.direction.x==-1&&this.direction.y==-1){
            if(curr!=='NW-Walk') {
                this.play({key:'NW-Walk', repeat:-1})
            }
        }
        if(this.direction.x==1&&this.direction.y==-1){
            if(curr!=='NE-Walk') {
                this.play({key:'NE-Walk', repeat:-1})
            }
        } 
        if(this.direction.x==-1&&this.direction.y==1){
            if(curr!=='SW-Walk') {
                this.play({key:'SW-Walk', repeat:-1})
            }
        }
        if(this.direction.x==1&&this.direction.y==0){
            if(curr!=='E-Walk') {
                this.play({key:'E-Walk', repeat:-1})
            }
        }
        if(this.direction.x==-1&&this.direction.y==0){
            if(curr!=='W-Walk') {
                this.play({key:'W-Walk', repeat:-1})
            }
        }
        if(this.direction.x==0&&this.direction.y==-1){
            if(curr!=='N-Walk') {
                this.play({key:'N-Walk', repeat:-1})
            }
        }
        if(this.direction.x==0&&this.direction.y==1){
            if(curr!=='S-Walk') {
                this.play({key:'S-Walk', repeat:-1})
            }
        }
        if(!this.casting&&this.direction.x==0&&this.direction.y==0){
            if(curr!=='Idle') {
                this.play({key:'Idle', repeat:-1})
            }
        }
    }

    //Sets direction.x and directio.y based on position relative to params
    setDirection(targetX, targetY){
        if(this.x<targetX-this.DIRECTIONMARGIN) {
            this.direction.x = 1
        }else if(this.x>targetX+this.DIRECTIONMARGIN){
            this.direction.x = -1
        } else{
            this.direction.x=0
        }
        if(this.y<targetY-this.DIRECTIONMARGIN) {
            this.direction.y = 1
        }else if(this.y>targetY+this.DIRECTIONMARGIN){
            this.direction.y = -1
        }else{
            this.direction.y=0
        }   

}

    //Makes a call to easystar, draws the navigation interface and sets that waypoints
    addDestinationPoint(d){
        if(this.paused==true) return
        this.waypoints=[]
        const tilesize = 16*this.scene.gameScale
        var _this = this
		this.easystar.findPath(Math.round(this.x/tilesize)-1, Math.round(this.y/tilesize)-1, Math.round(d.x/tilesize)-1, Math.round(d.y/tilesize)-1, function( path ) {
            if (path === null) {
                const circle = new Phaser.Geom.Circle(d.x, d.y, 12*_this.scene.gameScale);
                const graphics = _this.scene.add.graphics({ lineStyle: { color: 0xff0000, width:3*_this.scene.gameScale, alpha:.3 },  });
                graphics.strokeCircleShape(circle)
                const tween = _this.scene.add.tween({
                        targets: graphics,
                        alpha:0,
                        ease: 'Power1',
                        duration: 1000,
                        onComplete:()=>{
                            graphics.destroy()
                        }
                });
				if(typeof _this.scene.onDestinationUnreachable === 'function'){
					_this.scene.onDestinationUnreachable(d)
				}
            } else {
                _this.dest = d
                if(_this.navigationLight) _this.navigationLight.setVisible(false)
                _this.navigationLight = _this.scene.lights.addLight(d.x, d.y, 200*_this.scene.gameScale, 0x00FF90);
                _this.intensity = .5
                const graphics = _this.scene.add.graphics({ lineStyle: { color: 0x00ff080, width:4*_this.scene.gameScale, alpha:.3 },  });
                const circle = new Phaser.Geom.Circle(d.x, d.y, 12*_this.scene.gameScale);
                const circle2 = new Phaser.Geom.Circle(d.x, d.y, 4*_this.scene.gameScale);
                graphics.strokeCircleShape(circle2)
                graphics.strokeCircleShape(circle)
                _this.tweens.push(_this.scene.add.tween({
                        targets: graphics,
                        alpha:0,
                        ease: 'Power1',
                        duration: 1000,
                        onComplete:()=>{
                            graphics.destroy()
                        }
                }))
                path.forEach(function(w, i){
                    if(i>1&&i<path.length-2&&i%2==0) {
                        let coords = {x:((w.x+1)*(tilesize)), y:(w.y+1)*(tilesize)}
                        _this._addWaypoint(coords)
                        const circle = new Phaser.Geom.Circle(coords.x, coords.y, 2*_this.scene.gameScale);
                        const graphics = _this.scene.add.graphics({ fillStyle: { color: 0x00ff00, width:_this.scene.gameScale, alpha:.3 },  });
                        graphics.fillCircleShape(circle)
                        const tween = _this.scene.add.tween({
                                targets: graphics,
                                alpha:0,
                                ease: 'Power1',
                                duration: 1000,
                                onComplete:()=>{
                                    graphics.destroy()
                                }
                        });
                    }
                })
            }
        });
        this.easystar.calculate()
    }

    //It seemed like this was needed at one point but I guess it didn't end up doing much
    _addWaypoint(w){
        this.waypoints.unshift(w)
    }

    constructor(scene, config = {}) {
		super(scene, config.x, config.y, "doctor");
        this.scene.physics.add.existing(this);
        this.scene = config.scene;
        config.scene.add.existing(this);
        this.speed = this.INITSPEED
        this.setScale(this.scene.gameScale)
		const defaultMaxHp = typeof config.maxHp === 'number' ? config.maxHp : 20
		this.maxHp = Math.max(1, defaultMaxHp)
		const startingHp = typeof config.hp === 'number' ? config.hp : this.maxHp
		this.hp = this.clampHp(startingHp)
	}
	preload() {
    }

	create() {
        this.setPipeline('Light2D');
        this.setDepth(200)
        this.easystar.setGrid(this.scene.topdown.collisionData);
        this.easystar.setAcceptableTiles([0]);
        this.setSize(20, 25)
        this.scene.cameras.main.startFollow(this);

this.scene.input.on('pointerdown', (pointer, currentlyOver = [])=>{
    const blockedByUi = currentlyOver.some((obj) => obj?.getData?.('blocksPointerRouting'))
    if (blockedByUi) {
        return
    }
    if (typeof this.scene.handleTargetSelection === 'function' && this.scene.handleTargetSelection(pointer)) {
        return
    }
			if (typeof this.scene.handleSpellPointer === 'function' && this.scene.handleSpellPointer(pointer)) {
				return
			}
			const worldpoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y)
			this.addDestinationPoint({x: worldpoint.x, y:worldpoint.y})
        });


    }
	update(time) {
        this.scene.topdown.playerLight.setPosition(this.x, this.y)

        if(this.paused==true) return

        //Dim the navigation light     
        if(this.navigationLight) this.navigationLight.setIntensity(this.intensity*=.95) 
        if(this.intensity<.001) this.intensity=0

        //Move player toward next waypoint
        if (this.waypoints.length) {
            if(!this.moving){
                this.moving = true
                var currWaypoint 
                currWaypoint =  this.waypoints[this.waypoints.length-1]
                var targetY = currWaypoint.y
                var targetX = currWaypoint.x
                if(!this.gotDir){
                    this.setDirection(this.dest.x , this.dest.y)
                    this.gotDir = true 
                }
    
                this.tweens.push(this.scene.add.tween({
                    targets: this,
                    x: targetX,
                    y: targetY,
                    ease: 'Linear',
                    duration: this.speed,
                    onComplete:()=>{
                        this.gotDir = false                        
                        this.waypoints.pop()
                        this.moving = false
                        }
                }));
    
            }
        }else{
            if(this.dest.y||this.dest.y){
                const targetX = this.dest.x
                const targetY = this.dest.y
                if(!this.gotDir){
                    this.setDirection(targetX, targetY)
                    this.gotDir = true 
                }
                this.tweens.push(this.scene.add.tween({
                    targets: this,
                    x: targetX,
                    y: targetY,
                    ease: 'Linear',
                    duration: this.speed,
                    onComplete:()=>{
                        this.gotDir = false    
                    }
                }));
    
            }else{ 
                this.body.velocity.x = this.body.velocity.x*this.DRAG
                this.body.velocity.y = this.body.velocity.y*this.DRAG
                this.direction.x=0
                this.direction.y=0
                setTimeout(()=>{
                    //this.play({key:'Idle', repeat:-1})    
                },200)
            }
            
        }
        this.playAnim(time)
    }

	setHp(value = this.hp ?? this.maxHp) {
		const previousHp = typeof this.hp === 'number' ? this.hp : this.maxHp
		this.hp = this.clampHp(value)
		if (typeof previousHp === 'number' && this.hp < previousHp) {
			this.triggerHitReaction()
		}
		if (this.hp <= 0) {
			this.die()
		}
		return this.hp
	}

	setMaxHp(value = this.maxHp ?? 20, { refill = false } = {}) {
		const numeric = typeof value === 'number' ? value : this.maxHp ?? 20
		this.maxHp = Math.max(1, numeric)
		if (refill) {
			this.hp = this.maxHp
		} else if (this.hp > this.maxHp) {
			this.hp = this.maxHp
		}
		return this.maxHp
	}

	getHpRatio() {
		if (!this.maxHp) return 0
		return Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1)
	}

	clampHp(value = this.hp ?? this.maxHp ?? 20) {
		const numeric = typeof value === 'number' ? value : this.hp ?? this.maxHp ?? 20
		return Phaser.Math.Clamp(numeric, 0, this.maxHp || 1)
	}

	resolveHitAnimationKey() {
		if (this.hitAnimationKey && this.scene?.anims?.exists(this.hitAnimationKey)) {
			return this.hitAnimationKey
		}
		if (!this.scene?.anims) return null
		const preferredKeys = ['Hit', 'Die']
		for (let i = 0; i < preferredKeys.length; i++) {
			const key = preferredKeys[i]
			if (this.scene.anims.exists(key)) {
				this.hitAnimationKey = key
				return key
			}
		}
		return null
	}

	triggerHitReaction() {
		if (this.hitReacting || this.isDead) return
		const hitKey = this.resolveHitAnimationKey()
		if (!hitKey) return
		this.hitReacting = true
		this.play({ key: hitKey, repeat: 0 })
		const handleComplete = (animation) => {
			if (animation?.key !== hitKey) return
			this.off(Phaser.Animations.Events.ANIMATION_COMPLETE, handleComplete)
			this.hitReacting = false
		}
		this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, handleComplete)
		if (this.scene?.time) {
			this.scene.time.delayedCall(350, () => {
				if (!this.hitReacting) return
				this.hitReacting = false
			})
		}
	}

	setCastingState(active = false) {
		this.casting = !!active
		if (!this.casting && this.castStateTimer) {
			this.castStateTimer.remove?.()
			this.castStateTimer = null
		}
	}

	triggerCastState(duration = 100) {
		this.setCastingState(true)
		if (this.castStateTimer) {
			this.castStateTimer.remove?.()
			this.castStateTimer = null
		}
		const finalize = () => {
			this.castStateTimer = null
			this.setCastingState(false)
		}
		if (this.scene?.time) {
			this.castStateTimer = this.scene.time.delayedCall(duration, finalize)
		} else {
			const timeoutId = setTimeout(finalize, duration)
			this.castStateTimer = { remove: () => clearTimeout(timeoutId) }
		}
	}

	die() {
		if (this.isDead) return
		this.isDead = true
		this.paused = true
		this.hitReacting = false
		this.direction.x = 0
		this.direction.y = 0
		this.waypoints = []
		this.dest = {}
		if (this.moveTween) {
			this.moveTween.stop()
			this.moveTween = null
		}
		if (Array.isArray(this.tweens) && this.tweens.length) {
			this.tweens.forEach((tween) => tween?.stop?.())
			this.tweens.length = 0
		}
		if (this.body) {
			this.body.setVelocity(0, 0)
		}
		const dieAnim = this.scene?.anims?.exists('Rotate')
			? { key: 'Rotate', repeat: -1 }
			: { key: this.scene?.anims?.exists('Die') ? 'Die' : 'Idle', repeat: 0 }
		this.play(dieAnim)
		if (this.scene?.events) {
			this.scene.events.emit('doctor:died', this)
		}
		this.emit?.('died', this)
	}
}
