import { Router } from "express";
import { db } from "@workspace/db";
import { dmMessages, messageReactions } from "@workspace/db/schema";
import { and, eq, or, inArray } from "drizzle-orm";

const router = Router();

router.get("/dm/:otherUsername", async (req, res) => {
  try {
    const me = req.query["me"];
    if (typeof me !== "string" || !me.trim()) {
      res.status(400).json({ error: "Missing required query param: me" });
      return;
    }
    const rawLimit = req.query["limit"];
    const limit = typeof rawLimit === "string" && /^\d+$/.test(rawLimit) ? parseInt(rawLimit, 10) : 100;
    const other = req.params["otherUsername"] ?? "";
    const meStr = me.trim();
    const rows = await db.select().from(dmMessages)
      .where(or(
        and(eq(dmMessages.fromUsername, meStr), eq(dmMessages.toUsername, other)),
        and(eq(dmMessages.fromUsername, other), eq(dmMessages.toUsername, meStr)),
      ))
      .orderBy(dmMessages.createdAt)
      .limit(limit);
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
      from: m.fromUsername,
      to: m.toUsername,
      text: m.text,
      imageUrl: m.imageUrl ?? undefined,
      timestamp: m.createdAt.toISOString(),
      reactions: reactionMap[m.id] ?? {},
    })));
  } catch (err) {
    console.error("DM route error:", err);
    res.status(500).json({ error: "Błąd serwera." });
  }
});

export default router;
