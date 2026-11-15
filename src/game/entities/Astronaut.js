import Phaser from 'phaser';

export default class Astronaut extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, colorOrTexture, id) {
        // Починаємо з кадру "стоїть прямо"
        const textureKey = `astro_${id}_stand`;
        super(scene, x, y, textureKey);
        
        this.scene = scene;
        this.id = id;

        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Зберігаємо ваші налаштування розмірів (1 на 1.5 тайла)
        this.setDisplaySize(32, 48);
        this.setOrigin(0, 0.33);

        this.body.setSize(this.width, this.height * 0.66);
        this.body.setOffset(0, this.height * 0.34);

        this.isMoving = false;
        this.wasMoving = false; 
        this.currentPath = [];
        this.pendingAction = null;
    }

    updateMovement(speed, timeScale) {
        const actuallyMoving = (this.isMoving && this.currentPath.length > 0 && timeScale > 0);

        if (this.wasMoving !== actuallyMoving) {
            this.wasMoving = actuallyMoving;
            window.dispatchEvent(new CustomEvent('ASTRO_MOVEMENT', { detail: { id: this.id, isMoving: actuallyMoving } }));
        }

        if (timeScale === 0) {
            this.body.stop();
            // Якщо час зупинився - ставимо на паузу і анімацію
            if (this.anims.isPlaying) this.anims.pause();
            return;
        }

        if (this.isMoving && this.currentPath.length > 0) {
            const target = this.currentPath[0];
            const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);

            if (distance < 5) {
                this.currentPath.shift(); 
                if (this.currentPath.length === 0) {
                    this.isMoving = false;
                    this.body.reset(target.x, target.y); 
                    this.body.stop();
                    
                    // ЗУПИНКА: Зупиняємо анімацію і повертаємо кадр "стоїть"
                    this.anims.stop();
                    this.setTexture(`astro_${this.id}_stand`);
                    this.setFlipX(false);
                    
                    if (this.pendingAction) {
                        this.pendingAction();
                        this.pendingAction = null;
                    }
                }
            } else {
                this.scene.physics.moveToObject(this, target, speed * timeScale);
                
                // РУХ: Запускаємо анімацію ходьби, якщо вона ще не грає
                if (!this.anims.isPlaying) {
                    this.play(`walk_${this.id}`);
                }
                // Налаштовуємо швидкість анімації відносно швидкості гри
                this.anims.timeScale = timeScale;
                
                // Вектор напрямку для віддзеркалення
                const vx = this.body.velocity.x;
                
                if (vx < -5) {
                    this.setFlipX(true);  // Йде вліво - віддзеркалюємо
                } else if (vx > 5) {
                    this.setFlipX(false); // Йде вправо - оригінал
                }
            }
        } else {
            this.body.stop();
            // Якщо не рухається - зупиняємо анімацію і ставимо кадр "стоїть"
            if (this.anims.isPlaying) {
                this.anims.stop();
                this.setTexture(`astro_${this.id}_stand`);
                this.setFlipX(false);
            }
        }
    }
}