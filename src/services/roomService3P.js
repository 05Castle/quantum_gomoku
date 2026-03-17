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

const ROOM_STATUS_3P = {
  WAITING: 'waiting',
  WAITING_THIRD: 'waiting_third',
  PLAYING: 'playing',
  FINISHED: 'finished',
};

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
      hostNickname,
      hostCharacter,
      player2Nickname: null,
      player2Character: 0,
      player3Nickname: null,
      player3Character: 0,
      hostConnected: true,
      player2Connected: false,
      player3Connected: false,
      status: ROOM_STATUS_3P.WAITING,
      maxPlayers: 3,
      currentPlayerCount: 1,
      lastAction: null,
      currentTurnIndex: 0,
      hostCheckCount: 4,
      player2CheckCount: 4,
      player3CheckCount: 4,
      totalChecksUsed: 0,
      playerLeftSignal: null,
      roomId,
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

    if (!roomData)
      return { success: false, error: '존재하지 않는 방 ID입니다.' };

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

    if (
      roomData.hostNickname === nickname ||
      roomData.player2Nickname === nickname
    ) {
      return { success: false, error: '이미 사용 중인 닉네임입니다.' };
    }

    if (!roomData.player2Nickname) {
      await updateDocument('rooms3p', roomId, {
        player2Nickname: nickname,
        player2Character: character,
        player2Connected: true,
        currentPlayerCount: 2,
        status: ROOM_STATUS_3P.WAITING_THIRD,
      });
      const updated = await getDocument('rooms3p', roomId);
      return { success: true, playerRole: 'player2', roomData: updated };
    }

    if (!roomData.player3Nickname) {
      await updateDocument('rooms3p', roomId, {
        player3Nickname: nickname,
        player3Character: character,
        player3Connected: true,
        currentPlayerCount: 3,
        status: ROOM_STATUS_3P.PLAYING,
      });
      const updated = await getDocument('rooms3p', roomId);
      return { success: true, playerRole: 'player3', roomData: updated };
    }

    return { success: false, error: '방이 가득 찼습니다.' };
  } catch (error) {
    console.error('3인 방 참가 실패:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

/**
 * 게임 액션 전송
 */
export const sendGameAction3P = async (roomId, actionData) => {
  try {
    const roomData = await getDocument('rooms3p', roomId);

    if (!roomData) return { success: false, error: '방을 찾을 수 없습니다.' };

    if (
      actionData.action !== 'reset_game' &&
      roomData.status !== ROOM_STATUS_3P.PLAYING
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
      updateData.player2CheckCount = actionData.player2CheckCount;
      updateData.player3CheckCount = actionData.player3CheckCount;
      updateData.totalChecksUsed = actionData.totalChecksUsed;
    }

    if (actionData.action === 'reset_game') {
      updateData.lastAction = null;
      updateData.currentTurnIndex = 0;
      updateData.status = ROOM_STATUS_3P.PLAYING;
      updateData.hostCheckCount = 4;
      updateData.player2CheckCount = 4;
      updateData.player3CheckCount = 4;
      updateData.totalChecksUsed = 0;
      updateData.resetSignal = ts;
      updateData.playerLeftSignal = null; // 리셋 시 나감 신호 초기화
    }

    if (actionData.action === 'check' && actionData.gameOver) {
      updateData.status = ROOM_STATUS_3P.FINISHED;
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
 * - 호스트: 방 삭제 → handleRoomError에서 감지
 * - 게스트: playerLeftSignal로 나머지 플레이어에게 신호 전달
 */
export const leaveRoom3P = async (roomId, playerRole) => {
  try {
    const roomData = await getDocument('rooms3p', roomId);
    if (!roomData) return { success: true };

    if (playerRole === 'host') {
      await deleteDocument('rooms3p', roomId);
    } else {
      await updateDocument('rooms3p', roomId, {
        [`${playerRole}Nickname`]: null,
        [`${playerRole}Character`]: 0,
        [`${playerRole}Connected`]: false,
        currentPlayerCount: roomData.currentPlayerCount - 1,
        // status는 변경하지 않음 - playing 유지해야 감지 가능
        lastAction: null,
        hostCheckCount: 4,
        player2CheckCount: 4,
        player3CheckCount: 4,
        totalChecksUsed: 0,
        // 나간 플레이어 정보를 신호로 전달
        playerLeftSignal: `${playerRole}_${Date.now()}`,
      });
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
