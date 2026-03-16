import { Routes, Route } from 'react-router-dom';
import OmokGame from './components/OmokGame';
import OmokGame3P from './components/OmokGame3P';
import MatchingScreen from './components/MatchingScreen';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MatchingScreen />} />
      <Route path="/game/:roomId" element={<OmokGame />} />
      <Route path="/game3p/:roomId" element={<OmokGame3P />} />
    </Routes>
  );
}

export default App;
