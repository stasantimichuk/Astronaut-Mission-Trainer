// Конфігурація та логіка космічних івентів.
// ВАЖЛИВО: модуль не залежить від Phaser. Івентами керує Interface.jsx (єдине джерело істини),
// тому вони працюють з ігровим часом (тіками), паузою/прискоренням, у всіх сценах і для всього екіпажу.
// 1 тік = 10 ігрових хвилин = 5 реальних секунд при x1.

export const EVENT_CONFIG = {
    CME: {
        label: 'CME',
        durationTicks: 6,          // ~30 с реального часу при x1
        speedMultiplier: 0.5,      // сповільнення руху на поверхні на 50%
        suitDamagePerTick: 8,      // втрата скафандра за тік (на поверхні, поза укриттям)
        suitThresholdPercent: 50,  // нижче цього порогу скафандр уже не захищає — починається втрата HP
        healthDamageFactor: 4,
        dustsSolarPanels: true,    // сонячні панелі засипає пилом -> генерація енергії = 0
        startMessage: '⚠️ КОРОНАЛЬНИЙ ВИКИД! Панелі засипані пилом, енергії немає. Скафандри псуються — в укриття!'
    },
    SEP: {
        label: 'SEP',
        durationTicks: 6,
        damageIntervalTicks: 3,    // кожен 3-й тік
        healthLoss: 10,
        startMessage: '☢️ ПРОТОННА БУРЯ! Радіація на поверхні — сховайтесь у будівлі або укриття!'
    },
    RANDOM: {
        enabled: false,            // true — івенти починатимуться самі
        chancePerTick: 1 / 60
    }
};

export class SpaceEventsManager {
    constructor() {
        this.active = null;
        this.ticksLeft = 0;
        this.sepCounter = 0;
        this.sepStrike = false;
    }

    pickRandom() {
        const types = ['CME', 'SEP'];
        return types[Math.floor(Math.random() * types.length)];
    }

    start(type) {
        const cfg = EVENT_CONFIG[type];
        if (!cfg || this.active) return null;
        this.active = type;
        this.ticksLeft = cfg.durationTicks;
        this.sepCounter = 0;
        this.sepStrike = false;
        return cfg;
    }

    // Викликати на початку кожного тіка (до розрахунку екіпажу)
    beginTick() {
        this.sepStrike = false;
        if (this.active === 'SEP') {
            this.sepCounter++;
            if (this.sepCounter >= EVENT_CONFIG.SEP.damageIntervalTicks) {
                this.sepCounter = 0;
                this.sepStrike = true;
            }
        }
    }

    // Дія івенту на астронавта, який знаходиться НА ПОВЕРХНІ поза укриттям
    applyExposure({ hp, suit }) {
        if (this.active === 'CME') {
            const c = EVENT_CONFIG.CME;
            suit = Math.max(0, suit - c.suitDamagePerTick);
            if (suit <= c.suitThresholdPercent) {
                const factor = (c.suitThresholdPercent - suit) / c.suitThresholdPercent;
                hp -= Math.max(1, Math.round(c.healthDamageFactor * factor));
            }
        }
        if (this.active === 'SEP' && this.sepStrike) {
            hp -= EVENT_CONFIG.SEP.healthLoss;
        }
        return { hp: Math.max(0, hp), suit };
    }

    // Викликати в кінці тіка. Повертає тип івенту, якщо він щойно завершився.
    endTick() {
        if (!this.active) return null;
        this.ticksLeft--;
        if (this.ticksLeft <= 0) {
            const finished = this.active;
            this.active = null;
            this.ticksLeft = 0;
            this.sepCounter = 0;
            this.sepStrike = false;
            return finished;
        }
        return null;
    }
}
