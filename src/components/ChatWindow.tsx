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

  // Fetch chat details
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        if (chatDoc.exists()) {
          const data = chatDoc.data();
          setChat({
            id: chatDoc.id,
            participants: data.participants,
            participantDetails: data.participantDetails,
            createdAt: (data.createdAt as Timestamp).toDate(),
            lastMessageTime: (data.lastMessageTime as Timestamp).toDate(),
            lastMessage: data.lastMessage,
          });
        }
      } catch (error) {
        console.error('Error fetching chat:', error);
        setError('Failed to load chat');
      }
    };

    fetchChat();
  }, [chatId]);

  // Subscribe to messages
  useEffect(() => {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList: MessageWithId[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        messageList.push({
          id: doc.id,
          chatId,
          senderId: data.senderId,
          text: data.text,
          createdAt: (data.createdAt as Timestamp).toDate(),
        });
      });
      setMessages(messageList);
      setLoading(false);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const chatRef = doc(db, 'chats', chatId);

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
    <div className="flex flex-col h-full">
      <div className="flex items-center p-4 border-b">
        <UserAvatar
          user={{
            displayName: otherParticipant.displayName,
            photoURL: otherParticipant.photoURL,
            email: otherParticipant.email,
          }}
          className="h-10 w-10"
        />
        <div className="ml-3">
          <p className="font-medium">{otherParticipant.displayName}</p>
          <p className="text-sm text-gray-500">{otherParticipant.email}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isCurrentUser = message.senderId === currentUser.uid;
          const sender = isCurrentUser
            ? chat.participantDetails[currentUser.uid]
            : otherParticipant;

          return (
            <div
              key={message.id}
              className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start space-x-2 max-w-[70%] ${
                  isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <UserAvatar
                  user={{
                    displayName: sender.displayName,
                    photoURL: sender.photoURL,
                    email: sender.email,
                  }}
                  className="h-8 w-8"
                />
                <div
                  className={`rounded-lg px-4 py-2 ${
                    isCurrentUser
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <p className="text-xs mt-1 opacity-70">
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
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t">
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <div className="flex space-x-4">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
