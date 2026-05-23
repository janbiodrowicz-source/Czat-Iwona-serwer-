import { pgTable, text, serial, boolean, timestamp, integer, primaryKey, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  isMuted: boolean("is_muted").notNull().default(false),
  deviceId: text("device_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const globalMessages = pgTable("global_messages", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  text: text("text").notNull().default(""),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  creator: text("creator").notNull(),
  type: text("type").notNull().default("public"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const roomMembers = pgTable("room_members", {
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
}, (t) => [primaryKey({ columns: [t.roomId, t.username] })]);

export const roomMessages = pgTable("room_messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  text: text("text").notNull().default(""),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dmMessages = pgTable("dm_messages", {
  id: text("id").primaryKey(),
  fromUsername: text("from_username").notNull(),
  toUsername: text("to_username").notNull(),
  text: text("text").notNull().default(""),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messageReactions = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: text("message_id").notNull(),
  messageType: text("message_type").notNull(),
  username: text("username").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  subscription: jsonb("subscription").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type GlobalMessage = typeof globalMessages.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type RoomMember = typeof roomMembers.$inferSelect;
export type RoomMessage = typeof roomMessages.$inferSelect;
export type DmMessage = typeof dmMessages.$inferSelect;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
