import { UserModel } from "../models/user.model";
import { UserBookModel } from "../models/userBook.model";
import { searchGoogleBooks, searchOpenLibrary } from "./book.service";
import { Types } from "mongoose";
import { getCache } from "./cache";

type Candidate = { id?: string; title: string; authors?: string[]; coverUrl?: string; pageCount?: number; categories?: string[] };

function normalizeVolume(v: any): Candidate {
  const info = v.volumeInfo || v || {};
  return {
    id: v.id || info.id || info.volumeId || undefined,
    title: info.title || v.title || "",
    authors: info.authors || v.authors || [],
    coverUrl: info.imageLinks?.thumbnail || v.thumbnail || undefined,
    pageCount: info.pageCount || v.pageCount || undefined,
    categories: info.categories || v.tags || [],
  };
}

export async function recommendForUser(userId: string, limit = 12): Promise<Candidate[]> {
  const cache = await getCache();
  const key = `reco:user:${userId}:v2`;
  const cached = await cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  const user = await UserModel.findById(userId).lean();
  if (!user) return [];

  const completed = await UserBookModel.find({ userId: new Types.ObjectId(userId), status: "completed" })
    .populate("bookId")
    .sort({ completedAt: -1 })
    .limit(50)
    .lean();

  const prefWeights: Record<string, number> = {};
  for (const p of user.preferences || []) {
    if (p?.genre) prefWeights[String(p.genre).toLowerCase()] = Number(p.weight || 0.5);
  }
  const disliked = new Set((user.dislikes || []).map((d) => String(d.tag).toLowerCase()));

  const authorCounts = new Map<string, number>();
  for (const ub of completed) {
    const bk: any = ub.bookId;
    const authors: string[] = Array.isArray(bk?.authors) ? bk.authors : [];
    const a = authors[0];
    if (a) authorCounts.set(a, (authorCounts.get(a) || 0) + 1);
  }
  const favAuthors = Array.from(authorCounts.entries()).sort((a, b) => b[1] - a[1]).map(([a]) => a).slice(0, 4);

  // derive genre signals from history if explicit preferences are light
  const genreCounts = new Map<string, number>();
  const considerBooks = completed;
  for (const ub of considerBooks) {
    const bk: any = ub.bookId;
    const cats: string[] = Array.isArray(bk?.tags) ? bk.tags : (Array.isArray(bk?.categories) ? bk.categories : []);
    for (const raw of cats) {
      const g = String(raw || "").toLowerCase();
      if (!g || g.length < 2) continue;
      if (prefWeights[g]) continue; // explicit prefs already capture
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
    }
  }
  const historyTopGenres = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]).map(([g]) => g).slice(0, 4);
  const topGenres = (Object.keys(prefWeights).slice(0, 4).length ? Object.keys(prefWeights).slice(0, 4) : historyTopGenres);
  const pools: Candidate[] = [];

  const genrePromises = topGenres.map(async (g) => {
    const res = await searchGoogleBooks(`subject:${g}`, 12).catch(() => []);
    res.forEach((r: any) => pools.push(normalizeVolume(r)));
  });
  const authorPromises = favAuthors.map(async (a) => {
    const res = await searchGoogleBooks(`inauthor:${a}`, 10).catch(() => []);
    res.forEach((r: any) => pools.push(normalizeVolume(r)));
  });
  await Promise.all([...genrePromises, ...authorPromises]);

  // fallback to OpenLibrary for variety
  if (pools.length < limit) {
    for (const g of topGenres.slice(0, 2)) {
      const ol = await searchOpenLibrary(g, 10).catch(() => []);
      ol.forEach((r: any) => pools.push(normalizeVolume(r)));
    }
  }

  // compute page count profile from history
  const pageCounts: number[] = [];
  for (const ub of completed) {
    const bk: any = ub.bookId;
    const pc = Number(bk?.pageCount || 0);
    if (Number.isFinite(pc) && pc > 0) pageCounts.push(pc);
  }
  const avgPages = pageCounts.length ? Math.round(pageCounts.reduce((a, b) => a + b, 0) / pageCounts.length) : 0;

  // dedupe by title+author
  const seen = new Map<string, Candidate>();
  for (const c of pools) {
    const keyC = `${String(c.title).toLowerCase()}|${(c.authors || []).join(",")}`;
    if (!seen.has(keyC)) seen.set(keyC, c);
  }
  let unique = Array.from(seen.values());

  // exclude current/planned/completed items
  const excludeTitles = new Set<string>();
  const excludeIsbns = new Set<string>();
  for (const ub of completed) {
    const bk: any = ub.bookId;
    const t = String(bk?.title || "").toLowerCase();
    if (t) excludeTitles.add(t);
    const isbn = bk?.isbn ? String(bk.isbn) : "";
    if (isbn) excludeIsbns.add(isbn);
  }
  unique = unique.filter((c) => {
    const t = String(c.title || "").toLowerCase();
    const isbn = (c as any).isbn ? String((c as any).isbn) : "";
    if (isbn && excludeIsbns.has(isbn)) return false;
    if (t && excludeTitles.has(t)) return false;
    return true;
  });

  // filter dislikes
  unique = unique.filter((c) => {
    const cats = (c.categories || []).map((x) => String(x).toLowerCase());
    return !cats.some((t) => disliked.has(t));
  });

  // score
  const scored = unique.map((c) => {
    let score = 0;
    for (const cat of c.categories || []) {
      score += (prefWeights[String(cat).toLowerCase()] || 0) * 2;
    }
    const firstAuthor = (c.authors || [])[0];
    if (firstAuthor && favAuthors.includes(firstAuthor)) score += 2;
    // page count alignment boost
    if (avgPages && avgPages >= 100) {
      const pc = Number(c.pageCount || 0);
      if (pc) {
        const low = Math.max(50, Math.round(avgPages * 0.8));
        const high = Math.round(avgPages * 1.2);
        if (pc >= low && pc <= high) score += 1.5;
      }
    }
    // novelty
    const inHistory = completed.some((h) => {
      const hb: any = h.bookId;
      return String(hb?.title || "").toLowerCase() === String(c.title).toLowerCase();
    });
    if (inHistory) score -= 100;
    return { ...c, score } as any;
  });
  scored.sort((a: any, b: any) => b.score - a.score);
  const out = scored.slice(0, limit);
  await cache.setex(key, 3600, JSON.stringify(out));
  return out;
}

