// Здача ґрунту з інвентаря астронавта на склад / переробник.
// React (Interface.jsx) отримує PROCESS_REGOLITH і додає воду та кисень базі.
export function deliverRegolith(scene, astroId) {
    // Переробка потребує електрики
    if (window.gameSim && window.gameSim.powered === false) {
        window.dispatchEvent(new CustomEvent('GAME_LOG', { detail: { message: '⚡ No power — the moon dust cannot be recycled! Clean the solar panels.' } }));
        return 0;
    }
    const crewState = scene.registry.get('crewState') || [];
    const astroData = crewState.find(s => s.id === astroId);

    if (!astroData || !(astroData.inventory > 0)) {
        console.log('[STORAGE]: There is no moon dust in the bag to hand in!');
        return 0;
    }

    const amount = astroData.inventory;
    astroData.inventory = 0;
    scene.registry.set('crewState', crewState);

    window.dispatchEvent(new CustomEvent('UPDATE_INVENTORY', { detail: astroData }));
    window.dispatchEvent(new CustomEvent('PROCESS_REGOLITH', { detail: { amount } }));
    return amount;
}
