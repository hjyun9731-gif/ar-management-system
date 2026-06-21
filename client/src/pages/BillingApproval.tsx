import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Search, FileSearch, AlertCircle } from "lucide-react";
import { BillingPreviewModal } from "@/components/BillingPreviewModal";
import { trpc } from "@/lib/trpc";

type TabKey = "반영대기" | "폐지" | "양도" | "타도이관" | "탈퇴" | "70세" | "부과대수상세";

const TABS: { key: TabKey; label: string }[] = [
  { key: "반영대기", label: "반영대기" },
  { key: "폐지", label: "폐지" },
  { key: "양도", label: "양도" },
  { key: "타도이관", label: "타도/이관" },
  { key: "탈퇴", label: "탈퇴" },
  { key: "70세", label: "70세" },
  { key: "부과대수상세", label: "부과대수상세" },
];

const CLOSURE_TABS: TabKey[] = ["폐지", "양도", "타도이관", "탈퇴", "70세"];

function getClosureTypesForTab(tab: TabKey): string[] {
  if (tab === "폐지") return ["폐업", "관리비폐지", "택배폐업", "폐지"];
  if (tab === "양도") return ["양도"];
  if (tab === "타도이관") return ["타도", "이관"];
  if (tab === "탈퇴") return ["탈퇴"];
  if (tab === "70세") return ["70세"];
  return [];
}

const STATUS_BADGE: Record<string, string> = {
  대기: "bg-blue-50 text-blue-700 border-blue-200",
  부과예정: "bg-indigo-50 text-indigo-700 border-indigo-200",
  확인필요: "bg-amber-50 text-amber-700 border-amber-200",
  반영완료: "bg-emerald-50 text-emerald-700 border-emerald-200",
  부과반영완료: "bg-emerald-50 text-emerald-700 border-emerald-200",
  보류: "bg-slate-100 text-slate-600 border-slate-200",
  제외: "bg-red-50 text-red-600 border-red-200",
};

const BILLING_BADGE: Record<string, string> = {
  협회비: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  관리비: "bg-indigo-50 text-indigo-700 border border-indigo-200",
};

export default function BillingApproval() {
  const [activeTab, setActiveTab] = useState<TabKey>("반영대기");
  const [search, setSearch] = useState("");
  const [previewMonth, setPreviewMonth] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: allCandidates = [], isLoading: candidatesLoading } = trpc.billing.listCandidates.useQuery({});
  const { data: allClosures = [], isLoading: closuresLoading } = trpc.billing.listClosures.useQuery({});

  const isClosureTab = CLOSURE_TABS.includes(activeTab);
  const isLoading = candidatesLoading || closuresLoading;

  const getTabCount = (tab: TabKey): number => {
    if (tab === "반영대기") {
      return (allCandidates as any[]).filter(
        (c) => c.status === "대기" && (c.billingType === "협회비" || c.billingType === "관리비")
      ).length;
    }
    if (tab === "부과대수상세") return (allCandidates as any[]).length;
    const types = getClosureTypesForTab(tab);
    return (allClosures as any[]).filter((c) => types.includes(c.closureType)).length;
  };

  const getTabData = (): any[] => {
    const q = search.trim().toLowerCase();
    const matchSearch = (item: any) =>
      !q ||
      String(item.vehicleNo || "").toLowerCase().includes(q) ||
      String(item.name || "").toLowerCase().includes(q);

    if (activeTab === "반영대기") {
      return (allCandidates as any[]).filter(
        (c) => c.status === "대기" && (c.billingType === "협회비" || c.billingType === "관리비") && matchSearch(c)
      );
    }
    if (activeTab === "부과대수상세") {
      return (allCandidates as any[]).filter(matchSearch);
    }
    const types = getClosureTypesForTab(activeTab);
    return (allClosures as any[]).filter((c) => types.includes(c.closureType) && matchSearch(c));
  };

  const tabData = getTabData();

  return (
    <div className="ar-page space-y-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">처리대기목록</h1>
          <p className="text-sm text-slate-500 mt-0.5">업무 구분별 처리 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={previewMonth}
            onChange={(e) => setPreviewMonth(e.target.value)}
            className="h-9 text-sm w-36"
          />
          <Button
            onClick={() => setPreviewOpen(true)}
            disabled={!previewMonth}
            size="sm"
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 h-9"
          >
            <Eye className="w-3.5 h-3.5" />
            부과 반영
          </Button>
        </div>
      </div>

      {/* Tab Bar + Table */}
      <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-200">
          {TABS.map((tab) => {
            const count = getTabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearch(""); }}
                className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 -mb-px ${
                  isActive
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-white"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                    isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-100 bg-white">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="차량번호 또는 성명 검색"
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {isClosureTab ? (
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-slate-500 pl-5">처리구분</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">처리일자</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">차량번호</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">성명</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">지역</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 text-right">미수금</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">반영여부</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">비고</TableHead>
                  </TableRow>
                ) : (
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-slate-500 pl-5">차량번호</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">성명</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">지역</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">부과항목</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">부과시작월</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">상태</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">비고</TableHead>
                  </TableRow>
                )}
              </TableHeader>
              {isLoading ? (
                <TableBody>
                  {[...Array(6)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-4 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              ) : (
                <TableBody>
                  {tabData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-16 text-center">
                        <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">항목이 없습니다</p>
                        <p className="text-xs text-slate-300 mt-1">
                          {search ? "검색 조건을 변경해 보세요" : "해당 탭에 처리 대기 항목이 없습니다"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : isClosureTab ? (
                    tabData.map((item: any) => {
                      const unpaid = Number(item.unpaidAmountAtClosure || 0);
                      return (
                        <TableRow key={item.id} className={`border-b border-slate-50 hover:bg-slate-50 ${unpaid > 0 ? "bg-red-50/20" : ""}`}>
                          <TableCell className="pl-5 py-3">
                            <span className="inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border bg-slate-100 text-slate-700 border-slate-200">
                              {item.closureType || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 text-sm text-slate-600 font-mono whitespace-nowrap">
                            {item.processDate ? new Date(item.processDate).toLocaleDateString("ko-KR") : "-"}
                          </TableCell>
                          <TableCell className="py-3 font-mono font-semibold text-slate-900 text-sm">{item.vehicleNo || "-"}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-800 font-medium">{item.name || "-"}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-600">{item.region || "-"}</TableCell>
                          <TableCell className="py-3 text-right">
                            {unpaid > 0 ? (
                              <div className="flex items-center justify-end gap-1">
                                <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                                <span className="font-bold text-red-600 text-sm">{unpaid.toLocaleString()}원</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">미수 없음</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border ${
                              item.reflectStatus === "완료" || item.reflectStatus === "반영완료"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {item.reflectStatus || "대기"}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 text-xs text-slate-400 max-w-[160px] truncate">{item.memo || "-"}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    tabData.map((item: any) => (
                      <TableRow key={item.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <TableCell className="pl-5 py-3 font-mono font-semibold text-slate-900 text-sm">{item.vehicleNo || "-"}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-800 font-medium">{item.name || "-"}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-600">{item.region || "-"}</TableCell>
                        <TableCell className="py-3">
                          <Badge className={`text-xs ${BILLING_BADGE[item.billingType] || "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                            {item.billingType || "확인필요"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-600 font-mono">{item.billingStartMonth || "-"}</TableCell>
                        <TableCell className="py-3">
                          <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border ${
                            STATUS_BADGE[item.status] || "bg-slate-100 text-slate-600 border-slate-200"
                          }`}>
                            {item.status || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-slate-400 max-w-[160px] truncate">{item.memo || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      <BillingPreviewModal open={previewOpen} onOpenChange={setPreviewOpen} month={previewMonth || currentMonth} />
    </div>
  );
}
