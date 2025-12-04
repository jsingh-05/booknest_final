import { Types } from "mongoose";
import { UserBookModel, IUserBook } from "../models/userBook.model";
import { BookModel, IBook } from "../models/book.model";
import { fetchAndSaveByISBN, searchOpenLibraryByTitleAuthor } from "./book.service";
import { ReadingSessionModel, IReadingSession } from "../models/readingSession.model";
import { UserModel, IUser, Genre } from "../models/user.model";
import { upsertBook } from "./book.service";

/**
 * Add a book to user's "currently reading" list
 */
export async function addCurrentBook(
  userId: string,
  bookData: { bookId?: string; isbn?: string; title?: string; authors?: string[]; pageCount?: number; coverUrl?: string }
) {
  let book: IBook | null = null;

  // If bookId provided, use it
  if (bookData.bookId) {
    const bookIdStr = String(bookData.bookId).trim();
    if (bookIdStr) {
      book = await BookModel.findById(bookIdStr).exec();
    }
  }
  // If ISBN provided, fetch/upsert book
  else if (bookData.isbn) {
    const bookPayload: { isbn: string; title: string; authors?: string[] } = {
      isbn: bookData.isbn,
      title: bookData.title || "Unknown Title", // upsertBook requires title
    };
    if (bookData.authors && bookData.authors.length > 0) {
      bookPayload.authors = bookData.authors;
    }
    const externalBook = await upsertBook(bookPayload);
    book = externalBook;
  }
  // If title/authors provided, try to find or create
  else if (bookData.title) {
    book = await BookModel.findOne({
      title: bookData.title,
      authors: bookData.authors || [],
    }).exec();

    if (!book) {
      book = await upsertBook({
        title: bookData.title,
        authors: bookData.authors || [],
        pageCount: bookData.pageCount,
        thumbnail: bookData.coverUrl,
      } as any);
    }
  }

  if (!book) {
    throw new Error("Book not found or could not be created");
  }

  // Check if user already has this book
  const existing = await UserBookModel.findOne({
    userId: new Types.ObjectId(userId),
    bookId: book._id,
  }).exec();

  if (existing) {
    // If it was completed or paused, change to reading
    if (existing.status !== "reading") {
      existing.status = "reading";
      existing.startedAt = existing.startedAt || new Date();
      await existing.save();
    }
    return existing;
  }

  // Create new UserBook entry
  const userBook = new UserBookModel({
    userId: new Types.ObjectId(userId),
    bookId: book._id,
    status: "reading",
    startedAt: new Date(),
    totalPagesRead: 0,
  });

  await userBook.save();

  // Add to user's currentBooks array
  await UserModel.findByIdAndUpdate(userId, {
    $addToSet: { currentBooks: userBook._id },
  }).exec();

  return userBook;
}

export async function addUserBook(
  userId: string,
  bookData: { bookId?: string; isbn?: string; title?: string; authors?: string[]; pageCount?: number; coverUrl?: string },
  status: "planned" | "reading"
) {
  let book: IBook | null = null;
  if (bookData.bookId) {
    const bookIdStr = String(bookData.bookId).trim();
    if (bookIdStr) {
      book = await BookModel.findById(bookIdStr).exec();
    }
  } else if (bookData.isbn) {
    const payload: { isbn: string; title: string; authors?: string[] } = {
      isbn: bookData.isbn!,
      title: bookData.title || "Unknown Title",
    };
    if (bookData.authors && bookData.authors.length > 0) payload.authors = bookData.authors;
    const externalBook = await upsertBook({ ...payload, pageCount: bookData.pageCount, thumbnail: bookData.coverUrl } as any);
    book = externalBook;
  } else if (bookData.title) {
    book = await BookModel.findOne({ title: bookData.title, authors: bookData.authors || [] }).exec();
    if (!book) {
      book = await upsertBook({ title: bookData.title, authors: bookData.authors || [], pageCount: bookData.pageCount, thumbnail: bookData.coverUrl } as any);
    }
  }

  if (!book) throw new Error("Book not found or could not be created");

  const existing = await UserBookModel.findOne({ userId: new Types.ObjectId(userId), bookId: book._id }).exec();
  if (existing) {
    existing.status = status;
    if (status === "reading") existing.startedAt = new Date();
    await existing.save();
    if (status === "reading") {
      await UserBookModel.updateMany(
        { userId: new Types.ObjectId(userId), status: "reading", _id: { $ne: existing._id } },
        { $set: { status: "paused" } }
      ).exec();
      await UserModel.findByIdAndUpdate(userId, { $set: { currentBooks: [existing._id] } }).exec();
    }
    return existing;
  }

  const userBook = new UserBookModel({
    userId: new Types.ObjectId(userId),
    bookId: book._id,
    status,
    startedAt: status === "reading" ? new Date() : undefined,
    totalPagesRead: 0,
  });
  await userBook.save();
  if (status === "reading") {
    await UserBookModel.updateMany(
      { userId: new Types.ObjectId(userId), status: "reading", _id: { $ne: userBook._id } },
      { $set: { status: "paused" } }
    ).exec();
    await UserModel.findByIdAndUpdate(userId, { $set: { currentBooks: [userBook._id] } }).exec();
  }
  return userBook;
}

export async function getPlannedBooks(userId: string) {
  const userBooks = await UserBookModel.find({ userId: new Types.ObjectId(userId), status: "planned" })
    .populate("bookId")
    .sort({ createdAt: -1 })
    .exec();
  return userBooks;
}

export async function getDNFBooks(userId: string, limit = 50) {
  const userBooks = await UserBookModel.find({ userId: new Types.ObjectId(userId), status: "dnf" })
    .populate("bookId")
    .sort({ dnfAt: -1 })
    .limit(limit)
    .exec();
  return userBooks;
}
/**
 * Update reading progress (daily page count)
 */
export async function updateProgress(
  userId: string,
  userBookId: string,
  pages: number,
  durationMinutes?: number
) {
  const userBook = await UserBookModel.findOne({
    _id: userBookId,
    userId: new Types.ObjectId(userId),
  }).exec();

  if (!userBook) {
    throw new Error("UserBook not found");
  }

  if (userBook.status !== "reading") {
    throw new Error("Book is not in reading status");
  }

  // Get book to check page count and genres
  const book = await BookModel.findById(userBook.bookId).exec();
  if (!book) {
    throw new Error("Book not found");
  }

  // Update UserBook total pages
  userBook.totalPagesRead = (userBook.totalPagesRead || 0) + pages;
  await userBook.save();

  // Create reading session log
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const session = new ReadingSessionModel({
    userId: new Types.ObjectId(userId),
    userBookId: userBook._id,
    bookId: book._id,
    date: today,
    pages,
    durationMinutes,
  });
  await session.save();

  // Update user stats and streak
  const user = await UserModel.findById(userId).exec();
  if (user) {
    const genres = book.tags as Genre[];
    await user.touchRead?.(pages, genres);
  }

  return { userBook, session };
}

/**
 * Mark book as completed
 */
export async function completeBook(userId: string, userBookId: string, rating?: number) {
  const userBook = await UserBookModel.findOne({
    _id: userBookId,
    userId: new Types.ObjectId(userId),
  }).exec();

  if (!userBook) {
    throw new Error("UserBook not found");
  }

  // Get book to extract genres for badge/points calculation
  const book = await BookModel.findById(userBook.bookId).exec();
  if (!book) {
    throw new Error("Book not found");
  }

  // Update UserBook
  userBook.status = "completed";
  userBook.completedAt = new Date();
  if (rating !== undefined) {
    userBook.rating = rating;
  }
  await userBook.save();

  // Update user stats
  const user = await UserModel.findById(userId).exec();
  if (user) {
    user.stats.totalBooksCompleted = (user.stats.totalBooksCompleted || 0) + 1;
    
    // Update score (booksCompleted contributes to score)
    user.stats.score =
      (user.stats.totalPages || 0) +
      ((user.streak.current || 0) * 10) +
      ((user.stats.totalBooksCompleted || 0) * 50);

    // Remove from currentBooks array
    user.currentBooks = user.currentBooks?.filter(
      (id) => id.toString() !== userBookId
    ) || [];

    // Update genre preferences based on completed book
    if (book.tags && book.tags.length > 0) {
      const genres = book.tags as Genre[];
      const now = new Date();
      
      genres.forEach((genre) => {
        const existingPref = user.preferences.find((p) => p.genre === genre);
        if (existingPref) {
          // Increase weight slightly for completed books
          existingPref.weight = Math.min(1.0, existingPref.weight + 0.05);
          existingPref.lastUpdated = now;
        } else {
          // Add new preference
          user.preferences.push({
            genre,
            weight: 0.7,
            lastUpdated: now,
          });
        }
      });
    }

    await user.save();
  }

  return userBook;
}

/**
 * Mark book as did-not-finish (DNF)
 */
export async function dnfBook(userId: string, userBookId: string) {
  const userBook = await UserBookModel.findOne({
    _id: userBookId,
    userId: new Types.ObjectId(userId),
  }).exec();

  if (!userBook) {
    throw new Error("UserBook not found");
  }

  const book = await BookModel.findById(userBook.bookId).exec();
  if (!book) {
    throw new Error("Book not found");
  }

  userBook.status = "dnf";
  userBook.dnfAt = new Date();
  await userBook.save();

  const user = await UserModel.findById(userId).exec();
  if (user) {
    // remove from currentBooks array
    user.currentBooks = user.currentBooks?.filter((id) => id.toString() !== userBookId) || [];
    // lower preference weights for genres of DNF book
    if (book.tags && book.tags.length > 0) {
      const genres = book.tags as Genre[];
      const now = new Date();
      if (!Array.isArray(user.preferences)) user.preferences = [] as any;
      genres.forEach((genre) => {
        const existingPref = user.preferences.find((p: any) => String(p.genre).toLowerCase() === String(genre).toLowerCase());
        if (existingPref) {
          existingPref.weight = Math.max(0.05, Number(existingPref.weight || 0.5) - 0.15);
          existingPref.lastUpdated = now;
        } else {
          user.preferences.push({ genre, weight: 0.2, lastUpdated: now } as any);
        }
      });
    }
    await user.save();
  }

  return userBook;
}

/**
 * Get user's currently reading books
 */
export async function getCurrentBooks(userId: string) {
  const userBooks = await UserBookModel.find({
    userId: new Types.ObjectId(userId),
    status: "reading",
  })
    .populate("bookId")
    .sort({ startedAt: -1 })
    .exec();

  return userBooks;
}

/**
 * Get user's completed books
 */
export async function getCompletedBooks(userId: string, limit = 50) {
  const userBooks = await UserBookModel.find({
    userId: new Types.ObjectId(userId),
    status: "completed",
  })
    .populate("bookId")
    .sort({ completedAt: -1 })
    .limit(limit)
    .exec();

  return userBooks;
}

/**
 * Get reading stats for dashboard
 */
export async function getReadingStats(userId: string) {
  const user = await UserModel.findById(userId).exec();
  if (!user) {
    throw new Error("User not found");
  }

  // Get current books with progress
  const currentBooks = await UserBookModel.find({
    userId: new Types.ObjectId(userId),
    status: "reading",
  })
    .populate<{ bookId: IBook }>("bookId")
    .sort({ startedAt: -1 })
    .exec();

  for (const ub of currentBooks) {
    const bk = ub.bookId as IBook;
    if (!bk.pageCount && bk.isbn) {
      try {
        const enriched = await fetchAndSaveByISBN(bk.isbn);
        if (enriched && typeof enriched.pageCount === "number" && enriched.pageCount > 0) {
          const toUpdate = await BookModel.findById(bk._id).exec();
          if (toUpdate) {
          toUpdate.pageCount = enriched.pageCount;
          if (enriched.coverUrl) {
            toUpdate.coverUrl = enriched.coverUrl as string;
          }
          if (enriched.publishedAt) {
            toUpdate.publishedAt = new Date(String(enriched.publishedAt));
          }
          await toUpdate.save();
          // also reflect in the populated object
          (ub.bookId as IBook).pageCount = toUpdate.pageCount;
          if (typeof toUpdate.coverUrl === "string") {
            (ub.bookId as IBook).coverUrl = toUpdate.coverUrl;
          }
          }
        }
      } catch {}
    } else if (!bk.pageCount) {
      try {
        const firstAuthor = Array.isArray(bk.authors) ? bk.authors[0] : (typeof bk.authors === "string" ? bk.authors : undefined);
        const ol = await searchOpenLibraryByTitleAuthor(bk.title, firstAuthor);
        const toUpdate = await BookModel.findById(bk._id).exec();
        if (toUpdate) {
          if (typeof ol.pageCount === "number" && ol.pageCount > 0) {
            toUpdate.pageCount = ol.pageCount;
            (ub.bookId as IBook).pageCount = ol.pageCount;
          }
          if (typeof ol.coverUrl === "string") {
            toUpdate.coverUrl = ol.coverUrl;
            (ub.bookId as IBook).coverUrl = ol.coverUrl;
          }
          if (typeof ol.publishedYear === "number") {
            toUpdate.publishedAt = new Date(ol.publishedYear, 0, 1);
          }
          if (typeof ol.isbn === "string" && !toUpdate.isbn) {
            toUpdate.isbn = ol.isbn;
          }
          await toUpdate.save();
        }
      } catch {}
    }
  }

  // Calculate today's pages
  const today = new Date().toISOString().split("T")[0] as string;
  const todaySession = await ReadingSessionModel.findOne({
    userId: new Types.ObjectId(userId),
    date: today,
  }).exec();

  // Get this month's pages
  const now = new Date();
  const startOfMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfMonth = startOfMonthDate.toISOString().split("T")[0] as string;
  const thisMonthSessions = await ReadingSessionModel.find({
    userId: new Types.ObjectId(userId),
    date: { $gte: startOfMonth },
  }).exec();
  const thisMonthPages = thisMonthSessions.reduce((sum, s) => sum + s.pages, 0);

  // Get this year's books completed
  const startOfYearDate = new Date(now.getFullYear(), 0, 1);
  const thisYearCompleted = await UserBookModel.countDocuments({
    userId: new Types.ObjectId(userId),
    status: "completed",
    completedAt: { $gte: startOfYearDate },
  }).exec();

  return {
    stats: user.stats,
    streak: user.streak,
    currentBooks: currentBooks.map((ub) => ({
      id: ub._id.toString(),
      book: ub.bookId,
      progress: {
        pagesRead: ub.totalPagesRead,
        totalPages: (ub.bookId as IBook).pageCount || 0,
        percentage: (ub.bookId as IBook).pageCount
          ? Math.round((ub.totalPagesRead / (ub.bookId as IBook).pageCount!) * 100)
          : 0,
      },
      startedAt: ub.startedAt,
    })),
    today: {
      pagesRead: todaySession?.pages || 0,
      goal: user.stats.dailyGoal || 30,
      completed: (todaySession?.pages || 0) >= (user.stats.dailyGoal || 30),
    },
    thisMonth: {
      pagesRead: thisMonthPages,
      booksCompleted: thisYearCompleted, // This year, not month - you can adjust
    },
  };
}
