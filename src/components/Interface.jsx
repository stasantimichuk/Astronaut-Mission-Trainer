import { useState, useEffect } from 'react';

export default function Interface() {
    const [gameState, setGameState] = useState('menu'); 
    const [showMenuButtons, setShowMenuButtons] = useState(false);

    const [day, setDay] = useState(1);
    const [resources, setResources] = useState({
        energy: 100, lifeSupport: 100, shield: 50, science: 0
    });
    const [systems, setSystems] = useState({
        greenhouseActive: true, solarPanelDirty: false
    });
    const [inventory, setInventory] = useState({ regolith: 0, tools: 0 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [log, setLog] = useState("Вітаємо на станції! База працює в штатному режимі.");

    useEffect(() => {
        const handleOpenTerminal = () => setIsModalOpen(true);
        const handleCleanPanel = () => {
            setSystems(prev => ({ ...prev, solarPanelDirty: false }));
            setLog("🧹 Сонячні панелі очищено! Генерація відновлена.");
        };

        const handleCollectItem = (event) => {
            const itemType = event.detail.type;
            if (itemType === 'regolith') {
                setInventory(prev => ({ ...prev, regolith: prev.regolith + 1 }));
                setResources(prev => ({ ...prev, science: prev.science + 5 })); 
                setLog("💎 Зібрано зразок реголіту! Науковий прогрес +5.");
            }
        };

        window.addEventListener('OPEN_TERMINAL', handleOpenTerminal);
        window.addEventListener('CLEAN_SOLAR_PANEL', handleCleanPanel);
        window.addEventListener('COLLECT_ITEM', handleCollectItem); 
        
        const handleShowMenu = () => setShowMenuButtons(true);
        window.addEventListener('SHOW_MENU_BUTTONS', handleShowMenu);
        
        return () => {
            window.removeEventListener('OPEN_TERMINAL', handleOpenTerminal);
            window.removeEventListener('CLEAN_SOLAR_PANEL', handleCleanPanel);
            window.removeEventListener('COLLECT_ITEM', handleCollectItem);
            window.removeEventListener('SHOW_MENU_BUTTONS', handleShowMenu);
        };
    }, []);

    const endDay = () => {
        setResources(prev => {
            const Ebase = 15;
            const Ehabitat = 20;
            const Egreenhouse = systems.greenhouseActive ? 15 : 0;
            
            const solarEfficiency = systems.solarPanelDirty ? 0.2 : 1.0;
            const Esolar = Math.floor(50 * solarEfficiency); 
            
            const Ecost = (Ebase + Ehabitat + Egreenhouse) - Esolar;
            let newEnergy = Math.max(0, Math.min(100, prev.energy - Ecost));

            const Lcrew = 10;
            const Lrecycling = newEnergy > 0 ? 12 : 0; 
            const Lcost = Lcrew - Lrecycling;
            let newLifeSupport = Math.max(0, Math.min(100, prev.lifeSupport - Lcost));

            if (newEnergy === 0) {
                setLog(`День ${day} завершено. 🔴 КРИТИЧНА ПОМИЛКА: Блекаут! Енергії нуль.`);
            } else {
                setLog(`День ${day} завершено. Зібрано енергії: ${Esolar}.`);
            }

            return { ...prev, energy: newEnergy, lifeSupport: newLifeSupport };
        });
        
        setSystems(prev => {
            if (!prev.solarPanelDirty && Math.random() < 0.25) { 
                setLog(prevLog => `⚠️ КОСМІЧНА ПОГОДА: Викид CME! Реголіт засипав панелі. ${prevLog}`);
                window.dispatchEvent(new CustomEvent('DIRTY_SOLAR_PANEL'));
                return { ...prev, solarPanelDirty: true };
            }
            return prev;
        });

        setDay(d => d + 1);
    };

    const handleChoiceA = () => {
        setResources(prev => ({ ...prev, energy: Math.max(0, prev.energy - 30), shield: 100 }));
        setSystems(prev => ({ ...prev, greenhouseActive: false }));
        setLog("Щит активовано (Енергія -30). Теплицю знеструмлено.");
        setIsModalOpen(false);
    };

    const handleChoiceB = () => {
        setResources(prev => ({ ...prev, lifeSupport: Math.max(0, prev.lifeSupport - 40), science: prev.science + 30 }));
        setLog("Ви проігнорували шторм! Наука +30, але екіпаж зазнав опромінення.");
        setIsModalOpen(false);
    };

    const triggerCME = () => {
        setSystems(prev => ({ ...prev, solarPanelDirty: true }));
        setLog("⚠️ (ТЕСТ) Спровоковано CME: панелі вкриті пилом!");
        window.dispatchEvent(new CustomEvent('DIRTY_SOLAR_PANEL')); 
    };

    if (gameState === 'menu') {
        return (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <style>
                    {`@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');`}
                </style>
                
                <div style={{ 
                    opacity: showMenuButtons ? 1 : 0, 
                    transition: 'opacity 1s ease-in',
                    pointerEvents: showMenuButtons ? 'auto' : 'none',
                    textAlign: 'center',
                    marginBottom: '10vh'
                }}>
                    <h1 style={{ 
                        color: 'white', 
                        fontSize: '36px', 
                        lineHeight: '1.5',
                        textTransform: 'uppercase', 
                        textShadow: '4px 4px 0px #0ea5e9', 
                        margin: '0 0 60px 0', 
                        fontFamily: '"Press Start 2P", monospace' 
                    }}>
                        Astronaut<br/>Mission Trainer
                    </h1>
                    
                    <button 
                        onClick={() => {
                            setGameState('playing');
                            // ПРЯМИЙ ВИКЛИК PHASER ЗАМІСТЬ ПОДІЇ
                            if (window.phaserGame) {
                                window.phaserGame.scene.stop('MainMenu');
                                window.phaserGame.scene.start('MainBase');
                            } else {
                                console.error("Phaser game instance not found!");
                            }
                        }}
                        style={{ 
                            padding: '20px 30px', 
                            fontSize: '18px', 
                            background: '#111', 
                            color: '#0ea5e9', 
                            border: '4px solid #0ea5e9', 
                            borderRadius: '0', 
                            cursor: 'pointer', 
                            textTransform: 'uppercase', 
                            fontFamily: '"Press Start 2P", monospace',
                            boxShadow: '6px 6px 0px #0ea5e9', 
                            transition: 'all 0.1s' 
                        }}
                        onMouseOver={e => {
                            e.target.style.transform = 'translate(-2px, -2px)';
                            e.target.style.boxShadow = '8px 8px 0px #0ea5e9';
                            e.target.style.background = '#1a1a1a';
                        }}
                        onMouseOut={e => {
                            e.target.style.transform = 'translate(0px, 0px)';
                            e.target.style.boxShadow = '6px 6px 0px #0ea5e9';
                            e.target.style.background = '#111';
                        }}
                        onMouseDown={e => {
                            e.target.style.transform = 'translate(4px, 4px)';
                            e.target.style.boxShadow = '2px 2px 0px #0ea5e9';
                        }}
                        onMouseUp={e => {
                            e.target.style.transform = 'translate(-2px, -2px)';
                            e.target.style.boxShadow = '8px 8px 0px #0ea5e9';
                        }}
                    >
                        START MISSION
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
            <div style={{ padding: '10px 20px', background: 'rgba(0,0,0,0.85)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'monospace', fontSize: '15px', borderBottom: '2px solid #333' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: 'bold', background: '#333', padding: '2px 8px', borderRadius: '4px' }}>ДЕНЬ {day}</span>
                    <span style={{ color: resources.energy < 20 ? '#ef4444' : '#00ffff' }}>⚡ E:{resources.energy}</span>
                    <span style={{ color: resources.lifeSupport < 20 ? '#ef4444' : '#00ff00' }}>💧 L:{resources.lifeSupport}</span>
                    <span style={{ color: '#ff00ff' }}>🔬 S:{resources.science}</span>
                    
                    <span style={{ color: systems.solarPanelDirty ? '#ef4444' : '#fbbf24', marginLeft: '10px', borderLeft: '1px solid #666', paddingLeft: '10px' }}>
                        ☀️ {systems.solarPanelDirty ? 'БРУДНІ' : 'ЧИСТІ'}
                    </span>

                    <span style={{ color: '#9b59b6', marginLeft: '10px', borderLeft: '1px solid #666', paddingLeft: '10px' }}>
                        📦 Реголіт: {inventory.regolith}
                    </span>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
                    <button onClick={triggerCME} style={{ padding: '6px 12px', background: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                        Спровокувати CME
                    </button>
                    <button onClick={endDay} style={{ padding: '6px 16px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Завершити день ⏭️
                    </button>
                </div>
            </div>

            {log && (
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.8)', color: '#10b981', padding: '12px', borderRadius: '5px', maxWidth: '600px', fontFamily: 'monospace', borderLeft: '4px solid #10b981' }}>
                    {log}
                </div>
            )}

            {isModalOpen && (
                <div style={{ pointerEvents: 'auto', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#1e293b', border: '2px solid #0ea5e9', padding: '20px', color: 'white', width: '450px', borderRadius: '8px', boxShadow: '0 0 20px rgba(0,0,0,0.8)' }}>
                    <h2 style={{ margin: '0 0 15px 0', color: '#ef4444' }}>⚠️ ДАНІ DONKI: Протонний шторм</h2>
                    <p>Наближається шторм (SEP / Клас X). Прийміть рішення:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                        <button onClick={handleChoiceA} style={{ padding: '10px', background: '#334155', color: 'white', border: '1px solid #10b981', cursor: 'pointer', textAlign: 'left' }}>
                            <strong>А. Повний захист</strong><br/><small>Енергія -30. Теплицю вимкнено.</small>
                        </button>
                        <button onClick={handleChoiceB} style={{ padding: '10px', background: '#334155', color: 'white', border: '1px solid #ef4444', cursor: 'pointer', textAlign: 'left' }}>
                            <strong>Б. Ризикувати</strong><br/><small>Наука +30, здоров'я екіпажу -40.</small>
                        </button>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} style={{ display: 'block', width: '100%', marginTop: '15px', padding: '5px', background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>Закрити</button>
                </div>
            )}
        </div>
    );
}