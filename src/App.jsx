import { Routes, Route } from 'react-router-dom';
import OmokGame from './components/OmokGame';
import MatchingScreen from './components/MatchingScreen';
import OmokGame3P from './components/OmokGame3P';
import MatchingScreen3P from './components/MatchingScreen3P';
import OmokGame1v2 from './components/OmokGame1v2';
import MatchingScreen1v2 from './components/MatchingScreen1v2';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MatchingScreen />} />
      <Route path="/game/:roomId" element={<OmokGame />} />
      <Route path="/game3p/:roomId" element={<OmokGame3P />} />
      <Route path="/matching3p" element={<MatchingScreen3P />} />
      <Route path="/matching1v2" element={<MatchingScreen1v2 />} />
      <Route path="/game1v2/:roomId" element={<OmokGame1v2 />} />
    </Routes>
  );
}

export default App;
