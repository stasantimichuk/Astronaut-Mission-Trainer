import GameCanvas from './components/GameCanvas';
import Interface from './components/Interface';

function App() {
  return (
    // position: 'relative' гарантує, що абсолютне позиціювання інтерфейсу працюватиме правильно
    <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#111' }}>
      <GameCanvas />
      <Interface />
    </div>
  );
}

export default App;