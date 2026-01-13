import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { me, setInvisivel } from "../controllers/usuario.controller.js";

const router = Router();

router.get("/me", auth, me);
router.put("/invisivel", auth, setInvisivel);

export default router;
