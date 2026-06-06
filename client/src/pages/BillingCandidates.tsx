import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, Filter, Users, FileSearch } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CandidateDetailModal } from "@/components/CandidateDetailModal";

const STATUS_STYLE: Record<string, string> = {
  대기: "bg-amber-50 text-amber-700 border border-amber-200",
  부과예정: "bg-sky-50 text-sky-700 border border-sky-200",
  부과반영완료: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  확인필요: "bg-red-50 text-red-700 border border-red-200",
  보류: "bg-slate-100 text-slate-600 border border-slate-200",
  제외: "bg-gray-50 text-gray-500 border border-gray-200",
};

const BILLING_TYPE_STYLE: Record<string, string> = {
  협회비: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  관리비: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  확인필요: "bg-amber-50 text-amber-700 border border-amber-200",
};

function getCalculationReason(
  memberType: string,
  joinDate?: string,
  certificateDate?: string,
  billingType?: string
): string {
  if (billingType === "확인필요") {
    if (memberType === "개인회원" && !joinDate) return "joinDate 누락";
    if (memberType === "택배회원" && !certificateDate) return "certificateDate 누락";
    return "정보 부족";
  }
  if (memberType === "개인회원" && billingType === "협회비") return "협회비: joinDate 기준";
  if (memberType === "택배회원" && billingType === "관리비") return "관리비: certificateDate 기준";
  return "";
}

function TableSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

export default function BillingCandidates() {
  const [filters, setFilters] = useState({
    region: "all",
    memberType: "all",
    status: "all",
    billingStartMonth: "",
  });
  const [searchText, setSearchText] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  const { data: candidates = [], isLoading } = trpc.billing.listCandidates.useQuery({
    region: filters.region === "all" ? undefined : filters.region,
    memberType: filters.memberType === "all" ? undefined : filters.memberType,
    status: filters.status === "all" ? undefined : filters.status,
    billingStartMonth: filters.billingStartMonth || undefined,
  });

  const filteredCandidates = useMemo(() => {
    if (!searchText) return candidates;
    return candidates.filter(
      (c: any) =>
        c.vehicleNo?.includes(searchText) ||
        c.name?.includes(searchText) ||
        c.managementNo?.includes(searchText)
    );
  }, [candidates, searchText]);

  const handleDownloadExcel = () => {
    const csv = [
      ["차량번호", "성명", "지역", "구분", "부과항목", "부과시작월", "상태", "계산 근거"],
      ...filteredCandidates.map((c: any) => [
        c.vehicleNo, c.name, c.region || "", c.memberType, c.billingType,
        c.billingStartMonth || "", c.status,
        getCalculationReason(c.memberType, c.joinDate, c.certificateDate, c.billingType),
      ]),
    ]
      .map((row: any[]) => row.map((cell: any) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `billing_candidates_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">다음 달 부과 대상</h1>
          <p className="text-sm text-slate-500 mt-0.5">신규 등록 회원 부과 항목 확인 및 관리</p>
        </div>
        <Button onClick={handleDownloadExcel} variant="outline" size="sm" className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
          <Download className="w-3.5 h-3.5" />
          엑셀 다운로드
        </Button>
      </div>

      {/* Filter Card */}
      <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            검색 및 필터
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Search */}
            <div className="md:col-span-1">
              <label className="text-xs font-medium text-slate-600 block mb-1.5">차량번호 / 성명</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="검색..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">지역</label>
              <Select value={filters.region} onValueChange={(v) => setFilters({ ...filters, region: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="서울">서울</SelectItem>
                  <SelectItem value="경기">경기</SelectItem>
                  <SelectItem value="인천">인천</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">구분</label>
              <Select value={filters.memberType} onValueChange={(v) => setFilters({ ...filters, memberType: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="개인회원">개인회원</SelectItem>
                  <SelectItem value="택배회원">택배회원</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">상태</label>
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="대기">대기</SelectItem>
                  <SelectItem value="부과예정">부과예정</SelectItem>
                  <SelectItem value="부과반영완료">부과반영완료</SelectItem>
                  <SelectItem value="확인필요">확인필요</SelectItem>
                  <SelectItem value="보류">보류</SelectItem>
                  <SelectItem value="제외">제외</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">부과시작월</label>
              <Input
                type="month"
                value={filters.billingStartMonth}
                onChange={(e) => setFilters({ ...filters, billingStartMonth: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              부과 대상자 목록
            </CardTitle>
            {!isLoading && (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 font-medium">
                {filteredCandidates.length.toLocaleString()}명
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-5 py-3">
              <TableSkeleton />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-100">
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide pl-5">차량번호</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">성명</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">구분</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">부과항목</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">계산 근거</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">부과시작월</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">상태</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide pr-5">상세</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-16 text-center">
                        <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">부과 대상이 없습니다</p>
                        <p className="text-xs text-slate-300 mt-1">필터 조건을 변경하거나 검색어를 수정해 보세요</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCandidates.map((candidate: any) => (
                      <TableRow key={candidate.id} className="hover:bg-slate-50 border-b border-slate-50">
                        <TableCell className="text-sm font-semibold text-slate-900 pl-5 py-3">
                          {candidate.vehicleNo}
                        </TableCell>
                        <TableCell className="text-sm text-slate-800 py-3">{candidate.name}</TableCell>
                        <TableCell className="text-sm text-slate-600 py-3">{candidate.memberType}</TableCell>
                        <TableCell className="py-3">
                          <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 ${BILLING_TYPE_STYLE[candidate.billingType] ?? "bg-slate-100 text-slate-600"}`}>
                            {candidate.billingType}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 py-3 max-w-[160px] truncate">
                          {getCalculationReason(
                            candidate.memberType,
                            candidate.joinDate,
                            candidate.certificateDate,
                            candidate.billingType
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 py-3 font-mono">
                          {candidate.billingStartMonth || <span className="text-slate-300">-</span>}
                        </TableCell>
                        <TableCell className="py-3">
                          <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_STYLE[candidate.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {candidate.status}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 pr-5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCandidateId(candidate.id)}
                            className="h-7 px-3 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          >
                            상세 보기
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CandidateDetailModal
        open={selectedCandidateId !== null}
        onOpenChange={(open) => !open && setSelectedCandidateId(null)}
        candidateId={selectedCandidateId || 0}
      />
    </div>
  );
}
