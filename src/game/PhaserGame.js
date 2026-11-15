import Phaser from 'phaser';
import MainMenu from './scenes/MainMenu';
import MainBase from './scenes/MainBase';
import LandingModule from './scenes/LandingModule';
import WaterProcessingBuilding from './scenes/WaterProcessingBuilding';
import GreenhouseBuilding from './scenes/GreenhouseBuilding';
import ShelterBuilding from './scenes/ShelterBuilding';

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
    scene: [MainBase, MainMenu, LandingModule, WaterProcessingBuilding, GreenhouseBuilding, ShelterBuilding]
};

export default config;
