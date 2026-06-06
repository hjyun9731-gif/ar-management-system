import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, Settings, BarChart3, Users, Trash2, FileText, Zap, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "대시보드", href: "/", icon: BarChart3 },
  { label: "다음 달 부과 대상", href: "/candidates", icon: Users },
  { label: "이번 달 부과 예정", href: "/approval", icon: FileText },
  { label: "폐업 현황", href: "/closures", icon: Trash2 },
  { label: "납부현황", href: "/billing-records", icon: FileText },
  { label: "연동 로그", href: "/sync-logs", icon: Zap },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, loading, logout } = useAuth();
  const [showSimpleLogin, setShowSimpleLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSimpleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const response = await fetch("/api/auth/simple-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "로그인 실패");
        return;
      }

      toast.success("로그인 성공");
      setPassword("");
      setShowSimpleLogin(false);
      // Reload to refresh auth state
      window.location.reload();
    } catch (error) {
      toast.error("로그인 중 오류 발생");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("로그아웃 되었습니다");
      navigate("/");
    } catch (error) {
      toast.error("로그아웃 중 오류 발생");
    }
  };

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:bg-gradient-to-b md:from-gray-900 md:to-gray-800 md:border-r md:border-gray-700 md:shadow-lg">
        <div className="flex items-center justify-center h-20 border-b border-gray-700">
          <div className="text-center">
            <h1 className="text-lg font-bold text-white">부과 관리</h1>
            <p className="text-xs text-gray-400">협회비·관리비</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{user?.name || "Administrator"}</p>
              <p className="text-xs text-gray-400">{user?.email || "admin@internal"}</p>
            </div>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 hover:bg-gray-700 rounded-lg transition-colors">
                    <Settings className="w-5 h-5 text-gray-300" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex-1" />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{user.name || "Administrator"}</p>
                    <p className="text-xs text-gray-500">{user.email || "admin@internal"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
