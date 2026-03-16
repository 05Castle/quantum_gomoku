import { Routes, Route } from 'react-router-dom';
import OmokGame from './components/OmokGame';
import MatchingScreen from './components/MatchingScreen';
import OmokGame3P from './components/OmokGame3P';
import MatchingScreen3P from './components/MatchingScreen3P';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MatchingScreen />} />
      <Route path="/game/:roomId" element={<OmokGame />} />
      <Route path="/game3p/:roomId" element={<OmokGame3P />} />
      <Route path="/matching3p" element={<MatchingScreen3P />} />
    </Routes>
  );
}

export default App;
