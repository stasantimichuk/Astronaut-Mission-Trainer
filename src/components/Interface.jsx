import { useState, useEffect, useRef } from 'react';
import CrewPanel from './CrewPanel';
import { SpaceEventsManager, EVENT_CONFIG } from '../game/events/SpaceEvents';

// --- ІГРОВІ КОНСТАНТИ ---
const MAX_STORAGE = 1000;

const GREENHOUSE = {
    cycleTicks: 24,          // період росту: 24 тіки = 4 ігрові години
    yieldPerCycle: 30,       // скільки їжі дає один цикл
    maxReady: 90,            // скільки урожаю може чекати на збір
    workTicks: 3,            // скільки тіків працює ОДИН астронавт, щоб зібрати урожай
    energyTick: 15 / 144,    // споживання електрики за тік
    waterTick: 10 / 144      // споживання води за тік
};

// Локації, де екіпаж захищений і живиться від бази (поверхня = 'MainBase' поза укриттям — НЕ захищена)
const CONNECTED_BUILDINGS = ['LandingModule', 'WaterProcessingBuilding', 'Greenhouse'];

export default function Interface() {
    const [gameState, setGameState] = useState('menu');
    const [showMenuButtons, setShowMenuButtons] = useState(false);
    const [day, setDay] = useState(1);
    const [gameTime, setGameTime] = useState(480); // 08:00

    // --- РЕСУРСИ БАЗИ (зберігаємо дробові значення, округляємо тільки при показі) ---
    const [resources, setResources] = useState({
        energy: 1000,
        oxygen: 1000,
        water: 1000,
        food: 1000,
        materials: 0,
        science: 0,
        shield: 100
    });

    const [systems, setSystems] = useState({ greenhouseActive: true, solarPanelDirty: false });
    const [greenhouse, setGreenhouse] = useState({ growth: 0, ready: 0, workProgress: 0, powered: true });
    const [activeEvent, setActiveEvent] = useState(null); // { type, ticksLeft }
    const [log, setLog] = useState("СИСТЕМА: База працює в штатному режимі.");

    // Список членів екіпажу. location: 'MainBase' = поверхня (відкритий простір)
    const [crew, setCrew] = useState([
        { id: 1, name: "Командир", role: "PILOT", hp: 100, oxygen: 100, food: 100, water: 100, suit: 100, energy: 100, inventory: 0, active: true, color: '#0ea5e9', location: 'MainBase', isMoving: false, inShelter: false, workingAt: null },
        { id: 2, name: "Інженер", role: "ENGIN", hp: 100, oxygen: 100, food: 100, water: 100, suit: 100, energy: 100, inventory: 0, active: false, color: '#f59e0b', location: 'MainBase', isMoving: false, inShelter: false, workingAt: null },
        { id: 3, name: "Медик", role: "MEDIC", hp: 100, oxygen: 100, food: 100, water: 100, suit: 100, energy: 100, inventory: 0, active: false, color: '#10b981', location: 'MainBase', isMoving: false, inShelter: false, workingAt: null },
        { id: 4, name: "Вчений", role: "SCIEN", hp: 100, oxygen: 100, food: 100, water: 100, suit: 100, energy: 100, inventory: 0, active: false, color: '#a855f7', location: 'MainBase', isMoving: false, inShelter: false, workingAt: null }
    ]);

    const [timeScale, setTimeScale] = useState(1);

    const crewRef = useRef(crew);
    const resRef = useRef(resources);
    const sysRef = useRef(systems);
    const ghRef = useRef(greenhouse);
    const eventsRef = useRef(new SpaceEventsManager());
    useEffect(() => { crewRef.current = crew; }, [crew]);
    useEffect(() => { resRef.current = resources; }, [resources]);
    useEffect(() => { sysRef.current = systems; }, [systems]);
    useEffect(() => { ghRef.current = greenhouse; }, [greenhouse]);

    useEffect(() => { window.currentGameTimeScale = timeScale; }, [timeScale]);

    // Стан симуляції для Phaser-сцен (читається напряму): сповільнення, пил на панелях, загиблі, робота в теплиці
    useEffect(() => {
        window.gameSim = {
            speedMultiplier: activeEvent ? (EVENT_CONFIG[activeEvent.type].speedMultiplier ?? 1) : 1,
            solarDirty: systems.solarPanelDirty,
            eventType: activeEvent ? activeEvent.type : null,
            deadIds: crew.filter(c => c.hp <= 0).map(c => c.id),
            workingIds: crew.filter(c => c.workingAt).map(c => c.id),
            greenhouse
        };
    }, [activeEvent, systems, crew, greenhouse]);

    // --- ІВЕНТИ ---
    const beginEvent = (type) => {
        const events = eventsRef.current;
        if (events.active) {
            setLog(`СИСТЕМА: Івент ${events.active} вже триває.`);
            return;
        }
        const cfg = events.start(type);
        if (!cfg) return;
        setActiveEvent({ type, ticksLeft: events.ticksLeft });
        if (cfg.dustsSolarPanels) {
            setSystems(s => ({ ...s, solarPanelDirty: true }));
            window.dispatchEvent(new CustomEvent('DIRTY_SOLAR_PANEL'));
        }
        setLog(cfg.startMessage);
    };

    // --- ГОЛОВНИЙ ІГРОВИЙ ЦИКЛ ---
    useEffect(() => {
        if (timeScale === 0 || gameState !== 'playing') return;

        const intervalMs = 5000 / timeScale;

        const timer = setInterval(() => {
            let currentCrew = [...crewRef.current];
            let currentRes = { ...resRef.current };
            const currentSys = sysRef.current;
            const gh = { ...ghRef.current };
            const events = eventsRef.current;
            let message = null;

            // 0. Випадковий івент (вимкнено за замовчуванням: EVENT_CONFIG.RANDOM.enabled)
            if (!events.active && EVENT_CONFIG.RANDOM.enabled && Math.random() < EVENT_CONFIG.RANDOM.chancePerTick) {
                beginEvent(events.pickRandom());
            }
            events.beginTick();

            // 1. ЕНЕРГІЯ БАЗИ (сонячні панелі під пилом/зламані = 0 генерації)
            const greenhousePowered = currentSys.greenhouseActive && currentRes.energy > 0 && currentRes.water > 0;
            const Ebase_tick = 15 / 144;
            const Ehabitat_tick = 20 / 144;
            const Egreenhouse_tick = greenhousePowered ? GREENHOUSE.energyTick : 0;
            const solarEfficiency = currentSys.solarPanelDirty ? 0 : 1.0;
            const Esolar_tick = (50 / 144) * solarEfficiency;

            const Ecost_tick = (Ebase_tick + Ehabitat_tick + Egreenhouse_tick) - Esolar_tick;
            currentRes.energy = Math.min(MAX_STORAGE, Math.max(0, currentRes.energy - Ecost_tick));
            if (currentRes.energy <= 0) message = "🔴 БЛЕКАУТ! Рециркуляція зупинена.";

            // 2. ВИТРАТИ БАЗИ: тільки на тих, хто всередині будівель/укриття
            const isProtected = (c) => CONNECTED_BUILDINGS.includes(c.location) || (c.location === 'MainBase' && c.inShelter);
            const connectedCrewCount = currentCrew.filter(isProtected).length;
            const outsideCrewCount = currentCrew.length - connectedCrewCount;

            const Lcrew_tick = (10 / 144) * connectedCrewCount;
            const LevaTotal_tick = (15 / 144) * outsideCrewCount;
            const Lrecycling_tick = currentRes.energy > 0 ? (12 / 144) : 0;
            const Lcost_tick = (Lcrew_tick + LevaTotal_tick) - Lrecycling_tick;
            const Wgreenhouse_tick = greenhousePowered ? GREENHOUSE.waterTick : 0;

            currentRes.oxygen = Math.min(MAX_STORAGE, Math.max(0, currentRes.oxygen - Lcost_tick));
            currentRes.water = Math.min(MAX_STORAGE, Math.max(0, currentRes.water - Lcost_tick - Wgreenhouse_tick));

            const FoodCost_tick = (connectedCrewCount * 2) / 144;
            currentRes.food = Math.max(0, currentRes.food - FoodCost_tick);

            // 3. ТЕПЛИЦЯ: ріст (споживає енергію і воду) -> урожай чекає на збір
            gh.powered = greenhousePowered;
            if (greenhousePowered && gh.ready < GREENHOUSE.maxReady) {
                gh.growth += 100 / GREENHOUSE.cycleTicks;
                if (gh.growth >= 100) {
                    gh.growth = 0;
                    gh.ready = Math.min(GREENHOUSE.maxReady, gh.ready + GREENHOUSE.yieldPerCycle);
                    message = `🌱 Теплиця: урожай дозрів (${gh.ready}). Потрібен астронавт для збору!`;
                }
            }

            // Збір урожаю: їжа потрапляє на склад бази лише коли астронавт(и) ПРАЦЮЮТЬ у теплиці
            const workers = currentCrew.filter(c => c.workingAt === 'Greenhouse' && c.location === 'Greenhouse' && c.hp > 0);
            if (workers.length > 0 && gh.ready > 0) {
                gh.workProgress += (100 / GREENHOUSE.workTicks) * workers.length;
                if (gh.workProgress >= 100) {
                    currentRes.food += gh.ready;
                    message = `🥬 Теплиця: зібрано врожай, +${gh.ready} їжі на склад бази.`;
                    gh.ready = 0;
                    gh.workProgress = 0;
                }
            }

            // 4. ПАРАМЕТРИ ЕКІПАЖУ
            currentCrew = currentCrew.map(astro => {
                let { hp, oxygen, food, water, suit, energy, location, isMoving, active, workingAt, inShelter } = astro;
                const actualMoving = active ? isMoving : false;
                const moveDrain = actualMoving ? 2 : 1;
                const onSurface = location === 'MainBase';

                if (onSurface && !inShelter) {
                    // 🔴 ВІДКРИТИЙ КОСМОС: агресивні витрати, псується скафандр, діють івенти
                    oxygen = Math.max(0, oxygen - moveDrain);
                    suit = Math.max(0, suit - (actualMoving ? 2 : 1));
                    energy = Math.max(0, energy - moveDrain);
                    water = Math.max(0, water - moveDrain);
                    food = Math.max(0, food - moveDrain);

                    if (events.active && hp > 0) {
                        ({ hp, suit } = events.applyExposure({ hp, suit }));
                    }
                } else if (isProtected(astro)) {
                    // 🟢 БУДІВЛЯ / УКРИТТЯ: поповнення з ресурсів бази
                    const takeO2 = Math.min(100 - oxygen, 10, currentRes.oxygen);
                    oxygen += takeO2;
                    currentRes.oxygen -= takeO2;

                    const takeWater = Math.min(100 - water, 10, currentRes.water);
                    water += takeWater;
                    currentRes.water -= takeWater;

                    const takeFood = Math.min(100 - food, 10, currentRes.food);
                    food += takeFood;
                    currentRes.food -= takeFood;

                    const takeEnergy = Math.min(100 - energy, 10, currentRes.energy);
                    energy += takeEnergy;
                    currentRes.energy -= takeEnergy;

                    if (currentRes.oxygen <= 0) oxygen = Math.max(0, oxygen - 1);
                    if (currentRes.water <= 0) water = Math.max(0, water - 1);
                    if (currentRes.food <= 0) food = Math.max(0, food - 1);

                    if (onSurface && inShelter) {
                        // Укриття ремонтує скафандр і лікує
                        suit = 100;
                        hp = Math.min(100, hp + 5);
                    }
                }

                if (oxygen <= 0 || food <= 0 || water <= 0 || energy <= 0) {
                    hp = Math.max(0, hp - 5);
                }
                if (hp <= 0) workingAt = null;

                return {
                    ...astro, hp, workingAt,
                    oxygen: Math.round(oxygen), food: Math.round(food), water: Math.round(water),
                    suit, energy: Math.round(energy)
                };
            });

            // 5. Завершення івенту
            const finished = events.endTick();
            if (finished) {
                message = `✅ Івент ${finished} завершено.${finished === 'CME' && sysRef.current.solarPanelDirty ? ' Очистіть сонячні панелі від пилу!' : ''}`;
                setActiveEvent(null);
            } else if (events.active) {
                setActiveEvent({ type: events.active, ticksLeft: events.ticksLeft });
            }

            setCrew(currentCrew);
            setResources(currentRes);
            setGreenhouse(gh);
            if (message) setLog(message);

            setGameTime(prevTime => {
                const newTime = prevTime + 10;
                if (newTime >= 1440) { endDay(); return 480; }
                return newTime;
            });

        }, intervalMs);

        return () => clearInterval(timer);
    }, [timeScale, gameState]);

    // --- СЛУХАЧІ ПОДІЙ З PHASER ---
    useEffect(() => {
        const handleLocationUpdate = (e) => {
            const { id, location } = e.detail;
            // Зміна локації скидає роботу та статус «в укритті»
            setCrew(prev => prev.map(c => c.id === id ? { ...c, location, workingAt: null, inShelter: false } : c));
        };
        const handleMovementUpdate = (e) => {
            const { id, isMoving } = e.detail;
            setCrew(prev => prev.map(c => c.id === id ? { ...c, isMoving } : c));
        };
        const handleInventoryUpdate = (e) => {
            const updatedAstro = e.detail;
            setCrew(prev => prev.map(c => c.id === updatedAstro.id ? { ...c, inventory: updatedAstro.inventory } : c));
        };
        const handleProcessRegolith = (e) => {
            const addedUnits = e.detail.amount * 10;
            setResources(prev => ({
                ...prev,
                oxygen: Math.min(MAX_STORAGE, prev.oxygen + addedUnits),
                water: Math.min(MAX_STORAGE, prev.water + addedUnits),
                materials: prev.materials + e.detail.amount
            }));
            setLog(`СИСТЕМА: Перероблено ґрунт! Отримано +${addedUnits} води та кисню.`);
        };
        const handleShelter = (e) => {
            const { id, inShelter } = e.detail;
            setCrew(prev => prev.map(c => (c.id === id && c.inShelter !== inShelter) ? { ...c, inShelter } : c));
        };
        const handleWork = (e) => {
            const { id, working, place } = e.detail;
            setCrew(prev => prev.map(c => (c.id === id && !!c.workingAt !== !!working)
                ? { ...c, workingAt: working ? place : null } : c));
        };
        const handleCleanPanel = () => {
            if (sysRef.current.solarPanelDirty) {
                setSystems(s => ({ ...s, solarPanelDirty: false }));
                setLog("☀️ Сонячні панелі очищено від пилу. Генерація енергії відновлена.");
            }
        };
        const handleShowMenu = () => setShowMenuButtons(true);

        window.addEventListener('UPDATE_ASTRO_LOCATION', handleLocationUpdate);
        window.addEventListener('ASTRO_MOVEMENT', handleMovementUpdate);
        window.addEventListener('UPDATE_INVENTORY', handleInventoryUpdate);
        window.addEventListener('PROCESS_REGOLITH', handleProcessRegolith);
        window.addEventListener('ASTRO_SHELTER', handleShelter);
        window.addEventListener('ASTRO_WORK', handleWork);
        window.addEventListener('CLEAN_SOLAR_PANEL', handleCleanPanel);
        window.addEventListener('SHOW_MENU_BUTTONS', handleShowMenu);

        return () => {
            window.removeEventListener('UPDATE_ASTRO_LOCATION', handleLocationUpdate);
            window.removeEventListener('ASTRO_MOVEMENT', handleMovementUpdate);
            window.removeEventListener('UPDATE_INVENTORY', handleInventoryUpdate);
            window.removeEventListener('PROCESS_REGOLITH', handleProcessRegolith);
            window.removeEventListener('ASTRO_SHELTER', handleShelter);
            window.removeEventListener('ASTRO_WORK', handleWork);
            window.removeEventListener('CLEAN_SOLAR_PANEL', handleCleanPanel);
            window.removeEventListener('SHOW_MENU_BUTTONS', handleShowMenu);
        };
    }, []);

    const endDay = () => { setDay(d => d + 1); setLog(`День завершено! Очікуйте звіт.`); };

    const handleSelectAstro = (id) => {
        setCrew(crew.map(c => ({ ...c, active: c.id === id, isMoving: false })));
        window.dispatchEvent(new CustomEvent('SWITCH_ASTRO', { detail: id }));
    };

    const formatTime = (minutes) => {
        const h = Math.floor(minutes / 60) % 24;
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const PixelIcon = ({ color }) => ( <div style={{ width: '12px', height: '12px', backgroundColor: color, border: '2px solid #000', display: 'inline-block', marginRight: '6px' }} /> );
    const getTimeBtnStyle = (isActive, color) => ({ padding: '8px 12px', background: isActive ? color : '#111', color: isActive ? '#000' : color, border: `3px solid ${color}`, cursor: 'pointer', fontFamily: '"Press Start 2P", monospace', fontSize: '10px', boxShadow: isActive ? `inset 3px 3px 0px rgba(0,0,0,0.3)` : `4px 4px 0px ${color}`, outline: 'none' });
    const testBtnStyle = { padding: '8px 12px', background: '#334155', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: '"Press Start 2P", monospace', fontSize: '8px' };

    if (gameState === 'menu') {
        return (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');`}</style>
                <div style={{ opacity: showMenuButtons ? 1 : 0, transition: 'opacity 1s ease-in', pointerEvents: showMenuButtons ? 'auto' : 'none', textAlign: 'center', marginBottom: '10vh' }}>
                    <h1 style={{ color: 'white', fontSize: '36px', lineHeight: '1.5', textShadow: '4px 4px 0px #0ea5e9', margin: '0 0 60px 0', fontFamily: '"Press Start 2P", monospace' }}>
                        Astronaut<br/>Mission Trainer
                    </h1>
                    <button onClick={() => { setGameState('playing'); if (window.phaserGame) { window.phaserGame.scene.stop('MainMenu'); window.phaserGame.scene.start('MainBase'); } }}
                            style={{ padding: '20px 30px', fontSize: '18px', background: '#111', color: '#0ea5e9', border: '4px solid #0ea5e9', cursor: 'pointer', fontFamily: '"Press Start 2P", monospace', boxShadow: '6px 6px 0px #0ea5e9' }}>
                        [ START MISSION ]
                    </button>
                </div>
            </div>
        );
    }

    const ghColor = !greenhouse.powered ? '#ef4444' : (greenhouse.ready > 0 ? '#22c55e' : '#fff');

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');`}</style>

            {/* Банер активного івенту */}
            {activeEvent && (
                <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', background: '#450a0a', color: '#fecaca', border: '3px solid #ef4444', padding: '10px 16px', fontFamily: '"Press Start 2P", monospace', fontSize: '10px', textAlign: 'center', lineHeight: '1.6' }}>
                    ⚠ {activeEvent.type} — залишилось {activeEvent.ticksLeft * 10} хв
                    {activeEvent.type === 'CME' && <div style={{ color: '#fca5a5', fontSize: '8px' }}>Панелі в пилу · рух −50% · скафандр псується</div>}
                    {activeEvent.type === 'SEP' && <div style={{ color: '#fca5a5', fontSize: '8px' }}>Радіація на поверхні поза укриттям</div>}
                </div>
            )}

            {/* Панель екіпажу активна незалежно від поточної будівлі */}
            <CrewPanel crew={crew} onSelectAstro={handleSelectAstro} />

            {log && (
                <div style={{ position: 'absolute', bottom: '70px', left: '20px', background: '#050510', color: '#10b981', padding: '12px', width: '400px', fontFamily: '"Press Start 2P", monospace', fontSize: '9px', border: '2px solid #10b981', lineHeight: '1.5', pointerEvents: 'auto' }}>
                    &gt; {log}
                </div>
            )}

            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '12px 20px', background: '#050510', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: '"Press Start 2P", monospace', fontSize: '10px', borderTop: '4px solid #1e1e26', boxSizing: 'border-box', pointerEvents: 'auto' }}>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <span style={{ color: '#fff', background: '#334155', padding: '4px 8px' }}>DAY:{day}</span>
                    <span style={{ color: '#0ea5e9', background: '#1e1e26', padding: '4px 8px', border: '1px solid #334155' }}>{formatTime(gameTime)}</span>

                    <div style={{ display: 'flex', gap: '8px', marginLeft: '5px' }}>
                        <button style={getTimeBtnStyle(timeScale === 0, '#ef4444')} onClick={() => { setTimeScale(0); window.dispatchEvent(new CustomEvent('SET_TIME', { detail: 0 })); }}>[||]</button>
                        <button style={getTimeBtnStyle(timeScale === 1, '#10b981')} onClick={() => { setTimeScale(1); window.dispatchEvent(new CustomEvent('SET_TIME', { detail: 1 })); }}>[&gt;]</button>
                        <button style={getTimeBtnStyle(timeScale === 2, '#f59e0b')} onClick={() => { setTimeScale(2); window.dispatchEvent(new CustomEvent('SET_TIME', { detail: 2 })); }}>[&gt;&gt;]</button>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginLeft: '10px', borderLeft: '2px dashed #334155', paddingLeft: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#00ffff" /><span style={{ color: resources.energy <= 0 ? '#ef4444' : (systems.solarPanelDirty ? '#f59e0b' : '#fff') }}>ENG:{Math.round(resources.energy)}{systems.solarPanelDirty ? '↓' : ''}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#0ea5e9" /><span style={{ color: resources.oxygen <= 0 ? '#ef4444' : '#fff' }}>O2:{Math.round(resources.oxygen)}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#3b82f6" /><span style={{ color: resources.water <= 0 ? '#ef4444' : '#fff' }}>H2O:{Math.round(resources.water)}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#f59e0b" /><span style={{ color: resources.food <= 0 ? '#ef4444' : '#fff' }}>FOOD:{Math.round(resources.food)}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#22c55e" /><span style={{ color: ghColor }}>GH:{Math.round(greenhouse.growth)}%{greenhouse.ready > 0 ? ` +${greenhouse.ready}` : ''}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#94a3b8" /><span>MAT:{resources.materials}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#ef4444" /><span>SHLD:{resources.shield}</span></div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => beginEvent('CME')} style={testBtnStyle}>TEST CME</button>
                    <button onClick={() => beginEvent('SEP')} style={testBtnStyle}>TEST SEP</button>
                </div>
            </div>
        </div>
    );
}
