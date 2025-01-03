export interface ChatUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastSeen?: Date;
}

export interface Chat {
  id: string;
  participants: string[];
  createdAt: Date;
  lastMessageTime: Date;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: Date;
}
