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
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import UserAvatar from './UserAvatar';
import { Message } from '@/types';
import { formatLastSeen } from '@/utils/time';
import { useVirtualizer } from '@tanstack/react-virtual';

// Types
interface ChatMessage {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  timestamp: Date;
  createdAt: Date;
  read: boolean;
  recipientId: string;
}

interface ChatParticipantDetails {
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  lastSeen: Timestamp | null;
  online: boolean;
}

interface Chat {
  id: string;
  participants: string[];
  participantDetails: Record<string, ChatParticipantDetails>;
  createdAt: Date;
  lastMessageTime: Date | null;
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  } | null;
  typingUsers: Record<string, boolean>;
  unreadCount: Record<string, number>;
}

interface ChatWindowProps {
  chatId: string;
  currentUser: User;
  onBack?: () => void;
}

// Utility functions
const formatMessageTime = (date: Date | null) => {
  if (!date) return '';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const TYPING_TIMER_LENGTH = 3000;

export default function ChatWindow({ chatId, currentUser, onBack }: ChatWindowProps) {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{[key: string]: boolean}>({});

  // Refs
  const lastTypingTime = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const presenceIntervalRef = useRef<NodeJS.Timeout>();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Derived state
  const otherParticipantId = chat?.participants?.find(id => id !== currentUser.uid) || '';

  // Utility functions
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

  const updateTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!currentUser?.uid || !chatId || !chat) return;
    
    const chatRef = doc(db, 'chats', chatId);
    try {
      await updateDoc(chatRef, {
        [`typingUsers.${currentUser.uid}`]: isTyping
      });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [chatId, currentUser?.uid, chat]);

  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, TYPING_TIMER_LENGTH);
  }, [isTyping, updateTypingStatus]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || !chatId || !chat) return;

    try {
      const batch = writeBatch(db);
      
      // Get the other participant's ID
      const otherParticipantId = chat.participants.find(id => id !== currentUser.uid);
      if (!otherParticipantId) {
        throw new Error('No other participant found in chat');
      }

      // Create message document
      const messageData = {
        text: messageText,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        createdAt: new Date(),
        read: false,
        chatId: chatId,
        recipientId: otherParticipantId
      };

      // Add message to messages subcollection
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const newMessageRef = doc(messagesRef);
      batch.set(newMessageRef, messageData);

      // Update chat document with last message info and unread counts
      const chatRef = doc(db, 'chats', chatId);
      const updates = {
        lastMessage: {
          text: messageText,
          senderId: currentUser.uid,
          timestamp: serverTimestamp()
        },
        lastMessageTime: serverTimestamp(),
        [`unreadCount.${otherParticipantId}`]: increment(1),
        [`unreadCount.${currentUser.uid}`]: 0
      };

      batch.update(chatRef, updates);

      // Commit both operations
      await batch.commit();

      // Clear typing indicator and input
      setIsTyping(false);
      updateTypingStatus(false);
      setNewMessage('');

      // Force scroll to bottom
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message. Please try again.');
    }
  }, [chatId, currentUser?.uid, updateTypingStatus, chat]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim()) {
        sendMessage(newMessage);
      }
    }
  }, [newMessage, sendMessage]);

  const handleSendClick = useCallback(() => {
    if (newMessage.trim()) {
      sendMessage(newMessage);
    }
  }, [newMessage, sendMessage]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    handleTyping();
  }, [handleTyping]);

  // Effects
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
          unreadCount: data.unreadCount || {}
        });
        setTypingUsers(data.typingUsers || {});
        setLoading(false);
      } else {
        setError('Chat not found');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !currentUser?.uid) return;

    setLoading(true);
    setError(null);

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messagesQuery = query(
      messagesRef,
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, {
      next: (snapshot) => {
        try {
          const newMessages: ChatMessage[] = [];
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            newMessages.push({
              id: doc.id,
              chatId: chatId,
              text: data.text || '',
              senderId: data.senderId || '',
              timestamp: data.timestamp?.toDate() || new Date(),
              createdAt: data.createdAt?.toDate() || new Date(),
              read: data.read || false,
              recipientId: data.recipientId || ''
            });
          });

          // Sort messages by timestamp
          newMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          setMessages(newMessages);

          // Mark messages as read
          const batch = writeBatch(db);
          let hasUnread = false;

          newMessages.forEach(msg => {
            if (!msg.read && msg.senderId !== currentUser.uid) {
              hasUnread = true;
              const messageRef = doc(db, 'chats', chatId, 'messages', msg.id);
              batch.update(messageRef, { read: true });
            }
          });

          if (hasUnread) {
            const chatRef = doc(db, 'chats', chatId);
            batch.update(chatRef, {
              [`unreadCount.${currentUser.uid}`]: 0
            });
            batch.commit().catch(error => {
              console.error('Error marking messages as read:', error);
            });
          }

          // Scroll to bottom if near bottom
          if (messagesEndRef.current) {
            const shouldScroll = 
              Math.abs(
                messagesEndRef.current.getBoundingClientRect().bottom - 
                messagesContainerRef.current?.getBoundingClientRect().bottom!
              ) < 100;
            
            if (shouldScroll) {
              messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }

          setLoading(false);
        } catch (error) {
          console.error('Error processing messages:', error);
          setError('Failed to load messages');
          setLoading(false);
        }
      },
      error: (error) => {
        console.error('Error in message subscription:', error);
        setError('Failed to load messages');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [chatId, currentUser?.uid]);

  // Presence update effect
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
    const interval = setInterval(updatePresence, 60000);
    presenceIntervalRef.current = interval;

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
    };
  }, [chatId, currentUser?.uid, chat]);

  // Typing status cleanup effect
  useEffect(() => {
    if (!currentUser?.uid) return;

    return () => {
      if (chatId && currentUser?.uid) {
        const chatRef = doc(db, 'chats', chatId);
        updateDoc(chatRef, {
          [`typingUsers.${currentUser.uid}`]: false
        }).catch(console.error);
      }
    };
  }, [chatId, currentUser?.uid]);

  // Clean up typing status on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (chatId && currentUser?.uid) {
        updateTypingStatus(false);
      }
    };
  }, [chatId, currentUser?.uid, updateTypingStatus]);

  // Render typing indicator
  const renderTypingIndicator = () => {
    const typingParticipants = Object.entries(typingUsers)
      .filter(([userId, isTyping]) => isTyping && userId !== currentUser?.uid)
      .map(([userId]) => chat?.participantDetails[userId]?.displayName || 'Someone');

    if (typingParticipants.length > 0) {
      return (
        <div className="text-sm text-gray-500 italic mb-2 ml-4">
          {typingParticipants.join(', ')} {typingParticipants.length === 1 ? 'is' : 'are'} typing...
        </div>
      );
    }
    return null;
  };

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              const chatRef = doc(db, 'chats', chatId);
              getDoc(chatRef)
                .then((doc) => {
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
                      unreadCount: data.unreadCount || {}
                    });
                    setLoading(false);
                  } else {
                    setError('Chat not found');
                    setLoading(false);
                  }
                })
                .catch((err) => {
                  console.error('Error retrying chat load:', err);
                  setError('Failed to load chat. Please try again.');
                  setLoading(false);
                });
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No chat state
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

      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4"
        style={{
          height: 'calc(100vh - 180px)',
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'
            } mb-4`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.senderId === currentUser?.uid
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="text-sm">{message.text}</div>
              <div className="text-xs mt-1 opacity-70">
                {formatMessageTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        {renderTypingIndicator()}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat input */}
      <div className="p-4 border-t">
        <div className="flex items-center space-x-2">
          <textarea
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 h-10 px-4 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
          />
          <button
            onClick={handleSendClick}
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
