import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, TrendingUp, BookOpen, Flame, Medal } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type ApiLeaderboardEntry = {
  username?: string;
  completed?: number;
  streak?: { current?: number };
  score?: number;
  pages?: number;
};

type Reader = {
  rank: number;
  name: string;
  books?: number;
  streak?: number;
  points?: number;
  badge?: string;
  initials: string;
  pagesRead?: number;
};

type MeUser = { username?: string; stats?: { score?: number }; streak?: { current?: number } } | null;

export default function Leaderboard() {
  const [topReaders, setTopReaders] = useState<Reader[]>([]);
  const [weeklyLeaders, setWeeklyLeaders] = useState<Reader[]>([]);
  const [monthlyLeaders, setMonthlyLeaders] = useState<Reader[]>([]);
  const [me, setMe] = useState<MeUser>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await api("/api/users/leaderboard?range=all");
        const week = await api("/api/users/leaderboard?range=week");
        const month = await api("/api/users/leaderboard?range=month");
        const profile = await api("/api/auth/me").catch(() => null);
        if (!mounted) return;
        setTopReaders((all.data || []).map((r: ApiLeaderboardEntry, i: number) => ({
          rank: i + 1,
          name: r.username,
          books: r.completed,
          streak: r.streak?.current || 0,
          points: r.score,
          badge: i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : undefined,
          initials: r.username?.split(" ").map((p) => p[0]).join("") || "",
        })));
        setWeeklyLeaders((week.data || []).map((r: ApiLeaderboardEntry, i: number) => ({
          rank: i + 1,
          name: r.username,
          pagesRead: r.pages,
          initials: r.username?.split(" ").map((p) => p[0]).join("") || "",
        })));
        setMonthlyLeaders((month.data || []).map((r: ApiLeaderboardEntry, i: number) => ({
          rank: i + 1,
          name: r.username,
          books: r.completed,
          points: r.score,
          initials: r.username?.split(" ").map((p) => p[0]).join("") || "",
        })));
        setMe(profile?.user || null);
      } catch (e) { void 0; }
    })();
    return () => { mounted = false; };
  }, []);

  const getRankColor = (rank: number) => {
    if (rank === 1) return "bg-gradient-accent";
    if (rank === 2) return "bg-muted";
    if (rank === 3) return "bg-secondary/20";
    return "bg-card";
  };

  const getRankBadge = (rank: number) => {
    if (rank <= 3) {
      return (
        <div className={`w-12 h-12 rounded-full ${getRankColor(rank)} flex items-center justify-center text-2xl font-bold shadow-book`}>
          {topReaders[rank - 1].badge}
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center font-bold text-lg">
        {rank}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Trophy className="h-8 w-8 text-accent" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground">Top readers in the community</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-book">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your Rank</p>
                  <p className="text-2xl font-bold">{(() => {
                    if (!me || !topReaders.length) return "-";
                    const idx = topReaders.findIndex((r) => r.name === me.username);
                    return idx >= 0 ? `#${idx + 1}` : "-";
                  })()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-book">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Points</p>
                  <p className="text-2xl font-bold">{me?.stats?.score ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-book">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center">
                  <Flame className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Streak</p>
                  <p className="text-2xl font-bold">{me?.streak?.current ? `${me.streak.current} Days` : "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Medal className="h-5 w-5 text-accent" />
              Rankings
            </CardTitle>
            <CardDescription>See how you stack up against other readers</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all-time" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="all-time">All Time</TabsTrigger>
                <TabsTrigger value="monthly">This Month</TabsTrigger>
                <TabsTrigger value="weekly">This Week</TabsTrigger>
              </TabsList>

              <TabsContent value="all-time" className="space-y-3">
                {topReaders.map((reader, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-4 p-4 rounded-lg transition-all hover:shadow-book ${
                      reader.rank <= 3 ? getRankColor(reader.rank) : "bg-card"
                    }`}
                  >
                    {getRankBadge(reader.rank)}
                    
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        {reader.initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-lg">{reader.name}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {reader.books} books
                        </span>
                        <span className="flex items-center gap-1">
                          <Flame className="h-3 w-3" />
                          {reader.streak} day streak
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold text-black">{reader.points.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">points</p>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="monthly" className="space-y-3">
                {monthlyLeaders.map((reader, index) => (
                  <div key={index} className={`flex items-center gap-4 p-4 rounded-lg ${getRankColor(reader.rank)}`}>
                    {getRankBadge(reader.rank)}
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        {reader.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-lg">{reader.name}</p>
                      <div className="text-sm text-muted-foreground">{reader.books} books</div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-black">{reader.points ?? 0}</p>
                      <p className="text-xs text-muted-foreground">points</p>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="weekly" className="space-y-4">
                <div className="bg-muted p-4 rounded-lg mb-4">
                  <p className="text-sm font-medium mb-2">Weekly Challenge</p>
                  <p className="text-xs text-muted-foreground">
                    Read the most pages this week to top the chart
                  </p>
                </div>

                {weeklyLeaders.map((reader) => (
                  <div
                    key={reader.rank}
                    className={`flex items-center gap-4 p-4 rounded-lg ${getRankColor(reader.rank)}`}
                  >
                    {getRankBadge(reader.rank)}
                    
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        {reader.initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-lg">{reader.name}</p>
                      <p className="text-sm text-muted-foreground">{reader.pagesRead} pages read</p>
                    </div>

                    
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
