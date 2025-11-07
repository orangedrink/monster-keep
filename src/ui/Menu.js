import Dialog from './Dialog.js'


export default class Menu extends Phaser.Physics.Arcade.Sprite {
    menutext
    constructor(scene, config) {
		super(scene, config.x, config.y, "menu");
        this.scene = scene;
        this.scene.physics.add.existing(this);
        this.scene.add.existing(this);
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
        if(!this.scene.doctor.paused){
			this.setPosition(this.scene.doctor.x+window.innerWidth/2-10, this.scene.doctor.y-window.innerHeight/2+10)
            this.menutext.alpha=this.alpha
		} 
        this.menutext.setPosition(this.x-312, this.y+10)

    }
}
