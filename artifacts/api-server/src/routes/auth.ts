import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { users, sessions } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";

const router = Router();

function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

function sessionExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

router.post("/auth/register", async (req, res) => {
  try {
    const { username, password, deviceId } = req.body as { username?: string; password?: string; deviceId?: string };
    if (!username || !password) {
      res.status(400).json({ error: "Nazwa użytkownika i hasło są wymagane." });
      return;
    }
    const cleanName = String(username).trim().slice(0, 30);
    const cleanPass = String(password);
    if (cleanName.length < 3) {
      res.status(400).json({ error: "Nazwa użytkownika musi mieć co najmniej 3 znaki." });
      return;
    }
    if (cleanPass.length < 6) {
      res.status(400).json({ error: "Hasło musi mieć co najmniej 6 znaków." });
      return;
    }

    // Block multiple accounts from same device
    if (deviceId) {
      const cleanDeviceId = String(deviceId).trim().slice(0, 100);
      const existingDevice = await db.select({ id: users.id }).from(users).where(eq(users.deviceId, cleanDeviceId)).limit(1);
      if (existingDevice.length) {
        res.status(409).json({ error: "Z tego urządzenia zostało już utworzone konto. Zaloguj się na istniejące konto." });
        return;
      }
    }

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, cleanName)).limit(1);
    if (existing.length) {
      res.status(409).json({ error: "Ta nazwa użytkownika jest już zajęta." });
      return;
    }

    const cleanDeviceId = deviceId ? String(deviceId).trim().slice(0, 100) : null;
    const passwordHash = await bcrypt.hash(cleanPass, 10);
    const [user] = await db.insert(users).values({ username: cleanName, passwordHash, deviceId: cleanDeviceId }).returning();

    const token = generateToken();
    await db.insert(sessions).values({ userId: user.id, token, expiresAt: sessionExpiry() });

    res.json({ token, username: user.username, isAdmin: user.isAdmin });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Błąd serwera. Spróbuj ponownie." });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: "Nazwa użytkownika i hasło są wymagane." });
      return;
    }
    const cleanName = String(username).trim();
    const cleanPass = String(password);

    const [user] = await db.select().from(users).where(eq(users.username, cleanName)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Nieprawidłowa nazwa użytkownika lub hasło." });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ error: "Twoje konto zostało zbanowane." });
      return;
    }

    const valid = await bcrypt.compare(cleanPass, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Nieprawidłowa nazwa użytkownika lub hasło." });
      return;
    }

    const token = generateToken();
    await db.insert(sessions).values({ userId: user.id, token, expiresAt: sessionExpiry() });

    res.json({ token, username: user.username, isAdmin: user.isAdmin });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Błąd serwera. Spróbuj ponownie." });
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      await db.delete(sessions).where(eq(sessions.token, token));
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Brak tokenu." }); return; }
    const result = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!result.length) { res.status(401).json({ error: "Sesja wygasła." }); return; }
    const u = result[0].user;
    res.json({ username: u.username, isAdmin: u.isAdmin, avatarUrl: u.avatarUrl });
  } catch {
    res.status(500).json({ error: "Błąd serwera." });
  }
});

export default router;
