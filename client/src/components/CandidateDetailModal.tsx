import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Car, User, FileText, Database, Edit2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CandidateDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: number;
}

const STATUS_STYLE: Record<string, string> = {
  대기: "bg-amber-50 text-amber-700 border border-amber-200",
  부과예정: "bg-sky-50 text-sky-700 border border-sky-200",
  부과반영완료: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  확인필요: "bg-red-50 text-red-700 border border-red-200",
  보류: "bg-slate-100 text-slate-600 border border-slate-200",
  제외: "bg-gray-50 text-gray-500 border border-gray-200",
};

const BILLING_TYPE_STYLE: Record<string, string> = {
  협회비: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  관리비: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  확인필요: "bg-amber-50 text-amber-700 border border-amber-200",
};

function getCalculationReason(
  memberType: string,
  joinDate?: string,
  certificateDate?: string,
  billingType?: string
): string {
  if (billingType === "확인필요") {
    if (memberType === "개인회원" && !joinDate) return "joinDate 누락 - 협회비 판정 불가";
    if (memberType === "택배회원" && !certificateDate) return "certificateDate 누락 - 관리비 판정 불가";
    return "필수 정보 누락";
  }
  if (memberType === "개인회원" && billingType === "협회비") return `협회비: joinDate(${joinDate}) 기준 다음 달`;
  if (memberType === "택배회원" && billingType === "관리비") return `관리비: certificateDate(${certificateDate}) 기준 다음 달`;
  return "";
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 mb-0.5">{label}</dt>
      <dd className="text-sm text-slate-800 font-medium">{value || <span className="text-slate-300 font-normal">-</span>}</dd>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 mb-3">
      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
      </div>
      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</span>
    </div>
  );
}

export function CandidateDetailModal({ open, onOpenChange, candidateId }: CandidateDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    billingStartMonth: "",
    status: "",
    memo: "",
  });

  const { data: candidate, isLoading } = trpc.billing.getCandidate.useQuery(
    { id: candidateId },
    { enabled: open && candidateId > 0 }
  );

  const updateMutation = trpc.billing.updateCandidate.useMutation({
    onSuccess: () => {
      toast.success("저장되었습니다");
      setIsEditing(false);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "저장 실패");
    },
  });

  if (!candidate && isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-3 py-6 px-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!candidate) return null;

  const handleSave = () => {
    updateMutation.mutate({
      id: candidateId,
      billingStartMonth: formData.billingStartMonth || candidate.billingStartMonth || undefined,
      status: (formData.status || candidate.status) as any,
      memo: formData.memo || candidate.memo || undefined,
    });
  };

  const calculationReason = getCalculationReason(
    candidate.memberType,
    candidate.joinDate ? new Date(candidate.joinDate).toLocaleDateString("ko-KR") : undefined,
    candidate.certificateDate ? new Date(candidate.certificateDate).toLocaleDateString("ko-KR") : undefined,
    candidate.billingType
  );

  const warnings = [
    candidate.memberType === "개인회원" && !candidate.joinDate && "joinDate 누락",
    candidate.memberType === "택배회원" && !candidate.certificateDate && "certificateDate 누락",
    candidate.status === "확인필요" && "확인 필요",
    candidate.status === "보류" && "보류 중",
    candidate.status === "제외" && "제외됨",
  ].filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            부과 대상자 상세 정보
            {warnings.length > 0 && (
              <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
              </div>
            )}
          </DialogTitle>
          {/* Name + Vehicle chip */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-medium text-slate-700">{candidate.name}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{candidate.vehicleNo}</span>
            <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_STYLE[candidate.status] ?? "bg-slate-100 text-slate-600"}`}>
              {candidate.status}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="flex flex-wrap gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-2">
                {warnings.map((w, i) => (
                  <span key={i} className="text-xs font-medium text-amber-800 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div>
            <SectionHeader icon={User} title="기본 정보" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="성명" value={candidate.name} />
              <div>
                <dt className="text-xs font-medium text-slate-400 mb-0.5">회원 구분</dt>
                <dd>
                  <span className="inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {candidate.memberType}
                  </span>
                </dd>
              </div>
              <InfoRow label="지역" value={candidate.region} />
              <InfoRow label="관리번호" value={candidate.managementNo} />
            </dl>
          </div>

          {/* Vehicle Info */}
          <div>
            <SectionHeader icon={Car} title="차량·사업 정보" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="차량번호" value={candidate.vehicleNo} />
              <InfoRow label="차량 유형" value={candidate.vehicleType} />
              <InfoRow label="사업자번호" value={candidate.businessNo} />
              <InfoRow label="회사명" value={candidate.company} />
            </dl>
          </div>

          {/* Billing Info */}
          <div>
            <SectionHeader icon={FileText} title="부과 정보" />
            <div className="space-y-4">
              {/* Billing Type + Reason */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">부과항목</span>
                  <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 ${BILLING_TYPE_STYLE[candidate.billingType] ?? "bg-slate-100 text-slate-600"}`}>
                    {candidate.billingType}
                  </span>
                </div>
                {calculationReason && (
                  <p className="text-xs text-slate-500 italic">{calculationReason}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* billingStartMonth */}
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">부과시작월</label>
                  {isEditing ? (
                    <Input
                      type="month"
                      value={formData.billingStartMonth || candidate.billingStartMonth || ""}
                      onChange={(e) => setFormData({ ...formData, billingStartMonth: e.target.value })}
                      className="h-8 text-sm"
                    />
                  ) : (
                    <p className="text-sm font-medium text-slate-800 font-mono">
                      {candidate.billingStartMonth || <span className="text-slate-300 font-normal">미정</span>}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">상태</label>
                  {isEditing ? (
                    <Select
                      value={formData.status || candidate.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="대기">대기</SelectItem>
                        <SelectItem value="부과예정">부과예정</SelectItem>
                        <SelectItem value="부과반영완료">부과반영완료</SelectItem>
                        <SelectItem value="확인필요">확인필요</SelectItem>
                        <SelectItem value="보류">보류</SelectItem>
                        <SelectItem value="제외">제외</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_STYLE[candidate.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {candidate.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Memo */}
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">메모</label>
                {isEditing ? (
                  <textarea
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    rows={2}
                    value={formData.memo || candidate.memo || ""}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  />
                ) : (
                  <p className="text-sm text-slate-700 min-h-[2rem]">
                    {candidate.memo || <span className="text-slate-300">-</span>}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sync Info */}
          <div>
            <SectionHeader icon={Database} title="동기화 정보" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <dt className="text-slate-400 font-medium mb-0.5">원본 시스템 ID</dt>
                <dd className="font-mono text-slate-700">{candidate.sourceSystemId || "-"}</dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium mb-0.5">등록일시</dt>
                <dd className="text-slate-700">{new Date(candidate.createdAt).toLocaleString("ko-KR")}</dd>
              </div>
              {candidate.joinDate && (
                <div>
                  <dt className="text-slate-400 font-medium mb-0.5">joinDate</dt>
                  <dd className="font-mono text-slate-700">{new Date(candidate.joinDate).toLocaleDateString("ko-KR")}</dd>
                </div>
              )}
              {candidate.certificateDate && (
                <div>
                  <dt className="text-slate-400 font-medium mb-0.5">certificateDate</dt>
                  <dd className="font-mono text-slate-700">{new Date(candidate.certificateDate).toLocaleDateString("ko-KR")}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                취소
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
              >
                {updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                닫기
              </Button>
              <Button
                size="sm"
                onClick={() => setIsEditing(true)}
                className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                편집
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
