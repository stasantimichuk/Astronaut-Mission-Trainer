import Phaser from 'phaser';
import EasyStar from 'easystarjs';

export default class BuildingInside extends Phaser.Scene {
    constructor() {
        super('BuildingInside');
        this.tileSize = 32;
    }

    create() {
        this.cameras.main.setBackgroundColor('#111111');

        this.finder = new EasyStar.js();
        const grid = [];
        
        const mapWidthTiles = 100;
        const mapHeightTiles = 100;

        const roomX = 42;
        const roomY = 44;
        const roomWidth = 15;
        const roomHeight = 11;
        
        const terminalGridX = roomX + 7;
        const terminalGridY = roomY + 1;
        
        // ВИПРАВЛЕНО: Двері тепер на одну клітинку нижче сірої підлоги
        const exitGridX = roomX + 7;
        const exitGridY = roomY + roomHeight; 

        for (let y = 0; y < mapHeightTiles; y++) {
            let row = [];
            for (let x = 0; x < mapWidthTiles; x++) {
                let isWalkable = 1; 
                
                if (x >= roomX && x < roomX + roomWidth && y >= roomY && y < roomY + roomHeight) {
                    isWalkable = 0;
                }
                
                if (x === terminalGridX && y === terminalGridY) isWalkable = 1;
                
                // Оскільки двері тепер за межами підлоги (де isWalkable = 1), ми примусово робимо їх прохідними
                if (x === exitGridX && y === exitGridY) isWalkable = 0;

                row.push(isWalkable);
            }
            grid.push(row);
        }

        this.finder.setGrid(grid);
        this.finder.setAcceptableTiles([0]);

        const mapWidthPx = mapWidthTiles * this.tileSize;
        const mapHeightPx = mapHeightTiles * this.tileSize;

        this.add.grid(mapWidthPx/2, mapHeightPx/2, mapWidthPx, mapHeightPx, this.tileSize, this.tileSize, 0x111111, 1, 0x222222, 1);
        
        this.add.rectangle(roomX * this.tileSize, roomY * this.tileSize, roomWidth * this.tileSize, roomHeight * this.tileSize, 0x3a4b5c).setOrigin(0, 0); 
        this.add.text((roomX + roomWidth / 2) * this.tileSize, (roomY - 1) * this.tileSize, 'Лабораторний модуль', { fontSize: '24px', fill: '#ffffff' }).setOrigin(0.5);

        this.terminal = this.add.rectangle(terminalGridX * this.tileSize, terminalGridY * this.tileSize, 32, 32, 0x00ffff).setOrigin(0, 0);
        this.terminal.setInteractive();

        this.terminal.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            this.walkTo(pointer.worldX, pointer.worldY, () => {
                console.log("Відкрито панель управління!");
            });
        });

        this.exitDoor = this.add.rectangle(exitGridX * this.tileSize, exitGridY * this.tileSize, 32, 32, 0xff0000).setOrigin(0, 0);
        this.exitDoor.setInteractive();

        this.exitDoor.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            this.walkTo(pointer.worldX, pointer.worldY, () => {
                this.scene.start('MainBase', { returnFromBuilding: true }); 
            });
        });

        // Гравець автоматично стає на краю підлоги (exitGridY - 1)
        const spawnGridX = exitGridX;
        const spawnGridY = exitGridY - 1;

        this.player = this.add.rectangle(spawnGridX * this.tileSize, spawnGridY * this.tileSize, 32, 32, 0x0088ff).setOrigin(0, 0);
        this.physics.add.existing(this.player);

        this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        this.isMoving = false;
        this.currentPath = [];
        this.pendingAction = null; 
        this.speed = 200;

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
                console.warn("Стіна! Туди не можна.");
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