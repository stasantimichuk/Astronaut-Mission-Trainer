import Phaser from 'phaser';

export default class Astronaut extends Phaser.GameObjects.Rectangle {
    constructor(scene, x, y, color, id) {
        super(scene, x, y, 32, 32, color);
        
        this.scene = scene;
        this.id = id;

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setOrigin(0, 0);

        this.isMoving = false;
        this.wasMoving = false; // НОВЕ: Трекер попереднього стану
        this.currentPath = [];
        this.pendingAction = null;
    }

    updateMovement(speed, timeScale) {
        // Перевіряємо чи РЕАЛЬНО рухається астронавт зараз (якщо є шлях і не пауза)
        const actuallyMoving = (this.isMoving && this.currentPath.length > 0 && timeScale > 0);

        // Якщо стан змінився (почав йти або зупинився) — повідомляємо React
        if (this.wasMoving !== actuallyMoving) {
            this.wasMoving = actuallyMoving;
            window.dispatchEvent(new CustomEvent('ASTRO_MOVEMENT', { detail: { id: this.id, isMoving: actuallyMoving } }));
        }

        if (timeScale === 0) {
            this.body.stop();
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
                    if (this.pendingAction) {
                        this.pendingAction();
                        this.pendingAction = null;
                    }
                }
            } else {
                this.scene.physics.moveToObject(this, target, speed * timeScale);
            }
        } else {
            this.body.stop();
        }
    }
}