import BuildingScene, { BUILDING_ROOM } from './BuildingScene';

// УКРИТТЯ — окрема будівля. Єдине місце, де можна сховатися від втрати здоров'я під час SEP.
// Тут також відновлюється скафандр і лікуються астронавти (логіка в Interface.jsx, location === 'Shelter').
export default class ShelterBuilding extends BuildingScene {
    constructor() {
        super('Shelter', {
            bgColor: '#04100c',
            floorColor: 0x065f46,
            wallColor: 0x022c22,
            title: 'SHELTER — SAFE DURING STORMS',
            titleColor: '#10b981',
            returnTile: { x: 46, y: 79 } // на поверхні під дверима укриття
        });
    }

    bunkTiles() {
        return [2, 5, 9, 12].map(dx => ({ x: BUILDING_ROOM.x + dx, y: BUILDING_ROOM.y + 1 }));
    }

    getObstacles() {
        return this.bunkTiles();
    }

    buildInterior() {
        const ts = this.tileSize;
        this.bunkTiles().forEach(t => {
            this.add.rectangle(t.x * ts, t.y * ts, ts, ts, 0x10b981).setOrigin(0, 0).setDepth(1);
            this.add.rectangle(t.x * ts + 4, t.y * ts + 4, ts - 8, 12, 0xd1fae5).setOrigin(0, 0).setDepth(2);
        });
    }
}
