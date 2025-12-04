// src/services/book.service.ts
import axios from "axios";
import { BookModel, IBook } from "../models/book.model";
import { Types } from "mongoose";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";

const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY;

type ExternalBook = {
  title: string;
  authors?: string[];
  pageCount?: number;
  isbn?: string;
  description?: string;
  tags?: string[];
  publishedAt?: string | Date;
  source?: string;
  thumbnail?: string;
  rating?: number;
  ratingsCount?: number;
};

// Insert a normalized book into your books collection
export async function upsertBook(book: ExternalBook) {
    if (!book.title) {
      throw new Error("Book title is required");
    }
  
    // Prefer ISBN as uniqueness key
    if (book.isbn) {
      const existing = await BookModel.findOne({ isbn: book.isbn }).exec();
      if (existing) return existing;
    } else {
      const query =
        book.authors && book.authors.length
          ? { title: book.title, authors: book.authors }
          : { title: book.title };
      const existing = await BookModel.findOne(query).exec();
      if (existing) return existing;
    }
  
    const authors =
      book.authors && book.authors.length ? book.authors : ["Unknown"];
  
    const payload: any = {
      title: book.title,
      authors,
      description: book.description,
      tags: book.tags || [],
    };
    if (book.isbn) payload.isbn = book.isbn;
    if (typeof book.pageCount === "number") payload.pageCount = book.pageCount;
    if (book.thumbnail) payload.coverUrl = book.thumbnail;
    if (book.publishedAt) payload.publishedAt = new Date(book.publishedAt);

  // Create a Mongoose document instance (avoids TS squiggles)
  const created = new BookModel(payload);
  await created.save();
  return created;
  }
  

/* ---------- Google Books integration (optional) ---------- */
function googleThumbnailFromInfo(info: any): string | undefined {
  if (!info) return undefined;
  return info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? undefined;
}

// Prefer Google thumbnail if available; otherwise fall back to OpenLibrary by ISBN
function buildCoverUrl(isbn?: string, googleThumb?: string): string | undefined {
  if (googleThumb) return googleThumb;
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  return undefined;
}

export async function searchGoogleBooks(query: string, limit = 10) {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("maxResults", String(limit));
  params.set("printType", "books");
  params.set("orderBy", "relevance");
  if (GOOGLE_KEY) params.set("key", GOOGLE_KEY);

  const url = `${GOOGLE_BOOKS_BASE}?${params.toString()}`;
  const res = await axios.get(url);
  const items = res.data.items || [];

  return items.map((it: any) => {
    const info = it.volumeInfo || {};
    const industry = (info.industryIdentifiers || []).find(
      (i: any) => i.type === "ISBN_13" || i.type === "ISBN_10"
    );
    const isbn = industry ? industry.identifier : undefined;
    const thumbnail = buildCoverUrl(isbn, googleThumbnailFromInfo(info))
    return {
      title: info.title,
      authors: info.authors || [],
      pageCount: info.pageCount,
      isbn,
      description: info.description,
      tags: info.categories || [],
      publishedAt: info.publishedDate,
      thumbnail,             // may be undefined if Google has no image
      source: "google",
      rating: info.averageRating,
      ratingsCount: info.ratingsCount,
    } as ExternalBook;
  });
}

export async function searchOpenLibrary(query: string, limit = 10) {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("limit", String(limit));
  const url = `https://openlibrary.org/search.json?${params.toString()}`;
  const res = await axios.get(url);
  const docs = res.data.docs || [];
  return docs.map((d: any) => {
    const title = d.title;
    const authors = Array.isArray(d.author_name) ? d.author_name : [];
    const isbn = Array.isArray(d.isbn) ? d.isbn[0] : undefined;
    const pageCount = typeof d.number_of_pages_median === "number" ? d.number_of_pages_median : undefined;
    const publishedAt = typeof d.first_publish_year === "number" ? String(d.first_publish_year) : undefined;
    const coverId = typeof d.cover_i === "number" ? d.cover_i : undefined;
    const openLibThumb = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined;
    const thumbnail = openLibThumb || buildCoverUrl(isbn, undefined);
    const tags = Array.isArray(d.subject) ? d.subject : [];
    const eb: any = {
      title,
      authors,
      source: "openlibrary",
    };
    if (isbn) eb.isbn = isbn;
    if (typeof pageCount === "number") eb.pageCount = pageCount;
    if (publishedAt) eb.publishedAt = publishedAt;
    if (thumbnail) eb.thumbnail = thumbnail;
    if (tags && tags.length) eb.tags = tags;
    return eb as ExternalBook;
  });
}

export async function searchOpenLibraryByTitleAuthor(title: string, author?: string, limit = 1) {
  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (author) params.set("author", author);
  params.set("limit", String(limit));
  const url = `https://openlibrary.org/search.json?${params.toString()}`;
  const res = await axios.get(url);
  const doc = Array.isArray(res.data.docs) ? res.data.docs[0] : undefined;
  if (!doc) return {} as { pageCount?: number; coverUrl?: string; isbn?: string; publishedYear?: number };
  const coverId = typeof doc.cover_i === "number" ? doc.cover_i : undefined;
  const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined;
  const pageCount = typeof doc.number_of_pages_median === "number" ? doc.number_of_pages_median : undefined;
  const isbn = Array.isArray(doc.isbn) ? doc.isbn[0] : undefined;
  const publishedYear = typeof doc.first_publish_year === "number" ? doc.first_publish_year : undefined;
  const result: any = {};
  if (typeof pageCount === "number") result.pageCount = pageCount;
  if (typeof coverUrl === "string") result.coverUrl = coverUrl;
  if (typeof isbn === "string") result.isbn = isbn;
  if (typeof publishedYear === "number") result.publishedYear = publishedYear;
  return result as { pageCount?: number; coverUrl?: string; isbn?: string; publishedYear?: number };
}

export async function fetchGoogleBookByISBN(isbn: string) {
  const params = new URLSearchParams();
  params.set("q", `isbn:${isbn}`);
  if (GOOGLE_KEY) params.set("key", GOOGLE_KEY);

  const url = `${GOOGLE_BOOKS_BASE}?${params.toString()}`;
  const res = await axios.get(url);
  const item = res.data.items?.[0];
  if (!item) return null;
  const info = item.volumeInfo || {};
  const industry = (info.industryIdentifiers || []).find(
    (i: any) => i.type === "ISBN_13" || i.type === "ISBN_10"
  );
  const foundIsbn = industry ? industry.identifier : undefined;
  const thumbnail = buildCoverUrl(foundIsbn, googleThumbnailFromInfo(info));
  return {
    title: info.title,
    authors: info.authors || [],
    pageCount: info.pageCount,
    isbn: foundIsbn,
    description: info.description,
    tags: info.categories || [],
    publishedAt: info.publishedDate,
    thumbnail, // may be undefined
    source: "google",
    rating: info.averageRating,
    ratingsCount: info.ratingsCount,
  } as ExternalBook;
}

/* ---------- Cascading fetch + save helper ---------- */

export async function fetchAndSaveByISBN(isbn: string) {
  // 1. Try local DB first
  const fromDb = await BookModel.findOne({ isbn }).exec();
  if (fromDb) return fromDb;

  // 3. Try Google Books (if key present)
  if (GOOGLE_KEY) {
    const gb = await fetchGoogleBookByISBN(isbn);
    if (gb) return upsertBook(gb);
  }

  return null;
}

export async function fetchPopularBooks(limit = 20) {
  const subjects = [
    "subject:fiction",
    "subject:nonfiction",
    "subject:mystery",
    "subject:fantasy",
    "subject:romance",
    "subject:thriller",
    "classic",
    "award-winning",
    "bestseller"
  ]; 
  const collected: ExternalBook[] = [];
  for (const s of subjects) {
    try {
      const params = new URLSearchParams();
      params.set("q", s);
      params.set("printType", "books");
      params.set("orderBy", "relevance");
      params.set("maxResults", "40");
      if (GOOGLE_KEY) params.set("key", GOOGLE_KEY);
      const url = `${GOOGLE_BOOKS_BASE}?${params.toString()}`;
      const res = await axios.get(url);
      const items = res.data.items || [];
      for (const it of items) {
        const info = it.volumeInfo || {};
        const industry = (info.industryIdentifiers || []).find((i: any) => i.type === "ISBN_13" || i.type === "ISBN_10");
        const isbn = industry ? industry.identifier : undefined;
        const thumbnail = buildCoverUrl(isbn, googleThumbnailFromInfo(info));
        const eb: ExternalBook = {
          title: info.title,
          authors: info.authors || [],
          pageCount: info.pageCount,
          isbn,
          description: info.description,
          tags: info.categories || [],
          publishedAt: info.publishedDate,
          source: "google",
          rating: info.averageRating,
          ratingsCount: info.ratingsCount,
        };
        if (thumbnail) eb.thumbnail = thumbnail;
        collected.push(eb);
      }
    } catch {}
  }
  const dedup = new Map<string, ExternalBook>();
  collected.forEach((b) => {
    const key = b.isbn || `${b.title}|${(b.authors || []).join(",")}`;
    if (!dedup.has(key)) dedup.set(key, b);
  });
  const sorted = Array.from(dedup.values()).sort((a, b) => {
    const ar = a.rating || 0; const br = b.rating || 0;
    const ac = a.ratingsCount || 0; const bc = b.ratingsCount || 0;
    const ascore = ar * (Math.log10(ac + 1) + 1);
    const bscore = br * (Math.log10(bc + 1) + 1);
    return bscore - ascore;
  });
  return sorted.slice(0, limit);
}
