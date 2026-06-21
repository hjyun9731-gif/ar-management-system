import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ClosureModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId?: number;
  vehicleNo: string;
  name: string;
  region?: string;
  currentArAmount?: number;
  onSuccess?: () => void;
};

export function ClosureModal({
  open, onOpenChange, candidateId, vehicleNo: propVehicleNo, name: propName, region: propRegion, currentArAmount, onSuccess
}: ClosureModalProps) {
  const isDirectMode = !propVehicleNo && !propName;

  const [closureType, setClosureType] = useState<'폐업' | '양도' | '이관' | '탈퇴'>('폐업');
  const [processDate, setProcessDate] = useState(new Date().toISOString().split('T')[0]);
  const [documentNo, setDocumentNo] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [memo, setMemo] = useState('');
  // 직접 등록 모드용 입력값
  const [directVehicleNo, setDirectVehicleNo] = useState('');
  const [directName, setDirectName] = useState('');
  const [directRegion, setDirectRegion] = useState('');
  const [directArAmount, setDirectArAmount] = useState('');

  const vehicleNo = isDirectMode ? directVehicleNo : propVehicleNo;
  const name = isDirectMode ? directName : propName;
  const region = isDirectMode ? directRegion : propRegion;

  const createClosure = trpc.billing.createClosureFromList.useMutation({
    onSuccess: () => {
      toast.success('처리 완료');
      onSuccess?.();
      onOpenChange(false);
      // 직접 등록 모드 초기화
      setDirectVehicleNo(''); setDirectName(''); setDirectRegion(''); setDirectArAmount('');
      setDocumentNo(''); setReceiptNo(''); setMemo('');
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!vehicleNo) { toast.error('차량번호를 입력하세요'); return; }
    if (!name) { toast.error('성명을 입력하세요'); return; }
    if (!processDate) { toast.error('처리일자를 선택하세요'); return; }
    const arAmount = isDirectMode ? Number(directArAmount) || 0 : (currentArAmount || 0);
    createClosure.mutate({
      candidateId, vehicleNo, name, region,
      closureType,
      processDate,
      documentNo: documentNo || undefined,
      receiptNo: receiptNo || undefined,
      arAmount,
      memo: memo || undefined,
    });
  };

  const TYPE_LABEL: Record<string, string> = { 폐업: '폐업', 양도: '양도', 이관: '이관(타도)', 탈퇴: '탈퇴' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">폐업·양도·이관·탈퇴 처리</DialogTitle>
          {!isDirectMode && <p className="text-sm text-slate-500">{vehicleNo} · {name}</p>}
        </DialogHeader>

        {!isDirectMode && currentArAmount != null && currentArAmount !== 0 && (
          <div className={`rounded-lg px-3 py-2 text-sm ${currentArAmount > 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
            처리 시 미수금 <strong>{Math.abs(currentArAmount).toLocaleString()}원</strong>이 기록됩니다.
          </div>
        )}

        <div className="space-y-3 mt-1">
          {/* 직접 등록 모드: 차량번호/성명/지역/미수금 입력 */}
          {isDirectMode && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">차량번호 *</label>
                  <Input value={directVehicleNo} onChange={e => setDirectVehicleNo(e.target.value)} placeholder="강원00자 0000호" className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">성명 *</label>
                  <Input value={directName} onChange={e => setDirectName(e.target.value)} placeholder="홍길동" className="h-9 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">지역</label>
                  <Input value={directRegion} onChange={e => setDirectRegion(e.target.value)} placeholder="춘천시" className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">미수금액 (원)</label>
                  <Input value={directArAmount} onChange={e => setDirectArAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" className="h-9 text-sm" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">처리 구분</label>
            <div className="flex gap-2">
              {(['폐업', '양도', '이관', '탈퇴'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setClosureType(t)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${closureType === t ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">처리일자</label>
              <Input type="date" value={processDate} onChange={e => setProcessDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">공문번호</label>
              <Input value={documentNo} onChange={e => setDocumentNo(e.target.value)} placeholder="공문번호" className="h-9 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">접수번호</label>
            <Input value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder="접수번호 (선택)" className="h-9 text-sm" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">메모</label>
            <Input value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모 (선택)" className="h-9 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button size="sm" variant="destructive" onClick={handleSubmit} disabled={createClosure.isPending}>
            {createClosure.isPending ? '처리 중...' : closureType + ' 처리'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
