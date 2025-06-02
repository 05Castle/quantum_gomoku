import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import {
  createRoom,
  joinRoom,
  subscribeToRoom,
  leaveRoom,
} from '../services/roomService';
import './MatchingScreen.css';

const MatchingScreen = () => {
  const navigate = useNavigate();

  // Zustand 상태들
  const {
    matchingState,
    myNickname,
    opponentNickname,
    playerRole,
    roomId,
    setPlayerInfo,
    setMatchingState,
    setOpponentNickname,
    resetGame,
  } = useGameStore();

  // 로컬 상태들 (UI 전용)
  const [inputNickname, setInputNickname] = useState(myNickname || '');
  const [inputRoomId, setInputRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [currentRoomId, setCurrentRoomId] = useState('');
  const [currentPlayerRole, setCurrentPlayerRole] = useState('');

  // Firestore 구독 해제 함수
  const [unsubscribeRoom, setUnsubscribeRoom] = useState(null);

  // 닉네임 확인
  const handleNicknameSubmit = () => {
    if (!inputNickname.trim()) {
      setErrorMessage('닉네임을 입력해주세요!');
      return;
    }

    if (inputNickname.length > 10) {
      setErrorMessage('닉네임은 10자 이내로 입력해주세요!');
      return;
    }

    // Zustand에 닉네임 저장
    setPlayerInfo(inputNickname, null, '', '');
    setErrorMessage('');
    setMatchingState('matching');
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (unsubscribeRoom) {
        unsubscribeRoom();
      }
    };
  }, [unsubscribeRoom]);

  // 방 만들기
  const handleCreateRoom = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await createRoom(myNickname);

      if (result.success) {
        // 로컬 상태에 즉시 저장
        setCurrentRoomId(result.roomId);
        setCurrentPlayerRole('host');

        // Zustand에 방 정보 저장
        setPlayerInfo(myNickname, 'host', result.roomId, '');
        setMatchingState('waiting');

        // 방 구독 시작
        const unsubscribe = subscribeToRoom(
          result.roomId,
          (roomData) => handleRoomUpdate(roomData, result.roomId, 'host'),
          handleRoomError
        );
        setUnsubscribeRoom(() => unsubscribe);

        console.log('방 생성 성공:', result.roomId);
      } else {
        setErrorMessage(result.error);
      }
    } catch (error) {
      setErrorMessage('방 생성에 실패했습니다. 다시 시도해주세요.');
      console.error('방 생성 오류:', error);
    }

    setIsLoading(false);
  };

  // 방 참가하기
  const handleJoinRoom = async () => {
    if (!inputRoomId.trim()) {
      setErrorMessage('방 ID를 입력해주세요!');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const roomIdUpper = inputRoomId.toUpperCase();
      const result = await joinRoom(roomIdUpper, myNickname);

      if (result.success) {
        // 로컬 상태에 즉시 저장
        setCurrentRoomId(roomIdUpper);
        setCurrentPlayerRole('guest');

        // Zustand에 방 정보 저장
        setPlayerInfo(
          myNickname,
          'guest',
          roomIdUpper,
          result.roomData.hostNickname
        );
        setMatchingState('connecting');

        // 방 구독 시작
        const unsubscribe = subscribeToRoom(
          roomIdUpper,
          (roomData) => handleRoomUpdate(roomData, roomIdUpper, 'guest'),
          handleRoomError
        );
        setUnsubscribeRoom(() => unsubscribe);

        console.log('방 참가 성공:', roomIdUpper);

        // 게임이 바로 시작되므로 게임 화면으로 이동
        setTimeout(() => {
          startGame(result.roomData.hostNickname, roomIdUpper, 'guest');
        }, 1000);
      } else {
        setErrorMessage(result.error);
      }
    } catch (error) {
      setErrorMessage('방 참가에 실패했습니다. 방 ID를 확인해주세요.');
      console.error('방 참가 오류:', error);
    }

    setIsLoading(false);
  };

  // 방 업데이트 처리
  const handleRoomUpdate = (roomData, gameRoomId, gamePlayerRole) => {
    console.log('방 업데이트:', roomData);
    console.log('전달받은 gameRoomId:', gameRoomId);
    console.log('전달받은 gamePlayerRole:', gamePlayerRole);

    // 상대방이 참가했을 때
    if (
      gamePlayerRole === 'host' &&
      roomData.guestNickname &&
      roomData.status === 'playing'
    ) {
      console.log('게스트 참가됨:', roomData.guestNickname);
      startGame(roomData.guestNickname, gameRoomId, gamePlayerRole);
    }

    // 상대방이 나갔을 때
    if (roomData.status === 'waiting' && roomData.currentPlayerCount === 1) {
      if (gamePlayerRole === 'guest') {
        // 호스트가 나간 경우
        setErrorMessage('호스트가 방을 나갔습니다.');
        handleGoBack();
      }
    }
  };

  // 방 에러 처리
  const handleRoomError = (error) => {
    console.error('방 에러:', error);
    setErrorMessage(error);
    setMatchingState('matching');

    if (unsubscribeRoom) {
      unsubscribeRoom();
      setUnsubscribeRoom(null);
    }
  };

  // 게임 시작
  const startGame = (opponentName, gameRoomId, gamePlayerRole) => {
    console.log('=== 게임 시작 ===');
    console.log('opponentName:', opponentName);
    console.log('gameRoomId:', gameRoomId);
    console.log('gamePlayerRole:', gamePlayerRole);
    console.log('navigate URL:', `/game/${gameRoomId}`);

    // 상대방 닉네임 설정
    setOpponentNickname(opponentName);

    // 게임 상태 초기화
    resetGame();

    // 매칭 상태를 플레이로 변경
    setMatchingState('playing');

    console.log(
      `게임 시작: ${myNickname} vs ${opponentName} (방: ${gameRoomId})`
    );

    // 게임 화면으로 이동 (roomId 포함)
    navigate(`/game/${gameRoomId}`, {
      state: {
        myNickname,
        opponentNickname: opponentName,
        playerRole: gamePlayerRole,
        roomId: gameRoomId,
      },
    });
  };

  // 방 ID 생성 (6자리 랜덤)
  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // 뒤로가기
  const handleGoBack = async () => {
    // Firestore 구독 해제
    if (unsubscribeRoom) {
      unsubscribeRoom();
      setUnsubscribeRoom(null);
    }

    // 방에서 나가기
    if (roomId && playerRole) {
      await leaveRoom(roomId, playerRole);
    }

    setMatchingState('matching');
    setErrorMessage('');
    setInputRoomId('');
  };

  // 닉네임 수정하기
  const handleEditNickname = () => {
    setInputNickname(myNickname);
    setMatchingState('nickname-input');
  };

  // 방 ID 복사
  const copyRoomId = () => {
    navigator.clipboard
      .writeText(roomId)
      .then(() => {
        alert('방 ID가 복사되었습니다!');
      })
      .catch(() => {
        alert('복사에 실패했습니다. 수동으로 복사해주세요.');
      });
  };

  return (
    <div className="matching-container">
      <div className="matching-card">
        <h1 className="game-title">🎯 양자 오목</h1>

        {/* 닉네임 입력 화면 */}
        {matchingState === 'nickname-input' && (
          <div className="nickname-section">
            <h2>닉네임을 입력하세요</h2>
            <div className="input-group">
              <input
                type="text"
                placeholder="닉네임 (최대 10자)"
                value={inputNickname}
                onChange={(e) => setInputNickname(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleNicknameSubmit()}
                maxLength={10}
              />
              <button
                className="btn primary-btn"
                onClick={handleNicknameSubmit}
                disabled={!inputNickname.trim()}
              >
                확인
              </button>
            </div>
          </div>
        )}

        {/* 매칭 선택 화면 */}
        {matchingState === 'matching' && (
          <div className="matching-section">
            <div className="player-info">
              <span className="nickname-display">👤 {myNickname}</span>
            </div>

            <h2>게임 방식을 선택하세요</h2>

            <div className="button-group">
              <button
                className="btn create-btn"
                onClick={handleCreateRoom}
                disabled={isLoading}
              >
                🏠 방 만들기
              </button>

              <div className="join-section">
                <input
                  type="text"
                  placeholder="방 ID 입력"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                  disabled={isLoading}
                />
                <button
                  className="btn join-btn"
                  onClick={handleJoinRoom}
                  disabled={isLoading || !inputRoomId.trim()}
                >
                  🚪 방 참가하기
                </button>
              </div>
            </div>

            <button className="btn back-btn" onClick={handleEditNickname}>
              ← 닉네임 수정
            </button>
          </div>
        )}

        {/* 대기 화면 (방장) */}
        {matchingState === 'waiting' && (
          <div className="waiting-section">
            <div className="player-info">
              <span className="nickname-display">👤 {myNickname} (방장)</span>
            </div>

            <h2>친구를 기다리는 중...</h2>

            <div className="room-info">
              <div className="room-id-display">
                <span>방 ID: </span>
                <strong>{roomId}</strong>
                <button className="copy-btn" onClick={copyRoomId}>
                  📋
                </button>
              </div>
              <p className="room-instruction">
                위 방 ID를 친구에게 알려주세요!
              </p>
            </div>

            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>상대방 접속 대기중...</span>
            </div>

            <button className="btn back-btn" onClick={handleGoBack}>
              ← 뒤로가기
            </button>
          </div>
        )}

        {/* 연결 중 화면 (게스트) */}
        {matchingState === 'connecting' && (
          <div className="connecting-section">
            <div className="player-info">
              <span className="nickname-display">👤 {myNickname}</span>
            </div>

            <h2>게임에 접속 중...</h2>

            <div className="room-info">
              <div className="room-id-display">
                방 ID: <strong>{roomId}</strong>
              </div>
            </div>

            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>게임 연결중...</span>
            </div>

            <button className="btn back-btn" onClick={handleGoBack}>
              ← 뒤로가기
            </button>
          </div>
        )}

        {/* 에러 메시지 */}
        {errorMessage && <div className="error-message">⚠️ {errorMessage}</div>}

        {/* 로딩 오버레이 */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
          </div>
        )}

        {/* 디버깅용 상태 표시 */}
        <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
          <div>매칭 상태: {matchingState}</div>
          <div>플레이어 역할: {playerRole || '없음'}</div>
          <div>방 ID: {roomId || '없음'}</div>
        </div>
      </div>
    </div>
  );
};

export default MatchingScreen;
