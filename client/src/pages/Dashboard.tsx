import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface DashboardStats {
  nextMonthCount: number;
  thisMonthCount: number;
  closurePendingCount: number;
  unpaidCount: number;
  confirmNeededCount: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: dashboardData, isLoading } = trpc.billing.getDashboardStats.useQuery();

  useEffect(() => {
    if (dashboardData) {
      setStats(dashboardData);
      setLoading(false);
    }
  }, [dashboardData]);

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const statCards = [
    {
      title: "다음 달 부과 대상",
      value: stats?.nextMonthCount || 0,
      color: "bg-yellow-50 border-yellow-200",
      badgeColor: "bg-yellow-100 text-yellow-800",
      icon: "📋",
    },
    {
      title: "이번 달 부과 예정",
      value: stats?.thisMonthCount || 0,
      color: "bg-blue-50 border-blue-200",
      badgeColor: "bg-blue-100 text-blue-800",
      icon: "📅",
    },
    {
      title: "폐업 반영 대기",
      value: stats?.closurePendingCount || 0,
      color: "bg-red-50 border-red-200",
      badgeColor: "bg-red-100 text-red-800",
      icon: "⚠️",
    },
    {
      title: "미수금 있음",
      value: stats?.unpaidCount || 0,
      color: "bg-purple-50 border-purple-200",
      badgeColor: "bg-purple-100 text-purple-800",
      icon: "💰",
    },
    {
      title: "확인 필요",
      value: stats?.confirmNeededCount || 0,
      color: "bg-orange-50 border-orange-200",
      badgeColor: "bg-orange-100 text-orange-800",
      icon: "🔍",
    },
  ];

  return (
    <div className="space-y-8 p-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-600">협회비·관리비 부과 관리 시스템 현황</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {statCards.map((card, index) => (
          <Card key={index} className={`border-2 ${card.color} hover:shadow-lg transition-shadow`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center justify-between">
                <span>{card.title}</span>
                <span className="text-2xl">{card.icon}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{card.value}</div>
              <p className="text-xs text-gray-500 mt-2">건</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-2 border-gray-200">
          <CardHeader>
            <CardTitle>최근 활동</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <span className="text-sm text-gray-700">신규 등록 연동</span>
                <Badge className="bg-green-100 text-green-800">성공</Badge>
              </div>
              <div className="flex items-center justify-between py-3 border-b">
                <span className="text-sm text-gray-700">폐업 처리 연동</span>
                <Badge className="bg-yellow-100 text-yellow-800">대기</Badge>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-700">부과 반영</span>
                <Badge className="bg-blue-100 text-blue-800">진행중</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-gray-200">
          <CardHeader>
            <CardTitle>빠른 링크</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <a href="/candidates" className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="font-medium text-gray-900">다음 달 부과 대상자</div>
                <div className="text-xs text-gray-500">신규 등록 회원 관리</div>
              </a>
              <a href="/closures" className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="font-medium text-gray-900">폐업 현황</div>
                <div className="text-xs text-gray-500">폐업/양도/이관 처리 현황</div>
              </a>
              <a href="/billing-records" className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="font-medium text-gray-900">납부현황</div>
                <div className="text-xs text-gray-500">월별 부과 및 납부 현황</div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
