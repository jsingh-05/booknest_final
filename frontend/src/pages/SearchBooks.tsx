import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

type UiBook = {
  id: string | number;
  title: string;
  author: string;
  year: string | number;
  genre?: string;
  summary: string;
  isbn?: string;
  pageCount?: number;
  coverUrl?: string;
  rating?: number;
  ratingsCount?: number;
};

type RawBook = {
  _id?: unknown;
  title?: unknown;
  authors?: unknown;
  publishedAt?: unknown;
  tags?: unknown;
  description?: unknown;
  isbn?: unknown;
  pageCount?: unknown;
  coverUrl?: unknown;
  thumbnail?: unknown;
};

export default function SearchBooks() {
  const navigate = useNavigate();
  const [selectedBook, setSelectedBook] = useState<UiBook | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UiBook[]>([]);
  const [displayResults, setDisplayResults] = useState<UiBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [genre, setGenre] = useState<string>("all");
  const [yearRange, setYearRange] = useState<string>("all");

  const debounceRef = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await doSearch("");
      } catch (e) {
        console.warn("Initial search failed", e);
      }
    })();
  }, []);

  function handleQueryChange(v: string) {
    setQuery(v);
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      doSearch(v);
    }, 300);
  }

  async function doSearch(q: string) {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const data = await api(`/api/books/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      const merged: RawBook[] = [...(data.local || []), ...(data.external || [])];
      const mapped: UiBook[] = merged.map((b: RawBook, idx: number) => {
        const id = typeof b._id === "string" ? b._id : idx;
        const title = typeof b.title === "string" ? b.title : "";
        const author = Array.isArray(b.authors)
          ? (b.authors as unknown[]).map(String).join(", ")
          : typeof b.authors === "string" ? (b.authors as string) : "";
        const pub = b.publishedAt;
        const year = (typeof pub === "string" || pub instanceof Date) ? new Date(String(pub)).getFullYear() : "";
        const tags = Array.isArray(b.tags) ? (b.tags as unknown[]).map(String) : [];
        const summaryRaw = typeof b.description === "string" ? (b.description as string) : "";
        function genreSlug(srcTags: string[], t: string, d: string) {
          const all = [...srcTags, t, d].map((s) => String(s || "").toLowerCase());
          const pairs: Array<[string, RegExp]> = [
            ["fiction", /\bfiction\b/],
            ["non-fiction", /\bnon[-\s]?fiction\b|\bnonfiction\b/],
            ["mystery", /\bmystery|detective|whodunit\b/],
            ["sci-fi", /\bscience fiction|sci[-\s]?fi|\bsf\b/],
            ["fantasy", /\bfantasy\b/],
            ["romance", /\bromance|love story\b/],
            ["thriller", /\bthriller|suspense\b/],
            ["historical", /\bhistorical\b/],
            ["biography", /\bbiography|memoir\b/],
            ["self-help", /\bself help|self-help\b/],
            ["philosophy", /\bphilosophy\b/],
            ["poetry", /\bpoetry|poems\b/],
            ["classics", /\bclassic|classics\b/],
            ["young-adult", /\byoung adult|\bya\b/],
            ["children", /\bchildren|kids\b/],
            ["dystopian", /\bdystopia|dystopian\b/],
            ["graphic-novel", /\bgraphic novel|comics\b/],
            ["humor", /\bhumor|humour|comedy\b/],
            ["crime", /\bcrime|noir\b/],
            ["adventure", /\badventure\b/],
            ["literary", /\bliterary fiction|litfic|literary\b/],
            ["horror", /\bhorror\b/],
          ];
          for (const [slug, re] of pairs) {
            if (all.some((s) => re.test(s))) return slug;
          }
          return srcTags[0];
        }
        const genre = genreSlug(tags, title, summaryRaw || "");
        const summary = summaryRaw && summaryRaw.trim() ? summaryRaw : "Summary not available.";
        const isbn = typeof b.isbn === "string" ? (b.isbn as string) : undefined;
        const pageCount = typeof b.pageCount === "number" ? (b.pageCount as number) : undefined;
        const existingCover = typeof b.coverUrl === "string" ? (b.coverUrl as string) : (typeof b.thumbnail === "string" ? (b.thumbnail as string) : undefined);
        const coverUrl = existingCover || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : undefined);
        const rb = b as Record<string, unknown>;
        const rating = typeof rb["rating"] === "number" ? (rb["rating"] as number) : undefined;
        const ratingsCount = typeof rb["ratingsCount"] === "number" ? (rb["ratingsCount"] as number) : undefined;
        return { id, title, author, year, genre, summary, isbn, pageCount, coverUrl, rating, ratingsCount };
      });
      const qn = String(q || "").toLowerCase();
      const scored = mapped
        .map((m) => {
          const tn = m.title.toLowerCase();
          const an = m.author.toLowerCase();
          let s = 0;
          if (qn && tn === qn) s += 100;
          else if (qn && tn.includes(qn)) s += 40;
          const parts = qn.split(" ").filter(Boolean);
          for (const p of parts) {
            if (tn.includes(p)) s += 10;
            if (an.includes(p)) s += 8;
          }
          const r = m.rating || 0;
          const rc = m.ratingsCount || 0;
          s += r * 10 + Math.min(rc, 1000) / 50;
          return { m, s };
        })
        .sort((a, b) => b.s - a.s)
        .map((x) => x.m);
      if (mapped.length === 0 && !q) {
        setResults([]);
        setDisplayResults([]);
      } else if (mapped.length === 0 && q) {
        const fallback = await api(`/api/books/search?q=${encodeURIComponent("")}`, { signal: controller.signal }).catch(() => ({ local: [], external: [] }));
        const fraw: RawBook[] = [...(fallback.local || []), ...(fallback.external || [])];
        const fm: UiBook[] = fraw.map((b: RawBook, idx: number) => {
          const id = typeof b._id === "string" ? b._id : idx;
          const title = typeof b.title === "string" ? b.title : "";
          const author = Array.isArray(b.authors)
            ? (b.authors as unknown[]).map(String).join(", ")
            : typeof b.authors === "string" ? (b.authors as string) : "";
          const pub = b.publishedAt;
          const year = (typeof pub === "string" || pub instanceof Date) ? new Date(String(pub)).getFullYear() : "";
          const tags = Array.isArray(b.tags) ? (b.tags as unknown[]).map(String) : [];
          const summaryRaw = typeof b.description === "string" ? (b.description as string) : "";
          function genreSlug(srcTags: string[], t: string, d: string) {
            const all = [...srcTags, t, d].map((s) => String(s || "").toLowerCase());
            const pairs: Array<[string, RegExp]> = [
              ["fiction", /\bfiction\b/],
              ["non-fiction", /\bnon[-\s]?fiction\b|\bnonfiction\b/],
              ["mystery", /\bmystery|detective|whodunit\b/],
              ["sci-fi", /\bscience fiction|sci[-\s]?fi|\bsf\b/],
              ["fantasy", /\bfantasy\b/],
              ["romance", /\bromance|love story\b/],
              ["thriller", /\bthriller|suspense\b/],
              ["historical", /\bhistorical\b/],
              ["biography", /\bbiography|memoir\b/],
              ["self-help", /\bself help|self-help\b/],
              ["philosophy", /\bphilosophy\b/],
              ["poetry", /\bpoetry|poems\b/],
              ["classics", /\bclassic|classics\b/],
              ["young-adult", /\byoung adult|\bya\b/],
              ["children", /\bchildren|kids\b/],
              ["dystopian", /\bdystopia|dystopian\b/],
              ["graphic-novel", /\bgraphic novel|comics\b/],
              ["humor", /\bhumor|humour|comedy\b/],
              ["crime", /\bcrime|noir\b/],
              ["adventure", /\badventure\b/],
              ["literary", /\bliterary fiction|litfic|literary\b/],
              ["horror", /\bhorror\b/],
            ];
            for (const [slug, re] of pairs) {
              if (all.some((s) => re.test(s))) return slug;
            }
            return srcTags[0];
          }
          const genre = genreSlug(tags, title, summaryRaw || "");
          const summary = summaryRaw && summaryRaw.trim() ? summaryRaw : "Summary not available.";
          const isbn = typeof b.isbn === "string" ? (b.isbn as string) : undefined;
          const pageCount = typeof b.pageCount === "number" ? (b.pageCount as number) : undefined;
          const existingCover = typeof b.coverUrl === "string" ? (b.coverUrl as string) : (typeof b.thumbnail === "string" ? (b.thumbnail as string) : undefined);
          const coverUrl = existingCover || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : undefined);
          const rb2 = b as Record<string, unknown>;
          const rating = typeof rb2["rating"] === "number" ? (rb2["rating"] as number) : undefined;
          const ratingsCount = typeof rb2["ratingsCount"] === "number" ? (rb2["ratingsCount"] as number) : undefined;
          return { id, title, author, year, genre, summary, isbn, pageCount, coverUrl, rating, ratingsCount };
        });
        const fqn = String(q || "").toLowerCase();
        const fscored = fm
          .map((m) => {
            const tn = m.title.toLowerCase();
            const an = m.author.toLowerCase();
            let s = 0;
            if (fqn && tn === fqn) s += 100;
            else if (fqn && tn.includes(fqn)) s += 40;
            const parts = fqn.split(" ").filter(Boolean);
            for (const p of parts) {
              if (tn.includes(p)) s += 10;
              if (an.includes(p)) s += 8;
            }
            const r = m.rating || 0;
            const rc = m.ratingsCount || 0;
            s += r * 10 + Math.min(rc, 1000) / 50;
            return { m, s };
          })
          .sort((a, b) => b.s - a.s)
          .map((x) => x.m);
        setResults(fscored);
        setDisplayResults(fscored);
      } else {
        setResults(scored);
        setDisplayResults(scored);
      }
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === "AbortError") {
        return;
      }
      setResults([]);
      setDisplayResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function ensurePageCount(b: UiBook) {
    if (!b.pageCount && b.isbn) {
      try {
        const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${b.isbn}&format=json&jscmd=data`);
        const json = (await res.json()) as Record<string, unknown>;
        const key = `ISBN:${b.isbn}`;
        const entry = json[key] as Record<string, unknown> | undefined;
        const pages = typeof entry?.number_of_pages === "number" ? entry.number_of_pages : undefined;
        if (typeof pages === "number" && pages > 0) {
          return { ...b, pageCount: pages };
        }
      } catch {
        return b;
      }
    }
    return b;
  }

  function applyFilters() {
    let filtered = [...results];
    if (genre !== "all") {
      filtered = filtered.filter((b) => typeof b.genre === "string" && b.genre?.toLowerCase().includes(genre));
    }
    if (yearRange !== "all") {
      filtered = filtered.filter((b) => {
        const y = Number(b.year) || 0;
        if (!y) return false;
        if (yearRange === "2020s") return y >= 2020;
        if (yearRange === "2010s") return y >= 2010 && y < 2020;
        if (yearRange === "2000s") return y >= 2000 && y < 2010;
        if (yearRange === "classic") return y < 2000;
        return true;
      });
    }
    setDisplayResults(filtered);
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Search Books</h1>
          <p className="text-muted-foreground">Discover your next great read</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search and Filters */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-book">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search by title, author, or ISBN..."
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
                  className="w-full"
                />
                <Button className="w-full" onClick={() => doSearch(query)} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? "Searching..." : "Search"}
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-book">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Genre</label>
                  <Select value={genre} onValueChange={(v) => setGenre(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Genres" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genres</SelectItem>
                      <SelectItem value="fiction">Fiction</SelectItem>
                      <SelectItem value="non-fiction">Non-Fiction</SelectItem>
                      <SelectItem value="mystery">Mystery</SelectItem>
                      <SelectItem value="sci-fi">Science Fiction</SelectItem>
                      <SelectItem value="fantasy">Fantasy</SelectItem>
                      <SelectItem value="romance">Romance</SelectItem>
                      <SelectItem value="thriller">Thriller</SelectItem>
                      <SelectItem value="historical">Historical</SelectItem>
                      <SelectItem value="biography">Biography</SelectItem>
                      <SelectItem value="self-help">Self-Help</SelectItem>
                      <SelectItem value="philosophy">Philosophy</SelectItem>
                      <SelectItem value="poetry">Poetry</SelectItem>
                      <SelectItem value="classics">Classics</SelectItem>
                      <SelectItem value="young-adult">Young Adult</SelectItem>
                      <SelectItem value="children">Children</SelectItem>
                      <SelectItem value="dystopian">Dystopian</SelectItem>
                      <SelectItem value="graphic-novel">Graphic Novel</SelectItem>
                      <SelectItem value="humor">Humor</SelectItem>
                      <SelectItem value="crime">Crime</SelectItem>
                      <SelectItem value="adventure">Adventure</SelectItem>
                      <SelectItem value="literary">Literary Fiction</SelectItem>
                      <SelectItem value="horror">Horror</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Publication Year</label>
                  <Select value={yearRange} onValueChange={(v) => setYearRange(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Year</SelectItem>
                      <SelectItem value="2020s">2020s</SelectItem>
                      <SelectItem value="2010s">2010s</SelectItem>
                      <SelectItem value="2000s">2000s</SelectItem>
                      <SelectItem value="classic">Before 2000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  <Button variant="default" className="flex-1" onClick={applyFilters}>
                    Apply Filters
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => { setGenre("all"); setYearRange("all"); setDisplayResults(results); }}>
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results and Details */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedBook ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {displayResults.length} results found
                  </p>
                </div>

                <div className="space-y-4">
                  {displayResults.map((book) => (
                    <Card
                      key={book.id}
                      className="shadow-book hover:shadow-elevated transition-shadow cursor-pointer"
                      onClick={async () => {
                        const withPages = await ensurePageCount(book);
                        setSelectedBook(withPages);
                      }}
                    >
                      <CardContent className="p-6">
                        <div className="flex gap-4">
                          {book.coverUrl ? (
                            <img src={book.coverUrl} alt={book.title} className="flex-shrink-0 w-20 h-28 object-cover rounded-md border" />
                          ) : (
                            <div className="flex-shrink-0 w-20 h-28 bg-muted rounded-md flex items-center justify-center text-3xl">📚</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg mb-1">{book.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              by {book.author} • {book.year}
                            </p>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="secondary">{book.genre}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {book.summary}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <Card className="shadow-elevated">
                <CardHeader>
                    <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {selectedBook.coverUrl ? (
                        <img src={selectedBook.coverUrl} alt={selectedBook.title} className="w-16 h-24 object-cover rounded-md border" />
                      ) : null}
                      <CardTitle className="text-2xl">{selectedBook.title}</CardTitle>
                      <CardDescription className="mt-2">
                        by {selectedBook.author} {selectedBook.year && `• ${selectedBook.year}`}
                      </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => setSelectedBook(null)}>
                      Back to Results
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <Badge>{selectedBook.genre}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mt-6">
                    <div className="prose prose-sm max-w-none">
                      <h3 className="font-semibold mb-3">Book Summary</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {selectedBook.summary}
                      </p>
                    </div>
                    <div className="mt-6 flex gap-3">
                      <Button variant="default" className="flex-1" onClick={async () => {
                        try {
                          await api(`/api/books`, { method: "POST", body: JSON.stringify({ isbn: selectedBook?.isbn, title: selectedBook!.title, authors: selectedBook!.author ? selectedBook!.author.split(", ") : [], pageCount: selectedBook!.pageCount, status: "planned" }) });
                          navigate("/dashboard");
                        } catch (e) { console.warn("Add planned failed", e); }
                      }}>
                        Add to Reading List
                      </Button>
                      <Button variant="accent" className="flex-1" onClick={async () => {
                        try {
                          await api(`/api/books`, { method: "POST", body: JSON.stringify({ isbn: selectedBook?.isbn, title: selectedBook!.title, authors: selectedBook!.author ? selectedBook!.author.split(", ") : [], pageCount: selectedBook!.pageCount, status: "reading" }) });
                          setSelectedBook(null);
                          navigate("/dashboard");
                        } catch (e) { console.warn("Start reading failed", e); }
                      }}>
                        Start Reading
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
