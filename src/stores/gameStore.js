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
const TOTAL_MAX_CHECKS = MAX_CHECKS_PER_PLAYER * 2;

// 캐릭터 상수
const TOTAL_CHARACTERS = 12;
const DEFAULT_CHARACTER = 0;

// 사운드 재생 함수
const playSound = (soundFile) => {
  try {
    const audio = new Audio(`/sounds/${soundFile}`);
    audio.play().catch(() => {});
  } catch (error) {}
};

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

  // === 캐릭터 정보 ===
  myCharacter: DEFAULT_CHARACTER,
  opponentCharacter: DEFAULT_CHARACTER,

  // === Ver 1.3: 돌 색상 정보 ===
  // 'black' | 'white' - Firestore에서 받아온 hostColor 기준으로 설정
  myColor: null,
  opponentColor: null,

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
  setPlayerInfo: (
    nickname,
    role,
    roomId,
    opponentNickname = '',
    myCharacter = DEFAULT_CHARACTER,
    opponentCharacter = DEFAULT_CHARACTER
  ) =>
    set({
      myNickname: nickname,
      playerRole: role,
      roomId: roomId,
      opponentNickname: opponentNickname,
      myCharacter: myCharacter,
      opponentCharacter: opponentCharacter,
    }),

  // Ver 1.3: 돌 색상 설정 (Firestore의 hostColor 기준)
  setStoneColors: (hostColor) => {
    const state = get();
    const guestColor = hostColor === 'black' ? 'white' : 'black';
    if (state.playerRole === 'host') {
      set({ myColor: hostColor, opponentColor: guestColor });
    } else {
      set({ myColor: guestColor, opponentColor: hostColor });
    }
  },

  setMyCharacter: (characterIndex) => set({ myCharacter: characterIndex }),
  setOpponentCharacter: (characterIndex) =>
    set({ opponentCharacter: characterIndex }),
  setConnectionState: (isConnected) => set({ isConnected }),
  setMatchingState: (state) => set({ matchingState: state }),
  setOpponentNickname: (nickname) => set({ opponentNickname: nickname }),

  // 캐릭터 유틸리티
  nextCharacter: () => {
    const state = get();
    set({ myCharacter: (state.myCharacter + 1) % TOTAL_CHARACTERS });
  },
  prevCharacter: () => {
    const state = get();
    set({
      myCharacter:
        state.myCharacter === 0 ? TOTAL_CHARACTERS - 1 : state.myCharacter - 1,
    });
  },
  getCharacterImage: (characterIndex) =>
    `/characters/c${characterIndex + 1}.png`,
  getMyCharacterImage: () => `/characters/c${get().myCharacter + 1}.png`,
  getOpponentCharacterImage: () =>
    `/characters/c${get().opponentCharacter + 1}.png`,

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

  // 방 나가기
  exitRoom: () =>
    set({
      isConnected: false,
      opponentNickname: '',
      opponentCharacter: DEFAULT_CHARACTER,
      playerRole: null,
      roomId: '',
      myColor: null,
      opponentColor: null,
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
      matchingState: 'matching',
    }),

  // 돌 놓기
  placeStone: (row, col) => {
    const state = get();
    const { board, originalBoard, turnIndex, gameOver, hasPlacedStone } = state;

    if (gameOver || board[row][col] !== EMPTY || hasPlacedStone) return null;

    const currentTurn = TURN_SEQUENCE[turnIndex];
    const stoneValue = getStoneValue(currentTurn.player, currentTurn.type);

    const newBoard = board.map((r) => [...r]);
    const newOriginalBoard = originalBoard.map((r) => [...r]);

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
      turnIndex,
      timestamp: Date.now(),
    };
  },

  // 체크 실행
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
      myColor,
    } = state;

    if (gameOver || hasChecked) return null;

    const myCheckCount =
      playerRole === 'host' ? hostCheckCount : guestCheckCount;
    if (myCheckCount <= 0) return null;

    const newBoard = originalBoard.map((r) => [...r]);
    const checkResults = [];
    let hasChanges = false;

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

    const newHostCheckCount =
      playerRole === 'host' ? hostCheckCount - 1 : hostCheckCount;
    const newGuestCheckCount =
      playerRole === 'guest' ? guestCheckCount - 1 : guestCheckCount;
    const newTotalChecksUsed = totalChecksUsed + 1;

    if (hasChanges) {
      // Ver 1.3: role 대신 myColor 기준으로 체크한 플레이어 색상 결정
      const checkerColor =
        myColor || (playerRole === 'host' ? 'black' : 'white');
      const winResult = checkWin(newBoard, checkerColor);
      let winner = null;
      let winningStones = [];
      let gameOver = false;

      if (winResult) {
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
        playSound('win.mp3');
      } else {
        const shouldCheckDraw = newTotalChecksUsed >= TOTAL_MAX_CHECKS;
        if (shouldCheckDraw) {
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
    const newBoard = state.originalBoard.map((r) => [...r]);

    checkResults.forEach(({ row, col, finalColor }) => {
      newBoard[row][col] =
        finalColor === 'black' ? BLACK_CONFIRMED : WHITE_CONFIRMED;
    });

    set({
      board: newBoard,
      hasChecked: true,
      winner: gameOver ? winner : null,
      winningStones: winningStones || [],
      gameOver: gameOver || false,
      hostCheckCount:
        hostCheckCount !== undefined ? hostCheckCount : state.hostCheckCount,
      guestCheckCount:
        guestCheckCount !== undefined ? guestCheckCount : state.guestCheckCount,
      totalChecksUsed:
        totalChecksUsed !== undefined ? totalChecksUsed : state.totalChecksUsed,
    });
  },

  // 넘어가기
  passTurn: () => {
    const state = get();
    if (state.gameOver) return null;

    const newTurnIndex = (state.turnIndex + 1) % TURN_SEQUENCE.length;

    set({
      board: state.originalBoard.map((r) => [...r]),
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
      case GAME_ACTIONS.PLACE_STONE: {
        const { row, col, player, type, turnIndex } = actionData;
        const stoneValue = getStoneValue(player, type);
        const state = get();

        const newBoard = state.board.map((r) => [...r]);
        const newOriginalBoard = state.originalBoard.map((r) => [...r]);
        newBoard[row][col] = stoneValue;
        newOriginalBoard[row][col] = stoneValue;

        set({
          board: newBoard,
          originalBoard: newOriginalBoard,
          hasPlacedStone: true,
          turnIndex: turnIndex || state.turnIndex,
        });
        playSound('place.mp3');
        break;
      }

      case GAME_ACTIONS.CHECK: {
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
          playSound('check.mp3');
          if (
            actionData.gameOver &&
            actionData.winner &&
            actionData.winner !== 'draw'
          ) {
            playSound('win.mp3');
          }
        } else {
          const currentState = get();
          set({
            hasChecked: true,
            hostCheckCount:
              actionData.hostCheckCount !== undefined
                ? actionData.hostCheckCount
                : currentState.hostCheckCount,
            guestCheckCount:
              actionData.guestCheckCount !== undefined
                ? actionData.guestCheckCount
                : currentState.guestCheckCount,
            totalChecksUsed:
              actionData.totalChecksUsed !== undefined
                ? actionData.totalChecksUsed
                : currentState.totalChecksUsed,
          });
          playSound('check.mp3');
        }
        break;
      }

      case GAME_ACTIONS.PASS: {
        const currentState = get();
        const passedTurnIndex =
          actionData.turnIndex ||
          (currentState.turnIndex + 1) % TURN_SEQUENCE.length;
        set({
          board: currentState.originalBoard.map((r) => [...r]),
          turnIndex: passedTurnIndex,
          hasPlacedStone: false,
          hasChecked: false,
          winningStones: [],
        });
        break;
      }

      case GAME_ACTIONS.RESET_GAME: {
        get().resetGame();
        playSound('start.mp3');
        break;
      }
    }
  },

  getCurrentTurn: () => TURN_SEQUENCE[get().turnIndex],

  // Ver 1.3: role 대신 myColor 기준으로 내 턴 판단
  isMyTurn: () => {
    const state = get();
    const currentTurn = TURN_SEQUENCE[state.turnIndex];
    // myColor가 설정되어 있으면 color 기준, 없으면 기존 role 기준 (폴백)
    if (state.myColor) {
      return currentTurn.player === state.myColor;
    }
    return state.playerRole === 'host'
      ? currentTurn.player === 'black'
      : currentTurn.player === 'white';
  },

  getMyRemainingChecks: () => {
    const state = get();
    return state.playerRole === 'host'
      ? state.hostCheckCount
      : state.guestCheckCount;
  },

  canCheck: () => {
    const state = get();
    if (state.gameOver) return false;
    const myCheckCount =
      state.playerRole === 'host'
        ? state.hostCheckCount
        : state.guestCheckCount;
    if (myCheckCount <= 0) return false;
    if (!state.isMyTurn()) return false;
    if (state.hasChecked) return false;
    return true;
  },

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

const getStoneValue = (player, type) => {
  if (player === 'black') return type === 90 ? BLACK_90 : BLACK_70;
  return type === 90 ? WHITE_90 : WHITE_70;
};

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

// Ver 1.3: checker는 이제 color 기준 ('black' | 'white')
const checkWin = (board, checker = null) => {
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
          if (player === 'black') blackWins.push({ player: 'black', stones });
          else whiteWins.push({ player: 'white', stones });
        }
      }
    }
  }

  if (blackWins.length > 0 && whiteWins.length > 0) {
    if (checker === 'black') return blackWins[0];
    if (checker === 'white') return whiteWins[0];
    return blackWins[0];
  }

  if (blackWins.length > 0) return blackWins[0];
  if (whiteWins.length > 0) return whiteWins[0];
  return null;
};

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
  TOTAL_CHARACTERS,
  DEFAULT_CHARACTER,
};
