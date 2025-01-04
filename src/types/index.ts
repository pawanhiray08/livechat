import { Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';

export interface ChatUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastSeen?: Timestamp;
  online?: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  timestamp: Timestamp;
  createdAt: Date;
  read?: boolean;
}

export interface Chat {
  id: string;
  participants: string[];
  participantDetails: {
    [key: string]: {
      displayName: string | null;
      photoURL: string | null;
      email: string | null;
      lastSeen: Timestamp | null;
      online: boolean;
    };
  };
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  } | null;
  lastMessageTime?: Timestamp | null;
  typingUsers: string[];
  draftMessages?: {
    [key: string]: string;
  };
}

export interface FirebaseUser extends User {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  uid: string;
}
