import Phaser from 'phaser';
import MainMenu from './scenes/MainMenu'; // Додаємо імпорт
import MainBase from './scenes/MainBase';
import BuildingInside from './scenes/LandingModule';

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: 'phaser-game-container',
        width: '100%',
        height: '100%'
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    audio: { noAudio: true },
    pixelArt: true, // ВАЖЛИВО: Робить графіку чіткою (піксельною)
    scene: [MainMenu, MainBase, BuildingInside]
};

export default config;