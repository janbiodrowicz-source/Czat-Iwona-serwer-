import { Router } from "express";
import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptions, sessions, users } from "@workspace/db/schema";
import { and, eq, gt } from "drizzle-orm";

const router = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "BMvsNMNlpYmjS1a11AX7snp0bKA1xfNNed1mnqex3bZO9yJheHAs6ogNjL826OYJfJKv3mSV_RyQay8so8dDFUk";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "li2Sj5L73C-VWdphxy_vOnkCSBJNdf96-ldJ1tk-k2Y";
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? "mailto:admin@chatiwona.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post("/push/subscribe", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const result = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!result.length) { res.status(401).json({ error: "Sesja wygasła." }); return; }

    const user = result[0].user;
    const subscription = req.body.subscription;
    if (!subscription?.endpoint) { res.status(400).json({ error: "Nieprawidłowa subskrypcja." }); return; }

    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.username, user.username));
    await db.insert(pushSubscriptions).values({ username: user.username, subscription });

    res.json({ ok: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    res.status(500).json({ error: "Błąd serwera." });
  }
});

export async function sendPushToUser(username: string, payload: object): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.username, username));
    for (const row of subs) {
      try {
        await webpush.sendNotification(row.subscription as webpush.PushSubscription, JSON.stringify(payload));
      } catch (err: unknown) {
        if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
        }
      }
    }
  } catch (err) {
    console.error("Push send error:", err);
  }
}

export default router;
