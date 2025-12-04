import { Link, useLocation } from "react-router-dom";
import { BookOpen, Home, Search, Users, Trophy, User, Menu, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
 
import { useState, useCallback, Dispatch, SetStateAction } from "react";

// Assuming you have Modal and Input components available in your UI library
// Since you provided the code structure using shadcn-like components (Button, Badge, Dropdown), 
// I will simulate a custom modal structure here using standard Tailwind/React elements.

// --- API KEY AND URL REMOVED: The frontend now calls a local proxy endpoint ---
// IMPORTANT: AFTER DEPLOYMENT, REPLACE '/api/gemini-genie' with the FULL PUBLIC URL of your deployed backend proxy (e.g., 'https://your-backend.com/api/gemini-genie')
import { api } from "@/lib/api";

// concept mode removed


/**
 * Custom Modal Component for the Book Genie
 */
const BookGenieModal = ({ isOpen, onClose, embedded = false, text, setText, result, setResult }: { isOpen: boolean, onClose: () => void, embedded?: boolean, text: string, setText: Dispatch<SetStateAction<string>>, result: string, setResult: Dispatch<SetStateAction<string>> }) => {
    const [loading, setLoading] = useState(false);
 

    const handleGenerate = useCallback(async () => {
        setLoading(true);
        setResult('');
        try {
            const txt = text.trim();
            if (!txt) {
                setResult('Paste book text to summarize.');
            } else {
                const js = await api('/api/gemini-genie/summarize-text', {
                    method: 'POST',
                    body: JSON.stringify({ text: txt })
                });
                setResult(js.text || 'No summary generated.');
            }
        } catch {
            setResult('Error generating content.');
        }
        setLoading(false);
    }, [text]);

    if (!isOpen) return null;

    return (
            <div className={embedded ? "" : "fixed inset-0 z-[100] flex items-center justify-center p-4"}>
            <div className={embedded ? "space-y-4" : "bg-card rounded-xl shadow-elevated w-full max-w-lg p-6 space-y-4 animate-stagger-in"}>
                {!embedded && (
                  <div className="flex justify-between items-center border-b pb-2 border-border">
                      <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent flex items-center gap-2">
                          <Wand2 className="h-6 w-6 text-primary" /> 
                          Book Genie
                      </h2>
                      <Button variant="ghost" onClick={onClose} className="text-foreground/70">
                          &times;
                      </Button>
                  </div>
                )}

                


                {/* Input Area */}
                <div className="space-y-3">
                    <textarea
                        placeholder="Paste book text or chapter here to summarize"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className={embedded ? "w-full h-80 p-3 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all" : "w-full min-h-[140px] p-3 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"}
                    />
                    <Button onClick={handleGenerate} disabled={loading || !text.trim()} className="w-full bg-gradient-primary text-primary-foreground shadow-elevated card-lift-hover">
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <span>Summarize</span>
                        )}
                    </Button>
                </div>

                {/* Result Display */}
                {result && (
                    <div className={embedded ? "p-3 bg-muted rounded-lg text-foreground/80 text-sm" : "p-4 bg-muted rounded-lg border-l-4 border-secondary shadow-inner text-foreground/80 font-merriweather italic text-sm"}>
                        <p className="font-semibold not-italic text-sm text-secondary mb-1">Book Analyst's Report:</p>
                        <div className="whitespace-pre-wrap leading-relaxed">{result}</div>
                    </div>
                )}
            </div>
            </div>
    );
};


// Main Navigation Component (Modified)
export const Navigation = () => {
  const location = useLocation();
  const [isGenieOpen, setIsGenieOpen] = useState(false);
  const [genieText, setGenieText] = useState('');
  const [genieResult, setGenieResult] = useState('');

  const isActive = (path: string) => location.pathname === path;
  
  // Modified navItems to handle either path (Link) or action (Button)
  const navItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: Search, label: "Search", path: "/search" },
    { icon: Users, label: "Book Clubs", path: "/clubs" },
    { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
    { icon: Wand2, label: "Genie", action: () => setIsGenieOpen((v) => !v) },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-book">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2 group">
              <div className="relative">
                <BookOpen className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
                <div className="absolute -inset-1 bg-gradient-accent rounded-full opacity-0 group-hover:opacity-20 blur transition-opacity" />
              </div>
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent tracking-wider">
                BookNest
              </span>
            </Link>

            {/* Desktop Navigation - STAGGERED ENTRANCE CONTAINER */}
            <div className="hidden md:flex items-center gap-1 stagger-container">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path || ''); // Check if path exists
                
                // Render Link OR Button based on 'path' or 'action' property
                if (item.path) {
                    return (
                        <Link key={item.path} to={item.path}>
                            <Button
                                // Changed active state styling for stronger vintage look
                                variant="ghost" 
                                className={active ? "bg-primary text-primary-foreground shadow-book" : "card-lift-hover"}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Button>
                        </Link>
                    );
                } else if (item.action) {
                    return (
                        <Button
                            key={item.label}
                            onClick={item.action}
                            variant="ghost"
                            // CHANGED: Added light tertiary background on hover for soft highlight
                            className="card-lift-hover text-secondary hover:bg-tertiary" 
                        >
                            <Icon className="h-4 w-4 mr-1" />
                            {item.label}
                        </Button>
                    );
                }
                return null; // Should not happen
              })}
            </div>

            {/* Right Side Actions - STAGGERED ENTRANCE CONTAINER */}
            <div className="flex items-center gap-2 stagger-container">
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="card-lift-hover">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/login" className="cursor-pointer text-destructive">
                      Logout
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover md:hidden">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.label} asChild>
                        {/* Mobile menu uses the secondary color for rich accent */}
                        {item.path ? (
                            <Link to={item.path} className="cursor-pointer text-secondary hover:bg-secondary/10">
                                <Icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </Link>
                        ) : (
                            <div className="flex items-center p-2 text-secondary hover:bg-secondary/10" onClick={item.action}>
                                <Icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </div>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>
      {isGenieOpen && (
        <div className="fixed right-0 top-0 h-screen w-[360px] md:w-[420px] z-[100]">
          <div className="h-full bg-card border-l border-border shadow-elevated flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                <span className="font-semibold">Book Genie</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsGenieOpen(false)}>×</Button>
            </div>
            <div className="p-4 overflow-y-auto">
              <BookGenieModal isOpen={true} onClose={() => setIsGenieOpen(false)} embedded={true} text={genieText} setText={setGenieText} result={genieResult} setResult={setGenieResult} />
            </div>
          </div>
        </div>
      )}
  </>
  );
};

export default Navigation;
