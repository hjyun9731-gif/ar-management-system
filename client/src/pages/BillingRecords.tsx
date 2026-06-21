import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function calcBillingStart(date: string | undefined): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  } catch { return ''; }
}

export default function BillingRecords() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', vehicleNo: '', mobile: '', address: '', region: '',
    memberType: '개인회원', isJoined: false, certificateDate: '',
    expectedBillingType: '협회비', expectedMonthlyAmount: 10000, memo: '',
  });

  const { data: members = [], isLoading, refetch } = trpc.billing.listProspectiveMembers.useQuery();
  const create = trpc.billing.createProspectiveMember.useMutation({
    onSuccess: () => { toast.success('예정자 등록 완료'); refetch(); setShowForm(false); resetForm(); },
    onError: e => toast.error(e.message),
  });
  const remove = trpc.billing.deleteProspectiveMember.useMutation({
    onSuccess: () => { toast.success('삭제 완료'); refetch(); },
    onError: e => toast.error(e.message),
  });

  function resetForm() {
    setForm({ name: '', vehicleNo: '', mobile: '', address: '', region: '',
      memberType: '개인회원', isJoined: false, certificateDate: '',
      expectedBillingType: '협회비', expectedMonthlyAmount: 10000, memo: '' });
  }

  const billingStartDate = calcBillingStart(form.certificateDate);

  const filtered = (members as any[]).filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return String(m.name || '').toLowerCase().includes(q) ||
      String(m.vehicle_no || '').toLowerCase().includes(q);
  });

  return (
    <div className="ar-page ar-records-page space-y-5 max-w-7xl">
      <div className="ar-page-actions">
        <div />
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" />예정자 등록</Button>
      </div>

      <div className="ar-summary-grid">
        <div><p>전체 예정자</p><strong>{(members as any[]).length.toLocaleString()}</strong><span>명</span></div>
        <div><p>협회비 예정</p><strong className="text-emerald-600">{(members as any[]).filter((m: any) => m.expected_billing_type === '협회비').length}</strong><span>명</span></div>
        <div><p>관리비 예정</p><strong className="text-indigo-600">{(members as any[]).filter((m: any) => m.expected_billing_type === '관리비').length}</strong><span>명</span></div>
        <div><p>가입 완료</p><strong className="text-blue-600">{(members as any[]).filter((m: any) => m.is_joined).length}</strong><span>명</span></div>
      </div>

      <Card className="ar-table-card">
        <CardHeader>
          <div className="ar-table-toolbar">
            <CardTitle><Users className="h-4 w-4" />신규 예정자 {filtered.length}명</CardTitle>
            <div className="ar-toolbar-fields">
              <div className="relative ar-search">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름/차량번호 검색" className="pl-9" />
              </div>
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
                  <TableHead>연락처</TableHead>
                  <TableHead>구분</TableHead>
                  <TableHead>부과항목</TableHead>
                  <TableHead>자격증명발급일</TableHead>
                  <TableHead>부과시작일</TableHead>
                  <TableHead className="text-right">예상월부과</TableHead>
                  <TableHead>메모</TableHead>
                  <TableHead className="text-center">삭제</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => <TableRow key={i}>{[...Array(11)].map((__, j) => <TableCell key={j}><div className="h-4 animate-pulse rounded bg-slate-100" /></TableCell>)}</TableRow>)
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-16 text-center text-sm text-slate-400">
                      등록된 예정자가 없습니다. 예정자 등록 버튼을 눌러 추가하세요.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono font-semibold text-sm">{m.vehicle_no}</TableCell>
                    <TableCell className="text-sm font-medium">{m.name}</TableCell>
                    <TableCell className="text-sm text-slate-500">{m.region || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-500 font-mono">{m.mobile || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-500">{m.member_type}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.expected_billing_type === '협회비' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
                        {m.expected_billing_type || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 font-mono">
                      {m.certificate_date ? new Date(m.certificate_date).toLocaleDateString('ko-KR') : '-'}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {m.billing_start_date ? new Date(m.billing_start_date).toLocaleDateString('ko-KR') : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {Number(m.expected_monthly_amount || 0).toLocaleString()}원
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 max-w-[100px] truncate">{m.memo || '-'}</TableCell>
                    <TableCell className="text-center">
                      <button className="text-red-400 hover:text-red-600"
                        onClick={() => { if (confirm(`${m.name}을 삭제하시겠습니까?`)) remove.mutate({ id: m.id }); }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 예정자 등록 모달 */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><UserPlus className="h-5 w-5" />신규 예정자 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">성명 *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">차량번호 *</label>
                <Input value={form.vehicleNo} onChange={e => setForm(f => ({ ...f, vehicleNo: e.target.value }))} placeholder="강원00자 0000호" className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">연락처</label>
                <Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="010-0000-0000" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">지역</label>
                <Select value={form.region} onValueChange={v => setForm(f => ({ ...f, region: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="지역 선택" /></SelectTrigger>
                  <SelectContent>
                    {["춘천시", "강릉시", "원주시", "횡성군", "평창군", "정선군", "철원군", "화천군", "양구군", "인제군", "고성군", "양양군"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">구분</label>
                <Select value={form.memberType} onValueChange={v => setForm(f => ({ ...f, memberType: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="개인회원">개인회원</SelectItem>
                    <SelectItem value="택배회원">택배회원</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">부과항목</label>
                <Select value={form.expectedBillingType} onValueChange={v => setForm(f => ({ ...f, expectedBillingType: v, expectedMonthlyAmount: v === '관리비' ? 5000 : 10000 }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="협회비">협회비 (10,000원)</SelectItem>
                    <SelectItem value="관리비">관리비 (5,000원)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">자격증명 발급일</label>
                <Input type="date" value={form.certificateDate} onChange={e => setForm(f => ({ ...f, certificateDate: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">부과시작일 (자동계산)</label>
                <Input value={billingStartDate || '발급일 입력 시 자동 계산'} readOnly className="h-9 text-sm bg-slate-50 text-slate-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">주소</label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="주소 (선택)" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">메모</label>
              <Input value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="메모 (선택)" className="h-9 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>취소</Button>
            <Button size="sm" onClick={() => {
              if (!form.name || !form.vehicleNo) { toast.error('성명과 차량번호는 필수입니다'); return; }
              create.mutate({
                name: form.name, vehicleNo: form.vehicleNo, mobile: form.mobile || undefined,
                address: form.address || undefined, region: form.region || undefined,
                memberType: form.memberType, isJoined: form.isJoined,
                certificateDate: form.certificateDate || undefined,
                billingStartDate: billingStartDate || undefined,
                expectedBillingType: form.expectedBillingType,
                expectedMonthlyAmount: form.expectedMonthlyAmount,
                memo: form.memo || undefined,
              });
            }} disabled={create.isPending}>
              {create.isPending ? '등록 중...' : '등록'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
