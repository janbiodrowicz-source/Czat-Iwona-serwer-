import { Router } from "express";
import { onlineUsers } from "../socket";

const router = Router();

router.get("/users/online", (_req, res) => {
  res.json(Array.from(onlineUsers.values()));
});

export default router;
