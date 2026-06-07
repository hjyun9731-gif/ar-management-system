import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  CalendarCheck,
  Building2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  TrendingUp,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

function StatCard({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  borderColor,
  href,
  alert,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  href: string;
  alert?: boolean;
}) {
  return (
    <a href={href} className="block group">
      <Card
        className={`bg-white border border-slate-200 hover:shadow-md transition-all rounded-xl overflow-hidden ${
          alert && value > 0 ? `border-l-4 ${borderColor}` : ""
        }`}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">{value.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">{title}</div>
        </CardContent>
      </Card>
    </a>
  );
}

function SyncLogStatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <CheckCircle2 className="w-3 h-3" />
        성공
      </span>
    );
  if (status === "FAIL")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <XCircle className="w-3 h-3" />
        실패
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
      <Clock className="w-3 h-3" />
      경고
    </span>
  );
}

export default function Dashboard() {
  const { data: dashboardData } = trpc.billing.getDashboardStats.useQuery();
  const { data: recentLogs = [] } = trpc.billing.listSyncLogs.useQuery({});

  const stats = dashboardData ?? {
    nextMonthCount: 0,
    thisMonthCount: 0,
    closurePendingCount: 0,
    unpaidCount: 0,
    confirmNeededCount: 0,
  };

  const latestLogs = recentLogs.slice(0, 5);
  const hasAttention = stats.closurePendingCount > 0 || stats.confirmNeededCount > 0 || stats.unpaidCount > 0;

  const statCards = [
    {
      title: "다음 달 부과 대상",
      value: stats.nextMonthCount,
      icon: Users,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      borderColor: "border-blue-400",
      href: "/candidates",
    },
    {
      title: "이번 달 부과 예정",
      value: stats.thisMonthCount,
      icon: CalendarCheck,
      iconBg: "bg-sky-50",
      iconColor: "text-sky-600",
      borderColor: "border-sky-400",
      href: "/approval",
    },
    {
      title: "폐업 반영 대기",
      value: stats.closurePendingCount,
      icon: Building2,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
      borderColor: "border-orange-400",
      href: "/closures",
      alert: true,
    },
    {
      title: "미수금 있음",
      value: stats.unpaidCount,
      icon: TrendingUp,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      borderColor: "border-violet-400",
      href: "/billing-records",
      alert: true,
    },
    {
      title: "확인 필요",
      value: stats.confirmNeededCount,
      icon: HelpCircle,
      iconBg: "bg-red-50",
      iconColor: "text-red-600",
      borderColor: "border-red-400",
      href: "/candidates",
      alert: true,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">대시보드</h1>
          <p className="text-sm text-slate-500 mt-0.5">협회비·관리비 부과 관리 시스템 현황</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">오늘</p>
          <p className="text-sm font-semibold text-slate-700">
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* Attention Banner */}
      {hasAttention && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">처리 필요 항목이 있습니다</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {stats.closurePendingCount > 0 && (
                <span className="text-xs text-amber-700">
                  폐업 반영 대기 <strong>{stats.closurePendingCount}건</strong>
                </span>
              )}
              {stats.unpaidCount > 0 && (
                <span className="text-xs text-amber-700">
                  미수금 <strong>{stats.unpaidCount}건</strong>
                </span>
              )}
              {stats.confirmNeededCount > 0 && (
                <span className="text-xs text-amber-700">
                  확인 필요 <strong>{stats.confirmNeededCount}건</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Sync Activity */}
        <Card className="bg-white border border-slate-200 rounded-xl">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" />
                최근 연동 로그
              </CardTitle>
              <a href="/sync-logs" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                전체 보기
              </a>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {latestLogs.length === 0 ? (
              <div className="py-6 text-center">
                <Activity className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">연동 로그가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-0">
                {latestLogs.map((log: any, idx: number) => (
                  <div
                    key={log.id}
                    className={`flex items-center justify-between py-2.5 ${
                      idx < latestLogs.length - 1 ? "border-b border-slate-50" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {log.eventType === "REGISTER" ? "신규 등록 연동" : "폐업 처리 연동"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(log.createdAt).toLocaleString("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <SyncLogStatusBadge status={log.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-white border border-slate-200 rounded-xl">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-800">빠른 이동</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2">
            {[
              {
                href: "/candidates",
                icon: Users,
                iconBg: "bg-blue-50",
                iconColor: "text-blue-600",
                label: "다음 달 부과 대상자",
                desc: "신규 등록 회원 부과 항목 확인",
              },
              {
                href: "/approval",
                icon: CalendarCheck,
                iconBg: "bg-sky-50",
                iconColor: "text-sky-600",
                label: "이번 달 부과 예정",
                desc: "당월 부과 반영 및 미리보기",
              },
              {
                href: "/closures",
                icon: Building2,
                iconBg: "bg-orange-50",
                iconColor: "text-orange-600",
                label: "폐업·양도·이관 현황",
                desc: "폐업 반영 처리 및 미수금 확인",
              },
              {
                href: "/billing-records",
                icon: TrendingUp,
                iconBg: "bg-violet-50",
                iconColor: "text-violet-600",
                label: "납부현황",
                desc: "월별 부과·납부 현황 조회",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group"
                >
                  <div className={`w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${item.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                </a>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
