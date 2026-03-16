import React, { useState, useEffect, useRef } from 'react';
import { sendMessage, subscribeToMessages } from '../services/chatService';
import './ChatBox.css';

const ChatBox = ({ roomId, myNickname }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // 채팅 구독 (게임 구독과 완전히 분리)
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeToMessages(roomId, (newMessages) => {
      setMessages([...newMessages]);
    });

    return () => unsubscribe();
  }, [roomId]);

  // 새 메시지 오면 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 새 메시지 오면 소리로 알려줌
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.nickname !== myNickname) {
      const audio = new Audio('/sounds/chat.mp3');
      audio.play().catch(() => {});
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    setInputText('');

    // try...finally 블록을 사용하여 오류가 나더라도 반드시 isSending을 false로 되돌리고 포커스를 잡아줌
    try {
      await sendMessage(roomId, myNickname, inputText);
    } catch (error) {
      console.error('메시지 전송 실패:', error);
    } finally {
      setIsSending(false);
      inputRef.current?.focus(); // 전송 완료 후 다시 포커스
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatbox">
      <div className="chatbox-header">💬 채팅</div>

      <div className="chatbox-messages">
        {messages.length === 0 && (
          <div className="chatbox-empty">아직 메시지가 없습니다</div>
        )}
        {messages.map((msg) => {
          const isMe = msg.nickname === myNickname;
          return (
            <div
              key={msg.id}
              className={`chat-message ${isMe ? 'me' : 'opponent'}`}
            >
              {!isMe && <div className="chat-nickname">{msg.nickname}</div>}
              <div className="chat-bubble">{msg.text}</div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chatbox-input-area">
        <input
          type="text"
          className="chatbox-input"
          placeholder="메시지 입력..."
          ref={inputRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={200}
          /* * 핵심 수정 사항:
           * disabled={isSending} 속성을 제거했어!
           * 이제 전송 중에도 인풋이 비활성화되지 않아 브라우저가 포커스를 강제로 해제하지 않아.
           */
        />
        <button
          className="chatbox-send-btn"
          onClick={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          <span className="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  );
};

export default React.memo(ChatBox);
