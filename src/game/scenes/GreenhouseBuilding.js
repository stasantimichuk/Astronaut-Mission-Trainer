import BuildingScene, { BUILDING_ROOM } from './BuildingScene';

// Теплиця. Живлення/вода/ріст рахуються в Interface.jsx (спільний ігровий час).
// Щоб урожай потрапив на склад бази, астронавт має ПРАЦЮВАТИ біля грядок.
export default class GreenhouseBuilding extends BuildingScene {
    constructor() {
        super('Greenhouse', {
            bgColor: '#06120a',
            floorColor: 0x14532d,
            wallColor: 0x052e16,
            title: 'GREENHOUSE',
            titleColor: '#22c55e',
            returnTile: { x: 58, y: 51 } // під дверима теплиці на поверхні
        });
    }

    getPlanterRows() {
        return [
            { x: BUILDING_ROOM.x + 4, y: BUILDING_ROOM.y + 3, w: 7 },
            { x: BUILDING_ROOM.x + 4, y: BUILDING_ROOM.y + 7, w: 7 }
        ];
    }

    getObstacles() {
        const tiles = [];
        this.getPlanterRows().forEach(p => {
            for (let i = 0; i < p.w; i++) tiles.push({ x: p.x + i, y: p.y });
        });
        return tiles;
    }

    // Зупинити роботу активного астронавта (він пішов кудись чи почав іншу команду)
    onMoveCommand() {
        const sim = window.gameSim || {};
        if ((sim.workingIds || []).includes(this.activeAstroId)) {
            window.dispatchEvent(new CustomEvent('ASTRO_WORK', { detail: { id: this.activeAstroId, working: false } }));
        }
    }

    buildInterior() {
        const ts = this.tileSize;
        this.planters = [];

        this.getPlanterRows().forEach(p => {
            const rect = this.add.rectangle(p.x * ts, p.y * ts, p.w * ts, ts, 0x5b3a1e).setOrigin(0, 0);
            rect.setInteractive();
            this.planters.push(rect);

            const midX = p.x + Math.floor(p.w / 2);
            rect.on('pointerdown', (pointer, localX, localY, event) => {
                event.stopPropagation();
                const astroId = this.activeAstroId;
                const spot = this.getBestInteractionSpot(midX, p.y);
                if (!spot) return;
                this.walkTo(spot.x * ts, spot.y * ts, () => {
                    window.dispatchEvent(new CustomEvent('ASTRO_WORK', {
                        detail: { id: astroId, working: true, place: 'Greenhouse' }
                    }));
                });
            });
        });

        const r = BUILDING_ROOM;
        this.statusText = this.add.text((r.x + r.width / 2) * ts, (r.y + 1) * ts, '', {
            fontSize: '8px', fill: '#86efac', fontFamily: '"Press Start 2P", monospace', align: 'center', lineSpacing: 6
        }).setOrigin(0.5, 0);

        this.add.text((r.x + 4) * ts, (r.y + 2) * ts + 8, 'КЛІКНІТЬ НА ГРЯДКУ, ЩОБ ПРАЦЮВАТИ', {
            fontSize: '7px', fill: '#4ade80', fontFamily: '"Press Start 2P", monospace'
        });

        this.refreshStatus();
        this.time.addEvent({ delay: 500, loop: true, callback: this.refreshStatus, callbackScope: this });
    }

    refreshStatus() {
        const sim = window.gameSim || {};
        const gh = sim.greenhouse || { growth: 0, ready: 0, workProgress: 0, powered: true };
        const workers = (sim.workingIds || []).length;

        const lines = [
            gh.powered ? `РІСТ: ${Math.round(gh.growth)}%` : 'НЕМАЄ ЕНЕРГІЇ АБО ВОДИ!',
            `УРОЖАЙ ГОТОВИЙ: ${gh.ready}`,
            `ПРАЦЮЮТЬ: ${workers}  ЗБІР: ${Math.round(gh.workProgress)}%`
        ];
        this.statusText.setText(lines.join('\n'));

        const color = gh.ready > 0 ? 0x22c55e : (gh.growth > 0 ? 0x4d7c0f : 0x5b3a1e);
        this.planters.forEach(p => p.setFillStyle(color));
    }
}
