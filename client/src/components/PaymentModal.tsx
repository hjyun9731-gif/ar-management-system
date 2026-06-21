import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type PaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId?: number;
  vehicleNo: string;
  name: string;
  region?: string;
  currentArAmount?: number;
  billingType?: string;
  sourceBankTxId?: number;
  onSuccess?: () => void;
};

const PAYMENT_TYPES = ['협회비', '관리비', '자격증명발급비', '협회가입비', '기타'] as const;
const PAYMENT_METHODS = ['직접수납', '통장이체', 'CMS', '현금', '기타'];
const ACCOUNT_TYPE_MAP: Record<string, string> = {
  협회비: '미수금차감',
  관리비: '미수금차감',
  자격증명발급비: '잡수입',
  협회가입비: '가수금',
  기타: '기타수입',
};

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

export function PaymentModal({
  open, onOpenChange, candidateId, vehicleNo, name, region,
  currentArAmount, billingType, sourceBankTxId, onSuccess
}: PaymentModalProps) {
  const today = getTodayDate();
  const currentMonth = getCurrentMonth();

  const [paymentType, setPaymentType] = useState<string>(billingType || '협회비');
  const [amount, setAmount] = useState('');
  const [targetMonth, setTargetMonth] = useState(currentMonth);
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState('직접수납');
  const [memo, setMemo] = useState('');

  const createPayment = trpc.billing.createPayment.useMutation({
    onSuccess: () => {
      toast.success('수납 처리 완료');
      setAmount(''); setMemo('');
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const accountType = ACCOUNT_TYPE_MAP[paymentType] || '기타수입';
  const isArDeduction = accountType === '미수금차감';
  const amountNum = Number(String(amount).replace(/,/g, ''));

  const handleSubmit = () => {
    if (!amountNum || amountNum <= 0) { toast.error('금액을 입력하세요'); return; }
    if (!paymentDate) { toast.error('수납일자를 선택하세요'); return; }
    createPayment.mutate({
      candidateId, vehicleNo, name, region,
      paymentType: paymentType as any,
      amount: amountNum,
      targetMonth: targetMonth || undefined,
      paymentDate,
      paymentMethod,
      memo: memo || undefined,
      sourceBankTxId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">수납 처리</DialogTitle>
          <p className="text-sm text-slate-500">{vehicleNo} · {name}</p>
        </DialogHeader>

        {currentArAmount != null && (
          <div className={`rounded-lg px-3 py-2 text-sm font-medium ${currentArAmount > 0 ? 'bg-red-50 text-red-700' : currentArAmount < 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-600'}`}>
            현재 미수금: <strong>{currentArAmount.toLocaleString()}원</strong>
            {isArDeduction && amountNum > 0 && (
              <span className="ml-2 text-emerald-600">→ 처리 후: {Math.max(0, currentArAmount - amountNum).toLocaleString()}원</span>
            )}
          </div>
        )}

        <div className="space-y-3 mt-1">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">수납 항목</label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400 mt-1">회계구분: {accountType} {!isArDeduction && '(미수금 변동 없음)'}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">금액 (원)</label>
              <Input
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="10000"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">대상월</label>
              <Input
                value={targetMonth}
                onChange={e => setTargetMonth(e.target.value)}
                placeholder="2026-06"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">수납일자</label>
              <Input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">수납방식</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">메모</label>
            <Input
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="메모 (선택)"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button size="sm" onClick={handleSubmit} disabled={createPayment.isPending}>
            {createPayment.isPending ? '처리 중...' : '수납 처리'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
