import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Activity,
  Building2,
  CalendarCheck,
  ChevronRight,
  FolderInput,
  History,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  UserCircle,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "대시보드", href: "/", icon: LayoutDashboard },
  { label: "미수금 명단", href: "/candidates", icon: Users },
  { label: "수납 관리", href: "/approval", icon: CalendarCheck },
  { label: "폐업 현황", href: "/closures", icon: Building2 },
  { label: "부과 현황", href: "/billing-records", icon: Receipt },
  { label: "연동 로그", href: "/sync-logs", icon: Activity },
  { label: "엑셀 업로드", href: "/import", icon: FolderInput },
  { label: "수납 이력", href: "/payment-history", icon: History },
];

function getPageTitle(location: string): string {
  return NAV_ITEMS.find((item) => item.href === location)?.label ?? "미수금 관리";
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [showSimpleLogin, setShowSimpleLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSimpleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoggingIn(true);
    try {
      const response = await fetch("/api/auth/simple-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "로그인에 실패했습니다.");
        return;
      }
      toast.success("로그인했습니다.");
      setPassword("");
      setShowSimpleLogin(false);
      window.location.reload();
    } catch {
      toast.error("로그인 중 오류가 발생했습니다.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("로그아웃했습니다.");
      navigate("/");
    } catch {
      toast.error("로그아웃 중 오류가 발생했습니다.");
    }
  };

  const accountMenu = user && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ar-account-button" aria-label="사용자 메뉴">
          <UserCircle className="h-5 w-5" />
          <span className="hidden lg:inline">{user.name || "관리자"}</span>
          <Settings className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
          <LogOut className="mr-2 h-4 w-4" /> 로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="ar-shell">
      <aside className="ar-sidebar">
        <div className="ar-brand">
          <div className="ar-brand-mark"><Receipt className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="ar-brand-caption">운영 관리 시스템</p>
            <h1 className="ar-brand-title">미수금·수납 관리</h1>
          </div>
        </div>

        <nav className="ar-nav" aria-label="주 메뉴">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <a key={item.href} href={item.href} className={`ar-nav-item ${isActive ? "is-active" : ""}`}>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5" />}
              </a>
            );
          })}
        </nav>

        <div className="ar-sidebar-footer">
          <div className="ar-user-summary">
            <UserCircle className="h-7 w-7 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-700">{user?.name || "관리자"}</p>
              <p className="truncate text-[11px] text-slate-400">{user?.email || "로그인이 필요합니다"}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="ar-main">
        <header className="ar-topbar">
          <div>
            <p className="text-[11px] font-medium text-slate-400">미수금 관리</p>
            <h2 className="text-sm font-semibold text-slate-800">{getPageTitle(location)}</h2>
          </div>
          <div className="flex items-center gap-2">
            {!user && (
              <Button variant="outline" size="sm" onClick={() => setShowSimpleLogin((value) => !value)}>
                관리자 로그인
              </Button>
            )}
            {accountMenu}
          </div>
        </header>

        {showSimpleLogin && (
          <div className="ar-login-bar">
            <form onSubmit={handleSimpleLogin} className="flex w-full max-w-sm items-center gap-2">
              <Input
                type="password"
                placeholder="관리자 비밀번호"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-8 bg-white text-sm"
              />
              <Button type="submit" size="sm" disabled={isLoggingIn} className="h-8 whitespace-nowrap">
                {isLoggingIn ? "확인 중" : "로그인"}
              </Button>
            </form>
          </div>
        )}

        <nav className="ar-mobile-nav" aria-label="모바일 메뉴">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.href} href={item.href} className={location === item.href ? "is-active" : ""}>
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </a>
            );
          })}
        </nav>

        <main className="ar-content">{children}</main>
      </div>
    </div>
  );
}
