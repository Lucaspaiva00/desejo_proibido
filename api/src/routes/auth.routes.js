// src/routes/auth.routes.js
import { Router } from "express";
import {
    registrar,
    login,
    me,
    forgotPassword,
    resetPassword,
    resendEmailVerification,
    verifyEmail,
    passkeyRegisterOptions,
    passkeyRegisterVerify,
    passkeyLoginOptions,
    passkeyLoginVerify,
} from "../controllers/auth.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/registrar", registrar);
router.post("/login", login);
router.get("/me", auth, me);

// ✅ ESQUECI SENHA
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// ✅ EMAIL VERIFICATION
router.post("/resend-verification", auth, resendEmailVerification);
router.get("/verify-email", verifyEmail);

// ✅ PASSKEY / BIOMETRIA
router.post("/passkeys/register/options", auth, passkeyRegisterOptions);
router.post("/passkeys/register/verify", auth, passkeyRegisterVerify);

router.post("/passkeys/login/options", passkeyLoginOptions);
router.post("/passkeys/login/verify", passkeyLoginVerify);

export default router;