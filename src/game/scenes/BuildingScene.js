import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import Astronaut from '../entities/Astronaut';

// Спільна основа для внутрішніх приміщень (лабораторія води, теплиця).
// Кімната 15x11 тайлів, вихід — по центру нижньої стіни.
export const BUILDING_ROOM = { x: 42, y: 44, width: 15, height: 11 };
// Тайл, де з'являється астронавт одразу після входу (перед дверима виходу)
export const BUILDING_SPAWN = { x: 49, y: 53 };

export default class BuildingScene extends Phaser.Scene {
    constructor(key, cfg = {}) {
        super(key);
        this.sceneKey = key;
        this.tileSize = 32;
        this.cfg = {
            bgColor: '#0a0a12',
            floorColor: 0x2563eb,
            wallColor: 0x1e293b,
            title: '',
            titleColor: '#3b82f6',
            returnTile: { x: 48, y: 52 }, // куди повертаємось у MainBase (тайл)
            ...cfg
        };
    }

    // --- Хуки для нащадків ---
    getObstacles() { return []; }   // [{x, y}] непрохідні тайли всередині кімнати
    buildInterior() {}              // створення об'єктів інтер'єру
    onMoveCommand() {}              // гравець віддав команду руху активному астронавту

    create() {
        const ts = this.tileSize;
        const room = BUILDING_ROOM;
        const mapWidthTiles = 100;
        const mapHeightTiles = 100;
        const mapWidthPx = mapWidthTiles * ts;
        const mapHeightPx = mapHeightTiles * ts;

        this.cameras.main.setBackgroundColor(this.cfg.bgColor);
        this.finder = new EasyStar.js();
        this.exitTile = { x: room.x + 7, y: room.y + room.height };

        this.add.grid(mapWidthPx / 2, mapHeightPx / 2, mapWidthPx, mapHeightPx, ts, ts, 0x111118, 1, 0x1e1e26, 1);

        const floorGraphics = this.add.graphics();
        floorGraphics.fillStyle(this.cfg.floorColor, 1);
        const wallGraphics = this.add.graphics();
        wallGraphics.fillStyle(this.cfg.wallColor, 1);

        const obstacles = new Set(this.getObstacles().map(o => `${o.x},${o.y}`));
        const grid = [];
        for (let y = 0; y < mapHeightTiles; y++) {
            const row = [];
            for (let x = 0; x < mapWidthTiles; x++) {
                let isWalkable = 1;
                if (x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height) {
                    isWalkable = 0;
                    floorGraphics.fillRect(x * ts, y * ts, ts, ts);
                } else if (x >= room.x - 1 && x <= room.x + room.width && y >= room.y - 1 && y <= room.y + room.height) {
                    wallGraphics.fillRect(x * ts, y * ts, ts, ts);
                }
                if (obstacles.has(`${x},${y}`)) isWalkable = 1;
                if (x === this.exitTile.x && y === this.exitTile.y) isWalkable = 1; // двері — перешкода, зупиняємось перед ними
                row.push(isWalkable);
            }
            grid.push(row);
        }

        this.grid = grid;
        this.finder.setGrid(grid);
        this.finder.setAcceptableTiles([0]);
        this.finder.enableDiagonals();
        this.finder.enableCornerCutting();

        this.add.text((room.x + room.width / 2) * ts, (room.y - 1.5) * ts, this.cfg.title, {
            fontSize: '10px', fill: this.cfg.titleColor, fontFamily: '"Press Start 2P", monospace'
        }).setOrigin(0.5);

        // --- Екіпаж ---
        if (this.scene.settings.data && this.scene.settings.data.activeId) {
            this.registry.set('activeAstroId', this.scene.settings.data.activeId);
        }
        this.activeAstroId = this.registry.get('activeAstroId');
        this.astronauts = [];
        this.crewGroup = this.physics.add.group();

        const crewState = this.registry.get('crewState') || [];
        crewState.forEach(data => {
            if (data.scene === this.sceneKey) {
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
                    state[idx].scene = this.sceneKey;
                }
            });
            this.registry.set('crewState', state);
        };

        // --- Двері виходу на головну базу ---
        this.exitDoor = this.add.rectangle(this.exitTile.x * ts, this.exitTile.y * ts, ts, ts, 0xef4444).setOrigin(0, 0);
        this.exitDoor.setInteractive();
        this.exitDoor.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            const astroId = this.activeAstroId;
            const spot = this.getBestInteractionSpot(this.exitTile.x, this.exitTile.y);
            if (!spot) return;
            this.walkTo(spot.x * ts, spot.y * ts, () => {
                if (astroId !== this.activeAstroId) return; // гравець вже перемкнувся на іншого
                this.saveCrewState();
                const state = this.registry.get('crewState');
                const idx = state.findIndex(s => s.id === astroId);
                state[idx].scene = 'MainBase';
                state[idx].x = this.cfg.returnTile.x * ts;
                state[idx].y = this.cfg.returnTile.y * ts;
                this.registry.set('crewState', state);

                window.dispatchEvent(new CustomEvent('UPDATE_ASTRO_LOCATION', { detail: { id: astroId, location: 'MainBase' } }));
                this.scene.start('MainBase', { activeId: astroId });
            });
        });

        // --- Перемикання астронавта та час ---
        const handleSwitchAstro = (e) => {
            const targetId = e.detail;
            this.saveCrewState();
            const state = this.registry.get('crewState');
            const targetData = state.find(s => s.id === targetId);
            if (targetData && targetData.scene !== this.sceneKey) {
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

        this.buildInterior();
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

        this.onMoveCommand();

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
}
