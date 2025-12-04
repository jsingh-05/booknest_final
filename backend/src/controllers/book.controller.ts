// src/controllers/book.controller.ts
import { Request, Response } from "express";
import axios from "axios";
import { Types } from "mongoose";
import { searchGoogleBooks, searchOpenLibrary, fetchAndSaveByISBN, upsertBook, fetchPopularBooks } from "../services/book.service";
import { BookModel } from "../models/book.model";
import {
  addCurrentBook,
  addUserBook,
  updateProgress,
  completeBook,
  getCurrentBooks,
  getCompletedBooks,
  getReadingStats,
  getPlannedBooks,
  getDNFBooks,
  dnfBook,
} from "../services/userBook.service";
import { UserModel } from "../models/user.model";
import { recommendForUser } from "../services/recommender.service";

// Search books (existing)
export async function searchBooks(req: Request, res: Response) {
  const q = String(req.query.q || "");
  if (!q) {
    try {
      const subjects = ["subject:fiction", "subject:fantasy", "subject:romance", "subject:mystery", "subject:thriller", "subject:nonfiction"];
      const all: any[] = [];
      for (const s of subjects) {
        const part = await searchGoogleBooks(s, 10).catch(() => []);
        all.push(...part);
      }
      const dedup = new Map<string, any>();
      all.forEach((b) => {
        const key = b.isbn || `${b.title}|${(b.authors || []).join(",")}`;
        if (!dedup.has(key)) dedup.set(key, b);
      });
      const merged = Array.from(dedup.values()).slice(0, 20);
      return res.json({ local: [], external: merged });
    } catch {
      return res.json({ local: [], external: [] });
    }
  }
  const short = q.trim().length < 3;
  let local: any[] = [];
  if (short) {
    const regex = new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    local = await BookModel.find({
      $or: [
        { title: { $regex: regex } },
        { authors: { $elemMatch: { $regex: regex } } },
        { isbn: { $regex: regex } },
      ],
    })
      .limit(10)
      .exec();
  } else {
    local = await BookModel.find({ $text: { $search: q } }).limit(10).exec();
  }
  const extQuery = short ? `intitle:${q}` : q;
  const extGB = await searchGoogleBooks(extQuery, 10).catch(() => []);
  const extOL = await searchOpenLibrary(extQuery, 10).catch(() => []);
  const allExt = [...extGB, ...extOL];

  function norm(s: any) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  const qn = norm(q);
  function score(b: any) {
    const tn = norm(b.title);
    const an = norm(Array.isArray(b.authors) ? b.authors.join(" ") : b.authors);
    let s = 0;
    if (tn === qn) s += 100;
    else if (tn.includes(qn)) s += 40;
    const parts = qn.split(" ").filter(Boolean);
    for (const p of parts) {
      if (tn.includes(p)) s += 10;
      if (an.includes(p)) s += 8;
    }
    const rating = typeof b.rating === "number" ? b.rating : 0;
    const rc = typeof b.ratingsCount === "number" ? b.ratingsCount : 0;
    s += rating * 10 + Math.min(rc, 1000) / 50;
    const year = (() => {
      if (!b.publishedAt) return 0;
      try { return new Date(String(b.publishedAt)).getFullYear() || 0; } catch { return 0; }
    })();
    if (year) s += Math.max(0, Math.min(20, (year - 1950) / 3));
    return s;
  }

  const dedup = new Map<string, any>();
  for (const b of allExt) {
    const key = b.isbn || `${String(b.title || "").toLowerCase()}|${(Array.isArray(b.authors) ? b.authors.join(",") : String(b.authors || "").toLowerCase())}`;
    const existing = dedup.get(key);
    if (!existing) dedup.set(key, b);
    else {
      const keep = score(b) >= score(existing) ? b : existing;
      dedup.set(key, keep);
    }
  }
  const sortedExt = Array.from(dedup.values()).sort((a, b) => score(b) - score(a));
  if ((!local || local.length === 0) && (!sortedExt || sortedExt.length === 0)) {
    const popular = await fetchPopularBooks(20).catch(() => []);
    return res.json({ local: [], external: popular });
  }
  return res.json({ local, external: sortedExt });
}

// Import book by ISBN (existing)
export async function importBookByISBN(req: Request, res: Response) {
  const { isbn } = req.body;
  if (!isbn) return res.status(400).json({ message: "isbn required" });

  const book = await fetchAndSaveByISBN(isbn);
  if (!book) return res.status(404).json({ message: "Book not found" });
  return res.json({ book });
}

// Add book to "currently reading"
export async function addCurrentReading(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { bookId, isbn, title, authors, status, pageCount, coverUrl } = req.body;

    if (!bookId && !isbn && !title) {
      return res.status(400).json({
        message: "Either bookId, isbn, or title is required",
      });
    }

    const desired = status === "planned" ? "planned" : "reading";
    const userBook = await addUserBook(userId, { bookId, isbn, title, authors, pageCount, coverUrl }, desired);
    return res.status(201).json({ userBook });
  } catch (error: any) {
    console.error("Add current reading error:", error);
    return res.status(500).json({ message: error.message || "Failed to add book" });
  }
}

// Update reading progress
export async function updateReadingProgress(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params; // userBookId
    const { pages, durationMinutes } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Book ID is required" });
    }

    // Validate MongoDB ObjectId format
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        message: "Invalid book ID format. Please use the userBook ID from your reading list.",
        hint: "Get your book IDs from GET /api/books/current"
      });
    }

    if (!pages || pages <= 0) {
      return res.status(400).json({ message: "pages must be a positive number" });
    }

    const result = await updateProgress(userId, id, pages, durationMinutes);
    return res.json({ userBook: result.userBook, session: result.session });
  } catch (error: any) {
    console.error("Update progress error:", error);
    if (error.message === "UserBook not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message || "Failed to update progress" });
  }
}

// Mark book as completed
export async function markBookCompleted(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params; // userBookId
    const { rating } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Book ID is required" });
    }

    // Validate MongoDB ObjectId format
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        message: "Invalid book ID format. Please use the userBook ID from your reading list.",
        hint: "Get your book IDs from GET /api/books/current"
      });
    }

    const userBook = await completeBook(userId, id, rating);
    return res.json({ userBook, message: "Book marked as completed" });
  } catch (error: any) {
    console.error("Complete book error:", error);
    if (error.message === "UserBook not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message || "Failed to complete book" });
  }
}

// Mark book as DNF
export async function markBookDNF(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params; // userBookId
    if (!id) {
      return res.status(400).json({ message: "Book ID is required" });
    }
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid book ID format." });
    }

    const updated = await dnfBook(userId, id);
    return res.json({ userBook: updated });
  } catch (error: any) {
    console.error("DNF book error:", error);
    if (error.message === "UserBook not found" || error.message === "Book not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message || "Failed to mark DNF" });
  }
}

// Get current reading books
export async function getCurrent(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userBooks = await getCurrentBooks(userId);
    return res.json({ books: userBooks });
  } catch (error) {
    console.error("Get current books error:", error);
    return res.status(500).json({ message: "Failed to fetch current books" });
  }
}

// Get completed books
export async function getCompleted(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const userBooks = await getCompletedBooks(userId, limit);
    return res.json({ books: userBooks });
  } catch (error) {
    console.error("Get completed books error:", error);
    return res.status(500).json({ message: "Failed to fetch completed books" });
  }
}

export async function getPlanned(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userBooks = await getPlannedBooks(userId);
    return res.json({ books: userBooks });
  } catch (error) {
    console.error("Get planned books error:", error);
    return res.status(500).json({ message: "Failed to fetch planned books" });
  }
}

export async function getDNF(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const limit = parseInt(req.query.limit as string) || 50;
    const userBooks = await getDNFBooks(userId, limit);
    return res.json({ books: userBooks });
  } catch (error) {
    console.error("Get DNF books error:", error);
    return res.status(500).json({ message: "Failed to fetch DNF books" });
  }
}

// Get reading stats for dashboard
export async function getStats(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const stats = await getReadingStats(userId);
    return res.json(stats);
  } catch (error: any) {
    console.error("Get stats error:", error);
    if (error.message === "User not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to fetch reading stats" });
  }
}

// Personalized recommendations
export async function getRecommendations(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

  const user = await UserModel.findById(userId).lean();
  if (!user) return res.status(404).json({ message: "User not found" });

  const prefList: Array<{ genre: string; weight: number }> = Array.isArray(user.preferences)
    ? user.preferences.map((p: any) => ({ genre: String(p?.genre || ""), weight: Number(p?.weight || 0.5) }))
        .filter((p) => p.genre)
    : [];
  const dislikedTags: string[] = Array.isArray(user.dislikes)
    ? user.dislikes.map((d: any) => String(d?.tag || "")).filter(Boolean)
    : [];

    const completed = await getCompletedBooks(userId, 100).catch(() => []);
    const authors: string[] = [];
    const pageCounts: number[] = [];
    for (const ub of completed as any[]) {
      const b = ub?.bookId || ub?.book;
      const auth = b?.authors;
      if (Array.isArray(auth) && auth.length) authors.push(String(auth[0]));
      const pc = Number(b?.pageCount || 0);
      if (Number.isFinite(pc) && pc > 0) pageCounts.push(pc);
    }
    const topAuthor = authors[0];
    const avgPages = pageCounts.length ? Math.round(pageCounts.reduce((a, b) => a + b, 0) / pageCounts.length) : 0;

  const queries: string[] = [];
  // Prefer top-weighted subjects from preferences, excluding dislikes
  const topPrefs = prefList
    .filter((p) => !dislikedTags.includes(p.genre))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map((p) => p.genre);
  for (const g of topPrefs) queries.push(`subject:${g}`);
    // Add author-based search
    if (topAuthor) queries.push(`inauthor:${topAuthor}`);
    // Fallback general query
  if (queries.length === 0) queries.push("subject:fiction");

    const recommenderUrl = (process.env.RECOMMENDER_URL || process.env.RECO_API_URL || "").trim();
    // Prefer internal recommender module
    try {
      const items = await recommendForUser(userId, 24);
      const mapped = (items || []).map((it: any) => ({
        title: String(it?.title || ""),
        authors: Array.isArray(it?.authors) ? it.authors : [],
        pageCount: Number(it?.pageCount || 0) || undefined,
        isbn: undefined,
        description: undefined,
        tags: Array.isArray(it?.categories) ? it.categories : [],
        thumbnail: String(it?.coverUrl || ""),
        source: "recommender",
      })).filter((b: any) => b.title);
      if (mapped.length) return res.json({ recommendations: mapped });
    } catch {}

    const ext: any[] = [];
    for (const q of queries) {
      const part = await searchGoogleBooks(q, 20).catch(() => []);
      ext.push(...part);
    }
    if (ext.length === 0) {
      for (const q of queries) {
        const ol = await searchOpenLibrary(q, 20).catch(() => []);
        ext.push(...ol);
      }
    }
  // Filter by similar page count window if available
  let filtered = ext;
  if (avgPages && avgPages >= 100) {
      const low = Math.max(50, Math.round(avgPages * 0.8));
      const high = Math.round(avgPages * 1.2);
      filtered = ext.filter((b) => {
        const pc = Number(b?.pageCount || 0);
        return pc && pc >= low && pc <= high;
      });
      // If filtering got too few results, fall back to original
      if (filtered.length < 10) filtered = ext;
    }

  // Remove items tagged with dislikes when we have tags data
  if (dislikedTags.length) {
    filtered = filtered.filter((b: any) => {
      const tags = Array.isArray(b?.tags) ? b.tags.map(String) : [];
      return !tags.some((t: string) => dislikedTags.includes(String(t).toLowerCase()));
    });
  }

  // Deduplicate
  const dedup = new Map<string, any>();
    filtered.forEach((b) => {
      const key = b.isbn || `${String(b.title || "").toLowerCase()}|${(Array.isArray(b.authors) ? b.authors.join(",") : String(b.authors || "").toLowerCase())}`;
      if (!dedup.has(key)) dedup.set(key, b);
    });
    let out = Array.from(dedup.values());
    if (out.length === 0) {
      const olFallback = await searchOpenLibrary("subject:fiction", 24).catch(() => []);
      out = olFallback;
    }
    out = out.slice(0, 24);

    return res.json({ recommendations: out });
  } catch (error) {
    console.error("Get recommendations error:", error);
    return res.status(500).json({ message: "Failed to fetch recommendations" });
  }
}
