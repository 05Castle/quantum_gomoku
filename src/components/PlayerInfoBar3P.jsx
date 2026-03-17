import React from 'react';
import { useGameStore3P } from '../stores/gameStore3P';

const PlayerInfoBar3P = () => {
  const {
    hostNickname,
    player2Nickname,
    player3Nickname,
    myCharacter,
    hostCharacter,
    player2Character,
    player3Character,
    playerRole,
    winner,
    gameOver,
  } = useGameStore3P();

  // 캐릭터 이미지 (승리 시 -win 버전)
  const getCharacterImg = (characterIndex, isWinner) => {
    const base = `/characters/c${characterIndex + 1}`;
    return isWinner ? `${base}-win.png` : `${base}.png`;
  };

  const hostCharacterIndex =
    playerRole === 'host' ? myCharacter : hostCharacter;
  const p2CharacterIndex =
    playerRole === 'player2' ? myCharacter : player2Character;
  const p3CharacterIndex =
    playerRole === 'player3' ? myCharacter : player3Character;

  const isHostWinner = gameOver && winner === 'white';
  const isP2Winner = gameOver && winner === 'blue';
  const isP3Winner = gameOver && winner === 'red';

  const players = [
    {
      color: 'white',
      emoji: '⚪',
      label: '백돌',
      nickname: hostNickname || '대기중...',
      characterIndex: hostCharacterIndex,
      isWinner: isHostWinner,
    },
    {
      color: 'blue',
      emoji: '🔵',
      label: '청돌',
      nickname: player2Nickname || '대기중...',
      characterIndex: p2CharacterIndex,
      isWinner: isP2Winner,
    },
    {
      color: 'red',
      emoji: '🔴',
      label: '적돌',
      nickname: player3Nickname || '대기중...',
      characterIndex: p3CharacterIndex,
      isWinner: isP3Winner,
    },
  ];

  return (
    <div className="player-info-bar player-info-bar-3p">
      {players.map((p, i) => (
        <React.Fragment key={p.color}>
          {i > 0 && <div className="vs-divider">VS</div>}
          <div
            className={`player-card ${p.color}-player ${p.isWinner ? 'winner' : ''}`}
          >
            <div className="player-role">
              <span className="stone-icon">{p.emoji}</span>
              <span className="role-text">{p.label}</span>
            </div>
            <div className="player-character">
              <img
                src={getCharacterImg(p.characterIndex, p.isWinner)}
                alt={`${p.label} 캐릭터`}
                className="character-avatar"
              />
            </div>
            <div className="player-name">{p.nickname}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default PlayerInfoBar3P;
