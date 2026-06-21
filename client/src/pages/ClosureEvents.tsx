import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Filter, Building2, AlertCircle, FileSearch, Search, Phone, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ClosureModal } from "@/components/ClosureModal";

const CLOSURE_TYPE_STYLE: Record<string, string> = {
  폐업: "bg-red-50 text-red-700 border border-red-200",
  양도: "bg-blue-50 text-blue-700 border border-blue-200",
  이관: "bg-amber-50 text-amber-700 border border-amber-200",
  탈퇴: "bg-slate-100 text-slate-600 border border-slate-200",
  타도: "bg-purple-50 text-purple-700 border border-purple-200",
};

function money(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n === 0) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

function formatDate(value: unknown): string {
  if (!value) return "-";
  try {
    return new Date(String(value)).toLocaleDateString("ko-KR");
  } catch {
    return String(value);
  }
}

function TableSkeleton() {
  return (
    <TableBody>
      {[...Array(6)].map((_, i) => (
        <TableRow key={i}>
          {[...Array(12)].map((__, j) => (
            <TableCell key={j}>
              <div className="h-4 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

export default function ClosureEvents() {
  const [closureType, setClosureType] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [showClosureModal, setShowClosureModal] = useState(false);

  // 연락 추적 팝업
  const [contactTarget, setContactTarget] = useState<any | null>(null);
  const [contactForm, setContactForm] = useState({
    contactConfirmed: false,
    contactDate: '',
    contactMethod: '',
    contactMemo: '',
    notifyTarget: false,
  });

  const { data: closures = [], isLoading, refetch } = trpc.billing.listClosuresWithArrears.useQuery({
    closureType: closureType === "all" ? undefined : closureType,
    search: searchText.trim() || undefined,
  });

  const updateContact = trpc.billing.updateClosureContact.useMutation({
    onSuccess: () => { toast.success('연락 추적 저장'); refetch(); setContactTarget(null); },
    onError: e => toast.error(e.message),
  });

  const arrearsCount = (closures as any[]).filter((c) => Number(c.currentArAmount || 0) > 0).length;
  const totalArrears = (closures as any[]).reduce((sum, c) => sum + Number(c.currentArAmount || 0), 0);

  const handleExport = () => {
    const headers = ["처리구분", "처리일자", "차량번호", "성명", "지역", "미수금", "미납발생개월수", "최근납부일", "연락확인", "연락일자", "연락방법", "연락메모", "비고"];
    const rows = (closures as any[]).map((c) => [
      c.closureType || "", formatDate(c.processDate),
      c.vehicleNo || "", c.name || "", c.region || "",
      c.currentArAmount || 0, c.unpaidMonthCount || 0,
      c.recentPaymentMonth || "",
      c.contact_confirmed ? "완료" : "", c.contact_date ? formatDate(c.contact_date) : "",
      c.contact_method || "", c.contact_memo || "",
      c.memo || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `closure_events_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  function openContactTarget(closure: any) {
    setContactTarget(closure);
    setContactForm({
      contactConfirmed: !!closure.contact_confirmed,
      contactDate: closure.contact_date ? new Date(closure.contact_date).toISOString().split('T')[0] : '',
      contactMethod: closure.contact_method || '',
      contactMemo: closure.contact_memo || '',
      notifyTarget: !!closure.notify_target,
    });
  }

  return (
    <div className="ar-page ar-closures-page space-y-5 max-w-7xl">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">폐업·양도·이관 현황</h1>
          <p className="text-sm text-slate-500 mt-0.5">종료 처리 회원 현황 및 잔여 미수금 관리</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowClosureModal(true)}>
            <Building2 className="w-3.5 h-3.5" /> 폐업 직접 등록
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm" className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            <Download className="w-3.5 h-3.5" /> 엑셀 다운로드
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="ar-summary-grid grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">전체 건수</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{(closures as any[]).length.toLocaleString()}건</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">미수금 있음</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{arrearsCount.toLocaleString()}명</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">미수금 합계</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{totalArrears > 0 ? totalArrears.toLocaleString() + "원" : "-"}</div>
        </div>
      </div>

      {/* 필터 칩 */}
      <div className="ar-filter-chips">
        {[{ value: "all", label: "전체" }, { value: "폐업", label: "폐업" }, { value: "양도", label: "양도" }, { value: "이관", label: "이관" }, { value: "탈퇴", label: "탈퇴" }].map((item) => (
          <button key={item.value} className={closureType === item.value ? "is-active" : ""} onClick={() => setClosureType(item.value)}>{item.label}</button>
        ))}
        <span>처리 유형별 현황</span>
      </div>

      {!isLoading && arrearsCount > 0 && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
          <p className="text-sm text-orange-800">
            미수금 미처리 항목이 <strong>{arrearsCount}건</strong> 있습니다. 확인 후 처리하세요.
          </p>
        </div>
      )}

      {/* 검색/필터 */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" /> 검색 및 필터
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">차량번호 / 성명</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="검색..."
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">처리구분</label>
              <Select value={closureType} onValueChange={setClosureType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="폐업">폐업</SelectItem>
                  <SelectItem value="양도">양도</SelectItem>
                  <SelectItem value="이관">이관</SelectItem>
                  <SelectItem value="탈퇴">탈퇴</SelectItem>
                  <SelectItem value="타도">타도</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 테이블 */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" /> 폐업·양도·이관 목록
            </CardTitle>
            {!isLoading && (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 font-medium">
                {(closures as any[]).length.toLocaleString()}건
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-500 pl-4">처리구분</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">처리일자</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">차량번호</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">성명</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">지역</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 text-right">미수금</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 text-right">미납개월</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">최근납부일</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 text-center">연락추적</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">연락일자</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 max-w-[120px]">연락메모</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">비고</TableHead>
                </TableRow>
              </TableHeader>
              {isLoading ? <TableSkeleton /> : (
                <TableBody>
                  {(closures as any[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="py-16 text-center">
                        <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">데이터가 없습니다</p>
                        <p className="text-xs text-slate-300 mt-1">필터 조건을 변경해 보세요</p>
                      </TableCell>
                    </TableRow>
                  ) : (closures as any[]).map((closure: any) => {
                    const arAmount = Number(closure.currentArAmount || 0);
                    const hasArrears = arAmount > 0;
                    const contactConfirmed = !!closure.contact_confirmed;
                    return (
                      <TableRow key={closure.id} className={`border-b border-slate-50 hover:bg-slate-50 ${hasArrears ? "bg-red-50/20" : ""}`}>
                        <TableCell className="pl-4 py-2.5">
                          <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border ${CLOSURE_TYPE_STYLE[closure.closureType] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {closure.closureType || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-600 font-mono">{formatDate(closure.processDate)}</TableCell>
                        <TableCell className="py-2.5 font-mono font-semibold text-slate-900 text-sm">{closure.vehicleNo || "-"}</TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-800 font-medium">{closure.name || "-"}</TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-600">{closure.region || "-"}</TableCell>
                        <TableCell className="py-2.5 text-right">
                          {hasArrears ? (
                            <div className="flex items-center justify-end gap-1">
                              <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                              <span className="font-bold text-red-600 text-sm">{arAmount.toLocaleString()}원</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">미수 없음</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-right">
                          {Number(closure.unpaidMonthCount || 0) > 0 ? (
                            <span className="font-semibold text-red-600">{closure.unpaidMonthCount}개월</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-500 font-mono">{closure.recentPaymentMonth || "-"}</TableCell>
                        <TableCell className="py-2.5 text-center">
                          <button
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border transition-colors ${contactConfirmed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-200 hover:text-blue-600'}`}
                            onClick={() => openContactTarget(closure)}
                          >
                            {contactConfirmed ? <CheckCircle2 className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                            {contactConfirmed ? '연락완료' : '미연락'}
                          </button>
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-500 font-mono">
                          {closure.contact_date ? formatDate(closure.contact_date) : "-"}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-400 max-w-[120px] truncate">
                          {closure.contact_memo || "-"}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-400 max-w-[120px] truncate">{closure.memo || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 폐업 직접 등록 모달 (ClosureModal 재활용) */}
      <ClosureModal
        open={showClosureModal}
        onOpenChange={setShowClosureModal}
        vehicleNo=""
        name=""
        onSuccess={() => { setShowClosureModal(false); refetch(); }}
      />

      {/* 연락 추적 팝업 */}
      {contactTarget && (
        <Dialog open={!!contactTarget} onOpenChange={() => setContactTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4" />연락 추적 기록
              </DialogTitle>
              <p className="text-sm text-slate-500">{contactTarget.vehicleNo} · {contactTarget.name}</p>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" checked={contactForm.contactConfirmed}
                    onChange={e => setContactForm(f => ({ ...f, contactConfirmed: e.target.checked }))}
                    className="h-4 w-4" />
                  연락 완료
                </label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer ml-4">
                  <input type="checkbox" checked={contactForm.notifyTarget}
                    onChange={e => setContactForm(f => ({ ...f, notifyTarget: e.target.checked }))}
                    className="h-4 w-4" />
                  통보 대상
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">연락일자</label>
                  <Input type="date" value={contactForm.contactDate}
                    onChange={e => setContactForm(f => ({ ...f, contactDate: e.target.value }))}
                    className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">연락방법</label>
                  <Select value={contactForm.contactMethod} onValueChange={v => setContactForm(f => ({ ...f, contactMethod: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="전화">전화</SelectItem>
                      <SelectItem value="문자">문자</SelectItem>
                      <SelectItem value="방문">방문</SelectItem>
                      <SelectItem value="우편">우편</SelectItem>
                      <SelectItem value="기타">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">연락 메모</label>
                <Input value={contactForm.contactMemo}
                  onChange={e => setContactForm(f => ({ ...f, contactMemo: e.target.value }))}
                  placeholder="연락 내용 메모 (선택)" className="h-9 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setContactTarget(null)}>취소</Button>
              <Button size="sm" onClick={() => updateContact.mutate({
                closureId: contactTarget.id,
                contactConfirmed: contactForm.contactConfirmed,
                contactDate: contactForm.contactDate || undefined,
                contactMethod: contactForm.contactMethod || undefined,
                contactMemo: contactForm.contactMemo || undefined,
                notifyTarget: contactForm.notifyTarget,
              })} disabled={updateContact.isPending}>
                {updateContact.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
