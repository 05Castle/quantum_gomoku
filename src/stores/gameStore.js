import { create } from 'zustand';

// 게임 상수들
const BOARD_SIZE = 13;
const EMPTY = 0;
const BLACK_90 = 1;
const BLACK_70 = 2;
const BLACK_CONFIRMED = 3;
const WHITE_90 = 4;
const WHITE_70 = 5;
const WHITE_CONFIRMED = 6;

const TURN_SEQUENCE = [
  { player: 'black', type: 70 },
  { player: 'white', type: 90 },
  { player: 'black', type: 90 },
  { player: 'white', type: 70 },
];

const GAME_ACTIONS = {
  PLACE_STONE: 'place_stone',
  CHECK: 'check',
  PASS: 'pass',
  RESET_GAME: 'reset_game',
};

// 체크 횟수 상수
const MAX_CHECKS_PER_PLAYER = 4;
const TOTAL_MAX_CHECKS = MAX_CHECKS_PER_PLAYER * 2; // 8회

// 빈 보드 생성 함수
const createEmptyBoard = () =>
  Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(EMPTY));

export const useGameStore = create((set, get) => ({
  // === 연결 및 플레이어 정보 ===
  isConnected: false,
  myNickname: '',
  opponentNickname: '',
  playerRole: null, // 'host' | 'guest'
  roomId: '',

  // === 게임 상태 ===
  board: createEmptyBoard(),
  originalBoard: createEmptyBoard(),
  turnIndex: 0,
  winner: null,
  gameOver: false,
  hasPlacedStone: false,
  hasChecked: false,
  winningStones: [],

  // === 체크 횟수 관리 ===
  hostCheckCount: MAX_CHECKS_PER_PLAYER,
  guestCheckCount: MAX_CHECKS_PER_PLAYER,
  totalChecksUsed: 0,

  // === 매칭 상태 ===
  matchingState: 'nickname-input',

  // === 액션들 ===

  // 플레이어 정보 설정
  setPlayerInfo: (nickname, role, roomId, opponentNickname = '') =>
    set({
      myNickname: nickname,
      playerRole: role,
      roomId: roomId,
      opponentNickname: opponentNickname,
    }),

  // 연결 상태 설정
  setConnectionState: (isConnected) => set({ isConnected }),

  // 매칭 상태 변경
  setMatchingState: (state) => set({ matchingState: state }),

  // 상대방 닉네임 설정
  setOpponentNickname: (nickname) => set({ opponentNickname: nickname }),

  // === 게임 로직 액션들 ===

  // 게임 상태 초기화
  resetGame: () =>
    set({
      board: createEmptyBoard(),
      originalBoard: createEmptyBoard(),
      turnIndex: 0,
      winner: null,
      gameOver: false,
      hasPlacedStone: false,
      hasChecked: false,
      winningStones: [],
      hostCheckCount: MAX_CHECKS_PER_PLAYER,
      guestCheckCount: MAX_CHECKS_PER_PLAYER,
      totalChecksUsed: 0,
    }),

  // 돌 놓기
  placeStone: (row, col) => {
    const state = get();
    const { board, originalBoard, turnIndex, gameOver, hasPlacedStone } = state;

    if (gameOver || board[row][col] !== EMPTY || hasPlacedStone) return null;

    const currentTurn = TURN_SEQUENCE[turnIndex];
    const stoneValue = getStoneValue(currentTurn.player, currentTurn.type);

    const newBoard = board.map((row) => [...row]);
    const newOriginalBoard = originalBoard.map((row) => [...row]);

    newBoard[row][col] = stoneValue;
    newOriginalBoard[row][col] = stoneValue;

    set({
      board: newBoard,
      originalBoard: newOriginalBoard,
      hasPlacedStone: true,
    });

    return {
      action: GAME_ACTIONS.PLACE_STONE,
      row,
      col,
      player: currentTurn.player,
      type: currentTurn.type,
      turnIndex: turnIndex,
      timestamp: Date.now(),
    };
  },

  // 체크 실행 (내가 체크를 눌렀을 때)
  executeCheck: () => {
    const state = get();
    const {
      originalBoard,
      gameOver,
      hasChecked,
      playerRole,
      hostCheckCount,
      guestCheckCount,
      totalChecksUsed,
    } = state;

    if (gameOver || hasChecked) return null;

    // 내 체크 횟수 확인
    const myCheckCount =
      playerRole === 'host' ? hostCheckCount : guestCheckCount;
    if (myCheckCount <= 0) return null;

    const newBoard = originalBoard.map((row) => [...row]);
    const checkResults = [];
    let hasChanges = false;

    // 모든 90돌과 70돌을 확률적으로 확정
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cellValue = newBoard[row][col];
        const stoneInfo = getStoneInfo(cellValue);

        if (stoneInfo && !stoneInfo.confirmed) {
          const probability = stoneInfo.type / 100;
          const random = Math.random();

          let finalColor;
          if (random < probability) {
            finalColor = stoneInfo.player;
            newBoard[row][col] =
              stoneInfo.player === 'black' ? BLACK_CONFIRMED : WHITE_CONFIRMED;
          } else {
            finalColor = stoneInfo.player === 'black' ? 'white' : 'black';
            newBoard[row][col] =
              stoneInfo.player === 'black' ? WHITE_CONFIRMED : BLACK_CONFIRMED;
          }

          checkResults.push({ row, col, finalColor });
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      // 체크 횟수 차감
      const newHostCheckCount =
        playerRole === 'host' ? hostCheckCount - 1 : hostCheckCount;
      const newGuestCheckCount =
        playerRole === 'guest' ? guestCheckCount - 1 : guestCheckCount;
      const newTotalChecksUsed = totalChecksUsed + 1;

      // 승리 체크
      const winResult = checkWin(newBoard);
      let winner = null;
      let winningStones = [];
      let gameOver = false;

      if (winResult) {
        if (winResult.isDraw) {
          // 무승부 - 게임 계속, 돌들만 강조
          set({
            board: newBoard,
            hasChecked: true,
            winningStones: winResult.stones,
            hostCheckCount: newHostCheckCount,
            guestCheckCount: newGuestCheckCount,
            totalChecksUsed: newTotalChecksUsed,
          });
        } else {
          // 일반 승리
          winner = winResult.player;
          winningStones = winResult.stones;
          gameOver = true;
          set({
            board: newBoard,
            hasChecked: true,
            winner,
            winningStones,
            gameOver,
            hostCheckCount: newHostCheckCount,
            guestCheckCount: newGuestCheckCount,
            totalChecksUsed: newTotalChecksUsed,
          });

          // 승리 사운드
          try {
            const audio = new Audio('/sounds/win.mp3');
            audio.play().catch((err) => console.log('Win sound failed:', err));
          } catch (error) {
            console.log('Win sound error:', error);
          }
        }
      } else {
        // 승리 조건 없음 - 무승부 체크
        const shouldCheckDraw = newTotalChecksUsed >= TOTAL_MAX_CHECKS;

        if (shouldCheckDraw) {
          // 모든 체크를 사용했는데도 승부가 나지 않음 = 무승부
          winner = 'draw';
          gameOver = true;
          set({
            board: newBoard,
            hasChecked: true,
            winner,
            winningStones: [],
            gameOver,
            hostCheckCount: newHostCheckCount,
            guestCheckCount: newGuestCheckCount,
            totalChecksUsed: newTotalChecksUsed,
          });
        } else {
          set({
            board: newBoard,
            hasChecked: true,
            winningStones: [],
            hostCheckCount: newHostCheckCount,
            guestCheckCount: newGuestCheckCount,
            totalChecksUsed: newTotalChecksUsed,
          });
        }
      }

      return {
        action: GAME_ACTIONS.CHECK,
        checkResults,
        winner,
        winningStones,
        gameOver,
        hostCheckCount: newHostCheckCount,
        guestCheckCount: newGuestCheckCount,
        totalChecksUsed: newTotalChecksUsed,
        timestamp: Date.now(),
      };
    }

    // 변화가 없어도 체크 횟수는 차감
    const newHostCheckCount =
      playerRole === 'host' ? hostCheckCount - 1 : hostCheckCount;
    const newGuestCheckCount =
      playerRole === 'guest' ? guestCheckCount - 1 : guestCheckCount;
    const newTotalChecksUsed = totalChecksUsed + 1;

    set({
      hasChecked: true,
      hostCheckCount: newHostCheckCount,
      guestCheckCount: newGuestCheckCount,
      totalChecksUsed: newTotalChecksUsed,
    });

    return {
      action: GAME_ACTIONS.CHECK,
      checkResults: [],
      winner: null,
      winningStones: [],
      gameOver: false,
      hostCheckCount: newHostCheckCount,
      guestCheckCount: newGuestCheckCount,
      totalChecksUsed: newTotalChecksUsed,
      timestamp: Date.now(),
    };
  },

  // 체크 결과 적용 (상대방이 보낸 결과)
  applyCheckResults: (
    checkResults,
    winner,
    winningStones,
    gameOver,
    hostCheckCount,
    guestCheckCount,
    totalChecksUsed
  ) => {
    const state = get();
    const { originalBoard } = state;

    const newBoard = originalBoard.map((row) => [...row]);

    checkResults.forEach(({ row, col, finalColor }) => {
      newBoard[row][col] =
        finalColor === 'black' ? BLACK_CONFIRMED : WHITE_CONFIRMED;
    });

    set({
      board: newBoard,
      winner: gameOver ? winner : null,
      winningStones: winningStones || [],
      gameOver: gameOver || false,
      hostCheckCount: hostCheckCount || state.hostCheckCount,
      guestCheckCount: guestCheckCount || state.guestCheckCount,
      totalChecksUsed: totalChecksUsed || state.totalChecksUsed,
    });
  },

  // 넘어가기
  passTurn: () => {
    const state = get();
    const { originalBoard, gameOver } = state;

    if (gameOver) return null;

    const newTurnIndex = (state.turnIndex + 1) % TURN_SEQUENCE.length;

    set({
      board: originalBoard.map((row) => [...row]),
      turnIndex: newTurnIndex,
      hasPlacedStone: false,
      hasChecked: false,
      winningStones: [],
    });

    return {
      action: GAME_ACTIONS.PASS,
      turnIndex: newTurnIndex,
      timestamp: Date.now(),
    };
  },

  // 외부에서 받은 액션 처리
  processReceivedAction: (actionData) => {
    const { action } = actionData;

    switch (action) {
      case GAME_ACTIONS.PLACE_STONE:
        // 상대방이 돌을 놓음
        const { row, col, player, type, turnIndex } = actionData;
        const stoneValue = getStoneValue(player, type);
        const state = get();

        const newBoard = state.board.map((row) => [...row]);
        const newOriginalBoard = state.originalBoard.map((row) => [...row]);

        newBoard[row][col] = stoneValue;
        newOriginalBoard[row][col] = stoneValue;

        set({
          board: newBoard,
          originalBoard: newOriginalBoard,
          hasPlacedStone: true,
          turnIndex: turnIndex || state.turnIndex,
        });
        break;

      case GAME_ACTIONS.CHECK:
        // 상대방이 체크함
        if (actionData.checkResults !== undefined) {
          get().applyCheckResults(
            actionData.checkResults,
            actionData.winner,
            actionData.winningStones,
            actionData.gameOver,
            actionData.hostCheckCount,
            actionData.guestCheckCount,
            actionData.totalChecksUsed
          );
        }
        break;

      case GAME_ACTIONS.PASS:
        // 상대방이 넘어감
        const currentState = get();
        const passedTurnIndex =
          actionData.turnIndex ||
          (currentState.turnIndex + 1) % TURN_SEQUENCE.length;

        set({
          board: currentState.originalBoard.map((row) => [...row]),
          turnIndex: passedTurnIndex,
          hasPlacedStone: false,
          hasChecked: false,
          winningStones: [],
        });
        break;

      case GAME_ACTIONS.RESET_GAME:
        // 상대방이 리셋함 - 나도 리셋
        get().resetGame();
        break;
    }
  },

  // 현재 턴 정보 가져오기
  getCurrentTurn: () => {
    const { turnIndex } = get();
    return TURN_SEQUENCE[turnIndex];
  },

  // 내 턴인지 확인
  isMyTurn: () => {
    const state = get();
    const currentTurn = TURN_SEQUENCE[state.turnIndex];

    if (state.playerRole === 'host') {
      return currentTurn.player === 'black';
    } else {
      return currentTurn.player === 'white';
    }
  },

  // 내 남은 체크 횟수 가져오기
  getMyRemainingChecks: () => {
    const state = get();
    return state.playerRole === 'host'
      ? state.hostCheckCount
      : state.guestCheckCount;
  },

  // 체크 가능 여부 확인
  canCheck: () => {
    const state = get();
    if (state.gameOver || state.hasChecked) return false;

    const myCheckCount =
      state.playerRole === 'host'
        ? state.hostCheckCount
        : state.guestCheckCount;
    return myCheckCount > 0;
  },

  // 게임 상태 내보내기
  getGameState: () => {
    const state = get();
    return {
      board: state.board,
      originalBoard: state.originalBoard,
      turnIndex: state.turnIndex,
      winner: state.winner,
      gameOver: state.gameOver,
      hasPlacedStone: state.hasPlacedStone,
      hasChecked: state.hasChecked,
      winningStones: state.winningStones,
      hostCheckCount: state.hostCheckCount,
      guestCheckCount: state.guestCheckCount,
      totalChecksUsed: state.totalChecksUsed,
    };
  },
}));

// === 유틸리티 함수들 ===

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

// 승리 체크 함수
const checkWin = (board) => {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  let blackWins = [];
  let whiteWins = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cellValue = board[row][col];
      if (cellValue !== BLACK_CONFIRMED && cellValue !== WHITE_CONFIRMED)
        continue;

      const player = cellValue === BLACK_CONFIRMED ? 'black' : 'white';

      for (let [dr, dc] of directions) {
        let count = 1;
        let stones = [{ row, col }];
        let r = row + dr;
        let c = col + dc;

        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
          const checkValue = board[r][c];
          if (
            (player === 'black' && checkValue === BLACK_CONFIRMED) ||
            (player === 'white' && checkValue === WHITE_CONFIRMED)
          ) {
            count++;
            stones.push({ row: r, col: c });
            r += dr;
            c += dc;
          } else {
            break;
          }
        }

        if (count >= 5) {
          if (player === 'black') {
            blackWins.push({ player: 'black', stones });
          } else {
            whiteWins.push({ player: 'white', stones });
          }
        }
      }
    }
  }

  // 양쪽 모두 5목 달성 시 무승부
  if (blackWins.length > 0 && whiteWins.length > 0) {
    const allWinningStones = [
      ...blackWins.flatMap((win) => win.stones),
      ...whiteWins.flatMap((win) => win.stones),
    ];
    return { player: null, stones: allWinningStones, isDraw: true };
  }

  if (blackWins.length > 0) {
    return blackWins[0];
  }
  if (whiteWins.length > 0) {
    return whiteWins[0];
  }

  return null;
};

// 상수들도 export
export {
  BOARD_SIZE,
  EMPTY,
  BLACK_90,
  BLACK_70,
  BLACK_CONFIRMED,
  WHITE_90,
  WHITE_70,
  WHITE_CONFIRMED,
  TURN_SEQUENCE,
  GAME_ACTIONS,
  MAX_CHECKS_PER_PLAYER,
  TOTAL_MAX_CHECKS,
};
