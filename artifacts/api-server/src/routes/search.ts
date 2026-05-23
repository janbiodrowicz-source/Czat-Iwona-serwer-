import { Router } from "express";
import { db } from "@workspace/db";
import { globalMessages, roomMessages, dmMessages, sessions, users } from "@workspace/db/schema";
import { ilike, and, eq, or, gt } from "drizzle-orm";

const router = Router();

async function getUserFromToken(token: string) {
  const result = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return result[0]?.user ?? null;
}

router.get("/search", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await getUserFromToken(token);
    if (!user) { res.status(401).json({ error: "Sesja wygasła." }); return; }

    const q = String(req.query.q ?? "").trim();
    const type = String(req.query.type ?? "global");
    if (!q || q.length < 2) { res.json({ results: [] }); return; }

    const pattern = `%${q}%`;

    if (type === "global") {
      const rows = await db
        .select()
        .from(globalMessages)
        .where(ilike(globalMessages.text, pattern))
        .orderBy(globalMessages.createdAt)
        .limit(50);
      res.json({ results: rows.map(r => ({ id: r.id, username: r.username, text: r.text, imageUrl: r.imageUrl, timestamp: r.createdAt.toISOString(), type: "global" })) });
    } else if (type === "room") {
      const roomId = String(req.query.roomId ?? "");
      if (!roomId) { res.json({ results: [] }); return; }
      const rows = await db
        .select()
        .from(roomMessages)
        .where(and(eq(roomMessages.roomId, roomId), ilike(roomMessages.text, pattern)))
        .orderBy(roomMessages.createdAt)
        .limit(50);
      res.json({ results: rows.map(r => ({ id: r.id, username: r.username, text: r.text, imageUrl: r.imageUrl, timestamp: r.createdAt.toISOString(), type: "room", roomId: r.roomId })) });
    } else if (type === "dm") {
      const partner = String(req.query.partner ?? "");
      if (!partner) { res.json({ results: [] }); return; }
      const rows = await db
        .select()
        .from(dmMessages)
        .where(and(
          ilike(dmMessages.text, pattern),
          or(
            and(eq(dmMessages.fromUsername, user.username), eq(dmMessages.toUsername, partner)),
            and(eq(dmMessages.fromUsername, partner), eq(dmMessages.toUsername, user.username))
          )
        ))
        .orderBy(dmMessages.createdAt)
        .limit(50);
      res.json({ results: rows.map(r => ({ id: r.id, username: r.fromUsername, text: r.text, imageUrl: r.imageUrl, timestamp: r.createdAt.toISOString(), type: "dm" })) });
    } else {
      res.json({ results: [] });
    }
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Błąd wyszukiwania." });
  }
});

export default router;
