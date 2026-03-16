import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  subscribeToDocument,
  generateRoomId,
  documentExists,
  getErrorMessage,
} from './firebaseService';

// 방 상태 상수
const ROOM_STATUS_3P = {
  WAITING: 'waiting',
  WAITING_THIRD: 'waiting_third', // 2명 모였고 3번째 대기 중
  PLAYING: 'playing',
  FINISHED: 'finished',
};

// 돌 색상 상수
const STONE_COLORS = ['white', 'blue', 'red'];

/**
 * 새 3인 방 생성
 */
export const createRoom3P = async (hostNickname, hostCharacter = 0) => {
  try {
    let roomId;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      roomId = generateRoomId();
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error('방 ID 생성에 실패했습니다. 다시 시도해주세요.');
      }
    } while (await documentExists('rooms3p', roomId));

    const roomData = {
      // 플레이어 정보
      hostNickname: hostNickname,
      hostCharacter: hostCharacter,
      player2Nickname: null,
      player2Character: 0,
      player3Nickname: null,
      player3Character: 0,

      // 연결 상태
      hostConnected: true,
      player2Connected: false,
      player3Connected: false,

      // 방 상태
      status: ROOM_STATUS_3P.WAITING,
      maxPlayers: 3,
      currentPlayerCount: 1,

      // 게임 데이터
      // 2인과 달리 actions 맵 구조 사용 (turnIndex 기준)
      actions: {},
      currentTurnIndex: 0,

      // 체크 횟수
      hostCheckCount: 3,
      player2CheckCount: 3,
      player3CheckCount: 3,
      totalChecksUsed: 0,

      // 메타데이터
      roomId: roomId,
    };

    await createDocument('rooms3p', roomId, roomData);
    return { success: true, roomId };
  } catch (error) {
    console.error('3인 방 생성 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 3인 방 참가
 */
export const joinRoom3P = async (roomId, nickname, character = 0) => {
  try {
    const roomData = await getDocument('rooms3p', roomId);

    if (!roomData) {
      return { success: false, error: '존재하지 않는 방 ID입니다.' };
    }

    if (
      roomData.status === ROOM_STATUS_3P.PLAYING ||
      roomData.status === ROOM_STATUS_3P.FINISHED
    ) {
      return {
        success: false,
        error: '이미 게임이 진행 중이거나 종료된 방입니다.',
      };
    }

    if (roomData.currentPlayerCount >= roomData.maxPlayers) {
      return { success: false, error: '방이 가득 찼습니다.' };
    }

    // 닉네임 중복 확인
    if (
      roomData.hostNickname === nickname ||
      roomData.player2Nickname === nickname
    ) {
      return { success: false, error: '이미 사용 중인 닉네임입니다.' };
    }

    // 2번째 플레이어
    if (!roomData.player2Nickname) {
      const updateData = {
        player2Nickname: nickname,
        player2Character: character,
        player2Connected: true,
        currentPlayerCount: 2,
        status: ROOM_STATUS_3P.WAITING_THIRD,
      };
      await updateDocument('rooms3p', roomId, updateData);
      const updatedRoomData = await getDocument('rooms3p', roomId);
      return {
        success: true,
        playerRole: 'player2',
        roomData: updatedRoomData,
      };
    }

    // 3번째 플레이어
    if (!roomData.player3Nickname) {
      const updateData = {
        player3Nickname: nickname,
        player3Character: character,
        player3Connected: true,
        currentPlayerCount: 3,
        status: ROOM_STATUS_3P.PLAYING,
      };
      await updateDocument('rooms3p', roomId, updateData);
      const updatedRoomData = await getDocument('rooms3p', roomId);
      return {
        success: true,
        playerRole: 'player3',
        roomData: updatedRoomData,
      };
    }

    return { success: false, error: '방이 가득 찼습니다.' };
  } catch (error) {
    console.error('3인 방 참가 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 게임 액션 전송 (턴 인덱스 기준 저장 - 덮어쓰기 방지)
 */
export const sendGameAction3P = async (roomId, actionData) => {
  try {
    const roomData = await getDocument('rooms3p', roomId);

    if (!roomData) {
      return { success: false, error: '방을 찾을 수 없습니다.' };
    }

    if (
      actionData.action !== 'reset_game' &&
      roomData.status !== ROOM_STATUS_3P.PLAYING
    ) {
      return { success: false, error: '게임이 진행 중이 아닙니다.' };
    }

    const updateData = {};

    if (actionData.action === 'reset_game') {
      // 리셋 시 actions 맵 초기화
      updateData.actions = {};
      updateData.currentTurnIndex = 0;
      updateData.status = ROOM_STATUS_3P.PLAYING;
      updateData.hostCheckCount = 3;
      updateData.player2CheckCount = 3;
      updateData.player3CheckCount = 3;
      updateData.totalChecksUsed = 0;
    } else {
      // 턴 인덱스를 키로 액션 저장 (덮어쓰기 방지)
      const turnKey = `${actionData.sender}_${actionData.timestamp ?? Date.now()}`;
      updateData[`actions.${turnKey}`] = {
        ...actionData,
        timestamp: Date.now(),
      };

      if (actionData.turnIndex !== undefined) {
        updateData.currentTurnIndex = actionData.turnIndex;
      }

      if (actionData.action === 'check') {
        updateData.hostCheckCount = actionData.hostCheckCount;
        updateData.player2CheckCount = actionData.player2CheckCount;
        updateData.player3CheckCount = actionData.player3CheckCount;
        updateData.totalChecksUsed = actionData.totalChecksUsed;
      }

      if (actionData.action === 'check' && actionData.gameOver) {
        updateData.status = ROOM_STATUS_3P.FINISHED;
      }
    }

    await updateDocument('rooms3p', roomId, updateData);
    return { success: true };
  } catch (error) {
    console.error('3인 액션 전송 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 3인 방 실시간 구독
 */
export const subscribeToRoom3P = (roomId, onRoomUpdate, onError) => {
  const unsubscribe = subscribeToDocument(
    'rooms3p',
    roomId,
    (roomData, error) => {
      if (error) {
        console.error('3인 방 구독 에러:', error);
        onError && onError(getErrorMessage(error));
        return;
      }

      if (roomData) {
        onRoomUpdate(roomData);
      } else {
        onError && onError('방이 삭제되었습니다.');
      }
    }
  );

  return unsubscribe;
};

/**
 * 3인 방 나가기
 */
export const leaveRoom3P = async (roomId, playerRole) => {
  try {
    const roomData = await getDocument('rooms3p', roomId);
    if (!roomData) return { success: true };

    if (playerRole === 'host') {
      // 호스트가 나가면 방 삭제
      await deleteDocument('rooms3p', roomId);
    } else {
      // 게스트가 나가면 대기 상태로
      const updateData = {
        [`${playerRole}Nickname`]: null,
        [`${playerRole}Character`]: 0,
        [`${playerRole}Connected`]: false,
        currentPlayerCount: roomData.currentPlayerCount - 1,
        status: ROOM_STATUS_3P.WAITING_THIRD,
        actions: {},
        hostCheckCount: 3,
        player2CheckCount: 3,
        player3CheckCount: 3,
        totalChecksUsed: 0,
      };
      await updateDocument('rooms3p', roomId, updateData);
    }

    return { success: true };
  } catch (error) {
    console.error('3인 방 나가기 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 연결 상태 업데이트
 */
export const updateConnectionStatus3P = async (
  roomId,
  playerRole,
  connected
) => {
  try {
    const field = `${playerRole}Connected`;
    await updateDocument('rooms3p', roomId, { [field]: connected });
  } catch (error) {
    console.error('3인 연결 상태 업데이트 실패:', error);
  }
};

export { ROOM_STATUS_3P, STONE_COLORS };
