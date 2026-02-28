export interface ConversationMember {
    userId: string;
    username: string;
    displayName: string | null;
    role: string;
}

export interface Conversation {
    id: string;
    type: 'dm' | 'group';
    name: string | null;
    description: string | null;
    createdBy: string | null;
    createdAt: string;
    members: ConversationMember[];
    // Client-side enrichment (ephemeral)
    lastMessage?: ChatMessage | null;
    lastActivity?: number;
}

export interface ChatMessage {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'system';
    content: string;
    metadata?: MessageMetadata;
    timestamp: number;
}

export interface MessageMetadata {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    fileData?: string;      // blob URL for local display
    duration?: number;      // voice message seconds
    progress?: number;      // file transfer 0-100
    accepted?: boolean | null; // null = pending, true = accepted, false = rejected
}
