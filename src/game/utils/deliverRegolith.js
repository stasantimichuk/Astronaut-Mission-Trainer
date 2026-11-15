// Здача ґрунту з інвентаря астронавта на склад / переробник.
// React (Interface.jsx) отримує PROCESS_REGOLITH і додає воду та кисень базі.
export function deliverRegolith(scene, astroId) {
    const crewState = scene.registry.get('crewState') || [];
    const astroData = crewState.find(s => s.id === astroId);

    if (!astroData || !(astroData.inventory > 0)) {
        console.log('[СКЛАД]: У інвентарі немає ґрунту для здачі!');
        return 0;
    }

    const amount = astroData.inventory;
    astroData.inventory = 0;
    scene.registry.set('crewState', crewState);

    window.dispatchEvent(new CustomEvent('UPDATE_INVENTORY', { detail: astroData }));
    window.dispatchEvent(new CustomEvent('PROCESS_REGOLITH', { detail: { amount } }));
    return amount;
}
