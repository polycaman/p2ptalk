import { pgTable, text, serial, timestamp, uuid, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const friendships = pgTable('friendships', {
  id: serial('id').primaryKey(),
  userAId: uuid('user_a_id').notNull().references(() => users.id),
  userBId: uuid('user_b_id').notNull().references(() => users.id),
  status: text('status').default('pending').notNull(), // pending, accepted, rejected, blocked
  createdAt: timestamp('created_at').defaultNow()
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  recipientId: uuid('recipient_id').notNull().references(() => users.id),
  senderId: uuid('sender_id').references(() => users.id),
  type: text('type').default('friend_request').notNull(),
  content: text('content'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow()
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at').notNull()
});

export const calls = pgTable('calls', {
  id: uuid('id').defaultRandom().primaryKey(),
  initiatorId: uuid('initiator_id').references(() => users.id),
  name: text('name'),
  isActive: boolean('is_active').default(true),
  isGroup: boolean('is_group').default(false),
  allowTurn: boolean('allow_turn').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  scope: text('scope').default('public') // public, friends, private
});

export const callParticipants = pgTable('call_participants', {
  id: serial('id').primaryKey(),
  callId: uuid('call_id').references(() => calls.id),
  userId: uuid('user_id').references(() => users.id),
  status: text('status').default('invited'), // invited, joined, rejected
  joinedAt: timestamp('joined_at')
});

// ─── Chat Conversations (metadata only, messages are P2P) ───
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(), // 'dm' | 'group'
  name: text('name'),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow()
});

export const conversationMembers = pgTable('conversation_members', {
  id: serial('id').primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: text('role').default('member').notNull(), // 'admin' | 'member'
  joinedAt: timestamp('joined_at').defaultNow()
});
