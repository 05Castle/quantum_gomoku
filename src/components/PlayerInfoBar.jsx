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
    getCharacterImage,
  } = useGameStore();

  // 승리자 확인 함수
  const isWinner = (role) => {
    if (!gameOver || winner === 'draw') return false;

    if (role === 'host') {
      return winner === 'black';
    } else {
      return winner === 'white';
    }
  };

  // 캐릭터 이미지 경로 반환 (승리 시 -win 버전 사용)
  const getCharacterImageWithWin = (characterIndex, isWinnerPlayer) => {
    const basePath = `/characters/c${characterIndex + 1}`;
    return isWinnerPlayer ? `${basePath}-win.png` : `${basePath}.png`;
  };

  // 내가 승리했는지 확인
  const amIWinner = isWinner(playerRole);
  // 상대방이 승리했는지 확인
  const isOpponentWinner = isWinner(playerRole === 'host' ? 'guest' : 'host');

  // 호스트(흑돌) 플레이어가 승리했는지 확인
  const isHostWinner = gameOver && winner === 'black';
  // 게스트(백돌) 플레이어가 승리했는지 확인
  const isGuestWinner = gameOver && winner === 'white';

  return (
    <div className="player-info-bar">
      {/* 흑돌 플레이어 (호스트) 카드 */}
      <div
        className={`player-card black-player ${isHostWinner ? 'winner' : ''}`}
      >
        <div className="player-role">
          <span className="stone-icon">⚫</span>
          <span className="role-text">흑돌</span>
        </div>
        <div className="player-character">
          <img
            src={
              playerRole === 'host'
                ? getCharacterImageWithWin(myCharacter, isHostWinner)
                : getCharacterImageWithWin(opponentCharacter, isHostWinner)
            }
            alt="호스트 캐릭터"
            className="character-avatar"
          />
        </div>
        <div className="player-name">
          {playerRole === 'host' ? myNickname : opponentNickname || '대기중...'}
        </div>
      </div>

      <div className="vs-divider">VS</div>

      {/* 백돌 플레이어 (게스트) 카드 */}
      <div
        className={`player-card white-player ${isGuestWinner ? 'winner' : ''}`}
      >
        <div className="player-role">
          <span className="stone-icon">⚪</span>
          <span className="role-text">백돌</span>
        </div>
        <div className="player-character">
          <img
            src={
              playerRole === 'guest'
                ? getCharacterImageWithWin(myCharacter, isGuestWinner)
                : getCharacterImageWithWin(opponentCharacter, isGuestWinner)
            }
            alt="게스트 캐릭터"
            className="character-avatar"
          />
        </div>
        <div className="player-name">
          {playerRole === 'guest'
            ? myNickname
            : opponentNickname || '대기중...'}
        </div>
      </div>
    </div>
  );
};

export default PlayerInfoBar;
