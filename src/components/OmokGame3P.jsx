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
  PLAYER_COLORS,
  FAIL_DIST,
  TYPE_LOW,
  TYPE_HIGH,
} from '../stores/gameStore3P';
import PlayerInfoBar3P from './PlayerInfoBar3P';
import ChatBox from './ChatBox';
import './OmokGame3P.css';

const OmokGame3P = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [opponentLeft, setOpponentLeft] = React.useState(false);
  const [showLeaveModal, setShowLeaveModal] = React.useState(false);
  const [placedCell, setPlacedCell] = React.useState(null);
  const [showPopup, setShowPopup] = React.useState(false);
  const autoPassTimerRef = useRef(null);

  const lastProcessedActionId = useRef(null);
  const lastProcessedResetSignal = useRef(null);
  const lastPlayerLeftSignal = useRef(null);

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

  useEffect(() => {
    if (!hasPlacedStone) {
      setPlacedCell(null);
      setShowPopup(false);
    }
  }, [hasPlacedStone]);

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
    updatePlayersFromRoom(roomData);

    const currentPlayerRole = useGameStore3P.getState().playerRole;

    if (
      roomData.playerLeftSignal &&
      roomData.playerLeftSignal !== lastPlayerLeftSignal.current
    ) {
      lastPlayerLeftSignal.current = roomData.playerLeftSignal;
      const whoLeft = roomData.playerLeftSignal.split('_')[0];
      if (whoLeft !== currentPlayerRole) {
        setOpponentLeft(true);
        return;
      }
    }

    if (
      roomData.resetSignal &&
      roomData.resetSignal !== lastProcessedResetSignal.current
    ) {
      lastProcessedResetSignal.current = roomData.resetSignal;
      if (!roomData.lastAction) {
        resetGame3P();
        lastProcessedActionId.current = null;
        lastPlayerLeftSignal.current = null;
        playSound('start.mp3');
        return;
      }
    }

    if (!roomData.lastAction) return;

    const action = roomData.lastAction;

    if (action.actionId === lastProcessedActionId.current) return;

    if (action.sender === currentPlayerRole) {
      lastProcessedActionId.current = action.actionId;
      return;
    }

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

  // TURN_SEQUENCE_3P에서 type 값을 자동으로 읽어 high 기준값 결정
  // 두 종류의 type 중 큰 쪽이 high, 작은 쪽이 low
  const HIGH_THRESHOLD = (() => {
    const types = TURN_SEQUENCE_3P.map((t) => t.type);
    const unique = [...new Set(types)].sort((a, b) => a - b);
    return unique.length >= 2 ? unique[unique.length - 1] : 90;
  })();

  // type 숫자에 무관하게 high/low로만 CSS 클래스 결정
  const getStoneClasses = (stoneInfo, isPreview = false) => {
    if (!stoneInfo) return '';
    let classes = ['stone'];
    if (isPreview) classes.push('preview');
    if (stoneInfo.confirmed) {
      classes.push(`${stoneInfo.player}-confirmed`);
    } else {
      const level = stoneInfo.type >= HIGH_THRESHOLD ? 'high' : 'low';
      classes.push(`${stoneInfo.player}-${level}`);
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
    resetGame3P();
    lastProcessedActionId.current = null;
    lastProcessedResetSignal.current = null;
    lastPlayerLeftSignal.current = null;
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

  // 현재 턴 돌의 차등 확률 문자열 반환
  // ex) ⚪60% / 🔵25% / 🔴15%
  const getProbabilityDisplay = (player, type) => {
    const idx = PLAYER_COLORS.indexOf(player);
    const next = PLAYER_COLORS[(idx + 1) % 3];
    const nextNext = PLAYER_COLORS[(idx + 2) % 3];
    const dist = FAIL_DIST[type] ?? {
      next: Math.round((100 - type) * 0.625),
      nextNext: Math.round((100 - type) * 0.375),
    };
    return `${getColorEmoji(player)}${type}% / ${getColorEmoji(next)}${dist.next}% / ${getColorEmoji(nextNext)}${dist.nextNext}%`;
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

      {/* 확률 참조표 */}
      <div className="prob-table">
        <div className="prob-table-title">확률 참조표</div>
        {PLAYER_COLORS.map((player) => {
          const idx = PLAYER_COLORS.indexOf(player);
          const next = PLAYER_COLORS[(idx + 1) % 3];
          const nextNext = PLAYER_COLORS[(idx + 2) % 3];
          const emoji = getColorEmoji(player);
          const emojiNext = getColorEmoji(next);
          const emojiNextNext = getColorEmoji(nextNext);
          return [TYPE_LOW, TYPE_HIGH].map((type) => {
            const dist = FAIL_DIST[type];
            return (
              <div key={`${player}-${type}`} className="prob-row">
                <span className="prob-stone">
                  {emoji} {type}돌
                </span>
                <div className="prob-values">
                  <span>
                    {emoji}
                    {type}%
                  </span>
                  <span>
                    {emojiNext}
                    {dist.next}%
                  </span>
                  <span>
                    {emojiNextNext}
                    {dist.nextNext}%
                  </span>
                </div>
              </div>
            );
          });
        })}
      </div>

      <ChatBox roomId={roomId} myNickname={myNickname} />

      {/* 연결 상태 */}
      <div className="connection-status">
        <span className="connection-indicator connected">🟢 연결됨</span>
        <span className="room-id">방 ID: {roomId}</span>
        <button
          className="btn back-btn"
          onClick={() => setShowLeaveModal(true)}
        >
          나가기
        </button>
      </div>

      {/* 나가기 확인 모달 */}
      {showLeaveModal && (
        <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">게임을 나가시겠습니까?</div>
            <div className="modal-desc">
              {playerRole === 'host'
                ? '방이 삭제되고 다른 플레이어들도 로비로 이동됩니다.'
                : '다른 플레이어들에게 알림이 전송됩니다.'}
            </div>
            <div className="modal-buttons">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setShowLeaveModal(false)}
              >
                취소
              </button>
              <button
                className="modal-btn modal-btn-confirm"
                onClick={handleLeaveConfirm}
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}

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
            {getProbabilityDisplay(currentTurn.player, currentTurn.type)})
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
              title={`체크 (${remainingChecks}/4)`}
            >
              <span className="material-symbols-outlined">search</span>
              <span className="popup-count">({remainingChecks}/4)</span>
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
