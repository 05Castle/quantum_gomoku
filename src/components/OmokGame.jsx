import React, { useCallback, useEffect, useRef } from 'react';
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
import ChatBox from './ChatBox';
import './OmokGame.css';

const OmokGame = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [opponentLeft, setOpponentLeft] = React.useState(false);

  // Ver 1.3: 착수 위치 팝업용 상태
  const [placedCell, setPlacedCell] = React.useState(null);
  const [showPopup, setShowPopup] = React.useState(false);
  const autoPassTimerRef = useRef(null);

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
    setStoneColors,
  } = useGameStore();

  const [hoveredCell, setHoveredCell] = React.useState(null);

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
      if (opponentCharacter !== undefined)
        setOpponentCharacter(opponentCharacter);
      if (hostColor) setStoneColors(hostColor);
    }
  }, [
    location.state,
    roomId,
    setPlayerInfo,
    setOpponentCharacter,
    setStoneColors,
  ]);

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

  // 턴이 넘어가면 팝업 초기화
  useEffect(() => {
    if (!hasPlacedStone) {
      setPlacedCell(null);
      setShowPopup(false);
    }
  }, [hasPlacedStone]);

  // 게임 리셋 시 팝업 초기화
  useEffect(() => {
    if (!gameOver) {
      setPlacedCell(null);
      setShowPopup(false);
    }
  }, [gameOver]);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (autoPassTimerRef.current) clearTimeout(autoPassTimerRef.current);
    };
  }, []);

  const playSound = (soundFile) => {
    try {
      const audio = new Audio(`/sounds/${soundFile}`);
      audio.play().catch(() => {});
    } catch (error) {}
  };

  const handleRoomUpdate = (roomData) => {
    if (
      playerRole === 'guest' &&
      roomData.status === 'waiting' &&
      !roomData.guestNickname
    )
      return;

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

    if (roomData.hostColor) setStoneColors(roomData.hostColor);

    if (roomData.currentAction) {
      const action = roomData.currentAction;
      if (action.sender !== playerRole) processReceivedAction(action);
    }
  };

  const handleRoomError = (error) => {
    console.error('게임 중 방 에러:', error);
    setConnectionState(false);
    if (error.includes('삭제') || error.includes('찾을 수 없습니다'))
      setOpponentLeft(true);
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
      classes.push(
        stoneInfo.player === 'black'
          ? stoneInfo.type === 90
            ? 'black-90'
            : 'black-70'
          : stoneInfo.type === 90
            ? 'white-90'
            : 'white-70'
      );
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
        setPlacedCell({ row, col });
        setShowPopup(true);
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
      setShowPopup(false);

      // 승부가 나지 않은 경우에만 2초 후 자동 턴 넘김
      if (!actionData.gameOver) {
        autoPassTimerRef.current = setTimeout(() => {
          const state = useGameStore.getState();
          if (state.gameOver) return; // 혹시 모를 중복 방지
          const passData = state.passTurn();
          if (passData) {
            sendGameAction(roomId, { ...passData, sender: playerRole });
          }
        }, 2000);
      }
    }
  };

  const handlePass = () => {
    if (!isCurrentlyMyTurn) return;
    const actionData = passTurn();
    if (actionData) {
      sendGameAction(roomId, { ...actionData, sender: playerRole });
      setShowPopup(false);
    }
  };

  const handleResetGame = () => {
    playSound('start.mp3');
    if (autoPassTimerRef.current) clearTimeout(autoPassTimerRef.current);
    resetGame();
    sendGameAction(roomId, {
      action: GAME_ACTIONS.RESET_GAME,
      timestamp: Date.now(),
      sender: playerRole,
    });
  };

  const getCurrentPlayerDisplay = () => {
    if (currentTurn.player === myColor) return myNickname;
    return opponentNickname;
  };

  const getWinnerDisplay = () => {
    if (winner === 'draw') return '무승부!';
    if (winner === myColor) return myNickname;
    return opponentNickname;
  };

  // 팝업 위치 계산 (보드 가장자리 처리)
  const getCellSize = () => (window.innerWidth > 1749 ? 60 : 38);

  const getPopupPosition = (row, col) => {
    const cellSize = getCellSize();
    const popupWidth = 140;
    const popupHeight = 52;

    // 기본: 돌 아래에 표시
    let top = (row + 1) * cellSize + 8;
    let left = col * cellSize - popupWidth / 2 + cellSize / 2;

    // 보드 하단 가장자리 → 돌 위에 표시
    if (row >= BOARD_SIZE - 3) {
      top = row * cellSize - popupHeight - 8;
    }

    // 좌우 가장자리 처리
    if (left < 0) left = 0;
    const boardPixelWidth = BOARD_SIZE * cellSize;
    if (left + popupWidth > boardPixelWidth)
      left = boardPixelWidth - popupWidth;

    return { top, left };
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
      <ChatBox roomId={roomId} myNickname={myNickname} />
      <ConnectionStatus opponentLeft={opponentLeft} />

      {/* 상단 상태 표시 */}
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
          <div className="current-player">
            {getCurrentPlayerDisplay()}님의 차례 -{' '}
            {currentTurn.player === 'black' ? '⚫' : '⚪'} {currentTurn.type}돌
            ({currentTurn.type}% 확률)
            {isCurrentlyMyTurn && (
              <span className="my-turn-indicator"> (내 차례)</span>
            )}
          </div>
        )}
      </div>

      {/* 보드판 + 인라인 팝업 래퍼 */}
      <div className="board-wrapper">
        <div
          className="board"
          style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
        >
          {board.map((row, rowIndex) =>
            row.map((_, colIndex) => renderCell(rowIndex, colIndex))
          )}
        </div>

        {/* Ver 1.3: 착수 후 인라인 액션 팝업 */}
        {showPopup && placedCell && isCurrentlyMyTurn && !gameOver && (
          <div
            className="action-popup"
            style={getPopupPosition(placedCell.row, placedCell.col)}
          >
            <button
              className={`action-popup-btn check-popup-btn ${!canCheck() ? 'disabled' : ''}`}
              onClick={canCheck() ? handleCheck : undefined}
              title={`체크 (${remainingChecks}/4)`}
            >
              <span class="material-symbols-outlined">search</span>
              <span className="popup-count">({remainingChecks}/4)</span>
            </button>
            <button
              className="action-popup-btn pass-popup-btn"
              onClick={handlePass}
              title="넘어가기"
            >
              <span class="material-symbols-outlined">double_arrow</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OmokGame;
