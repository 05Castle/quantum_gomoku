import { create } from 'zustand';

// === 보드 상수 ===
const BOARD_SIZE = 13;
const EMPTY = 0;

// 돌 값 상수 (미확정) - 보드에 저장되는 숫자값, 확률과 무관
const WHITE_HIGH = 1; // 백 90돌
const WHITE_LOW = 2; // 백 70돌
const BLACK_HIGH = 3; // 흑 90돌
const BLACK_LOW = 4; // 흑 70돌

// 돌 값 상수 (확정)
const WHITE_CONFIRMED = 5;
const BLACK_CONFIRMED = 6;

// 플레이어 색상
const PLAYER_COLORS = ['white', 'black'];

// === 확률 수치 - 이 두 줄만 수정하면 전체 적용됨 ===
const TYPE_HIGH = 90;
const TYPE_LOW = 70;

// === 체크 횟수 - 이 값들로 밸런스 조정 ===
const HOST_MAX_CHECKS = 4; // 백(호스트) 독자 자원
const TEAM_MAX_CHECKS = 4; // 흑팀 공용 자원
const TOTAL_MAX_CHECKS = HOST_MAX_CHECKS + TEAM_MAX_CHECKS;

// === 턴 시퀀스 ===
// 첫 바퀴: 백 1착수(white_single) → 흑2P → 흑3P
// 이후 반복: 백 2착수(white1→white2) → 흑3P → 흑2P
// phase: 'white_single'=백 첫 바퀴 1착수, 'white1'=백 첫번째, 'white2'=백 두번째, 'black'=흑
const TURN_SEQUENCE_1V2 = [
  // 첫 바퀴
  { player: 'white', sub: 'host', type: TYPE_HIGH, phase: 'white_single' },
  { player: 'black', sub: 'player2', type: TYPE_LOW, phase: 'black' },
  { player: 'black', sub: 'player3', type: TYPE_HIGH, phase: 'black' },
  // 이후 반복 A
  { player: 'white', sub: 'host', type: TYPE_LOW, phase: 'white1' },
  { player: 'white', sub: 'host', type: TYPE_HIGH, phase: 'white2' },
  { player: 'black', sub: 'player3', type: TYPE_LOW, phase: 'black' },
  { player: 'black', sub: 'player2', type: TYPE_HIGH, phase: 'black' },
  // 이후 반복 B (3번 인덱스부터 반복되도록 getNextTeamTurnIndex에서 처리)
  { player: 'white', sub: 'host', type: TYPE_LOW, phase: 'white1' },
  { player: 'white', sub: 'host', type: TYPE_HIGH, phase: 'white2' },
  { player: 'black', sub: 'player3', type: TYPE_LOW, phase: 'black' },
  { player: 'black', sub: 'player2', type: TYPE_HIGH, phase: 'black' },
];

const GAME_ACTIONS_1V2 = {
  PLACE_STONE: 'place_stone',
  CHECK: 'check',
  PASS: 'pass',
  RESET_GAME: 'reset_game',
};

const TOTAL_CHARACTERS = 11;
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

export const useGameStore1v2 = create((set, get) => ({
  // === 연결 및 플레이어 정보 ===
  isConnected: false,
  roomId: '',
  playerRole: null, // 'host' | 'player2' | 'player3'
  myColor: null, // 'white' | 'black'

  // 닉네임
  myNickname: '',
  hostNickname: '',
  player2Nickname: '',
  player3Nickname: '',

  // 캐릭터
  myCharacter: DEFAULT_CHARACTER,
  hostCharacter: DEFAULT_CHARACTER,
  player2Character: DEFAULT_CHARACTER,
  player3Character: DEFAULT_CHARACTER,

  // === 게임 상태 ===
  board: createEmptyBoard(),
  originalBoard: createEmptyBoard(),
  turnIndex: 0,
  winner: null, // 'white' | 'black' | 'draw'
  gameOver: false,

  // 백은 2착수가 필요하므로 착수 횟수로 진행 상태 추적
  // 0=아직 안 둠, 1=1번 둠(백 첫번째 착수 완료), 2=다 둠(체크/패스 가능)
  // 흑은 1=착수 완료(바로 체크/패스 가능)
  placedStoneCount: 0,
  hasChecked: false,
  winningStones: [],

  // === 체크 횟수 ===
  hostCheckCount: HOST_MAX_CHECKS, // 백 독자 자원
  teamCheckCount: TEAM_MAX_CHECKS, // 흑팀 공용 자원
  totalChecksUsed: 0,

  // === 매칭 상태 ===
  matchingState: 'waiting',

  // === 액션들 ===

  setPlayerInfo1v2: (
    myNickname,
    playerRole,
    roomId,
    myCharacter = DEFAULT_CHARACTER
  ) => set({ myNickname, playerRole, roomId, myCharacter }),

  // 색상 배정: host → white, player2/player3 → black
  setMyColor: (playerRole) => {
    set({ myColor: playerRole === 'host' ? 'white' : 'black' });
  },

  setConnectionState: (isConnected) => set({ isConnected }),
  setMatchingState: (state) => set({ matchingState: state }),

  // 플레이어 정보 업데이트
  updatePlayersFromRoom: (roomData) => {
    set({
      hostNickname: roomData.hostNickname || '',
      hostCharacter: roomData.hostCharacter ?? DEFAULT_CHARACTER,
      player2Nickname: roomData.player2Nickname || '',
      player3Nickname: roomData.player3Nickname || '',
      player2Character: roomData.player2Character ?? DEFAULT_CHARACTER,
      player3Character: roomData.player3Character ?? DEFAULT_CHARACTER,
    });
  },

  // 게임 상태 초기화
  resetGame1v2: () => {
    set({
      board: createEmptyBoard(),
      originalBoard: createEmptyBoard(),
      turnIndex: 0,
      winner: null,
      gameOver: false,
      placedStoneCount: 0,
      hasChecked: false,
      winningStones: [],
      hostCheckCount: HOST_MAX_CHECKS,
      teamCheckCount: TEAM_MAX_CHECKS,
      totalChecksUsed: 0,
    });
  },

  // 방 나가기
  exitRoom1v2: () => {
    set({
      isConnected: false,
      roomId: '',
      playerRole: null,
      myColor: null,
      myNickname: '',
      hostNickname: '',
      player2Nickname: '',
      player3Nickname: '',
      board: createEmptyBoard(),
      originalBoard: createEmptyBoard(),
      turnIndex: 0,
      winner: null,
      gameOver: false,
      placedStoneCount: 0,
      hasChecked: false,
      winningStones: [],
      hostCheckCount: HOST_MAX_CHECKS,
      teamCheckCount: TEAM_MAX_CHECKS,
      totalChecksUsed: 0,
      matchingState: 'waiting',
    });
  },

  // 돌 놓기
  // 백(host): white_single → 1착수 후 팝업(체크/패스 가능)
  //           white1 → turnIndex+1(white2로), placedStoneCount=1
  //           white2 → placedStoneCount=2 (체크/패스 가능)
  // 흑(player2/3): 착수 → placedStoneCount=1 (바로 체크/패스 가능)
  placeStone1v2: (row, col) => {
    const state = get();
    const { board, originalBoard, turnIndex, gameOver, placedStoneCount } =
      state;

    const currentTurn = TURN_SEQUENCE_1V2[turnIndex];
    const isWhite = currentTurn.player === 'white';
    const isSingle = currentTurn.phase === 'white_single';
    // white_single은 1착수, white1/white2는 합쳐서 2착수, black은 1착수
    const maxStones = isWhite && !isSingle ? 2 : 1;

    if (gameOver || board[row][col] !== EMPTY || placedStoneCount >= maxStones)
      return null;

    const stoneValue = getStoneValue1v2(currentTurn.player, currentTurn.type);
    const newBoard = board.map((r) => [...r]);
    const newOriginalBoard = originalBoard.map((r) => [...r]);
    newBoard[row][col] = stoneValue;
    newOriginalBoard[row][col] = stoneValue;

    // 백의 첫 번째 착수(white1): turnIndex를 white2로 넘김
    const isWhiteFirst = isWhite && currentTurn.phase === 'white1';
    const newTurnIndex = isWhiteFirst ? turnIndex + 1 : turnIndex;
    const newPlacedStoneCount = placedStoneCount + 1;

    set({
      board: newBoard,
      originalBoard: newOriginalBoard,
      placedStoneCount: newPlacedStoneCount,
      turnIndex: newTurnIndex,
    });

    return {
      action: GAME_ACTIONS_1V2.PLACE_STONE,
      row,
      col,
      player: currentTurn.player,
      type: currentTurn.type,
      phase: currentTurn.phase,
      turnIndex: newTurnIndex,
      placedStoneCount: newPlacedStoneCount,
      timestamp: Date.now(),
    };
  },

  // 체크 실행
  executeCheck1v2: () => {
    const state = get();
    const {
      originalBoard,
      gameOver,
      hasChecked,
      playerRole,
      hostCheckCount,
      teamCheckCount,
      totalChecksUsed,
      myColor,
      placedStoneCount,
      turnIndex,
    } = state;

    if (gameOver || hasChecked) return null;

    // 착수 완료 여부 확인
    const currentTurn = TURN_SEQUENCE_1V2[turnIndex];
    const isSingle = currentTurn.phase === 'white_single';
    const requiredStones = currentTurn.player === 'white' && !isSingle ? 2 : 1;
    if (placedStoneCount < requiredStones) return null;

    // 체크 횟수 확인
    const myCheckCount =
      playerRole === 'host' ? hostCheckCount : teamCheckCount;
    if (myCheckCount <= 0) return null;

    const newBoard = originalBoard.map((r) => [...r]);
    const checkResults = [];
    let hasChanges = false;

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cellValue = newBoard[row][col];
        const stoneInfo = getStoneInfo1v2(cellValue);

        if (stoneInfo && !stoneInfo.confirmed) {
          const probability = stoneInfo.type / 100;
          const random = Math.random();
          // 1v2는 2색이므로 실패 시 무조건 상대 색
          const finalColor =
            random < probability
              ? stoneInfo.player
              : stoneInfo.player === 'white'
                ? 'black'
                : 'white';

          newBoard[row][col] = getConfirmedValue1v2(finalColor);
          checkResults.push({ row, col, finalColor });
          hasChanges = true;
        }
      }
    }

    const newHostCheckCount =
      playerRole === 'host' ? hostCheckCount - 1 : hostCheckCount;
    const newTeamCheckCount =
      playerRole !== 'host' ? teamCheckCount - 1 : teamCheckCount;
    const newTotalChecksUsed = totalChecksUsed + 1;

    let winner = null;
    let winningStones = [];
    let isGameOver = false;

    if (hasChanges) {
      const winResult = checkWin1v2(newBoard, myColor);
      if (winResult) {
        winner = winResult.player;
        winningStones = winResult.stones;
        isGameOver = true;
        playSound('win.mp3');
      } else if (newTotalChecksUsed >= TOTAL_MAX_CHECKS) {
        winner = 'draw';
        isGameOver = true;
      }
    } else if (newTotalChecksUsed >= TOTAL_MAX_CHECKS) {
      winner = 'draw';
      isGameOver = true;
    }

    set({
      board: newBoard,
      hasChecked: true,
      winner: isGameOver ? winner : null,
      winningStones,
      gameOver: isGameOver,
      hostCheckCount: newHostCheckCount,
      teamCheckCount: newTeamCheckCount,
      totalChecksUsed: newTotalChecksUsed,
    });

    return {
      action: GAME_ACTIONS_1V2.CHECK,
      checkResults,
      winner,
      winningStones,
      gameOver: isGameOver,
      hostCheckCount: newHostCheckCount,
      teamCheckCount: newTeamCheckCount,
      totalChecksUsed: newTotalChecksUsed,
      timestamp: Date.now(),
    };
  },

  // 체크 결과 적용 (상대방에게서 받은 결과)
  applyCheckResults1v2: (
    checkResults,
    winner,
    winningStones,
    gameOver,
    hostCheckCount,
    teamCheckCount,
    totalChecksUsed
  ) => {
    const state = get();
    const newBoard = state.originalBoard.map((r) => [...r]);

    checkResults.forEach(({ row, col, finalColor }) => {
      newBoard[row][col] = getConfirmedValue1v2(finalColor);
    });

    set({
      board: newBoard,
      hasChecked: true,
      winner: gameOver ? winner : null,
      winningStones: winningStones || [],
      gameOver: gameOver || false,
      hostCheckCount: hostCheckCount ?? state.hostCheckCount,
      teamCheckCount: teamCheckCount ?? state.teamCheckCount,
      totalChecksUsed: totalChecksUsed ?? state.totalChecksUsed,
    });
  },

  // 넘어가기 - 다음 팀 첫 번째 phase로 이동
  passTurn1v2: () => {
    const state = get();
    if (state.gameOver) return null;

    const newTurnIndex = getNextTeamTurnIndex(state.turnIndex);

    set({
      board: state.originalBoard.map((r) => [...r]),
      turnIndex: newTurnIndex,
      placedStoneCount: 0,
      hasChecked: false,
      winningStones: [],
    });

    return {
      action: GAME_ACTIONS_1V2.PASS,
      turnIndex: newTurnIndex,
      timestamp: Date.now(),
    };
  },

  // 외부 액션 처리
  processReceivedAction1v2: (actionKey, actionData) => {
    const { action } = actionData;

    switch (action) {
      case GAME_ACTIONS_1V2.PLACE_STONE: {
        const { row, col, player, type, turnIndex, placedStoneCount } =
          actionData;
        const stoneValue = getStoneValue1v2(player, type);
        const state = get();

        const newBoard = state.board.map((r) => [...r]);
        const newOriginalBoard = state.originalBoard.map((r) => [...r]);
        newBoard[row][col] = stoneValue;
        newOriginalBoard[row][col] = stoneValue;

        set({
          board: newBoard,
          originalBoard: newOriginalBoard,
          placedStoneCount: placedStoneCount ?? 1,
          turnIndex: turnIndex ?? state.turnIndex,
        });
        playSound('place.mp3');
        break;
      }

      case GAME_ACTIONS_1V2.CHECK: {
        if (actionData.checkResults !== undefined) {
          get().applyCheckResults1v2(
            actionData.checkResults,
            actionData.winner,
            actionData.winningStones,
            actionData.gameOver,
            actionData.hostCheckCount,
            actionData.teamCheckCount,
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

      case GAME_ACTIONS_1V2.PASS: {
        const currentState = get();
        const passedTurnIndex =
          actionData.turnIndex ?? getNextTeamTurnIndex(currentState.turnIndex);
        set({
          board: currentState.originalBoard.map((r) => [...r]),
          turnIndex: passedTurnIndex,
          placedStoneCount: 0,
          hasChecked: false,
          winningStones: [],
        });
        break;
      }

      case GAME_ACTIONS_1V2.RESET_GAME: {
        get().resetGame1v2();
        playSound('start.mp3');
        break;
      }
    }
  },

  // 유틸리티
  getCurrentTurn1v2: () => TURN_SEQUENCE_1V2[get().turnIndex],

  // 내 턴 여부
  // 백: white1 또는 white2 모두 내 턴
  // 흑: 현재 sub가 내 playerRole과 일치할 때만
  isMyTurn1v2: () => {
    const state = get();
    const currentTurn = TURN_SEQUENCE_1V2[state.turnIndex];
    if (state.playerRole === 'host') return currentTurn.player === 'white';
    return currentTurn.sub === state.playerRole;
  },

  // 체크/패스 팝업 표시 여부
  // 백 white_single: placedStoneCount=1
  // 백 white1/white2: placedStoneCount=2
  // 흑: placedStoneCount=1
  canActAfterPlace1v2: () => {
    const state = get();
    if (state.gameOver || state.hasChecked) return false;
    if (!state.isMyTurn1v2()) return false;
    const currentTurn = TURN_SEQUENCE_1V2[state.turnIndex];
    const isSingle = currentTurn.phase === 'white_single';
    const required = currentTurn.player === 'white' && !isSingle ? 2 : 1;
    return state.placedStoneCount >= required;
  },

  canCheck1v2: () => {
    const state = get();
    if (!state.canActAfterPlace1v2()) return false;
    const myCheckCount =
      state.playerRole === 'host' ? state.hostCheckCount : state.teamCheckCount;
    return myCheckCount > 0;
  },

  getMyRemainingChecks1v2: () => {
    const state = get();
    return state.playerRole === 'host'
      ? state.hostCheckCount
      : state.teamCheckCount;
  },

  getNicknameByColor: (color) => {
    const state = get();
    if (color === 'white') return state.hostNickname;
    return `${state.player2Nickname} & ${state.player3Nickname}`;
  },

  getNicknameByRole: (role) => {
    const state = get();
    if (role === 'host') return state.hostNickname;
    if (role === 'player2') return state.player2Nickname;
    if (role === 'player3') return state.player3Nickname;
    return '';
  },
}));

// === 유틸리티 함수 ===

// 다음 턴 인덱스 계산
// 첫 바퀴(0~2) 이후에는 반복 구간(3~6)에서만 순환
const REPEAT_START = 3; // 반복 시작 인덱스 (첫 반복 A의 white1)
const REPEAT_END = 6; // 반복 끝 인덱스 (반복 A의 마지막 black)

const getNextTeamTurnIndex = (currentIndex) => {
  const next = currentIndex + 1;
  // 첫 바퀴(0~2) 내에서는 그냥 다음으로
  if (currentIndex < REPEAT_START) return next;
  // 반복 구간 끝(6)에 도달하면 반복 시작(3)으로
  if (next > REPEAT_END) return REPEAT_START;
  return next;
};

const getStoneValue1v2 = (player, type) => {
  const isHigh = type >= TYPE_HIGH;
  if (player === 'white') return isHigh ? WHITE_HIGH : WHITE_LOW;
  return isHigh ? BLACK_HIGH : BLACK_LOW;
};

const getConfirmedValue1v2 = (color) => {
  return color === 'white' ? WHITE_CONFIRMED : BLACK_CONFIRMED;
};

export const getStoneInfo1v2 = (cellValue) => {
  switch (cellValue) {
    case WHITE_HIGH:
      return { player: 'white', type: TYPE_HIGH, confirmed: false };
    case WHITE_LOW:
      return { player: 'white', type: TYPE_LOW, confirmed: false };
    case WHITE_CONFIRMED:
      return { player: 'white', type: 100, confirmed: true };
    case BLACK_HIGH:
      return { player: 'black', type: TYPE_HIGH, confirmed: false };
    case BLACK_LOW:
      return { player: 'black', type: TYPE_LOW, confirmed: false };
    case BLACK_CONFIRMED:
      return { player: 'black', type: 100, confirmed: true };
    default:
      return null;
  }
};

// 1v2 승리 판정 - 2색이므로 단순
// 둘 다 5목이면 체크한 플레이어 우선
const checkWin1v2 = (board, checker = null) => {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  const wins = { white: [], black: [] };

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const stoneInfo = getStoneInfo1v2(board[row][col]);
      if (!stoneInfo || !stoneInfo.confirmed) continue;

      const player = stoneInfo.player;

      for (let [dr, dc] of directions) {
        let count = 1;
        let stones = [{ row, col }];
        let r = row + dr;
        let c = col + dc;

        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
          const info = getStoneInfo1v2(board[r][c]);
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

  // 둘 다 오목 → 체크한 플레이어 우선
  if (wins.white.length > 0 && wins.black.length > 0) {
    if (checker && wins[checker]?.length > 0) return wins[checker][0];
    return wins.white[0];
  }

  if (wins.white.length > 0) return wins.white[0];
  if (wins.black.length > 0) return wins.black[0];
  return null;
};

export {
  BOARD_SIZE,
  EMPTY,
  WHITE_HIGH,
  WHITE_LOW,
  WHITE_CONFIRMED,
  BLACK_HIGH,
  BLACK_LOW,
  BLACK_CONFIRMED,
  PLAYER_COLORS,
  TURN_SEQUENCE_1V2,
  GAME_ACTIONS_1V2,
  HOST_MAX_CHECKS,
  TEAM_MAX_CHECKS,
  TOTAL_MAX_CHECKS,
  TOTAL_CHARACTERS,
  DEFAULT_CHARACTER,
  TYPE_HIGH,
  TYPE_LOW,
};
