import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import config from '../game/PhaserGame';

const GameCanvas = () => {
  const gameRef = useRef(null);

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);
      // ВАЖЛИВО: Робимо гру доступною глобально для React-інтерфейсу
      window.phaserGame = gameRef.current;
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        window.phaserGame = null;
      }
    };
  }, []);

  return <div id="phaser-game-container" style={{ width: '100%', height: '100%' }} />;
};

export default GameCanvas;