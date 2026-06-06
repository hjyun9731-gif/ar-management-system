import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function BillingRecords() {
  const [searchText, setSearchText] = useState("");

  const { data: records = [], isLoading } = trpc.billing.listBillingRecords.useQuery({});

  const handleExportExcel = () => {
    const headers = ["부과월", "부과액", "납부여부", "납부일자", "납부액"];
    const rows = records.map((r: any) => [
      r.billingMonth || "",
      r.amount || 0,
      r.isPaid ? "완납" : "미납",
      r.paidDate || "",
      r.paidAmount || 0,
    ]);

    const csv = [headers, ...rows].map((row: any) => row.map((cell: any) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `billing_records_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const totalAmount = records.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
  const totalPaid = records.reduce((sum: number, r: any) => sum + (r.paidAmount || 0), 0);
  const totalUnpaid = totalAmount - totalPaid;

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
        <h1 className="text-3xl font-bold text-gray-900">납부현황</h1>
        <p className="text-gray-600">월별 부과 및 납부 현황 관리</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">총 부과액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{totalAmount.toLocaleString()}</div>
            <p className="text-xs text-green-700 mt-2">원</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">납부액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{totalPaid.toLocaleString()}</div>
            <p className="text-xs text-blue-700 mt-2">원</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">미수금</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">{totalUnpaid.toLocaleString()}</div>
            <p className="text-xs text-red-700 mt-2">원</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-gray-200">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>검색 및 다운로드</CardTitle>
          <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4 mr-2" />
            엑셀 다운로드
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              placeholder="검색..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle>납부현황 목록 ({records.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-gray-700">부과월</TableHead>
                  <TableHead className="text-gray-700">부과액</TableHead>
                  <TableHead className="text-gray-700">납부여부</TableHead>
                  <TableHead className="text-gray-700">납부일자</TableHead>
                  <TableHead className="text-gray-700">납부액</TableHead>
                  <TableHead className="text-gray-700">미수금</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record: any) => (
                    <TableRow key={record.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm font-medium">{record.billingMonth}</TableCell>
                      <TableCell className="text-sm">{record.amount?.toLocaleString()}원</TableCell>
                      <TableCell>
                        <Badge className={record.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {record.isPaid ? "완납" : "미납"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{record.paidDate || "-"}</TableCell>
                      <TableCell className="text-sm">{record.paidAmount?.toLocaleString()}원</TableCell>
                      <TableCell className="text-sm font-medium text-red-600">
                        {(record.amount - record.paidAmount)?.toLocaleString()}원
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
