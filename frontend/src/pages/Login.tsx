import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Star, Users, TrendingUp, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@/assets/hero-books.jpg";
import { api, setToken } from "@/lib/api";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const form = e.currentTarget as HTMLFormElement;
      const fd = new FormData(form);
      const email = String(fd.get("email") || "").trim();
      const password = String(fd.get("password") || "").trim();
      const resp = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(resp.token);
      setIsLoading(false);
      toast({ title: "Welcome back!", description: "You've successfully logged in." });
      navigate("/dashboard");
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Login failed", description: msg });
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const form = e.currentTarget as HTMLFormElement;
      const fd = new FormData(form);
      const username = String(fd.get("username") || "").trim();
      const email = String(fd.get("reg-email") || "").trim();
      const password = String(fd.get("reg-password") || "").trim();
      const confirm = String(fd.get("confirm-password") || "").trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!emailRegex.test(email)) throw new Error("Invalid email format");
      if (!usernameRegex.test(username)) throw new Error("Username must be 3-20 characters, letters/numbers/underscore");
      if (password.length < 6) throw new Error("Password must be at least 6 characters");
      if (password !== confirm) throw new Error("Passwords do not match");
      const resp = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, username, password }),
      });
      setToken(resp.token);
      setIsLoading(false);
      toast({ title: "Account created!", description: "Welcome to BookNest." });
      navigate("/dashboard");
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Registration failed", description: msg });
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-subtle">
      {/* Left Side - Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={heroImage}
          alt="Cozy reading scene"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-secondary/85 to-accent/80">
          <div className="h-full flex flex-col items-center justify-center text-primary-foreground p-12 animate-fade-in">
            <div className="mb-8 p-6 rounded-2xl bg-white/10 backdrop-blur-sm shadow-elevated">
              <BookOpen className="h-24 w-24 animate-float" />
            </div>
            
            <h1 className="text-6xl font-bold mb-4 text-center drop-shadow-lg">
              Welcome to BookNest
            </h1>
            <p className="text-2xl mb-12 text-center opacity-95 font-light max-w-md">
              Your personal sanctuary for reading, tracking, and connecting with book lovers
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-scale-in">
          {/* Logo for mobile */}
          <div className="text-center mb-10 lg:hidden">
            <div className="inline-block p-4 rounded-2xl bg-gradient-primary shadow-elevated mb-4">
              <BookOpen className="h-12 w-12 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              BookNest
            </h1>
          </div>

          {/* Desktop Header */}
          <div className="text-center mb-10 hidden lg:block">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-gradient-primary shadow-elevated">
                <BookOpen className="h-10 w-10 text-primary-foreground" />
              </div>
              <span className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                BookNest
              </span>
            </div>
            <p className="text-lg text-muted-foreground">
              Continue your reading journey
            </p>
          </div>

          <Card className="shadow-elevated border-primary/20">
            <CardContent className="pt-6">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 h-12">
                  <TabsTrigger value="login" className="text-base">Sign In</TabsTrigger>
                  <TabsTrigger value="register" className="text-base">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-base">Email Address</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="bookworm@example.com"
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-base">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showLoginPw ? "text" : "password"}
                          placeholder="password"
                          required
                          className="h-11 pr-12"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                          onClick={() => setShowLoginPw((v) => !v)}
                          aria-label="Toggle password visibility"
                        >
                          {showLoginPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 text-base" size="lg" disabled={isLoading}>
                      {isLoading ? "Signing in..." : "Sign In to BookNest"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-base"> Username</Label>
                      <Input
                        id="username"
                        name="username"
                        type="text"
                        placeholder="jane_doe"
                        pattern="^[a-zA-Z0-9_]{3,20}$"
                        autoComplete="username"
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email" className="text-base">Email Address</Label>
                      <Input
                        id="reg-email"
                        name="reg-email"
                        type="email"
                        placeholder="bookworm@example.com"
                        autoComplete="email"
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password" className="text-base">Password</Label>
                      <div className="relative">
                        <Input
                          id="reg-password"
                          name="reg-password"
                          type={showRegPw ? "text" : "password"}
                          placeholder="password"
                          autoComplete="new-password"
                          required
                          className="h-11 pr-12"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                          onClick={() => setShowRegPw((v) => !v)}
                          aria-label="Toggle password visibility"
                        >
                          {showRegPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-base">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          name="confirm-password"
                          type={showConfirmPw ? "text" : "password"}
                          placeholder="password"
                          autoComplete="new-password"
                          required
                          className="h-11 pr-12"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                          onClick={() => setShowConfirmPw((v) => !v)}
                          aria-label="Toggle password visibility"
                        >
                          {showConfirmPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" variant="secondary" className="w-full h-12 text-base" size="lg" disabled={isLoading}>
                      {isLoading ? "Creating account..." : "Create Your Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
