export interface Post {
    id: string;
    authorId: string;
    authorName: string; // nickname/display name
    authorUsername: string; // for avatar
    content: string;
    image?: string; // Base64 or Blob URL
    createdAt: number;
    comments: Comment[];
}

export interface Comment {
    id: string;
    authorId: string;
    authorName: string;
    authorUsername: string; 
    content: string;
    createdAt: number;
}
