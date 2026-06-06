import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  SUCCESS: { bg: "bg-green-100", text: "text-green-800" },
  FAIL: { bg: "bg-red-100", text: "text-red-800" },
  WARNING: { bg: "bg-yellow-100", text: "text-yellow-800" },
};

export default function SyncLogs() {
  const [filters, setFilters] = useState({
    eventType: "",
    status: "",
  });

  const { data: logs = [], isLoading } = trpc.billing.listSyncLogs.useQuery(filters);

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
        <h1 className="text-3xl font-bold text-gray-900">연동 로그</h1>
        <p className="text-gray-600">외부 시스템 연동 이력 및 상태 확인</p>
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
              <label className="text-sm font-medium text-gray-700">이벤트 유형</label>
              <Select value={filters.eventType} onValueChange={(v) => setFilters({ ...filters, eventType: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  <SelectItem value="REGISTER">신규 등록</SelectItem>
                  <SelectItem value="CLOSURE">폐업 처리</SelectItem>
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
                  <SelectItem value="SUCCESS">성공</SelectItem>
                  <SelectItem value="FAIL">실패</SelectItem>
                  <SelectItem value="WARNING">경고</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">통계</label>
              <div className="flex gap-2 pt-2">
                <Badge className="bg-green-100 text-green-800">성공: {logs.filter((l: any) => l.status === "SUCCESS").length}</Badge>
                <Badge className="bg-red-100 text-red-800">실패: {logs.filter((l: any) => l.status === "FAIL").length}</Badge>
                <Badge className="bg-yellow-100 text-yellow-800">경고: {logs.filter((l: any) => l.status === "WARNING").length}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle>연동 로그 목록 ({logs.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-gray-700">이벤트</TableHead>
                  <TableHead className="text-gray-700">소스 ID</TableHead>
                  <TableHead className="text-gray-700">대상 ID</TableHead>
                  <TableHead className="text-gray-700">상태</TableHead>
                  <TableHead className="text-gray-700">메시지</TableHead>
                  <TableHead className="text-gray-700">생성 시간</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log: any) => (
                    <TableRow key={log.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm font-medium">{log.eventType}</TableCell>
                      <TableCell className="text-sm">{log.sourceId}</TableCell>
                      <TableCell className="text-sm">{log.targetId}</TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_COLORS[log.status]?.bg} ${STATUS_COLORS[log.status]?.text}`}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{log.message}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(log.createdAt).toLocaleString("ko-KR")}
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
