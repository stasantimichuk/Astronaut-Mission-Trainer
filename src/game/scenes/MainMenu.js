import Phaser from 'phaser';

export default class MainMenu extends Phaser.Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        const width = this.scale.width;
        const height = this.scale.height;
        const worldHeight = height * 3; 

        // Розмір нашого "віртуального пікселя" для малювання ретро-форм
        const pixelScale = 8; 

        this.cameras.main.setBackgroundColor('#050510');

        // 1. Піксельні зорі (великі квадрати 4x4 або 8x8)
        for (let i = 0; i < 200; i++) {
            // Прив'язуємо координати до "сітки", щоб зорі не були розмитими
            const x = Math.floor(Phaser.Math.Between(0, width) / pixelScale) * pixelScale;
            const y = Math.floor(Phaser.Math.Between(0, worldHeight) / pixelScale) * pixelScale;
            const size = Phaser.Math.Between(1, 2) * (pixelScale / 2); 
            const alpha = Phaser.Math.FloatBetween(0.2, 0.9);
            this.add.rectangle(x, y, size, size, 0xffffff, alpha).setOrigin(0, 0);
        }

        const moonHeight = height * 0.25;
        // Вирівнюємо поверхню по піксельній сітці
        const moonY = Math.floor((worldHeight - moonHeight) / pixelScale) * pixelScale;
        
        // Поверхня Місяця
        this.add.rectangle(0, moonY, width, moonHeight, 0x3a3a45).setOrigin(0, 0);
        
        // 2. Функція для створення 8-бітних "круглих" кратерів
        const drawPixelCrater = (cx, cy, scale) => {
            const color = 0x2b2b36;
            // Накладаємо три прямокутники різної ширини/висоти, щоб утворити сходинкове коло
            this.add.rectangle(cx, cy, 10 * scale, 6 * scale, color).setOrigin(0.5);
            this.add.rectangle(cx, cy, 6 * scale, 10 * scale, color).setOrigin(0.5);
            this.add.rectangle(cx, cy, 8 * scale, 8 * scale, color).setOrigin(0.5);
        };

        // Малюємо піксельні кратери
        drawPixelCrater(width * 0.2, moonY + 30, pixelScale);
        drawPixelCrater(width * 0.8, moonY + 80, pixelScale * 1.5);
        drawPixelCrater(width * 0.45, moonY + 120, pixelScale * 0.8);
        
        // 3. Деталізована Піксельна База
        const baseX = Math.floor(width * 0.5 / pixelScale) * pixelScale;

        // Основний корпус
        this.add.rectangle(baseX, moonY, 160, 96, 0x1e1e26).setOrigin(0.5, 1);
        // Темна лінія-фундамент
        this.add.rectangle(baseX, moonY, 160, 16, 0x111118).setOrigin(0.5, 1);
        
        // Квадратні неонові вікна (Cyan)
        this.add.rectangle(baseX - 32, moonY - 48, 24, 24, 0x0ea5e9).setOrigin(0.5);
        this.add.rectangle(baseX + 32, moonY - 48, 24, 24, 0x0ea5e9).setOrigin(0.5);

        // Піксельна антена (щогла + тарілка сходинками)
        this.add.rectangle(baseX + 64, moonY, 16, 144, 0x111118).setOrigin(0.5, 1); // Щогла
        this.add.rectangle(baseX + 64, moonY - 128, 48, 16, 0x1e1e26).setOrigin(0.5, 1); // Низ тарілки
        this.add.rectangle(baseX + 64, moonY - 144, 32, 16, 0x1e1e26).setOrigin(0.5, 1); // Верх тарілки

        // Налаштування камери
        this.cameras.main.setBounds(0, 0, width, worldHeight);
        this.cameras.main.setScroll(0, 0);

        // Прапорець для запобігання подвійному спрацюванню
        this.isTransitioning = false;

       // Запускаємо спуск камери
        this.cameras.main.pan(
            width / 2, 
            worldHeight - height / 2, 
            4000, 
            'Sine.easeInOut', 
            false, 
            (camera, progress) => {
                if (progress === 1) {
                    window.dispatchEvent(new CustomEvent('SHOW_MENU_BUTTONS'));
                }
            }
        );
        // ТУТ БІЛЬШЕ НІЧОГО НЕМАЄ. Функція create() закінчується.
    }
}