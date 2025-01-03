import { Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';

export interface ChatUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  lastSeen?: Timestamp;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Timestamp;
  read?: boolean;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  };
  lastMessageTime?: Timestamp;
  typingUsers?: string[];
}

export interface FirebaseUser extends User {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  uid: string;
}
