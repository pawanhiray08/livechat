'use client';

import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import UserAvatar from './UserAvatar';
import { Chat, Message } from '@/types';

interface ChatWindowProps {
  chatId: string;
  currentUser: User;
}

interface MessageWithId extends Message {
  id: string;
}

export default function ChatWindow({ chatId, currentUser }: ChatWindowProps) {
  const [messages, setMessages] = useState<MessageWithId[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chat, setChat] = useState<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Subscribe to chat document for real-time updates
  useEffect(() => {
    const chatRef = doc(db, 'chats', chatId);
    
    const unsubscribeChatDoc = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setChat({
          id: doc.id,
          participants: data.participants,
          participantDetails: data.participantDetails,
          createdAt: (data.createdAt as Timestamp).toDate(),
          lastMessageTime: (data.lastMessageTime as Timestamp).toDate(),
          lastMessage: data.lastMessage,
          typingUsers: data.typingUsers || {},
          draftMessages: data.draftMessages || {},
        });
      }
    }, (error) => {
      console.error('Error subscribing to chat:', error);
      setError('Failed to load chat updates');
    });

    return () => unsubscribeChatDoc();
  }, [chatId]);

  // Subscribe to messages
  useEffect(() => {
    if (!chatId) return;

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const messageList: MessageWithId[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.createdAt) {  // Only add messages with valid timestamps
          messageList.push({
            id: doc.id,
            chatId,
            senderId: data.senderId,
            text: data.text,
            createdAt: (data.createdAt as Timestamp).toDate(),
          });
        }
      });
      setMessages(messageList);
      setLoading(false);
      // Scroll to bottom when new messages arrive
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      console.error('Error subscribing to messages:', error);
      setError('Failed to load messages');
    });

    return () => unsubscribeMessages();
  }, [chatId]);

  // Handle typing status and draft message
  const updateTypingStatus = async (isTyping: boolean, draftMessage: string = '') => {
    if (!chatId) return;
    
    const chatRef = doc(db, 'chats', chatId);
    try {
      await setDoc(chatRef, {
        typingUsers: {
          [currentUser.uid]: isTyping
        },
        draftMessages: {
          [currentUser.uid]: draftMessage
        }
      }, { merge: true });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setNewMessage(newValue);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Update typing status and draft message
    updateTypingStatus(true, newValue);

    // Set a new timeout to clear typing status after 2 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false, '');
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const chatRef = doc(db, 'chats', chatId);

      // Clear typing status and draft message immediately
      await updateTypingStatus(false, '');

      await addDoc(messagesRef, {
        text: newMessage,
        senderId: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      // Update last message in chat
      await updateDoc(chatRef, {
        lastMessage: newMessage,
        lastMessageTime: serverTimestamp(),
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    }
  };

  // Cleanup typing status when component unmounts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      updateTypingStatus(false, '');
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Chat not found</div>
      </div>
    );
  }

  const otherParticipantId = chat.participants.find(
    (id) => id !== currentUser.uid
  )!;
  const otherParticipant = chat.participantDetails[otherParticipantId];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center p-3 md:p-4 border-b bg-white shadow-sm">
        <UserAvatar
          user={{
            displayName: otherParticipant.displayName,
            photoURL: otherParticipant.photoURL,
            email: otherParticipant.email,
          }}
          className="h-8 w-8 md:h-10 md:w-10"
        />
        <div className="ml-3 flex-1 min-w-0">
          <p className="font-medium text-sm md:text-base truncate">
            {otherParticipant.displayName}
          </p>
          <p className="text-xs md:text-sm text-gray-500 truncate">
            {otherParticipant.email}
          </p>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 min-h-0 bg-gray-50">
        {messages.map((message) => {
          const isCurrentUser = message.senderId === currentUser.uid;
          const sender = isCurrentUser
            ? chat.participantDetails[currentUser.uid]
            : otherParticipant;

          return (
            <div
              key={message.id}
              className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div
                className={`flex items-start space-x-2 max-w-[85%] md:max-w-[70%] ${
                  isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <UserAvatar
                  user={{
                    displayName: sender.displayName,
                    photoURL: sender.photoURL,
                    email: sender.email,
                  }}
                  className="h-6 w-6 md:h-8 md:w-8 hidden md:block"
                />
                <div
                  className={`rounded-lg px-3 py-2 md:px-4 md:py-2 break-words ${
                    isCurrentUser
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm md:text-base whitespace-pre-wrap">{message.text}</p>
                  <p className="text-[10px] md:text-xs mt-1 opacity-70">
                    {message.createdAt.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {chat?.typingUsers && Object.entries(chat.typingUsers).map(([userId, isTyping]) => {
          if (isTyping && userId !== currentUser.uid) {
            const userDetails = chat.participantDetails[userId];
            const draftMessage = chat.draftMessages?.[userId] || '';
            return (
              <div key={userId} className="flex items-start space-x-2 max-w-[85%] md:max-w-[70%] animate-fade-in">
                <UserAvatar 
                  user={{ 
                    photoURL: userDetails.photoURL,
                    displayName: userDetails.displayName,
                    email: userDetails.email
                  }}
                  className="h-6 w-6 md:h-8 md:w-8"
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs text-gray-500 truncate">{userDetails.displayName} is typing...</span>
                  {draftMessage && (
                    <div className="bg-gray-100 text-gray-600 rounded-lg px-3 py-2 mt-1 text-sm italic break-words">
                      {draftMessage}
                      <div className="typing-indicator inline-flex ml-1">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          return null;
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-2 md:p-4 border-t bg-white">
        {error && <p className="text-red-500 text-xs md:text-sm mb-2">{error}</p>}
        <div className="flex space-x-2 md:space-x-4">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onBlur={() => updateTypingStatus(false, '')}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 md:px-4 md:py-2 text-sm md:text-base focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base whitespace-nowrap"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
