import React from 'react';
import { useGameStore1v2 } from '../stores/gameStore1v2';

const PlayerInfoBar1v2 = () => {
  const {
    hostNickname,
    player2Nickname,
    player3Nickname,
    playerRole,
    myCharacter,
    hostCharacter,
    player2Character,
    player3Character,
    winner,
    gameOver,
  } = useGameStore1v2();

  const getCharacterImg = (characterIndex, isWinner) => {
    const base = `/characters/c${characterIndex + 1}`;
    return isWinner ? `${base}-win.png` : `${base}.png`;
  };

  const hostCharIdx = playerRole === 'host' ? myCharacter : hostCharacter;
  const p2CharIdx = playerRole === 'player2' ? myCharacter : player2Character;
  const p3CharIdx = playerRole === 'player3' ? myCharacter : player3Character;

  const isWhiteWinner = gameOver && winner === 'white';
  const isBlackWinner = gameOver && winner === 'black';

  return (
    <div className="player-info-bar player-info-bar-1v2">
      {/* 백(호스트) 카드 */}
      <div
        className={`player-card white-player ${isWhiteWinner ? 'winner' : ''}`}
      >
        <div className="player-role">
          <span className="stone-icon">⚪</span>
          <span className="role-text">백 (고수)</span>
        </div>
        <div className="player-character">
          <img
            src={getCharacterImg(hostCharIdx, isWhiteWinner)}
            alt="백 캐릭터"
            className="character-avatar"
          />
        </div>
        <div className="player-name">{hostNickname || '대기중...'}</div>
      </div>

      <div className="vs-divider">VS</div>

      {/* 흑팀 카드 - 2P/3P 나란히 */}
      <div className={`team-card black-team ${isBlackWinner ? 'winner' : ''}`}>
        <div className="team-label">
          <span className="stone-icon">⚫</span>
          <span className="role-text">흑팀 (하수)</span>
        </div>
        <div className="team-members">
          <div className="team-member">
            <img
              src={getCharacterImg(p2CharIdx, isBlackWinner)}
              alt="흑팀 1 캐릭터"
              className="character-avatar-small"
            />
            <div className="player-name">{player2Nickname || '대기중...'}</div>
          </div>
          <div className="team-member">
            <img
              src={getCharacterImg(p3CharIdx, isBlackWinner)}
              alt="흑팀 2 캐릭터"
              className="character-avatar-small"
            />
            <div className="player-name">{player3Nickname || '대기중...'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerInfoBar1v2;
