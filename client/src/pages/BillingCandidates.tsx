import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, Filter, Users, FileSearch, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CandidateDetailModal } from "@/components/CandidateDetailModal";

const BILLING_TYPE_STYLE: Record<string, string> = {
  협회비: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  관리비: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  확인필요: "bg-amber-50 text-amber-700 border border-amber-200",
};

function money(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n === 0) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

function TableSkeleton() {
  return (
    <TableBody>
      {[...Array(8)].map((_, i) => (
        <TableRow key={i}>
          {[...Array(9)].map((__, j) => (
            <TableCell key={j}>
              <div className="h-4 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

export default function BillingCandidates() {
  const [region, setRegion] = useState("all");
  const [memberType, setMemberType] = useState("all");
  const [arrearsFilter, setArrearsFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  const { data: candidates = [], isLoading } = trpc.billing.listCandidatesWithArrears.useQuery({
    region: region === "all" ? undefined : region,
    memberType: memberType === "all" ? undefined : memberType,
    search: searchText.trim() || undefined,
  });

  const filteredCandidates = useMemo(() => {
    let list = candidates as any[];
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter((c) =>
        String(c.vehicleNo || "").toLowerCase().includes(q) ||
        String(c.name || "").toLowerCase().includes(q)
      );
    }
    if (arrearsFilter === "있음") list = list.filter((c) => Number(c.currentArAmount || 0) > 0);
    if (arrearsFilter === "없음") list = list.filter((c) => Number(c.currentArAmount || 0) <= 0);
    return list;
  }, [candidates, searchText, arrearsFilter]);

  const arrearsCount = useMemo(
    () => (filteredCandidates as any[]).filter((c) => Number(c.currentArAmount || 0) > 0).length,
    [filteredCandidates]
  );

  const totalArrears = useMemo(
    () => (filteredCandidates as any[]).reduce((sum, c) => sum + Number(c.currentArAmount || 0), 0),
    [filteredCandidates]
  );

  const handleDownload = () => {
    const headers = ["차량번호", "성명", "지역", "구분", "부과항목", "부과시작월", "부과개월수", "미납발생개월수", "미수금", "최근납부일"];
    const rows = (filteredCandidates as any[]).map((c) => [
      c.vehicleNo || "", c.name || "", c.region || "", c.memberType || "",
      c.billingType || "", c.billingStartMonth || "",
      c.billingMonthCount || 0, c.unpaidMonthCount || 0,
      c.currentArAmount || 0, c.recentPaymentMonth || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `billing_candidates_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-5 space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">다음 달 부과 대상</h1>
          <p className="text-sm text-slate-500 mt-0.5">폐업·양도·이관·탈퇴 제외 후 미수금 연동 조회</p>
        </div>
        <Button onClick={handleDownload} variant="outline" size="sm" className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
          <Download className="w-3.5 h-3.5" /> 엑셀 다운로드
        </Button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">부과 대상</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{(filteredCandidates as any[]).length.toLocaleString()}명</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">미수금 있음</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{arrearsCount.toLocaleString()}명</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">미수금 합계</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{totalArrears > 0 ? totalArrears.toLocaleString() + "원" : "-"}</div>
        </div>
      </div>

      {/* 검색/필터 */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" /> 검색 및 필터
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">차량번호 / 성명</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="검색..."
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">지역</label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {["춘천시","강릉시","원주시","홍천군","횡성군","영월군","평창군","정선군","철원군","화천군","양구군","인제군","고성군","양양군"].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">구분</label>
              <Select value={memberType} onValueChange={setMemberType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="개인회원">개인회원</SelectItem>
                  <SelectItem value="택배회원">택배회원</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">미수금 여부</label>
              <Select value={arrearsFilter} onValueChange={setArrearsFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="있음">있음</SelectItem>
                  <SelectItem value="없음">없음</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 테이블 */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" /> 부과 대상자 목록
            </CardTitle>
            {!isLoading && (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 font-medium">
                {(filteredCandidates as any[]).length.toLocaleString()}명
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-500 pl-4">차량번호</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">성명</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">지역</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">부과항목</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">부과시작월</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 text-right">부과개월수</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 text-right">미납발생개월수</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 text-right">미수금</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">최근납부일</TableHead>
                </TableRow>
              </TableHeader>
              {isLoading ? <TableSkeleton /> : (
                <TableBody>
                  {(filteredCandidates as any[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16 text-center">
                        <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">부과 대상이 없습니다</p>
                        <p className="text-xs text-slate-300 mt-1">필터 조건을 변경해 보세요</p>
                      </TableCell>
                    </TableRow>
                  ) : (filteredCandidates as any[]).map((candidate: any) => {
                    const hasArrears = Number(candidate.currentArAmount || 0) > 0;
                    return (
                      <TableRow key={candidate.id} className={`border-b border-slate-50 hover:bg-slate-50 ${hasArrears ? "bg-red-50/30" : ""}`}>
                        <TableCell className="pl-4 py-2.5 font-mono font-semibold text-slate-900 text-sm">{candidate.vehicleNo || "-"}</TableCell>
                        <TableCell className="py-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCandidateId(candidate.id)}
                            className="font-medium text-slate-900 hover:text-indigo-700 hover:underline underline-offset-4"
                          >
                            {candidate.name}
                          </button>
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-600">{candidate.region || "-"}</TableCell>
                        <TableCell className="py-2.5">
                          <Badge className={`text-xs ${BILLING_TYPE_STYLE[candidate.billingType] || BILLING_TYPE_STYLE.확인필요}`}>
                            {candidate.billingType}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-600 font-mono">{candidate.billingStartMonth || "-"}</TableCell>
                        <TableCell className="py-2.5 text-sm text-right text-slate-700">{candidate.billingMonthCount || "-"}</TableCell>
                        <TableCell className="py-2.5 text-sm text-right">
                          {Number(candidate.unpaidMonthCount || 0) > 0 ? (
                            <span className="font-semibold text-red-600">{candidate.unpaidMonthCount}개월</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          {hasArrears ? (
                            <div className="flex items-center justify-end gap-1">
                              <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                              <span className="font-bold text-red-600 text-sm">{Number(candidate.currentArAmount).toLocaleString()}원</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-500 font-mono">{candidate.recentPaymentMonth || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      <CandidateDetailModal
        open={!!selectedCandidateId}
        onOpenChange={(open) => !open && setSelectedCandidateId(null)}
        candidateId={selectedCandidateId || 0}
      />
    </div>
  );
}
