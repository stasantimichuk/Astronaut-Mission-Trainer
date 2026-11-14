import Phaser from 'phaser';
import EasyStar from 'easystarjs';

export default class MainBase extends Phaser.Scene {
    constructor() {
        super('MainBase');
        this.tileSize = 32;
    }

    init(data) {
        this.returnFromBuilding = data.returnFromBuilding || false;
    }

    create() {
        this.finder = new EasyStar.js();
        const grid = [];
        
        // 1. РОБИМО КАРТУ ВЕЛИКОЮ (100x100 тайлів = 3200x3200 пікселів)
        const mapWidthTiles = 100;
        const mapHeightTiles = 100;
        
        // 2. Координати нашої бази (зміщуємо її в центр карти)
        const baseX = 45;
        const baseY = 45;
        
        // Двері відносно бази
        const doorGridX = baseX + 2;
        const doorGridY = baseY + 5;

        // Генерація прохідних та непрохідних зон
        for (let y = 0; y < mapHeightTiles; y++) {
            let row = [];
            for (let x = 0; x < mapWidthTiles; x++) {
                let isWalkable = 0; 
                
                // Космос (усе, що вище бази)
                if (y < baseY - 2) isWalkable = 1; 
                
                // Будівля (6x6 тайлів)
                if (x >= baseX && x <= baseX + 5 && y >= baseY && y <= baseY + 5) isWalkable = 1; 
                
                // Прохідні двері
                if (x === doorGridX && y === doorGridY) isWalkable = 0;
                
                row.push(isWalkable);
            }
            grid.push(row);
        }

        this.finder.setGrid(grid);
        this.finder.setAcceptableTiles([0]);

        const mapWidthPx = mapWidthTiles * this.tileSize;
        const mapHeightPx = mapHeightTiles * this.tileSize;
        
        // Задаємо колір фону за межами карти (на всяк випадок)
        this.cameras.main.setBackgroundColor('#1a1a1a');

        // Візуалізація сітки (розтягуємо на всю нову площу)
        this.add.grid(mapWidthPx/2, mapHeightPx/2, mapWidthPx, mapHeightPx, this.tileSize, this.tileSize, 0x222222, 1, 0x333333, 1);
        
        // Малюємо Космос (верхня непрохідна зона)
        this.add.rectangle(0, 0, mapWidthPx, (baseY - 2) * this.tileSize, 0x000000).setOrigin(0, 0); 
        
        // Малюємо Будівлю
        this.add.rectangle(baseX * this.tileSize, baseY * this.tileSize, 6 * this.tileSize, 6 * this.tileSize, 0x666666).setOrigin(0, 0); 

        // Малюємо Двері
        this.door = this.add.rectangle(doorGridX * this.tileSize, doorGridY * this.tileSize, 32, 32, 0x00ff00).setOrigin(0, 0);
        this.door.setInteractive();

        // Спавн гравця
        let spawnGridX = baseX - 4; 
        let spawnGridY = baseY + 4;
        
        if (this.returnFromBuilding) {
            spawnGridX = doorGridX;
            spawnGridY = doorGridY + 1;
        }

        this.player = this.add.rectangle(spawnGridX * this.tileSize, spawnGridY * this.tileSize, 32, 32, 0x0088ff).setOrigin(0, 0);
        this.physics.add.existing(this.player);

        // --- НАЛАШТУВАННЯ КАМЕРИ ---
        // Обмежуємо камеру розмірами нової карти 3200x3200
        this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);
        // Камера плавно літатиме за гравцем
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        this.isMoving = false;
        this.currentPath = [];
        this.pendingAction = null; 
        this.speed = 200;

        // Взаємодія з дверима
        this.door.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation(); 
            this.walkTo(pointer.worldX, pointer.worldY, () => {
                this.scene.start('BuildingInside'); 
            });
        });

        // Клік по підлозі
        this.input.on('pointerdown', (pointer) => {
            this.walkTo(pointer.worldX, pointer.worldY, null);
        });
    }

    walkTo(targetPixelX, targetPixelY, onArrivalAction = null) {
        const toGridX = Math.floor(targetPixelX / this.tileSize);
        const toGridY = Math.floor(targetPixelY / this.tileSize);

        const fromGridX = Math.floor(this.player.x / this.tileSize);
        const fromGridY = Math.floor(this.player.y / this.tileSize);

        this.finder.findPath(fromGridX, fromGridY, toGridX, toGridY, (path) => {
            if (path === null) {
                console.warn("Ділянка недоступна!");
            } else {
                this.currentPath = path.map(p => new Phaser.Math.Vector2(p.x * this.tileSize, p.y * this.tileSize));
                
                let finalX = targetPixelX - 16;
                let finalY = targetPixelY - 16;
                
                if (this.currentPath.length > 0) {
                     const lastTile = this.currentPath[this.currentPath.length - 1];
                     finalX = Phaser.Math.Clamp(finalX, lastTile.x, lastTile.x + this.tileSize - 32);
                     finalY = Phaser.Math.Clamp(finalY, lastTile.y, lastTile.y + this.tileSize - 32);
                }

                this.currentPath[this.currentPath.length - 1] = new Phaser.Math.Vector2(finalX, finalY);

                if (this.currentPath.length > 1) {
                    this.currentPath.shift();
                }

                this.pendingAction = onArrivalAction; 
                this.isMoving = true;
            }
        });
        this.finder.calculate();
    }

    update() {
        if (this.isMoving && this.currentPath.length > 0) {
            const target = this.currentPath[0];
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);

            if (distance < 5) {
                this.currentPath.shift(); 

                if (this.currentPath.length === 0) {
                    this.isMoving = false;
                    this.player.body.reset(target.x, target.y); 
                    
                    if (this.pendingAction) {
                        this.pendingAction();
                        this.pendingAction = null;
                    }
                }
            } else {
                this.physics.moveToObject(this.player, target, this.speed);
            }
        }
    }
}