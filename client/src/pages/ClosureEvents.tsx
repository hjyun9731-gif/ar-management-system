import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Filter, Building2, AlertCircle, FileSearch } from "lucide-react";
import { trpc } from "@/lib/trpc";

const REFLECT_STATUS_STYLE: Record<string, string> = {
  반영완료: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  미수금있음: "bg-violet-50 text-violet-700 border border-violet-200",
  확인필요: "bg-red-50 text-red-700 border border-red-200",
  보류: "bg-slate-100 text-slate-600 border border-slate-200",
};

const CLOSURE_TYPE_STYLE: Record<string, string> = {
  폐업: "bg-red-50 text-red-700 border border-red-200",
  양도: "bg-blue-50 text-blue-700 border border-blue-200",
  이관: "bg-amber-50 text-amber-700 border border-amber-200",
};

function TableSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

export default function ClosureEvents() {
  const [filters, setFilters] = useState({
    closureType: "all",
    reflectStatus: "all",
  });

  const { data: closures = [], isLoading } = trpc.billing.listClosures.useQuery({
    closureType: filters.closureType === "all" ? undefined : filters.closureType,
    reflectStatus: filters.reflectStatus === "all" ? undefined : filters.reflectStatus,
  });

  const handleExportExcel = () => {
    const headers = ["구분", "관리번호", "지역", "차량번호", "성명", "접수일자", "처리일자", "기존 미수금액", "반영상태"];
    const rows = closures.map((c: any) => [
      c.closureType || "", c.managementNo || "", c.region || "",
      c.vehicleNo || "", c.name || "", c.receiptDate || "",
      c.processDate || "", c.unpaidAmountAtClosure || 0, c.reflectStatus || "",
    ]);
    const csv = [headers, ...rows].map((row: any) => row.map((cell: any) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `closure_events_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const pendingCount = closures.filter((c: any) => c.reflectStatus !== "반영완료").length;

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">폐업·양도·이관 현황</h1>
          <p className="text-sm text-slate-500 mt-0.5">폐업/양도/이관 처리 현황 및 미수금 관리</p>
        </div>
        <Button onClick={handleExportExcel} variant="outline" size="sm" className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
          <Download className="w-3.5 h-3.5" />
          엑셀 다운로드
        </Button>
      </div>

      {/* Attention notice */}
      {!isLoading && pendingCount > 0 && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
          <p className="text-sm text-orange-800">
            반영 미완료 항목이 <strong>{pendingCount}건</strong> 있습니다. 처리 현황을 확인하세요.
          </p>
        </div>
      )}

      {/* Filter Card */}
      <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            필터
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">구분</label>
              <Select value={filters.closureType} onValueChange={(v) => setFilters({ ...filters, closureType: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="폐업">폐업</SelectItem>
                  <SelectItem value="양도">양도</SelectItem>
                  <SelectItem value="이관">이관</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">반영상태</label>
              <Select value={filters.reflectStatus} onValueChange={(v) => setFilters({ ...filters, reflectStatus: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="반영완료">반영완료</SelectItem>
                  <SelectItem value="미수금있음">미수금있음</SelectItem>
                  <SelectItem value="확인필요">확인필요</SelectItem>
                  <SelectItem value="보류">보류</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              폐업 현황 목록
            </CardTitle>
            {!isLoading && (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 font-medium">
                {closures.length.toLocaleString()}건
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
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide pl-5">구분</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">차량번호</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">성명</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">처리일자</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">기존 미수금액</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">제외시작월</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide pr-5">반영상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closures.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center">
                        <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">데이터가 없습니다</p>
                        <p className="text-xs text-slate-300 mt-1">필터 조건을 변경해 보세요</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    closures.map((closure: any) => (
                      <TableRow key={closure.id} className="hover:bg-slate-50 border-b border-slate-50">
                        <TableCell className="pl-5 py-3">
                          <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 ${CLOSURE_TYPE_STYLE[closure.closureType] ?? "bg-slate-100 text-slate-600"}`}>
                            {closure.closureType}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-slate-900 py-3">{closure.vehicleNo}</TableCell>
                        <TableCell className="text-sm text-slate-800 py-3">{closure.name}</TableCell>
                        <TableCell className="text-sm text-slate-600 py-3 font-mono">
                          {new Date(closure.processDate).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-sm font-semibold text-slate-900">
                            {(closure.unpaidAmountAtClosure || 0).toLocaleString()}원
                          </div>
                          {closure.unpaidAmountAtClosure > 0 && (
                            <div className="flex items-center gap-1 text-xs text-red-600 mt-0.5">
                              <AlertCircle className="w-3 h-3" />
                              미수금 있음
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm py-3 font-mono text-slate-700">
                          {closure.excludeStartMonth || <span className="text-slate-300">-</span>}
                        </TableCell>
                        <TableCell className="py-3 pr-5">
                          <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 ${REFLECT_STATUS_STYLE[closure.reflectStatus] ?? "bg-slate-100 text-slate-600"}`}>
                            {closure.reflectStatus}
                          </span>
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
    </div>
  );
}
