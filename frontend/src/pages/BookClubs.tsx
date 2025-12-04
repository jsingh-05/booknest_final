import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Users, BookOpen, MessageCircle, Calendar, Search, Plus, CheckCircle, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getToken } from "@/lib/api";
import { io } from "socket.io-client";

type Club = {
  _id: string;
  name: string;
  description?: string;
  tags?: string[];
  isPublic: boolean;
  schedule?: string | null;
  currentBook?: {
    title?: string;
    authors?: string[];
    coverUrl?: string;
    totalPages?: number;
  } | null;
  leaderId?: string | null;
  readingSchedule?: { _id: string; title: string; order?: number; dueDate?: string; completed?: boolean }[];
  memberCount: number;
};

type SenderRef = string | { username?: string };
type Message = {
  _id: string;
  clubId: string;
  senderId: SenderRef;
  body: string;
  createdAt: string;
  replies?: Message[];
};
type ClubsResponse = { items: Club[]; total: number };
type CreateClubResponse = { club?: Club };
type SocketOut = { _id: string; clubId: string; user: { _id: string; email?: string }; content: string; createdAt: string };
type MembersResponse = { items: { userId: string; username: string; role: "member" | "leader" }[] };
type ClubDetail = { club: Club; isMember: boolean };

export default function BookClubs() {
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"explore" | "mine" | "invites">("explore");
  const [joined, setJoined] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createTag, setCreateTag] = useState("");
  const [createSchedule, setCreateSchedule] = useState("");
  const [createPublic, setCreatePublic] = useState(true);

  const clubsQ = useQuery<ClubsResponse>({
    queryKey: ["clubs", q, scope, getToken()],
    queryFn: async () => {
      const token = getToken();
      if (!token && scope === "explore") {
        return api(`/clubs/public${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      }
      return api(`/clubs?scope=${scope}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
    },
    enabled: scope !== "invites",
  });

  const invitesQ = useQuery<{ items: { token: string; expiresAt?: string; club: Club }[] }>({
    queryKey: ["clubInvites"],
    queryFn: async () => api(`/clubs/invites`),
    enabled: scope === "invites",
  });

  const myClubsQ = useQuery<ClubsResponse>({
    queryKey: ["clubs", "mine", getToken()],
    queryFn: async () => api(`/clubs?scope=mine`),
    enabled: Boolean(getToken()),
  });

  const meQ = useQuery<{ user: { id: string; email: string; username: string } }>({
    queryKey: ["me", getToken()],
    queryFn: async () => api(`/auth/me`),
    enabled: Boolean(getToken()),
  });

  const leaderClubs = (myClubsQ.data?.items || []).filter((c) => c.leaderId === meQ.data?.user?.id);
  const [showPicker, setShowPicker] = useState(false);

  const [messageText, setMessageText] = useState("");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const messagesQ = useQuery<Message[]>({
    queryKey: ["clubMessages", selectedClub?._id],
    queryFn: async () => (selectedClub ? api(`/clubs/${selectedClub._id}/messages?limit=50`) : []),
    enabled: !!selectedClub,
    retry: false,
  });

  const clubDetailQ = useQuery<ClubDetail>({
    queryKey: ["clubDetail", selectedClub?._id],
    queryFn: async () => (selectedClub ? api(`/clubs/${selectedClub._id}`) : null),
    enabled: !!selectedClub,
  });

  const membersQ = useQuery<MembersResponse>({
    queryKey: ["clubMembers", selectedClub?._id],
    queryFn: async () => (selectedClub ? api(`/clubs/${selectedClub._id}/members`) : { items: [] }),
    enabled: !!selectedClub,
  });

  const joinClub = useMutation<void, Error, void>({
    mutationFn: async () => api(`/clubs/${selectedClub!._id}/join`, { method: "POST" }),
    onSuccess: () => {
      setJoined(true);
      setSelectedClub((prev) => (prev ? { ...prev, memberCount: prev.memberCount + 1 } as Club : prev));
      queryClient.invalidateQueries({ queryKey: ["clubs"] });
      queryClient.invalidateQueries({ queryKey: ["clubMessages", selectedClub!._id] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("already a member")) setJoined(true);
    },
  });

  const postMessage = useMutation<unknown, Error, void>({
    mutationFn: async () =>
      api(`/clubs/${selectedClub!._id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: messageText }),
      }),
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["clubMessages", selectedClub!._id] });
    },
  });

  const postReply = useMutation<unknown, Error, void>({
    mutationFn: async () =>
      api(`/clubs/${selectedClub!._id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: replyText, parentId: replyFor }),
      }),
    onSuccess: () => {
      setReplyText("");
      setReplyFor(null);
      queryClient.invalidateQueries({ queryKey: ["clubMessages", selectedClub!._id] });
    },
  });

  const acceptInvite = useMutation<{ message: string }, Error, { clubId: string; token: string }>({
    mutationFn: async (payload) => api(`/clubs/${payload.clubId}/accept-invite`, { method: "POST", body: JSON.stringify({ token: payload.token }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clubInvites"] });
      queryClient.invalidateQueries({ queryKey: ["clubs"] });
      setJoined(true);
    },
  });

  const setClubBook = useMutation<{ currentBook: Club["currentBook"] }, Error, { title: string; authors?: string[]; coverUrl?: string; totalPages?: number }>({
    mutationFn: async (payload) => api(`/clubs/${selectedClub!._id}/current-book`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clubDetail", selectedClub!._id] });
    },
  });

  const addScheduleItem = useMutation<{ readingSchedule: NonNullable<Club["readingSchedule"]> }, Error, { title: string; order?: number; dueDate?: string }>({
    mutationFn: async (payload) => api(`/clubs/${selectedClub!._id}/schedule`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clubDetail", selectedClub!._id] });
    },
  });

  const toggleScheduleItem = useMutation<{ readingSchedule: NonNullable<Club["readingSchedule"]> }, Error, { itemId: string; completed: boolean }>({
    mutationFn: async (payload) => api(`/clubs/${selectedClub!._id}/schedule/${payload.itemId}`, { method: "PATCH", body: JSON.stringify({ completed: payload.completed }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clubDetail", selectedClub!._id] });
    },
  });

  const deleteScheduleItem = useMutation<{ readingSchedule: NonNullable<Club["readingSchedule"]> }, Error, { itemId: string }>({
    mutationFn: async (payload) => api(`/clubs/${selectedClub!._id}/schedule/${payload.itemId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clubDetail", selectedClub!._id] });
    },
  });

  const addPlanned = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const b = clubDetailQ.data?.club.currentBook;
      if (!b || !b.title) throw new Error("No current book set");
      return api(`/books`, { method: "POST", body: JSON.stringify({ title: b.title, authors: b.authors || [], status: "planned", pageCount: b.totalPages, coverUrl: b.coverUrl }) });
    },
  });

  const addReading = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const b = clubDetailQ.data?.club.currentBook;
      if (!b || !b.title) throw new Error("No current book set");
      return api(`/books`, { method: "POST", body: JSON.stringify({ title: b.title, authors: b.authors || [], pageCount: b.totalPages, coverUrl: b.coverUrl }) });
    },
  });

  const createClub = useMutation<CreateClubResponse, Error, void>({
    mutationFn: async () =>
      api(`/clubs`, {
        method: "POST",
        body: JSON.stringify({
          name: createName,
          description: createDesc,
          isPublic: createPublic,
          tags: createTag ? [createTag] : [],
          schedule: createSchedule || undefined,
        }),
      }),
    onSuccess: (res: CreateClubResponse) => {
      queryClient.invalidateQueries({ queryKey: ["clubs"] });
      setShowCreate(false);
      setCreateName("");
      setCreateDesc("");
      setCreateTag("");
      setCreateSchedule("");
      if (res?.club) {
        setSelectedClub(res.club as Club);
        setJoined(true);
      }
    },
    onError: () => {},
  });

  const SOCKET_BASE = (((import.meta as unknown) as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || "http://localhost:5001/api").replace(/\/api$/, "");
  const [sock, setSock] = useState<ReturnType<typeof io> | null>(null);
  const [joinedLive, setJoinedLive] = useState(false);

  useEffect(() => {
    if (!selectedClub) return;
    const s = io(SOCKET_BASE, { path: "/socket.io", auth: { token: getToken() } });
    setSock(s);
    s.on("connect", () => {
      s.emit("join_club", { clubId: selectedClub._id }, (ack: { ok: boolean }) => {
        if (ack?.ok) setJoinedLive(true);
      });
    });
    s.on("new_message", (out: SocketOut) => {
      const uname = out.user?.email ? out.user.email : "Member";
      const next: Message = { _id: out._id, clubId: out.clubId, senderId: { username: uname }, body: out.content, createdAt: out.createdAt };
      queryClient.setQueryData<Message[]>(["clubMessages", selectedClub._id], (prev) => {
        const arr = Array.isArray(prev) ? prev.slice() : [];
        arr.push(next);
        return arr;
      });
    });
    return () => {
      s.emit("leave_club", { clubId: selectedClub._id }, () => void 0);
      s.disconnect();
      setSock(null);
      setJoinedLive(false);
    };
  }, [selectedClub, SOCKET_BASE, queryClient]);

  useEffect(() => {
    if (!selectedClub) return;
    const mine = myClubsQ.data?.items || [];
    const isMember = mine.some((c) => c._id === selectedClub._id);
    setJoined(isMember);
  }, [selectedClub, myClubsQ.data]);

  useEffect(() => {
    if (!selectedClub) return;
    if (clubDetailQ.data && typeof clubDetailQ.data.isMember === "boolean") {
      setJoined(clubDetailQ.data.isMember);
    }
  }, [selectedClub, clubDetailQ.data]);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Book Clubs</h1>
          <p className="text-muted-foreground">Join a community and read together</p>
        </div>

        {!selectedClub ? (
          <>
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search book clubs..." className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Button variant="accent" onClick={() => setShowCreate((s) => !s)}>
                <Plus className="h-4 w-4 mr-2" />
                {showCreate ? "Close" : "Create Club"}
              </Button>
            </div>

            <Tabs defaultValue={scope} onValueChange={(v) => setScope(v as "explore" | "mine" | "invites")} className="mb-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="explore">Explore</TabsTrigger>
                <TabsTrigger value="mine">My Clubs</TabsTrigger>
                <TabsTrigger value="invites">Invited Clubs</TabsTrigger>
              </TabsList>
            </Tabs>

            {showCreate && (
              <Card className="mb-6">
                <CardContent className="pt-6 space-y-3">
                  <Input placeholder="Club name" value={createName} onChange={(e) => setCreateName(e.target.value)} />
                  <Input placeholder="Description" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} />
                  <div className="flex gap-3">
                    <Input placeholder="Tag (e.g. Mystery)" value={createTag} onChange={(e) => setCreateTag(e.target.value)} />
                    <Input placeholder="Schedule (e.g. Every Tuesday)" value={createSchedule} onChange={(e) => setCreateSchedule(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm">Public</label>
                    <input type="checkbox" checked={createPublic} onChange={(e) => setCreatePublic(e.target.checked)} />
                  </div>
                  <div className="flex justify-between items-center">
                    {createClub.isError && (
                      <span className="text-sm text-destructive">
                        {(createClub.error as Error).message || "Failed to create club"}
                      </span>
                    )}
                    <Button
                      onClick={() => createClub.mutate()}
                      disabled={!createName.trim() || createClub.isPending}
                    >
                      {createClub.isPending ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scope === "invites" ? (
                invitesQ.isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading invites...</div>
                ) : invitesQ.isError ? (
                  <div className="text-sm text-muted-foreground">Failed to load invites</div>
                ) : (
                  (invitesQ.data?.items || []).map((iv) => (
                    <Card key={`${iv.club._id}_${iv.token}`} className="shadow-book hover:shadow-elevated transition-all cursor-pointer group" onClick={() => setSelectedClub(iv.club)}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="group-hover:text-primary transition-colors">{iv.club.name}</CardTitle>
                            <CardDescription className="mt-2 line-clamp-2">{iv.club.description}</CardDescription>
                          </div>
                          <Users className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Badge>{(iv.club.tags && iv.club.tags[0]) || "General"}</Badge>
                          <span className="text-sm text-muted-foreground">{iv.club.memberCount} members</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              acceptInvite.mutate({ clubId: iv.club._id, token: iv.token });
                            }}
                            variant="accent"
                          >
                            Accept Invite
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )
              ) : (
                <>
                  {clubsQ.isLoading && (
                    <div className="text-sm text-muted-foreground">Loading clubs...</div>
                  )}
                  {clubsQ.isError && (
                    <div className="text-sm text-muted-foreground">
                      {(clubsQ.error as Error)?.message?.includes("Unauthorized")
                        ? "Please login to view clubs"
                        : (clubsQ.error as Error).message || "Failed to load clubs"}
                    </div>
                  )}
                  {(clubsQ.data?.items || []).map((club) => (
                    <Card
                      key={club._id}
                      className="shadow-book hover:shadow-elevated transition-all cursor-pointer group"
                      onClick={() => {
                        setSelectedClub(club);
                        setJoined(false);
                      }}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="group-hover:text-primary transition-colors">
                              {club.name}
                            </CardTitle>
                            <CardDescription className="mt-2 line-clamp-2">
                              {club.description}
                            </CardDescription>
                          </div>
                          <Users className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Badge>{(club.tags && club.tags[0]) || "General"}</Badge>
                          <span className="text-sm text-muted-foreground">{club.memberCount} members</span>
                          {scope === "mine" && (
                            <span className="text-xs px-2 py-1 rounded bg-muted">{club.isPublic ? "Public" : "Private"}</span>
                          )}
                        </div>
                        
                        <div className="bg-muted p-3 rounded-lg">
                          <div className="flex items-start gap-2">
                            <BookOpen className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground">Currently Reading</p>
                              <p className="text-sm font-medium">{club.currentBook?.title || "No book set"}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {club.schedule || "Schedule TBD"}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setSelectedClub(null)}>
                ← Back to All Clubs
              </Button>
              {selectedClub.isPublic && !joined && (
                <Button
                  variant="accent"
                  onClick={() => {
                    if (!getToken()) return alert("Please login to join clubs");
                    joinClub.mutate();
                  }}
                  disabled={joinClub.isPending}
                >
                  {joinClub.isPending ? "Joining..." : "Join Club"}
                </Button>
              )}
            </div>

            <Card className="shadow-elevated">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedClub.name}</CardTitle>
                    <CardDescription className="mt-2">{selectedClub.description}</CardDescription>
                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedClub.memberCount} members</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedClub.schedule || "Schedule TBD"}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-base px-4 py-2">
                    {(selectedClub.tags && selectedClub.tags[0]) || "General"}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="shadow-book">
                  <CardHeader>
                    <CardTitle>Discussions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="recent" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="recent">Recent</TabsTrigger>
                        <TabsTrigger value="members">Members</TabsTrigger>
                      </TabsList>

                      <TabsContent value="recent" className="mt-6 space-y-4">
                        {messagesQ.isLoading ? (
                          <div className="text-sm text-muted-foreground">Loading discussions...</div>
                        ) : messagesQ.isError ? (
                          <div className="text-sm text-muted-foreground">Unable to load discussions.</div>
                        ) : (
                          (messagesQ.data || []).map((m: Message) => {
                            const uname = typeof m.senderId === "string" ? m.senderId : (m.senderId?.username ?? "Member");
                            const initials = uname ? uname.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase() : "U";
                            const time = new Date(m.createdAt).toLocaleString();
                            type SenderPopulated = { _id?: string; username?: string };
                            const senderId = typeof m.senderId === "string"
                              ? m.senderId
                              : ((m.senderId as unknown as SenderPopulated)?._id || "");
                            const canDelete = Boolean(meQ.data?.user?.id) && String(meQ.data!.user!.id) === String(senderId || "");
                            return (
                              <div
                                key={m._id}
                                className="flex gap-3 p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                              >
                                <Avatar>
                                  <AvatarFallback className="bg-primary text-primary-foreground">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-semibold text-sm">{uname}</span>
                                    <span className="text-xs text-muted-foreground">{time}</span>
                                  </div>
                                  <p className="text-sm text-foreground mt-1">{m.body}</p>
                                  <div className="flex gap-2 mt-2">
                                    <Button variant="ghost" size="sm" className="h-8" onClick={() => setReplyFor(m._id)} disabled={!clubDetailQ.data?.isMember}>
                                      <MessageCircle className="h-3 w-3 mr-1" />
                                      Reply
                                    </Button>
                                    {canDelete && (
                                      <Button variant="outline" size="sm" className="h-8" onClick={async () => {
                                        await api(`/clubs/${selectedClub!._id}/messages/${m._id}`, { method: "DELETE" }).catch(() => {});
                                        await queryClient.invalidateQueries({ queryKey: ["clubMessages", selectedClub!._id] });
                                      }}>
                                        Delete
                                      </Button>
                                    )}
                                  </div>
                                  {replyFor === m._id && (
                                    <div className="mt-2 flex gap-2">
                                      <Input placeholder="Write a reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} disabled={!clubDetailQ.data?.isMember} onKeyDown={(e) => { if (e.key === "Enter" && replyText.trim() && clubDetailQ.data?.isMember) postReply.mutate(); }} />
                                      <Button onClick={() => postReply.mutate()} disabled={!clubDetailQ.data?.isMember || !replyText.trim() || postReply.isPending}>{postReply.isPending ? "Sending..." : "Send"}</Button>
                                    </div>
                                  )}
                                  {(m.replies || []).map((r) => {
                                    const runame = typeof r.senderId === "string" ? r.senderId : (r.senderId?.username ?? "Member");
                                    const rSenderId = typeof r.senderId === "string"
                                      ? r.senderId
                                      : ((r.senderId as unknown as SenderPopulated)?._id || "");
                                    const rCanDelete = Boolean(meQ.data?.user?.id) && String(meQ.data!.user!.id) === String(rSenderId || "");
                                    const rinitials = runame ? runame.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase() : "U";
                                    const rtime = new Date(r.createdAt).toLocaleString();
                                    return (
                                      <div key={r._id} className="mt-3 ml-8 p-3 rounded bg-background border">
                                        <div className="flex items-center gap-2">
                                          <Avatar>
                                            <AvatarFallback className="bg-secondary text-secondary-foreground">{rinitials}</AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1">
                                            <div className="flex items-baseline justify-between">
                                              <span className="text-sm font-semibold">{runame}</span>
                                              <span className="text-xs text-muted-foreground">{rtime}</span>
                                            </div>
                                            <p className="text-sm mt-1">{r.body}</p>
                                            {rCanDelete && (
                                              <div className="mt-2">
                                                <Button variant="outline" size="sm" onClick={async () => {
                                                  await api(`/clubs/${selectedClub!._id}/messages/${r._id}`, { method: "DELETE" }).catch(() => {});
                                                  await queryClient.invalidateQueries({ queryKey: ["clubMessages", selectedClub!._id] });
                                                }}>Delete</Button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })
                        )}

                        <div className="pt-4">
                          <div className="flex gap-2">
                            <Input placeholder={clubDetailQ.data?.isMember ? "Join the discussion..." : "Join this club to post"} value={messageText} onChange={(e) => setMessageText(e.target.value)} disabled={!clubDetailQ.data?.isMember} onKeyDown={(e) => {
                              if (e.key === "Enter" && messageText.trim() && clubDetailQ.data?.isMember) {
                                postMessage.mutate();
                              }
                            }} />
                            <Button onClick={() => postMessage.mutate()} disabled={!clubDetailQ.data?.isMember || !messageText.trim() || postMessage.isPending}>{postMessage.isPending ? "Posting..." : "Post"}</Button>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="members" className="mt-6">
                        {membersQ.isLoading ? (
                          <div className="text-sm text-muted-foreground">Loading members...</div>
                        ) : membersQ.isError ? (
                          <div className="text-sm text-muted-foreground">Unable to load members</div>
                        ) : (
                          <div className="space-y-2">
                            {(membersQ.data?.items || []).map((m) => (
                              <div key={m.userId} className="flex items-center justify-between p-3 bg-muted rounded">
                                <div className="flex items-center gap-2">
                                  <Avatar>
                                    <AvatarFallback>{(m.username || "U").slice(0,2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="text-sm font-medium">{m.username}</div>
                                    <div className="text-xs text-muted-foreground">{m.role}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {selectedClub && !selectedClub.isPublic && meQ.data?.user?.id === selectedClub.leaderId && (
                              <div className="pt-4 space-y-2">
                                <div className="text-sm font-medium">Invite Members</div>
                                <InviteForm clubId={selectedClub._id} onInvited={() => queryClient.invalidateQueries({ queryKey: ["clubMembers", selectedClub._id] })} />
                              </div>
                            )}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="shadow-book">
                  <CardHeader>
                    <CardTitle className="text-lg">Current Book</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="w-32 h-44 bg-muted rounded-lg mx-auto mb-4 flex items-center justify-center">
                        {clubDetailQ.data?.club.currentBook?.coverUrl ? (
                          <img src={clubDetailQ.data.club.currentBook.coverUrl} alt={clubDetailQ.data.club.currentBook.title || "Current Book"} className="w-32 h-44 object-cover rounded-md border" />
                        ) : (
                          <span className="text-5xl">📖</span>
                        )}
                      </div>
                      <h3 className="font-bold text-lg mb-2">{clubDetailQ.data?.club.currentBook?.title || "No book set"}</h3>
                      {meQ.data?.user?.id === selectedClub.leaderId ? (
                        <div className="space-y-2">
                          <Button variant="secondary" onClick={() => setShowPicker(true)} className="w-full">Choose Book</Button>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-2">
                          <Button className="flex-1" onClick={() => addPlanned.mutate()} disabled={addPlanned.isPending}>Add to Reading List</Button>
                          <Button className="flex-1" variant="secondary" onClick={() => addReading.mutate()} disabled={addReading.isPending}>Start Reading</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                {showPicker && (
                  <BookPicker
                    open={showPicker}
                    onOpenChange={(v) => setShowPicker(v)}
                    leaderClubs={leaderClubs}
                    defaultClubId={selectedClub._id}
                    afterSet={(clubId) => {
                      if (clubId === selectedClub._id) {
                        queryClient.invalidateQueries({ queryKey: ["clubDetail", selectedClub._id] });
                      }
                    }}
                  />
                )}

                <Card className="shadow-book">
                  <CardHeader>
                    <CardTitle className="text-lg">Reading Schedule</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(clubDetailQ.data?.club.readingSchedule || []).map((it, idx) => (
                      <div key={it._id} className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full ${it.completed ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                          {it.completed ? "✓" : String((it.order ?? idx + 1))}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{it.title}</p>
                          {meQ.data?.user?.id === selectedClub.leaderId && (
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => toggleScheduleItem.mutate({ itemId: it._id, completed: !it.completed })}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {it.completed ? "Mark incomplete" : "Mark complete"}
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => deleteScheduleItem.mutate({ itemId: it._id })}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {meQ.data?.user?.id === selectedClub.leaderId && (
                      <div className="pt-2 flex gap-2">
                        <Input placeholder="Add schedule item (e.g., Chapters 6-10)" value={createSchedule} onChange={(e) => setCreateSchedule(e.target.value)} />
                        <Button onClick={() => { if (createSchedule.trim()) { addScheduleItem.mutate({ title: createSchedule }); setCreateSchedule(""); } }}>
                          Add Item
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function InviteForm({ clubId, onInvited }: { clubId: string; onInvited?: () => void }) {
  const [email, setEmail] = useState("");
  const invite = useMutation<{ token: string; expiresAt?: string }, Error, void>({
    mutationFn: async () => api(`/clubs/${clubId}/invite`, { method: "POST", body: JSON.stringify({ email }) }),
    onSuccess: () => {
      setEmail("");
      if (onInvited) onInvited();
    },
  });
  return (
    <div className="flex gap-2">
      <Input placeholder="Email to invite" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button onClick={() => invite.mutate()} disabled={!email.trim() || invite.isPending}>{invite.isPending ? "Sending..." : "Send Invite"}</Button>
    </div>
  );
}

type PickerBook = { title: string; authors: string[]; coverUrl?: string; totalPages?: number };

function BookPicker({
  open,
  onOpenChange,
  leaderClubs,
  defaultClubId,
  afterSet,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leaderClubs: Club[];
  defaultClubId?: string;
  afterSet?: (clubId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [clubId, setClubId] = useState<string>(defaultClubId || leaderClubs[0]?._id || "");

  async function searchBooks() {
    setLoading(true);
    try {
      const r = await api(`/books/search?q=${encodeURIComponent(query)}`);
      const items = [...(r.local || []), ...(r.external || [])].map((b: Record<string, unknown>) => ({
        title: String(b.title || ""),
        authors: Array.isArray(b.authors) ? (b.authors as unknown[]).map(String) : (b.author ? [String(b.author as string)] : []),
        coverUrl: String((b.coverUrl || b.thumbnail || "") as string),
        totalPages: Number((b.pageCount as number) || 0) || undefined,
      }));
      setResults(items);
    } finally {
      setLoading(false);
    }
  }

  async function setBookForClub(book: PickerBook) {
    if (!clubId) return;
    await api(`/clubs/${clubId}/current-book`, {
      method: "POST",
      body: JSON.stringify(book),
    });
    onOpenChange(false);
    if (afterSet) afterSet(clubId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a Book</DialogTitle>
          <DialogDescription>Search and set the current book for one of your clubs</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={clubId} onValueChange={setClubId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a club" />
            </SelectTrigger>
            <SelectContent>
              {leaderClubs.map((c) => (
                <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input placeholder="Search title, author, or ISBN" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button onClick={searchBooks} disabled={loading}>{loading ? "Searching..." : "Search"}</Button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {results.map((b, i) => (
              <div key={i} className="p-2 border rounded flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{b.title}</div>
                  <div className="text-xs text-muted-foreground">{(b.authors || []).join(", ")}</div>
                </div>
                <Button size="sm" onClick={() => setBookForClub(b)}>Set</Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
