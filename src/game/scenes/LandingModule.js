import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import Astronaut from '../entities/Astronaut';

export default class LandingModule extends Phaser.Scene {
    constructor() {
        super('LandingModule');
        this.tileSize = 32;
    }

    create() {
        this.cameras.main.setBackgroundColor('#050510');
        this.finder = new EasyStar.js();
        const grid = [];
        const mapWidthTiles = 100;
        const mapHeightTiles = 100;

        // Координати центру кімнати
        const cx = 50;
        const cy = 50;
        const radius = 5; 
        
        // Вихід тепер рівно по центру (x: 50) на нижній межі кола (y: 55)
        const exitGridX = cx;
        const exitGridY = cy + radius; 

        const mapWidthPx = mapWidthTiles * this.tileSize;
        const mapHeightPx = mapHeightTiles * this.tileSize;

        // 1. Малюємо фоновий космос
        this.add.grid(mapWidthPx/2, mapHeightPx/2, mapWidthPx, mapHeightPx, this.tileSize, this.tileSize, 0x111118, 1, 0x1e1e26, 1);

        // 2. Створюємо графіку для круглої підлоги та стін
        const floorGraphics = this.add.graphics();
        floorGraphics.fillStyle(0x3b3b4f, 1);
        const wallGraphics = this.add.graphics();
        wallGraphics.fillStyle(0x1e1e26, 1);

        // 3. Формуємо сітку (Grid) за допомогою рівняння кола
        for (let y = 0; y < mapHeightTiles; y++) {
            let row = [];
            for (let x = 0; x < mapWidthTiles; x++) {
                let isWalkable = 1; // За замовчуванням усе перешкода
                
                const dx = x - cx;
                const dy = y - cy;
                const distanceSquared = dx * dx + dy * dy;
                
                // Якщо всередині кола - це підлога
                if (distanceSquared <= radius * radius + 2) {
                    isWalkable = 0; 
                    floorGraphics.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
                } 
                // Якщо трохи далі - це товсті стіни
                else if (distanceSquared <= (radius + 1) * (radius + 1) + 2) {
                    wallGraphics.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
                }
                
                // Двері - це перешкода, щоб ми зупинялися ПЕРЕД ними
                if (x === exitGridX && y === exitGridY) isWalkable = 1;
                
                row.push(isWalkable);
            }
            grid.push(row);
        }

        this.grid = grid;
        this.finder.setGrid(grid);
        this.finder.setAcceptableTiles([0]);
        this.finder.enableDiagonals();
        this.finder.enableCornerCutting();

        // Додаємо напис
        this.add.text(cx * this.tileSize + 16, (cy - radius - 1.5) * this.tileSize, 'LANDING MODULE', { 
            fontSize: '12px', fill: '#f59e0b', fontFamily: '"Press Start 2P", monospace', resolution: 2 
        }).setOrigin(0.5);

        // --- ЧИТАННЯ ГЛОБАЛЬНОГО СТАНУ ---
        if (this.scene.settings.data && this.scene.settings.data.activeId) {
            this.registry.set('activeAstroId', this.scene.settings.data.activeId);
        }
        
        this.activeAstroId = this.registry.get('activeAstroId');
        this.astronauts = [];
        this.crewGroup = this.physics.add.group(); 

        const crewState = this.registry.get('crewState') || [];
        crewState.forEach(data => {
            if (data.scene === 'LandingModule') {
                const astro = new Astronaut(this, data.x, data.y, data.color, data.id);
                astro.body.setCollideWorldBounds(true);
                astro.body.setBounce(0.2); 
                this.crewGroup.add(astro);
                this.astronauts.push(astro);
            }
        });

        this.physics.add.collider(this.crewGroup, this.crewGroup);
        this.getActiveAstro = () => this.astronauts.find(a => a.id === this.activeAstroId);

        const activeSprite = this.getActiveAstro();
        this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);
        if (activeSprite) {
            this.cameras.main.startFollow(activeSprite, true, 0.1, 0.1);
        }

        this.saveCrewState = () => {
            const state = this.registry.get('crewState');
            this.astronauts.forEach(astro => {
                const idx = state.findIndex(s => s.id === astro.id);
                if (idx !== -1) {
                    state[idx].x = astro.x;
                    state[idx].y = astro.y;
                    state[idx].scene = 'LandingModule'; 
                }
            });
            this.registry.set('crewState', state);
        };

        // 🚪 Двері виходу на базу
        this.exitDoor = this.add.rectangle(exitGridX * this.tileSize, exitGridY * this.tileSize, 32, 32, 0x10b981).setOrigin(0, 0);
        this.exitDoor.setInteractive();
        this.exitDoor.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            const spot = this.getBestInteractionSpot(exitGridX, exitGridY);
            if (spot) {
                this.walkTo(spot.x * this.tileSize, spot.y * this.tileSize, () => {
                    this.saveCrewState(); 

                    const state = this.registry.get('crewState');
                    const idx = state.findIndex(s => s.id === this.activeAstroId);
                    state[idx].scene = 'MainBase';
                    
                    // Спавн рівно під дверима зовнішньої бази
                    state[idx].x = 48 * 32; 
                    state[idx].y = 52 * 32; 
                    this.registry.set('crewState', state);

                    window.dispatchEvent(new CustomEvent('UPDATE_ASTRO_LOCATION', { detail: { id: this.activeAstroId, location: 'MainBase' } }));
                    this.scene.start('MainBase', { activeId: this.activeAstroId }); 
                });
            }
        });

        const handleSwitchAstro = (e) => {
            const targetId = e.detail;
            this.saveCrewState(); 
            const state = this.registry.get('crewState');
            const targetData = state.find(s => s.id === targetId);

            if (targetData && targetData.scene !== 'LandingModule') {
                this.scene.start(targetData.scene, { activeId: targetId });
            } else {
                this.activeAstroId = targetId;
                this.registry.set('activeAstroId', targetId);
                const newActive = this.getActiveAstro();
                if (newActive) this.cameras.main.startFollow(newActive, true, 0.1, 0.1);
            }
        };

        this.speed = 200;
        this.timeScale = window.currentGameTimeScale !== undefined ? window.currentGameTimeScale : 1;
        const handleSetTime = (e) => { this.timeScale = e.detail; };

        window.addEventListener('SWITCH_ASTRO', handleSwitchAstro);
        window.addEventListener('SET_TIME', handleSetTime);

        this.events.on('shutdown', () => {
            window.removeEventListener('SWITCH_ASTRO', handleSwitchAstro);
            window.removeEventListener('SET_TIME', handleSetTime);
        });

        this.input.on('pointerdown', (pointer) => {
            this.walkTo(pointer.worldX, pointer.worldY, null);
        });
    }

    getBestInteractionSpot(targetGridX, targetGridY) {
        const activeAstro = this.getActiveAstro();
        if (!activeAstro) return null;

        const fromGridX = Math.floor(activeAstro.x / this.tileSize);
        const fromGridY = Math.floor(activeAstro.y / this.tileSize);
        const neighbors = [
            { x: targetGridX, y: targetGridY - 1 }, { x: targetGridX, y: targetGridY + 1 },
            { x: targetGridX - 1, y: targetGridY }, { x: targetGridX + 1, y: targetGridY }
        ];

        let bestSpot = null;
        let minDistance = Infinity;

        for (let n of neighbors) {
            if (n.y >= 0 && n.y < this.grid.length && n.x >= 0 && n.x < this.grid[0].length) {
                if (this.grid[n.y][n.x] === 0) {
                    let dist = Phaser.Math.Distance.Between(fromGridX, fromGridY, n.x, n.y);
                    if (dist < minDistance) { minDistance = dist; bestSpot = n; }
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
                toGridX = spot.x; toGridY = spot.y;
                targetPixelX = toGridX * this.tileSize + 16;
                targetPixelY = toGridY * this.tileSize + 16;
            } else return;
        }

        const activeAstro = this.getActiveAstro();
        if (!activeAstro) return;

        const fromGridX = Math.floor(activeAstro.x / this.tileSize);
        const fromGridY = Math.floor(activeAstro.y / this.tileSize);

        // --- ТОЙ САМИЙ ФІКС ДЛЯ МИТТЄВОГО КЛІКУ ---
        if (fromGridX === toGridX && fromGridY === toGridY) {
            activeAstro.isMoving = false;
            if (onArrivalAction) onArrivalAction();
            return;
        }
        // -------------------------------------------

        this.finder.findPath(fromGridX, fromGridY, toGridX, toGridY, (path) => {
            if (path) {
                activeAstro.currentPath = path.map(p => new Phaser.Math.Vector2(p.x * this.tileSize, p.y * this.tileSize));
                let finalX = targetPixelX - 16;
                let finalY = targetPixelY - 16;
                
                if (activeAstro.currentPath.length > 0) {
                     activeAstro.currentPath[activeAstro.currentPath.length - 1] = new Phaser.Math.Vector2(finalX, finalY);
                }
                if (activeAstro.currentPath.length > 1) activeAstro.currentPath.shift();

                activeAstro.pendingAction = onArrivalAction; 
                activeAstro.isMoving = true;
            }
        });
        this.finder.calculate();
    }

    update() {
        this.astronauts.forEach(astro => astro.updateMovement(this.speed, this.timeScale));
    }

    
}