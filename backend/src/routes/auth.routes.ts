import { Router } from "express";
import { register, login, me, profile } from "../controllers/auth.controller";
import authGuard from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authGuard, me);
router.get("/profile", authGuard, profile); // backward compatibility

export default router;
