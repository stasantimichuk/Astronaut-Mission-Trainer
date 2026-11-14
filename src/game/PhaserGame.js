import Phaser from 'phaser';
import MainBase from './scenes/MainBase';
import BuildingInside from './scenes/BuildingInside';

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
    scene: [MainBase, BuildingInside]
};

export default config;