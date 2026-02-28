import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session_id');

	if (!sessionId) {
		event.locals.user = null;
		return resolve(event);
	}

	const session = await db
		.select({
			user: {
				id: users.id,
				username: users.username,
				email: users.email,
				displayName: users.displayName
			},
			expiresAt: sessions.expiresAt
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, sessionId))
		.limit(1);

	// Check if session exists and is valid
	if (session.length === 0 || session[0].expiresAt < new Date()) {
		event.cookies.delete('session_id', { path: '/' });
		event.locals.user = null;
		return resolve(event);
	}

	event.locals.user = session[0].user;
	return resolve(event);
};
