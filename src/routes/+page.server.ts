import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, friendships, notifications, calls, callParticipants, conversations, conversationMembers } from '$lib/server/db/schema';
import { eq, or, and, ne, desc, inArray } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types'; // Note: You might need to add Actions to $types if not present, but usually it works.

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

    const userId = locals.user.id;

    // 1. Get Friendships (accepted)
    // Find friendships where userA or userB is me and status is accepted
    const friendshipRecords = await db.select()
        .from(friendships)
        .where(
            and(
                or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)),
                eq(friendships.status, 'accepted')
            )
        );
    
    // Extract friend IDs
    const friendIds = friendshipRecords.map(f => f.userAId === userId ? f.userBId : f.userAId);
    
    let friendList: { id: string, username: string, displayName: string | null }[] = [];
    if (friendIds.length > 0) {
        friendList = await db.select({ 
            id: users.id, 
            username: users.username,
            displayName: users.displayName 
        })
            .from(users)
            .where(inArray(users.id, friendIds));
    }

    // 2. Get Pending Friend Requests (where userB is me, status pending)
    const incomingRequests = await db.select({
        id: friendships.id,
        senderId: friendships.userAId,
        username: users.username,
        displayName: users.displayName,
        createdAt: friendships.createdAt
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.userAId))
    .where(
        and(
            eq(friendships.userBId, userId),
            eq(friendships.status, 'pending')
        )
    );

    // 3. Get Notifications
    const userNotifications = await db.select()
        .from(notifications)
        .where(eq(notifications.recipientId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(10);

    // 4. Get Active Rooms (Filtered by Visibility)
    // We want all active calls. Then filter in memory or join logic.
    // Simplifying: Fetch all active, then filter.
    const activeCalls = await db.select({
        id: calls.id,
        name: calls.name,
        initiatorId: calls.initiatorId,
        initiatorName: users.username,
        initiatorDisplayName: users.displayName,
        scope: calls.scope,
        isGroup: calls.isGroup,
        createdAt: calls.createdAt,
        allowTurn: calls.allowTurn
    })
    .from(calls)
    .innerJoin(users, eq(users.id, calls.initiatorId))
    .where(eq(calls.isActive, true))
    .orderBy(desc(calls.createdAt));

    // Get list of calls user is invited to
    const myInvites = await db.select({ callId: callParticipants.callId })
        .from(callParticipants)
        .where(
            and(
                eq(callParticipants.userId, userId),
                eq(callParticipants.status, 'invited')
            )
        );
    const invitedCallIds = new Set(myInvites.map(i => i.callId));

    const visibleRooms = activeCalls.filter(call => {
        // If I am invited, I can see it regardless of scope (even private)
        if (invitedCallIds.has(call.id)) return true;

        if (call.scope === 'public') return true;
        // Initiator always sees their room
        if (call.initiatorId === userId) return true;
        
        // Private: Only if explicitly allowed (not implementing allowed_users yet fully)
        // Handled by invitedCallIds check above.
        if (call.scope === 'private') return false; 
        
        // Friends: Only if initiator is my friend
        if (call.scope === 'friends') {
            return friendIds.includes(call.initiatorId!);
        }
        return false;
    }).map(call => ({
        ...call,
        isInvited: invitedCallIds.has(call.id)
    }));

    // 5. Get Conversations
    const memberRows = await db
        .select({ conversationId: conversationMembers.conversationId })
        .from(conversationMembers)
        .where(eq(conversationMembers.userId, userId));

    const conversationIds = memberRows.map(r => r.conversationId).filter((id): id is string => id !== null);
    let userConversations: any[] = [];
    if (conversationIds.length > 0) {
        const convRows = await db.select()
            .from(conversations)
            .where(inArray(conversations.id, conversationIds));

        for (const conv of convRows) {
            const members = await db.select({
                userId: conversationMembers.userId,
                role: conversationMembers.role,
                username: users.username,
                displayName: users.displayName
            })
            .from(conversationMembers)
            .innerJoin(users, eq(users.id, conversationMembers.userId))
            .where(eq(conversationMembers.conversationId, conv.id));

            userConversations.push({ ...conv, members });
        }
    }

	return {
		user: locals.user,
		friends: friendList,
        friendRequests: incomingRequests,
        notifications: userNotifications,
        rooms: visibleRooms,
        conversations: userConversations
	};
};

export const actions: Actions = {
    // --- Friend Logic ---
    sendFriendRequest: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const username = data.get('username') as string;

        if (!username) return fail(400, { error: 'Username required' });
        if (username === locals.user.username) return fail(400, { error: 'Cannot add yourself' });

        // Find target user
        // Note: db.query.users.findFirst requires Drizzle query builder setup, assume it works or use select
        const targetUsers = await db.select().from(users).where(eq(users.username, username)).limit(1);
        const targetUser = targetUsers[0];

        if (!targetUser) return fail(404, { error: 'User not found' });

        // Check if existing request or friendship
        const existing = await db.select().from(friendships).where(
            or(
                and(eq(friendships.userAId, locals.user.id), eq(friendships.userBId, targetUser.id)),
                and(eq(friendships.userAId, targetUser.id), eq(friendships.userBId, locals.user.id))
            )
        ).limit(1);

        if (existing.length > 0) {
            const rel = existing[0];
            if (rel.status === 'accepted') return fail(400, { error: 'Already friends' });
            if (rel.status === 'pending') return fail(400, { error: 'Request already pending' });
            if (rel.status === 'blocked') return fail(403, { error: 'Cannot add this user' });
        }

        await db.insert(friendships).values({
            userAId: locals.user.id,
            userBId: targetUser.id,
            status: 'pending'
        });

        // Notify
        await db.insert(notifications).values({
            recipientId: targetUser.id,
            senderId: locals.user.id,
            type: 'friend_request',
            content: `${locals.user.username} sent you a friend request.`
        });

        return { success: true, message: 'Friend request sent' };
    },

    acceptFriendRequest: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const requestId = parseInt(data.get('requestId') as string);

        // Verify request belongs to me
        const requestRecord = await db.select().from(friendships)
            .where(and(eq(friendships.id, requestId), eq(friendships.userBId, locals.user.id)))
            .limit(1);
            
        if (requestRecord.length === 0) return fail(404, { error: 'Request not found' });

        await db.update(friendships)
            .set({ status: 'accepted' })
            .where(eq(friendships.id, requestId));
            
        return { success: true };
    },

    rejectFriendRequest: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const requestId = parseInt(data.get('requestId') as string);

        await db.update(friendships)
            .set({ status: 'rejected' })
            .where(and(eq(friendships.id, requestId), eq(friendships.userBId, locals.user.id)));

        return { success: true };
    },

    // --- Room Logic ---
    createRoom: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const name = data.get('name') as string;
        const scope = (data.get('scope') as string) || 'public'; // public, friends, private

        if (!name) return fail(400, { error: 'Room name required' });

        await db.insert(calls).values({
            initiatorId: locals.user.id,
            name: name,
            isActive: true,
            isGroup: true,
            scope: scope
        });

        return { success: true };
    },

    updateUsername: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const username = data.get('username') as string;

        if (!username || username.trim().length < 3) {
             return fail(400, { error: 'Username must be at least 3 characters' });
        }

        // Check if username is taken by someone else
        const existing = await db.select().from(users).where(
            and(eq(users.username, username), ne(users.id, locals.user.id))
        ).limit(1);

        if (existing.length > 0) {
            return fail(400, { error: 'Username is already taken' });
        }

        await db.update(users)
            .set({ username })
            .where(eq(users.id, locals.user.id));
            
        return { success: true, message: 'Username updated' };
    },

    updateDisplayName: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const displayName = data.get('displayName') as string;

        if (!displayName || displayName.trim().length < 1) {
             return fail(400, { error: 'Display Name cannot be empty' });
        }

        await db.update(users)
            .set({ displayName })
            .where(eq(users.id, locals.user.id));
            
        return { success: true, message: 'Display Name updated' };
    }
};
