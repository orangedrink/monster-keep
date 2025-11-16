const DIALOG_DEPTH_BASE = 1000
const DIALOG_DEPTH_TEXT = DIALOG_DEPTH_BASE + 1

export default class Dialog {
    inputFlag = true
    tweens = []
    scene
    dialogdata
    typingqueue=[{
    }]
    lastclick=false
	baloon(){
        var textConfig={fontSize:'18px',color:'#000000',fontFamily: 'Silkscreen', wordWrap: { width: window.innerWidth/3, useAdvancedWrap: true }};
       // var txt = this.scene.add.text(this.dialogdata.messages[0].target.x+70, this.dialogdata.messages[0].target.y-40, this.dialogdata.messages[0].text ,textConfig);
        var txt = this.scene.add.text(-100, this.dialogdata.messages[0].target.y-38, this.dialogdata.messages[0].text ,textConfig);
        txt.alpha=0
        txt.scale=.7
        txt.setDepth(DIALOG_DEPTH_TEXT)

        var graphics = this.scene.add.graphics();
        graphics.setDepth(DIALOG_DEPTH_BASE)
        if(this.dialogdata.messages[0].target == this.scene.doctor) this.scene.doctor.play({key:'Laugh', repeat:-1})
        graphics.fillStyle(0xffffff, .6)
        graphics.alpha=0
        this.tweens.push(this.scene.add.tween({
                    targets: [graphics, txt],
                    ease: 'Linear',
                    alpha:1,
                    scale:1,
                    duration: 200,
        }));
        let polygon
        let direction// = this.dialogdata.messages.length%2!=0
        if(this.dialogdata.messages[0].target == this.scene.doctor){
            direction = this.dialogdata.messages[0].rightside
        }else{
            direction = (this.dialogdata.messages[0].target.x>window.innerWidth/2)
        }
        if(direction){
         polygon = new Phaser.Geom.Polygon([
            this.dialogdata.messages[0].target.x+60, this.dialogdata.messages[0].target.y-50-txt.height,
            this.dialogdata.messages[0].target.x+80+txt.width, this.dialogdata.messages[0].target.y-50-txt.height,
            this.dialogdata.messages[0].target.x+80+txt.width, this.dialogdata.messages[0].target.y-20,
            this.dialogdata.messages[0].target.x+20, this.dialogdata.messages[0].target.y-20,
            this.dialogdata.messages[0].target.x+60, this.dialogdata.messages[0].target.y-40,
        ]);
        txt.x = this.dialogdata.messages[0].target.x+70,
        txt.setOrigin(0,1)
        }else{
            polygon = new Phaser.Geom.Polygon([
                this.dialogdata.messages[0].target.x-60, this.dialogdata.messages[0].target.y-50-txt.height,
                this.dialogdata.messages[0].target.x-80-txt.width, this.dialogdata.messages[0].target.y-50-txt.height,
                this.dialogdata.messages[0].target.x-80-txt.width, this.dialogdata.messages[0].target.y-20,
                this.dialogdata.messages[0].target.x-20, this.dialogdata.messages[0].target.y-20,
                this.dialogdata.messages[0].target.x-60, this.dialogdata.messages[0].target.y-40,
            ]);
            txt.x = this.dialogdata.messages[0].target.x-70,
            txt.setOrigin(1,1)    
        }

        const balloon = graphics.fillPoints(polygon.points, true);
        this.scene.doctor.paused = true
        this.cb = this.dialogdata.messages[0].callback
        this.scene.input.on('pointerdown', (pointer)=>{
            this.inputFlag = true
            this.tweens.push(this.scene.add.tween({
                targets: [graphics, txt],
                ease: 'Linear',
                alpha:0,
                duration: 80,
                onComplete:()=>{
                    graphics.destroy()
                    txt.destroy()
                    if(this.dialogdata.messages.length<=0&&this.lastclick){
                        this.lastclick=false
                        if(this.cb) this.cb()
                        this.cb = undefined
                    }else if(!this.lastclick){
                        this.lastclick=true
                    }
                }
            }));
        });
    }
    optiontext=[]
    typeText(messageData){
        var textConfig={fontSize:'16px',color:'#ffffff',fontFamily: 'Silkscreen ', wordWrap: { width: 420, useAdvancedWrap: false }};
        //var txt = this.scene.add.text(this.scene.doctor.x-260, this.scene.doctor.y-160, '', textConfig);
        var txt = this.scene.add.text(messageData.x, messageData.y, '', textConfig);
        txt.setDepth(DIALOG_DEPTH_TEXT)
        txt.setInteractive()  
        txt.alpha=.8 
        txt.setSize(txt.width, 30)
        let i = 0
        const thisText = messageData.text||' '
        setTimeout(()=>{
            let timer = this.scene.time.addEvent({
                callback: () => {
                    if(this.typeFlag){
                        txt.text +=thisText[i]
                        ++i
                        if(i===thisText.length){
                            timer.destroy()
                            if(this.typingqueue.length){
                                let message = this.typingqueue.shift()
                                let txt = this.typeText({text:message.text, x:message.x, y:(message.y+this.prompt.height), callback: message.callback, closepanel: message.closepanel})
                                this.optiontext.push(txt)
        
                                //this.typingqueue.shift()    
                            }
                        }    
                    }
                },
                repeat: length - 1,
                delay: 5
            })   
    
        },100)
        if(messageData.callback){
            txt.on('pointerout', ()=>{
                this.optiontext.forEach((optiontext)=>{
                    this.tweens.push(this.scene.add.tween({
                        targets: [optiontext],
                        ease: 'Linear',
                        alpha:.8,
                        duration: 60,
                    }));
                })
            })
            txt.on('pointerover', ()=>{
                txt.alpha=1
                this.optiontext.forEach((optiontext)=>{
                    if(optiontext!=txt){
                        this.tweens.push(this.scene.add.tween({
                            targets: [optiontext],
                            ease: 'Linear',
                            alpha:.6,
                            duration: 80,
                        }));    
                    }
                })
            })
            txt.on('pointerdown', (pointer)=>{
                this.inputFlag = true 
                this.optiontext.forEach((optiontext)=>{
                    this.tweens.push(this.scene.add.tween({
                        targets: [optiontext],
                        ease: 'Linear',
                        alpha:0,
                        duration: 80,
                        onComplete:()=>{
                            optiontext.destroy()
                        }
                    }));    
                })   
                if(this.dialogdata.messages.length<=0&&messageData.closepanel){
                    this.tweens.push(this.scene.add.tween({
                        targets: [this.scene.panel],
                        ease: 'Linear',
                        alpha:0,
                        y:this.scene.doctor.y+1300,
                        scale:.6,
                        duration: 400,
                        onComplete:()=>{
                            this.scene.panel.destroy()
                            this.scene.panel=undefined
                            }
                    }));
                } 
                this.tweens.push(this.scene.add.tween({
                    targets: [this.prompt],
                    ease: 'Linear',
                    alpha:0,
                    duration: 80,
                    onComplete:()=>{
                        this.prompt.destroy()
                        if(messageData.callback) messageData.callback()
                    }
                }));
            });    
        }
        return txt 
    }
    panel(){
        this.dialogdata.c1=0x000053
        this.dialogdata.c2=0x000053
        this.dialogdata.c3=0x000022
        this.dialogdata.c4=0x000022
        if(!this.scene.panel){
            this.scene.doctor.paused=true

            this.scene.panel = this.scene.add.sprite(this.scene.doctor.x, this.scene.doctor.y+700, 'screen');
            this.scene.panel.setDepth(DIALOG_DEPTH_BASE)
            this.scene.panel.alpha = 0   
            this.scene.panel.setScale(.2)
            this.tweens.push(this.scene.add.tween({
                targets: [this.scene.panel],
                ease: 'Linear',
                alpha:.7,
                y: this.scene.doctor.y,
                scale:1,
                duration: 400,
                onComplete:()=>{
                    this.typeFlag = true
                }
            }));
            this.tweens.push(this.scene.add.tween({
                targets: [this.scene.menu],
                ease: 'Linear',
                y: this.scene.doctor.y-window.innerHeight,
                duration: 400,
            }));

        }else{
            this.typeFlag = true
        }
        var thisMessage = this.dialogdata.messages[0]
        this.scene.doctor.paused = true
        this.prompt = this.typeText({x:this.scene.doctor.x-290, y:this.scene.doctor.y-160, text:thisMessage.text});
        thisMessage.options.forEach((option, i)=>{
            this.typingqueue.push({x:this.scene.doctor.x-280, y:this.scene.doctor.y-160+(26*(i+1)), text:option.text, callback: option.callback, closepanel:option.closepanel});
        })
    }

    constructor(scene, dialogdata) {
		this.scene = scene
		scene.add.existing(this);
        this.dialogdata = dialogdata    
    }
    
    
    create(){
        document.fonts.ready.then(() => {
        
        })
    }
    update(){
        if(this.inputFlag){
            if(this.dialogdata.messages.length){
                this.inputFlag = false      
                if(this.dialogdata.type==="balloon"||this.dialogdata.type==="baloon"){
                    this.baloon() 
                }else if(this.dialogdata.type==="panel"){
                    this.panel()
                }	
                let msg = this.dialogdata.messages.shift()

            }else{
                this.inputFlag = false 
            }
        }
    }
}
