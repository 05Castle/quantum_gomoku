import { Routes, Route } from 'react-router-dom';
import OmokGame from './components/OmokGame';
import MatchingScreen from './components/MatchingScreen';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MatchingScreen />} />
      <Route path="/game/:roomId" element={<OmokGame />} />
    </Routes>
  );
}

export default App;
