import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import Astronaut from '../entities/Astronaut';

export default class MainBase extends Phaser.Scene {
    constructor() {
        super('MainBase');
        this.tileSize = 32;
    }

    preload() {
        this.load.image('mainBaseTexture', '/assets/sprites/mainModuleBase.png');
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a1a');

        this.finder = new EasyStar.js();
        const grid = [];
        const mapWidthTiles = 100;
        const mapHeightTiles = 100;
        const baseX = 45;
        const baseY = 45;
        
        const doorGridX = baseX + 3;
        const doorGridY = baseY + 6;
        const solarGridX = baseX + 2;
        const solarGridY = baseY - 2;

        for (let y = 0; y < mapHeightTiles; y++) {
            let row = [];
            for (let x = 0; x < mapWidthTiles; x++) {
                let isWalkable = 0; 
                if (y < baseY - 2) isWalkable = 1; 
                if (x >= baseX && x <= baseX + 5 && y >= baseY && y <= baseY + 5) isWalkable = 1; 
                
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

        const mapWidthPx = mapWidthTiles * this.tileSize;
        const mapHeightPx = mapHeightTiles * this.tileSize;
        
        this.add.grid(mapWidthPx/2, mapHeightPx/2, mapWidthPx, mapHeightPx, this.tileSize, this.tileSize, 0x222222, 1, 0x333333, 1);
        this.add.rectangle(0, 0, mapWidthPx, (baseY - 2) * this.tileSize, 0x000000).setOrigin(0, 0); 
        
        this.add.image(baseX * this.tileSize, baseY * this.tileSize, 'mainBaseTexture')
            .setOrigin(0, 0)
            .setDisplaySize(7 * this.tileSize, 7 * this.tileSize);

        // --- ГЛОБАЛЬНА ПАМ'ЯТЬ (Registry) ---
        // Якщо гра запускається вперше, записуємо де всі стоять
        if (!this.registry.has('crewState')) {
            let startX = (baseX - 4) * this.tileSize; 
            let startY = (baseY + 4) * this.tileSize;
            this.registry.set('crewState', [
                { id: 1, scene: 'MainBase', x: startX, y: startY, color: 0x0ea5e9 },
                { id: 2, scene: 'MainBase', x: startX + 40, y: startY, color: 0xf59e0b },
                { id: 3, scene: 'MainBase', x: startX, y: startY + 40, color: 0x10b981 },
                { id: 4, scene: 'MainBase', x: startX + 40, y: startY + 40, color: 0xa855f7 }
            ]);
            this.registry.set('activeAstroId', 1);
        }

        // Якщо ми повернулися з іншої сцени і передали activeId
        if (this.scene.settings.data && this.scene.settings.data.activeId) {
            this.registry.set('activeAstroId', this.scene.settings.data.activeId);
        }
        
        this.activeAstroId = this.registry.get('activeAstroId');
        this.astronauts = [];
        this.crewGroup = this.physics.add.group(); // Група для колізій (щоб не накладались)

        // Читаємо глобальний стан і створюємо ТІЛЬКИ тих, хто на вулиці ('MainBase')
        const crewState = this.registry.get('crewState');
        crewState.forEach(data => {
            if (data.scene === 'MainBase') {
                const astro = new Astronaut(this, data.x, data.y, data.color, data.id);
                astro.body.setCollideWorldBounds(true);
                astro.body.setBounce(0.2); // Легке відштовхування
                this.crewGroup.add(astro);
                this.astronauts.push(astro);
            }
        });

        // Вмикаємо фізику відштовхування між астронавтами
        this.physics.add.collider(this.crewGroup, this.crewGroup);

        this.getActiveAstro = () => this.astronauts.find(a => a.id === this.activeAstroId);

        const activeSprite = this.getActiveAstro();
        this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);
        if (activeSprite) {
            this.cameras.main.startFollow(activeSprite, true, 0.1, 0.1);
        }

        // Функція збереження поточних координат перед виходом
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

        // 🚪 Двері
        // 🚪 Двері
        this.door = this.add.rectangle(doorGridX * this.tileSize, doorGridY * this.tileSize, 32, 32, 0x00ff00).setOrigin(0, 0);
        this.door.setInteractive();
        this.door.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation(); 
            const spot = this.getBestInteractionSpot(doorGridX, doorGridY);
            if (spot) {
                this.walkTo(spot.x * this.tileSize, spot.y * this.tileSize, () => {
                    this.saveCrewState();
                    
                    const state = this.registry.get('crewState');
                    const idx = state.findIndex(s => s.id === this.activeAstroId);
                    state[idx].scene = 'LandingModule'; 
                    // НОВІ КООРДИНАТИ: Рівно по центру модуля (x: 50) і рівно перед дверима (y: 54)
                    state[idx].x = 50 * 32; 
                    state[idx].y = 54 * 32;
                    this.registry.set('crewState', state);

                    window.dispatchEvent(new CustomEvent('UPDATE_ASTRO_LOCATION', { detail: { id: this.activeAstroId, location: 'LandingModule' } }));
                    this.scene.start('LandingModule', { activeId: this.activeAstroId }); 
                });
            }
        });

        // ☀️ Сонячна панель
        this.solarPanel = this.add.rectangle(solarGridX * this.tileSize, solarGridY * this.tileSize, 32, 32, 0xffd700).setOrigin(0, 0);
        this.solarPanel.setInteractive();
        const makePanelDirty = () => { if (this.solarPanel) this.solarPanel.setFillStyle(0x705d42); };
        window.addEventListener('DIRTY_SOLAR_PANEL', makePanelDirty);
        
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

        // Перемикання астронавта (З переходом між сценами!)
        const handleSwitchAstro = (e) => {
            const targetId = e.detail;
            this.saveCrewState(); // Зберегти всіх поточних перед перемиканням
            
            const state = this.registry.get('crewState');
            const targetData = state.find(s => s.id === targetId);

            if (targetData && targetData.scene !== 'MainBase') {
                // Якщо обраний астронавт у будівлі - перемикаємо сцену!
                this.scene.start(targetData.scene, { activeId: targetId });
            } else {
                // Якщо він тут, на вулиці - просто переводимо камеру
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
            window.removeEventListener('DIRTY_SOLAR_PANEL', makePanelDirty);
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

        // --- ДОДАЙТЕ ЦЕЙ БЛОК: МИТТЄВА ДІЯ, ЯКЩО ВЖЕ СТОЇМО НА МІСЦІ ---
        if (fromGridX === toGridX && fromGridY === toGridY) {
            activeAstro.isMoving = false;
            if (onArrivalAction) onArrivalAction();
            return;
        }

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