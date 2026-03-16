import React, { useState, useEffect, useRef } from 'react';
import { sendMessage, subscribeToMessages } from '../services/chatService';
import './ChatBox.css';

const ChatBox = ({ roomId, myNickname }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  // 채팅 구독 (게임 구독과 완전히 분리)
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeToMessages(roomId, (newMessages) => {
      setMessages([...newMessages]); // 기존: setMessages(newMessages)
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
    await sendMessage(roomId, myNickname, inputText);
    setIsSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
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
              <div className="chat-time">{formatTime(msg.timestamp)}</div>
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
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={200}
          disabled={isSending}
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
