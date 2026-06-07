import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Search } from "lucide-react";

type HistoryRow = {
  vehicleNo: string;
  name: string;
  month: string;
  billingType: string;
  unpaidAmount: number;
};

function findVehicle(text: string): string | undefined {
  const m = text.match(/강원\s*\d{2,3}\s*[가-힣]\s*\d{4}\s*호?/);
  return m?.[0]?.trim();
}

export default function PaymentHistory() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return rows;
    return rows.filter((r) => r.vehicleNo.includes(q) || r.name.includes(q));
  }, [rows, search]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const next: HistoryRow[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text().catch(() => "");
      const vehicle = findVehicle(text);
      if (vehicle) {
        next.push({ vehicleNo: vehicle, name: "", month: "", billingType: "", unpaidAmount: 0 });
      }
    }
    setRows(next);
    alert("임시 추출 " + next.length + "건. 엑셀 전체 파싱은 다음 단계에서 연결합니다.");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">납부이력 추적</h1>
        <p className="text-sm text-slate-500 mt-1">현재 부과대상자 기준으로 과거 납부·미수금 이력을 조회하는 화면입니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">자료 업로드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input ref={fileRef} type="file" multiple accept=".xlsx,.xlsm,.xls,.zip,.csv,.txt" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            엑셀/ZIP 선택
          </Button>
          <div className="text-sm text-slate-500">현재 화면은 빌드 복구용 기본 화면입니다. 전체 엑셀 파싱은 안정화 후 연결합니다.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">납부이력 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-slate-400" />
            <Input placeholder="차량번호/성명 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>차량번호</TableHead>
                <TableHead>성명</TableHead>
                <TableHead>월</TableHead>
                <TableHead>부과항목</TableHead>
                <TableHead className="text-right">미납액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.vehicleNo}</TableCell>
                  <TableCell>{r.name || "-"}</TableCell>
                  <TableCell>{r.month || "-"}</TableCell>
                  <TableCell>{r.billingType || "-"}</TableCell>
                  <TableCell className="text-right">{r.unpaidAmount.toLocaleString()}원</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
