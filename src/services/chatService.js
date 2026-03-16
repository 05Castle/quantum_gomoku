import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * 채팅 메시지 전송
 * @param {string} roomId - 방 ID
 * @param {string} nickname - 닉네임
 * @param {string} text - 메시지 내용
 */
export const sendMessage = async (roomId, nickname, text) => {
  try {
    const messagesRef = collection(db, 'rooms', roomId, 'messages');
    await addDoc(messagesRef, {
      nickname,
      text: text.trim(),
      timestamp: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('메시지 전송 실패:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 채팅 메시지 실시간 구독
 * @param {string} roomId - 방 ID
 * @param {function} onMessages - 메시지 업데이트 콜백
 * @returns {function} - 구독 해제 함수
 */
export const subscribeToMessages = (roomId, onMessages) => {
  const messagesRef = collection(db, 'rooms', roomId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // serverTimestamp가 null일 수 있으므로 안전하게 처리
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    }));
    onMessages(messages);
  });

  return unsubscribe;
};
