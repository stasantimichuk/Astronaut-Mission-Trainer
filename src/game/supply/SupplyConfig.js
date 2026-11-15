// Налаштування постачання (замовлення з пункту зв’язку -> посилка на посадковому майданчику).
// Модуль не залежить від Phaser — його використовують і Interface.jsx, і сцени.

// Ігровий день триває з 08:00 до 24:00 = 960 хв, 1 тік = 10 ігрових хвилин
export const TICKS_PER_DAY = (1440 - 480) / 10; // 96 тіків

export const SUPPLY = {
    deliveryDays: 3,            // через скільки ігрових днів після замовлення прилітає посилка
    maxItemsPerOrder: 10,       // ліміт предметів у одному замовленні (посилці)
    carrySpeedMultiplier: 0.25  // швидкість астронавта з посилкою (25% від звичайної)
};

// Що можна замовити. resource — поле в resources (Interface.jsx), amount — скільки дає 1 предмет
export const SUPPLY_CATALOG = [
    { id: 'water',     label: 'Water',       resource: 'water',     amount: 100, color: '#3b82f6' },
    { id: 'oxygen',    label: 'Air',         resource: 'oxygen',    amount: 100, color: '#0ea5e9' },
    { id: 'food',      label: 'Food',        resource: 'food',      amount: 100, color: '#f59e0b' },
    { id: 'energy',    label: 'Battery',     resource: 'energy',    amount: 100, color: '#00ffff' },
    { id: 'materials', label: 'Parts',       resource: 'materials', amount: 5,   color: '#94a3b8' }
];
