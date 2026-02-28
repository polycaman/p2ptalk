import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { calls, users, friendships, callParticipants } from '$lib/server/db/schema';
import { eq, and, or } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
    const roomId = params.id;

    // Look up the call
    const call = await db.select({
        id: calls.id,
        name: calls.name,
        scope: calls.scope,
        isActive: calls.isActive,
        isGroup: calls.isGroup,
        allowTurn: calls.allowTurn,
        initiatorId: calls.initiatorId,
        initiatorName: users.username,
        initiatorDisplayName: users.displayName
    })
    .from(calls)
    .leftJoin(users, eq(calls.initiatorId, users.id))
    .where(eq(calls.id, roomId))
    .limit(1);

    if (call.length === 0 || !call[0].isActive) {
        return { room: null, errorType: 'not_found' as const };
    }

    const room = call[0];

    // If user is not logged in, redirect to login with a return URL
    if (!locals.user) {
        throw redirect(303, `/login?redirect=/room/${roomId}`);
    }

    const userId = locals.user.id;

    // Access control for non-public rooms
    if (room.scope !== 'public') {
        // Room owner always has access
        const isOwner = room.initiatorId === userId;

        if (!isOwner) {
            if (room.scope === 'friends') {
                // Check if user is friends with the room creator
                const friendship = await db.select({ id: friendships.id })
                    .from(friendships)
                    .where(and(
                        eq(friendships.status, 'accepted'),
                        or(
                            and(eq(friendships.userAId, userId), eq(friendships.userBId, room.initiatorId!)),
                            and(eq(friendships.userAId, room.initiatorId!), eq(friendships.userBId, userId))
                        )
                    ))
                    .limit(1);

                if (friendship.length === 0) {
                    return {
                        room: null,
                        errorType: 'not_public' as const,
                        roomName: room.name,
                        roomScope: room.scope
                    };
                }
            } else if (room.scope === 'private') {
                // Check if user was invited
                const invite = await db.select({ id: callParticipants.id })
                    .from(callParticipants)
                    .where(and(
                        eq(callParticipants.callId, roomId),
                        eq(callParticipants.userId, userId)
                    ))
                    .limit(1);

                if (invite.length === 0) {
                    return {
                        room: null,
                        errorType: 'not_public' as const,
                        roomName: room.name,
                        roomScope: room.scope
                    };
                }
            }
        }
    }

    return {
        room: {
            id: room.id,
            name: room.name,
            scope: room.scope,
            allowTurn: room.allowTurn,
            initiatorName: room.initiatorDisplayName || room.initiatorName || 'Unknown',
            isGroup: room.isGroup
        },
        user: locals.user
    };
};
