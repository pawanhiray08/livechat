export interface ChatUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastSeen?: Date;
}

interface ParticipantDetails {
  displayName: string;
  photoURL: string | null;
  email: string | null;
}

export interface Chat {
  id: string;
  participants: string[];
  participantDetails: {
    [key: string]: ParticipantDetails;
  };
  createdAt: Date;
  lastMessageTime: Date;
  lastMessage: string | null;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: Date;
}
