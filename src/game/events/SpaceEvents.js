// Конфігурація та логіка космічних івентів.
// ВАЖЛИВО: модуль не залежить від Phaser. Івентами керує Interface.jsx (єдине джерело істини),
// тому вони працюють з ігровим часом (тіками), паузою/прискоренням, у всіх сценах і для всього екіпажу.
// 1 тік = 10 ігрових хвилин = 5 реальних секунд при x1.

export const EVENT_CONFIG = {
    CME: {
        label: 'SOLAR BLAST',
        durationTicks: 6,          // ~30 с реального часу при x1
        speedMultiplier: 0.5,      // сповільнення руху на поверхні на 50%
        suitDamagePerTick: 8,      // втрата скафандра за тік (на поверхні, поза укриттям)
        suitThresholdPercent: 50,  // нижче цього порогу скафандр уже не захищає — починається втрата HP
        healthDamageFactor: 4,
        dustsSolarPanels: true,    // сонячні панелі засипає пилом -> генерація енергії = 0
        startMessage: '⚠️ SOLAR BLAST! Dust covers the solar panels, so there is no power. Space suits are getting damaged — go inside!'
    },
    SEP: {
        label: 'RADIATION STORM',
        durationTicks: 6,
        damageIntervalTicks: 3,    // кожен 3-й тік
        healthLoss: 10,
        startMessage: '☢️ RADIATION STORM! It is dangerous everywhere — only the SHELTER keeps you safe. Everyone to the shelter!'
    },
    // Івенти запускає розклад з ForecastSchedule.js (прогноз космічної погоди)
};

export class SpaceEventsManager {
    constructor() {
        this.active = null;
        this.ticksLeft = 0;
        this.sepCounter = 0;
        this.sepStrike = false;
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
        return { hp: this.applyRadiation(hp), suit };
    }

    // SEP б'є по всіх, хто НЕ в укритті (і на поверхні, і в звичайних будівлях)
    applyRadiation(hp) {
        if (this.active === 'SEP' && this.sepStrike) {
            hp -= EVENT_CONFIG.SEP.healthLoss;
        }
        return Math.max(0, hp);
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
