import React, { useCallback, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useGameStore1v2, getStoneInfo1v2 } from '../stores/gameStore1v2';
import {
  subscribeToRoom1v2,
  sendGameAction1v2,
  leaveRoom1v2,
} from '../services/roomService1v2';
import {
  BOARD_SIZE,
  EMPTY,
  TURN_SEQUENCE_1V2,
  GAME_ACTIONS_1V2,
  TYPE_HIGH,
  isAdjacent,
} from '../stores/gameStore1v2';
import PlayerInfoBar1v2 from './PlayerInfoBar1v2';
import ChatBox from './ChatBox';
import './OmokGame1v2.css';

const OmokGame1v2 = () => {
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
    placedStoneCount,
    hasChecked,
    winningStones,
    myNickname,
    myColor,
    playerRole,
    prevStonePos,

    placeStone1v2,
    executeCheck1v2,
    passTurn1v2,
    resetGame1v2,
    setPlayerInfo1v2,
    setMyColor,
    setConnectionState,
    getCurrentTurn1v2,
    isMyTurn1v2,
    processReceivedAction1v2,
    getMyRemainingChecks1v2,
    canCheck1v2,
    canActAfterPlace1v2,
    updatePlayersFromRoom,
    getNicknameByColor,
    getNicknameByRole,
    exitRoom1v2,
  } = useGameStore1v2();

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

      setPlayerInfo1v2(myNickname, playerRole, roomId, myCharacter || 0);
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
      unsubscribe = subscribeToRoom1v2(
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

  // 팝업 초기화: placedStoneCount가 0으로 돌아오면(턴 넘어감) 초기화
  useEffect(() => {
    if (placedStoneCount === 0) {
      setPlacedCell(null);
      setShowPopup(false);
    }
  }, [placedStoneCount]);

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
    const currentPlayerRole = useGameStore1v2.getState().playerRole;

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
        resetGame1v2();
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
    processReceivedAction1v2(action.actionId, action);
  };

  const handleRoomError = (error) => {
    console.error('1v2 게임 방 에러:', error);
    setConnectionState(false);
    if (error.includes('삭제') || error.includes('찾을 수 없습니다')) {
      setOpponentLeft(true);
    }
  };

  const handleLeaveConfirm = async () => {
    try {
      await leaveRoom1v2(roomId, playerRole);
      exitRoom1v2();
      navigate('/', { replace: true });
    } catch (error) {
      exitRoom1v2();
      navigate('/', { replace: true });
    }
  };

  const currentTurn = getCurrentTurn1v2();
  const isCurrentlyMyTurn = isMyTurn1v2();
  const remainingChecks = getMyRemainingChecks1v2();
  const canAct = canActAfterPlace1v2();

  // 돌 CSS 클래스 결정 (high/low)
  const getStoneClasses = (stoneInfo, isPreview = false) => {
    if (!stoneInfo) return '';
    let classes = ['stone'];
    if (isPreview) classes.push('preview');
    if (stoneInfo.confirmed) {
      classes.push(`${stoneInfo.player}-confirmed`);
    } else {
      const level = stoneInfo.type >= TYPE_HIGH ? 'high' : 'low';
      classes.push(`${stoneInfo.player}-${level}`);
    }
    return classes.join(' ');
  };

  // 착수 핸들러
  // 백: white1 착수 후 바로 white2 착수 가능 (팝업 없음)
  //     white2 착수 완료 후 팝업 표시
  // 흑: 착수 완료 후 바로 팝업 표시
  const handlePlaceStone = useCallback(
    (row, col) => {
      if (!isCurrentlyMyTurn) return;
      if (gameOver || board[row][col] !== EMPTY) return;

      const state = useGameStore1v2.getState();
      const curTurn = TURN_SEQUENCE_1V2[state.turnIndex];
      const isWhite = curTurn.player === 'white';
      const maxStones = isWhite ? 2 : 1;
      if (state.placedStoneCount >= maxStones) return;

      playSound('place.mp3');
      const actionData = placeStone1v2(row, col);
      if (actionData) {
        sendGameAction1v2(roomId, { ...actionData, sender: playerRole });

        // white_single 또는 white2 또는 흑 착수: 팝업 표시
        // white1만 팝업 없이 계속 착수
        if (actionData.phase === 'white1') {
          // 팝업 없음 - 계속 착수 가능
        } else {
          setPlacedCell({ row, col });
          setShowPopup(true);
        }
      }
    },
    [board, gameOver, isCurrentlyMyTurn, placeStone1v2, roomId, playerRole]
  );

  const handleCheck = () => {
    if (!canCheck1v2()) return;
    playSound('check.mp3');
    const state = useGameStore1v2.getState();
    const actionData = state.executeCheck1v2();
    if (actionData) {
      sendGameAction1v2(roomId, {
        ...actionData,
        sender: playerRole,
        turnIndex: state.turnIndex,
      });
      setShowPopup(false);

      if (!actionData.gameOver) {
        autoPassTimerRef.current = setTimeout(() => {
          const s = useGameStore1v2.getState();
          if (s.gameOver) return;
          const passData = s.passTurn1v2();
          if (passData) {
            sendGameAction1v2(roomId, { ...passData, sender: playerRole });
          }
        }, 2000);
      }
    }
  };

  const handlePass = () => {
    if (!canAct) return;
    const actionData = passTurn1v2();
    if (actionData) {
      sendGameAction1v2(roomId, { ...actionData, sender: playerRole });
      setShowPopup(false);
    }
  };

  const handleResetGame = () => {
    playSound('start.mp3');
    if (autoPassTimerRef.current) clearTimeout(autoPassTimerRef.current);
    resetGame1v2();
    lastProcessedActionId.current = null;
    lastProcessedResetSignal.current = null;
    lastPlayerLeftSignal.current = null;
    sendGameAction1v2(roomId, {
      action: GAME_ACTIONS_1V2.RESET_GAME,
      sender: playerRole,
      turnIndex: 0,
      timestamp: Date.now(),
    });
  };

  const getColorEmoji = (color) => (color === 'white' ? '⚪' : '⚫');

  // 현재 턴 플레이어 표시
  // 백: "OOO님의 차례"
  // 흑: sub(player2/player3)의 닉네임
  const getCurrentPlayerDisplay = () => {
    if (currentTurn.player === 'white') return getNicknameByColor('white');
    return getNicknameByRole(currentTurn.sub) || '흑팀';
  };

  // 백 착수 진행 표시 (1/2, 2/2)
  const getWhiteProgressDisplay = () => {
    if (currentTurn.player !== 'white') return '';
    if (currentTurn.phase === 'white_single') return '';
    if (currentTurn.phase === 'white1' && placedStoneCount === 0)
      return ' [1번째 착수]';
    if (currentTurn.phase === 'white2' && placedStoneCount === 1)
      return ' [2번째 착수]';
    return '';
  };

  const getWinnerDisplay = () => {
    if (winner === 'draw') return '무승부!';
    if (winner === 'white') return getNicknameByColor('white');
    return `${getNicknameByRole('player2')} & ${getNicknameByRole('player3')}`;
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
    const stoneInfo = getStoneInfo1v2(cellValue);
    const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
    const isWinningStone = winningStones.some(
      (s) => s.row === row && s.col === col
    );

    // 이어붙이기 금지: prevStonePos가 있으면 활성
    const isBlocked =
      cellValue === EMPTY &&
      prevStonePos &&
      isAdjacent(row, col, prevStonePos.row, prevStonePos.col);

    // 호버 프리뷰: 막힌 칸이거나 착수 완료면 안 보임
    const canPreview =
      isCurrentlyMyTurn &&
      cellValue === EMPTY &&
      !isBlocked &&
      !gameOver &&
      (() => {
        const state = useGameStore1v2.getState();
        const cur = TURN_SEQUENCE_1V2[state.turnIndex];
        const maxStones =
          cur.player === 'white' && cur.phase !== 'white_single' ? 2 : 1;
        return state.placedStoneCount < maxStones;
      })();

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
        {/* 인접 금지 X 표시 */}
        {isBlocked && isCurrentlyMyTurn && !gameOver && (
          <div className="blocked-cell">✕</div>
        )}
        {/* 호버 프리뷰 */}
        {isHovered && canPreview && (
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
      <PlayerInfoBar1v2 />
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
            {getColorEmoji(currentTurn.player)} {currentTurn.type}돌
            {getWhiteProgressDisplay()} ({currentTurn.type}% / 상대{' '}
            {100 - currentTurn.type}%)
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

        {showPopup &&
          placedCell &&
          isCurrentlyMyTurn &&
          !gameOver &&
          canAct && (
            <div
              className="action-popup"
              style={getPopupPosition(placedCell.row, placedCell.col)}
            >
              <button
                className={`action-popup-btn check-popup-btn ${!canCheck1v2() ? 'disabled' : ''}`}
                onClick={canCheck1v2() ? handleCheck : undefined}
                title={`체크 (${remainingChecks}회 남음)`}
              >
                <span className="material-symbols-outlined">search</span>
                <span className="popup-count">({remainingChecks})</span>
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

export default OmokGame1v2;
