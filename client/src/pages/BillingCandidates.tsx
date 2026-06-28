import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSearch, Receipt, Search, Trash2, TrendingDown, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CandidateDetailModal } from "@/components/CandidateDetailModal";
import { PaymentModal } from "@/components/PaymentModal";
import { ClosureModal } from "@/components/ClosureModal";

const BILLING_TYPE_STYLE: Record<string, string> = {
  협회비: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  관리비: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  확인필요: "bg-amber-50 text-amber-700 border border-amber-200",
};

type SelectedCandidate = {
  id: number;
  vehicleNo: string;
  name: string;
  region?: string;
  currentArAmount?: number;
  billingType?: string;
};

export default function BillingCandidates() {
  const [region, setRegion] = useState("all");
  const [memberType, setMemberType] = useState("all");
  const [arrearsFilter, setArrearsFilter] = useState("all");
  const [billingTypeFilter, setBillingTypeFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState("balance-desc");
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  // 수납 처리 모달
  const [paymentTarget, setPaymentTarget] = useState<SelectedCandidate | null>(null);
  // 폐업 처리 모달
  const [closureTarget, setClosureTarget] = useState<SelectedCandidate | null>(null);

  const { data: candidates = [], isLoading, refetch } = trpc.billing.listCandidatesWithArrears.useQuery({
    region: region === "all" ? undefined : region,
    memberType: memberType === "all" ? undefined : memberType,
    search: searchText.trim() || undefined,
  });

  const filteredCandidates = useMemo(() => {
    let list = candidates as any[];
    if (searchText.trim()) {
      const query = searchText.trim().toLowerCase();
      list = list.filter((candidate) => String(candidate.vehicleNo || "").toLowerCase().includes(query) || String(candidate.name || "").toLowerCase().includes(query));
    }
    if (arrearsFilter === "있음") list = list.filter((candidate) => Number(candidate.currentArAmount || 0) > 0);
    if (arrearsFilter === "완납") list = list.filter((candidate) => Number(candidate.currentArAmount || 0) === 0);
    if (arrearsFilter === "선납") list = list.filter((candidate) => Number(candidate.currentArAmount || 0) < 0);
    if (arrearsFilter === "없음") list = list.filter((candidate) => Number(candidate.currentArAmount || 0) <= 0);
    if (arrearsFilter === "12개월이상") list = list.filter((candidate) => Number(candidate.unpaidMonthCount || 0) >= 12);
    if (billingTypeFilter !== "all") list = list.filter((candidate) => candidate.billingType === billingTypeFilter);
    return [...list].sort((a, b) => {
      if (sortBy === "balance-asc") return Number(a.currentArAmount || 0) - Number(b.currentArAmount || 0);
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""), "ko");
      return Number(b.currentArAmount || 0) - Number(a.currentArAmount || 0);
    });
  }, [candidates, searchText, arrearsFilter, billingTypeFilter, sortBy]);

  const arrearsCount = filteredCandidates.filter((candidate) => Number(candidate.currentArAmount || 0) > 0).length;
  const prepaidCount = filteredCandidates.filter((candidate) => Number(candidate.currentArAmount || 0) < 0).length;
  const totalArrears = filteredCandidates.reduce((sum, candidate) => sum + Number(candidate.currentArAmount || 0), 0);
  const over12MonthCount = filteredCandidates.filter((candidate) => Number(candidate.unpaidMonthCount || 0) >= 12).length;

  const cleanupMutation = trpc.billing.cleanupGeneratedManagementNumbers.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCleanup = () => {
    if (!confirm("원본에 없는 자동생성 관리번호만 비웁니다.\n실제 관리번호는 유지됩니다. 진행할까요?")) return;
    cleanupMutation.mutate();
  };

  const handleDownload = () => {
    const headers = ["차량번호", "성명", "지역", "구분", "부과항목", "부과시작월", "부과개월수", "미납발생개월수", "현재잔액", "최근납부월"];
    const rows = filteredCandidates.map((candidate) => [candidate.vehicleNo || "", candidate.name || "", candidate.region || "", candidate.memberType || "", candidate.billingType || "", candidate.billingStartMonth || "", candidate.billingMonthCount || 0, candidate.unpaidMonthCount || 0, candidate.currentArAmount || 0, candidate.recentPaymentMonth || ""]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `billing_candidates_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="ar-page ar-candidates-page space-y-5">
      <div className="ar-page-actions">
        <div />
        <div className="flex gap-2">
          <Button onClick={handleCleanup} variant="outline" size="sm" disabled={cleanupMutation.isPending} className="text-amber-600 border-amber-200 hover:bg-amber-50">
            <Trash2 className="h-4 w-4" />
            {cleanupMutation.isPending ? "초기화 중..." : "자동생성 관리번호 초기화"}
          </Button>
          <Button onClick={handleDownload} variant="outline" size="sm"><Download className="h-4 w-4" />엑셀 다운로드</Button>
        </div>
      </div>

      <div className="ar-summary-grid">
        <div><p>전체 관리 대상</p><strong>{filteredCandidates.length.toLocaleString()}</strong><span>명</span></div>
        <div><p>미수금 있음</p><strong className="text-red-600">{arrearsCount.toLocaleString()}</strong><span>명</span></div>
        <div><p>선납/초과</p><strong className="text-blue-600">{prepaidCount.toLocaleString()}</strong><span>명</span></div>
        <div>
          <p>현재잔액 합계</p>
          <strong className={totalArrears > 0 ? "text-red-600" : totalArrears < 0 ? "text-blue-600" : ""}>
            {totalArrears.toLocaleString()}
          </strong>
          <span>원</span>
        </div>
        <div><p>12개월 이상 미납</p><strong className="text-orange-600">{over12MonthCount.toLocaleString()}</strong><span>명</span></div>
      </div>

      <div className="ar-filter-chips">
        {[
          { value: "all", label: "전체" },
          { value: "있음", label: "미수금 있음" },
          { value: "완납", label: "완납/0원" },
          { value: "선납", label: "선납/초과" },
          { value: "없음", label: "미수금 없음(완납+선납)" },
          { value: "12개월이상", label: "12개월 이상" },
        ].map((item) => (
          <button key={item.value} className={arrearsFilter === item.value ? "is-active" : ""} onClick={() => setArrearsFilter(item.value)}>
            {item.label}
          </button>
        ))}
        <span className="mx-1 text-slate-200">|</span>
        {[
          { value: "all", label: "전체항목" },
          { value: "협회비", label: "협회비" },
          { value: "관리비", label: "관리비" },
        ].map((item) => (
          <button key={item.value} className={billingTypeFilter === item.value ? "is-active" : ""} onClick={() => setBillingTypeFilter(item.value)}>
            {item.label}
          </button>
        ))}
        <span>실제 DB 조회 결과 기준</span>
      </div>

      <Card className="ar-table-card">
        <CardHeader>
          <div className="ar-table-toolbar">
            <CardTitle><Users className="h-4 w-4" />미수금 회원 {filteredCandidates.length.toLocaleString()}명</CardTitle>
            <div className="ar-toolbar-fields">
              <div className="relative ar-search">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="이름 또는 차량번호 검색" className="pl-9" />
              </div>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger><SelectValue placeholder="지역 전체" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">지역 전체</SelectItem>
                  {["춘천시", "강릉시", "원주시", "횡성군", "평창군", "정선군", "철원군", "화천군", "양구군", "인제군", "고성군", "양양군"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={memberType} onValueChange={setMemberType}>
                <SelectTrigger><SelectValue placeholder="회원 구분" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">회원 전체</SelectItem>
                  <SelectItem value="개인회원">개인회원</SelectItem>
                  <SelectItem value="법인회원">법인회원</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance-desc">현재잔액 높은순</SelectItem>
                  <SelectItem value="balance-asc">현재잔액 낮은순</SelectItem>
                  <SelectItem value="name">이름순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>차량번호</TableHead>
                  <TableHead>성명</TableHead>
                  <TableHead>지역</TableHead>
                  <TableHead>부과항목</TableHead>
                  <TableHead>부과시작월</TableHead>
                  <TableHead className="text-right">부과개월</TableHead>
                  <TableHead className="text-right">미수개월</TableHead>
                  <TableHead className="text-right">현재잔액</TableHead>
                  <TableHead>최근납부월</TableHead>
                  <TableHead className="text-center">처리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(7)].map((_, index) => (
                    <TableRow key={index}>
                      {[...Array(10)].map((__, cell) => <TableCell key={cell}><div className="h-4 animate-pulse rounded bg-slate-100" /></TableCell>)}
                    </TableRow>
                  ))
                ) : filteredCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-16 text-center">
                      <FileSearch className="mx-auto mb-3 h-9 w-9 text-slate-200" />
                      <p className="text-sm text-slate-400">조회 결과가 없습니다.</p>
                    </TableCell>
                  </TableRow>
                ) : filteredCandidates.map((candidate) => {
                  const balance = Number(candidate.currentArAmount || 0);
                  const unpaidMonths = Number(candidate.unpaidMonthCount || 0);
                  return (
                    <TableRow key={candidate.id} className={unpaidMonths >= 12 ? "bg-orange-50/30" : ""}>
                      <TableCell className="font-mono font-semibold">{candidate.vehicleNo || "-"}</TableCell>
                      <TableCell>
                        <button className="font-medium hover:text-blue-600" onClick={() => setSelectedCandidateId(candidate.id)}>
                          {candidate.name || "-"}
                        </button>
                      </TableCell>
                      <TableCell>{candidate.region || "-"}</TableCell>
                      <TableCell>
                        <Badge className={BILLING_TYPE_STYLE[candidate.billingType] || BILLING_TYPE_STYLE.확인필요}>
                          {candidate.billingType || "확인필요"}
                        </Badge>
                      </TableCell>
                      <TableCell>{candidate.billingStartMonth || "-"}</TableCell>
                      <TableCell className="text-right">{candidate.billingMonthCount || "-"}</TableCell>
                      <TableCell className={`text-right font-semibold ${unpaidMonths >= 12 ? "text-orange-600" : ""}`}>
                        {candidate.unpaidMonthCount || "-"}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${balance > 0 ? "text-red-600" : balance < 0 ? "text-blue-600" : "text-slate-400"}`}>
                        {balance !== 0 ? `${balance.toLocaleString()}원` : "-"}
                        {balance < 0 && <span className="ml-1 text-xs font-normal text-blue-400">(선납)</span>}
                      </TableCell>
                      <TableCell>{candidate.recentPaymentMonth || "-"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" className="ar-payment-button h-7 px-2 text-xs"
                            onClick={() => setPaymentTarget({
                              id: candidate.id,
                              vehicleNo: candidate.vehicleNo,
                              name: candidate.name,
                              region: candidate.region,
                              currentArAmount: candidate.currentArAmount,
                              billingType: candidate.billingType,
                            })}>
                            <Receipt className="h-3 w-3" />수납
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-500 border-red-200 hover:bg-red-50"
                            onClick={() => setClosureTarget({
                              id: candidate.id,
                              vehicleNo: candidate.vehicleNo,
                              name: candidate.name,
                              region: candidate.region,
                              currentArAmount: candidate.currentArAmount,
                              billingType: candidate.billingType,
                            })}>
                            <XCircle className="h-3 w-3" />폐업
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 상세 모달 */}
      <CandidateDetailModal
        open={!!selectedCandidateId}
        onOpenChange={(open) => !open && setSelectedCandidateId(null)}
        candidateId={selectedCandidateId || 0}
      />

      {/* 수납 처리 모달 */}
      {paymentTarget && (
        <PaymentModal
          open={!!paymentTarget}
          onOpenChange={open => { if (!open) setPaymentTarget(null); }}
          candidateId={paymentTarget.id}
          vehicleNo={paymentTarget.vehicleNo}
          name={paymentTarget.name}
          region={paymentTarget.region}
          currentArAmount={paymentTarget.currentArAmount}
          billingType={paymentTarget.billingType}
          onSuccess={() => { setPaymentTarget(null); refetch(); }}
        />
      )}

      {/* 폐업 처리 모달 */}
      {closureTarget && (
        <ClosureModal
          open={!!closureTarget}
          onOpenChange={open => { if (!open) setClosureTarget(null); }}
          candidateId={closureTarget.id}
          vehicleNo={closureTarget.vehicleNo}
          name={closureTarget.name}
          region={closureTarget.region}
          currentArAmount={closureTarget.currentArAmount}
          onSuccess={() => { setClosureTarget(null); refetch(); }}
        />
      )}
    </div>
  );
}
