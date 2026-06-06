import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, Settings, BarChart3, Users, Trash2, FileText, Zap, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

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
  const [location] = useLocation();
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-gray-900">협회비·관리비 부과 관리</h1>
          <p className="text-gray-600 text-lg">관리자 로그인이 필요합니다</p>
          <Button size="lg" onClick={() => (window.location.href = getLoginUrl())} className="bg-blue-600 hover:bg-blue-700">
            로그인
          </Button>
        </div>
      </div>
    );
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
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive ? "bg-blue-600 text-white shadow-lg" : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{user.name?.charAt(0) || "A"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name || "관리자"}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            className="w-full text-gray-300 border-gray-600 hover:bg-gray-700 hover:text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            로그아웃
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-20 border-b bg-white shadow-sm flex items-center justify-between px-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">협회비·관리비 부과 관리</h1>
            <p className="text-sm text-gray-500">관리자 시스템</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900">{user.name || "관리자"}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 bg-blue-100 hover:bg-blue-200">
                  <span className="text-blue-600 font-bold">{user.name?.charAt(0) || "A"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  설정
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
