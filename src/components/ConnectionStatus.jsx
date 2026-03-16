import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { leaveRoom } from '../services/roomService';

const ConnectionStatus = ({ opponentLeft }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { isConnected, playerRole, exitRoom } = useGameStore();
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const handleLeaveClick = () => {
    setShowLeaveModal(true);
  };

  const handleLeaveConfirm = async () => {
    try {
      await leaveRoom(roomId, playerRole);
      exitRoom();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('나가기 실패:', error);
      exitRoom();
      navigate('/', { replace: true });
    }
  };

  const handleLeaveCancel = () => {
    setShowLeaveModal(false);
  };

  return (
    <>
      <div className="connection-status">
        <span
          className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}
        >
          {isConnected ? '🟢 연결됨' : '🔴 연결 끊어짐'}
        </span>
        <span className="room-id">방 ID: {roomId}</span>
        <button className="btn back-btn" onClick={handleLeaveClick}>
          나가기
        </button>
      </div>

      {/* 나가기 확인 모달 */}
      {showLeaveModal && (
        <div className="modal-overlay" onClick={handleLeaveCancel}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">게임을 나가시겠습니까?</div>
            <div className="modal-desc">
              {playerRole === 'host'
                ? '방이 삭제되고 상대방도 로비로 이동됩니다.'
                : '상대방도 로비로 이동됩니다.'}
            </div>
            <div className="modal-buttons">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={handleLeaveCancel}
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

      {/* 상대방 나감 알림 모달 */}
      {opponentLeft && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">😢 상대방이 연결을 끊었습니다</div>
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
    </>
  );
};

export default ConnectionStatus;
