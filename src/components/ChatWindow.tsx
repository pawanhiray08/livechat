'use client';

import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import UserAvatar from './UserAvatar';

interface ChatWindowProps {
  chatId: string;
  currentUser: User;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: any;
}

interface ChatUser {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  isTyping?: boolean;
}

export default function ChatWindow({ chatId, currentUser }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<ChatUser | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen to messages and typing status
  useEffect(() => {
    const messagesQuery = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('timestamp')
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messageList: Message[] = [];
      snapshot.forEach((doc) => {
        messageList.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(messageList);
    });

    const unsubscribeTyping = onSnapshot(doc(db, 'chats', chatId), (doc) => {
      const data = doc.data();
      if (data?.typingUsers) {
        setIsTyping(data.typingUsers.includes(otherUser?.uid));
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [chatId, otherUser?.uid]);

  // Update typing status
  const updateTypingStatus = async (typing: boolean) => {
    const chatRef = doc(db, 'chats', chatId);
    const typingUsers = typing 
      ? [currentUser.uid]
      : [];
    
    await updateDoc(chatRef, {
      typingUsers
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing status to true
    updateTypingStatus(true);

    // Set new timeout to clear typing status
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 1000);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        text: newMessage,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
      });

      // Update last message in chat document
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: {
          text: newMessage,
          senderId: currentUser.uid,
          timestamp: serverTimestamp(),
        },
        lastMessageTime: serverTimestamp(),
      });

      setNewMessage('');
      updateTypingStatus(false);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-2 ${
              message.senderId === currentUser.uid ? 'flex-row-reverse' : ''
            }`}
          >
            <UserAvatar
              user={message.senderId === currentUser.uid ? currentUser : otherUser}
              className="flex-shrink-0"
            />
            <div
              className={`max-w-[70%] px-4 py-2 rounded-lg ${
                message.senderId === currentUser.uid
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p>{message.text}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp?.toDate().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
            </div>
            <span className="text-sm text-gray-500">typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white rounded-full p-2 hover:bg-blue-600 focus:outline-none"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
