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
  participantDetails: Record<string, any>;
  createdAt: Date;
  lastMessageTime: Date;
  lastMessage: string;
  typingUsers: Record<string, boolean>;
  draftMessages: Record<string, string>;
}

interface MessageWithId extends Message {
  id: string;
}

interface ChatWindowProps {
  chatId: string;
  currentUser: User;
}

export default function ChatWindow({ chatId, currentUser }: ChatWindowProps) {
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

  const updateTypingStatus = async (isTyping: boolean) => {
    if (!currentUser?.uid) return;
    
    const chatRef = doc(db, 'chats', chatId);
    const typingUpdate = {
      [`typingUsers.${currentUser.uid}`]: isTyping
    };
    
    await updateDoc(chatRef, typingUpdate);
  };

  // Create virtualizer for messages
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimate each message height
    overscan: 5, // Number of items to render outside of the visible area
  });

  // Update user's presence
  const updatePresence = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, {
      lastSeen: serverTimestamp(),
      online: true
    }, { merge: true });
  }, [currentUser?.uid]);

  // Set up presence system
  useEffect(() => {
    if (!currentUser?.uid) return;

    // Update presence immediately
    updatePresence();

    // Set up regular presence updates
    presenceIntervalRef.current = setInterval(updatePresence, 30000);

    // Set up offline status
    const userRef = doc(db, 'users', currentUser.uid);
    
    // Mark user as offline when they leave
    const handleOffline = () => {
      setDoc(userRef, {
        lastSeen: serverTimestamp(),
        online: false
      }, { merge: true });
    };

    window.addEventListener('beforeunload', handleOffline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
      handleOffline();
      window.removeEventListener('beforeunload', handleOffline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser?.uid, updatePresence]);

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

  useEffect(() => {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        messageList.push({
          id: doc.id,
          chatId,
          text: data.text,
          senderId: data.senderId,
          timestamp: data.timestamp as Timestamp,
          createdAt: (data.timestamp as Timestamp).toDate(),
          read: data.read || false,
        } as Message);
      });
      setMessages(messageList.reverse());
      setLoading(false);
      
      // Scroll to bottom only if we're near the bottom already
      if (parentRef.current) {
        const { scrollHeight, scrollTop, clientHeight } = parentRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        if (isNearBottom) {
          scrollToBottom();
        }
      }
    });

    return () => unsubscribe();
  }, [chatId]);

  const scrollToBottom = useCallback(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, []);

  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }
    lastTypingTime.current = Date.now();
    setTimeout(() => {
      const timeNow = Date.now();
      const timeDiff = timeNow - lastTypingTime.current;
      if (timeDiff >= TYPING_TIMER_LENGTH && isTyping) {
        setIsTyping(false);
        updateTypingStatus(false);
      }
    }, TYPING_TIMER_LENGTH);
  }, [isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageText = newMessage;
    setNewMessage('');
    setIsTyping(false);
    updateTypingStatus(false);

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await Promise.all([
        addDoc(messagesRef, {
          text: messageText,
          senderId: currentUser.uid,
          timestamp: serverTimestamp(),
        }),
        updateDoc(doc(db, 'chats', chatId), {
          lastMessage: messageText,
          lastMessageTime: serverTimestamp(),
        }),
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText); // Restore message if send fails
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div 
        ref={parentRef}
        className="flex-1 overflow-auto p-4"
        style={{ 
          height: 'calc(100vh - 160px)',
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
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                }}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="break-words">{message.text}</p>
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

      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t">
        <div className="flex space-x-4">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            placeholder="Type a message..."
            className="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-blue-500 text-white rounded-full px-6 py-2 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
