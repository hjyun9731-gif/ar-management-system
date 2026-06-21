import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Activity, Bell, Building2, CalendarCheck, ChevronDown, FolderInput, Globe2,
  History, LayoutDashboard, LogOut, Receipt, Settings, UserCircle, Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

interface DashboardLayoutProps { children: React.ReactNode; }

const NAV_ITEMS = [
  { label: "대시보드", href: "/", icon: LayoutDashboard },
  { label: "미수금 명단", href: "/candidates", icon: Users },
  { label: "지역별 · 문자", href: "/approval", icon: Globe2 },
  { label: "통장매칭", href: "/sync-logs", icon: CalendarCheck },
  { label: "폐업현황", href: "/closures", icon: Building2 },
  { label: "신규 · 예정자", href: "/billing-records", icon: Receipt },
  { label: "수납 내역", href: "/payment-history", icon: History },
  { label: "엑셀 업로드", href: "/import", icon: FolderInput },
];

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "대시보드", subtitle: "미수금 및 수납 현황을 한눈에 확인하세요." },
  "/candidates": { title: "미수금 명단", subtitle: "회원별 미수금 현황을 조회하고 수납을 처리합니다." },
  "/approval": { title: "지역별 · 문자", subtitle: "지역별 미수금 현황과 처리 대상을 관리합니다." },
  "/sync-logs": { title: "통장매칭", subtitle: "입금 내역의 연동 및 처리 상태를 확인합니다." },
  "/closures": { title: "폐업현황", subtitle: "폐업·양도·이관·탈퇴 회원과 잔여 미수금을 관리합니다." },
  "/billing-records": { title: "신규 · 예정자", subtitle: "부과 대상과 현재 미수금 현황을 확인합니다." },
  "/payment-history": { title: "수납 내역", subtitle: "저장된 수납 이력과 월별 상세를 조회합니다." },
  "/import": { title: "엑셀 업로드", subtitle: "운영 자료를 검토하고 실제 데이터베이스에 반영합니다." },
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [showSimpleLogin, setShowSimpleLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const meta = PAGE_META[location] ?? { title: "미수금 관리", subtitle: "운영 현황을 확인합니다." };
  const today = new Date();

  const handleSimpleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoggingIn(true);
    try {
      const response = await fetch("/api/auth/simple-login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
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

  return (
    <div className="ar-shell">
      <aside className="ar-sidebar">
        <div className="ar-brand">
          <div className="ar-brand-mark"><Receipt className="h-5 w-5" /></div>
          <div><h1>미수금 관리</h1><p>운영 관리 시스템</p></div>
        </div>
        <p className="ar-nav-label">업무</p>
        <nav className="ar-nav" aria-label="주 메뉴">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.href} href={item.href} className={`ar-nav-item ${location === item.href ? "is-active" : ""}`}>
                <Icon className="h-[18px] w-[18px]" /><span>{item.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="ar-sidebar-footer">
          <button className="ar-settings-row"><Settings className="h-[18px] w-[18px]" /> 설정</button>
          <div className="ar-user-summary">
            <span className="ar-avatar">{(user?.name || "관리").slice(0, 2)}</span>
            <div className="min-w-0 flex-1"><strong>{user?.name || "관리자"}</strong><small>{user?.email || "운영 담당자"}</small></div>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button className="ar-user-menu"><ChevronDown className="h-4 w-4" /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end"><DropdownMenuItem onClick={handleLogout} className="text-red-600"><LogOut className="mr-2 h-4 w-4" />로그아웃</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </aside>

      <div className="ar-main">
        <header className="ar-topbar">
          <div><h2>{meta.title}</h2><p>{meta.subtitle}</p></div>
          <div className="ar-header-actions">
            <button className="ar-period-button"><span>{today.getFullYear()}년</span><strong>{today.getMonth() + 1}월</strong><ChevronDown className="h-4 w-4" /></button>
            <button className="ar-icon-button" aria-label="알림"><Bell className="h-[18px] w-[18px]" /><i /></button>
            {!user && <Button variant="outline" size="sm" onClick={() => setShowSimpleLogin((value) => !value)}>관리자 로그인</Button>}
          </div>
        </header>

        {showSimpleLogin && (
          <div className="ar-login-bar"><form onSubmit={handleSimpleLogin} className="flex w-full max-w-sm items-center gap-2">
            <Input type="password" placeholder="관리자 비밀번호" value={password} onChange={(event) => setPassword(event.target.value)} className="h-9 bg-white text-sm" />
            <Button type="submit" size="sm" disabled={isLoggingIn} className="h-9 whitespace-nowrap">{isLoggingIn ? "확인 중" : "로그인"}</Button>
          </form></div>
        )}

        <nav className="ar-mobile-nav" aria-label="모바일 메뉴">
          {NAV_ITEMS.map((item) => { const Icon = item.icon; return <a key={item.href} href={item.href} className={location === item.href ? "is-active" : ""}><Icon className="h-3.5 w-3.5" />{item.label}</a>; })}
        </nav>
        <main className="ar-content">{children}</main>
      </div>
    </div>
  );
}
