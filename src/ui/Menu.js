import Dialog from './Dialog.js'


export default class Menu extends Phaser.Physics.Arcade.Sprite {
    menutext
    constructor(scene, config) {
		super(scene, config.x, config.y, "menu");
        this.scene = scene;
		this.scene.physics.add.existing(this);
        this.scene.add.existing(this);
			this.healthBarWidth = 72 * this.scene.gameScale
		this.healthBarHeight = 3
		this.lastPauseState = !!this.scene?.doctor?.paused
	}
    create(){
        var textConfig={fontSize:'18px',color:'#ffffff',fontFamily: 'Silkscreen', wordWrap: { width: window.innerWidth/3, useAdvancedWrap: true }};
		// var txt = this.scene.add.text(this.dialogdata.messages[0].target.x+70, this.dialogdata.messages[0].target.y-40, this.dialogdata.messages[0].text ,textConfig);
		this.menutext =  this.scene.add.text(this.scene.doctor.x+316, this.scene.doctor.y-263, 'menu', textConfig );
		this.menutext.setDepth(103)
        this.setDepth(102)
		this.menutext.alpha=0
		this.alpha=0
		this.setOrigin(1,0)
		this.setInteractive()
		this.setData('blocksPointerRouting', true)
		this.createHealthBar()
		this.on('pointerdown',(pointer)=>{
			this.scene.doctor.paused=true
            this.menutext.y=-100
			this.scene.panelDialog=new Dialog(this.scene, {type:'panel', messages:[{ 
					target:this.scene.doctor, 
					text:'ready\nchoose a command to execute below', 
					options:[{
						text:'10: goto anotherpanel[]',
						callback: ()=>{
							this.scene.panelDialog=new Dialog(this.scene, {
								type:'panel', 
								messages:[{
									text:'panel opened', 
									options:[{
										text:'>ok', 
										callback:()=>{
											this.scene.doctor.paused=false
											this.alpha=0
											this.scene.add.tween({
												targets: [this],
												ease: 'Linear',
												alpha:1,
												duration: 200,
												onComplete: ()=>{
													this.scene.doctor.paused=false
												}
											});
													},
										closepanel:true
									}]
								}]
							})
						},
						//closepanel:true,
					}, {
						text:'20: goto spinnydance[]',
						callback: ()=>{
							this.scene.doctor.play({key:'Rotate', repeat:-1})
							this.scene.doctor.paused=true
							this.alpha=0
							this.scene.add.tween({
								targets: [this],
								ease: 'Linear',
								alpha:1,
								duration: 2000,
								onComplete: ()=>{
									this.scene.doctor.paused=false
								}
							});
					},
						closepanel:true,
					}, {
						text:'30: goto wordballoon[]',
						callback: ()=>{
							this.scene.panelDialog=new Dialog(this.scene, {type:'balloon', messages:[{target:this.scene.doctor, text:'click on a destination to move', rightside:true}, {target:this.scene.doctor, text:'Go on! try it!', rightside:false, callback:()=>{
								this.scene.doctor.paused=false
								this.alpha=0
								this.scene.add.tween({
									targets: [this],
									ease: 'Linear',
									alpha:1,
									duration: 200,
									onComplete: ()=>{
										this.scene.doctor.paused=false
									}
								});
								//this.doctor.y-window.innerHeight/2+10	
							}}]})
						},
						closepanel:true,
						options:[]
					}
				]
				}
			]})
		})
    }
    update(time){
        const doctor = this.scene.doctor
        if(!doctor.paused){
			this.setPosition(doctor.x+window.innerWidth/2-10, doctor.y-window.innerHeight/2+10)
            this.menutext.alpha=this.alpha
		} 
        this.menutext.setPosition(this.x-312, this.y+10)
		this.positionHealthBar()
		this.handlePauseStateChange()
    }

	createHealthBar() {
		const barWidth = this.healthBarWidth
		const barHeight = this.healthBarHeight
		this.healthBarBg = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0x3b0d0d, 0.8)
		this.healthBarBg.setOrigin(0, 0.5)
		this.healthBarBg.setDepth(this.depth + 1)
		this.healthBarFill = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0xff3d3d, 1)
		this.healthBarFill.setOrigin(0, 0.5)
		this.healthBarFill.setDepth(this.depth + 2)
		this.healthBarBorder = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0x000000, 0)
		this.healthBarBorder.setOrigin(0, 0.5)
		this.healthBarBorder.setStrokeStyle(1, 0xffffff, 0.8)
		this.healthBarBorder.setDepth(this.depth + 3)
		this.positionHealthBar()
		this.updateHealthBarDisplay()
	}

	positionHealthBar() {
		if (!this.healthBarBg || !this.healthBarFill || !this.healthBarBorder) return
		const menuHalfWidth = (this.displayWidth ?? this.width ?? this.healthBarWidth) / 2
		const menuHalfHeight = (this.displayHeight ?? this.height ?? this.healthBarHeight) / 2
		const menuCenterX = this.x - menuHalfWidth
		const menuCenterY = this.y + menuHalfHeight
		const barX = menuCenterX - this.healthBarWidth / 2
		const barY = menuCenterY - 10
		this.healthBarBg.setPosition(barX, barY)
		this.healthBarFill.setPosition(barX, barY)
		this.healthBarBorder.setPosition(barX, barY)
		this.syncHealthBarVisibility()
		this.updateHealthBarDisplay()
	}

	updateHealthBarDisplay() {
		if (!this.healthBarFill || !this.scene?.doctor) return
		const doctor = this.scene.doctor
		const ratio = typeof doctor.getHpRatio === 'function'
			? doctor.getHpRatio()
			: Math.min(1, Math.max(0, (doctor.hp ?? 0) / (doctor.maxHp || 1)))
		const width = this.healthBarWidth * ratio
		this.healthBarFill.displayWidth = Math.max(1, width)
		const visible = this.shouldShowHealthBar()
		this.healthBarFill.visible = visible && ratio > 0
		this.healthBarBg.visible = visible
		this.healthBarBorder.visible = visible
	}

	syncHealthBarVisibility() {
		const elements = [this.healthBarBg, this.healthBarFill, this.healthBarBorder]
		const visible = this.shouldShowHealthBar()
		const alpha = visible ? this.alpha : 0
		elements.forEach((element) => {
			if (!element) return
			element.setVisible(visible)
			element.setAlpha(alpha)
		})
	}

	shouldShowHealthBar() {
		const doctorPaused = !!this.scene?.doctor?.paused
		return !!this.visible && this.alpha > 0 && !doctorPaused
	}

	handlePauseStateChange() {
		const paused = !!this.scene?.doctor?.paused
		if (paused === this.lastPauseState) return
		this.lastPauseState = paused
		this.syncHealthBarVisibility()
	}

	setPosition(...args) {
		super.setPosition(...args)
		this.positionHealthBar()
		return this
	}

	setAlpha(...args) {
		super.setAlpha(...args)
		this.syncHealthBarVisibility()
		return this
	}

	setVisible(value) {
		super.setVisible(value)
		this.syncHealthBarVisibility()
		return this
	}
}
