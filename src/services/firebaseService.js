import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';

// === 기본 Firestore 함수들 ===

/**
 * 문서 생성
 * @param {string} collectionName - 컬렉션 이름
 * @param {string} docId - 문서 ID
 * @param {object} data - 저장할 데이터
 */
export const createDocument = async (collectionName, docId, data) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`Document created: ${collectionName}/${docId}`);
    return true;
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
};

/**
 * 문서 읽기
 * @param {string} collectionName - 컬렉션 이름
 * @param {string} docId - 문서 ID
 */
export const getDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      console.log('No such document!');
      return null;
    }
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
};

/**
 * 문서 업데이트
 * @param {string} collectionName - 컬렉션 이름
 * @param {string} docId - 문서 ID
 * @param {object} data - 업데이트할 데이터
 */
export const updateDocument = async (collectionName, docId, data) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    console.log(`Document updated: ${collectionName}/${docId}`);
    return true;
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

/**
 * 문서 삭제
 * @param {string} collectionName - 컬렉션 이름
 * @param {string} docId - 문서 ID
 */
export const deleteDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    console.log(`Document deleted: ${collectionName}/${docId}`);
    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

/**
 * 실시간 문서 구독
 * @param {string} collectionName - 컬렉션 이름
 * @param {string} docId - 문서 ID
 * @param {function} callback - 변경 시 호출될 콜백 함수
 * @returns {function} - 구독 해제 함수
 */
export const subscribeToDocument = (collectionName, docId, callback) => {
  try {
    const docRef = doc(db, collectionName, docId);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          callback(data);
        } else {
          console.log('Document does not exist');
          callback(null);
        }
      },
      (error) => {
        console.error('Error in subscription:', error);
        callback(null, error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up subscription:', error);
    throw error;
  }
};

/**
 * 카운터 증가
 * @param {string} collectionName - 컬렉션 이름
 * @param {string} docId - 문서 ID
 * @param {string} field - 증가시킬 필드명
 * @param {number} value - 증가시킬 값 (기본값: 1)
 */
export const incrementField = async (
  collectionName,
  docId,
  field,
  value = 1
) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      [field]: increment(value),
      updatedAt: serverTimestamp(),
    });
    console.log(
      `Field incremented: ${collectionName}/${docId}/${field} +${value}`
    );
    return true;
  } catch (error) {
    console.error('Error incrementing field:', error);
    throw error;
  }
};

// === 유틸리티 함수들 ===

/**
 * 랜덤 문서 ID 생성 (6자리 대문자)
 */
export const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

/**
 * 문서 존재 여부 확인
 * @param {string} collectionName - 컬렉션 이름
 * @param {string} docId - 문서 ID
 */
export const documentExists = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    console.error('Error checking document existence:', error);
    return false;
  }
};

// === 에러 처리 ===

/**
 * Firebase 에러를 사용자 친화적 메시지로 변환
 * @param {Error} error - Firebase 에러 객체
 */
export const getErrorMessage = (error) => {
  switch (error.code) {
    case 'permission-denied':
      return '접근 권한이 없습니다.';
    case 'not-found':
      return '요청한 데이터를 찾을 수 없습니다.';
    case 'already-exists':
      return '이미 존재하는 데이터입니다.';
    case 'resource-exhausted':
      return '일시적으로 서버가 바쁩니다. 잠시 후 다시 시도해주세요.';
    case 'unauthenticated':
      return '인증이 필요합니다.';
    default:
      return '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.';
  }
};
