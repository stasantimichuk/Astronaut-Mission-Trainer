import { SUPPLY } from '../supply/SupplyConfig';

// ПОСАДКОВИЙ МАЙДАНЧИК — нова локація на поверхні (сцена MainBase).
// Тут приземляються посилки з замовленими матеріалами. Астронавт має піднести посилку
// (повільно!) до бази й зайти з нею в LANDING MODULE — це зараховується як доставка.
//
// Стан посилки живе в Phaser registry під ключем 'parcel', тому переживає перезапуск сцен:
//   { id, items, status: 'landed' | 'carried', x, y, carrierId }
// Коли посилка прилітає, Interface.jsx кладе її в window.gameSim.supply.landed,
// а коли посилку доставлено, цей файл шле подію SUPPLY_DELIVERED.

const TS = 32;
const PARCEL_KEY = 'parcel';
const LAST_SPAWNED_KEY = 'parcelLastSpawnedId';
const FONT = '"Press Start 2P", monospace';

// Розташування: східний край карти, далеко від бази (база ~ x45..51, y65..71)
export const LANDING_PAD = { x: 80, y: 56, w: 10, h: 7 };

const PAD_CENTER = {
    x: (LANDING_PAD.x + LANDING_PAD.w / 2) * TS,
    y: (LANDING_PAD.y + LANDING_PAD.h / 2) * TS
};

const gameLog = (message) => window.dispatchEvent(new CustomEvent('GAME_LOG', { detail: { message } }));
const getParcel = (scene) => scene.registry.get(PARCEL_KEY) || null;
const setParcel = (scene, data) => scene.registry.set(PARCEL_KEY, data);

// ---------- Сітка проходу ----------
// У проєкті 0 = прохідно, 1 = перешкода. Майданчик прохідний — астронавти ходять по ньому.
export function carveLandingPad(grid) {
    for (let y = LANDING_PAD.y; y < LANDING_PAD.y + LANDING_PAD.h; y++) {
        for (let x = LANDING_PAD.x; x < LANDING_PAD.x + LANDING_PAD.w; x++) {
            if (grid[y] && grid[y][x] !== undefined) grid[y][x] = 0;
        }
    }
}

// ---------- Малювання майданчика ----------
function drawPad(scene) {
    const { x, y, w, h } = LANDING_PAD;
    const px = x * TS, py = y * TS, pw = w * TS, ph = h * TS;
    const g = scene.add.graphics().setDepth(0.5);

    g.fillStyle(0x2b303a, 1).fillRect(px - 8, py - 8, pw + 16, ph + 16); // фундамент
    g.fillStyle(0x4b5563, 1).fillRect(px, py, pw, ph);                    // плита

    g.lineStyle(1, 0x374151, 1);                                          // шви плит
    for (let i = 1; i < w; i++) g.lineBetween(px + i * TS, py, px + i * TS, py + ph);
    for (let j = 1; j < h; j++) g.lineBetween(px, py + j * TS, px + pw, py + j * TS);

    // жовто-чорна смуга по краю
    for (let i = 0; i < w; i++) {
        g.fillStyle(i % 2 ? 0xfacc15 : 0x111827, 1);
        g.fillRect(px + i * TS, py, TS, 6);
        g.fillRect(px + i * TS, py + ph - 6, TS, 6);
    }
    for (let j = 0; j < h; j++) {
        g.fillStyle(j % 2 ? 0xfacc15 : 0x111827, 1);
        g.fillRect(px, py + j * TS, 6, TS);
        g.fillRect(px + pw - 6, py + j * TS, 6, TS);
    }

    g.lineStyle(4, 0xf59e0b, 1).strokeCircle(PAD_CENTER.x, PAD_CENTER.y, TS * 2.4); // мішень

    scene.add.text(PAD_CENTER.x, PAD_CENTER.y, 'H', {
        fontSize: '48px', fill: '#f59e0b', fontFamily: FONT
    }).setOrigin(0.5).setDepth(0.6);

    scene.add.text(PAD_CENTER.x, py - 22, 'LANDING PAD', {
        fontSize: '10px', fill: '#f59e0b', fontFamily: FONT
    }).setOrigin(0.5).setDepth(2);

    // сигнальні вогні по кутах
    const lights = [[px - 4, py - 4], [px + pw + 4, py - 4], [px - 4, py + ph + 4], [px + pw + 4, py + ph + 4]]
        .map(([lx, ly]) => scene.add.circle(lx, ly, 5, 0xef4444).setDepth(0.7));
    scene.tweens.add({ targets: lights, alpha: { from: 1, to: 0.2 }, duration: 700, yoyo: true, repeat: -1 });
}

// ---------- Посилка ----------
function ensureParcelTexture(scene) {
    if (scene.textures.exists('parcelTexture')) return;
    const tex = scene.textures.createCanvas('parcelTexture', 32, 28);
    const ctx = tex.getContext();
    ctx.fillStyle = '#7c4a1a'; ctx.fillRect(0, 0, 32, 28);
    ctx.fillStyle = '#d4a05a'; ctx.fillRect(2, 2, 28, 24);
    ctx.fillStyle = '#b8803f'; ctx.fillRect(2, 20, 28, 6);
    ctx.fillStyle = '#f5e6c8'; ctx.fillRect(14, 2, 4, 24);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(5, 7, 6, 5);
    tex.refresh();
}

function setParcelClickable(scene, clickable) {
    const obj = scene.parcelObj;
    if (!obj) return;
    if (clickable) obj.sprite.setInteractive({ useHandCursor: true });
    else obj.sprite.disableInteractive();
    obj.label.setVisible(clickable);
}

function spawnParcelObjects(scene, data, animate) {
    ensureParcelTexture(scene);
    destroyParcelObjects(scene);

    const sprite = scene.add.image(data.x, data.y, 'parcelTexture').setDepth(6);
    const label = scene.add.text(data.x, data.y - 26, 'PARCEL', {
        fontSize: '8px', fill: '#fde68a', fontFamily: FONT
    }).setOrigin(0.5).setDepth(7);
    scene.parcelObj = { sprite, label };

    sprite.on('pointerdown', (pointer, localX, localY, event) => {
        event.stopPropagation();
        onParcelClicked(scene);
    });

    if (data.status === 'carried') {
        setParcelClickable(scene, false);
        return;
    }

    if (animate) {
        // посадка: посилка падає зверху
        sprite.setPosition(data.x, data.y - 500).setAlpha(0);
        label.setVisible(false);
        scene.tweens.add({
            targets: sprite, y: data.y, alpha: 1, duration: 1400, ease: 'Bounce.easeOut',
            onComplete: () => {
                if (!scene.parcelObj || scene.parcelObj.sprite !== sprite) return;
                const ring = scene.add.circle(data.x, data.y, 10, 0xffffff, 0.5).setDepth(5);
                scene.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
                const cur = getParcel(scene);
                setParcelClickable(scene, !!cur && cur.status === 'landed');
            }
        });
    } else {
        setParcelClickable(scene, true);
    }
}

function destroyParcelObjects(scene) {
    if (!scene.parcelObj) return;
    scene.parcelObj.sprite.destroy();
    scene.parcelObj.label.destroy();
    scene.parcelObj = null;
}

// Посилка прилетіла (Interface.jsx поклав її в gameSim.supply.landed) — створюємо на майданчику
function syncArrival(scene) {
    const sim = window.gameSim;
    const landed = sim && sim.supply && sim.supply.landed;
    if (!landed) return;
    if (scene.registry.get(LAST_SPAWNED_KEY) === landed.id) return;

    scene.registry.set(LAST_SPAWNED_KEY, landed.id);
    const data = { id: landed.id, items: landed.items, status: 'landed', x: PAD_CENTER.x, y: PAD_CENTER.y, carrierId: null };
    setParcel(scene, data);
    spawnParcelObjects(scene, data, true);
}

function onParcelClicked(scene) {
    const data = getParcel(scene);
    if (!data || data.status !== 'landed') return;
    const astroId = scene.activeAstroId;
    if (((window.gameSim && window.gameSim.deadIds) || []).includes(astroId)) return;

    // підходимо до посилки, на місці — беремо
    scene.walkTo(data.x, data.y, () => pickUpParcel(scene, astroId));
}

function pickUpParcel(scene, astroId) {
    const data = getParcel(scene);
    if (!data || data.status !== 'landed') return;
    if (!scene.astronauts.some(a => a.id === astroId)) return;

    setParcel(scene, { ...data, status: 'carried', carrierId: astroId });
    setParcelClickable(scene, false);
    gameLog('📦 Parcel picked up. It is heavy, so you move very slowly — carry it to the base and walk into the LANDING MODULE.');
}

function dropParcel(scene, atX, atY, reason) {
    const data = getParcel(scene);
    if (!data) return;
    setParcel(scene, { ...data, status: 'landed', carrierId: null, x: atX, y: atY });
    if (scene.parcelObj) {
        scene.parcelObj.sprite.setPosition(atX, atY);
        scene.parcelObj.label.setPosition(atX, atY - 26);
        setParcelClickable(scene, true);
    }
    gameLog(reason);
}

// ---------- Публічне API для MainBase ----------

// Малює майданчик і відновлює посилку з registry (після повернення з будівлі)
export function createLandingPad(scene) {
    drawPad(scene);
    scene.parcelObj = null;
    const data = getParcel(scene);
    if (data) spawnParcelObjects(scene, data, false);
    syncArrival(scene);
}

export function updateLandingPad(scene) {
    syncArrival(scene);

    const data = getParcel(scene);
    if (!data || !scene.parcelObj || data.status !== 'carried') return;

    const carrier = scene.astronauts.find(a => a.id === data.carrierId);
    const dead = (window.gameSim && window.gameSim.deadIds) || [];

    if (!carrier || dead.includes(data.carrierId)) {
        dropParcel(scene, carrier ? carrier.x + 16 : data.x, carrier ? carrier.y + 16 : data.y,
            '⚠️ The astronaut died — the parcel stays where it is.');
        return;
    }

    const dir = carrier.flipX ? -1 : 1;
    scene.parcelObj.sprite.setPosition(carrier.x + 16 + dir * 8, carrier.y + 12);
    data.x = carrier.x + 16; // запам'ятовуємо позицію (на випадок падіння)
    data.y = carrier.y + 16;
}

// Множник швидкості: з посилкою астронавт іде повільно
export function getCarrySlowdown(scene, astroId) {
    const data = getParcel(scene);
    return data && data.status === 'carried' && data.carrierId === astroId ? SUPPLY.carrySpeedMultiplier : 1;
}

// Викликати перед входом у будівлю. true — можна заходити.
// Вхід у LANDING MODULE з посилкою = доставка; в інші будівлі з посилкою не пускає.
export function canEnterWithParcel(scene, astroId, targetScene) {
    const data = getParcel(scene);
    if (!data || data.status !== 'carried' || data.carrierId !== astroId) return true;

    if (targetScene === 'Shelter') {
        // у укриття з вантажем не зайти — залишаємо посилку біля входу
        const carrier = scene.astronauts.find(a => a.id === astroId);
        dropParcel(scene, carrier ? carrier.x + 16 : data.x, carrier ? carrier.y + 16 : data.y,
            '📦 Parcel left outside the shelter door.');
        return true;
    }

    if (targetScene !== 'LandingModule') {
        gameLog('📦 With the parcel you can only enter the LANDING MODULE (or the shelter, but the parcel stays at the door).');
        return false;
    }

    setParcel(scene, null);
    destroyParcelObjects(scene);
    window.dispatchEvent(new CustomEvent('SUPPLY_DELIVERED', { detail: { id: data.id } }));
    return true;
}
