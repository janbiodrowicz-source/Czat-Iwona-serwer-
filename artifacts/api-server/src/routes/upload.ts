import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { logger } from "../lib/logger";

const UPLOAD_DIR = "/tmp/chat-uploads";

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tylko obrazy są dozwolone (JPEG, PNG, GIF, WebP)."));
    }
  },
});

const router = Router();

router.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Brak pliku." });
    return;
  }
  const url = `/api/uploads/${req.file.filename}`;
  logger.info({ filename: req.file.filename, size: req.file.size }, "Image uploaded");
  res.json({ url });
});

export default router;
