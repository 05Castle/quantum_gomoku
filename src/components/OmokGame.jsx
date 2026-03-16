import React, { useCallback, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { subscribeToRoom, sendGameAction } from '../services/roomService';
import {
  BOARD_SIZE,
  EMPTY,
  BLACK_CONFIRMED,
  WHITE_CONFIRMED,
  TURN_SEQUENCE,
  GAME_ACTIONS,
} from '../stores/gameStore';
import PlayerInfoBar from './PlayerInfoBar';
import ConnectionStatus from './ConnectionStatus';
import './OmokGame.css';

const OmokGame = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [opponentLeft, setOpponentLeft] = React.useState(false);

  const {
    board,
    turnIndex,
    winner,
    gameOver,
    hasPlacedStone,
    hasChecked,
    winningStones,
    myNickname,
    opponentNickname,
    playerRole,
    myColor,

    placeStone,
    executeCheck,
    passTurn,
    resetGame,
    setPlayerInfo,
    getCurrentTurn,
    isMyTurn,
    processReceivedAction,
    setConnectionState,
    getMyRemainingChecks,
    canCheck,
    setOpponentCharacter,
    setStoneColors, // Ver 1.3
  } = useGameStore();

  const [hoveredCell, setHoveredCell] = React.useState(null);

  // 컴포넌트 마운트 시 플레이어 정보 설정
  useEffect(() => {
    if (location.state) {
      const {
        myNickname,
        myCharacter,
        opponentNickname,
        opponentCharacter,
        playerRole,
        hostColor,
      } = location.state;

      setPlayerInfo(
        myNickname,
        playerRole,
        roomId,
        opponentNickname,
        myCharacter || 0,
        opponentCharacter || 0
      );

      if (opponentCharacter !== undefined) {
        setOpponentCharacter(opponentCharacter);
      }

      // Ver 1.3: 돌 색상 설정
      if (hostColor) {
        setStoneColors(hostColor);
      }
    }
  }, [
    location.state,
    roomId,
    setPlayerInfo,
    setOpponentCharacter,
    setStoneColors,
  ]);

  // 방 구독 시작
  useEffect(() => {
    let unsubscribe = null;

    if (roomId && playerRole) {
      unsubscribe = subscribeToRoom(roomId, handleRoomUpdate, handleRoomError);
      setConnectionState(true);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
        setConnectionState(false);
      }
    };
  }, [roomId, playerRole]);

  const playSound = (soundFile) => {
    try {
      const audio = new Audio(`/sounds/${soundFile}`);
      audio.play().catch(() => {});
    } catch (error) {}
  };

  // 방 업데이트 처리
  const handleRoomUpdate = (roomData) => {
    if (
      playerRole === 'guest' &&
      roomData.status === 'waiting' &&
      !roomData.guestNickname
    ) {
      return;
    }

    if (playerRole === 'host') {
      if (
        roomData.status === 'waiting' &&
        roomData.currentPlayerCount === 1 &&
        opponentNickname
      ) {
        setOpponentLeft(true);
        return;
      }
    }

    // 상대방 캐릭터 정보 업데이트
    if (
      roomData.hostCharacter !== undefined &&
      roomData.guestCharacter !== undefined
    ) {
      const opponentCharacterIndex =
        playerRole === 'host'
          ? roomData.guestCharacter
          : roomData.hostCharacter;
      setOpponentCharacter(opponentCharacterIndex);
    }

    // Ver 1.3: 새 게임 시작 시 색상 재배정 감지
    if (roomData.hostColor) {
      setStoneColors(roomData.hostColor);
    }

    // 상대방의 게임 액션 처리
    if (roomData.currentAction) {
      const action = roomData.currentAction;
      if (action.sender !== playerRole) {
        processReceivedAction(action);
      }
    }
  };

  const handleRoomError = (error) => {
    console.error('게임 중 방 에러:', error);
    setConnectionState(false);
    if (error.includes('삭제') || error.includes('찾을 수 없습니다')) {
      setOpponentLeft(true);
    }
  };

  const currentTurn = getCurrentTurn();
  const isCurrentlyMyTurn = isMyTurn();
  const remainingChecks = getMyRemainingChecks();

  const getStoneInfo = (cellValue) => {
    const BLACK_90 = 1,
      BLACK_70 = 2,
      WHITE_90 = 4,
      WHITE_70 = 5;
    switch (cellValue) {
      case BLACK_90:
        return { player: 'black', type: 90, confirmed: false };
      case BLACK_70:
        return { player: 'black', type: 70, confirmed: false };
      case BLACK_CONFIRMED:
        return { player: 'black', type: 100, confirmed: true };
      case WHITE_90:
        return { player: 'white', type: 90, confirmed: false };
      case WHITE_70:
        return { player: 'white', type: 70, confirmed: false };
      case WHITE_CONFIRMED:
        return { player: 'white', type: 100, confirmed: true };
      default:
        return null;
    }
  };

  const getStoneClasses = (stoneInfo, isPreview = false) => {
    if (!stoneInfo) return '';
    let classes = ['stone'];
    if (isPreview) classes.push('preview');
    if (stoneInfo.confirmed) {
      classes.push(
        stoneInfo.player === 'black' ? 'black-confirmed' : 'white-confirmed'
      );
    } else {
      if (stoneInfo.player === 'black') {
        classes.push(stoneInfo.type === 90 ? 'black-90' : 'black-70');
      } else {
        classes.push(stoneInfo.type === 90 ? 'white-90' : 'white-70');
      }
    }
    return classes.join(' ');
  };

  const handlePlaceStone = useCallback(
    (row, col) => {
      if (!isCurrentlyMyTurn) return;
      if (gameOver || board[row][col] !== EMPTY || hasPlacedStone) return;

      playSound('place.mp3');
      const actionData = placeStone(row, col);
      if (actionData) {
        sendGameAction(roomId, { ...actionData, sender: playerRole });
      }
    },
    [
      board,
      gameOver,
      hasPlacedStone,
      isCurrentlyMyTurn,
      placeStone,
      roomId,
      playerRole,
    ]
  );

  const handleCheck = () => {
    if (!canCheck()) return;
    playSound('check.mp3');
    const actionData = executeCheck();
    if (actionData) {
      sendGameAction(roomId, { ...actionData, sender: playerRole });
    }
  };

  const handlePass = () => {
    if (!isCurrentlyMyTurn) return;
    const actionData = passTurn();
    if (actionData) {
      sendGameAction(roomId, { ...actionData, sender: playerRole });
    }
  };

  const handleResetGame = () => {
    playSound('start.mp3');
    resetGame();
    sendGameAction(roomId, {
      action: GAME_ACTIONS.RESET_GAME,
      timestamp: Date.now(),
      sender: playerRole,
    });
  };

  // Ver 1.3: myColor 기준으로 현재 플레이어 닉네임 표시
  const getCurrentPlayerDisplay = () => {
    if (currentTurn.player === myColor) return myNickname;
    return opponentNickname;
  };

  // Ver 1.3: myColor 기준으로 승리자 닉네임 표시
  const getWinnerDisplay = () => {
    if (winner === 'draw') return '무승부!';
    if (winner === myColor) return myNickname;
    return opponentNickname;
  };

  const renderCell = (row, col) => {
    const cellValue = board[row][col];
    const stoneInfo = getStoneInfo(cellValue);
    const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
    const isWinningStone = winningStones.some(
      (stone) => stone.row === row && stone.col === col
    );

    return (
      <div
        key={`${row}-${col}`}
        className="cell"
        onClick={() => handlePlaceStone(row, col)}
        onMouseEnter={() => setHoveredCell({ row, col })}
        onMouseLeave={() => setHoveredCell(null)}
      >
        <div className="grid-line-horizontal"></div>
        <div className="grid-line-vertical"></div>
        <div
          className={`intersection-dot ${isHovered && cellValue === EMPTY ? 'hovered' : ''}`}
        ></div>
        {stoneInfo && (
          <div
            className={`${getStoneClasses(stoneInfo)} ${isWinningStone ? 'winning' : ''}`}
          >
            {!stoneInfo.confirmed && stoneInfo.type}
          </div>
        )}
        {cellValue === EMPTY &&
          isHovered &&
          !gameOver &&
          !hasPlacedStone &&
          isCurrentlyMyTurn && (
            <div
              className={getStoneClasses(
                {
                  player: currentTurn.player,
                  type: currentTurn.type,
                  confirmed: false,
                },
                true
              )}
            >
              {currentTurn.type}
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="game-container">
      <PlayerInfoBar />
      <ConnectionStatus opponentLeft={opponentLeft} />

      <div className="game-status">
        {gameOver ? (
          <>
            <div className="winner-info">
              {winner === 'draw' ? (
                '🤝 무승부!'
              ) : (
                <>{winner === 'black' ? '⚫ 흑돌' : '⚪ 백돌'} 승리! 🎉</>
              )}
            </div>
            <div className="winner-name">
              {winner === 'draw'
                ? '모든 체크 기회를 사용했습니다'
                : `${getWinnerDisplay()} 승리!`}
            </div>
            <div className="btn-container">
              <div className="btn check-btn" onClick={handleResetGame}>
                새 게임 시작!
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="current-player">
              {getCurrentPlayerDisplay()}님의 차례 -{' '}
              {currentTurn.player === 'black' ? '⚫' : '⚪'} {currentTurn.type}
              돌 ({currentTurn.type}% 확률)
              {isCurrentlyMyTurn && (
                <span className="my-turn-indicator"> (내 차례)</span>
              )}
            </div>
            {hasPlacedStone && isCurrentlyMyTurn && (
              <div className="btn-container">
                <div
                  className={`btn check-btn ${!canCheck() ? 'disabled' : ''} ${remainingChecks === 0 ? 'no-checks' : ''}`}
                  onClick={canCheck() ? handleCheck : undefined}
                >
                  체크! ({remainingChecks}/4)
                </div>
                <div className="btn pass-btn" onClick={handlePass}>
                  넘어가기!
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div
        className="board"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
      >
        {board.map((row, rowIndex) =>
          row.map((_, colIndex) => renderCell(rowIndex, colIndex))
        )}
      </div>
    </div>
  );
};

export default OmokGame;
