import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import Astronaut from '../entities/Astronaut';
import { deliverRegolith } from '../utils/deliverRegolith';

const SOLAR_CLEAN_COLOR = 0xffd700;
const SOLAR_DIRTY_COLOR = 0x705d42;

export default class MainBase extends Phaser.Scene {
    constructor() {
        super('MainBase');
        this.tileSize = 32;
    }

    preload() {
        if (!this.textures.exists('mainBaseTexture')) {
            this.load.image('mainBaseTexture', 'assets/sprites/mainModuleBase.png');
        }
        if (!this.textures.exists('greenhouseExtTexture')) {
            this.load.image('greenhouseExtTexture', 'assets/sprites/greenhouse_ext.png');
        }
        
        if (!this.textures.exists('solar_clean')) {
            this.load.image('solar_clean', 'assets/sprites/solar_clean.png');
            this.load.image('solar_dirty', 'assets/sprites/solar_dirty.png');
        }
        
        if (!this.textures.exists('astro_1_stand')) {
            for (let i = 1; i <= 4; i++) {
                this.load.image(`astro_${i}_stand`, `assets/sprites/astro_${i}_stand.png`);
                this.load.image(`astro_${i}_walk1`, `assets/sprites/astro_${i}_walk1.png`);
                this.load.image(`astro_${i}_walk2`, `assets/sprites/astro_${i}_walk2.png`);
            }
        }
        if (!this.textures.exists('mapTexture')) {
            this.load.image('mapTexture', 'assets/sprites/background.png');
        }
    }

    create() {
        const ts = this.tileSize;
        this.cameras.main.setBackgroundColor('#1a1a1a');

        this.finder = new EasyStar.js();
        const mapWidthTiles = 100;
        const mapHeightTiles = 100;

        const spaceEndY = 48; 
        const baseX = 45, baseY = 65;
        const doorGridX = baseX + 3, doorGridY = baseY + 6;
        
        const lab = { x: 35, y: 65 };
        const labDoor = { x: lab.x + 3, y: lab.y + 5 };

        const greenhouse = { x: 55, y: 65 };
        // ВИПРАВЛЕНО: +5 замість +6, тепер квадрат рівно на нижньому краю текстури
        const greenhouseDoor = { x: greenhouse.x + 1, y: greenhouse.y + 5 }; 

        const depot = { x: 48, y: 61 };
        const shelter = { x: 45, y: 75, size: 4 };

        const solarPanelsConfig = [
            { x: 41, y: 54 },
            { x: 48, y: 54 },
            { x: 55, y: 54 }
        ];

        const inRect = (x, y, rx, ry, w, h) => x >= rx && x < rx + w && y >= ry && y < ry + h;

        const grid = [];
        for (let y = 0; y < mapHeightTiles; y++) {
            const row = [];
            for (let x = 0; x < mapWidthTiles; x++) {
                let isWalkable = 0;
                
                if (y < spaceEndY) isWalkable = 1; 
                
                if (inRect(x, y, baseX, baseY, 7, 7)) isWalkable = 1;     
                if (inRect(x, y, lab.x, lab.y, 6, 6)) isWalkable = 1;      
                if (inRect(x, y, greenhouse.x, greenhouse.y, 3, 6)) isWalkable = 1; 
                
                solarPanelsConfig.forEach(pos => {
                    if (inRect(x, y, pos.x, pos.y, 2, 3)) isWalkable = 1; 
                });

                if (x === doorGridX && y === doorGridY) isWalkable = 1;
                
                row.push(isWalkable);
            }
            grid.push(row);
        }

        this.grid = grid;
        this.finder.setGrid(grid);
        this.finder.setAcceptableTiles([0]);
        this.finder.enableDiagonals();
        this.finder.enableCornerCutting();

        const mapWidthPx = mapWidthTiles * ts;
        const mapHeightPx = mapHeightTiles * ts;

        this.add.grid(mapWidthPx / 2, mapHeightPx / 2, mapWidthPx, mapHeightPx, ts, ts, 0x222222, 1, 0x333333, 1);
        this.add.rectangle(0, 0, mapWidthPx, spaceEndY * ts, 0x000000).setOrigin(0, 0);

        const surfaceY = spaceEndY * ts;
        const surfaceHeight = (mapHeightTiles - spaceEndY) * ts;

        if (this.textures.exists('mapTexture')) {
            this.add.image(0, surfaceY, 'mapTexture')
                .setOrigin(0, 0)
                .setDisplaySize(mapWidthPx, surfaceHeight)
                .setDepth(0);
        } else {
            this.add.rectangle(0, surfaceY, mapWidthPx, surfaceHeight, 0x666666)
                .setOrigin(0, 0)
                .setDepth(0);
        }


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

        if (this.textures.exists('mainBaseTexture')) {
            this.add.image(baseX * ts, baseY * ts, 'mainBaseTexture').setOrigin(0, 0).setDisplaySize(7 * ts, 7 * ts).setDepth(1);
        } else {
            this.add.rectangle(baseX * ts, baseY * ts, 6 * ts, 6 * ts, 0x666666).setOrigin(0, 0);
        }

        this.add.rectangle(lab.x * ts, lab.y * ts, 6 * ts, 6 * ts, 0x1e3a8a).setOrigin(0, 0).setDepth(1);
        this.add.text((lab.x + 3) * ts, (lab.y - 1) * ts, 'H2O / O2 LAB', { fontSize: '10px', fill: '#3b82f6', fontFamily: '"Press Start 2P", monospace' }).setOrigin(0.5).setDepth(2);

        if (this.textures.exists('greenhouseExtTexture')) {
            this.add.image(greenhouse.x * ts, greenhouse.y * ts, 'greenhouseExtTexture')
                .setOrigin(0, 0).setDisplaySize(3 * ts, 6 * ts).setDepth(1);
        } else {
             this.add.rectangle(greenhouse.x * ts, greenhouse.y * ts, 3 * ts, 6 * ts, 0x166534).setOrigin(0, 0).setDepth(1);
        }
        this.add.text((greenhouse.x + 1.5) * ts, (greenhouse.y - 1) * ts, 'ТЕПЛИЦЯ', { fontSize: '10px', fill: '#22c55e', fontFamily: '"Press Start 2P", monospace' }).setOrigin(0.5).setDepth(2);

        const shelterX = shelter.x * ts, shelterY = shelter.y * ts, shelterPx = shelter.size * ts;
        this.shelterRect = { x: shelterX, y: shelterY, w: shelterPx, h: shelterPx };
        this.shelterZone = this.add.rectangle(shelterX, shelterY, shelterPx, shelterPx, 0x10b981, 0.3).setOrigin(0, 0);
        this.add.text(shelterX + 8, shelterY + 8, 'УКРИТТЯ', { fontSize: '8px', fill: '#10b981', fontFamily: '"Press Start 2P", monospace' });
        this.shelterState = {};

        this.normalSpeed = 200;
        this.speed = this.normalSpeed;
        this.timeScale = window.currentGameTimeScale !== undefined ? window.currentGameTimeScale : 1;

        if (!this.registry.has('crewState')) {
            const startX = (baseX - 4) * ts;
            const startY = (baseY + 4) * ts;
            this.registry.set('crewState', [
                { id: 1, scene: 'MainBase', x: startX, y: startY, inventory: 0 },
                { id: 2, scene: 'MainBase', x: startX + 40, y: startY, inventory: 0 },
                { id: 3, scene: 'MainBase', x: startX, y: startY + 40, inventory: 0 },
                { id: 4, scene: 'MainBase', x: startX + 40, y: startY + 40, inventory: 0 }
            ]);
            this.registry.set('activeAstroId', 1);
        }

        if (this.scene.settings.data && this.scene.settings.data.activeId) {
            this.registry.set('activeAstroId', this.scene.settings.data.activeId);
        }

        this.activeAstroId = this.registry.get('activeAstroId');
        this.astronauts = [];
        this.crewGroup = this.physics.add.group();

        const crewState = this.registry.get('crewState');
        crewState.forEach(data => {
            if (data.scene === 'MainBase') {
                const astro = new Astronaut(this, data.x, data.y, data.color, data.id);
                astro.body.setCollideWorldBounds(true);
                astro.body.setBounce(0.2);
                astro.setDepth(5); 
                this.crewGroup.add(astro);
                this.astronauts.push(astro);
            }
        });

        this.physics.add.collider(this.crewGroup, this.crewGroup);
        this.getActiveAstro = () => this.astronauts.find(a => a.id === this.activeAstroId);

        this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);
        const activeSprite = this.getActiveAstro();
        if (activeSprite) this.cameras.main.startFollow(activeSprite, true, 0.1, 0.1);

        this.saveCrewState = () => {
            const state = this.registry.get('crewState');
            this.astronauts.forEach(astro => {
                const idx = state.findIndex(s => s.id === astro.id);
                if (idx !== -1) {
                    state[idx].x = astro.x;
                    state[idx].y = astro.y;
                    state[idx].scene = 'MainBase';
                }
            });
            this.registry.set('crewState', state);
        };

        // ВИПРАВЛЕНО: передаємо правильні внутрішні координати спавну для кожної будівлі
        this.addDoor(doorGridX, doorGridY, 0x00ff00, 'LandingModule', { x: 50 * ts, y: 54 * ts });
        this.addDoor(labDoor.x, labDoor.y, 0x3b82f6, 'WaterProcessingBuilding', { x: 49 * ts, y: 54 * ts });
        this.addDoor(greenhouseDoor.x, greenhouseDoor.y, 0x22c55e, 'Greenhouse', { x: 49 * ts, y: 52 * ts }); // Спавн перед дверима всередині
        
        this.solarPanels = [];
        
        solarPanelsConfig.forEach(pos => {
            let sp;
            if (this.textures.exists('solar_clean')) {
                sp = this.add.image(pos.x * ts, pos.y * ts, 'solar_clean')
                    .setOrigin(0, 0).setDisplaySize(2 * ts, 3 * ts).setDepth(2);
            } else {
                sp = this.add.rectangle(pos.x * ts, pos.y * ts, 2 * ts, 3 * ts, SOLAR_CLEAN_COLOR).setOrigin(0, 0).setDepth(2);
            }
            
            const panelObj = { image: sp, isDirty: false };
            this.solarPanels.push(panelObj);
            
            const clickZone = this.add.rectangle(pos.x * ts, pos.y * ts, 2 * ts, 4 * ts, 0x000, 0).setOrigin(0, 0);
            clickZone.setInteractive();
            
            clickZone.on('pointerdown', (pointer, localX, localY, event) => {
                event.stopPropagation();
                if (!panelObj.isDirty) return; 

                const spot = this.getBestInteractionSpot(pos.x, pos.y + 3);
                if (!spot) return;
                
                this.walkTo(spot.x * ts, spot.y * ts, () => {
                    panelObj.isDirty = false;
                    if (this.textures.exists('solar_clean')) {
                        panelObj.image.setTexture('solar_clean').setDisplaySize(2 * ts, 3 * ts);
                    } else {
                        panelObj.image.setFillStyle(SOLAR_CLEAN_COLOR);
                    }
                    
                    const allClean = this.solarPanels.every(p => !p.isDirty);
                    if (allClean) {
                        window.dispatchEvent(new CustomEvent('CLEAN_SOLAR_PANEL'));
                    }
                });
            });
        });

        const makeAllPanelsDirty = () => {
            this.solarPanels.forEach(p => {
                p.isDirty = true;
                if (this.textures.exists('solar_dirty')) {
                    p.image.setTexture('solar_dirty').setDisplaySize(2 * ts, 3 * ts);
                } else {
                    p.image.setFillStyle(SOLAR_DIRTY_COLOR);
                }
            });
        };

        const makeAllPanelsClean = () => {
            this.solarPanels.forEach(p => {
                p.isDirty = false;
                if (this.textures.exists('solar_clean')) {
                    p.image.setTexture('solar_clean').setDisplaySize(2 * ts, 3 * ts);
                } else {
                    p.image.setFillStyle(SOLAR_CLEAN_COLOR);
                }
            });
        };

        if (window.gameSim && window.gameSim.solarDirty) {
            makeAllPanelsDirty();
        }
        
        window.addEventListener('DIRTY_SOLAR_PANEL', makeAllPanelsDirty);
        window.addEventListener('CLEAN_SOLAR_PANEL', makeAllPanelsClean);

        this.regolithNodes = [];
        this.maxRegolithCount = 10;
        for (let i = 0; i < this.maxRegolithCount; i++) this.spawnRegolithNode();

        this.time.addEvent({
            delay: 15000,
            callback: () => {
                if (this.regolithNodes.length < this.maxRegolithCount) this.spawnRegolithNode();
            },
            callbackScope: this,
            loop: true
        });

        this.resourceDepot = this.add.rectangle(depot.x * ts, depot.y * ts, ts, ts, 0xd97706).setOrigin(0, 0).setDepth(1);
        this.resourceDepot.setInteractive();
        this.add.text(depot.x * ts + 16, (depot.y - 1) * ts, 'СКЛАД РЕСУРСІВ', {
            fontSize: '8px', fill: '#f59e0b', fontFamily: '"Press Start 2P", monospace'
        }).setOrigin(0.5).setDepth(2);

        this.resourceDepot.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            const astroId = this.activeAstroId;
            const spot = this.getBestInteractionSpot(depot.x, depot.y);
            if (!spot) return;
            this.walkTo(spot.x * ts, spot.y * ts, () => deliverRegolith(this, astroId));
        });

        const handleSwitchAstro = (e) => {
            const targetId = e.detail;
            this.saveCrewState();
            const state = this.registry.get('crewState');
            const targetData = state.find(s => s.id === targetId);

            if (targetData && targetData.scene !== 'MainBase') {
                this.scene.start(targetData.scene, { activeId: targetId });
            } else {
                this.activeAstroId = targetId;
                this.registry.set('activeAstroId', targetId);
                const newActive = this.getActiveAstro();
                if (newActive) this.cameras.main.startFollow(newActive, true, 0.1, 0.1);
            }
        };
        const handleSetTime = (e) => { this.timeScale = e.detail; };

        window.addEventListener('SWITCH_ASTRO', handleSwitchAstro);
        window.addEventListener('SET_TIME', handleSetTime);

        this.time.addEvent({ delay: 250, callback: this.checkShelter, callbackScope: this, loop: true });

        this.events.on('shutdown', () => {
            window.removeEventListener('DIRTY_SOLAR_PANEL', makeAllPanelsDirty);
            window.removeEventListener('CLEAN_SOLAR_PANEL', makeAllPanelsClean);
            window.removeEventListener('SWITCH_ASTRO', handleSwitchAstro);
            window.removeEventListener('SET_TIME', handleSetTime);
        });

        this.input.on('pointerdown', (pointer) => {
            this.walkTo(pointer.worldX, pointer.worldY, null);
        });
    }

    addDoor(gridX, gridY, color, targetScene, spawnPx) {
        const ts = this.tileSize;
        const door = this.add.rectangle(gridX * ts, gridY * ts, ts, ts, color, 0).setOrigin(0, 0).setDepth(2); 
        door.setInteractive();
        door.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            const astroId = this.activeAstroId;
            const spot = this.getBestInteractionSpot(gridX, gridY);
            if (!spot) return;
            this.walkTo(spot.x * ts, spot.y * ts, () => {
                if (astroId !== this.activeAstroId) return; 
                this.saveCrewState();

                const state = this.registry.get('crewState');
                const idx = state.findIndex(s => s.id === astroId);
                state[idx].scene = targetScene;
                state[idx].x = spawnPx.x;
                state[idx].y = spawnPx.y;
                this.registry.set('crewState', state);

                window.dispatchEvent(new CustomEvent('UPDATE_ASTRO_LOCATION', { detail: { id: astroId, location: targetScene } }));
                this.scene.start(targetScene, { activeId: astroId });
            });
        });
        return door;
    }

    checkShelter() {
        const s = this.shelterRect;
        this.astronauts.forEach(a => {
            const cx = a.x + 16;
            const cy = a.y + 16;
            const inside = cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h;
            if (this.shelterState[a.id] !== inside) {
                this.shelterState[a.id] = inside;
                window.dispatchEvent(new CustomEvent('ASTRO_SHELTER', { detail: { id: a.id, inShelter: inside } }));
            }
        });
    }

    spawnRegolithNode() {
        const ts = this.tileSize;
        for (let attempt = 0; attempt < 40; attempt++) {
            const tx = Phaser.Math.Between(25, 65);
            const ty = Phaser.Math.Between(62, 85); 
            if (this.grid[ty][tx] !== 0) continue;
            if (this.regolithNodes.some(n => n.tileX === tx && n.tileY === ty)) continue;

            const regolith = this.add.circle(tx * ts + 16, ty * ts + 16, 10, 0x888888).setDepth(5);
            regolith.tileX = tx;
            regolith.tileY = ty;
            regolith.setInteractive();
            regolith.on('pointerdown', (pointer, localX, localY, event) => {
                event.stopPropagation();
                const astroId = this.activeAstroId;
                this.walkTo(regolith.x, regolith.y, () => {
                    if (!regolith.active) return; 
                    const crewState = this.registry.get('crewState') || [];
                    const astroData = crewState.find(s => s.id === astroId);
                    if (!astroData) return;

                    const currentInv = astroData.inventory || 0;
                    if (currentInv < 100) {
                        astroData.inventory = currentInv + 1;
                        this.registry.set('crewState', crewState);
                        regolith.destroy();
                        this.regolithNodes = this.regolithNodes.filter(n => n !== regolith);
                        window.dispatchEvent(new CustomEvent('UPDATE_INVENTORY', { detail: astroData }));
                    }
                });
            });
            this.regolithNodes.push(regolith);
            return;
        }
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
        const sim = window.gameSim || {};
        const dead = sim.deadIds || [];
        const eventSlowdown = sim.speedMultiplier !== undefined ? sim.speedMultiplier : 1;

        this.astronauts.forEach(astro => {
            if (dead.includes(astro.id)) {
                astro.currentPath = [];
                astro.isMoving = false;
                astro.updateMovement(0, 0);
            } else {
                astro.updateMovement(this.speed * eventSlowdown, this.timeScale);
            }
        });
    }
}