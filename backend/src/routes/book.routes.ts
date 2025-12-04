// src/routes/book.routes.ts
import { Router } from "express";
import {
  searchBooks,
  importBookByISBN,
  addCurrentReading,
  updateReadingProgress,
  markBookCompleted,
  markBookDNF,
  getCurrent,
  getCompleted,
  getStats,
  getPlanned,
  getDNF,
  getRecommendations,
} from "../controllers/book.controller";
import authGuard from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/search", searchBooks);         // GET /api/books/search?q=...
router.post("/import", importBookByISBN);   // POST /api/books/import { isbn }

// Protected routes (require authentication)
router.post("/", authGuard, addCurrentReading);                    // POST /api/books
router.patch("/:id/progress", authGuard, updateReadingProgress);   // PATCH /api/books/:id/progress
router.post("/:id/complete", authGuard, markBookCompleted);       // POST /api/books/:id/complete
router.post("/:id/dnf", authGuard, markBookDNF);                  // POST /api/books/:id/dnf
router.get("/current", authGuard, getCurrent);                      // GET /api/books/current
router.get("/completed", authGuard, getCompleted);                 // GET /api/books/completed
router.get("/stats", authGuard, getStats);                          // GET /api/books/stats
router.get("/planned", authGuard, getPlanned);                      // GET /api/books/planned
router.get("/dnf", authGuard, getDNF);                              // GET /api/books/dnf
router.get("/recommendations", authGuard, getRecommendations);      // GET /api/books/recommendations

export default router;
