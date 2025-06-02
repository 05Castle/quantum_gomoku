import React from 'react';
import { useGameStore } from '../stores/gameStore';

const PlayerInfoBar = () => {
  const { myNickname, opponentNickname, playerRole } = useGameStore();

  return (
    <div className="player-info-bar">
      <div className="player-section">
        <span className="player-label">⚫ 흑돌 (호스트)</span>
        <span className="player-name">
          {playerRole === 'host' ? myNickname : opponentNickname || '대기중...'}
        </span>
      </div>
      <div className="vs-divider">VS</div>
      <div className="player-section">
        <span className="player-label">⚪ 백돌 (게스트)</span>
        <span className="player-name">
          {playerRole === 'guest'
            ? myNickname
            : opponentNickname || '대기중...'}
        </span>
      </div>
    </div>
  );
};

export default PlayerInfoBar;
