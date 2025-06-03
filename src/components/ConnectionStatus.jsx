import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { leaveRoom } from '../services/roomService';

const ConnectionStatus = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { isConnected, playerRole, exitRoom } = useGameStore();

  // 게임 나가기 (매칭 상태 완전 초기화)
  const handleLeaveGame = async () => {
    if (window.confirm('정말 게임을 나가시겠습니까?')) {
      try {
        // 1. 서버에서 방 나가기
        await leaveRoom(roomId, playerRole);

        // 2. 방 나가기 (별명은 유지)
        exitRoom();

        // 3. 메인 화면으로 이동 (replace로 뒤로가기 방지)
        navigate('/', { replace: true });
      } catch (error) {
        console.error('나가기 실패:', error);

        // 에러가 있어도 로컬 상태는 완전히 초기화하고 이동
        exitRoom();
        navigate('/', { replace: true });
      }
    }
  };

  return (
    <div className="connection-status">
      <span
        className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}
      >
        {isConnected ? '🟢 연결됨' : '🔴 연결 끊어짐'}
      </span>
      <span className="room-id">방 ID: {roomId}</span>
      <button className="btn back-btn" onClick={handleLeaveGame}>
        나가기
      </button>
    </div>
  );
};

export default ConnectionStatus;
