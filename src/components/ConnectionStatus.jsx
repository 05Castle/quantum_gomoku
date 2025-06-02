import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { leaveRoom } from '../services/roomService';

const ConnectionStatus = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { isConnected, playerRole } = useGameStore();

  // 게임 나가기
  const handleLeaveGame = async () => {
    if (window.confirm('정말 게임을 나가시겠습니까?')) {
      await leaveRoom(roomId, playerRole);
      navigate('/');
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
      <button
        className="btn back-btn"
        onClick={handleLeaveGame}
        style={{ fontSize: '12px', padding: '4px 8px' }}
      >
        나가기
      </button>
    </div>
  );
};

export default ConnectionStatus;
