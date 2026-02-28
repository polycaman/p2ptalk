import { Server, Socket } from 'socket.io';
import { db } from './db';
import { calls, callParticipants, friendships, users, sessions, conversations as conversationsTable, conversationMembers } from './db/schema';
import { eq, and, or, ne, inArray } from 'drizzle-orm';
import cookie from 'cookie';

const userSockets = new Map<string, string>(); 
const roomCleanupTimers = new Map<string, NodeJS.Timeout>();

// ─── Helpers ──────────────────────────────────────────────
function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.length > 0;
}
function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.every(i => typeof i === 'string');
}

export default function injectSocketIO(server: any) {
  const allowedOrigin = process.env.ORIGIN || 'http://localhost:5173';

  const io = new Server(server, { 
      cors: {
          origin: allowedOrigin,
          credentials: true
      },
      pingTimeout: 60000,
  });

  // ─── Authentication Middleware ──────────────────────────
  io.use(async (socket, next) => {
      try {
          const rawCookie = socket.handshake.headers.cookie;
          if (!rawCookie) return next(new Error('Authentication required'));

          const cookies = cookie.parse(rawCookie);
          const sessionId = cookies['session_id'];
          if (!sessionId) return next(new Error('Authentication required'));

          const session = await db
              .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
              .from(sessions)
              .where(eq(sessions.id, sessionId))
              .limit(1);

          if (session.length === 0 || session[0].expiresAt < new Date()) {
              return next(new Error('Session expired'));
          }

          // Attach authenticated userId to socket
          (socket as any).userId = session[0].userId;
          next();
      } catch (e) {
          console.error('Socket auth error:', e);
          next(new Error('Authentication failed'));
      }
  });

  io.on('connection', (socket) => {
    // The authenticated userId from the middleware
    const authenticatedUserId = (socket as any).userId as string;
    
    socket.on('register-user', async (userId: string) => {
        // Ignore client-supplied userId — use the authenticated one
        if(!authenticatedUserId) return;
        const verifiedUserId = authenticatedUserId;
        userSockets.set(verifiedUserId, socket.id);
        console.log(`User registered: ${verifiedUserId} -> ${socket.id}`);
        broadcastActiveCalls(socket);

        // Notify friends that I'am online
        const userFriends = await db.select().from(friendships)
          .where(and(or(eq(friendships.userAId, verifiedUserId), eq(friendships.userBId, verifiedUserId)), eq(friendships.status, 'accepted')));

        userFriends.forEach(f => {
            const friendId = f.userAId === verifiedUserId ? f.userBId : f.userAId;
            const friendSocket = userSockets.get(friendId);
            if(friendSocket) {
                io.to(friendSocket).emit('friend-status-change', { userId: verifiedUserId, status: 'online' });
                socket.emit('friend-status-change', { userId: friendId, status: 'online' });
            }
        });
    });

    socket.on('check-friends-status', async (friendIds: string[]) => {
        if (!isStringArray(friendIds)) return;
        const onlineStatus: Record<string, boolean> = {};
        friendIds.forEach(fid => {
            onlineStatus[fid] = userSockets.has(fid);
        });
        socket.emit('friends-online-status', onlineStatus);
    });

    // Real-time friend request notification
    socket.on('send-friend-request', async ({ fromUserId, toUsername }) => {
        try {
            if (!isNonEmptyString(toUsername)) return;
            // Enforce authenticated identity
            const verifiedFrom = authenticatedUserId;
            const targetUsers = await db.select().from(users).where(eq(users.username, toUsername)).limit(1);
            const targetUser = targetUsers[0];
            if (!targetUser) return;

            // Find the pending friendship row to get its ID
            const pending = await db.select().from(friendships).where(
                and(
                    eq(friendships.userAId, verifiedFrom),
                    eq(friendships.userBId, targetUser.id),
                    eq(friendships.status, 'pending')
                )
            ).limit(1);
            if (pending.length === 0) return;

            // Get sender info
            const senderRows = await db.select().from(users).where(eq(users.id, verifiedFrom)).limit(1);
            const sender = senderRows[0];
            if (!sender) return;

            const targetSocket = userSockets.get(targetUser.id);
            if (targetSocket) {
                io.to(targetSocket).emit('friend-request-received', {
                    id: pending[0].id,
                    username: sender.username,
                    displayName: sender.displayName,
                    userId: sender.id
                });
            }
        } catch (e) { console.error('Error sending friend request notification', e); }
    });

    // Real-time friend accept notification
    socket.on('accept-friend-request', async ({ acceptorId, requestId }) => {
        try {
            if (!isNonEmptyString(requestId)) return;
            // Get the friendship row
            const rows = await db.select().from(friendships).where(eq(friendships.id, requestId)).limit(1);
            if (rows.length === 0) return;
            const row = rows[0];

            // Verify the acceptor is actually part of this request
            if (row.userBId !== authenticatedUserId) return;

            const requesterId = row.userAId;

            // Get both users' info
            const acceptorRows = await db.select().from(users).where(eq(users.id, authenticatedUserId)).limit(1);
            const requesterRows = await db.select().from(users).where(eq(users.id, requesterId!)).limit(1);
            const acceptor = acceptorRows[0];
            const requester = requesterRows[0];
            if (!acceptor || !requester) return;

            // Notify the requester (userA) that their request was accepted
            const requesterSocket = userSockets.get(requesterId!);
            if (requesterSocket) {
                io.to(requesterSocket).emit('friend-request-accepted', {
                    id: acceptor.id,
                    username: acceptor.username,
                    displayName: acceptor.displayName
                });
            }

            // Also notify the acceptor to update their own friends list
            socket.emit('friend-request-accepted', {
                id: requester.id,
                username: requester.username,
                displayName: requester.displayName
            });
        } catch (e) { console.error('Error accepting friend request notification', e); }
    });

    socket.on('remove-friend', async ({ userId, friendId }) => {
        try {
             if (!isNonEmptyString(friendId)) return;
             // Enforce authenticated identity
             const verifiedUserId = authenticatedUserId;
             await db.delete(friendships)
               .where(or(
                 and(eq(friendships.userAId, verifiedUserId), eq(friendships.userBId, friendId)),
                 and(eq(friendships.userAId, friendId), eq(friendships.userBId, verifiedUserId))
               ));
            
             // Notify both parties
             socket.emit('friend-removed', friendId);
             const friendSocket = userSockets.get(friendId);
             if (friendSocket) {
                 io.to(friendSocket).emit('friend-removed', verifiedUserId);
             }
        } catch(e) { console.error('Error removing friend', e); }
    });

    socket.on('disconnect', async () => {
        let disconnectedUser: string | null = null;
        for (const [uid, sid] of userSockets.entries()) {
            if (sid === socket.id) {
                disconnectedUser = uid;
                userSockets.delete(uid);
                break;
            }
        }

        if (disconnectedUser) {
            // Notify friends offline
            try {
                const userFriends = await db.select().from(friendships)
                .where(and(or(eq(friendships.userAId, disconnectedUser), eq(friendships.userBId, disconnectedUser)), eq(friendships.status, 'accepted')));

                userFriends.forEach(f => {
                    const friendId = f.userAId === disconnectedUser ? f.userBId : f.userAId;
                    const friendSocket = userSockets.get(friendId);
                    if(friendSocket) {
                        io.to(friendSocket).emit('friend-status-change', { userId: disconnectedUser, status: 'offline' });
                    }
                });
            } catch(e) { console.error('Error notifying friends disconnect', e); }
        }
    });

    // 1. Create Call
    socket.on('create-call', async ({ initiatorId, targetIds, isGroup, name, scope, allowTurn }) => {
        try {
            // Enforce authenticated identity
            const verifiedInitiator = authenticatedUserId;
            // Reject nameless group rooms
            if (isGroup && (!name || !name.trim())) {
                socket.emit('error', 'Channel name is required');
                return;
            }
            console.log('Creating call', { initiatorId: verifiedInitiator, isGroup, name: name?.trim(), scope, allowTurn });
            const [newCall] = await db.insert(calls).values({
                initiatorId: verifiedInitiator,
                isGroup: isGroup || false,
                name: name?.trim() || null,
                isActive: true,
                scope: scope || 'public',
                allowTurn: !!allowTurn
            }).returning();

            // Add initiator
            await db.insert(callParticipants).values({
                callId: newCall.id,
                userId: verifiedInitiator,
                status: 'joined',
                joinedAt: new Date()
            });

            // Add targets
            if (isStringArray(targetIds) && targetIds.length > 0) {
                for (const tid of targetIds) {
                    await db.insert(callParticipants).values({
                        callId: newCall.id,
                        userId: tid,
                        status: 'invited'
                    });
                    
                    const targetSocketId = userSockets.get(tid);
                    if (targetSocketId) {
                        io.to(targetSocketId).emit('incoming-call', {
                             callId: newCall.id,
                             initiatorId: verifiedInitiator,
                             isGroup: isGroup || false,
                             name: name || 'Call',
                             allowTurn: !!allowTurn
                        });
                    }
                }
            }
            
            socket.emit('call-created', { callId: newCall.id, allowTurn: !!allowTurn });
            
            if(isGroup) {
                 broadcastActiveCalls();
                 scheduleRoomCleanup(newCall.id);
            }

        } catch (e) {
            console.error('Error creating call', e);
        }
    });

    // 2. Join Call (Answer)
    socket.on('join-room', async (roomId, userId) => {
        try {
            if (!isNonEmptyString(roomId)) return;
            // Enforce authenticated identity
            const verifiedUserId = authenticatedUserId;
            const callId = roomId;
            // Validate call exists
            const call = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
            
            if (call.length === 0) {
                socket.emit('error', 'Call not found');
                return;
            }
            
            if (!call[0].isActive) {
                 socket.emit('error', 'Call ended');
                 return;
            }

            // Check permissions
            const participant = await db.select().from(callParticipants)
                .where(and(eq(callParticipants.callId, callId), eq(callParticipants.userId, verifiedUserId)))
                .limit(1);

            let canJoin = false;
            
            if (participant.length > 0) {
                await db.update(callParticipants)
                    .set({ status: 'joined', joinedAt: new Date() })
                    .where(eq(callParticipants.id, participant[0].id));
                canJoin = true;
            } else if (call[0].isGroup || call[0].scope === 'public') {
                 await db.insert(callParticipants).values({
                    callId, userId: verifiedUserId, status: 'joined', joinedAt: new Date()
                 });
                 canJoin = true;
            }

            if (canJoin) {
                socket.join(callId);
                cancelRoomCleanup(callId);

                // Look up username/displayName to send along
                const userRow = await db.select({ username: users.username, displayName: users.displayName })
                    .from(users).where(eq(users.id, verifiedUserId)).limit(1);
                const peerName = userRow[0]?.displayName || userRow[0]?.username || verifiedUserId.slice(0, 4);

                socket.to(callId).emit('user-connected', { userId: verifiedUserId, username: peerName });

                // Send the joiner the usernames of everyone already in the room
                const roomSockets = await io.in(callId).fetchSockets();
                const existingUserIds = roomSockets
                    .map(s => (s as any).userId as string)
                    .filter(id => id && id !== verifiedUserId);

                if (existingUserIds.length > 0) {
                    const existingUsers = await db.select({ id: users.id, username: users.username, displayName: users.displayName })
                        .from(users).where(inArray(users.id, existingUserIds));
                    const nameMap: Record<string, string> = {};
                    for (const u of existingUsers) {
                        nameMap[u.id] = u.displayName || u.username;
                    }
                    socket.emit('room-participants', nameMap);
                }

                console.log(`User ${verifiedUserId} (${peerName}) joined room ${callId}`);
                broadcastActiveCalls();
            } else {
                socket.emit('error', 'Not invited to this private call');
            }
        } catch(e) {
            console.error('Join error', e);
        }
    });


    // Invite User to Room
    socket.on('invite-to-room', async ({ roomId, targetUserId, senderId }) => {
        try {
            if (!isNonEmptyString(roomId) || !isNonEmptyString(targetUserId)) return;
            const verifiedSender = authenticatedUserId;
             const call = await db.select().from(calls).where(eq(calls.id, roomId)).limit(1);
             if (call.length === 0) return;

             await db.insert(callParticipants).values({
                 callId: roomId,
                 userId: targetUserId,
                 status: 'invited'
             });

             const targetSocketId = userSockets.get(targetUserId);
             if (targetSocketId) {
                 io.to(targetSocketId).emit('incoming-call', {
                     callId: roomId,
                     initiatorId: verifiedSender,
                     isGroup: true,
                     name: call[0].name || 'Group Call'
                 });
             }
        } catch(e) { console.error('Invite error', e); }
    });

    // WebRTC Signaling

    socket.on('signal', (data) => {
         if (!data?.to || !data?.signal) return;
         const targetSocketId = userSockets.get(data.to);
         if (targetSocketId) {
             io.to(targetSocketId).emit('signal', {
                 signal: data.signal,
                 from: authenticatedUserId
             });
         }
    });

    // E2EE Key Exchange Relay (server just forwards, cannot read the derived key)
    socket.on('e2ee-key-exchange', (data) => {
        if (!data?.to || !data?.publicKey) return;
        const targetSocketId = userSockets.get(data.to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('e2ee-key-exchange', {
                from: authenticatedUserId,
                publicKey: data.publicKey
            });
        }
    });
    
    // Media Controls
    socket.on('toggle-media', (roomId, data) => {
        // Broadcasts to other users in the room
        socket.to(roomId).emit('user-toggled-media', data);
    });

    // Screen Share ID Forwarding
    socket.on('screen-share-started', (data) => {
        if (!data?.to || !data?.streamId) return;
        const targetSocketId = userSockets.get(data.to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('screen-share-started', {
                from: authenticatedUserId,
                streamId: data.streamId
            });
        }
    });

    // Screen Share ID Broadcast (for all users in room)
    socket.on('screen-share-started-room', (roomId, data) => {
        if (!isNonEmptyString(roomId)) return;
        socket.to(roomId).emit('screen-share-started', { ...data, from: authenticatedUserId });
    });

    // Delete Room
    socket.on('delete-room', async (roomId, userId) => {
        try {
            if (!isNonEmptyString(roomId)) return;
            const verifiedUserId = authenticatedUserId;
            const call = await db.select().from(calls).where(eq(calls.id, roomId)).limit(1);
            if (call.length > 0 && call[0].initiatorId === verifiedUserId) {
                 cancelRoomCleanup(roomId);
                 await db.update(calls).set({ isActive: false }).where(eq(calls.id, roomId));
                 
                 // Notify all clients to update list
                 broadcastActiveCalls();
                 
                 // Notify users in the room to leave
                 io.to(roomId).emit('room-closed');
            }
        } catch(e) { console.error('Delete room error', e); }
    });

    // File Sharing Signaling (Actual file data via WebRTC Data Channels)
    socket.on('file-meta', (roomId, data) => {
        socket.to(roomId).emit('file-meta-receive', data);
    });
    
    socket.on('disconnecting', () => {
      const rooms = [...socket.rooms];
      let userId: string | null = null;
      for (const [uid, sid] of userSockets.entries()) {
          if (sid === socket.id) {
              userId = uid;
              break;
          }
      }
      if (userId) {
          rooms.forEach((room) => {
              if (room !== socket.id) {
                  socket.to(room).emit('user-disconnected', userId);
                  // If this was the last user, schedule auto-cleanup
                  const members = io.sockets.adapter.rooms.get(room);
                  // members still includes the disconnecting socket, so <= 1 means empty after disconnect
                  if (!members || members.size <= 1) {
                      scheduleRoomCleanup(room);
                  }
              }
          });
          // Update participant counts for all viewers
          setTimeout(() => broadcastActiveCalls(), 500);
      }
    });

    socket.on('send-message', (roomId, message) => {
        socket.to(roomId).emit('receive-message', message);
    });

    // ─── Chat: Get or Create DM ─────────────────────────────
    socket.on('get-or-create-dm', async ({ friendId }, callback) => {
        if (!isNonEmptyString(friendId) || typeof callback !== 'function') return;
        try {
            const existingId = await findExistingDM(authenticatedUserId, friendId);
            if (existingId) {
                const conv = await db.select().from(conversationsTable).where(eq(conversationsTable.id, existingId)).limit(1);
                const members = await getConversationMembersList(existingId);
                return callback({ conversation: { ...conv[0], members } });
            }

            const [newConv] = await db.insert(conversationsTable).values({
                type: 'dm',
                createdBy: authenticatedUserId
            }).returning();

            await db.insert(conversationMembers).values([
                { conversationId: newConv.id, userId: authenticatedUserId, role: 'member' },
                { conversationId: newConv.id, userId: friendId, role: 'member' }
            ]);

            const members = await getConversationMembersList(newConv.id);
            const result = { ...newConv, members };

            const friendSocket = userSockets.get(friendId);
            if (friendSocket) {
                io.to(friendSocket).emit('conversation-created', result);
            }

            callback({ conversation: result });
        } catch (e) {
            console.error('DM error:', e);
            callback({ error: 'Failed to create conversation' });
        }
    });

    // ─── Chat: Create Group ──────────────────────────────────
    socket.on('create-group-chat', async ({ name, description, memberIds }, callback) => {
        if (!isNonEmptyString(name) || typeof callback !== 'function') return;
        if (!isStringArray(memberIds) || memberIds.length === 0) return callback({ error: 'Members required' });
        try {
            const [newConv] = await db.insert(conversationsTable).values({
                type: 'group',
                name,
                description: description || null,
                createdBy: authenticatedUserId
            }).returning();

            const allMembers = [authenticatedUserId, ...memberIds];
            for (const uid of allMembers) {
                await db.insert(conversationMembers).values({
                    conversationId: newConv.id,
                    userId: uid,
                    role: uid === authenticatedUserId ? 'admin' : 'member'
                });
            }

            const members = await getConversationMembersList(newConv.id);
            const result = { ...newConv, members };

            for (const uid of memberIds) {
                const sock = userSockets.get(uid);
                if (sock) io.to(sock).emit('conversation-created', result);
            }

            callback({ conversation: result });
        } catch (e) {
            console.error('Group creation error:', e);
            callback({ error: 'Failed' });
        }
    });

    // ─── Chat: WebRTC Signaling ──────────────────────────────
    socket.on('chat-signal', (data) => {
        if (!data?.to || !data?.signal) return;
        const targetSocketId = userSockets.get(data.to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('chat-signal', {
                signal: data.signal,
                from: authenticatedUserId
            });
        }
    });

    // ─── Chat: Update Group ──────────────────────────────────
    socket.on('update-group-chat', async ({ conversationId, name, description }) => {
        if (!isNonEmptyString(conversationId)) return;
        try {
            await db.update(conversationsTable)
                .set({ name, description })
                .where(eq(conversationsTable.id, conversationId));

            const members = await getConversationMembersList(conversationId);
            for (const m of members) {
                const sock = userSockets.get(m.userId);
                if (sock) io.to(sock).emit('group-updated', { conversationId, name, description });
            }
        } catch (e) { console.error('Update group error:', e); }
    });

    // ─── Chat: Leave Group ───────────────────────────────────
    socket.on('leave-group-chat', async ({ conversationId }) => {
        if (!isNonEmptyString(conversationId)) return;
        try {
            await db.delete(conversationMembers).where(and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, authenticatedUserId)
            ));
            const members = await getConversationMembersList(conversationId);
            for (const m of members) {
                const sock = userSockets.get(m.userId);
                if (sock) io.to(sock).emit('member-left', { conversationId, userId: authenticatedUserId });
            }
        } catch (e) { console.error('Leave group error:', e); }
    });

    // ─── Chat: Add Group Member ──────────────────────────────
    socket.on('add-group-member', async ({ conversationId, userId: targetUserId }) => {
        if (!isNonEmptyString(conversationId) || !isNonEmptyString(targetUserId)) return;
        try {
            await db.insert(conversationMembers).values({
                conversationId,
                userId: targetUserId,
                role: 'member'
            });
            const members = await getConversationMembersList(conversationId);
            const conv = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId)).limit(1);

            const newMemberSocket = userSockets.get(targetUserId);
            if (newMemberSocket && conv.length > 0) {
                io.to(newMemberSocket).emit('conversation-created', { ...conv[0], members });
            }
            for (const m of members) {
                const sock = userSockets.get(m.userId);
                if (sock) io.to(sock).emit('member-added', { conversationId, members });
            }
        } catch (e) { console.error('Add member error:', e); }
    });
  });

  async function broadcastActiveCalls(targetSocket?: Socket) {
      try {
        const activeCalls = await db.select({
            id: calls.id,
            name: calls.name,
            initiatorId: calls.initiatorId,
            initiatorName: users.username,
            initiatorDisplayName: users.displayName,
            scope: calls.scope,
            isGroup: calls.isGroup,
            isActive: calls.isActive,
            createdAt: calls.createdAt,
            allowTurn: calls.allowTurn
        })
        .from(calls)
        .leftJoin(users, eq(calls.initiatorId, users.id))
        .where(and(eq(calls.isActive, true), eq(calls.isGroup, true)));

        // Attach live participant count from Socket.IO rooms
        const callsWithCount = activeCalls.map(c => {
            const room = io.sockets.adapter.rooms.get(c.id);
            return { ...c, participantCount: room ? room.size : 0 };
        });

        if (targetSocket) {
            // Find userId for this socket
            let targetUserId: string | undefined;
            for (const [uid, sid] of userSockets.entries()) {
                if (sid === targetSocket.id) { targetUserId = uid; break; }
            }
            const invitedIds = targetUserId ? await getUserInvitedCallIds(targetUserId) : new Set<string>();
            const callsWithInvite = callsWithCount.map(c => ({ ...c, isInvited: invitedIds.has(c.id) }));
            targetSocket.emit('active-calls', callsWithInvite);
        } else {
            // Per-user broadcast so each user gets their own isInvited flags
            for (const [userId, socketId] of userSockets.entries()) {
                const sock = io.sockets.sockets.get(socketId);
                if (!sock) continue;
                const invitedIds = await getUserInvitedCallIds(userId);
                const callsWithInvite = callsWithCount.map(c => ({ ...c, isInvited: invitedIds.has(c.id) }));
                sock.emit('active-calls', callsWithInvite);
            }
        }
      } catch(e) { console.error('Broadcast error', e); }
  }

  async function getUserInvitedCallIds(userId: string): Promise<Set<string>> {
      const invites = await db.select({ callId: callParticipants.callId })
          .from(callParticipants)
          .where(and(
              eq(callParticipants.userId, userId),
              eq(callParticipants.status, 'invited')
          ));
      return new Set(invites.map(i => i.callId).filter((id): id is string => id !== null));
  }

  function scheduleRoomCleanup(roomId: string) {
      cancelRoomCleanup(roomId);
      const timer = setTimeout(async () => {
          roomCleanupTimers.delete(roomId);
          // Re-check: is the room still empty?
          const room = io.sockets.adapter.rooms.get(roomId);
          if (!room || room.size === 0) {
              try {
                  const call = await db.select().from(calls).where(eq(calls.id, roomId)).limit(1);
                  if (call.length > 0 && call[0].isActive) {
                      await db.update(calls).set({ isActive: false }).where(eq(calls.id, roomId));
                      console.log(`Auto-removed empty room: ${roomId}`);
                      broadcastActiveCalls();
                  }
              } catch (e) {
                  console.error('Error auto-removing room', e);
              }
          }
      }, 5 * 60 * 1000); // 5 minutes
      roomCleanupTimers.set(roomId, timer);
  }

  function cancelRoomCleanup(roomId: string) {
      const timer = roomCleanupTimers.get(roomId);
      if (timer) {
          clearTimeout(timer);
          roomCleanupTimers.delete(roomId);
      }
  }

  console.log('SocketIO injected with DB Logic');

  // ─── Chat Helpers ──────────────────────────────────────

  async function findExistingDM(userA: string, userB: string): Promise<string | null> {
      const userADMs = await db
          .select({ conversationId: conversationMembers.conversationId })
          .from(conversationMembers)
          .innerJoin(conversationsTable, and(
              eq(conversationsTable.id, conversationMembers.conversationId),
              eq(conversationsTable.type, 'dm')
          ))
          .where(eq(conversationMembers.userId, userA));

      if (userADMs.length === 0) return null;
      const convIds = userADMs.map(r => r.conversationId).filter((id): id is string => id !== null);
      if (convIds.length === 0) return null;

      const match = await db
          .select({ conversationId: conversationMembers.conversationId })
          .from(conversationMembers)
          .where(and(
              inArray(conversationMembers.conversationId, convIds),
              eq(conversationMembers.userId, userB)
          ))
          .limit(1);

      return match.length > 0 ? match[0].conversationId : null;
  }

  async function getConversationMembersList(conversationId: string) {
      return db.select({
          userId: conversationMembers.userId,
          role: conversationMembers.role,
          username: users.username,
          displayName: users.displayName
      })
      .from(conversationMembers)
      .innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(eq(conversationMembers.conversationId, conversationId));
  }
}
