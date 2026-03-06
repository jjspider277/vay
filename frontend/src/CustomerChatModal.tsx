import React, { useState } from 'react';
import { Vehicle } from './types';

interface ChatMessage {
  id: string;
  from: 'customer' | 'operator';
  text: string;
  timestamp: number;
}

interface CustomerChatModalProps {
  vehicle: Vehicle;
  onClose: () => void;
}

const CustomerChatModal: React.FC<CustomerChatModalProps> = ({ vehicle, onClose }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages(prev => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        from: 'operator',
        text: trimmed,
        timestamp: Date.now()
      }
    ]);
    setInput('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Customer Chat</h3>
          <button onClick={onClose}>×</button>
        </div>
        <div className="chat-log">
          {messages.length === 0 && <div className="logs-empty">No messages yet.</div>}
          {messages.map(message => (
            <div key={message.id} className={`chat-bubble ${message.from}`}>
              <div>{message.text}</div>
              <small>{new Date(message.timestamp).toLocaleTimeString()}</small>
            </div>
          ))}
        </div>
        <div className="chat-compose">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type operator response..."
          />
          <button type="button" className="btn-primary" onClick={() => sendMessage(input)}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerChatModal;
