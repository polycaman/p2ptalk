import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies }) => {
		const sessionId = cookies.get('session_id');
		if (sessionId) {
			await db.delete(sessions).where(eq(sessions.id, sessionId));
			cookies.delete('session_id', { path: '/' });
		}
        throw redirect(303, '/login');
	}
};
