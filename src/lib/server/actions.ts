// src/lib/server/actions.ts
import { db } from './db';
import { users, friendships, notifications, calls } from './db/schema';
import { eq, or, and, inArray } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export async function getFriends(userId: string) {
    const friends = await db.select().from(friendships)
        .where(
            and(
                or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)),
                eq(friendships.status, 'accepted')
            )
        );
    
    // Get user details for these friends
    const friendIds = friends.map(f => f.userAId === userId ? f.userBId : f.userAId);
    if (friendIds.length === 0) return [];

    const friendDetails = await db.select({
        id: users.id,
        username: users.username
    }).from(users).where(inArray(users.id, friendIds));

    return friendDetails;
}

export async function sendFriendRequest(senderId: string, targetUsername: string) {
    const target = await db.query.users.findFirst({
        where: eq(users.username, targetUsername)
    });

    if (!target) return { error: 'User not found' };
    if (target.id === senderId) return { error: 'Cannot add yourself' };

    // Check existing
    const existing = await db.query.friendships.findFirst({
        where: or(
            and(eq(friendships.userAId, senderId), eq(friendships.userBId, target.id)),
            and(eq(friendships.userAId, target.id), eq(friendships.userBId, senderId))
        )
    });

    if (existing) {
        if (existing.status === 'accepted') return { error: 'Already friends' };
        if (existing.status === 'pending') return { error: 'Request already pending' };
    }

    // Create request
    await db.insert(friendships).values({
        userAId: senderId,
        userBId: target.id,
        status: 'pending'
    });

    // Notify
    await db.insert(notifications).values({
        recipientId: target.id,
        senderId: senderId,
        type: 'friend_request',
        content: `Sent you a friend request`
    });

    return { success: true };
}
