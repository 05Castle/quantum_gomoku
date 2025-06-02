// WinnerModal.jsx
import React from 'react';
import './WinnerModal.css';

const WinnerModal = ({ winner, onClose }) => {
  const winnerText = winner === 1 ? '⚫ 흑돌 승리!' : '⚪ 백돌 승리!';

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{winnerText}</h2>
        <button onClick={onClose}>확인</button>
      </div>
    </div>
  );
};

export default WinnerModal;
