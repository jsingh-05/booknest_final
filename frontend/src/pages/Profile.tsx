import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Trophy, Flame, Target, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { setToken } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type HistoryItem = { title: string; author: string; date: string; status: string };

export default function Profile() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftUsername, setDraftUsername] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [createdAt, setCreatedAt] = useState<string>("");
  const [roles, setRoles] = useState<string[]>([]);
  
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [totalBooksCompleted, setTotalBooksCompleted] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [yearCompleted, setYearCompleted] = useState<number>(0);
  const [yearGoal, setYearGoal] = useState<number>(52);
  const [monthPages, setMonthPages] = useState<number>(0);
  const [todayPages, setTodayPages] = useState<number>(0);
  const [todayGoal, setTodayGoal] = useState<number>(30);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const CATEGORIES: Record<string, string[]> = {
    "Genres": [
      "fiction","non-fiction","mystery","sci-fi","fantasy","romance","thriller","historical","biography","self-help",
      "philosophy","poetry","classics","young-adult","children","dystopian","graphic-novel","humor","crime","adventure",
      "literary","horror","urban-fantasy","space-opera","cyberpunk","steampunk","paranormal","magical-realism","mythology","fairy-tale"
    ],
    "Subgenres": [
      "psychological-thriller","cozy-mystery","detective","hard-scifi","epic-fantasy","grimdark","historical-romance","time-travel","alternate-history",
      "sports","medical","legal","political","military","noir","gothic","coming-of-age","satire","campus","pulp"
    ],
    "Themes": [
      "found-family","enemies-to-lovers","slow-burn","redemption","revenge","survival","heist","quest","rebellion","identity",
      "morality","loss","grief","friendship","betrayal","courage","hope","freedom","power","justice"
    ],
    "Formats": [
      "short-stories","novellas","anthologies","graphic","audiobook"
    ],
    "Moods": [
      "dark","whimsical","cozy","uplifting","bittersweet","philosophical","heartwarming","tense","atmospheric","humorous",
      "romantic","chilling","introspective","fast-paced","slow-paced"
    ],
    "Nonfiction": [
      "memoir","history","science","nature","technology","business","economics","psychology","education","travel",
      "true-crime","food","art","music","film","photography","politics","philosophy-nonfiction","religion","spirituality"
    ],
    "Extras": [
      "post-apocalyptic","apocalyptic","superhero","vampire","werewolf","zombie","alien","artificial-intelligence","drones","virtual-reality",
      "multiverse","portal-fantasy","court-intrigue","royalty","school-setting","small-town","big-city","island","desert","winter-setting"
    ]
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await api("/api/auth/me");
        if (!mounted) return;
        const u = me?.user || {};
        setUsername(String(u.username || ""));
        setEmail(String(u.email || ""));
        setCreatedAt(String(u.createdAt || ""));
        setRoles(Array.isArray(u.roles) ? u.roles : []);
        
        setStreak(Number(u?.streak?.current || 0));
        setBestStreak(Number(u?.streak?.best || 0));
        setTotalBooksCompleted(Number(u?.stats?.totalBooksCompleted || 0));
        setScore(Number(u?.stats?.score || 0));
        const prefsArr = Array.isArray(u.preferences) ? u.preferences : [];
        const prefGenres = prefsArr.map((p) => {
          const obj = p as Record<string, unknown>;
          return String(obj?.genre || "");
        }).filter(Boolean);
        setPreferences(prefGenres);
        const dlArr: unknown[] = Array.isArray(u.dislikes) ? u.dislikes : [];
        setDislikes(dlArr.map((d) => {
          const obj = d as Record<string, unknown>;
          return String(obj?.tag || "");
        }).filter(Boolean));

        const completed = await api("/api/books/completed").catch(() => ({ books: [] }));
        const dnf = await api("/api/books/dnf").catch(() => ({ books: [] }));
        type UB = { bookId?: { title?: string; authors?: string[] }; completedAt?: string; dnfAt?: string };
        const compBooks: UB[] = Array.isArray(completed?.books) ? (completed.books as UB[]) : [];
        const dnfBooks: UB[] = Array.isArray(dnf?.books) ? (dnf.books as UB[]) : [];
        const histCompleted: HistoryItem[] = compBooks.map((ub) => ({
          title: ub.bookId?.title || "",
          author: Array.isArray(ub.bookId?.authors) ? ub.bookId!.authors!.join(", ") : "",
          date: ub.completedAt || new Date().toISOString(),
          status: "Complete",
        }));
        const histDNF: HistoryItem[] = dnfBooks.map((ub) => ({
          title: ub.bookId?.title || "",
          author: Array.isArray(ub.bookId?.authors) ? ub.bookId!.authors!.join(", ") : "",
          date: ub.dnfAt || new Date().toISOString(),
          status: "DNF",
        }));
        const hist = [...histCompleted, ...histDNF].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistory(hist);

        const statsResp = await api("/api/books/stats").catch(() => null);
        if (statsResp) {
          setYearCompleted(Number(statsResp?.thisMonth?.booksCompleted || 0));
          setMonthPages(Number(statsResp?.thisMonth?.pagesRead || 0));
          setTodayPages(Number(statsResp?.today?.pagesRead || 0));
          setTodayGoal(Number(statsResp?.today?.goal || 30));
        }
        const yg = Number(me?.user?.stats?.yearGoal ?? 52);
        setYearGoal(yg > 0 ? yg : 52);
      } catch (e) {
        console.warn("Profile load error", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const initials = useMemo(() => {
    const src = username.trim();
    if (!src) return "U";
    const parts = src.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }, [username]);

  const memberSinceText = useMemo(() => {
    if (!createdAt) return "";
    const d = new Date(createdAt);
    const fmt = d.toLocaleString(undefined, { month: "long", year: "numeric" });
    return `Member since ${fmt}`;
  }, [createdAt]);

  const statCards = useMemo(() => ([
    { label: "Books Read", value: totalBooksCompleted, icon: BookOpen, color: "text-primary" },
    { label: "Current Streak", value: `${streak} days`, icon: Flame, color: "text-secondary" },
    { label: "Total Points", value: score, icon: Trophy, color: "text-accent" },
  ]), [totalBooksCompleted, streak, score]);

  

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="animate-fade-in space-y-6">
          {/* Profile Header */}
          <Card className="shadow-elevated">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <Avatar className="h-24 w-24">
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-3xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div className="space-y-2">
                      {editing ? (
                        <>
                          <input className="border rounded px-3 py-2 w-full" value={draftUsername} onChange={(e) => setDraftUsername(e.target.value)} placeholder="Username" />
                          <input className="border rounded px-3 py-2 w-full" value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)} placeholder="Email" />
                        </>
                      ) : (
                        <>
                          <h1 className="text-3xl font-bold mb-1 break-words">{username || "User"}</h1>
                          <p className="text-sm text-muted-foreground break-words">{email}</p>
                          <p className="text-muted-foreground">{memberSinceText}</p>
                        </>
                      )}
                    </div>
                    {editing ? (
                      <div className="flex gap-2">
                        <Button variant="default" onClick={async () => {
                          try {
                            const payload: Record<string, unknown> = {};
                            if (draftUsername && draftUsername !== username) payload.username = draftUsername;
                            if (draftEmail && draftEmail !== email) payload.email = draftEmail;
                            if (Object.keys(payload).length > 0) {
                              const resp = await api(`/api/users/me`, { method: "PATCH", body: JSON.stringify(payload) });
                              const u2 = resp?.user || {};
                              setUsername(String(u2.username || draftUsername || username));
                              setEmail(String(u2.email || draftEmail || email));
                            }
                          } catch (e) { void 0; }
                          setEditing(false);
                        }}>Save</Button>
                        <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setDraftUsername(username || ""); setDraftEmail(email || ""); setEditing(true); }}>Edit Profile</Button>
                        <Button variant="destructive" onClick={async () => {
                          const ok = window.confirm("Delete your profile permanently? This cannot be undone.");
                          if (!ok) return;
                          try {
                            await api(`/api/users/me`, { method: "DELETE" });
                          } catch (e) { void 0; }
                          setToken("");
                          navigate("/login");
                        }}>Delete Profile</Button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {roles.map((r) => (
                      <Badge key={r} variant="secondary">{r}</Badge>
                    ))}
                  </div>

                  <p className="text-muted-foreground">
                    {`Best streak ${bestStreak} • Pages this month ${monthPages}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className="shadow-book">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${stat.color}`} />
                      <p className="text-2xl font-bold mb-1">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Tabs for Content */}
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle>Your Reading Journey</CardTitle>
              <CardDescription>Track your progress and achievements</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="badges" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="history">
                    <BookOpen className="h-4 w-4 mr-2" />
                    History
                  </TabsTrigger>
                  <TabsTrigger value="goals">
                    <Target className="h-4 w-4 mr-2" />
                    Goals
                  </TabsTrigger>
                  <TabsTrigger value="preferences">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Personalize
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="mt-6">
                  <div className="space-y-4">
                    {history.map((book, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-4 p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      >
                        <div className="w-12 h-16 bg-card rounded flex items-center justify-center text-2xl flex-shrink-0">
                          📚
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold">{book.title}</h4>
                          <p className="text-sm text-muted-foreground">{book.author}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(book.date).toLocaleDateString()}
                          </p>
                          <Badge variant="secondary" className="mt-2">{book.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="goals" className="mt-6">
                  <div className="space-y-6">
                    <Card className="bg-gradient-accent">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <Target className="h-12 w-12 mx-auto mb-3" />
                          <h3 className="text-xl font-bold mb-2">Year Reading Goal</h3>
                          <p className="text-3xl font-bold mb-1">{yearCompleted} / {yearGoal}</p>
                          <p className="text-sm opacity-90 mb-4">books completed</p>
                          <div className="w-full bg-background/30 rounded-full h-3 mb-2">
                            <div
                              className="bg-background h-3 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (yearCompleted / (yearGoal || 1)) * 100)}%` }}
                            />
                          </div>
                          <p className="text-sm">{Math.max(0, (yearGoal || 0) - yearCompleted)} more books to reach your goal</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-book">
                      <CardHeader>
                        <CardTitle className="text-lg">Set Yearly Goal</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-3">
                          <input type="number" min={1} className="border rounded px-3 py-2 w-32" value={yearGoal} onChange={(e) => setYearGoal(Number(e.target.value) || 1)} />
                          <Button variant="default" onClick={async () => {
                            try {
                              await api(`/api/users/me`, { method: "PATCH", body: JSON.stringify({ yearGoal }) });
                            } catch (e) { void 0; }
                          }}>Save Goal</Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-book">
                      <CardHeader>
                        <CardTitle className="text-lg">Monthly Goals</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Pages this month</span>
                          <Badge className="bg-success text-success-foreground">{monthPages}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Best streak</span>
                          <Badge variant="secondary">{bestStreak}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Pages today</span>
                          <Badge variant="secondary">{todayPages} / {todayGoal}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="preferences" className="mt-6">
                  <div className="space-y-6">
                    <Card className="shadow-book">
                      <CardHeader>
                        <CardTitle className="text-lg">Craft Your Taste</CardTitle>
                        <CardDescription>Select likes and dislikes. We’ll personalize around them.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {/* Popular Authors from completed history */}
                        <div className="mb-6">
                          <h4 className="font-semibold mb-2">Popular Authors</h4>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(new Map<string, number>(
                              (history || []).reduce((acc, h) => {
                                const a = String(h.author || "").trim();
                                if (!a) return acc;
                                const prev = acc.get(a) || 0;
                                acc.set(a, prev + 1);
                                return acc;
                              }, new Map<string, number>())
                            ).entries())
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 8)
                              .map(([name]) => (
                                <Badge key={name} variant="secondary">{name}</Badge>
                              ))}
                          </div>
                        </div>
                        {Object.entries(CATEGORIES).map(([section, tags]) => (
                          <div key={section} className="mb-6">
                            <h4 className="font-semibold mb-2">{section}</h4>
                            <div className="flex flex-wrap gap-2">
                              {tags.map((t) => {
                                const like = preferences.includes(t);
                                const dislike = dislikes.includes(t);
                                return (
                                  <div key={t} className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreferences((prev) => {
                                          const has = prev.includes(t);
                                          const next = has ? prev.filter((x) => x !== t) : [...prev, t];
                                          // remove from dislikes if added to likes
                                          setDislikes((dprev) => dprev.filter((x) => x !== t));
                                          return next;
                                        });
                                      }}
                                      className={`px-3 py-1.5 rounded-sm text-sm border transition-all ${like ? "bg-primary text-primary-foreground shadow-book" : "bg-muted hover:bg-muted/80"}`}
                                    >
                                      {t}
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Dislike ${t}`}
                                      onClick={() => {
                                        setDislikes((prev) => {
                                          const has = prev.includes(t);
                                          const next = has ? prev.filter((x) => x !== t) : [...prev, t];
                                          // remove from likes if added to dislikes
                                          setPreferences((pprev) => pprev.filter((x) => x !== t));
                                          return next;
                                        });
                                      }}
                                      className={`px-2 py-1.5 rounded-sm text-xs border transition-all ${dislike ? "bg-destructive text-destructive-foreground shadow-book" : "bg-muted hover:bg-muted/80"}`}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        <div className="mt-4 flex items-center gap-3">
                          <Button
                            variant="default"
                            onClick={async () => {
                              try {
                                await api(`/api/users/me`, { method: "PATCH", body: JSON.stringify({ preferences, dislikes }) });
                                toast.success("Personalization saved");
                              } catch (e) { void 0; }
                            }}
                          >
                            Save
                          </Button>
                          <span className="text-sm text-muted-foreground">{preferences.length} likes • {dislikes.length} dislikes</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
