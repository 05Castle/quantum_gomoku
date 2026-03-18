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

const ROOM_STATUS_1V2 = {
  WAITING: 'waiting',
  WAITING_THIRD: 'waiting_third',
  PLAYING: 'playing',
  FINISHED: 'finished',
};

/**
 * 새 1v2 방 생성 (호스트 = 백)
 */
export const createRoom1v2 = async (hostNickname, hostCharacter = 0) => {
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
    } while (await documentExists('rooms1v2', roomId));

    const roomData = {
      hostNickname,
      hostCharacter,
      player2Nickname: null,
      player2Character: 0,
      player3Nickname: null,
      player3Character: 0,
      hostConnected: true,
      player2Connected: false,
      player3Connected: false,
      status: ROOM_STATUS_1V2.WAITING,
      maxPlayers: 3,
      currentPlayerCount: 1,
      lastAction: null,
      currentTurnIndex: 0,
      hostCheckCount: 4, // 백 독자 자원
      teamCheckCount: 4, // 흑팀 공용 자원
      totalChecksUsed: 0,
      playerLeftSignal: null,
      resetSignal: null,
      roomId,
    };

    await createDocument('rooms1v2', roomId, roomData);
    return { success: true, roomId };
  } catch (error) {
    console.error('1v2 방 생성 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 1v2 방 참가 (흑팀 player2/player3)
 */
export const joinRoom1v2 = async (roomId, nickname, character = 0) => {
  try {
    const roomData = await getDocument('rooms1v2', roomId);

    if (!roomData)
      return { success: false, error: '존재하지 않는 방 ID입니다.' };

    if (
      roomData.status === ROOM_STATUS_1V2.PLAYING ||
      roomData.status === ROOM_STATUS_1V2.FINISHED
    ) {
      return {
        success: false,
        error: '이미 게임이 진행 중이거나 종료된 방입니다.',
      };
    }

    if (roomData.currentPlayerCount >= roomData.maxPlayers) {
      return { success: false, error: '방이 가득 찼습니다.' };
    }

    if (
      roomData.hostNickname === nickname ||
      roomData.player2Nickname === nickname
    ) {
      return { success: false, error: '이미 사용 중인 닉네임입니다.' };
    }

    if (!roomData.player2Nickname) {
      await updateDocument('rooms1v2', roomId, {
        player2Nickname: nickname,
        player2Character: character,
        player2Connected: true,
        currentPlayerCount: 2,
        status: ROOM_STATUS_1V2.WAITING_THIRD,
      });
      const updated = await getDocument('rooms1v2', roomId);
      return { success: true, playerRole: 'player2', roomData: updated };
    }

    if (!roomData.player3Nickname) {
      await updateDocument('rooms1v2', roomId, {
        player3Nickname: nickname,
        player3Character: character,
        player3Connected: true,
        currentPlayerCount: 3,
        status: ROOM_STATUS_1V2.PLAYING,
      });
      const updated = await getDocument('rooms1v2', roomId);
      return { success: true, playerRole: 'player3', roomData: updated };
    }

    return { success: false, error: '방이 가득 찼습니다.' };
  } catch (error) {
    console.error('1v2 방 참가 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 게임 액션 전송
 */
export const sendGameAction1v2 = async (roomId, actionData) => {
  try {
    const roomData = await getDocument('rooms1v2', roomId);

    if (!roomData) return { success: false, error: '방을 찾을 수 없습니다.' };

    if (
      actionData.action !== 'reset_game' &&
      roomData.status !== ROOM_STATUS_1V2.PLAYING
    ) {
      return { success: false, error: '게임이 진행 중이 아닙니다.' };
    }

    const ts = actionData.timestamp ?? Date.now();
    const actionId = `${actionData.sender}_${ts}`;

    const updateData = {
      lastAction: {
        ...actionData,
        actionId,
        timestamp: ts,
      },
    };

    if (actionData.turnIndex !== undefined) {
      updateData.currentTurnIndex = actionData.turnIndex;
    }

    if (actionData.action === 'check') {
      updateData.hostCheckCount = actionData.hostCheckCount;
      updateData.teamCheckCount = actionData.teamCheckCount;
      updateData.totalChecksUsed = actionData.totalChecksUsed;
    }

    if (actionData.action === 'reset_game') {
      updateData.lastAction = null;
      updateData.currentTurnIndex = 0;
      updateData.status = ROOM_STATUS_1V2.PLAYING;
      updateData.hostCheckCount = 4;
      updateData.teamCheckCount = 4;
      updateData.totalChecksUsed = 0;
      updateData.resetSignal = ts;
      updateData.playerLeftSignal = null;
    }

    if (actionData.action === 'check' && actionData.gameOver) {
      updateData.status = ROOM_STATUS_1V2.FINISHED;
    }

    await updateDocument('rooms1v2', roomId, updateData);
    return { success: true };
  } catch (error) {
    console.error('1v2 액션 전송 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 1v2 방 실시간 구독
 */
export const subscribeToRoom1v2 = (roomId, onRoomUpdate, onError) => {
  const unsubscribe = subscribeToDocument(
    'rooms1v2',
    roomId,
    (roomData, error) => {
      if (error) {
        console.error('1v2 방 구독 에러:', error);
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
 * 1v2 방 나가기
 * - 호스트: 방 삭제
 * - 게스트: playerLeftSignal로 신호 전달
 */
export const leaveRoom1v2 = async (roomId, playerRole) => {
  try {
    const roomData = await getDocument('rooms1v2', roomId);
    if (!roomData) return { success: true };

    if (playerRole === 'host') {
      await deleteDocument('rooms1v2', roomId);
    } else {
      await updateDocument('rooms1v2', roomId, {
        [`${playerRole}Nickname`]: null,
        [`${playerRole}Character`]: 0,
        [`${playerRole}Connected`]: false,
        currentPlayerCount: roomData.currentPlayerCount - 1,
        lastAction: null,
        hostCheckCount: 4,
        teamCheckCount: 4,
        totalChecksUsed: 0,
        playerLeftSignal: `${playerRole}_${Date.now()}`,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('1v2 방 나가기 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 연결 상태 업데이트
 */
export const updateConnectionStatus1v2 = async (
  roomId,
  playerRole,
  connected
) => {
  try {
    const field = `${playerRole}Connected`;
    await updateDocument('rooms1v2', roomId, { [field]: connected });
  } catch (error) {
    console.error('1v2 연결 상태 업데이트 실패:', error);
  }
};

export { ROOM_STATUS_1V2 };
