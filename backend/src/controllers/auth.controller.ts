import { Request, Response } from "express";
import { createUser, verifyUserPassword, signJwt, findUserById } from "../services/auth.service";

export async function register(req: Request, res: Response) {
  try {
    const { email, password, username, preferences, dislikes } = req.body;

    // Validation
    if (!email || !password || !username) {
      return res.status(400).json({ 
        message: "email, username, and password are required" 
      });
    }

    // Email format validation (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Username validation (alphanumeric + underscore, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        message: "Username must be 3-20 characters, alphanumeric and underscores only" 
      });
    }

    // Password validation (min 6 chars)
    if (password.length < 6) {
      return res.status(400).json({ 
        message: "Password must be at least 6 characters" 
      });
    }

    try {
      const user = await createUser({ 
        email, 
        password, 
        username, 
        preferences: preferences || [],
        dislikes: dislikes || [],
      });

      // Generate JWT token
      const token = signJwt(user);

      // Return user data (exclude passwordHash)
      return res.status(201).json({ 
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          preferences: user.preferences,
          dislikes: user.dislikes,
        }
      });
    } catch (error: any) {
      // Handle specific errors from service
      if (error.code === "USER_EXISTS") {
        return res.status(409).json({ message: "Email already registered" });
      }
      if (error.code === "USERNAME_EXISTS") {
        return res.status(409).json({ message: "Username already taken" });
      }
      throw error;
    }
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ message: "Unable to register user" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await verifyUserPassword(email, password);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = signJwt(user);

    // Return user data (exclude passwordHash)
    return res.json({ 
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        preferences: user.preferences,
        dislikes: user.dislikes,
        stats: user.stats,
        streak: user.streak,
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Unable to login" });
  }
}

export async function me(req: Request, res: Response) {
  try {
    // User is attached by authGuard middleware
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return full user profile (exclude passwordHash)
  return res.json({ 
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        preferences: user.preferences,
        dislikes: user.dislikes,
        stats: user.stats,
        streak: user.streak,
        roles: user.roles,
        createdAt: user.createdAt,
      }
    });
  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({ message: "Unable to fetch user data" });
  }
}

// Keep profile for backward compatibility (same as me)
export async function profile(req: Request, res: Response) {
  return me(req, res);
}
