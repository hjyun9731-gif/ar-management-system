import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, History, Search, Trash2, X, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const PAYMENT_TYPE_STYLE: Record<string, string> = {
  협회비: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  관리비: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  자격증명발급비: "bg-purple-50 text-purple-700 border border-purple-200",
  협회가입비: "bg-amber-50 text-amber-700 border border-amber-200",
  기타: "bg-slate-100 text-slate-600 border border-slate-200",
};

const ACCOUNT_TYPE_STYLE: Record<string, string> = {
  미수금차감: "bg-red-50 text-red-600",
  잡수입: "bg-purple-50 text-purple-600",
  가수금: "bg-amber-50 text-amber-600",
  기타수입: "bg-slate-50 text-slate-500",
};

function money(value: unknown): string {
  const n = Number(value || 0);
  if (!n) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

export default function PaymentHistory() {
  const [search, setSearch] = useState("");
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelMemo, setCancelMemo] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);

  const { data: payments = [], isLoading, refetch } = trpc.billing.listPayments.useQuery({});
  const cancelPayment = trpc.billing.cancelPayment.useMutation({
    onSuccess: () => { toast.success("수납 취소 완료"); refetch(); setCancelId(null); setCancelMemo(""); },
    onError: e => toast.error(e.message),
  });
  const resetPayments = trpc.billing.resetPayments.useMutation({
    onSuccess: () => { toast.success("전체 초기화 완료"); refetch(); },
    onError: e => toast.error(e.message),
  });

  const filtered = (payments as any[]).filter(p => {
    if (!showCancelled && p.is_cancelled) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return String(p.vehicle_no || "").toLowerCase().includes(q) ||
      String(p.name || "").toLowerCase().includes(q) ||
      String(p.payment_type || "").toLowerCase().includes(q);
  });

  const activePayments = (payments as any[]).filter(p => !p.is_cancelled);
  const totalAmount = activePayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const arDeductions = activePayments.filter((p: any) => p.account_type === '미수금차감').reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const miscIncome = activePayments.filter((p: any) => p.account_type !== '미수금차감').reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  const handleExport = () => {
    const headers = ["수납일자", "차량번호", "성명", "지역", "항목", "회계구분", "금액", "대상월", "수납방식", "메모", "취소여부"];
    const rows = filtered.map((p: any) => [
      p.payment_date ? new Date(p.payment_date).toLocaleDateString("ko-KR") : "-",
      p.vehicle_no, p.name, p.region || "", p.payment_type, p.account_type,
      p.amount, p.target_month || "", p.payment_method || "", p.memo || "",
      p.is_cancelled ? "취소" : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `수납내역_${new Date().toISOString().split("T")[0]}.csv`; a.click();
  };

  return (
    <div className="ar-page ar-history-page space-y-5">
      <div className="ar-page-actions">
        <div />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" />CSV 다운로드</Button>
          <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => { if (confirm("수납내역을 전체 초기화하시겠습니까? 미수금은 복구되지 않습니다.")) resetPayments.mutate(); }}>
            <Trash2 className="h-4 w-4" />전체 초기화
          </Button>
        </div>
      </div>

      <div className="ar-summary-grid">
        <div><p>전체 수납건수</p><strong>{activePayments.length.toLocaleString()}</strong><span>건</span></div>
        <div><p>수납 총액</p><strong className="text-emerald-600">{totalAmount.toLocaleString()}</strong><span>원</span></div>
        <div><p>미수금 차감</p><strong className="text-blue-600">{arDeductions.toLocaleString()}</strong><span>원</span></div>
        <div><p>잡수입·가수금</p><strong className="text-purple-600">{miscIncome.toLocaleString()}</strong><span>원</span></div>
      </div>

      <Card className="ar-table-card">
        <CardHeader>
          <div className="ar-table-toolbar">
            <CardTitle><History className="h-4 w-4" />수납 내역 {filtered.length.toLocaleString()}건</CardTitle>
            <div className="ar-toolbar-fields">
              <div className="relative ar-search">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="차량번호/성명/항목 검색" className="pl-9" />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} className="h-3.5 w-3.5" />
                취소건 포함
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>수납일자</TableHead>
                  <TableHead>차량번호</TableHead>
                  <TableHead>성명</TableHead>
                  <TableHead>지역</TableHead>
                  <TableHead>항목</TableHead>
                  <TableHead>회계구분</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                  <TableHead>대상월</TableHead>
                  <TableHead>방식</TableHead>
                  <TableHead>메모</TableHead>
                  <TableHead className="text-center">취소</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>{[...Array(11)].map((__, j) => <TableCell key={j}><div className="h-4 animate-pulse rounded bg-slate-100" /></TableCell>)}</TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-16 text-center text-sm text-slate-400">
                      수납 내역이 없습니다. 미수금 명단에서 수납 처리를 진행하세요.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((p: any) => (
                  <TableRow key={p.id} className={p.is_cancelled ? "opacity-40 line-through" : ""}>
                    <TableCell className="font-mono text-sm">{p.payment_date ? new Date(p.payment_date).toLocaleDateString("ko-KR") : "-"}</TableCell>
                    <TableCell className="font-mono font-semibold text-sm">{p.vehicle_no}</TableCell>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-slate-500">{p.region || "-"}</TableCell>
                    <TableCell><Badge className={`text-xs ${PAYMENT_TYPE_STYLE[p.payment_type] || PAYMENT_TYPE_STYLE.기타}`}>{p.payment_type}</Badge></TableCell>
                    <TableCell><span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ACCOUNT_TYPE_STYLE[p.account_type] || ""}`}>{p.account_type}</span></TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 text-sm">+{Number(p.amount || 0).toLocaleString()}원</TableCell>
                    <TableCell className="text-sm text-slate-500 font-mono">{p.target_month || "-"}</TableCell>
                    <TableCell className="text-sm text-slate-500">{p.payment_method || "-"}</TableCell>
                    <TableCell className="text-sm text-slate-400 max-w-[100px] truncate">{p.memo || "-"}</TableCell>
                    <TableCell className="text-center">
                      {!p.is_cancelled && (
                        <button onClick={() => setCancelId(p.id)} className="text-xs text-red-500 hover:text-red-700">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 수납 취소 모달 */}
      {cancelId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-5 shadow-xl w-80">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold text-sm">수납 취소</h3>
            </div>
            <p className="text-sm text-slate-500 mb-3">협회비/관리비는 미수금이 복구됩니다.<br />잡수입/가수금/기타는 미수금 변동 없습니다.</p>
            <Input
              value={cancelMemo}
              onChange={e => setCancelMemo(e.target.value)}
              placeholder="취소 사유 (선택)"
              className="mb-3 h-9 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setCancelId(null)}>닫기</Button>
              <Button size="sm" variant="destructive"
                onClick={() => cancelPayment.mutate({ paymentId: cancelId, cancelMemo: cancelMemo || undefined })}
                disabled={cancelPayment.isPending}>
                취소 확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
