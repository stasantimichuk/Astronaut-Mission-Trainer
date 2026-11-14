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
        console.log("✅ Сцена MainBase успішно завантажена!");
        this.cameras.main.setBackgroundColor('#1a1a1a');

        this.finder = new EasyStar.js();
        const grid = [];
        const mapWidthTiles = 100;
        const mapHeightTiles = 100;
        const baseX = 45;
        const baseY = 45;
        
        const doorGridX = baseX + 2;
        const doorGridY = baseY + 5;
        const solarGridX = baseX + 2;
        const solarGridY = baseY - 2;

        for (let y = 0; y < mapHeightTiles; y++) {
            let row = [];
            for (let x = 0; x < mapWidthTiles; x++) {
                let isWalkable = 0; 
                
                if (y < baseY - 2) isWalkable = 1; 
                if (x >= baseX && x <= baseX + 5 && y >= baseY && y <= baseY + 5) isWalkable = 1; 
                
                // Перешкоди
                if (x === doorGridX && y === doorGridY) isWalkable = 1;
                if (x === solarGridX && y === solarGridY) isWalkable = 1;
                
                row.push(isWalkable);
            }
            grid.push(row);
        }

        this.grid = grid;
        this.finder.setGrid(grid);
        this.finder.setAcceptableTiles([0]);

        const mapWidthPx = mapWidthTiles * this.tileSize;
        const mapHeightPx = mapHeightTiles * this.tileSize;
        
        this.add.grid(mapWidthPx/2, mapHeightPx/2, mapWidthPx, mapHeightPx, this.tileSize, this.tileSize, 0x222222, 1, 0x333333, 1);
        this.add.rectangle(0, 0, mapWidthPx, (baseY - 2) * this.tileSize, 0x000000).setOrigin(0, 0); 
        this.add.rectangle(baseX * this.tileSize, baseY * this.tileSize, 6 * this.tileSize, 6 * this.tileSize, 0x666666).setOrigin(0, 0); 

        // 🚪 Двері (зелені, завжди відчинені)
        this.door = this.add.rectangle(doorGridX * this.tileSize, doorGridY * this.tileSize, 32, 32, 0x00ff00).setOrigin(0, 0);
        this.door.setInteractive();
        this.door.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation(); 
            const spot = this.getBestInteractionSpot(doorGridX, doorGridY);
            if (spot) {
                this.walkTo(spot.x * this.tileSize, spot.y * this.tileSize, () => {
                    this.scene.start('BuildingInside'); 
                });
            }
        });

        // ☀️ Сонячна панель
        this.solarPanel = this.add.rectangle(solarGridX * this.tileSize, solarGridY * this.tileSize, 32, 32, 0xffd700).setOrigin(0, 0);
        this.solarPanel.setInteractive();

        const makePanelDirty = () => {
            if (this.solarPanel) this.solarPanel.setFillStyle(0x705d42);
        };
        window.addEventListener('DIRTY_SOLAR_PANEL', makePanelDirty);
        this.events.on('shutdown', () => window.removeEventListener('DIRTY_SOLAR_PANEL', makePanelDirty));

        this.solarPanel.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            const spot = this.getBestInteractionSpot(solarGridX, solarGridY);
            if (spot) {
                this.walkTo(spot.x * this.tileSize, spot.y * this.tileSize, () => {
                    this.solarPanel.setFillStyle(0xffd700);
                    window.dispatchEvent(new CustomEvent('CLEAN_SOLAR_PANEL'));
                });
            }
        });

        // 💎 Збір реголіту
        this.collectibles = [];
        const spawnItem = (gridX, gridY, itemType, color) => {
            const item = this.add.rectangle(gridX * this.tileSize + 8, gridY * this.tileSize + 8, 16, 16, color).setOrigin(0, 0);
            item.setInteractive();
            item.on('pointerdown', (pointer, localX, localY, event) => {
                event.stopPropagation();
                this.walkTo(gridX * this.tileSize, gridY * this.tileSize, () => {
                    window.dispatchEvent(new CustomEvent('COLLECT_ITEM', { detail: { type: itemType } }));
                    item.destroy();
                });
            });
            this.collectibles.push(item);
        };

        spawnItem(baseX - 3, baseY + 6, 'regolith', 0x9b59b6);
        spawnItem(baseX + 4, baseY - 1, 'regolith', 0x9b59b6);
        spawnItem(baseX - 5, baseY + 2, 'regolith', 0x9b59b6);

        // Гравець
        let spawnGridX = baseX - 4; 
        let spawnGridY = baseY + 4;
        if (this.returnFromBuilding) {
            spawnGridX = doorGridX;
            spawnGridY = doorGridY + 1;
        }

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

    getBestInteractionSpot(targetGridX, targetGridY) {
        const fromGridX = Math.floor(this.player.x / this.tileSize);
        const fromGridY = Math.floor(this.player.y / this.tileSize);
        const neighbors = [
            { x: targetGridX, y: targetGridY - 1 },
            { x: targetGridX, y: targetGridY + 1 },
            { x: targetGridX - 1, y: targetGridY },
            { x: targetGridX + 1, y: targetGridY }
        ];

        let bestSpot = null;
        let minDistance = Infinity;

        for (let n of neighbors) {
            if (n.y >= 0 && n.y < this.grid.length && n.x >= 0 && n.x < this.grid[0].length) {
                if (this.grid[n.y][n.x] === 0) {
                    let dist = Phaser.Math.Distance.Between(fromGridX, fromGridY, n.x, n.y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestSpot = n;
                    }
                }
            }
        }
        return bestSpot;
    }

    walkTo(targetPixelX, targetPixelY, onArrivalAction = null) {
        let toGridX = Math.floor(targetPixelX / this.tileSize);
        let toGridY = Math.floor(targetPixelY / this.tileSize);

        toGridX = Phaser.Math.Clamp(toGridX, 0, this.grid[0].length - 1);
        toGridY = Phaser.Math.Clamp(toGridY, 0, this.grid.length - 1);

        if (this.grid[toGridY][toGridX] !== 0) {
            const spot = this.getBestInteractionSpot(toGridX, toGridY);
            if (spot) {
                toGridX = spot.x;
                toGridY = spot.y;
                targetPixelX = toGridX * this.tileSize + 16;
                targetPixelY = toGridY * this.tileSize + 16;
            } else {
                return;
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