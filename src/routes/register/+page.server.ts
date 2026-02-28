import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const email = (data.get('email') as string)?.trim().toLowerCase();
    const username = (data.get('username') as string)?.trim();
    const password = data.get('password') as string;
    const confirmPassword = data.get('confirmPassword') as string;
    const acceptTerms = data.get('acceptTerms');

    // --- Validation ---
    const errors: Record<string, string> = {};

    if (!acceptTerms) {
      errors.acceptTerms = 'Kullanım Koşulları\'nı kabul etmeniz gerekmektedir.';
    }

    if (!email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!username) {
      errors.username = 'Username is required';
    } else if (username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (username.length > 20) {
      errors.username = 'Username must be at most 20 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.username = 'Only letters, numbers, and underscores allowed';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.password = 'Must contain uppercase, lowercase, and a number';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, email, username });
    }

    const existing = await db.select().from(users).where(
      or(eq(users.username, username), eq(users.email, email))
    ).limit(1);

    if (existing.length > 0) {
      if (existing[0].username === username) {
        return fail(400, { errors: { username: 'Username is already taken' }, email, username });
      }
      if (existing[0].email === email) {
        return fail(400, { errors: { email: 'An account with this email already exists' }, email, username });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      await db.insert(users).values({
        username,
        email,
        password: hashedPassword
      });
    } catch (e) {
      console.error('Registration error:', e);
      return fail(500, { errors: { general: 'An unexpected error occurred. Please try again.' }, email, username });
    }

    throw redirect(303, '/login?registered=true');
  }
};
