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

  // Zustand 상태들
  const {
    // 상태
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

    // 액션들
    placeStone,
    executeCheck,
    passTurn,
    resetGame,
    setPlayerInfo,
    getCurrentTurn,
    isMyTurn,
    processReceivedAction,
    setConnectionState,
  } = useGameStore();

  // 호버 상태 (로컬에서만 관리)
  const [hoveredCell, setHoveredCell] = React.useState(null);

  // Firestore 구독 해제 함수
  const [unsubscribeRoom, setUnsubscribeRoom] = React.useState(null);

  // 컴포넌트 마운트 시 플레이어 정보 설정
  useEffect(() => {
    if (location.state) {
      const { myNickname, opponentNickname, playerRole } = location.state;
      setPlayerInfo(myNickname, playerRole, roomId, opponentNickname);
      console.log('플레이어 정보 설정:', {
        myNickname,
        opponentNickname,
        playerRole,
        roomId,
      });
    }
  }, [location.state, roomId, setPlayerInfo]);

  // 방 구독 시작
  useEffect(() => {
    console.log('=== 구독 useEffect 실행 ===');
    console.log('roomId:', roomId);
    console.log('playerRole:', playerRole);
    console.log('unsubscribeRoom 존재:', !!unsubscribeRoom);

    if (roomId && !unsubscribeRoom && playerRole) {
      console.log('🔥 새로운 구독 시작:', roomId);

      const unsubscribe = subscribeToRoom(
        roomId,
        handleRoomUpdate,
        handleRoomError
      );

      setUnsubscribeRoom(() => unsubscribe);
      setConnectionState(true);
      console.log('✅ 구독 설정 완료');
    } else {
      console.log('❌ 구독 조건 불만족');
    }

    return () => {
      if (unsubscribeRoom) {
        console.log('🛑 구독 해제');
        unsubscribeRoom();
        setConnectionState(false);
      }
    };
  }, [roomId, playerRole]);

  // 방 업데이트 처리
  const handleRoomUpdate = (roomData) => {
    console.log('=== 방 업데이트 수신 ===');
    console.log('currentAction:', roomData.currentAction);

    // 상대방의 게임 액션 처리
    if (roomData.currentAction) {
      const action = roomData.currentAction;
      console.log('액션 타입:', action.action);
      console.log('보낸 사람:', action.sender);
      console.log('내 역할:', playerRole);
      console.log('조건 체크:', action.sender, '!==', playerRole);
      console.log('조건 결과:', action.sender !== playerRole);

      // 내가 보낸 액션은 무시 (중복 처리 방지)
      if (action.sender !== playerRole) {
        console.log('💡 상대방 액션이므로 처리합니다');
        processReceivedAction(action);
      } else {
        console.log('⚠️ 내가 보낸 액션이므로 무시합니다');
      }
    }
  };

  // 방 에러 처리
  const handleRoomError = (error) => {
    console.error('게임 중 방 에러:', error);
    setConnectionState(false);

    // 심각한 에러인 경우 매칭 화면으로 이동
    if (error.includes('삭제') || error.includes('찾을 수 없습니다')) {
      alert('게임 연결이 끊어졌습니다. 매칭 화면으로 돌아갑니다.');
      navigate('/');
    }
  };

  const currentTurn = getCurrentTurn();
  const isCurrentlyMyTurn = isMyTurn();

  const playSound = (soundFile) => {
    try {
      const audio = new Audio(`/sounds/${soundFile}`);
      audio.play().catch((err) => console.log('Sound play failed:', err));
    } catch (error) {
      console.log('Sound error:', error);
    }
  };

  // 돌 타입을 셀 값으로 변환
  const getStoneValue = (player, type) => {
    const BLACK_90 = 1,
      BLACK_70 = 2,
      WHITE_90 = 4,
      WHITE_70 = 5;
    if (player === 'black') {
      return type === 90 ? BLACK_90 : BLACK_70;
    } else {
      return type === 90 ? WHITE_90 : WHITE_70;
    }
  };

  // 셀 값을 돌 정보로 변환
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

  // 돌 CSS 클래스 반환
  const getStoneClasses = (stoneInfo, isPreview = false) => {
    if (!stoneInfo) return '';

    let classes = ['stone'];

    if (isPreview) {
      classes.push('preview');
    }

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

  // === 이벤트 핸들러들 ===

  // 돌 놓기
  const handlePlaceStone = useCallback(
    (row, col) => {
      // 내 턴이 아니면 무시
      if (!isCurrentlyMyTurn) {
        console.log('내 턴이 아닙니다');
        return;
      }

      if (gameOver || board[row][col] !== EMPTY || hasPlacedStone) return;

      playSound('place.mp3');

      const actionData = placeStone(row, col);

      // Firestore로 액션 전송
      if (actionData) {
        const actionWithSender = {
          ...actionData,
          sender: playerRole,
        };

        console.log('돌 놓기 액션 전송:', actionWithSender);
        sendGameAction(roomId, actionWithSender);
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

  // 체크 기능
  const handleCheck = () => {
    if (!isCurrentlyMyTurn) {
      console.log('내 턴이 아닙니다');
      return;
    }

    if (gameOver || hasChecked) return;

    playSound('check.mp3');

    const actionData = executeCheck();

    // Firestore로 액션 전송
    if (actionData) {
      const actionWithSender = {
        ...actionData,
        sender: playerRole,
      };

      console.log('체크 액션 전송:', actionWithSender);
      sendGameAction(roomId, actionWithSender);
    }
  };

  // 넘어가기
  const handlePass = () => {
    if (!isCurrentlyMyTurn) {
      console.log('내 턴이 아닙니다');
      return;
    }

    const actionData = passTurn();

    // Firestore로 액션 전송
    if (actionData) {
      const actionWithSender = {
        ...actionData,
        sender: playerRole,
      };

      console.log('넘어가기 액션 전송:', actionWithSender);
      sendGameAction(roomId, actionWithSender);
    }
  };

  // 게임 리셋
  const handleResetGame = () => {
    playSound('start.mp3');
    resetGame();

    const actionData = {
      action: GAME_ACTIONS.RESET_GAME,
      timestamp: Date.now(),
      sender: playerRole,
    };

    console.log('리셋 액션 전송:', actionData);
    sendGameAction(roomId, actionData);
  };

  // 현재 플레이어 정보 표시용
  const getCurrentPlayerDisplay = () => {
    if (currentTurn.player === 'black') {
      return playerRole === 'host' ? myNickname : opponentNickname;
    } else {
      return playerRole === 'guest' ? myNickname : opponentNickname;
    }
  };

  // === 렌더링 함수들 ===

  // 셀 렌더링
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
        {/* 격자선 */}
        <div className="grid-line-horizontal"></div>
        <div className="grid-line-vertical"></div>

        {/* 교점 점 */}
        <div
          className={`intersection-dot ${isHovered && cellValue === EMPTY ? 'hovered' : ''}`}
        ></div>

        {/* 실제 돌 */}
        {stoneInfo && (
          <div
            className={`${getStoneClasses(stoneInfo)} ${isWinningStone ? 'winning' : ''}`}
          >
            {!stoneInfo.confirmed && stoneInfo.type}
          </div>
        )}

        {/* 미리보기 돌 (내 턴일 때만) */}
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
      {/* 독립된 컴포넌트들 */}
      <PlayerInfoBar />
      <ConnectionStatus />

      {/* 게임 상태 */}
      <div className="game-status">
        {gameOver ? (
          // 게임 종료 시: 승리자 + 리셋 버튼
          <>
            <div className="winner-info">
              🎉 {winner === 'black' ? '⚫ 흑돌' : '⚪ 백돌'} 승리! 🎉
            </div>
            <div className="winner-name">
              {winner === 'black'
                ? playerRole === 'host'
                  ? myNickname
                  : opponentNickname
                : playerRole === 'guest'
                  ? myNickname
                  : opponentNickname}{' '}
              승리!
            </div>
            <div className="btn-container">
              <div className="btn check-btn" onClick={handleResetGame}>
                새 게임 시작!
              </div>
            </div>
          </>
        ) : (
          // 게임 진행 시
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
                  className={`btn check-btn ${hasChecked ? 'disabled' : ''}`}
                  onClick={hasChecked ? undefined : handleCheck}
                >
                  체크!
                </div>
                <div className="btn pass-btn" onClick={handlePass}>
                  넘어가기!
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 게임 보드 */}
      <div
        className="board"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
      >
        {board.map((row, rowIndex) =>
          row.map((_, colIndex) => renderCell(rowIndex, colIndex))
        )}
      </div>

      {/* 디버깅용 정보 */}
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        <div>
          내 역할: {playerRole} | 내 닉네임: {myNickname} | 상대방:{' '}
          {opponentNickname}
        </div>
        <div>
          현재 턴: {currentTurn.player} | 내 턴:{' '}
          {isCurrentlyMyTurn ? 'Yes' : 'No'}
        </div>
      </div>
    </div>
  );
};

export default OmokGame;
