import type { Server as SocketIOServer, Socket } from "socket.io";
import { logger } from "./lib/logger";
import { startBots, stopBots, areBotsEnabled, BOT_USERNAMES, getTestResults } from "./bots";
import { db } from "@workspace/db";
import {
  users, sessions, globalMessages, rooms, roomMembers, roomMessages,
  dmMessages, messageReactions,
  type User,
} from "@workspace/db/schema";
import { eq, and, or, gt, desc, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sendPushToUser } from "./routes/push";

const ADMIN_USERNAME = "Jasko4185";
const ADMIN_PASSWORD = "Sloneczko1";

export interface OnlineUser {
  username: string;
  socketId: string;
  joinedAt: string;
}

export interface WireMessage {
  id: string;
  username: string;
  text: string;
  timestamp: string;
  imageUrl?: string;
  reactions?: Record<string, string[]>;
}

export interface WireDmMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: string;
  imageUrl?: string;
  reactions?: Record<string, string[]>;
}

export interface WireRoom {
  id: string;
  name: string;
  creator: string;
  type: string;
  members: string[];
  createdAt: string;
}

export interface WireRoomMessage {
  id: string;
  roomId: string;
  username: string;
  text: string;
  imageUrl?: string;
  timestamp: string;
  reactions?: Record<string, string[]>;
}

export const onlineUsers = new Map<string, OnlineUser>();
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getUser(socket: Socket): User | undefined {
  return (socket as Socket & { currentUser?: User }).currentUser;
}

function findSocketIdByUsername(username: string): string | undefined {
  for (const [sid, u] of onlineUsers) {
    if (u.username === username) return sid;
  }
  return undefined;
}

async function getReactionsForMessages(
  messageIds: string[],
): Promise<Record<string, Record<string, string[]>>> {
  if (!messageIds.length) return {};
  const rows = await db
    .select()
    .from(messageReactions)
    .where(inArray(messageReactions.messageId, messageIds));
  const result: Record<string, Record<string, string[]>> = {};
  for (const row of rows) {
    if (!result[row.messageId]) result[row.messageId] = {};
    if (!result[row.messageId][row.emoji]) result[row.messageId][row.emoji] = [];
    result[row.messageId][row.emoji].push(row.username);
  }
  return result;
}

async function getRoomsForUser(username: string): Promise<WireRoom[]> {
  const allRooms = await db.select().from(rooms).orderBy(rooms.createdAt);
  const allMembers = await db.select().from(roomMembers);
  const memberMap = new Map<string, string[]>();
  for (const m of allMembers) {
    if (!memberMap.has(m.roomId)) memberMap.set(m.roomId, []);
    memberMap.get(m.roomId)!.push(m.username);
  }
  return allRooms
    .map((r) => ({
      id: r.id,
      name: r.name,
      creator: r.creator,
      type: r.type,
      members: memberMap.get(r.id) ?? [],
      createdAt: r.createdAt.toISOString(),
    }))
    .filter(
      (r) =>
        r.type === "public" ||
        r.members.includes(username) ||
        r.creator === username,
    );
}

async function broadcastRoomsToAll(io: SocketIOServer): Promise<void> {
  for (const [sid, user] of onlineUsers) {
    const userRooms = await getRoomsForUser(user.username);
    io.to(sid).emit("rooms_list", userRooms);
  }
}

export async function setupAdmin(): Promise<void> {
  try {
    const existing = await db
      .select({ id: users.id, isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.username, ADMIN_USERNAME))
      .limit(1);
    if (!existing.length) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await db.insert(users).values({
        username: ADMIN_USERNAME,
        passwordHash: hash,
        isAdmin: true,
      });
      logger.info("Admin user created");
    } else if (!existing[0].isAdmin) {
      await db.update(users)
        .set({ isAdmin: true })
        .where(eq(users.username, ADMIN_USERNAME));
      logger.info("Admin flag updated for existing user");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin");
  }
}

export function setupSocketIO(io: SocketIOServer): void {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error("Brak tokenu. Zaloguj się ponownie."));
    }
    try {
      const result = await db
        .select({ user: users })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(
          and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())),
        )
        .limit(1);
      if (!result.length) {
        return next(new Error("Sesja wygasła. Zaloguj się ponownie."));
      }
      const user = result[0].user;
      if (user.isBanned) {
        return next(new Error("Twoje konto zostało zbanowane."));
      }
      (socket as Socket & { currentUser: User }).currentUser = user;
      next();
    } catch (err) {
      logger.error({ err }, "Socket auth error");
      next(new Error("Błąd uwierzytelniania."));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const user = getUser(socket)!;
    logger.info({ socketId: socket.id, username: user.username }, "Socket connected");

    onlineUsers.set(socket.id, {
      username: user.username,
      socketId: socket.id,
      joinedAt: new Date().toISOString(),
    });
    io.emit("online_users", Array.from(onlineUsers.values()));

    socket.emit("join_success", {
      username: user.username,
      isAdmin: user.isAdmin,
      isMuted: user.isMuted,
    });

    if (user.isAdmin) {
      const mutedList = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.isMuted, true));
      const bannedList = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.isBanned, true));
      socket.emit("admin_state", {
        mutedUsers: mutedList.map((u) => u.username),
        bannedUsers: bannedList.map((u) => u.username),
      });
    }

    try {
      const history = await db
        .select()
        .from(globalMessages)
        .orderBy(desc(globalMessages.createdAt))
        .limit(100);
      history.reverse();
      const reactions = await getReactionsForMessages(history.map((m) => m.id));
      socket.emit(
        "message_history",
        history.map((m) => ({
          id: m.id,
          username: m.username,
          text: m.text,
          imageUrl: m.imageUrl ?? undefined,
          timestamp: m.createdAt.toISOString(),
          reactions: reactions[m.id] ?? {},
        } satisfies WireMessage)),
      );
    } catch (err) {
      logger.error({ err }, "Failed to load message history");
    }

    const joinMsg: WireMessage = {
      id: generateId(),
      username: "__system__",
      text: `${user.username} dołączył(a) do czatu`,
      timestamp: new Date().toISOString(),
    };
    db.insert(globalMessages)
      .values({ id: joinMsg.id, username: "__system__", text: joinMsg.text })
      .catch((e) => logger.error({ e }, "Failed to save join message"));
    io.emit("new_message", joinMsg);

    const userRooms = await getRoomsForUser(user.username);
    socket.emit("rooms_list", userRooms);

    // ── Public chat ──────────────────────────────────────────────────────────

    socket.on("send_message", async (text: string) => {
      const u = getUser(socket);
      if (!u) return;
      if (u.isMuted) return;
      const cleanText = String(text).trim().slice(0, 2000);
      if (!cleanText) return;
      const msg: WireMessage = {
        id: generateId(),
        username: u.username,
        text: cleanText,
        timestamp: new Date().toISOString(),
        reactions: {},
      };
      db.insert(globalMessages)
        .values({ id: msg.id, username: u.username, text: cleanText })
        .catch((e) => logger.error({ e }, "Failed to save message"));
      io.emit("new_message", msg);
    });

    socket.on("send_image", async (payload: { imageUrl: string; text?: string }) => {
      const u = getUser(socket);
      if (!u) return;
      if (u.isMuted) return;
      const imageUrl = String(payload?.imageUrl ?? "").trim();
      if (!imageUrl) return;
      const text = String(payload?.text ?? "").trim();
      const msg: WireMessage = {
        id: generateId(),
        username: u.username,
        text,
        imageUrl,
        timestamp: new Date().toISOString(),
        reactions: {},
      };
      db.insert(globalMessages)
        .values({ id: msg.id, username: u.username, text, imageUrl })
        .catch((e) => logger.error({ e }, "Failed to save image message"));
      io.emit("new_message", msg);
    });

    socket.on("delete_message", async (payload: { id: string }) => {
      const u = getUser(socket);
      if (!u) return;
      const id = String(payload?.id ?? "").trim();
      if (!id) return;
      const [msg] = await db
        .select()
        .from(globalMessages)
        .where(eq(globalMessages.id, id))
        .limit(1);
      if (!msg) return;
      if (msg.username !== u.username && !u.isAdmin) return;
      await db.delete(globalMessages).where(eq(globalMessages.id, id));
      await db.delete(messageReactions).where(eq(messageReactions.messageId, id));
      io.emit("message_deleted", { id });
      logger.info({ username: u.username, msgId: id }, "Message deleted");
    });

    // ── Typing indicators ────────────────────────────────────────────────────

    socket.on("typing_start", (payload: { context: string }) => {
      const u = getUser(socket);
      if (!u) return;
      const context = String(payload?.context ?? "").trim();
      if (!context) return;

      const timerKey = `${socket.id}:${context}`;
      if (typingTimers.has(timerKey)) clearTimeout(typingTimers.get(timerKey)!);
      typingTimers.set(
        timerKey,
        setTimeout(() => {
          socket.broadcast.emit("typing_stop", { username: u.username, context });
          typingTimers.delete(timerKey);
        }, 4000),
      );
      socket.broadcast.emit("typing_start", { username: u.username, context });
    });

    socket.on("typing_stop", (payload: { context: string }) => {
      const u = getUser(socket);
      if (!u) return;
      const context = String(payload?.context ?? "").trim();
      const timerKey = `${socket.id}:${context}`;
      if (typingTimers.has(timerKey)) {
        clearTimeout(typingTimers.get(timerKey)!);
        typingTimers.delete(timerKey);
      }
      socket.broadcast.emit("typing_stop", { username: u.username, context });
    });

    // ── Reactions ────────────────────────────────────────────────────────────

    socket.on(
      "add_reaction",
      async (payload: { messageId: string; messageType: string; emoji: string }) => {
        const u = getUser(socket);
        if (!u) return;
        const { messageId, messageType, emoji } = payload;
        if (!messageId || !emoji) return;

        const existing = await db
          .select()
          .from(messageReactions)
          .where(
            and(
              eq(messageReactions.messageId, messageId),
              eq(messageReactions.username, u.username),
              eq(messageReactions.emoji, emoji),
            ),
          )
          .limit(1);

        if (existing.length) {
          await db.delete(messageReactions).where(eq(messageReactions.id, existing[0].id));
        } else {
          await db.insert(messageReactions).values({
            messageId,
            messageType,
            username: u.username,
            emoji,
          });
        }

        const allReactions = await db
          .select()
          .from(messageReactions)
          .where(eq(messageReactions.messageId, messageId));

        const reactionMap: Record<string, string[]> = {};
        for (const r of allReactions) {
          if (!reactionMap[r.emoji]) reactionMap[r.emoji] = [];
          reactionMap[r.emoji].push(r.username);
        }

        io.emit("reaction_updated", { messageId, messageType, reactions: reactionMap });
      },
    );

    // ── Direct Messages ──────────────────────────────────────────────────────

    socket.on("get_dm_history", async (payload: { partner: string }) => {
      const u = getUser(socket);
      if (!u) return;
      const partner = String(payload?.partner ?? "").trim();
      if (!partner) return;
      const msgs = await db
        .select()
        .from(dmMessages)
        .where(
          or(
            and(eq(dmMessages.fromUsername, u.username), eq(dmMessages.toUsername, partner)),
            and(eq(dmMessages.fromUsername, partner), eq(dmMessages.toUsername, u.username)),
          ),
        )
        .orderBy(dmMessages.createdAt)
        .limit(100);
      const reactions = await getReactionsForMessages(msgs.map((m) => m.id));
      socket.emit("dm_history", {
        partner,
        messages: msgs.map((m) => ({
          id: m.id,
          from: m.fromUsername,
          to: m.toUsername,
          text: m.text,
          imageUrl: m.imageUrl ?? undefined,
          timestamp: m.createdAt.toISOString(),
          reactions: reactions[m.id] ?? {},
        } satisfies WireDmMessage)),
      });
    });

    socket.on("send_dm", async (payload: { to: string; text: string }) => {
      const u = getUser(socket);
      if (!u || u.isMuted) return;
      const toUsername = String(payload.to ?? "").trim();
      const cleanText = String(payload.text ?? "").trim().slice(0, 2000);
      if (!cleanText || !toUsername) return;

      const dm: WireDmMessage = {
        id: generateId(),
        from: u.username,
        to: toUsername,
        text: cleanText,
        timestamp: new Date().toISOString(),
        reactions: {},
      };
      db.insert(dmMessages)
        .values({ id: dm.id, fromUsername: u.username, toUsername, text: cleanText })
        .catch((e) => logger.error({ e }, "Failed to save DM"));

      socket.emit("new_dm", dm);
      const toSid = findSocketIdByUsername(toUsername);
      if (toSid) io.to(toSid).emit("new_dm", dm);
      else {
        sendPushToUser(toUsername, {
          title: `Nowa wiadomość od ${u.username}`,
          body: cleanText.slice(0, 80),
          icon: "/favicon.ico",
          data: { url: `/dm/${u.username}` },
        }).catch(() => {});
      }
    });

    socket.on("send_dm_image", async (payload: { to: string; imageUrl: string; text?: string }) => {
      const u = getUser(socket);
      if (!u || u.isMuted) return;
      const toUsername = String(payload?.to ?? "").trim();
      const imageUrl = String(payload?.imageUrl ?? "").trim();
      if (!imageUrl || !toUsername) return;
      const text = String(payload?.text ?? "").trim();

      const dm: WireDmMessage = {
        id: generateId(),
        from: u.username,
        to: toUsername,
        text,
        imageUrl,
        timestamp: new Date().toISOString(),
        reactions: {},
      };
      db.insert(dmMessages)
        .values({ id: dm.id, fromUsername: u.username, toUsername, text, imageUrl })
        .catch((e) => logger.error({ e }, "Failed to save DM image"));

      socket.emit("new_dm", dm);
      const toSid = findSocketIdByUsername(toUsername);
      if (toSid) io.to(toSid).emit("new_dm", dm);
      else {
        sendPushToUser(toUsername, {
          title: `Nowe zdjęcie od ${u.username}`,
          body: text || "Zdjęcie",
          icon: "/favicon.ico",
          data: { url: `/dm/${u.username}` },
        }).catch(() => {});
      }
    });

    // ── Rooms ────────────────────────────────────────────────────────────────

    socket.on("get_rooms", async () => {
      const u = getUser(socket);
      if (!u) return;
      socket.emit("rooms_list", await getRoomsForUser(u.username));
    });

    socket.on("create_room", async (payload: { name: string; type: "public" | "private" }) => {
      const u = getUser(socket);
      if (!u) return;
      const name = String(payload?.name ?? "").trim().slice(0, 50);
      const type = payload?.type === "private" ? "private" : "public";
      if (!name) return;
      const id = generateId();
      await db.insert(rooms).values({ id, name, creator: u.username, type });
      await db.insert(roomMembers).values({ roomId: id, username: u.username });
      await broadcastRoomsToAll(io);
      logger.info({ creator: u.username, roomId: id, type }, "Room created");
    });

    socket.on("delete_room", async (roomId: string) => {
      const u = getUser(socket);
      if (!u) return;
      const [room] = await db.select().from(rooms).where(eq(rooms.id, String(roomId))).limit(1);
      if (!room) return;
      if (room.creator !== u.username && !u.isAdmin) return;
      await db.delete(rooms).where(eq(rooms.id, room.id));
      await broadcastRoomsToAll(io);
      io.emit("room_deleted", { roomId: room.id });
      logger.info({ username: u.username, roomId: room.id }, "Room deleted");
    });

    socket.on("join_room", async (roomId: string) => {
      const u = getUser(socket);
      if (!u) return;
      const [room] = await db.select().from(rooms).where(eq(rooms.id, String(roomId))).limit(1);
      if (!room) return;
      const members = await db.select().from(roomMembers).where(eq(roomMembers.roomId, room.id));
      const memberNames = members.map((m) => m.username);
      if (room.type === "private" && !memberNames.includes(u.username) && room.creator !== u.username) return;
      if (!memberNames.includes(u.username)) {
        await db.insert(roomMembers).values({ roomId: room.id, username: u.username }).onConflictDoNothing();
        await broadcastRoomsToAll(io);
      }
      const history = await db
        .select()
        .from(roomMessages)
        .where(eq(roomMessages.roomId, room.id))
        .orderBy(roomMessages.createdAt)
        .limit(100);
      const reactions = await getReactionsForMessages(history.map((m) => m.id));
      socket.emit("room_history", {
        roomId: room.id,
        messages: history.map((m) => ({
          id: m.id,
          roomId: m.roomId,
          username: m.username,
          text: m.text,
          imageUrl: m.imageUrl ?? undefined,
          timestamp: m.createdAt.toISOString(),
          reactions: reactions[m.id] ?? {},
        } satisfies WireRoomMessage)),
      });
    });

    socket.on("add_to_room", async (payload: { roomId: string; username: string }) => {
      const u = getUser(socket);
      if (!u) return;
      const [room] = await db.select().from(rooms).where(eq(rooms.id, String(payload?.roomId ?? ""))).limit(1);
      if (!room || room.creator !== u.username) return;
      const target = String(payload?.username ?? "").trim();
      if (!target) return;
      await db.insert(roomMembers).values({ roomId: room.id, username: target }).onConflictDoNothing();
      await broadcastRoomsToAll(io);
    });

    socket.on("send_room_message", async (payload: { roomId: string; text: string; imageUrl?: string }) => {
      const u = getUser(socket);
      if (!u || u.isMuted) return;
      const [room] = await db.select().from(rooms).where(eq(rooms.id, String(payload?.roomId ?? ""))).limit(1);
      if (!room) return;
      const members = await db.select().from(roomMembers).where(eq(roomMembers.roomId, room.id));
      if (!members.some((m) => m.username === u.username)) return;
      const cleanText = String(payload?.text ?? "").trim().slice(0, 2000);
      const imageUrl = payload?.imageUrl ? String(payload.imageUrl).trim() : undefined;
      if (!cleanText && !imageUrl) return;
      const msg: WireRoomMessage = {
        id: generateId(),
        roomId: room.id,
        username: u.username,
        text: cleanText,
        imageUrl,
        timestamp: new Date().toISOString(),
        reactions: {},
      };
      db.insert(roomMessages)
        .values({ id: msg.id, roomId: room.id, username: u.username, text: cleanText, imageUrl })
        .catch((e) => logger.error({ e }, "Failed to save room message"));
      for (const member of members) {
        const sid = findSocketIdByUsername(member.username);
        if (sid) io.to(sid).emit("new_room_message", msg);
      }
    });

    // ── Admin actions ────────────────────────────────────────────────────────

    socket.on("kick_user", async (targetUsername: string) => {
      const u = getUser(socket);
      if (!u?.isAdmin) return;
      const target = String(targetUsername).trim();
      const sid = findSocketIdByUsername(target);
      if (sid) {
        io.to(sid).emit("kicked", "Zostałeś wyrzucony przez administratora.");
        io.sockets.sockets.get(sid)?.disconnect(true);
      }
      logger.info({ admin: u.username, target }, "User kicked");
    });

    socket.on("ban_user", async (targetUsername: string) => {
      const u = getUser(socket);
      if (!u?.isAdmin) return;
      const target = String(targetUsername).trim();
      await db.update(users).set({ isBanned: true }).where(eq(users.username, target));
      const sid = findSocketIdByUsername(target);
      if (sid) {
        io.to(sid).emit("banned", "Zostałeś zbanowany przez administratora.");
        io.sockets.sockets.get(sid)?.disconnect(true);
      }
      const sysMsg: WireMessage = {
        id: generateId(),
        username: "__system__",
        text: `${target} został(a) zbanowany(a)`,
        timestamp: new Date().toISOString(),
      };
      db.insert(globalMessages)
        .values({ id: sysMsg.id, username: "__system__", text: sysMsg.text })
        .catch(() => {});
      io.emit("new_message", sysMsg);
      const bannedList = await db.select({ username: users.username }).from(users).where(eq(users.isBanned, true));
      socket.emit("admin_state", {
        mutedUsers: (await db.select({ username: users.username }).from(users).where(eq(users.isMuted, true))).map((u) => u.username),
        bannedUsers: bannedList.map((u) => u.username),
      });
      logger.info({ admin: u.username, target }, "User banned");
    });

    socket.on("mute_user", async (targetUsername: string) => {
      const u = getUser(socket);
      if (!u?.isAdmin) return;
      const target = String(targetUsername).trim();
      const [targetUser] = await db.select().from(users).where(eq(users.username, target)).limit(1);
      if (!targetUser) return;
      const nowMuted = !targetUser.isMuted;
      await db.update(users).set({ isMuted: nowMuted }).where(eq(users.username, target));
      const sid = findSocketIdByUsername(target);
      if (sid) {
        io.to(sid).emit(
          nowMuted ? "you_muted" : "you_unmuted",
          nowMuted ? "Zostałeś(aś) wyciszony(a) przez administratora." : "Twoje wyciszenie zostało zdjęte.",
        );
        const targetSocket = io.sockets.sockets.get(sid);
        if (targetSocket) {
          (targetSocket as Socket & { currentUser?: User }).currentUser = { ...targetUser, isMuted: nowMuted };
        }
      }
      socket.emit("mute_toggled", { username: target, muted: nowMuted });
      logger.info({ admin: u.username, target, muted: nowMuted }, "Mute toggled");
    });

    socket.on("unban_user", async (targetUsername: string) => {
      const u = getUser(socket);
      if (!u?.isAdmin) return;
      const target = String(targetUsername).trim();
      await db.update(users).set({ isBanned: false }).where(eq(users.username, target));
      socket.emit("unban_confirmed", target);
      logger.info({ admin: u.username, target }, "User unbanned");
    });

    // ── WebRTC signaling ─────────────────────────────────────────────────────

    // Friend requests (frontend-to-frontend via server relay)
    socket.on("send_friend_request", ({ to }: { to: string }) => {
      const u = getUser(socket);
      if (!u) return;
      const sid = findSocketIdByUsername(to);
      if (sid) io.to(sid).emit("friend_request", { from: u.username });
    });

    socket.on("call_request", (payload: { to: string; callType?: "video" | "audio" }) => {
      const u = getUser(socket);
      if (!u) return;
      const sid = findSocketIdByUsername(String(payload?.to ?? ""));
      if (sid) io.to(sid).emit("call_request", { from: u.username, callType: payload?.callType ?? "video" });
    });

    socket.on("call_accept", (payload: { to: string }) => {
      const u = getUser(socket);
      if (!u) return;
      const sid = findSocketIdByUsername(String(payload?.to ?? ""));
      if (sid) io.to(sid).emit("call_accept", { from: u.username });
    });

    socket.on("call_reject", (payload: { to: string }) => {
      const u = getUser(socket);
      if (!u) return;
      const sid = findSocketIdByUsername(String(payload?.to ?? ""));
      if (sid) io.to(sid).emit("call_reject", { from: u.username });
    });

    socket.on("call_end", (payload: { to: string }) => {
      const u = getUser(socket);
      if (!u) return;
      const sid = findSocketIdByUsername(String(payload?.to ?? ""));
      if (sid) io.to(sid).emit("call_end", { from: u.username });
    });

    socket.on("webrtc_offer", (payload: { to: string; offer: object }) => {
      const u = getUser(socket);
      if (!u) return;
      const sid = findSocketIdByUsername(String(payload?.to ?? ""));
      if (sid) io.to(sid).emit("webrtc_offer", { from: u.username, offer: payload.offer });
    });

    socket.on("webrtc_answer", (payload: { to: string; answer: object }) => {
      const u = getUser(socket);
      if (!u) return;
      const sid = findSocketIdByUsername(String(payload?.to ?? ""));
      if (sid) io.to(sid).emit("webrtc_answer", { from: u.username, answer: payload.answer });
    });

    socket.on("webrtc_ice_candidate", (payload: { to: string; candidate: object }) => {
      const u = getUser(socket);
      if (!u) return;
      const sid = findSocketIdByUsername(String(payload?.to ?? ""));
      if (sid) io.to(sid).emit("webrtc_ice_candidate", { from: u.username, candidate: payload.candidate });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────

    // Bot registration
    socket.on("bot_register", ({ username }: { username: string }) => {
      if (!BOT_USERNAMES.has(username)) return;
      onlineUsers.set(socket.id, { username, socketId: socket.id, joinedAt: new Date().toISOString() });
      io.emit("users_update", Array.from(onlineUsers.values()));
    });

    // Admin: toggle bots
    socket.on("admin_start_bots", () => {
      const u = getUser(socket);
      if (!u?.isAdmin) return;
      startBots(io, ADMIN_USERNAME);
      socket.emit("bots_status", { enabled: true });
    });

    socket.on("admin_stop_bots", () => {
      const u = getUser(socket);
      if (!u?.isAdmin) return;
      stopBots(io);
      io.emit("bots_status", { enabled: false });
    });

    socket.on("get_test_report", () => {
      socket.emit("bot_test_report", getTestResults());
    });

    socket.on("get_bots_status", () => {
      socket.emit("bots_status", { enabled: areBotsEnabled() });
    });

    socket.on("disconnect", () => {
      const u = getUser(socket);
      onlineUsers.delete(socket.id);
      io.emit("online_users", Array.from(onlineUsers.values()));

      for (const [key] of typingTimers) {
        if (key.startsWith(socket.id + ":")) {
          clearTimeout(typingTimers.get(key)!);
          typingTimers.delete(key);
        }
      }

      if (u) {
        const leaveMsg: WireMessage = {
          id: generateId(),
          username: "__system__",
          text: `${u.username} opuścił(a) czat`,
          timestamp: new Date().toISOString(),
        };
        db.insert(globalMessages)
          .values({ id: leaveMsg.id, username: "__system__", text: leaveMsg.text })
          .catch(() => {});
        io.emit("new_message", leaveMsg);
        logger.info({ username: u.username }, "User disconnected");
      }
    });
  });
}
