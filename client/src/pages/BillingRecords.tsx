import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, AlertCircle, FileSearch, Users, Banknote } from "lucide-react";
import { trpc } from "@/lib/trpc";

type ArrearsRow = {
  vehicleNo?: string;
  name?: string;
  region?: string;
  billingType?: string;
  billingStartMonth?: string;
  billingMonthCount?: number;
  arrearsMonths?: number;
  arrearsAmount?: number;
  recentPaymentMonth?: string | null;
};

function money(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n === 0) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

const BILLING_TYPE_STYLE: Record<string, string> = {
  협회비: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  관리비: "bg-indigo-50 text-indigo-700 border border-indigo-200",
};

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

export default function BillingRecords() {
  const [search, setSearch] = useState("");
  const [arrearsFilter, setArrearsFilter] = useState("all");
  const query = trpc.billing.paymentHistoryCurrentArrears.useQuery(undefined, { retry: false });

  const rows = (query.data || []) as ArrearsRow[];

  const filteredRows = useMemo(() => {
    let list = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((row) =>
        String(row.vehicleNo || "").toLowerCase().includes(q) ||
        String(row.name || "").toLowerCase().includes(q) ||
        String(row.region || "").toLowerCase().includes(q) ||
        String(row.billingType || "").toLowerCase().includes(q)
      );
    }
    if (arrearsFilter === "있음") list = list.filter((row) => Number(row.arrearsAmount || 0) > 0);
    if (arrearsFilter === "없음") list = list.filter((row) => Number(row.arrearsAmount || 0) <= 0);
    return list;
  }, [rows, search, arrearsFilter]);

  const totalAmount = useMemo(() => rows.reduce((sum, row) => sum + Number(row.arrearsAmount || 0), 0), [rows]);
  const arrearsPeople = useMemo(() => rows.filter((row) => Number(row.arrearsAmount || 0) > 0).length, [rows]);

  return (
    <div className="ar-page space-y-5 max-w-7xl">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">납부현황</h1>
        <p className="text-sm text-slate-500 mt-0.5">납부이력 DB 기준 미수금 현황 요약</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
            <Users className="w-3.5 h-3.5" /> 납부이력 등록자
          </div>
          <div className="text-2xl font-bold text-slate-900">{rows.length.toLocaleString()}명</div>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-red-500 font-medium mb-1">
            <AlertCircle className="w-3.5 h-3.5" /> 미수금 있음
          </div>
          <div className="text-2xl font-bold text-red-600">{arrearsPeople.toLocaleString()}명</div>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-red-500 font-medium mb-1">
            <Banknote className="w-3.5 h-3.5" /> 미수금 합계
          </div>
          <div className="text-2xl font-bold text-red-600">{totalAmount > 0 ? totalAmount.toLocaleString() + "원" : "-"}</div>
        </div>
      </div>

      {/* 테이블 카드 */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="text-sm font-semibold text-slate-700">납부이력 연동 요약</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-9 h-9 text-sm"
                  placeholder="차량번호/성명/지역/부과항목 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={arrearsFilter} onValueChange={setArrearsFilter}>
                <SelectTrigger className="h-9 text-sm w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">미수금 전체</SelectItem>
                  <SelectItem value="있음">있음</SelectItem>
                  <SelectItem value="없음">없음</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isError && (
            <div className="mx-5 my-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              납부이력 조회 오류: {query.error.message}
            </div>
          )}
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
              {query.isLoading ? <TableSkeleton /> : (
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16 text-center">
                        <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">
                          {rows.length === 0 ? "납부이력 DB 자료가 없습니다" : "검색 결과가 없습니다"}
                        </p>
                        {rows.length === 0 && (
                          <p className="text-xs text-slate-300 mt-1">납부이력 추적 화면에서 ZIP 업로드 후 추출자료 저장을 진행하세요</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : filteredRows.map((row, index) => {
                    const hasArrears = Number(row.arrearsAmount || 0) > 0;
                    return (
                      <TableRow key={index} className={`border-b border-slate-50 hover:bg-slate-50 ${hasArrears ? "bg-red-50/20" : ""}`}>
                        <TableCell className="pl-4 py-2.5 font-mono font-semibold text-slate-900 text-sm">{row.vehicleNo || "-"}</TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-800 font-medium">{row.name || "-"}</TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-600">{row.region || "-"}</TableCell>
                        <TableCell className="py-2.5">
                          <Badge className={`text-xs ${BILLING_TYPE_STYLE[row.billingType || ""] || "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                            {row.billingType || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-600 font-mono">{row.billingStartMonth || "-"}</TableCell>
                        <TableCell className="py-2.5 text-sm text-right text-slate-600">
                          {Number(row.billingMonthCount || 0) > 0 ? (
                            <span>{Number(row.billingMonthCount).toLocaleString()}개월</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-right">
                          {Number(row.arrearsMonths || 0) > 0 ? (
                            <span className="font-semibold text-red-600">{Number(row.arrearsMonths).toLocaleString()}개월</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          {hasArrears ? (
                            <div className="flex items-center justify-end gap-1">
                              <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                              <span className="font-bold text-red-600 text-sm">{money(row.arrearsAmount)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-500 font-mono">{row.recentPaymentMonth || "-"}</TableCell>
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
