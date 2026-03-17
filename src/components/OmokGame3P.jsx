import React, { useCallback, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useGameStore3P, getStoneInfo3P } from '../stores/gameStore3P';
import {
  subscribeToRoom3P,
  sendGameAction3P,
  leaveRoom3P,
} from '../services/roomService3P';
import {
  BOARD_SIZE,
  EMPTY,
  TURN_SEQUENCE_3P,
  GAME_ACTIONS_3P,
} from '../stores/gameStore3P';
import PlayerInfoBar3P from './PlayerInfoBar3P';
import ChatBox from './ChatBox';
import './OmokGame3P.css';

const OmokGame3P = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [opponentLeft, setOpponentLeft] = React.useState(false);
  const [placedCell, setPlacedCell] = React.useState(null);
  const [showPopup, setShowPopup] = React.useState(false);
  const autoPassTimerRef = useRef(null);

  // 마지막으로 처리한 actionId와 resetSignal을 ref로 추적
  const lastProcessedActionId = useRef(null);
  const lastProcessedResetSignal = useRef(null);

  const {
    board,
    turnIndex,
    winner,
    gameOver,
    hasPlacedStone,
    hasChecked,
    winningStones,
    myNickname,
    myColor,
    playerRole,

    placeStone3P,
    executeCheck3P,
    passTurn3P,
    resetGame3P,
    setPlayerInfo3P,
    setMyColor,
    setConnectionState,
    getCurrentTurn3P,
    isMyTurn3P,
    processReceivedAction3P,
    getMyRemainingChecks3P,
    canCheck3P,
    updatePlayersFromRoom,
    getNicknameByColor,
    exitRoom3P,
  } = useGameStore3P();

  const [hoveredCell, setHoveredCell] = React.useState(null);

  useEffect(() => {
    if (location.state) {
      const {
        myNickname,
        myCharacter,
        playerRole,
        hostNickname,
        player2Nickname,
        player3Nickname,
        hostCharacter,
        player2Character,
        player3Character,
      } = location.state;

      setPlayerInfo3P(myNickname, playerRole, roomId, myCharacter || 0);
      setMyColor(playerRole);
      updatePlayersFromRoom({
        hostNickname,
        player2Nickname,
        player3Nickname,
        hostCharacter,
        player2Character,
        player3Character,
      });
    }
  }, [location.state, roomId]);

  useEffect(() => {
    let unsubscribe = null;
    if (roomId && playerRole) {
      unsubscribe = subscribeToRoom3P(
        roomId,
        handleRoomUpdate,
        handleRoomError
      );
      setConnectionState(true);
    }
    return () => {
      if (unsubscribe) {
        unsubscribe();
        setConnectionState(false);
      }
    };
  }, [roomId, playerRole]);

  // 턴 넘어가면 팝업 초기화
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
    // 플레이어 정보 업데이트
    updatePlayersFromRoom(roomData);

    // 상대방 나감 감지
    if (playerRole !== 'host') {
      if (roomData.currentPlayerCount < 3 && roomData.status !== 'playing') {
        setOpponentLeft(true);
        return;
      }
    }

    const currentPlayerRole = useGameStore3P.getState().playerRole;

    // === 리셋 신호 처리 ===
    // resetSignal이 새 값이면 리셋 실행 (리셋한 플레이어 제외)
    if (
      roomData.resetSignal &&
      roomData.resetSignal !== lastProcessedResetSignal.current
    ) {
      lastProcessedResetSignal.current = roomData.resetSignal;
      // 리셋한 플레이어는 이미 로컬에서 직접 리셋했으므로 제외
      // lastAction이 null이면 리셋 신호임
      if (!roomData.lastAction) {
        // 내가 보낸 리셋이 아닌 경우에만 처리
        // (내가 보낸 경우는 handleResetGame에서 직접 처리)
        resetGame3P();
        lastProcessedActionId.current = null;
        playSound('start.mp3');
        return;
      }
    }

    // === lastAction 처리 ===
    if (!roomData.lastAction) return;

    const action = roomData.lastAction;

    // 이미 처리한 액션이면 무시
    if (action.actionId === lastProcessedActionId.current) return;

    // 내가 보낸 액션이면 무시
    if (action.sender === currentPlayerRole) {
      lastProcessedActionId.current = action.actionId;
      return;
    }

    // 새 액션 처리
    lastProcessedActionId.current = action.actionId;
    processReceivedAction3P(action.actionId, action);
  };

  const handleRoomError = (error) => {
    console.error('3인 게임 방 에러:', error);
    setConnectionState(false);
    if (error.includes('삭제') || error.includes('찾을 수 없습니다')) {
      setOpponentLeft(true);
    }
  };

  const handleLeaveConfirm = async () => {
    try {
      await leaveRoom3P(roomId, playerRole);
      exitRoom3P();
      navigate('/', { replace: true });
    } catch (error) {
      exitRoom3P();
      navigate('/', { replace: true });
    }
  };

  const currentTurn = getCurrentTurn3P();
  const isCurrentlyMyTurn = isMyTurn3P();
  const remainingChecks = getMyRemainingChecks3P();

  const getStoneClasses = (stoneInfo, isPreview = false) => {
    if (!stoneInfo) return '';
    let classes = ['stone'];
    if (isPreview) classes.push('preview');
    if (stoneInfo.confirmed) {
      classes.push(`${stoneInfo.player}-confirmed`);
    } else {
      classes.push(`${stoneInfo.player}-${stoneInfo.type}`);
    }
    return classes.join(' ');
  };

  const handlePlaceStone = useCallback(
    (row, col) => {
      if (!isCurrentlyMyTurn) return;
      if (gameOver || board[row][col] !== EMPTY || hasPlacedStone) return;

      playSound('place.mp3');
      const actionData = placeStone3P(row, col);
      if (actionData) {
        sendGameAction3P(roomId, { ...actionData, sender: playerRole });
        setPlacedCell({ row, col });
        setShowPopup(true);
      }
    },
    [
      board,
      gameOver,
      hasPlacedStone,
      isCurrentlyMyTurn,
      placeStone3P,
      roomId,
      playerRole,
    ]
  );

  const handleCheck = () => {
    if (!canCheck3P()) return;
    playSound('check.mp3');
    const state = useGameStore3P.getState();
    const actionData = state.executeCheck3P();
    if (actionData) {
      sendGameAction3P(roomId, {
        ...actionData,
        sender: playerRole,
        turnIndex: state.turnIndex,
      });
      setShowPopup(false);

      if (!actionData.gameOver) {
        autoPassTimerRef.current = setTimeout(() => {
          const s = useGameStore3P.getState();
          if (s.gameOver) return;
          const passData = s.passTurn3P();
          if (passData) {
            sendGameAction3P(roomId, { ...passData, sender: playerRole });
          }
        }, 2000);
      }
    }
  };

  const handlePass = () => {
    if (!isCurrentlyMyTurn) return;
    const actionData = passTurn3P();
    if (actionData) {
      sendGameAction3P(roomId, { ...actionData, sender: playerRole });
      setShowPopup(false);
    }
  };

  const handleResetGame = () => {
    playSound('start.mp3');
    if (autoPassTimerRef.current) clearTimeout(autoPassTimerRef.current);
    // 리셋한 플레이어는 직접 리셋
    resetGame3P();
    lastProcessedActionId.current = null;
    lastProcessedResetSignal.current = null;
    sendGameAction3P(roomId, {
      action: GAME_ACTIONS_3P.RESET_GAME,
      sender: playerRole,
      turnIndex: 0,
      timestamp: Date.now(),
    });
  };

  const getColorEmoji = (color) => {
    if (color === 'white') return '⚪';
    if (color === 'blue') return '🔵';
    return '🔴';
  };

  const getCurrentPlayerDisplay = () => {
    return getNicknameByColor(currentTurn.player) || currentTurn.player;
  };

  const getWinnerDisplay = () => {
    if (winner === 'draw') return '무승부!';
    return getNicknameByColor(winner) || winner;
  };

  const getCellSize = () => (window.innerWidth > 1749 ? 60 : 38);

  const getPopupPosition = (row, col) => {
    const cellSize = getCellSize();
    const popupWidth = 140;
    const popupHeight = 52;

    let top = (row + 1) * cellSize + 8;
    let left = col * cellSize - popupWidth / 2 + cellSize / 2;

    if (row >= BOARD_SIZE - 3) top = row * cellSize - popupHeight - 8;
    if (left < 0) left = 0;
    const boardPixelWidth = BOARD_SIZE * cellSize;
    if (left + popupWidth > boardPixelWidth)
      left = boardPixelWidth - popupWidth;

    return { top, left };
  };

  const renderCell = (row, col) => {
    const cellValue = board[row][col];
    const stoneInfo = getStoneInfo3P(cellValue);
    const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
    const isWinningStone = winningStones.some(
      (s) => s.row === row && s.col === col
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
      <PlayerInfoBar3P />
      <ChatBox roomId={roomId} myNickname={myNickname} />

      {/* 연결 상태 */}
      <div className="connection-status">
        <span className="connection-indicator connected">🟢 연결됨</span>
        <span className="room-id">방 ID: {roomId}</span>
        <button className="btn back-btn" onClick={handleLeaveConfirm}>
          나가기
        </button>
      </div>

      {/* 상단 상태 표시 */}
      <div className="game-status">
        {gameOver ? (
          <>
            <div className="winner-info">
              {winner === 'draw' ? (
                '🤝 무승부!'
              ) : (
                <>{getColorEmoji(winner)} 승리! 🎉</>
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
            {getColorEmoji(currentTurn.player)} {currentTurn.type}돌 (
            {currentTurn.type}% 확률)
            {isCurrentlyMyTurn && (
              <span className="my-turn-indicator"> (내 차례)</span>
            )}
          </div>
        )}
      </div>

      {/* 보드판 + 팝업 */}
      <div className="board-wrapper">
        <div
          className="board"
          style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
        >
          {board.map((row, rowIndex) =>
            row.map((_, colIndex) => renderCell(rowIndex, colIndex))
          )}
        </div>

        {showPopup && placedCell && isCurrentlyMyTurn && !gameOver && (
          <div
            className="action-popup"
            style={getPopupPosition(placedCell.row, placedCell.col)}
          >
            <button
              className={`action-popup-btn check-popup-btn ${!canCheck3P() ? 'disabled' : ''}`}
              onClick={canCheck3P() ? handleCheck : undefined}
              title={`체크 (${remainingChecks}/3)`}
            >
              <span className="material-symbols-outlined">search</span>
              <span className="popup-count">({remainingChecks}/3)</span>
            </button>
            <button
              className="action-popup-btn pass-popup-btn"
              onClick={handlePass}
              title="넘어가기"
            >
              <span className="material-symbols-outlined">double_arrow</span>
            </button>
          </div>
        )}
      </div>

      {/* 상대방 나감 모달 */}
      {opponentLeft && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">😢 플레이어가 연결을 끊었습니다</div>
            <div className="modal-desc">로비 화면으로 이동합니다.</div>
            <button
              className="modal-btn modal-btn-confirm"
              onClick={handleLeaveConfirm}
            >
              나가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OmokGame3P;
