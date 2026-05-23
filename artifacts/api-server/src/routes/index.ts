import { Router, type IRouter } from "express";
import healthRouter from "./health";
import messagesRouter from "./messages";
import usersRouter from "./users";
import dmRouter from "./dm";
import uploadRouter from "./upload";
import authRouter from "./auth";
import searchRouter from "./search";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(authRouter);
router.use(searchRouter);
router.use(pushRouter);
router.use(healthRouter);
router.use(messagesRouter);
router.use(usersRouter);
router.use(dmRouter);
router.use(uploadRouter);

export default router;
