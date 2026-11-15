import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import Astronaut from '../entities/Astronaut';

export default class GreenhouseBuilding extends Phaser.Scene {
    constructor() {
        super('Greenhouse');
        this.tileSize = 32;
    }

    preload() {
        if (!this.textures.exists('greenhouseIntTexture')) {
            this.load.image('greenhouseIntTexture', 'assets/sprites/greenhouse_int.png');
        }
        // ВИПРАВЛЕНО: завантажуємо текстури астронавтів, щоб сцена не крашилась при оновленні
        if (!this.textures.exists('astro_1_stand')) {
            for (let i = 1; i <= 4; i++) {
                this.load.image(`astro_${i}_stand`, `assets/sprites/astro_${i}_stand.png`);
                this.load.image(`astro_${i}_walk1`, `assets/sprites/astro_${i}_walk1.png`);
                this.load.image(`astro_${i}_walk2`, `assets/sprites/astro_${i}_walk2.png`);
            }
        }
    }

    create() {
        const ts = this.tileSize;
        this.cameras.main.setBackgroundColor('#050510'); 
        this.finder = new EasyStar.js();

        const mapWidthTiles = 100;
        const mapHeightTiles = 100;
        const mapWidthPx = mapWidthTiles * ts;
        const mapHeightPx = mapHeightTiles * ts;

        this.add.grid(mapWidthPx/2, mapHeightPx/2, mapWidthPx, mapHeightPx, ts, ts, 0x111118, 1, 0x1e1e26, 1);

        const ghX = 47;       
        const ghY = 49;       
        const ghWidth = 5;    
        const ghHeight = 5;   
        
        const pathStartX = 48; 
        const pathEndX = 50;   
        
        const doorY = 53; 

        if (this.textures.exists('greenhouseIntTexture')) {
            this.add.image(ghX * ts, ghY * ts, 'greenhouseIntTexture')
                .setOrigin(0, 0)
                .setDisplaySize(ghWidth * ts, ghHeight * ts);
        }

        const grid = [];
        for (let y = 0; y < mapHeightTiles; y++) {
            let row = [];
            for (let x = 0; x < mapWidthTiles; x++) {
                let isWalkable = 1; 
                if (x >= pathStartX && x <= pathEndX && y >= ghY && y <= doorY) {
                    isWalkable = 0; 
                }
                row.push(isWalkable);
            }
            grid.push(row);
        }
        
        this.grid = grid;
        this.finder.setGrid(grid);
        this.finder.setAcceptableTiles([0]);
        this.finder.enableDiagonals();
        this.finder.enableCornerCutting();

        // ВИПРАВЛЕНО: Створюємо анімації для астронавтів
        for (let i = 1; i <= 4; i++) {
            if (!this.anims.exists(`walk_${i}`)) {
                this.anims.create({
                    key: `walk_${i}`,
                    frames: [
                        { key: `astro_${i}_walk1` },
                        { key: `astro_${i}_stand` },
                        { key: `astro_${i}_walk2` },
                        { key: `astro_${i}_stand` }
                    ],
                    frameRate: 6,
                    repeat: -1
                });
            }
        }

        this.planters = [];
        const createPlanter = (x, y, w, h) => {
            const rect = this.add.rectangle(x * ts, y * ts, w * ts, h * ts, 0xff0000, 0).setOrigin(0, 0);
            rect.setInteractive();
            this.planters.push(rect);
            
            rect.on('pointerdown', (pointer, localX, localY, event) => {
                event.stopPropagation();
                const astroId = this.activeAstroId;
                this.walkTo(pointer.worldX, pointer.worldY, () => {
                    window.dispatchEvent(new CustomEvent('ASTRO_WORK', {
                        detail: { id: astroId, working: true, place: 'Greenhouse' }
                    }));
                });
            });
        };

        createPlanter(ghX, ghY, 1, ghHeight);
        createPlanter(ghX + 4, ghY, 1, ghHeight);

        const centerX = (ghX + ghWidth / 2) * ts;
        this.add.rectangle(centerX, (ghY - 1.5) * ts, 8 * ts, 35, 0x000000, 0.8).setOrigin(0.5, 0.5);
        this.statusText = this.add.text(centerX, (ghY - 1.5) * ts, '', {
            fontSize: '8px', fill: '#86efac', fontFamily: '"Press Start 2P", monospace', align: 'center', lineSpacing: 6
        }).setOrigin(0.5, 0.5);
        
        this.add.text(centerX, (ghY - 3) * ts, 'GREENHOUSE', {
            fontSize: '10px', fill: '#22c55e', fontFamily: '"Press Start 2P", monospace'
        }).setOrigin(0.5, 0.5);

        this.add.rectangle(centerX, (doorY + 1.5) * ts, 6 * ts, 15, 0x000000, 0.8).setOrigin(0.5, 0.5);
        this.add.text(centerX, (doorY + 1.5) * ts, 'КЛІКНІТЬ НИЖЧЕ ДЛЯ ВИХОДУ', {
            fontSize: '7px', fill: '#4ade80', fontFamily: '"Press Start 2P", monospace'
        }).setOrigin(0.5, 0.5);

        this.refreshStatus();
        this.time.addEvent({ delay: 500, loop: true, callback: this.refreshStatus, callbackScope: this });

        if (this.scene.settings.data && this.scene.settings.data.activeId) {
            this.registry.set('activeAstroId', this.scene.settings.data.activeId);
        }
        
        this.activeAstroId = this.registry.get('activeAstroId');
        this.astronauts = [];
        this.crewGroup = this.physics.add.group();

        const crewState = this.registry.get('crewState') || [];
        crewState.forEach(data => {
            if (data.scene === 'Greenhouse') {
                const astro = new Astronaut(this, data.x, data.y, data.color, data.id);
                astro.body.setCollideWorldBounds(true);
                astro.body.setBounce(0.2);
                astro.setDepth(5); // ВИПРАВЛЕНО: Астронавт поверх усього
                this.crewGroup.add(astro);
                this.astronauts.push(astro);
            }
        });

        this.physics.add.collider(this.crewGroup, this.crewGroup);
        this.getActiveAstro = () => this.astronauts.find(a => a.id === this.activeAstroId);

        this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);
        const activeSprite = this.getActiveAstro();
        if (activeSprite) {
            this.cameras.main.startFollow(activeSprite, true, 0.1, 0.1);
        } else {
            this.cameras.main.centerOn(centerX, (ghY + ghHeight / 2) * ts);
        }

        this.saveCrewState = () => {
            const state = this.registry.get('crewState');
            this.astronauts.forEach(astro => {
                const idx = state.findIndex(s => s.id === astro.id);
                if (idx !== -1) {
                    state[idx].x = astro.x;
                    state[idx].y = astro.y;
                    state[idx].scene = 'Greenhouse';
                }
            });
            this.registry.set('crewState', state);
        };

        // ВИПРАВЛЕНО: прибрано 0 в кінці, щоб двері стали червоними
        this.exitDoor = this.add.rectangle(pathStartX * ts, doorY * ts, 3 * ts, ts, 0xef4444).setOrigin(0, 0);
        this.exitDoor.setInteractive();
        this.exitDoor.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            
            this.walkTo(pointer.worldX, pointer.worldY, () => {
                const sim = window.gameSim || {};
                if ((sim.workingIds || []).includes(this.activeAstroId)) {
                    window.dispatchEvent(new CustomEvent('ASTRO_WORK', { detail: { id: this.activeAstroId, working: false } }));
                }
                
                this.saveCrewState();
                const state = this.registry.get('crewState');
                const idx = state.findIndex(s => s.id === this.activeAstroId);
                state[idx].scene = 'MainBase';
                state[idx].x = 56 * ts;  
                // ВИПРАВЛЕНО: Спавн перед дверима на Y: 71
                state[idx].y = 71 * ts; 
                this.registry.set('crewState', state);
                
                window.dispatchEvent(new CustomEvent('UPDATE_ASTRO_LOCATION', { detail: { id: this.activeAstroId, location: 'MainBase' } }));
                this.scene.start('MainBase', { activeId: this.activeAstroId });
            });
        });

        const handleSwitchAstro = (e) => {
            const targetId = e.detail;
            this.saveCrewState();
            const state = this.registry.get('crewState');
            const targetData = state.find(s => s.id === targetId);
            if (targetData && targetData.scene !== 'Greenhouse') {
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
        for (const n of neighbors) {
            if (n.y >= 0 && n.y < this.grid.length && n.x >= 0 && n.x < this.grid[0].length) {
                if (this.grid[n.y][n.x] === 0) {
                    const dist = Phaser.Math.Distance.Between(fromGridX, fromGridY, n.x, n.y);
                    if (dist < minDistance) { minDistance = dist; bestSpot = n; }
                }
            }
        }
        return bestSpot;
    }

    walkTo(targetPixelX, targetPixelY, onArrivalAction = null) {
        const dead = (window.gameSim && window.gameSim.deadIds) || [];
        if (dead.includes(this.activeAstroId)) return;

        const sim = window.gameSim || {};
        if ((sim.workingIds || []).includes(this.activeAstroId)) {
            window.dispatchEvent(new CustomEvent('ASTRO_WORK', { detail: { id: this.activeAstroId, working: false } }));
        }

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

        if (fromGridX === toGridX && fromGridY === toGridY) {
            activeAstro.isMoving = false;
            if (onArrivalAction) onArrivalAction();
            return;
        }

        this.finder.findPath(fromGridX, fromGridY, toGridX, toGridY, (path) => {
            if (path) {
                activeAstro.currentPath = path.map(p => new Phaser.Math.Vector2(p.x * this.tileSize, p.y * this.tileSize));
                const finalX = targetPixelX - 16;
                const finalY = targetPixelY - 16;
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
        const dead = (window.gameSim && window.gameSim.deadIds) || [];
        this.astronauts.forEach(astro => {
            if (dead.includes(astro.id)) {
                astro.currentPath = [];
                astro.isMoving = false;
                astro.updateMovement(0, 0);
            } else {
                astro.updateMovement(this.speed, this.timeScale);
            }
        });
    }

    // ДОДАЙ ЦЕЙ БЛОК, ЙОГО НЕ ВИСТАЧАЛО!
    refreshStatus() {
        const sim = window.gameSim || {};
        const gh = sim.greenhouse || { growth: 0, ready: 0, workProgress: 0, powered: true };
        const workers = (sim.workingIds || []).length;
        const lines = [
            gh.powered ? `РІСТ: ${Math.round(gh.growth)}%` : 'НЕМАЄ ЕНЕРГІЇ АБО ВОДИ!',
            `УРОЖАЙ ГОТОВИЙ: ${gh.ready}`,
            `ПРАЦЮЮТЬ: ${workers}  ЗБІР: ${Math.round(gh.workProgress)}%`
        ];
        if (this.statusText) {
            this.statusText.setText(lines.join('\n'));
        }
    }
}