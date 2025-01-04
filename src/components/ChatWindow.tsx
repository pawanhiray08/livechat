'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import UserAvatar from './UserAvatar';
import { Message } from '@/types';
import { formatLastSeen } from '@/utils/time';
import { useVirtualizer } from '@tanstack/react-virtual';

interface Chat {
  id: string;
  participants: string[];
  participantDetails: Record<string, {
    displayName: string | null;
    photoURL: string | null;
    email: string | null;
    lastSeen: Timestamp | null;
    online: boolean;
  }>;
  createdAt: Date;
  lastMessageTime: Date | null;
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  } | null;
  typingUsers: Record<string, boolean>;
  draftMessages: Record<string, string>;
}

interface MessageWithId extends Message {
  id: string;
}

interface ChatWindowProps {
  chatId: string;
  currentUser: User;
  onBack?: () => void;
}

export default function ChatWindow({ chatId, currentUser, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const lastTypingTime = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const presenceIntervalRef = useRef<NodeJS.Timeout>();
  const TYPING_TIMER_LENGTH = 3000;

  // Get the other participant's ID
  const otherParticipantId = chat?.participants?.find(id => id !== currentUser.uid) || '';

  // Load chat data
  useEffect(() => {
    const chatRef = doc(db, 'chats', chatId);
    
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setChat({
          id: doc.id,
          participants: data.participants || [],
          participantDetails: data.participantDetails || {},
          createdAt: data.createdAt?.toDate() || new Date(),
          lastMessageTime: data.lastMessageTime?.toDate() || null,
          lastMessage: data.lastMessage || null,
          typingUsers: data.typingUsers || {},
          draftMessages: data.draftMessages || {},
        });
        setLoading(false);
      } else {
        setError('Chat not found');
        setLoading(false);
      }
    }, (err) => {
      console.error('Error loading chat:', err);
      setError('Failed to load chat');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  // Load messages
  useEffect(() => {
    if (!chatId) return;

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })).reverse();
      
      setMessages(messageList);
      setLoading(false);
    }, (err) => {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  // Update presence
  useEffect(() => {
    if (!chatId || !currentUser?.uid || !chat) return;

    const updatePresence = async () => {
      const chatRef = doc(db, 'chats', chatId);
      try {
        await updateDoc(chatRef, {
          [`participantDetails.${currentUser.uid}.lastSeen`]: serverTimestamp(),
          [`participantDetails.${currentUser.uid}.online`]: true,
        });
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 60000); // Update every minute
    presenceIntervalRef.current = interval;

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
    };
  }, [chatId, currentUser?.uid, chat]);

  // Set up typing status cleanup
  useEffect(() => {
    if (!currentUser?.uid) return;

    // Clean up typing status when unmounting or changing chats
    return () => {
      if (chatId && currentUser?.uid) {
        const chatRef = doc(db, 'chats', chatId);
        updateDoc(chatRef, {
          [`typingUsers.${currentUser.uid}`]: false
        }).catch(console.error);
      }
    };
  }, [chatId, currentUser?.uid]);

  // Handle typing status updates
  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }
    lastTypingTime.current = Date.now();
    
    const checkTypingTimeout = () => {
      const timeNow = Date.now();
      const timeDiff = timeNow - lastTypingTime.current;
      if (timeDiff >= TYPING_TIMER_LENGTH && isTyping) {
        setIsTyping(false);
        updateTypingStatus(false);
      }
    };

    setTimeout(checkTypingTimeout, TYPING_TIMER_LENGTH);
  }, [isTyping, updateTypingStatus]);

  // Update typing status in Firestore
  const updateTypingStatus = async (isTyping: boolean) => {
    if (!currentUser?.uid || !chatId) return;
    
    const chatRef = doc(db, 'chats', chatId);
    try {
      await updateDoc(chatRef, {
        [`typingUsers.${currentUser.uid}`]: isTyping
      });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };

  // Create virtualizer for messages
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimate each message height
    overscan: 5, // Number of items to render outside of the visible area
  });

  const scrollToBottom = useCallback(() => {
    if (parentRef.current) {
      requestAnimationFrame(() => {
        parentRef.current?.scrollTo({
          top: parentRef.current.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageText = newMessage;
    setNewMessage('');
    setIsTyping(false);
    updateTypingStatus(false);

    try {
      const timestamp = serverTimestamp();
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const chatRef = doc(db, 'chats', chatId);

      // First update the chat document with the new message information
      await updateDoc(chatRef, {
        lastMessage: {
          text: messageText,
          senderId: currentUser.uid,
          timestamp: timestamp,
        },
        lastMessageTime: timestamp,
        [`participantDetails.${currentUser.uid}.lastSeen`]: timestamp,
        [`participantDetails.${currentUser.uid}.online`]: true,
      });

      // Then add the message to the messages subcollection
      await addDoc(messagesRef, {
        text: messageText,
        senderId: currentUser.uid,
        timestamp,
        read: false,
      });

      // Scroll to bottom after sending
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText); // Restore message if send fails
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    handleTyping();
  };

  // Get other participants who are currently typing
  const getTypingUsers = () => {
    if (!chat?.typingUsers || !chat.participantDetails) return [];
    
    return Object.entries(chat.typingUsers)
      .filter(([uid, isTyping]) => isTyping && uid !== currentUser.uid)
      .map(([uid]) => chat.participantDetails[uid]?.displayName || 'Someone');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Chat not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full md:hidden"
              title="Back to Chats"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <UserAvatar
            user={{
              photoURL: chat.participantDetails[otherParticipantId]?.photoURL || null,
              displayName: chat.participantDetails[otherParticipantId]?.displayName || 'Unknown User'
            }}
            className="h-10 w-10"
          />
          <div>
            <h2 className="text-lg font-semibold">
              {chat.participantDetails[otherParticipantId]?.displayName || 'Unknown User'}
            </h2>
            <p className="text-sm text-gray-500">
              {formatLastSeen(
                chat.participantDetails[otherParticipantId]?.lastSeen || null,
                chat.participantDetails[otherParticipantId]?.online
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div 
        ref={parentRef}
        className="flex-1 overflow-auto p-4 space-y-4"
        style={{ 
          height: 'calc(100vh - 180px)', 
          position: 'relative'
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const message = messages[virtualRow.index];
            const isOwnMessage = message.senderId === currentUser.uid;
            
            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className={`max-w-[80%] md:max-w-[70%] rounded-lg px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="break-words text-sm md:text-base">{message.text}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Typing indicator */}
      <div className="px-4 h-6 text-sm text-gray-500">
        {getTypingUsers().length > 0 && (
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>
              {getTypingUsers().join(', ')} {getTypingUsers().length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}
      </div>

      {/* Message input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
        <div className="flex space-x-4">
          <textarea
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 resize-none border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
