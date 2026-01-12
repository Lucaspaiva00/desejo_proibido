import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { feed } from "../controllers/feed.controller.js";

const router = Router();

router.get("/", auth, feed);

export default router;
