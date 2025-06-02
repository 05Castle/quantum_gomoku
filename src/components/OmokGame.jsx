import React, { useState, useCallback } from 'react';
import WinnerModal from './WinnerModal';
import './OmokGame.css';

const BOARD_SIZE = 13;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const OmokGame = () => {
  const [board, setBoard] = useState(() =>
    Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(EMPTY))
  );
  const [currentPlayer, setCurrentPlayer] = useState(BLACK);
  const [winner, setWinner] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [hasPlacedStone, setHasPlacedStone] = useState(false);

  const checkWin = useCallback((board, row, col, player) => {
    const directions = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];

    for (let [dr, dc] of directions) {
      let count = 1;
      let r = row + dr;
      let c = col + dc;
      while (
        r >= 0 &&
        r < BOARD_SIZE &&
        c >= 0 &&
        c < BOARD_SIZE &&
        board[r][c] === player
      ) {
        count++;
        r += dr;
        c += dc;
      }
      r = row - dr;
      c = col - dc;
      while (
        r >= 0 &&
        r < BOARD_SIZE &&
        c >= 0 &&
        c < BOARD_SIZE &&
        board[r][c] === player
      ) {
        count++;
        r -= dr;
        c -= dc;
      }
      if (count >= 5) return true;
    }
    return false;
  }, []);

  const placeStone = useCallback(
    (row, col) => {
      if (gameOver || board[row][col] !== EMPTY) return;

      const newBoard = board.map((row) => [...row]);
      newBoard[row][col] = currentPlayer;
      setBoard(newBoard);
      setHasPlacedStone(true); // 돌 놓음

      if (checkWin(newBoard, row, col, currentPlayer)) {
        setWinner(currentPlayer);
        setGameOver(true);
        setShowModal(true);
      }
    },
    [board, currentPlayer, gameOver, checkWin]
  );

  const handlePass = () => {
    if (gameOver) return;
    setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK);
    setHasPlacedStone(false); // 패스 후 다시 초기화
  };

  const resetGame = () => {
    setBoard(
      Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(EMPTY))
    );
    setCurrentPlayer(BLACK);
    setWinner(null);
    setGameOver(false);
  };

  const renderIntersection = (row, col) => {
    const cellValue = board[row][col];
    const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;

    return (
      <div
        key={`${row}-${col}`}
        className="cell"
        onClick={() => placeStone(row, col)}
        onMouseEnter={() => setHoveredCell({ row, col })}
        onMouseLeave={() => setHoveredCell(null)}
      >
        <div className="lines"></div>
        <div className="dot"></div>

        {/* 실제 놓인 돌 */}
        {cellValue === BLACK && <div className="stone black"></div>}
        {cellValue === WHITE && <div className="stone white"></div>}

        {/* 미리보기 돌 (빈 셀일 때만표시, 게임끝나면 표시 안되게) */}
        {cellValue === EMPTY && isHovered && !gameOver && !hasPlacedStone && (
          <div
            className={`stone preview ${currentPlayer === BLACK ? 'black' : 'white'}`}
          ></div>
        )}
      </div>
    );
  };

  return (
    <div className="game-container">
      <div className="game-status">
        <div className="turn-text">
          현재 차례: {currentPlayer === BLACK ? '⚫ 흑돌' : '⚪ 백돌'}
        </div>
        {hasPlacedStone && (
          <div className="btn-container">
            <div className="checkBtn">체크!</div>
            <div className="passBtn" onClick={handlePass}>
              넘어가기!
            </div>
          </div>
        )}
      </div>
      <div
        className="board"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
      >
        {board.map((row, rowIndex) =>
          row.map((_, colIndex) => renderIntersection(rowIndex, colIndex))
        )}
      </div>
      {showModal && (
        <WinnerModal
          winner={winner}
          onClose={() => {
            setShowModal(false);
            resetGame();
          }}
        />
      )}
    </div>
  );
};

export default OmokGame;
