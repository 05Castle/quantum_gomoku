import { create } from 'zustand';

// === 보드 상수 ===
const BOARD_SIZE = 13;
const EMPTY = 0;

// 돌 값 상수 (미확정)
const WHITE_90 = 1;
const WHITE_70 = 2;
const BLUE_90 = 3;
const BLUE_70 = 4;
const RED_90 = 5;
const RED_70 = 6;

// 돌 값 상수 (확정)
const WHITE_CONFIRMED = 7;
const BLUE_CONFIRMED = 8;
const RED_CONFIRMED = 9;

// 플레이어 색상
const PLAYER_COLORS = ['white', 'blue', 'red'];

// 턴 시퀀스: [첫번째, 두번째]는 70돌, [세번째]는 90돌로 시작
// white(70) → blue(70) → red(90) → white(90) → blue(90) → red(70) → 반복
const TURN_SEQUENCE_3P = [
  { player: 'white', type: 70 },
  { player: 'blue', type: 70 },
  { player: 'red', type: 90 },
  { player: 'white', type: 90 },
  { player: 'blue', type: 90 },
  { player: 'red', type: 70 },
];

const GAME_ACTIONS_3P = {
  PLACE_STONE: 'place_stone',
  CHECK: 'check',
  PASS: 'pass',
  RESET_GAME: 'reset_game',
};

const MAX_CHECKS_PER_PLAYER = 3;
const TOTAL_MAX_CHECKS = MAX_CHECKS_PER_PLAYER * 3; // 9회

const TOTAL_CHARACTERS = 8;
const DEFAULT_CHARACTER = 0;

// 사운드 재생
const playSound = (soundFile) => {
  try {
    const audio = new Audio(`/sounds/${soundFile}`);
    audio.play().catch(() => {});
  } catch (error) {}
};

// 빈 보드 생성
const createEmptyBoard = () =>
  Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(EMPTY));

export const useGameStore3P = create((set, get) => ({
  // === 연결 및 플레이어 정보 ===
  isConnected: false,
  roomId: '',
  playerRole: null, // 'host' | 'player2' | 'player3'
  myColor: null, // 'white' | 'blue' | 'red'

  // 닉네임
  myNickname: '',
  player2Nickname: '',
  player3Nickname: '',
  hostNickname: '',

  // 캐릭터
  myCharacter: DEFAULT_CHARACTER,
  player2Character: DEFAULT_CHARACTER,
  player3Character: DEFAULT_CHARACTER,

  // === 게임 상태 ===
  board: createEmptyBoard(),
  originalBoard: createEmptyBoard(),
  turnIndex: 0,
  winner: null, // 'white' | 'blue' | 'red' | 'draw'
  gameOver: false,
  hasPlacedStone: false,
  hasChecked: false,
  winningStones: [],

  // === 체크 횟수 ===
  hostCheckCount: MAX_CHECKS_PER_PLAYER,
  player2CheckCount: MAX_CHECKS_PER_PLAYER,
  player3CheckCount: MAX_CHECKS_PER_PLAYER,
  totalChecksUsed: 0,

  // === 처리한 액션 키 추적 (중복 처리 방지) ===
  processedActionKeys: new Set(),

  // === 매칭 상태 ===
  matchingState: 'waiting',

  // === 액션들 ===

  setPlayerInfo3P: (
    myNickname,
    playerRole,
    roomId,
    myCharacter = DEFAULT_CHARACTER
  ) => set({ myNickname, playerRole, roomId, myCharacter }),

  // 색상 배정 (방 데이터 기반)
  // host → white, player2 → blue, player3 → red (순서는 고정, 나중에 랜덤 가능)
  setMyColor: (playerRole) => {
    const colorMap = {
      host: 'white',
      player2: 'blue',
      player3: 'red',
    };
    set({ myColor: colorMap[playerRole] || 'white' });
  },

  setConnectionState: (isConnected) => set({ isConnected }),
  setMatchingState: (state) => set({ matchingState: state }),

  // 상대방 닉네임/캐릭터 업데이트 (Firestore 구독 시)
  updatePlayersFromRoom: (roomData) => {
    set({
      hostNickname: roomData.hostNickname || '',
      player2Nickname: roomData.player2Nickname || '',
      player3Nickname: roomData.player3Nickname || '',
      player2Character: roomData.player2Character ?? DEFAULT_CHARACTER,
      player3Character: roomData.player3Character ?? DEFAULT_CHARACTER,
    });
  },

  // 게임 상태 초기화
  resetGame3P: () =>
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
      player2CheckCount: MAX_CHECKS_PER_PLAYER,
      player3CheckCount: MAX_CHECKS_PER_PLAYER,
      totalChecksUsed: 0,
      processedActionKeys: new Set(),
    }),

  // 방 나가기
  exitRoom3P: () =>
    set({
      isConnected: false,
      roomId: '',
      playerRole: null,
      myColor: null,
      myNickname: '',
      player2Nickname: '',
      player3Nickname: '',
      hostNickname: '',
      board: createEmptyBoard(),
      originalBoard: createEmptyBoard(),
      turnIndex: 0,
      winner: null,
      gameOver: false,
      hasPlacedStone: false,
      hasChecked: false,
      winningStones: [],
      hostCheckCount: MAX_CHECKS_PER_PLAYER,
      player2CheckCount: MAX_CHECKS_PER_PLAYER,
      player3CheckCount: MAX_CHECKS_PER_PLAYER,
      totalChecksUsed: 0,
      processedActionKeys: new Set(),
      matchingState: 'waiting',
    }),

  // 돌 놓기
  placeStone3P: (row, col) => {
    const state = get();
    const { board, originalBoard, turnIndex, gameOver, hasPlacedStone } = state;

    if (gameOver || board[row][col] !== EMPTY || hasPlacedStone) return null;

    const currentTurn = TURN_SEQUENCE_3P[turnIndex];
    const stoneValue = getStoneValue3P(currentTurn.player, currentTurn.type);

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
      action: GAME_ACTIONS_3P.PLACE_STONE,
      row,
      col,
      player: currentTurn.player,
      type: currentTurn.type,
      turnIndex,
      timestamp: Date.now(),
    };
  },

  // 체크 실행
  executeCheck3P: () => {
    const state = get();
    const {
      originalBoard,
      gameOver,
      hasChecked,
      playerRole,
      hostCheckCount,
      player2CheckCount,
      player3CheckCount,
      totalChecksUsed,
      myColor,
    } = state;

    if (gameOver || hasChecked) return null;

    const myCheckCount = getMyCheckCount(
      playerRole,
      hostCheckCount,
      player2CheckCount,
      player3CheckCount
    );
    if (myCheckCount <= 0) return null;

    const newBoard = originalBoard.map((r) => [...r]);
    const checkResults = [];
    let hasChanges = false;

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cellValue = newBoard[row][col];
        const stoneInfo = getStoneInfo3P(cellValue);

        if (stoneInfo && !stoneInfo.confirmed) {
          const probability = stoneInfo.type / 100;
          const random = Math.random();

          let finalColor;
          if (random < probability) {
            // 자신의 돌로 확정
            finalColor = stoneInfo.player;
          } else {
            // 나머지 확률을 두 상대방에게 균등 분배
            const otherColors = PLAYER_COLORS.filter(
              (c) => c !== stoneInfo.player
            );
            // random이 probability 이상이면 실패
            // 실패 확률 (1 - probability)를 두 상대에게 반반
            const failProb = 1 - probability;
            const rand2 = Math.random();
            finalColor = rand2 < 0.5 ? otherColors[0] : otherColors[1];
          }

          newBoard[row][col] = getConfirmedValue(finalColor);
          checkResults.push({ row, col, finalColor });
          hasChanges = true;
        }
      }
    }

    // 체크 횟수 차감
    const newHostCheckCount =
      playerRole === 'host' ? hostCheckCount - 1 : hostCheckCount;
    const newPlayer2CheckCount =
      playerRole === 'player2' ? player2CheckCount - 1 : player2CheckCount;
    const newPlayer3CheckCount =
      playerRole === 'player3' ? player3CheckCount - 1 : player3CheckCount;
    const newTotalChecksUsed = totalChecksUsed + 1;

    if (hasChanges) {
      const checkerColor = myColor;
      const winResult = checkWin3P(newBoard, checkerColor);
      let winner = null;
      let winningStones = [];
      let isGameOver = false;

      if (winResult) {
        winner = winResult.player;
        winningStones = winResult.stones;
        isGameOver = true;
        set({
          board: newBoard,
          hasChecked: true,
          winner,
          winningStones,
          gameOver: isGameOver,
          hostCheckCount: newHostCheckCount,
          player2CheckCount: newPlayer2CheckCount,
          player3CheckCount: newPlayer3CheckCount,
          totalChecksUsed: newTotalChecksUsed,
        });
        playSound('win.mp3');
      } else {
        const shouldCheckDraw = newTotalChecksUsed >= TOTAL_MAX_CHECKS;
        if (shouldCheckDraw) {
          winner = 'draw';
          isGameOver = true;
        }
        set({
          board: newBoard,
          hasChecked: true,
          winner,
          winningStones: [],
          gameOver: isGameOver,
          hostCheckCount: newHostCheckCount,
          player2CheckCount: newPlayer2CheckCount,
          player3CheckCount: newPlayer3CheckCount,
          totalChecksUsed: newTotalChecksUsed,
        });
      }

      return {
        action: GAME_ACTIONS_3P.CHECK,
        checkResults,
        winner,
        winningStones,
        gameOver: isGameOver,
        hostCheckCount: newHostCheckCount,
        player2CheckCount: newPlayer2CheckCount,
        player3CheckCount: newPlayer3CheckCount,
        totalChecksUsed: newTotalChecksUsed,
        timestamp: Date.now(),
      };
    }

    set({
      hasChecked: true,
      hostCheckCount: newHostCheckCount,
      player2CheckCount: newPlayer2CheckCount,
      player3CheckCount: newPlayer3CheckCount,
      totalChecksUsed: newTotalChecksUsed,
    });

    return {
      action: GAME_ACTIONS_3P.CHECK,
      checkResults: [],
      winner: null,
      winningStones: [],
      gameOver: false,
      hostCheckCount: newHostCheckCount,
      player2CheckCount: newPlayer2CheckCount,
      player3CheckCount: newPlayer3CheckCount,
      totalChecksUsed: newTotalChecksUsed,
      timestamp: Date.now(),
    };
  },

  // 체크 결과 적용 (다른 플레이어가 보낸 결과)
  applyCheckResults3P: (
    checkResults,
    winner,
    winningStones,
    gameOver,
    hostCheckCount,
    player2CheckCount,
    player3CheckCount,
    totalChecksUsed
  ) => {
    const state = get();
    const newBoard = state.originalBoard.map((r) => [...r]);

    checkResults.forEach(({ row, col, finalColor }) => {
      newBoard[row][col] = getConfirmedValue(finalColor);
    });

    set({
      board: newBoard,
      hasChecked: true,
      winner: gameOver ? winner : null,
      winningStones: winningStones || [],
      gameOver: gameOver || false,
      hostCheckCount: hostCheckCount ?? state.hostCheckCount,
      player2CheckCount: player2CheckCount ?? state.player2CheckCount,
      player3CheckCount: player3CheckCount ?? state.player3CheckCount,
      totalChecksUsed: totalChecksUsed ?? state.totalChecksUsed,
    });
  },

  // 넘어가기
  passTurn3P: () => {
    const state = get();
    if (state.gameOver) return null;

    const newTurnIndex = (state.turnIndex + 1) % TURN_SEQUENCE_3P.length;

    set({
      board: state.originalBoard.map((r) => [...r]),
      turnIndex: newTurnIndex,
      hasPlacedStone: false,
      hasChecked: false,
      winningStones: [],
    });

    return {
      action: GAME_ACTIONS_3P.PASS,
      turnIndex: newTurnIndex,
      timestamp: Date.now(),
    };
  },

  // 외부 액션 처리 (다른 플레이어에게 받은 액션)
  processReceivedAction3P: (actionKey, actionData) => {
    const state = get();

    // 중복 처리 방지
    if (state.processedActionKeys.has(actionKey)) return;

    const newProcessedKeys = new Set(state.processedActionKeys);
    newProcessedKeys.add(actionKey);
    set({ processedActionKeys: newProcessedKeys });

    const { action } = actionData;

    switch (action) {
      case GAME_ACTIONS_3P.PLACE_STONE: {
        const { row, col, player, type, turnIndex } = actionData;
        const stoneValue = getStoneValue3P(player, type);
        const currentState = get();

        const newBoard = currentState.board.map((r) => [...r]);
        const newOriginalBoard = currentState.originalBoard.map((r) => [...r]);
        newBoard[row][col] = stoneValue;
        newOriginalBoard[row][col] = stoneValue;

        set({
          board: newBoard,
          originalBoard: newOriginalBoard,
          hasPlacedStone: true,
          turnIndex: turnIndex ?? currentState.turnIndex,
        });
        playSound('place.mp3');
        break;
      }

      case GAME_ACTIONS_3P.CHECK: {
        if (actionData.checkResults !== undefined) {
          get().applyCheckResults3P(
            actionData.checkResults,
            actionData.winner,
            actionData.winningStones,
            actionData.gameOver,
            actionData.hostCheckCount,
            actionData.player2CheckCount,
            actionData.player3CheckCount,
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
        }
        break;
      }

      case GAME_ACTIONS_3P.PASS: {
        const currentState = get();
        const passedTurnIndex =
          actionData.turnIndex ??
          (currentState.turnIndex + 1) % TURN_SEQUENCE_3P.length;
        set({
          board: currentState.originalBoard.map((r) => [...r]),
          turnIndex: passedTurnIndex,
          hasPlacedStone: false,
          hasChecked: false,
          winningStones: [],
        });
        break;
      }

      case GAME_ACTIONS_3P.RESET_GAME: {
        get().resetGame3P();
        playSound('start.mp3');
        break;
      }
    }
  },

  // 유틸리티
  getCurrentTurn3P: () => TURN_SEQUENCE_3P[get().turnIndex],

  isMyTurn3P: () => {
    const state = get();
    const currentTurn = TURN_SEQUENCE_3P[state.turnIndex];
    return currentTurn.player === state.myColor;
  },

  getMyRemainingChecks3P: () => {
    const state = get();
    return getMyCheckCount(
      state.playerRole,
      state.hostCheckCount,
      state.player2CheckCount,
      state.player3CheckCount
    );
  },

  canCheck3P: () => {
    const state = get();
    if (state.gameOver) return false;
    const myCheckCount = getMyCheckCount(
      state.playerRole,
      state.hostCheckCount,
      state.player2CheckCount,
      state.player3CheckCount
    );
    if (myCheckCount <= 0) return false;
    if (!state.isMyTurn3P()) return false;
    if (state.hasChecked) return false;
    return true;
  },

  // 색상으로 닉네임 가져오기
  getNicknameByColor: (color) => {
    const state = get();
    if (color === 'white') return state.hostNickname;
    if (color === 'blue') return state.player2Nickname;
    if (color === 'red') return state.player3Nickname;
    return '';
  },

  getMyNickname3P: () => get().myNickname,
}));

// === 유틸리티 함수 ===

const getStoneValue3P = (player, type) => {
  if (player === 'white') return type === 90 ? WHITE_90 : WHITE_70;
  if (player === 'blue') return type === 90 ? BLUE_90 : BLUE_70;
  return type === 90 ? RED_90 : RED_70;
};

const getConfirmedValue = (color) => {
  if (color === 'white') return WHITE_CONFIRMED;
  if (color === 'blue') return BLUE_CONFIRMED;
  return RED_CONFIRMED;
};

export const getStoneInfo3P = (cellValue) => {
  switch (cellValue) {
    case WHITE_90:
      return { player: 'white', type: 90, confirmed: false };
    case WHITE_70:
      return { player: 'white', type: 70, confirmed: false };
    case WHITE_CONFIRMED:
      return { player: 'white', type: 100, confirmed: true };
    case BLUE_90:
      return { player: 'blue', type: 90, confirmed: false };
    case BLUE_70:
      return { player: 'blue', type: 70, confirmed: false };
    case BLUE_CONFIRMED:
      return { player: 'blue', type: 100, confirmed: true };
    case RED_90:
      return { player: 'red', type: 90, confirmed: false };
    case RED_70:
      return { player: 'red', type: 70, confirmed: false };
    case RED_CONFIRMED:
      return { player: 'red', type: 100, confirmed: true };
    default:
      return null;
  }
};

const getMyCheckCount = (
  playerRole,
  hostCheckCount,
  player2CheckCount,
  player3CheckCount
) => {
  if (playerRole === 'host') return hostCheckCount;
  if (playerRole === 'player2') return player2CheckCount;
  return player3CheckCount;
};

// 3인 승리 판정
// checker: 체크를 누른 플레이어 색상
const checkWin3P = (board, checker = null) => {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  const wins = { white: [], blue: [], red: [] };

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const stoneInfo = getStoneInfo3P(board[row][col]);
      if (!stoneInfo || !stoneInfo.confirmed) continue;

      const player = stoneInfo.player;

      for (let [dr, dc] of directions) {
        let count = 1;
        let stones = [{ row, col }];
        let r = row + dr;
        let c = col + dc;

        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
          const info = getStoneInfo3P(board[r][c]);
          if (info && info.confirmed && info.player === player) {
            count++;
            stones.push({ row: r, col: c });
            r += dr;
            c += dc;
          } else {
            break;
          }
        }

        if (count >= 5) {
          wins[player].push({ player, stones });
        }
      }
    }
  }

  const winners = PLAYER_COLORS.filter((c) => wins[c].length > 0);

  if (winners.length === 0) return null;

  // 체크한 플레이어도 오목 달성 → 체크한 플레이어 승리
  if (checker && winners.includes(checker)) {
    return wins[checker][0];
  }

  // 체크한 플레이어는 오목 없고 상대 1명만 오목 → 그 플레이어 승리
  const otherWinners = winners.filter((c) => c !== checker);
  if (otherWinners.length === 1) {
    return wins[otherWinners[0]][0];
  }

  // 체크한 플레이어 오목 없고 상대 2명 모두 오목 → 무효 (null 반환, 게임 계속)
  if (otherWinners.length >= 2) {
    return null;
  }

  return null;
};

export {
  BOARD_SIZE,
  EMPTY,
  WHITE_90,
  WHITE_70,
  WHITE_CONFIRMED,
  BLUE_90,
  BLUE_70,
  BLUE_CONFIRMED,
  RED_90,
  RED_70,
  RED_CONFIRMED,
  TURN_SEQUENCE_3P,
  GAME_ACTIONS_3P,
  PLAYER_COLORS,
  MAX_CHECKS_PER_PLAYER,
  TOTAL_MAX_CHECKS,
  TOTAL_CHARACTERS,
  DEFAULT_CHARACTER,
};
