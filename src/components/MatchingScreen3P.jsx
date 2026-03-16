import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameStore3P } from '../stores/gameStore3P';
import {
  createRoom3P,
  joinRoom3P,
  subscribeToRoom3P,
  leaveRoom3P,
} from '../services/roomService3P';
import title from '../assets/title.png';
import './MatchingScreen.css';

const MatchingScreen3P = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 2인 매칭에서 넘어온 닉네임/캐릭터 정보
  const { myNickname: initNickname, myCharacter: initCharacter } =
    location.state || {};

  const {
    setPlayerInfo3P,
    setMyColor,
    setConnectionState,
    setMatchingState,
    updatePlayersFromRoom,
    resetGame3P,
    exitRoom3P,
    matchingState,
  } = useGameStore3P();

  const [myNickname] = useState(initNickname || '');
  const [myCharacter] = useState(initCharacter ?? 0);

  const [inputRoomId, setInputRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [roomId, setRoomId] = useState('');
  const [playerRole, setPlayerRole] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [unsubscribeRoom, setUnsubscribeRoom] = useState(null);

  // 플레이어 수 표시용
  const [currentPlayerCount, setCurrentPlayerCount] = useState(1);
  const [playerNames, setPlayerNames] = useState([]);

  useEffect(() => {
    return () => {
      if (unsubscribeRoom) unsubscribeRoom();
    };
  }, [unsubscribeRoom]);

  // 방 만들기
  const handleCreateRoom = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await createRoom3P(myNickname, myCharacter);

      if (result.success) {
        setRoomId(result.roomId);
        setPlayerRole('host');

        setPlayerInfo3P(myNickname, 'host', result.roomId, myCharacter);
        setMyColor('host');
        setMatchingState('waiting');

        const unsubscribe = subscribeToRoom3P(
          result.roomId,
          (roomData) => handleRoomUpdate(roomData, result.roomId, 'host'),
          handleRoomError
        );
        setUnsubscribeRoom(() => unsubscribe);
      } else {
        setErrorMessage(result.error);
      }
    } catch (error) {
      setErrorMessage('방 생성에 실패했습니다. 다시 시도해주세요.');
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
      const result = await joinRoom3P(roomIdUpper, myNickname, myCharacter);

      if (result.success) {
        setRoomId(roomIdUpper);
        setPlayerRole(result.playerRole);

        setPlayerInfo3P(
          myNickname,
          result.playerRole,
          roomIdUpper,
          myCharacter
        );
        setMyColor(result.playerRole);
        updatePlayersFromRoom(result.roomData);
        setMatchingState('waiting');

        const unsubscribe = subscribeToRoom3P(
          roomIdUpper,
          (roomData) =>
            handleRoomUpdate(roomData, roomIdUpper, result.playerRole),
          handleRoomError
        );
        setUnsubscribeRoom(() => unsubscribe);
      } else {
        setErrorMessage(result.error);
      }
    } catch (error) {
      setErrorMessage('방 참가에 실패했습니다. 방 ID를 확인해주세요.');
    }

    setIsLoading(false);
  };

  // 방 업데이트 처리
  const handleRoomUpdate = (roomData, gameRoomId, gamePlayerRole) => {
    setCurrentPlayerCount(roomData.currentPlayerCount || 1);
    updatePlayersFromRoom(roomData);

    // 참가자 목록 업데이트
    const names = [roomData.hostNickname];
    if (roomData.player2Nickname) names.push(roomData.player2Nickname);
    if (roomData.player3Nickname) names.push(roomData.player3Nickname);
    setPlayerNames(names);

    // 3명 모두 모이면 게임 시작
    if (roomData.status === 'playing' && roomData.currentPlayerCount === 3) {
      startGame(gameRoomId, gamePlayerRole, roomData);
    }

    // 호스트가 나간 경우
    if (!roomData.hostNickname || roomData.status === 'waiting') {
      if (gamePlayerRole !== 'host') {
        setErrorMessage('호스트가 방을 나갔습니다.');
        handleGoBack();
      }
    }
  };

  const handleRoomError = (error) => {
    console.error('3인 방 에러:', error);
    setErrorMessage(error);
    setMatchingState('waiting');
    if (unsubscribeRoom) {
      unsubscribeRoom();
      setUnsubscribeRoom(null);
    }
  };

  const startGame = (gameRoomId, gamePlayerRole, roomData) => {
    resetGame3P();
    setConnectionState(true);

    navigate(`/game3p/${gameRoomId}`, {
      state: {
        myNickname,
        myCharacter,
        playerRole: gamePlayerRole,
        roomId: gameRoomId,
        hostNickname: roomData.hostNickname,
        player2Nickname: roomData.player2Nickname,
        player3Nickname: roomData.player3Nickname,
        hostCharacter: roomData.hostCharacter,
        player2Character: roomData.player2Character,
        player3Character: roomData.player3Character,
      },
    });
  };

  const handleGoBack = async () => {
    if (unsubscribeRoom) {
      unsubscribeRoom();
      setUnsubscribeRoom(null);
    }
    if (roomId && playerRole) {
      await leaveRoom3P(roomId, playerRole);
    }
    exitRoom3P();
    navigate('/');
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      alert('복사에 실패했습니다. 수동으로 복사해주세요.');
    }
  };

  const getColorLabel = (role) => {
    if (role === 'host') return '⚪ 백돌';
    if (role === 'player2') return '🔵 청돌';
    return '🔴 적돌';
  };

  return (
    <div className="matching-container">
      <div className="matching-card">
        <h1 className="game-title">램램도 이길 수 있다!</h1>
        <img className="title-img" src={title} alt="양자오목" />
        <div className="mode-badge">👥👤 3인 모드</div>

        {/* 대기 화면 */}
        <div className="waiting-section">
          <div className="player-info">
            <div className="player-info-with-character">
              <span className="nickname-display">
                👤 {myNickname} ({getColorLabel(playerRole || 'host')})
              </span>
            </div>
          </div>

          {/* 방 만들기 전 */}
          {!roomId && (
            <>
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
                    onChange={(e) =>
                      setInputRoomId(e.target.value.toUpperCase())
                    }
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                    disabled={isLoading}
                  />
                  <button
                    className="btn join-btn"
                    onClick={handleJoinRoom}
                    disabled={isLoading || !inputRoomId.trim()}
                  >
                    🚪 참가하기
                  </button>
                </div>
              </div>
              <button className="btn back-btn" onClick={handleGoBack}>
                ← 뒤로가기
              </button>
            </>
          )}

          {/* 방 만든 후 대기 */}
          {roomId && (
            <>
              <h2>플레이어를 기다리는 중...</h2>

              <div className="room-info">
                <div className="room-id-display">
                  <span>방 ID: </span>
                  <strong>{roomId}</strong>
                  <button
                    className="copy-btn"
                    onClick={copyRoomId}
                    disabled={isCopied}
                  >
                    {isCopied ? '✅' : '📋'}
                  </button>
                </div>
                <p className="room-instruction">
                  위 방 ID를 친구들에게 알려주세요!
                </p>
              </div>

              {/* 참가자 현황 */}
              <div className="players-status">
                <div className="players-count">
                  {currentPlayerCount} / 3 명 참가
                </div>
                <div className="players-list">
                  {playerNames.map((name, i) => (
                    <div key={i} className="player-slot filled">
                      {i === 0 ? '⚪' : i === 1 ? '🔵' : '🔴'} {name}
                    </div>
                  ))}
                  {Array(3 - playerNames.length)
                    .fill(null)
                    .map((_, i) => (
                      <div key={`empty-${i}`} className="player-slot empty">
                        ⏳ 대기중...
                      </div>
                    ))}
                </div>
              </div>

              <div className="loading-indicator">
                <div className="spinner"></div>
                <span>3명이 모이면 게임이 시작됩니다</span>
              </div>

              <button className="btn back-btn" onClick={handleGoBack}>
                ← 나가기
              </button>
            </>
          )}
        </div>

        {errorMessage && <div className="error-message">⚠️ {errorMessage}</div>}

        {isLoading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchingScreen3P;
