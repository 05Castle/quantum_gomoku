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
 * Ver 1.3: 새 방 생성 (캐릭터 정보 + 돌 색상 랜덤 배정)
 * @param {string} hostNickname - 호스트 닉네임
 * @param {number} hostCharacter - 호스트 캐릭터 인덱스 (0~7)
 * @returns {object} - { success: boolean, roomId: string, error?: string }
 */
export const createRoom = async (hostNickname, hostCharacter = 0) => {
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

    // Ver 1.3: 호스트의 돌 색상 랜덤 배정
    const hostColor = Math.random() < 0.5 ? 'black' : 'white';

    // 방 데이터 구조
    const roomData = {
      // 기본 방 정보
      hostNickname: hostNickname,
      hostCharacter: hostCharacter,
      hostColor: hostColor, // Ver 1.3: 호스트 돌 색상
      guestNickname: null,
      guestCharacter: 0,
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

    return { success: true, roomId, hostColor };
  } catch (error) {
    console.error('방 생성 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * Ver 1.2: 방 참가 (캐릭터 정보 포함)
 * @param {string} roomId - 방 ID
 * @param {string} guestNickname - 게스트 닉네임
 * @param {number} guestCharacter - 게스트 캐릭터 인덱스 (0~7)
 * @returns {object} - { success: boolean, roomData?: object, error?: string }
 */
export const joinRoom = async (roomId, guestNickname, guestCharacter = 0) => {
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
      guestCharacter: guestCharacter,
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

    // 체크 액션의 경우 추가 검증
    if (actionData.action === 'check') {
      const senderRole = actionData.sender;
      const currentCheckCount =
        senderRole === 'host'
          ? roomData.hostCheckCount
          : roomData.guestCheckCount;

      if (currentCheckCount <= 0) {
        return { success: false, error: '체크 횟수가 부족합니다.' };
      }
    }

    // 액션 데이터 업데이트
    const updateData = {
      currentAction: {
        ...actionData,
        timestamp: Date.now(),
      },
    };

    if (actionData.turnIndex !== undefined) {
      updateData.currentTurnIndex = actionData.turnIndex;
    }

    if (actionData.action === 'check') {
      updateData.hostCheckCount = actionData.hostCheckCount;
      updateData.guestCheckCount = actionData.guestCheckCount;
      updateData.totalChecksUsed = actionData.totalChecksUsed;
    }

    // Ver 1.3: 리셋 시 새로운 랜덤 색상 배정
    if (actionData.action === 'reset_game') {
      const newHostColor = Math.random() < 0.5 ? 'black' : 'white';
      updateData.status = ROOM_STATUS.PLAYING;
      updateData.hostColor = newHostColor;
      updateData.hostCheckCount = 4;
      updateData.guestCheckCount = 4;
      updateData.totalChecksUsed = 0;
    }

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
 * Ver 1.2: 방 나가기
 */
export const leaveRoom = async (roomId, playerRole) => {
  try {
    const roomData = await getDocument('rooms', roomId);

    if (!roomData) {
      return { success: true };
    }

    if (playerRole === 'host') {
      await deleteDocument('rooms', roomId);
    } else {
      const updateData = {
        guestNickname: null,
        guestCharacter: 0,
        guestConnected: false,
        currentPlayerCount: 1,
        status: ROOM_STATUS.WAITING,
        currentAction: null,
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
 */
export const updateConnectionStatus = async (roomId, playerRole, connected) => {
  try {
    const field = playerRole === 'host' ? 'hostConnected' : 'guestConnected';
    await updateDocument('rooms', roomId, { [field]: connected });
  } catch (error) {
    console.error('연결 상태 업데이트 실패:', error);
  }
};

/**
 * 방 정보 조회 (일회성)
 */
export const getRoomInfo = async (roomId) => {
  try {
    return await getDocument('rooms', roomId);
  } catch (error) {
    console.error('방 정보 조회 실패:', error);
    return null;
  }
};

export { ROOM_STATUS };
