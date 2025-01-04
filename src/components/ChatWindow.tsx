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
  writeBatch
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
  draftMessages: Record<string, string>;
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

  // Refs
  const lastTypingTime = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const presenceIntervalRef = useRef<NodeJS.Timeout>();

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
    if (!currentUser?.uid || !chatId) return;
    
    const chatRef = doc(db, 'chats', chatId);
    try {
      await updateDoc(chatRef, {
        [`typingUsers.${currentUser.uid}`]: isTyping
      });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [chatId, currentUser?.uid]);

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

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || !chatId) return;

    const timestamp = serverTimestamp();
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const chatRef = doc(db, 'chats', chatId);
    const messageRef = doc(messagesRef);

    try {
      setNewMessage('');
      updateTypingStatus(false);

      const messageData = {
        id: messageRef.id,
        chatId,
        text: messageText.trim(),
        senderId: currentUser.uid,
        timestamp,
        createdAt: timestamp,
        read: false
      };

      // Batch write to ensure atomicity
      const batch = writeBatch(db);

      // Create the message document
      batch.set(messageRef, messageData);

      // Update chat metadata
      batch.update(chatRef, {
        lastMessage: {
          text: messageText.trim(),
          senderId: currentUser.uid,
          timestamp,
        },
        lastMessageTime: timestamp,
        [`participantDetails.${currentUser.uid}.lastSeen`]: timestamp,
        [`participantDetails.${currentUser.uid}.online`]: true,
      });

      // Commit the batch
      await batch.commit();

      // Optimistically update the UI
      const optimisticMessage: ChatMessage = {
        ...messageData,
        timestamp: new Date(),
        createdAt: new Date()
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText);
      setError('Failed to send message');
    }
  }, [chatId, currentUser.uid, scrollToBottom, updateTypingStatus]);

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

  useEffect(() => {
    if (!chatId) return;

    // Set up message listener
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc')  // Changed to asc to show oldest first
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const messageList = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              chatId,
              text: data.text || '',
              senderId: data.senderId || '',
              timestamp: data.timestamp?.toDate() || new Date(),
              createdAt: data.createdAt?.toDate() || new Date(),
              read: data.read || false
            };
          });

          setMessages(messageList);
          
          // Only scroll if we're near the bottom or if it's a new message
          const lastMessage = messageList[messageList.length - 1];
          if (lastMessage?.senderId === currentUser.uid) {
            setTimeout(scrollToBottom, 100);
          }
        } catch (err) {
          console.error('Error processing messages:', err);
          setError('Failed to process messages');
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error in message subscription:', error);
        setError('Failed to load messages');
        setLoading(false);
      }
    );

    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing from messages:', error);
      }
    };
  }, [chatId, currentUser.uid, scrollToBottom]);

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
                      draftMessages: data.draftMessages || {},
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
                    {formatMessageTime(message.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(newMessage); }} className="flex space-x-4">
          <textarea
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 resize-none rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-2"
            rows={1}
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
