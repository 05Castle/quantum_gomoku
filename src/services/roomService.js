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
const ROOM_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished',
};

// === 방 관리 함수들 ===

/**
 * 새 방 생성
 * @param {string} hostNickname - 호스트 닉네임
 * @returns {object} - { success: boolean, roomId: string, error?: string }
 */
export const createRoom = async (hostNickname) => {
  try {
    // 고유한 방 ID 생성 (중복 체크)
    let roomId;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      roomId = generateRoomId();
      attempts++;

      if (attempts > maxAttempts) {
        throw new Error('방 ID 생성에 실패했습니다. 다시 시도해주세요.');
      }
    } while (await documentExists('rooms', roomId));

    // 방 데이터 구조
    const roomData = {
      // 기본 방 정보
      hostNickname: hostNickname,
      guestNickname: null,
      hostConnected: true,
      guestConnected: false,

      // 방 상태
      status: ROOM_STATUS.WAITING,
      maxPlayers: 2,
      currentPlayerCount: 1,

      // 게임 데이터
      currentAction: null,
      gameState: null,

      // 체크 횟수 관리
      hostCheckCount: 4,
      guestCheckCount: 4,
      totalChecksUsed: 0,

      // 메타데이터
      roomId: roomId,
    };

    await createDocument('rooms', roomId, roomData);

    return { success: true, roomId };
  } catch (error) {
    console.error('방 생성 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 방 참가
 * @param {string} roomId - 방 ID
 * @param {string} guestNickname - 게스트 닉네임
 * @returns {object} - { success: boolean, roomData?: object, error?: string }
 */
export const joinRoom = async (roomId, guestNickname) => {
  try {
    // 방 존재 여부 확인
    const roomData = await getDocument('rooms', roomId);

    if (!roomData) {
      return { success: false, error: '존재하지 않는 방 ID입니다.' };
    }

    // 방 상태 검증
    if (roomData.status !== ROOM_STATUS.WAITING) {
      return {
        success: false,
        error: '이미 게임이 진행 중이거나 종료된 방입니다.',
      };
    }

    if (roomData.currentPlayerCount >= roomData.maxPlayers) {
      return { success: false, error: '방이 가득 찼습니다.' };
    }

    if (roomData.guestNickname) {
      return { success: false, error: '이미 다른 플레이어가 참가해 있습니다.' };
    }

    // 닉네임 중복 확인
    if (roomData.hostNickname === guestNickname) {
      return {
        success: false,
        error: '호스트와 같은 닉네임은 사용할 수 없습니다.',
      };
    }

    // 게스트 추가
    const updateData = {
      guestNickname: guestNickname,
      guestConnected: true,
      currentPlayerCount: 2,
      status: ROOM_STATUS.PLAYING,
    };

    await updateDocument('rooms', roomId, updateData);

    // 업데이트된 방 데이터 반환
    const updatedRoomData = await getDocument('rooms', roomId);

    return { success: true, roomData: updatedRoomData };
  } catch (error) {
    console.error('방 참가 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 게임 액션 전송
 * @param {string} roomId - 방 ID
 * @param {object} actionData - 게임 액션 데이터
 * @returns {object} - { success: boolean, error?: string }
 */
export const sendGameAction = async (roomId, actionData) => {
  try {
    // 방 존재 여부 확인
    const roomData = await getDocument('rooms', roomId);

    if (!roomData) {
      return { success: false, error: '방을 찾을 수 없습니다.' };
    }

    // 리셋 액션은 게임 상태와 관계없이 허용
    if (
      actionData.action !== 'reset_game' &&
      roomData.status !== ROOM_STATUS.PLAYING
    ) {
      return { success: false, error: '게임이 진행 중이 아닙니다.' };
    }

    // 액션 데이터 업데이트
    const updateData = {
      currentAction: {
        ...actionData,
        timestamp: Date.now(),
      },
    };

    // turnIndex가 있으면 추가
    if (actionData.turnIndex !== undefined) {
      updateData.currentTurnIndex = actionData.turnIndex;
    }

    // 체크 액션인 경우 체크 횟수 정보 동기화
    if (actionData.action === 'check') {
      if (actionData.hostCheckCount !== undefined) {
        updateData.hostCheckCount = actionData.hostCheckCount;
      }
      if (actionData.guestCheckCount !== undefined) {
        updateData.guestCheckCount = actionData.guestCheckCount;
      }
      if (actionData.totalChecksUsed !== undefined) {
        updateData.totalChecksUsed = actionData.totalChecksUsed;
      }
    }

    // 리셋 액션인 경우 상태 및 체크 횟수 초기화
    if (actionData.action === 'reset_game') {
      updateData.status = ROOM_STATUS.PLAYING;
      updateData.hostCheckCount = 4;
      updateData.guestCheckCount = 4;
      updateData.totalChecksUsed = 0;
    }

    // 게임 종료 액션인 경우 상태 변경
    if (actionData.action === 'check' && actionData.gameOver) {
      updateData.status = ROOM_STATUS.FINISHED;
    }

    await updateDocument('rooms', roomId, updateData);

    return { success: true };
  } catch (error) {
    console.error('액션 전송 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 방 실시간 구독
 * @param {string} roomId - 방 ID
 * @param {function} onRoomUpdate - 방 업데이트 콜백
 * @param {function} onError - 에러 콜백
 * @returns {function} - 구독 해제 함수
 */
export const subscribeToRoom = (roomId, onRoomUpdate, onError) => {
  const unsubscribe = subscribeToDocument(
    'rooms',
    roomId,
    (roomData, error) => {
      if (error) {
        console.error('방 구독 에러:', error);
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
 * 방 나가기
 * @param {string} roomId - 방 ID
 * @param {string} playerRole - 플레이어 역할 ('host' | 'guest')
 * @returns {object} - { success: boolean, error?: string }
 */
export const leaveRoom = async (roomId, playerRole) => {
  try {
    const roomData = await getDocument('rooms', roomId);

    if (!roomData) {
      return { success: true }; // 이미 방이 없으면 성공으로 처리
    }

    if (playerRole === 'host') {
      // 호스트가 나가면 방 삭제
      await deleteDocument('rooms', roomId);
    } else {
      // 게스트가 나가면 대기 상태로 복원
      const updateData = {
        guestNickname: null,
        guestConnected: false,
        currentPlayerCount: 1,
        status: ROOM_STATUS.WAITING,
        currentAction: null,
        // 체크 횟수도 초기화
        hostCheckCount: 4,
        guestCheckCount: 4,
        totalChecksUsed: 0,
      };

      await updateDocument('rooms', roomId, updateData);
    }

    return { success: true };
  } catch (error) {
    console.error('방 나가기 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 연결 상태 업데이트
 * @param {string} roomId - 방 ID
 * @param {string} playerRole - 플레이어 역할
 * @param {boolean} connected - 연결 상태
 */
export const updateConnectionStatus = async (roomId, playerRole, connected) => {
  try {
    const field = playerRole === 'host' ? 'hostConnected' : 'guestConnected';
    const updateData = { [field]: connected };

    await updateDocument('rooms', roomId, updateData);
  } catch (error) {
    console.error('연결 상태 업데이트 실패:', error);
  }
};

/**
 * 방 정보 조회 (일회성)
 * @param {string} roomId - 방 ID
 * @returns {object|null} - 방 데이터 또는 null
 */
export const getRoomInfo = async (roomId) => {
  try {
    return await getDocument('rooms', roomId);
  } catch (error) {
    console.error('방 정보 조회 실패:', error);
    return null;
  }
};

// 상수 export
export { ROOM_STATUS };
