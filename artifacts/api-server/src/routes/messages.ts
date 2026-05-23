import { Router } from "express";
import { db } from "@workspace/db";
import { globalMessages, messageReactions } from "@workspace/db/schema";
import { desc, inArray } from "drizzle-orm";

const router = Router();

router.get("/messages", async (req, res) => {
  try {
    const rawLimit = req.query["limit"];
    const limit = typeof rawLimit === "string" && /^\d+$/.test(rawLimit) ? parseInt(rawLimit, 10) : 100;
    const rows = await db.select().from(globalMessages).orderBy(desc(globalMessages.createdAt)).limit(limit);
    rows.reverse();
    const ids = rows.map((r) => r.id);
    const reactions = ids.length
      ? await db.select().from(messageReactions).where(inArray(messageReactions.messageId, ids))
      : [];
    const reactionMap: Record<string, Record<string, string[]>> = {};
    for (const r of reactions) {
      if (!reactionMap[r.messageId]) reactionMap[r.messageId] = {};
      if (!reactionMap[r.messageId][r.emoji]) reactionMap[r.messageId][r.emoji] = [];
      reactionMap[r.messageId][r.emoji].push(r.username);
    }
    res.json(rows.map((m) => ({
      id: m.id,
      username: m.username,
      text: m.text,
      imageUrl: m.imageUrl ?? undefined,
      timestamp: m.createdAt.toISOString(),
      reactions: reactionMap[m.id] ?? {},
    })));
  } catch (err) {
    console.error("Messages route error:", err);
    res.status(500).json({ error: "Błąd serwera." });
  }
});

export default router;
