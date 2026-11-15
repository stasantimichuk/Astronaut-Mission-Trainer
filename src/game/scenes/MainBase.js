import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import Astronaut from '../entities/Astronaut';
import { BUILDING_SPAWN } from './BuildingScene';
import { deliverRegolith } from '../utils/deliverRegolith';

const SOLAR_CLEAN_COLOR = 0xffd700;
const SOLAR_DIRTY_COLOR = 0x705d42;

// MainBase = поверхня Місяця (відкритий простір). Тут астронавти втрачають кисень/енергію/скафандр,
// а всю симуляцію (ресурси, івенти, теплиця) рахує Interface.jsx. Сцена лише повідомляє
// про локацію, рух, укриття, інвентар та взаємодії через window-події.
export default class MainBase extends Phaser.Scene {
    constructor() {
        super('MainBase');
        this.tileSize = 32;
    }

    preload() {
        if (!this.textures.exists('mainBaseTexture')) {
            this.load.image('mainBaseTexture', '/assets/sprites/mainModuleBase.png');
        }
    }

    create() {
        const ts = this.tileSize;
        this.cameras.main.setBackgroundColor('#1a1a1a');

        this.finder = new EasyStar.js();
        const mapWidthTiles = 100;
        const mapHeightTiles = 100;

        // --- Розташування об'єктів (в тайлах) ---
        const baseX = 45, baseY = 45;
        const doorGridX = baseX + 3, doorGridY = baseY + 6;
        const solarGridX = baseX + 2, solarGridY = baseY - 2;
        const lab = { x: 35, y: 45 };
        const labDoor = { x: lab.x + 3, y: lab.y + 5 };
        const greenhouse = { x: 55, y: 45 };
        const greenhouseDoor = { x: greenhouse.x + 3, y: greenhouse.y + 5 };
        const depot = { x: 48, y: 42 };
        const shelter = { x: 45, y: 54, size: 4 };

        const inRect = (x, y, rx, ry, w, h) => x >= rx && x < rx + w && y >= ry && y < ry + h;

        const grid = [];
        for (let y = 0; y < mapHeightTiles; y++) {
            const row = [];
            for (let x = 0; x < mapWidthTiles; x++) {
                let isWalkable = 0;
                if (y < baseY - 2) isWalkable = 1;                         // космос за межами карти бази
                if (inRect(x, y, baseX, baseY, 6, 6)) isWalkable = 1;      // головний модуль
                if (inRect(x, y, lab.x, lab.y, 6, 6)) isWalkable = 1;      // лабораторія
                if (inRect(x, y, greenhouse.x, greenhouse.y, 6, 6)) isWalkable = 1; // теплиця
                if (x === doorGridX && y === doorGridY) isWalkable = 1;
                if (x === solarGridX && y === solarGridY) isWalkable = 1;
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
        this.add.rectangle(0, 0, mapWidthPx, (baseY - 2) * ts, 0x000000).setOrigin(0, 0);

        if (this.textures.exists('mainBaseTexture')) {
            this.add.image(baseX * ts, baseY * ts, 'mainBaseTexture')
                .setOrigin(0, 0)
                .setDisplaySize(7 * ts, 7 * ts);
        } else {
            this.add.rectangle(baseX * ts, baseY * ts, 6 * ts, 6 * ts, 0x666666).setOrigin(0, 0);
        }

        // --- Будівлі ---
        this.add.rectangle(lab.x * ts, lab.y * ts, 6 * ts, 6 * ts, 0x1e3a8a).setOrigin(0, 0);
        this.add.text((lab.x + 3) * ts, (lab.y - 1) * ts, 'H2O / O2 LAB', {
            fontSize: '10px', fill: '#3b82f6', fontFamily: '"Press Start 2P", monospace'
        }).setOrigin(0.5);

        this.add.rectangle(greenhouse.x * ts, greenhouse.y * ts, 6 * ts, 6 * ts, 0x166534).setOrigin(0, 0);
        this.add.text((greenhouse.x + 3) * ts, (greenhouse.y - 1) * ts, 'ТЕПЛИЦЯ', {
            fontSize: '10px', fill: '#22c55e', fontFamily: '"Press Start 2P", monospace'
        }).setOrigin(0.5);

        // --- Укриття (захищає від івентів, відновлює скафандр і HP, живиться від бази) ---
        const shelterX = shelter.x * ts;
        const shelterY = shelter.y * ts;
        const shelterPx = shelter.size * ts;
        this.shelterRect = { x: shelterX, y: shelterY, w: shelterPx, h: shelterPx };
        this.shelterZone = this.add.rectangle(shelterX, shelterY, shelterPx, shelterPx, 0x10b981, 0.3).setOrigin(0, 0);
        this.add.text(shelterX + 8, shelterY + 8, 'УКРИТТЯ', {
            fontSize: '8px', fill: '#10b981', fontFamily: '"Press Start 2P", monospace'
        });
        this.shelterState = {};

        // --- Параметри руху/часу ---
        this.normalSpeed = 200;
        this.speed = this.normalSpeed;
        this.timeScale = window.currentGameTimeScale !== undefined ? window.currentGameTimeScale : 1;

        // --- ГЛОБАЛЬНА ПАМ'ЯТЬ (Registry): де хто стоїть + інвентар ---
        if (!this.registry.has('crewState')) {
            const startX = (baseX - 4) * ts;
            const startY = (baseY + 4) * ts;
            this.registry.set('crewState', [
                { id: 1, scene: 'MainBase', x: startX, y: startY, color: 0x0ea5e9, inventory: 0 },
                { id: 2, scene: 'MainBase', x: startX + 40, y: startY, color: 0xf59e0b, inventory: 0 },
                { id: 3, scene: 'MainBase', x: startX, y: startY + 40, color: 0x10b981, inventory: 0 },
                { id: 4, scene: 'MainBase', x: startX + 40, y: startY + 40, color: 0xa855f7, inventory: 0 }
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

        // --- Двері будівель ---
        this.addDoor(doorGridX, doorGridY, 0x00ff00, 'LandingModule', { x: 50 * ts, y: 54 * ts });
        this.addDoor(labDoor.x, labDoor.y, 0x3b82f6, 'WaterProcessingBuilding',
            { x: BUILDING_SPAWN.x * ts, y: BUILDING_SPAWN.y * ts });
        this.addDoor(greenhouseDoor.x, greenhouseDoor.y, 0x22c55e, 'Greenhouse',
            { x: BUILDING_SPAWN.x * ts, y: BUILDING_SPAWN.y * ts });

        // --- ☀️ Сонячна панель ---
        this.solarPanel = this.add.rectangle(solarGridX * ts, solarGridY * ts, ts, ts, SOLAR_CLEAN_COLOR).setOrigin(0, 0);
        this.solarPanel.setInteractive();
        // Якщо панель вже засипана пилом (івент стався, поки ми були в будівлі) — показуємо це одразу
        if (window.gameSim && window.gameSim.solarDirty) this.solarPanel.setFillStyle(SOLAR_DIRTY_COLOR);

        const makePanelDirty = () => { if (this.solarPanel) this.solarPanel.setFillStyle(SOLAR_DIRTY_COLOR); };
        const makePanelClean = () => { if (this.solarPanel) this.solarPanel.setFillStyle(SOLAR_CLEAN_COLOR); };
        window.addEventListener('DIRTY_SOLAR_PANEL', makePanelDirty);
        window.addEventListener('CLEAN_SOLAR_PANEL', makePanelClean);

        this.solarPanel.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            const spot = this.getBestInteractionSpot(solarGridX, solarGridY);
            if (!spot) return;
            this.walkTo(spot.x * ts, spot.y * ts, () => {
                window.dispatchEvent(new CustomEvent('CLEAN_SOLAR_PANEL'));
            });
        });

        // --- 🪨 Реголіт (ресурси) ---
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

        // --- 📦 Склад ресурсів ---
        this.resourceDepot = this.add.rectangle(depot.x * ts, depot.y * ts, ts, ts, 0xd97706).setOrigin(0, 0);
        this.resourceDepot.setInteractive();
        this.add.text(depot.x * ts + 16, (depot.y - 1) * ts, 'СКЛАД РЕСУРСІВ', {
            fontSize: '8px', fill: '#f59e0b', fontFamily: '"Press Start 2P", monospace'
        }).setOrigin(0.5);

        this.resourceDepot.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            const astroId = this.activeAstroId;
            const spot = this.getBestInteractionSpot(depot.x, depot.y);
            if (!spot) return;
            this.walkTo(spot.x * ts, spot.y * ts, () => deliverRegolith(this, astroId));
        });

        // --- Перемикання астронавта ---
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

        // Визначаємо, хто стоїть в укритті, і повідомляємо React
        this.time.addEvent({ delay: 250, callback: this.checkShelter, callbackScope: this, loop: true });

        this.events.on('shutdown', () => {
            window.removeEventListener('DIRTY_SOLAR_PANEL', makePanelDirty);
            window.removeEventListener('CLEAN_SOLAR_PANEL', makePanelClean);
            window.removeEventListener('SWITCH_ASTRO', handleSwitchAstro);
            window.removeEventListener('SET_TIME', handleSetTime);
        });

        this.input.on('pointerdown', (pointer) => {
            this.walkTo(pointer.worldX, pointer.worldY, null);
        });
    }

    // Двері в будівлю: підійти -> зберегти стан -> перейти в іншу сцену
    addDoor(gridX, gridY, color, targetScene, spawnPx) {
        const ts = this.tileSize;
        const door = this.add.rectangle(gridX * ts, gridY * ts, ts, ts, color).setOrigin(0, 0);
        door.setInteractive();
        door.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            const astroId = this.activeAstroId;
            const spot = this.getBestInteractionSpot(gridX, gridY);
            if (!spot) return;
            this.walkTo(spot.x * ts, spot.y * ts, () => {
                if (astroId !== this.activeAstroId) return; // гравець вже перемкнувся на іншого астронавта
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
        // Шукаємо вільну прохідну клітинку (не на будівлі й не в «космосі»)
        for (let attempt = 0; attempt < 40; attempt++) {
            const tx = Phaser.Math.Between(25, 65);
            const ty = Phaser.Math.Between(43, 58);
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
                    if (!regolith.active) return; // уже підібрано
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

        // Миттєва дія, якщо вже стоїмо на місці
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
        const eventSlowdown = sim.speedMultiplier !== undefined ? sim.speedMultiplier : 1; // CME сповільнює рух

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
