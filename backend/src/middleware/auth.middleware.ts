import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt.config";

// Extend Express Request type to include req.user
declare module "express-serve-static-core" {
  interface Request {
    user?: { 
      _id: string;   // IMPORTANT: add _id for your membership middleware
      id?: string;
      email: string; 
      roles?: string[] 
    };
  }
}

type VerifiedPayload = {
  userId: string;
  email: string;
  roles?: string[];
};

function isVerifiedPayload(payload: Record<string, unknown>): payload is VerifiedPayload {
  return typeof payload.userId === "string" && typeof payload.email === "string";
}

// MAIN AUTH MIDDLEWARE
function authGuard(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Missing authorization header" });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Invalid authorization format. Expected: Bearer <token>",
      received: authHeader.substring(0, 20) + "...",
    });
  }

  const token = authHeader.split(" ")[1]?.trim();

  if (!token) {
    return res.status(401).json({ message: "Token is empty" });
  }

  // JWT must have 3 parts
  if (token.split(".").length !== 3) {
    return res.status(401).json({
      message: "Invalid token format. JWT should have 3 parts.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded !== "object" || decoded === null) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    if (!isVerifiedPayload(decoded)) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const { userId, email, roles } = decoded;

    // IMPORTANT: Provide `_id` for downstream code such as membership check
    req.user = {
      _id: userId,
      id: userId,
      email,
      roles: Array.isArray(roles) ? roles : [],
    };

    return next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    return res.status(401).json({ message: "Unauthorized" });
  }
}

// EXPORTS
export default authGuard;      // default import: import authGuard from "./auth.middleware"
export const requireAuth = authGuard;   // named import: import { requireAuth } from "./auth.middleware"

// Optional auth: parse token if present, otherwise continue without error
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.split(" ")[1]?.trim();
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "object" && decoded !== null && (decoded as any).userId && (decoded as any).email) {
      const { userId, email, roles } = decoded as any;
      req.user = {
        _id: userId,
        id: userId,
        email,
        roles: Array.isArray(roles) ? roles : [],
      };
    }
  } catch {
    // ignore invalid token for optional auth
  }
  return next();
}

// Typed request for your controllers and middlewares
export type AuthRequest = Request & {
  user?: { 
    _id: string; 
    id?: string;
    email: string; 
    roles?: string[] 
  };
  membership?: any;
};
