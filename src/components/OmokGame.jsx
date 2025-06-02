import React, { useState, useCallback } from 'react';
import './OmokGame.css';

const BOARD_SIZE = 13;
const EMPTY = 0;
const BLACK_90 = 1;
const BLACK_70 = 2;
const BLACK_CONFIRMED = 3;
const WHITE_90 = 4;
const WHITE_70 = 5;
const WHITE_CONFIRMED = 6;

// 돌 순서: 흑70 → 백90 → 흑90 → 백70 → 흑70...
const TURN_SEQUENCE = [
  { player: 'black', type: 70 },
  { player: 'white', type: 90 },
  { player: 'black', type: 90 },
  { player: 'white', type: 70 },
];

const OmokGame = () => {
  const [board, setBoard] = useState(() =>
    Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(EMPTY))
  );
  const [originalBoard, setOriginalBoard] = useState(() =>
    Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(EMPTY))
  ); // 원본 돌 상태 저장
  const [turnIndex, setTurnIndex] = useState(0); // 턴 순서 인덱스
  const [winner, setWinner] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [hasPlacedStone, setHasPlacedStone] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [winningStones, setWinningStones] = useState([]);

  const currentTurn = TURN_SEQUENCE[turnIndex];

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
    if (player === 'black') {
      return type === 90 ? BLACK_90 : BLACK_70;
    } else {
      return type === 90 ? WHITE_90 : WHITE_70;
    }
  };

  // 셀 값을 돌 정보로 변환
  const getStoneInfo = (cellValue) => {
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

  // 확정된 돌로 승리 체크
  const checkWin = useCallback((board) => {
    const directions = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cellValue = board[row][col];
        if (cellValue !== BLACK_CONFIRMED && cellValue !== WHITE_CONFIRMED)
          continue;

        const player = cellValue === BLACK_CONFIRMED ? 'black' : 'white';

        for (let [dr, dc] of directions) {
          let count = 1;
          let stones = [{ row, col }]; // 승리한 돌들 위치 저장
          let r = row + dr;
          let c = col + dc;

          while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
            const checkValue = board[r][c];
            if (
              (player === 'black' && checkValue === BLACK_CONFIRMED) ||
              (player === 'white' && checkValue === WHITE_CONFIRMED)
            ) {
              count++;
              stones.push({ row: r, col: c }); // 위치 추가
              r += dr;
              c += dc;
            } else {
              break;
            }
          }

          if (count >= 5) {
            return { player, stones }; // 플레이어와 돌 위치들 반환
          }
        }
      }
    }
    return null;
  }, []);

  // 돌 놓기
  const placeStone = useCallback(
    (row, col) => {
      if (gameOver || board[row][col] !== EMPTY || hasPlacedStone) return;

      playSound('place.mp3');

      const stoneValue = getStoneValue(currentTurn.player, currentTurn.type);
      const newBoard = board.map((row) => [...row]);
      const newOriginalBoard = originalBoard.map((row) => [...row]);

      newBoard[row][col] = stoneValue;
      newOriginalBoard[row][col] = stoneValue;

      setBoard(newBoard);
      setOriginalBoard(newOriginalBoard);
      setHasPlacedStone(true);
    },
    [board, originalBoard, currentTurn, gameOver, hasPlacedStone]
  );

  // 체크 기능
  const handleCheck = () => {
    if (gameOver || hasChecked) return;

    playSound('check.mp3');

    setHasChecked(true);

    const newBoard = originalBoard.map((row) => [...row]);
    let hasChanges = false;

    // 모든 90돌과 70돌을 확률적으로 확정
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cellValue = newBoard[row][col];
        const stoneInfo = getStoneInfo(cellValue);

        if (stoneInfo && !stoneInfo.confirmed) {
          const probability = stoneInfo.type / 100;
          const random = Math.random();

          if (random < probability) {
            // 원래 색상으로 확정
            newBoard[row][col] =
              stoneInfo.player === 'black' ? BLACK_CONFIRMED : WHITE_CONFIRMED;
          } else {
            // 반대 색상으로 확정
            newBoard[row][col] =
              stoneInfo.player === 'black' ? WHITE_CONFIRMED : BLACK_CONFIRMED;
          }
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      setBoard(newBoard);

      // 승리 체크
      const winResult = checkWin(newBoard);
      if (winResult) {
        setWinner(winResult.player);
        setWinningStones(winResult.stones);
        setGameOver(true);
        playSound('win.mp3');
      }
    }
  };

  // 넘어가기
  const handlePass = () => {
    if (gameOver) return;

    // 원본 상태로 복원
    setBoard(originalBoard.map((row) => [...row]));
    setTurnIndex((prev) => (prev + 1) % TURN_SEQUENCE.length);
    setHasPlacedStone(false);
    setHasChecked(false);
  };

  // 게임 리셋
  const resetGame = () => {
    playSound('start.mp3');

    const emptyBoard = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(EMPTY));

    setBoard(emptyBoard);
    setOriginalBoard(emptyBoard.map((row) => [...row]));
    setTurnIndex(0);
    setWinner(null);
    setGameOver(false);
    setHasPlacedStone(false);
    setHasChecked(false);
    setWinningStones([]);
  };

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
        onClick={() => placeStone(row, col)}
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

        {/* 미리보기 돌 */}
        {cellValue === EMPTY && isHovered && !gameOver && !hasPlacedStone && (
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
      {/* 게임 상태 */}
      <div className="game-status">
        {gameOver ? (
          // 게임 종료 시: 승리자 + 리셋 버튼
          <>
            <div>🎉 {winner === 'black' ? '⚫ 흑돌' : '⚪ 백돌'} 승리! 🎉</div>
            <div className="btn-container">
              <div className="btn check-btn" onClick={resetGame}>
                새 게임 시작!
              </div>
            </div>
          </>
        ) : (
          // 게임 진행 시: 기존 UI
          <>
            <div>
              현재 차례: {currentTurn.player === 'black' ? '⚫' : '⚪'}{' '}
              {currentTurn.type}돌 ({currentTurn.type}% 확률)
            </div>
            {hasPlacedStone && (
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
    </div>
  );
};

export default OmokGame;
