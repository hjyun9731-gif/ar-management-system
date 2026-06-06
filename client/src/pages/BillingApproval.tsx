import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Eye } from "lucide-react";
import { BillingPreviewModal } from "@/components/BillingPreviewModal";
import { trpc } from "@/lib/trpc";

export default function BillingApproval() {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: candidates = [], isLoading } = trpc.billing.listCandidates.useQuery({
    status: "부과예정",
  });

  const handlePreview = (month: string) => {
    setSelectedMonth(month);
    setPreviewOpen(true);
  };

  // 현재 월과 다음 월 계산
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextMonth = `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}`;

  const thisMonthCandidates = candidates.filter((c: any) => c.billingStartMonth === currentMonth);
  const nextMonthCandidates = candidates.filter((c: any) => c.billingStartMonth === nextMonth);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">이번 달 부과 예정</h1>
        <p className="text-gray-600">부과 대상자 현황 및 부과 반영 관리</p>
      </div>

      {/* 부과 월 선택 */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="text-base">부과 월 선택</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">부과 월 (YYYY-MM)</label>
              <div className="flex gap-2">
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  placeholder="부과 월을 선택하세요"
                />
                <Button
                  onClick={() => handlePreview(selectedMonth)}
                  disabled={!selectedMonth}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  미리보기
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 이번 달 부과 예정 */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base text-blue-900">이번 달 부과 예정 ({currentMonth})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600">부과 대상</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{thisMonthCandidates.length}</p>
              <p className="text-xs text-gray-500 mt-1">건</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600">예상 부과액</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {(thisMonthCandidates.length * 15000).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">원</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200 flex flex-col justify-between">
              <p className="text-sm text-gray-600">상태</p>
              <Button
                onClick={() => handlePreview(currentMonth)}
                className="mt-4 bg-blue-600 hover:bg-blue-700"
              >
                <Eye className="w-4 h-4 mr-2" />
                부과 반영
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 다음 달 부과 예정 */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-base text-green-900">다음 달 부과 예정 ({nextMonth})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <p className="text-sm text-gray-600">부과 대상</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{nextMonthCandidates.length}</p>
              <p className="text-xs text-gray-500 mt-1">건</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <p className="text-sm text-gray-600">예상 부과액</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {(nextMonthCandidates.length * 15000).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">원</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-200 flex flex-col justify-between">
              <p className="text-sm text-gray-600">상태</p>
              <Button
                onClick={() => handlePreview(nextMonth)}
                variant="outline"
                className="mt-4"
              >
                <Eye className="w-4 h-4 mr-2" />
                미리보기
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 부과 반영 이력 */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="text-base">최근 부과 반영 이력</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">2026년 6월 부과</p>
                <p className="text-xs text-gray-500 mt-1">2026-06-01 10:30:00</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">완료</Badge>
                <span className="text-sm font-medium text-gray-900">145건</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">2026년 5월 부과</p>
                <p className="text-xs text-gray-500 mt-1">2026-05-01 09:15:00</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">완료</Badge>
                <span className="text-sm font-medium text-gray-900">142건</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <BillingPreviewModal open={previewOpen} onOpenChange={setPreviewOpen} month={selectedMonth} />
    </div>
  );
}
