import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Flame, BookOpen, TrendingUp, ChevronLeft, ChevronRight, Sparkles, Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";

export default function Dashboard() {
  const [currentPages, setCurrentPages] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [streak, setStreak] = useState(0);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState<string[]>([]);
  const [userBookId, setUserBookId] = useState<string | null>(null);
  const [prevPages, setPrevPages] = useState(0);
  const progressPercentage = useMemo(() => totalPages ? Math.min(100, Math.round((currentPages / totalPages) * 100)) : 0, [currentPages, totalPages]);
  const [booksCompleted, setBooksCompleted] = useState(0);
  const [monthPages, setMonthPages] = useState(0);
  const [todayPages, setTodayPages] = useState(0);
  const [todayGoal, setTodayGoal] = useState(30);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState<number>(30);
  type RecommendedItem = { title: string; author: string; coverUrl?: string };
  const [recommended, setRecommended] = useState<RecommendedItem[]>([]);
  const [pagesToAdd, setPagesToAdd] = useState(0);
  const [genresCount, setGenresCount] = useState(0);
  const [totalPagesRead, setTotalPagesRead] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  type ReadingListItem = { userBookId: string; bookId?: string; title: string; authors: string[]; coverUrl?: string };
  const [readingList, setReadingList] = useState<ReadingListItem[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);
  const recoRef = useRef<HTMLDivElement | null>(null);

  const fetchPagesAndCoverFallback = useCallback(async (title: string | undefined, authorsArr: string[] | undefined, isbn?: string) => {
    const valid = (n: number) => Number.isFinite(n) && n >= 20 && n <= 2000;
    const norm = (s: string | undefined) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const tNorm = norm(title);
    const aNorm = norm(Array.isArray(authorsArr) ? authorsArr[0] : undefined);
    let pagesFound = 0;
    let coverFound: string | undefined;

    try {
      if (isbn) {
        const r = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
        const j = await r.json();
        const e = j[`ISBN:${isbn}`];
        const p = typeof e?.number_of_pages === "number" ? e.number_of_pages : 0;
        if (valid(p)) pagesFound = p;
        const olCover = typeof e?.cover?.large === "string" ? e.cover.large : (typeof e?.cover?.medium === "string" ? e.cover.medium : undefined);
        if (olCover) coverFound = olCover;
      }
    } catch { void 0; }

    try {
      if ((!pagesFound || !coverFound) && tNorm) {
        const params = new URLSearchParams();
        params.set("q", tNorm);
        params.set("limit", "10");
        const r2 = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
        const j2 = await r2.json();
        type OLDoc = { title?: string; author_name?: string[]; number_of_pages_median?: number; cover_i?: number };
        const docs: OLDoc[] = Array.isArray(j2.docs) ? (j2.docs as OLDoc[]) : [];
        const scored = docs
          .map((d: OLDoc) => {
            const tn = norm(d.title);
            const an = norm(Array.isArray(d.author_name) ? d.author_name[0] : undefined);
            let s = 0;
            if (tn === tNorm) s += 100; else if (tn.includes(tNorm)) s += 40;
            if (aNorm && an.includes(aNorm)) s += 25;
            const p2 = typeof d.number_of_pages_median === "number" ? d.number_of_pages_median : 0;
            if (valid(p2)) s += Math.min(20, p2 / 50);
            return { d, s } as { d: OLDoc; s: number };
          })
          .sort((x: { d: OLDoc; s: number }, y: { d: OLDoc; s: number }) => y.s - x.s);
        const best: OLDoc | undefined = scored[0]?.d;
        if (best) {
          const p2 = typeof best.number_of_pages_median === "number" ? best.number_of_pages_median : 0;
          if (!pagesFound && valid(p2)) pagesFound = p2;
          const cid = typeof best.cover_i === "number" ? best.cover_i : undefined;
          const c2 = cid ? `https://covers.openlibrary.org/b/id/${cid}-L.jpg` : undefined;
          if (!coverFound && c2) coverFound = c2;
        }
      }
    } catch { void 0; }

    try {
      if ((!pagesFound || !coverFound) && tNorm) {
        const qParts: string[] = [];
        qParts.push(`intitle:${encodeURIComponent(title || "")}`);
        if (aNorm) qParts.push(`inauthor:${encodeURIComponent(Array.isArray(authorsArr) ? authorsArr[0] || "" : "")}`);
        const q = qParts.join("+");
        const g = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5&printType=books`);
        const gj = await g.json();
        type GBItem = { volumeInfo?: { title?: string; authors?: string[]; pageCount?: number; imageLinks?: { thumbnail?: string } } };
        const items: GBItem[] = Array.isArray(gj.items) ? (gj.items as GBItem[]) : [];
        const scored = items.map((it: GBItem) => {
          const vi = it.volumeInfo || {};
          const tn = norm(vi.title);
          const an = norm(Array.isArray(vi.authors) ? vi.authors[0] : undefined);
          let s = 0;
          if (tn === tNorm) s += 100; else if (tn.includes(tNorm)) s += 40;
          if (aNorm && an.includes(aNorm)) s += 25;
          const pc = typeof vi.pageCount === "number" ? vi.pageCount : 0;
          if (valid(pc)) s += Math.min(20, pc / 50);
          return { vi, s } as { vi: NonNullable<GBItem["volumeInfo"]>; s: number };
        }).sort((a: { vi: NonNullable<GBItem["volumeInfo"]>; s: number }, b: { vi: NonNullable<GBItem["volumeInfo"]>; s: number }) => b.s - a.s);
        const best = scored[0]?.vi;
        if (best) {
          const pc = typeof best.pageCount === "number" ? best.pageCount : 0;
          const thumb = typeof best.imageLinks?.thumbnail === "string" ? best.imageLinks.thumbnail : undefined;
          if (!pagesFound && valid(pc)) pagesFound = pc;
          if (!coverFound && thumb) coverFound = thumb.replace("http://", "https://");
        }
      }
    } catch { void 0; }

    if (valid(pagesFound)) setTotalPages(pagesFound);
    if (coverFound && !coverUrl) setCoverUrl(coverFound);
  }, [coverUrl]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api("/books/stats");
        if (!mounted) return;
        setStreak(data.streak?.current || 0);
        setBooksCompleted(data.stats?.totalBooksCompleted || 0);
        setMonthPages(data.thisMonth?.pagesRead || 0);
        setTodayPages(data.today?.pagesRead || 0);
        setTodayGoal(data.today?.goal ?? 30);
        const first = Array.isArray(data.currentBooks) ? data.currentBooks[0] : null;
        if (first) {
          setUserBookId(first.id);
          const b = first.book;
          setTitle(b?.title || "");
          setAuthors(b?.authors || []);
          const cov = b?.coverUrl || (b?.isbn ? `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg` : undefined);
          setCoverUrl(cov);
          setCurrentPages(first.progress?.pagesRead || 0);
          setPrevPages(first.progress?.pagesRead || 0);
          setTotalPages(first.progress?.totalPages || 0);
          if ((!first.progress?.totalPages || first.progress?.totalPages === 0) && b?.isbn) {
            try {
              const resp = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${b.isbn}&format=json&jscmd=data`);
              const json = await resp.json();
              const entry = json[`ISBN:${b.isbn}`];
              const pages = typeof entry?.number_of_pages === "number" ? entry.number_of_pages : 0;
              if (pages > 0) {
                setTotalPages(pages);
              }
            } catch { void 0; }
          }
          if (!first.progress?.totalPages || first.progress?.totalPages === 0) {
            await fetchPagesAndCoverFallback(b?.title, b?.authors, b?.isbn);
          }
          if ((!cov || !cov.trim()) && b?.title) {
            try {
              const params = new URLSearchParams();
              params.set("title", b.title);
              const firstAuthor = Array.isArray(b.authors) ? String(b.authors[0] || "") : String(b.authors || "");
              if (firstAuthor) params.set("author", firstAuthor);
              params.set("limit", "1");
              const resp2 = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
              const js2 = await resp2.json();
              const doc = Array.isArray(js2.docs) ? js2.docs[0] : undefined;
              const coverId = typeof doc?.cover_i === "number" ? doc.cover_i : undefined;
              const pagesMed = typeof doc?.number_of_pages_median === "number" ? doc.number_of_pages_median : 0;
              const thumb = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined;
              if (thumb) setCoverUrl(thumb);
              if ((!first.progress?.totalPages || first.progress?.totalPages === 0) && pagesMed > 0) setTotalPages(pagesMed);
            } catch { void 0; }
          }
        }
        if (!first) {
          const curr = await api("/books/current").catch(() => null);
          const ub = curr?.books?.[0];
          if (ub) {
            setUserBookId(ub._id || ub.id);
            const b = ub.bookId || ub.book;
            setTitle(b?.title || "");
            setAuthors(b?.authors || []);
            const cov2 = b?.coverUrl || (b?.isbn ? `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg` : undefined);
            setCoverUrl(cov2);
            setCurrentPages(ub.totalPagesRead || 0);
            setPrevPages(ub.totalPagesRead || 0);
            setTotalPages(Number(b?.pageCount) || 0);
            if ((!b?.pageCount || Number(b?.pageCount) === 0) && b?.isbn) {
              try {
                const resp = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${b.isbn}&format=json&jscmd=data`);
                const json = await resp.json();
                const entry = json[`ISBN:${b.isbn}`];
                const pages = typeof entry?.number_of_pages === "number" ? entry.number_of_pages : 0;
                if (pages > 0) {
                  setTotalPages(pages);
                }
              } catch { void 0; }
            }
            if (!Number(b?.pageCount)) {
              await fetchPagesAndCoverFallback(b?.title, b?.authors, b?.isbn);
            }
            if ((!cov2 || !String(cov2).trim()) && b?.title) {
              try {
                const params = new URLSearchParams();
                params.set("title", String(b.title));
                const firstAuthor = Array.isArray(b.authors) ? String(b.authors[0] || "") : String(b.authors || "");
                if (firstAuthor) params.set("author", firstAuthor);
                params.set("limit", "1");
                const resp2 = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
                const js2 = await resp2.json();
                const doc = Array.isArray(js2.docs) ? js2.docs[0] : undefined;
                const coverId = typeof doc?.cover_i === "number" ? doc.cover_i : undefined;
                const pagesMed = typeof doc?.number_of_pages_median === "number" ? doc.number_of_pages_median : 0;
                const thumb = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined;
                if (thumb) setCoverUrl(thumb);
                if ((!b?.pageCount || Number(b?.pageCount) === 0) && pagesMed > 0) setTotalPages(pagesMed);
              } catch { void 0; }
            }
          }
        }
        const me = await api("/auth/me").catch(() => null);
        const prefsCount = Array.isArray(me?.user?.preferences) ? me!.user!.preferences!.length : 0;
        const dislikesCount = Array.isArray(me?.user?.dislikes) ? me!.user!.dislikes!.length : 0;
        setHasPersonalization((prefsCount + dislikesCount) > 0);
        if (me?.user?.id) {
          const stats = await api(`/users/${me.user.id}/stats`).catch(() => null);
          if (stats) {
            setGenresCount(stats.stats?.distinctGenresCount || 0);
            setTotalPagesRead(stats.stats?.totalPages || 0);
          }
          const lb = await api(`/users/leaderboard?range=all`).catch(() => null);
          if (lb?.data && Array.isArray(lb.data)) {
            const users = lb.data as Array<{ id?: string; _id?: string; userId?: string }>;
            const idx = users.findIndex((u) => (u.id === me.user.id) || (u._id === me.user.id) || (u.userId === me.user.id));
            if (idx >= 0) setRank(idx + 1);
          }
        }
        const planned = await api(`/books/planned`).catch(() => ({ books: [] }));
        setReadingList(Array.isArray(planned.books) ? planned.books.map((ub) => {
          const auth = ub?.bookId?.authors;
          const authorsList = Array.isArray(auth) ? auth : (typeof auth === "string" ? [auth] : []);
          const isbn = ub?.bookId?.isbn;
          const cov = ub?.bookId?.coverUrl || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : undefined);
          return {
            userBookId: String(ub?._id ?? ""),
            bookId: ub?.bookId?._id ? String(ub.bookId._id) : undefined,
            title: String(ub?.bookId?.title ?? ""),
            authors: authorsList.map(String),
            coverUrl: cov,
          };
        }) : []);
        type RecoItem = { title?: string; authors?: string[] | string; isbn?: string; coverUrl?: string };
        let rec: { items?: RecoItem[] } | null = null;
        const uid = me?.user?.id || me?.user?._id || null;
        if (uid) {
          rec = await api(`/recommend?userId=${encodeURIComponent(uid)}`).catch(() => null);
        }
        if (!rec || !Array.isArray(rec?.items) || (Array.isArray(rec.items) && rec.items.length === 0)) {
          const fallback = await api(`/books/recommendations`).catch(() => ({ recommendations: [] }));
          type RecBook = { title?: string; authors?: string[] | string; isbn?: string; coverUrl?: string; thumbnail?: string };
          const results: RecBook[] = Array.isArray(fallback?.recommendations) ? (fallback.recommendations as RecBook[]).slice(0, 8) : [];
          setRecommended(results.map((b: RecBook) => {
            const auth = b?.authors;
            const author = Array.isArray(auth) ? auth.map(String).join(", ") : (typeof auth === "string" ? auth : "");
            const cover = b?.coverUrl || b?.thumbnail || (b?.isbn ? `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg` : undefined);
            return { title: String(b?.title ?? ""), author, coverUrl: cover };
          }));
        } else {
          setRecommended(rec.items.map((b: RecoItem) => {
            const auth = b?.authors;
            const author = Array.isArray(auth) ? auth.map(String).join(", ") : (typeof auth === "string" ? auth : "");
            const cover = b?.coverUrl || (b?.isbn ? `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg` : undefined);
            return { title: String(b?.title ?? ""), author, coverUrl: cover };
          }));
        }
      } catch (e) { console.warn("Dashboard init failed", e); }
    })();
    return () => { mounted = false; };
  }, [fetchPagesAndCoverFallback]);

  const recommendedBooks = recommended;
  const [hasPersonalization, setHasPersonalization] = useState<boolean>(false);

  

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Welcome Section */}
        <div className="mb-12 animate-fade-in">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-primary bg-clip-text text-transparent">
            Welcome back, Reader! 📚
          </h1>
          <p className="text-lg text-muted-foreground">Continue your reading journey and discover new worlds</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Current Reading Progress */}
            <Card className="shadow-elevated hover:shadow-glow transition-all duration-300 border-primary/20 animate-scale-in">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-3xl mb-2">{title || "Your next adventure awaits!"}</CardTitle>
                    <CardDescription className="text-base">{title ? (authors.length ? `by ${authors.join(", ")}` : "") : "Please add a book to read(go to search-> click the book you want to read->then click on start reading or add to reading list)"}</CardDescription>
                  </div>
                  <div className="w-16 h-20 rounded-lg shadow-book overflow-hidden border">
                    {coverUrl ? (
                      <img src={coverUrl} alt={title || "cover"} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-primary flex items-center justify-center">
                        <BookOpen className="h-8 w-8 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {userBookId ? (<div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Your Progress</span>
                    <span className="font-bold text-primary">{currentPages} / {totalPages || "?"} pages</span>
                  </div>
                  <Progress value={progressPercentage} className="h-3 shadow-sm" />
                  <p className="text-xs text-muted-foreground">
                    {Math.round(progressPercentage)}% complete
                  </p>
                </div>) : (
                  <div className="text-sm text-muted-foreground">Start reading to see your progress here.</div>
                )}

                <div className="flex gap-3 pt-4">
                  <Input
                    type="text"
                    value={String(pagesToAdd || "")}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      const n = v === "" ? 0 : Math.max(0, parseInt(v, 10) || 0);
                      setPagesToAdd(n);
                    }}
                    placeholder="Pages read today"
                    className="flex-1"
                  />
                  <Button className="px-6" onClick={async () => {
                    if (!userBookId || pagesToAdd <= 0) return;
                    try {
                      await api(`/books/${userBookId}/progress`, { method: "PATCH", body: JSON.stringify({ pages: pagesToAdd }) });
                      const refreshed = await api("/books/stats");
                      const updated = Array.isArray(refreshed.currentBooks) ? refreshed.currentBooks[0] : null;
                      if (updated) {
                        setCurrentPages(updated.progress?.pagesRead || currentPages + pagesToAdd);
                        setPrevPages(updated.progress?.pagesRead || currentPages + pagesToAdd);
                        setTotalPages(updated.progress?.totalPages || totalPages);
                        setStreak(refreshed.streak?.current || streak);
                        setTodayPages(refreshed.today?.pagesRead || todayPages + pagesToAdd);
                        setBooksCompleted(refreshed.stats?.totalBooksCompleted || booksCompleted);
                      }
                    } catch (e) { console.warn("Update progress failed", e); }
                    setPagesToAdd(0);
                  }}>Update Progress</Button>
                  <Button
                    variant="secondary"
                    className={`px-6 ${(!userBookId) ? "opacity-50" : ""}`}
                    disabled={!userBookId}
                    onClick={async () => {
                      if (!userBookId) return;
                      try {
                        await api(`/books/${userBookId}/complete`, { method: "POST" });
                        const refreshed = await api("/books/stats");
                        setBooksCompleted(refreshed.stats?.totalBooksCompleted || booksCompleted + 1);
                        const first = Array.isArray(refreshed.currentBooks) ? refreshed.currentBooks[0] : null;
                        if (first) {
                          setUserBookId(first.id);
                          const b = first.book;
                          setTitle(b?.title || "");
                          setAuthors(b?.authors || []);
                          const cov = b?.coverUrl || (b?.isbn ? `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg` : undefined);
                          setCoverUrl(cov);
                          setCurrentPages(first.progress?.pagesRead || 0);
                          setPrevPages(first.progress?.pagesRead || 0);
                          setTotalPages(first.progress?.totalPages || 0);
                        } else {
                          setUserBookId(null);
                          setCurrentPages(0);
                          setPrevPages(0);
                          setTotalPages(0);
                        }
                        const plannedAfter = await api(`/books/planned`).catch(() => ({ books: [] }));
                        setReadingList(Array.isArray(plannedAfter.books) ? plannedAfter.books.map((ub) => {
                          const auth = ub?.bookId?.authors;
                          const authorsList = Array.isArray(auth) ? auth : (typeof auth === "string" ? [auth] : []);
                          const isbn = ub?.bookId?.isbn;
                          const cov = ub?.bookId?.coverUrl || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : undefined);
                          return {
                            userBookId: String(ub?._id ?? ""),
                            bookId: ub?.bookId?._id ? String(ub.bookId._id) : undefined,
                            title: String(ub?.bookId?.title ?? ""),
                            authors: authorsList.map(String),
                            coverUrl: cov,
                          };
                        }) : []);
                      } catch (e) { console.warn("Mark complete failed", e); }
                    }}
                  >
                    Mark Complete
                  </Button>
                  <Button
                    variant="outline"
                    className={`px-6 ${(!userBookId) ? "opacity-50" : ""}`}
                    disabled={!userBookId}
                    onClick={async () => {
                      if (!userBookId) return;
                      try {
                        await api(`/books/${userBookId}/dnf`, { method: "POST" });
                        const refreshed = await api("/books/stats");
                        const first = Array.isArray(refreshed.currentBooks) ? refreshed.currentBooks[0] : null;
                        if (first) {
                          setUserBookId(first.id);
                          const b = first.book;
                          setTitle(b?.title || "");
                          setAuthors(b?.authors || []);
                          const cov = b?.coverUrl || (b?.isbn ? `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg` : undefined);
                          setCoverUrl(cov);
                          setCurrentPages(first.progress?.pagesRead || 0);
                          setPrevPages(first.progress?.pagesRead || 0);
                          setTotalPages(first.progress?.totalPages || 0);
                        } else {
                          setUserBookId(null);
                          setCurrentPages(0);
                          setPrevPages(0);
                          setTotalPages(0);
                        }
                        const plannedAfter = await api(`/books/planned`).catch(() => ({ books: [] }));
                        setReadingList(Array.isArray(plannedAfter.books) ? plannedAfter.books.map((ub) => {
                          const auth = ub?.bookId?.authors;
                          const authorsList = Array.isArray(auth) ? auth : (typeof auth === "string" ? [auth] : []);
                          const isbn = ub?.bookId?.isbn;
                          const cov = ub?.bookId?.coverUrl || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : undefined);
                          return {
                            userBookId: String(ub?._id ?? ""),
                            bookId: ub?.bookId?._id ? String(ub.bookId._id) : undefined,
                            title: String(ub?.bookId?.title ?? ""),
                            authors: authorsList.map(String),
                            coverUrl: cov,
                          };
                        }) : []);
                      } catch (e) { console.warn("Mark DNF failed", e); }
                    }}
                  >
                    DNF
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="shadow-book hover:shadow-elevated transition-all duration-300 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent animate-fade-in">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    Books Read
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-primary mb-1">{booksCompleted}</div>
                  <p className="text-xs text-muted-foreground">completed</p>
                </CardContent>
              </Card>

              <Card className="shadow-book hover:shadow-elevated transition-all duration-300 border-accent/30 bg-gradient-to-br from-accent/5 to-transparent animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    Pages Read (Month)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-accent mb-1">{monthPages}</div>
                  <p className="text-xs text-muted-foreground">this month</p>
                </CardContent>
              </Card>

              <Card className="shadow-book hover:shadow-elevated transition-all duration-300 border-secondary/30 bg-gradient-to-br from-secondary/5 to-transparent animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-4xl font-bold text-secondary mb-1">{todayPages}</div>
                      <p className="text-xs text-muted-foreground">pages read today</p>
                      <p className="text-xs text-muted-foreground">Goal: {todayGoal} pages</p>
                    </div>
                    
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Book Recommendations Carousel */}
            <Card className="shadow-elevated border-primary/20 animate-scale-in" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Recommended For You
                    </CardTitle>
                    <CardDescription className="mt-1">Curated picks based on your reading journey</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {!hasPersonalization && recommendedBooks.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                      <p>Tell us your likes and dislikes to receive tailored recommendations.</p>
                      <p className="mt-2">Icon on top right corner → user profile → Personalize → enter your likes and dislikes</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-6 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory" ref={recoRef}>
                        {recommendedBooks.map((book, index) => (
                          <div
                            key={index}
                            className="flex-shrink-0 w-44 snap-start group cursor-pointer animate-fade-in"
                            style={{ animationDelay: `${0.4 + index * 0.1}s` }}
                          >
                            <div className="rounded-lg h-60 flex items-center justify-center hover:shadow-elevated group-hover:scale-105 transition-all duration-300 shadow-book overflow-hidden">
                              {book.coverUrl ? (
                                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="bg-gradient-primary w-full h-full flex items-center justify-center text-6xl">📚</div>
                              )}
                            </div>
                            <div className="mt-4">
                              <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                                {book.title}
                              </h4>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{book.author}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-center gap-2 mt-4">
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => {
                          const el = recoRef.current; if (!el) return; el.scrollBy({ left: -300, behavior: 'smooth' });
                        }}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => {
                          const el = recoRef.current; if (!el) return; el.scrollBy({ left: 300, behavior: 'smooth' });
                        }}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Streak Counter */}
            <Card className="shadow-elevated border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5 animate-scale-in hover:shadow-glow transition-all duration-300">
              <CardContent className="pt-8 pb-8">
                <div className="text-center">
                  <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-gradient-accent flex items-center justify-center shadow-glow">
                    <Flame className="h-10 w-10 text-accent-foreground animate-pulse" />
                  </div>
                  <div className="text-5xl font-bold mb-2 text-accent">{streak}</div>
                  <p className="text-lg font-semibold mb-1">Day Streak</p>
                  <p className="text-sm text-muted-foreground">Keep it up! 🔥</p>
                </div>
              </CardContent>
            </Card>

            {/* Today's Goal */}
            <Card className="shadow-book border-success/20 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Check className="h-5 w-5 text-success" />
                    Today's Goal
                  </CardTitle>
                  <Button variant="secondary" size="sm" onClick={() => { setGoalInput(todayGoal || 30); setEditingGoal(true); }}>Edit Goal</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingGoal && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={String(goalInput)}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10) || 0;
                        setGoalInput(Math.max(1, v));
                      }}
                      className="w-24"
                    />
                    <Button size="sm" onClick={async () => {
                      try {
                        await api(`/users/me/goal`, { method: "PATCH", body: JSON.stringify({ dailyGoal: goalInput }) });
                        const refreshed = await api(`/books/stats`);
                        setTodayGoal(refreshed.today?.goal ?? goalInput);
                        setEditingGoal(false);
                      } catch (e) { setEditingGoal(false); }
                    }}>Save</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingGoal(false)}>Cancel</Button>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pages Goal</span>
                    <span className="font-bold text-success">{todayPages} / {todayGoal}</span>
                  </div>
                  <Progress value={todayGoal ? Math.min(100, Math.round((todayPages / todayGoal) * 100)) : 0} className="h-2" />
                </div>
                <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-center">
                  <span className="text-sm font-semibold text-success">{todayPages >= todayGoal ? "Goal Completed! 🎉" : "Keep going!"}</span>
                </div>
              </CardContent>
            </Card>

            

            {/* Quick Stats */}
            <Card className="shadow-book animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                
                <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-secondary" />
                    <span className="text-sm">Distinct Genres</span>
                  </div>
                  <span className="font-bold">{genresCount}</span>
                </div>
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    <span className="text-sm">Total Pages</span>
                  </div>
                  <span className="font-bold">{totalPagesRead}</span>
                </div>
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    <span className="text-sm">Leaderboard Rank</span>
                  </div>
                  <Badge variant="secondary">{rank ? `#${rank}` : "—"}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Reading List */}
            <Card className="shadow-book animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Reading List</CardTitle>
              </CardHeader>
              <CardContent>
                {(!userBookId && readingList.length === 0) ? (
                  <p className="text-sm text-muted-foreground">Your next adventure awaits! Please add a book to read (go to Search → click the book you want to read → then click on Start Reading or Add to Reading List)</p>
                ) : readingList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Your saved books will appear here</p>
                ) : (
                  <div className="space-y-3">
                    {readingList.map((b) => (
                      <div key={b.userBookId} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {b.coverUrl && <img src={b.coverUrl} alt={b.title} className="w-10 h-14 object-cover rounded" />}
                          <div>
                            <div className="text-sm font-semibold">{b.title}</div>
                            <div className="text-xs text-muted-foreground">{Array.isArray(b.authors) ? b.authors.join(", ") : b.authors}</div>
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={async () => {
                          try {
                            await api(`/books`, { method: "POST", body: JSON.stringify({ bookId: b.bookId, status: "reading" }) });
                            const refreshed = await api("/books/stats");
                            const first = Array.isArray(refreshed.currentBooks) ? refreshed.currentBooks[0] : null;
                            if (first) {
                              setUserBookId(first.id);
                              const bb = first.book;
                          setTitle(bb?.title || "The Great Gatsby");
                          setAuthors(bb?.authors || []);
                          const cov = bb?.coverUrl || (bb?.isbn ? `https://covers.openlibrary.org/b/isbn/${bb.isbn}-L.jpg` : undefined);
                          setCoverUrl(cov);
                          setCurrentPages(first.progress?.pagesRead || 0);
                          setPrevPages(first.progress?.pagesRead || 0);
                          setTotalPages(first.progress?.totalPages || 0);
                        }
                        const plannedAfter = await api(`/books/planned`).catch(() => ({ books: [] }));
                        setReadingList(Array.isArray(plannedAfter.books) ? plannedAfter.books.map((ub) => {
                          const auth = ub?.bookId?.authors;
                          const authorsList = Array.isArray(auth) ? auth : (typeof auth === "string" ? [auth] : []);
                          const isbn = ub?.bookId?.isbn;
                          const cov = ub?.bookId?.coverUrl || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : undefined);
                          return {
                            userBookId: String(ub?._id ?? ""),
                            bookId: ub?.bookId?._id ? String(ub.bookId._id) : undefined,
                            title: String(ub?.bookId?.title ?? ""),
                            authors: authorsList.map(String),
                            coverUrl: cov,
                          };
                        }) : []);
                      } catch (e) { console.warn("Start reading from list failed", e); }
                    }}>Start</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
