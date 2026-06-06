import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Filter, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

const REFLECT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  반영완료: { bg: "bg-green-100", text: "text-green-800" },
  미수금있음: { bg: "bg-purple-100", text: "text-purple-800" },
  확인필요: { bg: "bg-red-100", text: "text-red-800" },
  보류: { bg: "bg-gray-100", text: "text-gray-800" },
};

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
      c.closureType || "",
      c.managementNo || "",
      c.region || "",
      c.vehicleNo || "",
      c.name || "",
      c.receiptDate || "",
      c.processDate || "",
      c.unpaidAmountAtClosure || 0,
      c.reflectStatus || "",
    ]);

    const csv = [headers, ...rows].map((row: any) => row.map((cell: any) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `closure_events_${new Date().toISOString().split("T")[0]}.csv`;
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
        <h1 className="text-3xl font-bold text-gray-900">폐업 현황</h1>
        <p className="text-gray-600">폐업/양도/이관 처리 현황 관리</p>
      </div>

      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>필터</span>
            <Filter className="w-5 h-5 text-gray-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">구분</label>
              <Select value={filters.closureType} onValueChange={(v) => setFilters({ ...filters, closureType: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="폐업">폐업</SelectItem>
                  <SelectItem value="양도">양도</SelectItem>
                  <SelectItem value="이관">이관</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">반영상태</label>
              <Select value={filters.reflectStatus} onValueChange={(v) => setFilters({ ...filters, reflectStatus: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
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
          <CardTitle>폐업 현황 목록 ({closures.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-gray-700">구분</TableHead>
                  <TableHead className="text-gray-700">차량번호</TableHead>
                  <TableHead className="text-gray-700">성명</TableHead>
                  <TableHead className="text-gray-700">처리일자</TableHead>
                  <TableHead className="text-gray-700">기존 미수금액</TableHead>
                  <TableHead className="text-gray-700">제외시작월</TableHead>
                  <TableHead className="text-gray-700">반영상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  closures.map((closure: any) => (
                    <TableRow key={closure.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm font-medium">{closure.closureType}</TableCell>
                      <TableCell className="text-sm font-medium">{closure.vehicleNo}</TableCell>
                      <TableCell className="text-sm">{closure.name}</TableCell>
                      <TableCell className="text-sm">{new Date(closure.processDate).toLocaleDateString("ko-KR")}</TableCell>
                      <TableCell className="text-sm font-medium">
                        <span>{(closure.unpaidAmountAtClosure || 0).toLocaleString()}원</span>
                        {closure.unpaidAmountAtClosure > 0 && (
                          <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                            <AlertCircle className="w-3 h-3" />
                            미수금 있음
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">
                        {closure.excludeStartMonth ? (
                          <span className="font-medium">{closure.excludeStartMonth}</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${REFLECT_STATUS_COLORS[closure.reflectStatus]?.bg} ${REFLECT_STATUS_COLORS[closure.reflectStatus]?.text}`}>
                          {closure.reflectStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
