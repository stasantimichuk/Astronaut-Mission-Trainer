// Розклад івентів на ігровий день на основі прогнозу космічної погоди (forecastData.js).
// Кожен ігровий день = випадкова дата зі списку. Події CME/SEP цієї дати стають івентами гри.
// Модуль не залежить від Phaser/React.
import { FORECAST_DATES, FORECAST_EVENTS } from './forecastData';
import { EVENT_CONFIG } from './SpaceEvents';

// Ігровий день триває 08:00-24:00 (480..1440 хв), тік = 10 ігрових хвилин.
// Доба UTC (24 год) стискається в ігровий день, час округлюється до тіка (10 хв).
const DAY_START = 480;
const DAY_LENGTH = 960;
const TICK_MIN = 10;

export function utcToGameMinute(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const utcMin = h * 60 + m;
    const scaled = (utcMin / 1440) * DAY_LENGTH;
    const rounded = Math.round(scaled / TICK_MIN) * TICK_MIN;
    return Math.min(DAY_START + DAY_LENGTH - TICK_MIN, DAY_START + rounded);
}

export function formatGameMinute(minute) {
    const h = Math.floor(minute / 60) % 24;
    const m = minute % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Повертає { date, events: [{ minute, type }] } — події відсортовані за часом.
// Події одного типу в один і той самий тік зливаються в одну.
export function buildDaySchedule(date) {
    const seen = new Set();
    const events = [];
    FORECAST_EVENTS.filter(e => e[0] === date).forEach(([, type, time]) => {
        const minute = utcToGameMinute(time);
        const key = `${type}@${minute}`;
        if (seen.has(key)) return;
        seen.add(key);
        events.push({ minute, type });
    });
    events.sort((a, b) => a.minute - b.minute);
    return { date, events };
}

// Випадкова дата зі списку (не повторює попередню поспіль)
export function createDaySchedule(previousDate = null) {
    const pool = FORECAST_DATES.length > 1 ? FORECAST_DATES.filter(d => d !== previousDate) : FORECAST_DATES;
    const date = pool[Math.floor(Math.random() * pool.length)];
    return buildDaySchedule(date);
}

export function describeSchedule(schedule) {
    if (schedule.events.length === 0) return 'quiet day, no storms expected';
    return schedule.events.map(e => `${EVENT_CONFIG[e.type].label} at ${formatGameMinute(e.minute)}`).join(', ');
}
