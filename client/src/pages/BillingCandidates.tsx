import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Search, Filter } from "lucide-react";
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

export default function BillingCandidates() {
  const [filters, setFilters] = useState({
    region: "",
    memberType: "",
    status: "",
    billingStartMonth: "",
  });

  const [searchText, setSearchText] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  const { data: candidates = [], isLoading } = trpc.billing.listCandidates.useQuery(filters);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c: any) => {
      if (searchText) {
        const search = searchText.toLowerCase();
        return (
          (c.vehicleNo?.toLowerCase().includes(search) || false) ||
          (c.name?.toLowerCase().includes(search) || false)
        );
      }
      return true;
    });
  }, [candidates, searchText]);

  const handleExportExcel = () => {
    const headers = ["지역", "차량번호", "성명", "구분", "자격증명 발급일자", "가입일자", "부과시작월", "부과항목", "상태"];
    const rows = filteredCandidates.map((c: any) => [
      c.region || "",
      c.vehicleNo || "",
      c.name || "",
      c.memberType || "",
      c.certificateDate || "",
      c.joinDate || "",
      c.billingStartMonth || "",
      c.billingType || "",
      c.status || "",
    ]);

    const csv = [headers, ...rows].map((row: any) => row.map((cell: any) => `"${cell}"`).join(",")).join("\n");
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
        <h1 className="text-3xl font-bold text-gray-900">다음 달 부과 대상자</h1>
        <p className="text-gray-600">신규 등록 회원 관리 및 부과 대상자 현황</p>
      </div>

      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>필터 및 검색</span>
            <Filter className="w-5 h-5 text-gray-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">검색 (차량번호/성명)</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="검색..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">지역</label>
              <Input
                placeholder="지역"
                value={filters.region}
                onChange={(e) => setFilters({ ...filters, region: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">구분</label>
              <Select value={filters.memberType} onValueChange={(v) => setFilters({ ...filters, memberType: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  <SelectItem value="개인회원">개인회원</SelectItem>
                  <SelectItem value="택배회원">택배회원</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">상태</label>
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  <SelectItem value="대기">대기</SelectItem>
                  <SelectItem value="부과예정">부과예정</SelectItem>
                  <SelectItem value="부과반영완료">부과반영완료</SelectItem>
                  <SelectItem value="확인필요">확인필요</SelectItem>
                  <SelectItem value="보류">보류</SelectItem>
                  <SelectItem value="제외">제외</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={handleExportExcel} className="w-full bg-green-600 hover:bg-green-700">
                <Download className="w-4 h-4 mr-2" />
                엑셀 다운로드
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle>부과 대상자 목록 ({filteredCandidates.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-gray-700">지역</TableHead>
                  <TableHead className="text-gray-700">차량번호</TableHead>
                  <TableHead className="text-gray-700">성명</TableHead>
                  <TableHead className="text-gray-700">구분</TableHead>
                  <TableHead className="text-gray-700">부과시작월</TableHead>
                  <TableHead className="text-gray-700">부과항목</TableHead>
                  <TableHead className="text-gray-700">상태</TableHead>
                  <TableHead className="text-gray-700">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCandidates.map((candidate: any) => (
                    <TableRow key={candidate.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm">{candidate.region}</TableCell>
                      <TableCell className="text-sm font-medium">{candidate.vehicleNo}</TableCell>
                      <TableCell className="text-sm">{candidate.name}</TableCell>
                      <TableCell className="text-sm">{candidate.memberType}</TableCell>
                      <TableCell className="text-sm">{candidate.billingStartMonth}</TableCell>
                      <TableCell className="text-sm">{candidate.billingType}</TableCell>
                      <TableCell>
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
