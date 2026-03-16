import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import {
  createRoom,
  joinRoom,
  subscribeToRoom,
  leaveRoom,
} from '../services/roomService';
import title from '../assets/title.png';
import './MatchingScreen.css';

const MatchingScreen = () => {
  const navigate = useNavigate();

  const {
    matchingState,
    myNickname,
    myCharacter,
    opponentNickname,
    playerRole,
    roomId,
    setPlayerInfo,
    setMatchingState,
    setOpponentNickname,
    setOpponentCharacter,
    resetGame,
    setMyCharacter,
    nextCharacter,
    prevCharacter,
    getCharacterImage,
  } = useGameStore();

  const [inputNickname, setInputNickname] = useState(myNickname || '');
  const [inputRoomId, setInputRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState('');
  const [currentPlayerRole, setCurrentPlayerRole] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [unsubscribeRoom, setUnsubscribeRoom] = useState(null);
  const [hostColor, setHostColor] = useState(null);

  const handleNicknameSubmit = () => {
    if (!inputNickname.trim()) {
      setErrorMessage('닉네임을 입력해주세요!');
      return;
    }
    if (inputNickname.length > 10) {
      setErrorMessage('닉네임은 10자 이내로 입력해주세요!');
      return;
    }
    setPlayerInfo(inputNickname, null, '', '', myCharacter);
    setErrorMessage('');
    setMatchingState('mode-select'); // 닉네임 확인 후 모드 선택으로
  };

  // 모드 선택
  const handleSelect2P = () => {
    setMatchingState('matching');
  };

  const handleSelect3P = () => {
    navigate('/matching3p', {
      state: { myNickname, myCharacter },
    });
  };

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
      const result = await createRoom(myNickname, myCharacter);

      if (result.success) {
        setCurrentRoomId(result.roomId);
        setCurrentPlayerRole('host');
        setHostColor(result.hostColor);

        setPlayerInfo(myNickname, 'host', result.roomId, '', myCharacter);
        setMatchingState('waiting');

        const unsubscribe = subscribeToRoom(
          result.roomId,
          (roomData) =>
            handleRoomUpdate(roomData, result.roomId, 'host', result.hostColor),
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
      const result = await joinRoom(roomIdUpper, myNickname, myCharacter);

      if (result.success) {
        setCurrentRoomId(roomIdUpper);
        setCurrentPlayerRole('guest');

        setPlayerInfo(
          myNickname, 'guest', roomIdUpper,
          result.roomData.hostNickname, myCharacter,
          result.roomData.hostCharacter
        );
        setOpponentCharacter(result.roomData.hostCharacter);
        setMatchingState('connecting');

        const unsubscribe = subscribeToRoom(
          roomIdUpper,
          (roomData) =>
            handleRoomUpdate(roomData, roomIdUpper, 'guest', result.roomData.hostColor),
          handleRoomError
        );
        setUnsubscribeRoom(() => unsubscribe);

        setTimeout(() => {
          startGame(
            result.roomData.hostNickname, roomIdUpper, 'guest',
            result.roomData.hostCharacter, result.roomData.hostColor
          );
        }, 1000);
      } else {
        setErrorMessage(result.error);
      }
    } catch (error) {
      setErrorMessage('방 참가에 실패했습니다. 방 ID를 확인해주세요.');
    }

    setIsLoading(false);
  };

  const handleRoomUpdate = (roomData, gameRoomId, gamePlayerRole, currentHostColor) => {
    if (gamePlayerRole === 'host' && roomData.guestNickname && roomData.status === 'playing') {
      setOpponentCharacter(roomData.guestCharacter || 0);
      startGame(
        roomData.guestNickname, gameRoomId, gamePlayerRole,
        roomData.guestCharacter, currentHostColor || roomData.hostColor
      );
    }

    if (roomData.status === 'waiting' && roomData.currentPlayerCount === 1) {
      if (gamePlayerRole === 'guest') {
        setErrorMessage('호스트가 방을 나갔습니다.');
        handleGoBack();
      }
    }
  };

  const handleRoomError = (error) => {
    console.error('방 에러:', error);
    setErrorMessage(error);
    setMatchingState('matching');
    if (unsubscribeRoom) {
      unsubscribeRoom();
      setUnsubscribeRoom(null);
    }
  };

  const startGame = (
    opponentName, gameRoomId, gamePlayerRole,
    opponentCharacterIndex = 0, gameHostColor = null
  ) => {
    setOpponentNickname(opponentName);
    setOpponentCharacter(opponentCharacterIndex);
    resetGame();
    setMatchingState('playing');

    navigate(`/game/${gameRoomId}`, {
      state: {
        myNickname, myCharacter,
        opponentNickname: opponentName,
        opponentCharacter: opponentCharacterIndex,
        playerRole: gamePlayerRole,
        roomId: gameRoomId,
        hostColor: gameHostColor,
      },
    });
  };

  const handleGoBack = async () => {
    if (unsubscribeRoom) {
      unsubscribeRoom();
      setUnsubscribeRoom(null);
    }
    if (roomId && playerRole) {
      await leaveRoom(roomId, playerRole);
    }
    setMatchingState('matching');
    setErrorMessage('');
    setInputRoomId('');
  };

  const handleEditNickname = () => {
    setInputNickname(myNickname);
    setMatchingState('nickname-input');
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

  return (
    <div className="matching-container">
      <div className="matching-card">
        <h1 className="game-title">램램도 이길 수 있다!</h1>
        <img className="title-img" src={title} alt="양자오목" />

        {/* 닉네임 입력 화면 */}
        {matchingState === 'nickname-input' && (
          <div className="nickname-section">
            <div className="character-selection">
              <p>캐릭터를 선택하세요</p>
              <div className="character-selector">
                <button className="character-arrow left" onClick={prevCharacter} type="button">◀</button>
                <div className="character-display">
                  <img
                    src={getCharacterImage(myCharacter)}
                    alt={`캐릭터 ${myCharacter + 1}`}
                    className="character-image"
                  />
                </div>
                <button className="character-arrow right" onClick={nextCharacter} type="button">▶</button>
              </div>
            </div>

            <p>닉네임을 입력하세요</p>
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

        {/* 모드 선택 화면 */}
        {matchingState === 'mode-select' && (
          <div className="mode-select-section">
            <div className="player-info">
              <div className="player-info-with-character">
                <img src={getCharacterImage(myCharacter)} alt="내 캐릭터" className="player-character-small" />
                <span className="nickname-display">👤 {myNickname}</span>
              </div>
            </div>

            <h2>모드를 선택하세요</h2>

            <div className="button-group">
              <button className="btn mode-btn mode-2p-btn" onClick={handleSelect2P}>
                👥 2인 모드
              </button>
              <button className="btn mode-btn mode-3p-btn" onClick={handleSelect3P}>
                👥👤 3인 모드
              </button>
            </div>

            <button className="btn back-btn" onClick={handleEditNickname}>
              ← 닉네임 수정
            </button>
          </div>
        )}

        {/* 매칭 선택 화면 (2인) */}
        {matchingState === 'matching' && (
          <div className="matching-section">
            <div className="player-info">
              <div className="player-info-with-character">
                <img src={getCharacterImage(myCharacter)} alt="내 캐릭터" className="player-character-small" />
                <span className="nickname-display">👤 {myNickname}</span>
              </div>
            </div>

            <div className="button-group">
              <button className="btn create-btn" onClick={handleCreateRoom} disabled={isLoading}>
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

            <button className="btn back-btn" onClick={() => setMatchingState('mode-select')}>
              ← 모드 선택
            </button>
          </div>
        )}

        {/* 대기 화면 (방장) */}
        {matchingState === 'waiting' && (
          <div className="waiting-section">
            <div className="player-info">
              <div className="player-info-with-character">
                <img src={getCharacterImage(myCharacter)} alt="내 캐릭터" className="player-character-small" />
                <span className="nickname-display">👤 {myNickname} (방장)</span>
              </div>
            </div>

            <h2>친구를 기다리는 중...</h2>

            <div className="room-info">
              <div className="room-id-display">
                <span>방 ID: </span>
                <strong>{roomId}</strong>
                <button className="copy-btn" onClick={copyRoomId} disabled={isCopied}>
                  {isCopied ? '✅' : '📋'}
                </button>
              </div>
              <p className="room-instruction">위 방 ID를 친구에게 알려주세요!</p>
            </div>

            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>상대방 접속 대기중...</span>
            </div>

            <button className="btn back-btn" onClick={handleGoBack}>← 뒤로가기</button>
          </div>
        )}

        {/* 연결 중 화면 (게스트) */}
        {matchingState === 'connecting' && (
          <div className="connecting-section">
            <div className="player-info">
              <div className="player-info-with-character">
                <img src={getCharacterImage(myCharacter)} alt="내 캐릭터" className="player-character-small" />
                <span className="nickname-display">👤 {myNickname}</span>
              </div>
            </div>

            <h2>게임에 접속 중...</h2>

            <div className="room-info">
              <div className="room-id-display">방 ID: <strong>{roomId}</strong></div>
            </div>

            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>게임 연결중...</span>
            </div>

            <button className="btn back-btn" onClick={handleGoBack}>← 뒤로가기</button>
          </div>
        )}

        {errorMessage && <div className="error-message">⚠️ {errorMessage}</div>}

        {isLoading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
          </div>
        )}

        <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
          <div>매칭 상태: {matchingState}</div>
          <div>플레이어 역할: {playerRole || '없음'}</div>
          <div>방 ID: {roomId || '없음'}</div>
          <div>선택 캐릭터: C{myCharacter + 1}</div>
        </div>
      </div>
    </div>
  );
};

export default MatchingScreen;