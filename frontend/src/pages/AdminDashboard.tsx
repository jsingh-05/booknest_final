import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, TrendingUp, Download, BarChart3, Activity } from "lucide-react";

export default function AdminDashboard() {
  const topClicks = [
    { title: "The Great Gatsby", clicks: 1247, trend: "+12%" },
    { title: "1984", clicks: 1156, trend: "+8%" },
    { title: "To Kill a Mockingbird", clicks: 1089, trend: "+15%" },
    { title: "Pride and Prejudice", clicks: 987, trend: "+5%" },
    { title: "The Catcher in the Rye", clicks: 892, trend: "-3%" },
    { title: "Animal Farm", clicks: 834, trend: "+6%" },
    { title: "Brave New World", clicks: 798, trend: "+10%" },
    { title: "Lord of the Flies", clicks: 756, trend: "+4%" },
    { title: "The Hobbit", clicks: 723, trend: "+9%" },
    { title: "Fahrenheit 451", clicks: 689, trend: "+7%" },
  ];

  const recentActivity = [
    { action: "New user registration", user: "john@example.com", time: "2 minutes ago" },
    { action: "Book club created", user: "Mystery Enthusiasts", time: "15 minutes ago" },
    { action: "Report generated", user: "System", time: "1 hour ago" },
    { action: "Book added", user: "Admin", time: "2 hours ago" },
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
              <p className="text-muted-foreground">Monitor and manage platform activity</p>
            </div>
            <Badge variant="secondary" className="text-base px-4 py-2">
              Administrator
            </Badge>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-book">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                  <p className="text-3xl font-bold">2,547</p>
                  <p className="text-xs text-success mt-1">+12% this month</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-book">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Books</p>
                  <p className="text-3xl font-bold">1,843</p>
                  <p className="text-xs text-success mt-1">+23 this week</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-book">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Book Clubs</p>
                  <p className="text-3xl font-bold">87</p>
                  <p className="text-xs text-success mt-1">+5 this week</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-book">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Searches</p>
                  <p className="text-3xl font-bold">12.4K</p>
                  <p className="text-xs text-success mt-1">+8% this month</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top 10 Clicked Books */}
          <div className="lg:col-span-2">
            <Card className="shadow-elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-accent" />
                      Top 10 Most Clicked Books
                    </CardTitle>
                    <CardDescription>Books with the highest engagement</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topClicks.map((book, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{book.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-accent h-2 rounded-full transition-all"
                              style={{ width: `${(book.clicks / 1247) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-12 text-right">
                            {book.clicks}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={book.trend.startsWith("+") ? "default" : "secondary"}
                        className={book.trend.startsWith("+") ? "bg-success text-success-foreground" : ""}
                      >
                        {book.trend}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="shadow-book">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="default" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Manage Books
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="shadow-book">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="space-y-1">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.user}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                      {index < recentActivity.length - 1 && (
                        <div className="border-b border-border pt-2" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card className="shadow-book bg-success/10">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-success text-success-foreground mx-auto mb-3 flex items-center justify-center">
                    ✓
                  </div>
                  <p className="font-semibold mb-1">All Systems Operational</p>
                  <p className="text-xs text-muted-foreground">Last checked: 2 minutes ago</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
