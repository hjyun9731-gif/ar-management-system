import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Filter, Building2, AlertCircle, FileSearch, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";

const CLOSURE_TYPE_STYLE: Record<string, string> = {
  폐업: "bg-red-50 text-red-700 border border-red-200",
  양도: "bg-blue-50 text-blue-700 border border-blue-200",
  이관: "bg-amber-50 text-amber-700 border border-amber-200",
  탈퇴: "bg-slate-100 text-slate-600 border border-slate-200",
  타도: "bg-purple-50 text-purple-700 border border-purple-200",
};

function money(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n === 0) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

function formatDate(value: unknown): string {
  if (!value) return "-";
  try {
    return new Date(String(value)).toLocaleDateString("ko-KR");
  } catch {
    return String(value);
  }
}

function TableSkeleton() {
  return (
    <TableBody>
      {[...Array(6)].map((_, i) => (
        <TableRow key={i}>
          {[...Array(10)].map((__, j) => (
            <TableCell key={j}>
              <div className="h-4 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

export default function ClosureEvents() {
  const [closureType, setClosureType] = useState("all");
  const [searchText, setSearchText] = useState("");

  const { data: closures = [], isLoading } = trpc.billing.listClosuresWithArrears.useQuery({
    closureType: closureType === "all" ? undefined : closureType,
    search: searchText.trim() || undefined,
  });

  const arrearsCount = (closures as any[]).filter((c) => Number(c.currentArAmount || 0) > 0).length;
  const totalArrears = (closures as any[]).reduce((sum, c) => sum + Number(c.currentArAmount || 0), 0);

  const handleExport = () => {
    const headers = ["처리구분", "처리일자", "차량번호", "성명", "지역", "미수금", "미납발생개월수", "최근납부일", "비고"];
    const rows = (closures as any[]).map((c) => [
      c.closureType || "", formatDate(c.processDate),
      c.vehicleNo || "", c.name || "", c.region || "",
      c.currentArAmount || 0, c.unpaidMonthCount || 0,
      c.recentPaymentMonth || "", c.memo || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `closure_events_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-5 space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">폐업·양도·이관 현황</h1>
          <p className="text-sm text-slate-500 mt-0.5">종료 처리 회원 현황 및 잔여 미수금 관리</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
          <Download className="w-3.5 h-3.5" /> 엑셀 다운로드
        </Button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">전체 건수</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{(closures as any[]).length.toLocaleString()}건</div>
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

      {/* 미완료 알림 */}
      {!isLoading && arrearsCount > 0 && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
          <p className="text-sm text-orange-800">
            미수금 미처리 항목이 <strong>{arrearsCount}건</strong> 있습니다. 확인 후 처리하세요.
          </p>
        </div>
      )}

      {/* 검색/필터 */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" /> 검색 및 필터
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <label className="text-xs font-medium text-slate-500 block mb-1.5">처리구분</label>
              <Select value={closureType} onValueChange={setClosureType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="폐업">폐업</SelectItem>
                  <SelectItem value="양도">양도</SelectItem>
                  <SelectItem value="이관">이관</SelectItem>
                  <SelectItem value="탈퇴">탈퇴</SelectItem>
                  <SelectItem value="타도">타도</SelectItem>
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
              <Building2 className="w-4 h-4 text-slate-400" /> 폐업·양도·이관 목록
            </CardTitle>
            {!isLoading && (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 font-medium">
                {(closures as any[]).length.toLocaleString()}건
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-500 pl-4">처리구분</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">처리일자</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">차량번호</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">성명</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">지역</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 text-right">미수금</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 text-right">미납발생개월수</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">최근납부일</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">비고</TableHead>
                </TableRow>
              </TableHeader>
              {isLoading ? <TableSkeleton /> : (
                <TableBody>
                  {(closures as any[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16 text-center">
                        <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">데이터가 없습니다</p>
                        <p className="text-xs text-slate-300 mt-1">필터 조건을 변경해 보세요</p>
                      </TableCell>
                    </TableRow>
                  ) : (closures as any[]).map((closure: any) => {
                    const arAmount = Number(closure.currentArAmount || 0);
                    const hasArrears = arAmount > 0;
                    return (
                      <TableRow key={closure.id} className={`border-b border-slate-50 hover:bg-slate-50 ${hasArrears ? "bg-red-50/20" : ""}`}>
                        <TableCell className="pl-4 py-2.5">
                          <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border ${CLOSURE_TYPE_STYLE[closure.closureType] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {closure.closureType || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-600 font-mono">{formatDate(closure.processDate)}</TableCell>
                        <TableCell className="py-2.5 font-mono font-semibold text-slate-900 text-sm">{closure.vehicleNo || "-"}</TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-800 font-medium">{closure.name || "-"}</TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-600">{closure.region || "-"}</TableCell>
                        <TableCell className="py-2.5 text-right">
                          {hasArrears ? (
                            <div className="flex items-center justify-end gap-1">
                              <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                              <span className="font-bold text-red-600 text-sm">{arAmount.toLocaleString()}원</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">미수 없음</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-right">
                          {Number(closure.unpaidMonthCount || 0) > 0 ? (
                            <span className="font-semibold text-red-600">{closure.unpaidMonthCount}개월</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-500 font-mono">{closure.recentPaymentMonth || "-"}</TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-400 max-w-[140px] truncate">{closure.memo || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
