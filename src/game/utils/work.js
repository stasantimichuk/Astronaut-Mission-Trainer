// Робота астронавта, що забирає час (чистка панелей, збір ґрунту).
// Час іде в ігровому темпі: на паузі (x0) прогрес стоїть, на x2 — вдвічі швидше.
// Роботу скасовує будь-яка нова команда руху, зміна сцени або смерть астронавта.

export const WORK_DURATION = {
    cleanPanel: 6000,        // мс при x1: чистка однієї сонячної панелі
    collectRegolith: 2500    // мс при x1: збір однієї порції ґрунту
};

const BAR_W = 32;

function removeTask(scene, astroId, cancelled) {
    const task = scene.workTasks && scene.workTasks.get(astroId);
    if (!task) return;
    scene.workTasks.delete(astroId);
    task.bar.destroy();
    if (cancelled && task.onCancel) task.onCancel();
}

export function startWork(scene, astroId, durationMs, onDone, onCancel) {
    if (!scene.workTasks) scene.workTasks = new Map();
    removeTask(scene, astroId, true);
    const bar = scene.add.graphics().setDepth(20);
    scene.workTasks.set(astroId, { elapsed: 0, duration: durationMs, onDone, onCancel, bar });
}

export function cancelWork(scene, astroId) {
    removeTask(scene, astroId, true);
}

export function isWorking(scene, astroId) {
    return !!(scene.workTasks && scene.workTasks.has(astroId));
}

export function updateWork(scene, delta) {
    if (!scene.workTasks || scene.workTasks.size === 0) return;
    const dead = (window.gameSim && window.gameSim.deadIds) || [];

    for (const [astroId, task] of [...scene.workTasks.entries()]) {
        const astro = scene.astronauts.find(a => a.id === astroId);
        if (!astro || dead.includes(astroId) || astro.isMoving) {
            removeTask(scene, astroId, true);
            continue;
        }

        task.elapsed += delta * (scene.timeScale || 0);
        const ratio = Math.min(1, task.elapsed / task.duration);

        task.bar.clear();
        task.bar.fillStyle(0x000000, 0.8).fillRect(astro.x, astro.y - 24, BAR_W, 6);
        task.bar.fillStyle(0x22c55e, 1).fillRect(astro.x + 1, astro.y - 23, (BAR_W - 2) * ratio, 4);

        if (ratio >= 1) {
            removeTask(scene, astroId, false);
            task.onDone();
        }
    }
}
