import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import config from '../game/PhaserGame';

export default function GameCanvas() {
    const gameRef = useRef(null);

    useEffect(() => {
        // Ініціалізуємо гру лише якщо вона ще не створена
        if (!gameRef.current) {
            gameRef.current = new Phaser.Game(config);
        }

        // Очищення при знищенні компонента
        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    // Контейнер, id якого збігається з parent у PhaserGame.js
    return <div id="phaser-game-container" style={{ width: '100%', height: '100%' }}></div>;
}