import { useState, useEffect, useRef } from 'react';
import CrewPanel from './CrewPanel'; 

export default function Interface() {
    const [gameState, setGameState] = useState('menu'); 
    const [showMenuButtons, setShowMenuButtons] = useState(false);
    const [day, setDay] = useState(1);
    const [gameTime, setGameTime] = useState(480); // 08:00
    
    // --- РЕСУРСИ БАЗИ (Відновлені до 1000, щоб їх вистачило на день) ---
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
    const [inventory, setInventory] = useState({ regolith: 0, tools: 0 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [log, setLog] = useState("СИСТЕМА: База працює в штатному режимі.");

    const [crew, setCrew] = useState([
        { id: 1, name: "Командир", role: "PILOT", hp: 100, oxygen: 100, food: 100, water: 100, suit: 100, energy: 100, inventory: 0, active: true, color: '#0ea5e9', location: 'MainBase', isMoving: false },
        { id: 2, name: "Інженер", role: "ENGIN", hp: 100, oxygen: 100, food: 100, water: 100, suit: 100, energy: 100, inventory: 0, active: false, color: '#f59e0b', location: 'MainBase', isMoving: false },
        { id: 3, name: "Медик", role: "MEDIC", hp: 100, oxygen: 100, food: 100, water: 100, suit: 100, energy: 100, inventory: 0, active: false, color: '#10b981', location: 'MainBase', isMoving: false },
        { id: 4, name: "Вчений", role: "SCIEN", hp: 100, oxygen: 100, food: 100, water: 100, suit: 100, energy: 100, inventory: 0, active: false, color: '#a855f7', location: 'MainBase', isMoving: false }
    ]);

    const [timeScale, setTimeScale] = useState(1); 

    const crewRef = useRef(crew);
    const resRef = useRef(resources);
    const sysRef = useRef(systems);
    useEffect(() => { crewRef.current = crew; }, [crew]);
    useEffect(() => { resRef.current = resources; }, [resources]);
    useEffect(() => { sysRef.current = systems; }, [systems]);

    useEffect(() => { window.currentGameTimeScale = timeScale; }, [timeScale]);

    // --- ГОЛОВНИЙ ІГРОВИЙ ЦИКЛ ---
    useEffect(() => {
        if (timeScale === 0 || gameState !== 'playing') return;

        const intervalMs = 5000 / timeScale; 

        const timer = setInterval(() => {
            let currentCrew = [...crewRef.current];
            let currentRes = { ...resRef.current };
            const currentSys = sysRef.current;

            // 1. РОЗРАХУНОК ЕНЕРГІЇ БАЗИ
            const Ebase_tick = 15 / 144;
            const Ehabitat_tick = 20 / 144;
            const Egreenhouse_tick = currentSys.greenhouseActive ? (15 / 144) : 0;
            const solarEfficiency = currentSys.solarPanelDirty ? 0.2 : 1.0;
            const Esolar_tick = (50 / 144) * solarEfficiency; 
            
            const Ecost_tick = (Ebase_tick + Ehabitat_tick + Egreenhouse_tick) - Esolar_tick;
            currentRes.energy = Math.max(0, currentRes.energy - Ecost_tick);

            // 2. РОЗРАХУНОК ВИТРАТ БАЗИ
            // База витрачає ресурси тільки на тих, хто підключений до неї.
            // В майбутньому сюди додамо 'Habitat', 'Greenhouse' тощо.
            const connectedBuildings = ['LandingModule']; 
            
            const connectedCrewCount = currentCrew.filter(c => connectedBuildings.includes(c.location)).length;
            const outsideCrewCount = currentCrew.length - connectedCrewCount;

            const Lcrew_tick = (10 / 144) * connectedCrewCount; // База годує тільки тих, хто всередині підключених модулів
            const LevaTotal_tick = (15 / 144) * outsideCrewCount;
            const Lrecycling_tick = currentRes.energy > 0 ? (12 / 144) : 0; 
            
            const Lcost_tick = (Lcrew_tick + LevaTotal_tick) - Lrecycling_tick;
            
            currentRes.oxygen = Math.max(0, currentRes.oxygen - Lcost_tick);
            currentRes.water = Math.max(0, currentRes.water - Lcost_tick);
            
            const FoodCost_tick = (connectedCrewCount * 2) / 144; 
            currentRes.food = Math.max(0, currentRes.food - FoodCost_tick);

            if (currentRes.energy === 0) setLog("🔴 БЛЕКАУТ! Рециркуляція зупинена.");

            // 3. ПЕРЕДАЧА РЕСУРСІВ ЕКІПАЖУ ТА ЇХ ВИТРАТИ
            currentCrew = currentCrew.map(astro => {
                let { hp, oxygen, food, water, suit, energy, location, isMoving, active } = astro;
                const actualMoving = active ? isMoving : false;
                const moveDrain = actualMoving ? 2 : 1; 

                if (location === 'MainBase') {
                    // 🔴 НА ВУЛИЦІ (Агресивні витрати, псується скафандр)
                    oxygen = Math.max(0, oxygen - moveDrain);
                    suit = Math.max(0, suit - (actualMoving ? 2 : 1));
                    energy = Math.max(0, energy - moveDrain);
                    water = Math.max(0, water - moveDrain);
                    food = Math.max(0, food - moveDrain);
                } else if (connectedBuildings.includes(location)) {
                    // 🟢 ПІДКЛЮЧЕНА БУДІВЛЯ (Поповнення з бази)
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
                } else {
                    // 🟡 НЕПІДКЛЮЧЕНА БУДІВЛЯ (Склад, печера, порожній модуль)
                    // Скафандр не псується (бо є дах над головою), але дихають власним киснем!
                    oxygen = Math.max(0, oxygen - moveDrain);
                    energy = Math.max(0, energy - moveDrain);
                    water = Math.max(0, water - moveDrain);
                    food = Math.max(0, food - moveDrain);
                }

                if (oxygen === 0 || food === 0 || water === 0 || energy === 0) {
                    hp = Math.max(0, hp - 5);
                }

                return { ...astro, hp, oxygen: Math.round(oxygen), food: Math.round(food), water: Math.round(water), suit, energy: Math.round(energy) };
            });

            setCrew(currentCrew);
            setResources({
                ...currentRes,
                energy: Math.round(currentRes.energy),
                oxygen: Math.round(currentRes.oxygen),
                water: Math.round(currentRes.water),
                food: Math.round(currentRes.food)
            });

            setGameTime(prevTime => {
                const newTime = prevTime + 10;
                if (newTime >= 1440) { endDay(); return 480; }
                return newTime;
            });

        }, intervalMs);

        return () => clearInterval(timer);
    }, [timeScale, gameState]);
    
    // ТРЕКІНГ ЛОКАЦІЙ ТА РУХУ
    useEffect(() => {
        const handleLocationUpdate = (e) => {
            const { id, location } = e.detail;
            setCrew(prev => prev.map(c => c.id === id ? { ...c, location } : c));
        };
        const handleMovementUpdate = (e) => {
            const { id, isMoving } = e.detail;
            setCrew(prev => prev.map(c => c.id === id ? { ...c, isMoving } : c));
        };
        
        window.addEventListener('UPDATE_ASTRO_LOCATION', handleLocationUpdate);
        window.addEventListener('ASTRO_MOVEMENT', handleMovementUpdate);
        
        const handleShowMenu = () => setShowMenuButtons(true);
        window.addEventListener('SHOW_MENU_BUTTONS', handleShowMenu);
        
        return () => {
            window.removeEventListener('UPDATE_ASTRO_LOCATION', handleLocationUpdate);
            window.removeEventListener('ASTRO_MOVEMENT', handleMovementUpdate);
            window.removeEventListener('SHOW_MENU_BUTTONS', handleShowMenu);
        };
    }, []);

    const endDay = () => { setDay(d => d + 1); setLog(`День завершено! Очікуйте звіт.`); };
    const triggerCME = () => { /* ... */ };

    const handleSelectAstro = (id) => {
        // Коли перемикаємо астронавта, примусово скидаємо стан руху для всіх
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
    
    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');`}</style>
            
            <CrewPanel crew={crew} onSelectAstro={handleSelectAstro} />

            {log && (
                <div style={{ position: 'absolute', bottom: '70px', left: '20px', background: '#050510', color: '#10b981', padding: '12px', width: '400px', fontFamily: '"Press Start 2P", monospace', fontSize: '9px', border: '2px solid #10b981', lineHeight: '1.5' }}>
                    &gt; {log}
                </div>
            )}

            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '12px 20px', background: '#050510', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: '"Press Start 2P", monospace', fontSize: '10px', borderTop: '4px solid #1e1e26', boxSizing: 'border-box' }}>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', pointerEvents: 'auto' }}>
                    <span style={{ color: '#fff', background: '#334155', padding: '4px 8px' }}>DAY:{day}</span>
                    <span style={{ color: '#0ea5e9', background: '#1e1e26', padding: '4px 8px', border: '1px solid #334155' }}>{formatTime(gameTime)}</span>
                    
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '5px' }}>
                        <button style={getTimeBtnStyle(timeScale === 0, '#ef4444')} onClick={() => { setTimeScale(0); window.dispatchEvent(new CustomEvent('SET_TIME', { detail: 0 })); }}>[||]</button>
                        <button style={getTimeBtnStyle(timeScale === 1, '#10b981')} onClick={() => { setTimeScale(1); window.dispatchEvent(new CustomEvent('SET_TIME', { detail: 1 })); }}>[&gt;]</button>
                        <button style={getTimeBtnStyle(timeScale === 2, '#f59e0b')} onClick={() => { setTimeScale(2); window.dispatchEvent(new CustomEvent('SET_TIME', { detail: 2 })); }}>[&gt;&gt;]</button>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginLeft: '10px', borderLeft: '2px dashed #334155', paddingLeft: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#00ffff" /><span style={{ color: resources.energy === 0 ? '#ef4444' : '#fff' }}>ENG:{resources.energy}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#0ea5e9" /><span style={{ color: resources.oxygen === 0 ? '#ef4444' : '#fff' }}>O2:{resources.oxygen}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#3b82f6" /><span style={{ color: resources.water === 0 ? '#ef4444' : '#fff' }}>H2O:{resources.water}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#f59e0b" /><span style={{ color: resources.food === 0 ? '#ef4444' : '#fff' }}>FOOD:{resources.food}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#94a3b8" /><span>MAT:{resources.materials}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}><PixelIcon color="#ef4444" /><span>SHLD:{resources.shield}</span></div>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
                    <button onClick={triggerCME} style={{ padding: '8px 12px', background: '#334155', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: '"Press Start 2P", monospace', fontSize: '8px' }}>TEST CME</button>
                </div>
            </div>
        </div>
    );
}