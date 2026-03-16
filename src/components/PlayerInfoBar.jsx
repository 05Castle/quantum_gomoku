import React from 'react';
import { useGameStore } from '../stores/gameStore';

const PlayerInfoBar = () => {
  const {
    myNickname,
    opponentNickname,
    playerRole,
    winner,
    gameOver,
    myCharacter,
    opponentCharacter,
    myColor,
    opponentColor,
    getCharacterImage,
  } = useGameStore();

  // Ver 1.3: 흑돌/백돌 색상에 따른 승리 여부 확인
  const isBlackWinner = gameOver && winner === 'black';
  const isWhiteWinner = gameOver && winner === 'white';

  // Ver 1.3: myColor 기준으로 흑돌/백돌 플레이어 정보 결정
  const blackPlayerNickname =
    myColor === 'black' ? myNickname : opponentNickname;
  const whitePlayerNickname =
    myColor === 'white' ? myNickname : opponentNickname;
  const blackPlayerCharacter =
    myColor === 'black' ? myCharacter : opponentCharacter;
  const whitePlayerCharacter =
    myColor === 'white' ? myCharacter : opponentCharacter;

  const getCharacterImageWithWin = (characterIndex, isWinnerPlayer) => {
    const basePath = `/characters/c${characterIndex + 1}`;
    return isWinnerPlayer ? `${basePath}-win.png` : `${basePath}.png`;
  };

  return (
    <div className="player-info-bar">
      {/* 흑돌 플레이어 카드 */}
      <div
        className={`player-card black-player ${isBlackWinner ? 'winner' : ''}`}
      >
        <div className="player-role">
          <span className="stone-icon">⚫</span>
          <span className="role-text">흑돌</span>
        </div>
        <div className="player-character">
          <img
            src={getCharacterImageWithWin(blackPlayerCharacter, isBlackWinner)}
            alt="흑돌 플레이어 캐릭터"
            className="character-avatar"
          />
        </div>
        <div className="player-name">{blackPlayerNickname || '대기중...'}</div>
      </div>

      <div className="vs-divider">VS</div>

      {/* 백돌 플레이어 카드 */}
      <div
        className={`player-card white-player ${isWhiteWinner ? 'winner' : ''}`}
      >
        <div className="player-role">
          <span className="stone-icon">⚪</span>
          <span className="role-text">백돌</span>
        </div>
        <div className="player-character">
          <img
            src={getCharacterImageWithWin(whitePlayerCharacter, isWhiteWinner)}
            alt="백돌 플레이어 캐릭터"
            className="character-avatar"
          />
        </div>
        <div className="player-name">{whitePlayerNickname || '대기중...'}</div>
      </div>
    </div>
  );
};

export default PlayerInfoBar;
