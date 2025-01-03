export interface ChatUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  email: string;
  lastSeen?: Date;
}

interface ParticipantDetails {
  displayName: string;
  photoURL: string | null;
  email: string;
}

export interface Chat {
  id: string;
  participants: string[];
  participantDetails: Record<string, ParticipantDetails>;
  createdAt: Date;
  lastMessageTime: Date;
  lastMessage: string;
  typingUsers?: Record<string, boolean>;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: Date;
}
