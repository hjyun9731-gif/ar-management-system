import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Filter, CheckCircle2, XCircle, AlertTriangle, Activity, FileSearch } from "lucide-react";
import { trpc } from "@/lib/trpc";

const STATUS_CONFIG: Record<string, { label: string; style: string; icon: React.ElementType }> = {
  SUCCESS: {
    label: "성공",
    style: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: CheckCircle2,
  },
  FAIL: {
    label: "실패",
    style: "bg-red-50 text-red-700 border border-red-200",
    icon: XCircle,
  },
  WARNING: {
    label: "경고",
    style: "bg-amber-50 text-amber-700 border border-amber-200",
    icon: AlertTriangle,
  },
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  REGISTER: "신규 등록",
  CLOSURE: "폐업 처리",
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

export default function SyncLogs() {
  const [filters, setFilters] = useState({
    eventType: "all",
    status: "all",
  });

  const { data: logs = [], isLoading } = trpc.billing.listSyncLogs.useQuery({
    eventType: filters.eventType === "all" ? undefined : filters.eventType,
    status: filters.status === "all" ? undefined : filters.status,
  });

  const successCount = logs.filter((l: any) => l.status === "SUCCESS").length;
  const failCount = logs.filter((l: any) => l.status === "FAIL").length;
  const warnCount = logs.filter((l: any) => l.status === "WARNING").length;

  return (
    <div className="ar-page space-y-5 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">연동 로그</h1>
        <p className="text-sm text-slate-500 mt-0.5">외부 시스템 연동 이력 및 상태 확인</p>
      </div>

      {/* Stats Row */}
      {!isLoading && logs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <div className="text-xl font-bold text-emerald-800 tabular-nums">{successCount}</div>
              <div className="text-xs text-emerald-600 font-medium">성공</div>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <div className="text-xl font-bold text-red-800 tabular-nums">{failCount}</div>
              <div className="text-xs text-red-600 font-medium">실패</div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <div className="text-xl font-bold text-amber-800 tabular-nums">{warnCount}</div>
              <div className="text-xs text-amber-600 font-medium">경고</div>
            </div>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">이벤트 유형</label>
              <Select value={filters.eventType} onValueChange={(v) => setFilters({ ...filters, eventType: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="REGISTER">신규 등록</SelectItem>
                  <SelectItem value="CLOSURE">폐업 처리</SelectItem>
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
                  <SelectItem value="SUCCESS">성공</SelectItem>
                  <SelectItem value="FAIL">실패</SelectItem>
                  <SelectItem value="WARNING">경고</SelectItem>
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
              <Activity className="w-4 h-4 text-slate-400" />
              연동 로그 목록
            </CardTitle>
            {!isLoading && (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 font-medium">
                {logs.length.toLocaleString()}건
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
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide pl-5">이벤트</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">소스 ID</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">대상 ID</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">상태</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">메시지</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide pr-5">생성 시간</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center">
                        <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">연동 로그가 없습니다</p>
                        <p className="text-xs text-slate-300 mt-1">필터 조건을 변경해 보세요</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log: any) => {
                      const cfg = STATUS_CONFIG[log.status];
                      const StatusIcon = cfg?.icon ?? Activity;
                      return (
                        <TableRow key={log.id} className="hover:bg-slate-50 border-b border-slate-50">
                          <TableCell className="pl-5 py-3">
                            <span className="text-sm font-medium text-slate-800">
                              {EVENT_TYPE_LABEL[log.eventType] ?? log.eventType}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 py-3 font-mono">{log.sourceId}</TableCell>
                          <TableCell className="text-sm text-slate-600 py-3 font-mono">{log.targetId}</TableCell>
                          <TableCell className="py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${cfg?.style ?? "bg-slate-100 text-slate-600"}`}>
                              <StatusIcon className="w-3 h-3" />
                              {cfg?.label ?? log.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 py-3 max-w-xs truncate">
                            {log.message || <span className="text-slate-300">-</span>}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 py-3 pr-5 font-mono whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString("ko-KR", {
                              year: "2-digit",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })
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
