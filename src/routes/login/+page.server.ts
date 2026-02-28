import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, sessions } from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export const actions = {
  default: async ({ cookies, request, url }) => {
    const data = await request.formData();
    const login = (data.get('login') as string)?.trim();
    const password = data.get('password') as string;

    const errors: Record<string, string> = {};

    if (!login) {
      errors.login = 'Email or username is required';
    }
    if (!password) {
      errors.password = 'Password is required';
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, login });
    }

    // Allow login with either email or username
    const loginLower = login.toLowerCase();
    const result = await db.select().from(users).where(
      or(eq(users.username, login), eq(users.email, loginLower))
    ).limit(1);
    const user = result[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return fail(400, { errors: { general: 'Invalid credentials. Please check your email/username and password.' }, login });
    }

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt
    });

    cookies.set('session_id', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    // Support redirect after login (e.g. from /room/[id])
    const redirectTo = url.searchParams.get('redirect');
    if (redirectTo && redirectTo.startsWith('/')) {
      throw redirect(303, redirectTo);
    }

    throw redirect(303, '/');
  }
};
