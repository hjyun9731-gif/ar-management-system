import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Search, Filter, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CandidateDetailModal } from "@/components/CandidateDetailModal";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  대기: { bg: "bg-yellow-100", text: "text-yellow-800" },
  부과예정: { bg: "bg-blue-100", text: "text-blue-800" },
  부과반영완료: { bg: "bg-green-100", text: "text-green-800" },
  확인필요: { bg: "bg-red-100", text: "text-red-800" },
  보류: { bg: "bg-gray-100", text: "text-gray-800" },
  제외: { bg: "bg-gray-200", text: "text-gray-700" },
};

function getCalculationReason(
  memberType: string,
  joinDate?: string,
  certificateDate?: string,
  billingType?: string
): string {
  if (billingType === "확인필요") {
    if (memberType === "개인회원" && !joinDate) {
      return "joinDate 누락";
    }
    if (memberType === "택배회원" && !certificateDate) {
      return "certificateDate 누락";
    }
    return "정보 부족";
  }

  if (memberType === "개인회원" && billingType === "협회비") {
    return "협회비: joinDate 기준";
  }
  if (memberType === "택배회원" && billingType === "관리비") {
    return "관리비: certificateDate 기준";
  }
  return "";
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
        c.vehicleNo,
        c.name,
        c.region || "",
        c.memberType,
        c.billingType,
        c.billingStartMonth || "",
        c.status,
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
        <h1 className="text-3xl font-bold text-gray-900">다음 달 부과 대상</h1>
        <p className="text-gray-600">회원 정보 및 부과 대상 관리</p>
      </div>

      {/* 필터 및 검색 */}
      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            필터 및 검색
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">검색 (차량번호/성명)</label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="검색..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="icon">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">지역</label>
              <Select value={filters.region} onValueChange={(v) => setFilters({ ...filters, region: v })}>
                <SelectTrigger className="mt-1">
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
              <label className="text-sm font-medium text-gray-700">구분</label>
              <Select value={filters.memberType} onValueChange={(v) => setFilters({ ...filters, memberType: v })}>
                <SelectTrigger className="mt-1">
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
              <label className="text-sm font-medium text-gray-700">상태</label>
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger className="mt-1">
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
              <label className="text-sm font-medium text-gray-700">부과시작월</label>
              <Input
                type="month"
                value={filters.billingStartMonth}
                onChange={(e) => setFilters({ ...filters, billingStartMonth: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleDownloadExcel} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              엑셀 다운로드
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 목록 */}
      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-base">
            부과 대상자 목록 ({filteredCandidates.length}명)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-gray-700 font-semibold">차량번호</TableHead>
                  <TableHead className="text-gray-700 font-semibold">성명</TableHead>
                  <TableHead className="text-gray-700 font-semibold">구분</TableHead>
                  <TableHead className="text-gray-700 font-semibold">부과항목</TableHead>
                  <TableHead className="text-gray-700 font-semibold">계산 근거</TableHead>
                  <TableHead className="text-gray-700 font-semibold">부과시작월</TableHead>
                  <TableHead className="text-gray-700 font-semibold">상태</TableHead>
                  <TableHead className="text-gray-700 font-semibold">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      부과 대상이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCandidates.map((candidate: any) => (
                    <TableRow key={candidate.id} className="hover:bg-gray-50 border-b border-gray-200">
                      <TableCell className="text-sm font-medium text-gray-900">{candidate.vehicleNo}</TableCell>
                      <TableCell className="text-sm text-gray-900">{candidate.name}</TableCell>
                      <TableCell className="text-sm text-gray-900">{candidate.memberType}</TableCell>
                      <TableCell className="text-sm">
                        <Badge
                          className={
                            candidate.billingType === "협회비"
                              ? "bg-green-100 text-green-800"
                              : candidate.billingType === "관리비"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {candidate.billingType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {getCalculationReason(
                          candidate.memberType,
                          candidate.joinDate,
                          candidate.certificateDate,
                          candidate.billingType
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">{candidate.billingStartMonth || "-"}</TableCell>
                      <TableCell className="text-sm">
                        <Badge className={`${STATUS_COLORS[candidate.status]?.bg} ${STATUS_COLORS[candidate.status]?.text}`}>
                          {candidate.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Button variant="outline" size="sm" onClick={() => setSelectedCandidateId(candidate.id)}>
                          상세
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
