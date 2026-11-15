import BuildingScene, { BUILDING_ROOM } from './BuildingScene';
import { deliverRegolith } from '../utils/deliverRegolith';

// Лабораторія H2O / O2: тут теж можна здати зібраний ґрунт (як і на складі на поверхні).
export default class WaterProcessingBuilding extends BuildingScene {
    constructor() {
        super('WaterProcessingBuilding', {
            bgColor: '#0a0a12',
            floorColor: 0x2563eb,
            wallColor: 0x1e293b,
            title: 'H2O & O2 PROCESSING FACILITY',
            titleColor: '#3b82f6',
            returnTile: { x: 38, y: 71 }
        });
    }

    getObstacles() {
        return [{ x: BUILDING_ROOM.x + 4, y: BUILDING_ROOM.y + 3 }];
    }

    buildInterior() {
        const ts = this.tileSize;
        const px = BUILDING_ROOM.x + 4;
        const py = BUILDING_ROOM.y + 3;

        this.processor = this.add.rectangle(px * ts, py * ts, ts, ts, 0x38bdf8).setOrigin(0, 0);
        this.processor.setInteractive();
        this.add.text(px * ts, (py - 1) * ts, 'RECYCLER', {
            fontSize: '8px', fill: '#38bdf8', fontFamily: '"Press Start 2P", monospace'
        });

        this.processor.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
            const astroId = this.activeAstroId;
            const spot = this.getBestInteractionSpot(px, py);
            if (!spot) return;
            this.walkTo(spot.x * ts, spot.y * ts, () => deliverRegolith(this, astroId));
        });
    }
}
