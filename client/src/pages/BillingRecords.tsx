import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, Receipt, TrendingUp, TrendingDown, FileSearch } from "lucide-react";
import { trpc } from "@/lib/trpc";

function SummaryCard({
  title,
  value,
  unit = "원",
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
}: {
  title: string;
  value: number;
  unit?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}) {
  return (
    <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">{title}</p>
            <p className={`text-lg font-bold ${valueColor}`}>
              {value.toLocaleString()}{unit}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}



function PaymentArrearsSummaryV66() {
  const query = trpc.billing.paymentHistoryCurrentArrears.useQuery(undefined, { retry: false });
  const rows = query.data || [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-semibold text-slate-900">납부이력 연동 요약 v66</div>
          <div className="text-xs text-slate-500 mt-1">
            과거 납부이력 DB 기준입니다. 부과시작월, 미납시작월, 미납개월수, 미수금, 최근납부일을 바로 확인합니다.
          </div>
        </div>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50"
          onClick={() => { window.location.href = "/payment-history"; }}
        >
          납부이력 상세
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="px-2 py-2">차량번호</th>
              <th className="px-2 py-2">성명</th>
              <th className="px-2 py-2">지역</th>
              <th className="px-2 py-2">부과항목</th>
              <th className="px-2 py-2">부과시작월</th>
              <th className="px-2 py-2">미납시작월</th>
              <th className="px-2 py-2 text-right">미납개월수</th>
              <th className="px-2 py-2 text-right">미수금</th>
              <th className="px-2 py-2">최근납부일</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row: any, index: number) => (
              <tr key={index} className="border-b">
                <td className="px-2 py-2 font-mono font-semibold">{row.vehicleNo}</td>
                <td className="px-2 py-2">{row.name}</td>
                <td className="px-2 py-2">{row.region || "-"}</td>
                <td className="px-2 py-2">{row.billingType || "-"}</td>
                <td className="px-2 py-2">{row.billingStartMonth || "-"}</td>
                <td className="px-2 py-2">{row.arrearsStartMonth || "-"}</td>
                <td className="px-2 py-2 text-right">{Number(row.arrearsMonths || 0).toLocaleString()}</td>
                <td className="px-2 py-2 text-right font-semibold text-red-600">{Number(row.arrearsAmount || 0).toLocaleString()}원</td>
                <td className="px-2 py-2">{row.recentPaymentMonth || "-"}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="px-2 py-6 text-center text-slate-500">
                  납부이력 DB 자료가 없습니다. 납부이력 추적 화면에서 ZIP 업로드 후 추출자료 저장을 먼저 진행하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BillingRecords() {
const [searchText, setSearchText] = useState("");

  const { data: records = [], isLoading } = trpc.billing.listBillingRecords.useQuery({});

  const filtered = searchText
    ? records.filter((r: any) => r.billingMonth?.includes(searchText))
    : records;

  const totalAmount = records.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
  const totalPaid = records.reduce((sum: number, r: any) => sum + (r.paidAmount || 0), 0);
  const totalUnpaid = totalAmount - totalPaid;

  const handleExportExcel = () => {
    const headers = ["부과월", "부과액", "납부여부", "납부일자", "납부액", "미수금"];
    const rows = records.map((r: any) => [
      r.billingMonth || "", r.amount || 0,
      r.isPaid ? "완납" : "미납",
      r.paidDate || "", r.paidAmount || 0,
      (r.amount || 0) - (r.paidAmount || 0),
    ]);
    const csv = [headers, ...rows].map((row: any) => row.map((cell: any) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `billing_records_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">납부현황</h1>
          <p className="text-sm text-slate-500 mt-0.5">월별 부과 및 납부 현황 관리</p>
        </div>
        <Button onClick={handleExportExcel} variant="outline" size="sm" className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
          <Download className="w-3.5 h-3.5" />
          엑셀 다운로드
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="총 부과액"
          value={totalAmount}
          icon={Receipt}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          valueColor="text-slate-900"
        />
        <SummaryCard
          title="납부액"
          value={totalPaid}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          valueColor="text-emerald-700"
        />
        <SummaryCard
          title="미수금"
          value={totalUnpaid}
          icon={TrendingDown}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          valueColor={totalUnpaid > 0 ? "text-red-700" : "text-slate-400"}
        />
      </div>

      {/* Search */}
      <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <CardContent className="px-5 py-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="부과월 검색 (예: 2026-06)"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-400" />
              납부현황 목록
            </CardTitle>
            {!isLoading && (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 font-medium">
                {filtered.length.toLocaleString()}건
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
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide pl-5">부과월</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">부과액</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">납부여부</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">납부일자</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">납부액</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide pr-5">미수금</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center">
                        <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">데이터가 없습니다</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((record: any) => {
                      const unpaid = (record.amount || 0) - (record.paidAmount || 0);
                      return (
                        <TableRow key={record.id} className="hover:bg-slate-50 border-b border-slate-50">
                          <TableCell className="text-sm font-semibold text-slate-900 pl-5 py-3 font-mono">
                            {record.billingMonth}
                          </TableCell>
                          <TableCell className="text-sm text-slate-800 py-3 tabular-nums">
                            {record.amount?.toLocaleString()}원
                          </TableCell>
                          <TableCell className="py-3">
                            {record.isPaid ? (
                              <span className="inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                완납
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 bg-red-50 text-red-700 border border-red-200">
                                미납
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 py-3 font-mono">
                            {record.paidDate || <span className="text-slate-300">-</span>}
                          </TableCell>
                          <TableCell className="text-sm text-slate-800 py-3 tabular-nums">
                            {record.paidAmount?.toLocaleString()}원
                          </TableCell>
                          <TableCell className={`text-sm font-semibold py-3 pr-5 tabular-nums ${unpaid > 0 ? "text-red-600" : "text-slate-400"}`}>
                            {unpaid > 0 ? `${unpaid.toLocaleString()}원` : "-"}
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









