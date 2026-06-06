import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  LogOut,
  Settings,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Building2,
  Receipt,
  Activity,
  ChevronRight,
  UserCircle,
  FolderInput,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "대시보드", href: "/", icon: LayoutDashboard },
  { label: "다음 달 부과 대상", href: "/candidates", icon: Users },
  { label: "이번 달 부과 예정", href: "/approval", icon: CalendarCheck },
  { label: "폐업·양도·이관 현황", href: "/closures", icon: Building2 },
  { label: "납부현황", href: "/billing-records", icon: Receipt },
  { label: "연동 로그", href: "/sync-logs", icon: Activity },
  { label: "회원관리 자료 불러오기", href: "/import", icon: FolderInput },
];

function getPageTitle(location: string): string {
  const item = NAV_ITEMS.find((n) => n.href === location);
  return item?.label ?? "관리 시스템";
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
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
      window.location.reload();
    } catch {
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
    } catch {
      toast.error("로그아웃 중 오류 발생");
    }
  };

  const pageTitle = getPageTitle(location);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-white border-r border-slate-200 shadow-sm">
        {/* Brand */}
        <div className="flex flex-col items-start justify-center h-[72px] px-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 leading-none mb-0.5">강원도 개인소형화물협회</p>
              <h1 className="text-sm font-bold text-slate-800 leading-none">부과 관리 시스템</h1>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium group ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div
                  className={`w-[3px] h-5 rounded-full mr-0.5 flex-shrink-0 transition-all ${
                    isActive ? "bg-indigo-600" : "bg-transparent"
                  }`}
                />
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                <span className="flex-1 leading-none">{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
              </a>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <UserCircle className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user?.name || "Administrator"}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email || "admin@internal"}</p>
            </div>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                    <Settings className="w-4 h-4 text-slate-400" />
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
        <header className="bg-white border-b border-slate-200 px-6 h-[72px] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">강원도 개인소형화물협회</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-sm font-semibold text-slate-800">{pageTitle}</span>
          </div>
          <div className="flex items-center gap-3">
            {!user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSimpleLogin(!showSimpleLogin)}
                className="text-xs"
              >
                로그인
              </Button>
            )}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                      <UserCircle className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-medium text-slate-900 leading-tight">{user.name || "Administrator"}</p>
                      <p className="text-[11px] text-slate-400 leading-tight">{user.email || "admin@internal"}</p>
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
          </div>
        </header>

        {/* Simple Login Form */}
        {showSimpleLogin && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
            <form onSubmit={handleSimpleLogin} className="flex items-center gap-3 max-w-sm">
              <Input
                type="password"
                placeholder="관리자 비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8 text-sm"
              />
              <Button type="submit" size="sm" disabled={isLoggingIn} className="h-8 text-xs whitespace-nowrap">
                {isLoggingIn ? "로그인 중..." : "로그인"}
              </Button>
            </form>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
