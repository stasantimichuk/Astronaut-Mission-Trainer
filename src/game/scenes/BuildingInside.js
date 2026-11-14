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
                if (x === exitGridX && y === exitGridY) isWalkable = 0;

                row.push(isWalkable);
            }
            grid.push(row);
        }

        // ЗБЕРІГАЄМО СІТКУ В КЛАСІ ДЛЯ ПОШУКУ НАЙБЛИЖЧОЇ ТОЧКИ
        this.grid = grid;
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
            const interactPixelX = terminalGridX * this.tileSize;
            const interactPixelY = (terminalGridY + 1) * this.tileSize; 

            this.walkTo(interactPixelX, interactPixelY, () => {
                window.dispatchEvent(new CustomEvent('OPEN_TERMINAL'));
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

    // НОВИЙ МЕТОД: Шукає найближчу вільну клітинку по спіралі (радіусу)
    findClosestWalkable(targetX, targetY) {
        const maxRadius = 20; 
        let closestTile = null;
        let minDistance = Infinity;

        for (let r = 1; r <= maxRadius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) === r || Math.abs(dy) === r) {
                        let checkX = targetX + dx;
                        let checkY = targetY + dy;
                        
                        // Перевіряємо, чи не вийшли за межі карти
                        if (checkY >= 0 && checkY < this.grid.length && checkX >= 0 && checkX < this.grid[0].length) {
                            if (this.grid[checkY][checkX] === 0) { 
                                let dist = Phaser.Math.Distance.Between(targetX, targetY, checkX, checkY);
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    closestTile = { x: checkX, y: checkY };
                                }
                            }
                        }
                    }
                }
            }
            if (closestTile) return closestTile; // Знайшли найближчу - віддаємо
        }
        return null; 
    }

    walkTo(targetPixelX, targetPixelY, onArrivalAction = null) {
        let toGridX = Math.floor(targetPixelX / this.tileSize);
        let toGridY = Math.floor(targetPixelY / this.tileSize);

        // Обмежуємо клік краями карти
        toGridX = Phaser.Math.Clamp(toGridX, 0, this.grid[0].length - 1);
        toGridY = Phaser.Math.Clamp(toGridY, 0, this.grid.length - 1);

        // ЯКЩО КЛІКНУЛИ НА СТІНУ - ШУКАЄМО НАЙБЛИЖЧУ ДОСТУПНУ ТОЧКУ
        if (this.grid[toGridY][toGridX] !== 0) {
            const nearest = this.findClosestWalkable(toGridX, toGridY);
            if (nearest) {
                toGridX = nearest.x;
                toGridY = nearest.y;
                // Коригуємо ціль, щоб персонаж ішов у центр знайденої клітинки
                targetPixelX = toGridX * this.tileSize + 16;
                targetPixelY = toGridY * this.tileSize + 16;
            } else {
                return; // Якщо всюди стіни, просто ігноруємо
            }
        }

        const fromGridX = Math.floor(this.player.x / this.tileSize);
        const fromGridY = Math.floor(this.player.y / this.tileSize);

        this.finder.findPath(fromGridX, fromGridY, toGridX, toGridY, (path) => {
            if (path === null) {
                console.warn("Шлях заблоковано!");
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