import { Timestamp } from 'firebase/firestore';

export interface ChatUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  email: string;
  lastSeen?: Timestamp | null;
  online?: boolean;
}

interface ParticipantDetails {
  displayName: string;
  photoURL: string | null;
  email: string;
  lastSeen?: Timestamp | null;
  online?: boolean;
}

export interface Chat {
  id: string;
  participants: string[];
  participantDetails: Record<string, ParticipantDetails>;
  createdAt: Timestamp;
  lastMessageTime: Timestamp | null;
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  } | null;
  typingUsers?: Record<string, boolean>;
  draftMessages?: Record<string, string>;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
}
