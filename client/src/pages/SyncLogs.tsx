import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, RefreshCw, Search, Trash2, Upload, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PaymentModal } from "@/components/PaymentModal";

const MATCH_STATUS_STYLE: Record<string, string> = {
  미매칭: "bg-slate-100 text-slate-600 border border-slate-200",
  자동매칭: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  후보있음: "bg-amber-50 text-amber-700 border border-amber-200",
  수동매칭: "bg-blue-50 text-blue-700 border border-blue-200",
  수납처리: "bg-green-100 text-green-800 border border-green-300",
  제외: "bg-slate-100 text-slate-400 border border-slate-200",
};

// 통장 거래내역 파싱 (엑셀/텍스트)
function parseBankStatementText(text: string): { depositor: string; amount: number; balanceAfter: number; note: string; rawText: string }[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  const results: any[] = [];
  for (const line of lines) {
    const cols = line.split(/\t/);
    if (cols.length >= 3) {
      const amounts = cols.map(c => Number(String(c).replace(/,/g, '').replace(/원/g, '').trim())).filter(n => n > 0 && n < 1_000_000_000);
      if (amounts.length >= 1) {
        results.push({
          depositor: cols[0]?.trim() || '',
          amount: amounts[0] || 0,
          balanceAfter: amounts[1] || 0,
          note: cols.slice(1, -1).join(' ').trim(),
          rawText: line,
        });
      }
    }
  }
  return results;
}

function parseBankExcel(wb: XLSX.WorkBook): any[] {
  const results: any[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    for (const row of matrix.slice(1)) {
      const amounts = row.map((c: any) => Number(String(c).replace(/,/g, '').trim())).filter((n: number) => n > 0 && n < 1_000_000_000);
      if (amounts.length < 1) continue;
      results.push({
        depositor: String(row[0] || '').trim(),
        amount: amounts[0],
        balanceAfter: amounts[1] || 0,
        note: row.slice(1, 3).map((c: any) => String(c || '')).join(' ').trim(),
        rawText: row.join('\t'),
      });
    }
  }
  return results;
}

export default function SyncLogs() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [manualSearchText, setManualSearchText] = useState('');
  const [paymentTarget, setPaymentTarget] = useState<any | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: transactions = [], isLoading, refetch } = trpc.billing.listBankTransactions.useQuery({
    matchStatus: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });
  const { data: candidates = [] } = trpc.billing.listCandidatesWithArrears.useQuery({});

  const importTx = trpc.billing.importBankTransactions.useMutation({
    onSuccess: r => { toast.success(`${r.inserted}건 등록`); refetch(); },
    onError: e => toast.error(e.message),
  });
  const autoMatch = trpc.billing.autoMatchBankTransactions.useMutation({
    onSuccess: r => { toast.success(`자동매칭 ${r.matched}/${r.total}건`); refetch(); },
    onError: e => toast.error(e.message),
  });
  const manualMatch = trpc.billing.matchBankTransaction.useMutation({
    onSuccess: () => { toast.success('수동매칭 완료'); refetch(); setSelectedTx(null); },
    onError: e => toast.error(e.message),
  });
  const excludeTx = trpc.billing.excludeBankTransaction.useMutation({
    onSuccess: () => { toast.success('제외 처리'); refetch(); },
    onError: e => toast.error(e.message),
  });
  const resetAll = trpc.billing.resetBankTransactions.useMutation({
    onSuccess: () => { toast.success('초기화 완료'); refetch(); },
  });

  async function handleFile(files: FileList) {
    const batch = new Date().toISOString();
    const rows: any[] = [];
    for (const file of Array.from(files)) {
      if (file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        rows.push(...parseBankExcel(wb));
      }
    }
    if (!rows.length) { toast.error('파싱된 거래내역이 없습니다'); return; }
    importTx.mutate({ batch, rows });
  }

  function handlePaste() {
    const rows = parseBankStatementText(pasteText);
    if (!rows.length) { toast.error('파싱된 거래내역이 없습니다'); return; }
    importTx.mutate({ batch: new Date().toISOString(), rows });
    setPasteText(''); setShowPaste(false);
  }

  const txList = transactions as any[];
  const unmatched = txList.filter(t => t.match_status === '미매칭').length;
  const autoMatched = txList.filter(t => t.match_status === '자동매칭').length;
  const candidate = txList.filter(t => t.match_status === '후보있음').length;
  const processed = txList.filter(t => t.match_status === '수납처리').length;

  const candidateList = candidates as any[];
  const filteredCandidates = manualSearchText
    ? candidateList.filter(c =>
        String(c.name || '').includes(manualSearchText) ||
        String(c.vehicleNo || '').includes(manualSearchText)
      )
    : candidateList;

  return (
    <div className="ar-page ar-matching-page space-y-5 max-w-7xl">
      {/* 상단 통계 */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '전체 입금', value: txList.length, colorClass: 'bg-blue-50 border-blue-200 text-blue-600' },
          { label: '미매칭', value: unmatched, colorClass: 'bg-slate-50 border-slate-200 text-slate-600' },
          { label: '자동매칭', value: autoMatched, colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-600' },
          { label: '후보있음', value: candidate, colorClass: 'bg-amber-50 border-amber-200 text-amber-600' },
          { label: '수납처리', value: processed, colorClass: 'bg-green-50 border-green-200 text-green-700' },
        ].map(s => (
          <div key={s.label} className={`${s.colorClass} border rounded-xl px-4 py-3 flex items-center gap-3`}>
            <CreditCard className="w-5 h-5 flex-shrink-0" />
            <div><div className="text-xl font-bold tabular-nums">{s.value}</div><div className="text-xs font-medium">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* 액션 바 */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardContent className="px-5 py-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm" multiple className="hidden"
              onChange={e => e.target.files && handleFile(e.target.files)} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />엑셀 업로드
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowPaste(true)}>
              복사/붙여넣기
            </Button>
            <Button size="sm" onClick={() => autoMatch.mutate()} disabled={autoMatch.isPending}>
              <Zap className="h-4 w-4" />{autoMatch.isPending ? '매칭 중...' : '자동 매칭'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />새로고침
            </Button>
            <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 ml-auto"
              onClick={() => { if (confirm('통장 거래내역을 전체 초기화하시겠습니까?')) resetAll.mutate(); }}>
              <Trash2 className="h-4 w-4" />초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 필터 */}
      <div className="ar-filter-chips">
        {['all', '미매칭', '후보있음', '자동매칭', '수동매칭', '수납처리', '제외'].map(s => (
          <button key={s} className={statusFilter === s ? 'is-active' : ''} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? '전체' : s}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="입금자명 검색" className="pl-7 pr-3 py-1 text-xs border border-slate-200 rounded-md" />
        </div>
      </div>

      {/* 거래내역 테이블 */}
      <Card className="ar-table-card">
        <CardHeader>
          <div className="ar-table-toolbar">
            <CardTitle><CreditCard className="h-4 w-4" />통장 거래내역 {txList.length}건</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>거래일자</TableHead>
                  <TableHead>입금자명</TableHead>
                  <TableHead>거래기록</TableHead>
                  <TableHead className="text-right">입금액</TableHead>
                  <TableHead>매칭상태</TableHead>
                  <TableHead>매칭 회원</TableHead>
                  <TableHead className="text-center">처리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(6)].map((_, i) => <TableRow key={i}>{[...Array(7)].map((__, j) => <TableCell key={j}><div className="h-4 animate-pulse rounded bg-slate-100" /></TableCell>)}</TableRow>)
                ) : txList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center text-sm text-slate-400">
                      통장 거래내역이 없습니다. 엑셀을 업로드하거나 복사/붙여넣기로 등록하세요.
                    </TableCell>
                  </TableRow>
                ) : txList.map((tx: any) => (
                  <TableRow key={tx.id} className={tx.is_excluded ? 'opacity-40' : ''}>
                    <TableCell className="font-mono text-sm">
                      {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('ko-KR') : '-'}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{tx.depositor || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[160px] truncate">{tx.transaction_note || '-'}</TableCell>
                    <TableCell className="text-right font-bold text-blue-700 text-sm">{Number(tx.amount || 0).toLocaleString()}원</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${MATCH_STATUS_STYLE[tx.match_status] || MATCH_STATUS_STYLE.미매칭}`}>
                        {tx.match_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{tx.matched_candidate_name || '-'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        {tx.match_status !== '수납처리' && !tx.is_excluded && (
                          <>
                            <Button size="sm" className="h-7 px-2 text-xs ar-payment-button"
                              onClick={() => {
                                const cand = candidateList.find(c => c.id === tx.matched_candidate_id);
                                setPaymentTarget({ tx, candidate: cand });
                              }}>
                              수납
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                              onClick={() => setSelectedTx(tx)}>
                              {tx.match_status === '후보있음' || tx.match_status === '자동매칭' ? '후보확인' : '수동매칭'}
                            </Button>
                            <button className="text-xs text-slate-400 hover:text-red-500 px-1"
                              onClick={() => excludeTx.mutate({ txId: tx.id, reason: '수동 제외' })}>
                              제외
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 붙여넣기 팝업 */}
      {showPaste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-5 shadow-xl w-[480px]">
            <h3 className="font-semibold text-sm mb-2">통장 거래내역 붙여넣기</h3>
            <p className="text-xs text-slate-400 mb-3">인터넷뱅킹의 거래내역을 복사하여 붙여넣으세요.<br />탭 구분 형식: 입금자명 | 금액 | 잔액 | 적요</p>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              className="w-full h-48 rounded-md border p-3 text-xs font-mono resize-none"
              placeholder="여기에 붙여넣기..."
            />
            <div className="flex gap-2 justify-end mt-3">
              <Button variant="outline" size="sm" onClick={() => { setShowPaste(false); setPasteText(''); }}>취소</Button>
              <Button size="sm" onClick={handlePaste} disabled={!pasteText.trim()}>등록</Button>
            </div>
          </div>
        </div>
      )}

      {/* 수동매칭 팝업 */}
      {selectedTx && (
        <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base">후보확인 / 수동매칭</DialogTitle>
            </DialogHeader>
            <div className="bg-slate-50 rounded-lg p-3 text-sm mb-3">
              <div className="font-medium">{selectedTx.depositor} · {Number(selectedTx.amount).toLocaleString()}원</div>
              <div className="text-xs text-slate-400 mt-0.5">{selectedTx.transaction_note}</div>
            </div>
            <Input
              value={manualSearchText}
              onChange={e => setManualSearchText(e.target.value)}
              placeholder="이름 또는 차량번호로 검색"
              className="mb-3 h-9 text-sm"
            />
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              {filteredCandidates.slice(0, 50).map((c: any) => (
                <button key={c.id}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-50 flex items-center justify-between ${selectedTx.matched_candidate_id === c.id ? 'bg-blue-50' : ''}`}
                  onClick={() => manualMatch.mutate({ txId: selectedTx.id, candidateId: c.id, candidateName: c.name })}>
                  <span><span className="font-mono font-semibold mr-2">{c.vehicleNo}</span>{c.name}</span>
                  <span className={`text-xs ${Number(c.currentArAmount || 0) > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                    {Number(c.currentArAmount || 0).toLocaleString()}원
                  </span>
                </button>
              ))}
              {filteredCandidates.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">검색 결과가 없습니다</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 수납 처리 (통장매칭에서) */}
      {paymentTarget && (
        <PaymentModal
          open={!!paymentTarget}
          onOpenChange={open => { if (!open) setPaymentTarget(null); }}
          candidateId={paymentTarget.candidate?.id}
          vehicleNo={paymentTarget.candidate?.vehicleNo || paymentTarget.tx.matched_candidate_name || paymentTarget.tx.depositor || ''}
          name={paymentTarget.candidate?.name || paymentTarget.tx.matched_candidate_name || ''}
          region={paymentTarget.candidate?.region}
          currentArAmount={paymentTarget.candidate?.currentArAmount}
          billingType={paymentTarget.candidate?.billingType}
          sourceBankTxId={paymentTarget.tx.id}
          onSuccess={() => { setPaymentTarget(null); refetch(); }}
        />
      )}
    </div>
  );
}
