import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CandidateDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: number;
}

function getCalculationReason(
  memberType: string,
  joinDate?: string,
  certificateDate?: string,
  billingType?: string
): string {
  if (billingType === "확인필요") {
    if (memberType === "개인회원" && !joinDate) {
      return "joinDate 누락 - 협회비 판정 불가";
    }
    if (memberType === "택배회원" && !certificateDate) {
      return "certificateDate 누락 - 관리비 판정 불가";
    }
    return "필수 정보 누락";
  }

  if (memberType === "개인회원" && billingType === "협회비") {
    return `협회비: joinDate(${joinDate}) 기준 다음 달`;
  }
  if (memberType === "택배회원" && billingType === "관리비") {
    return `관리비: certificateDate(${certificateDate}) 기준 다음 달`;
  }
  return "";
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
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <span className="text-gray-500">로딩 중...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!candidate) {
    return null;
  }

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

  const showWarnings = [
    candidate.memberType === "개인회원" && !candidate.joinDate && "joinDate 누락",
    candidate.memberType === "택배회원" && !candidate.certificateDate && "certificateDate 누락",
    candidate.status === "확인필요" && "확인 필요",
    candidate.status === "보류" && "보류 중",
    candidate.status === "제외" && "제외됨",
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            부과 대상자 상세 정보
            {showWarnings.length > 0 && (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 경고 배지 */}
          {showWarnings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {showWarnings.map((warning, idx) => (
                <Badge key={idx} className="bg-yellow-100 text-yellow-800">
                  ⚠️ {warning}
                </Badge>
              ))}
            </div>
          )}

          {/* 기본 정보 */}
          <Card className="bg-white border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">성명</label>
                  <p className="text-sm text-gray-900 font-medium mt-1">{candidate.name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">회원 구분</label>
                  <Badge className="mt-1 bg-blue-100 text-blue-800">{candidate.memberType}</Badge>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">지역</label>
                  <p className="text-sm text-gray-900 mt-1">{candidate.region || "-"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">관리번호</label>
                  <p className="text-sm text-gray-900 mt-1">{candidate.managementNo || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 차량/사업 정보 */}
          <Card className="bg-white border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">차량/사업 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">차량번호</label>
                  <p className="text-sm text-gray-900 font-medium mt-1">{candidate.vehicleNo}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">차량 유형</label>
                  <p className="text-sm text-gray-900 mt-1">{candidate.vehicleType || "-"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">사업자번호</label>
                  <p className="text-sm text-gray-900 mt-1">{candidate.businessNo || "-"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">회사명</label>
                  <p className="text-sm text-gray-900 mt-1">{candidate.company || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 부과 정보 */}
          <Card className="bg-white border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">부과 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 부과항목 및 계산 근거 */}
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">부과항목</label>
                  <Badge
                    className={
                      candidate.billingType === "협회비"
                        ? "bg-green-100 text-green-800"
                        : candidate.billingType === "관리비"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {candidate.billingType}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 italic">{calculationReason}</p>
              </div>

              {/* 부과시작월 */}
              <div>
                <label className="text-xs font-medium text-gray-600">부과시작월</label>
                {isEditing ? (
                  <Input
                    type="month"
                    value={formData.billingStartMonth || candidate.billingStartMonth || ""}
                    onChange={(e) => setFormData({ ...formData, billingStartMonth: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm text-gray-900 font-medium mt-1">
                    {candidate.billingStartMonth || "미정"}
                  </p>
                )}
              </div>

              {/* 상태 */}
              <div>
                <label className="text-xs font-medium text-gray-600">상태</label>
                {isEditing ? (
                  <Select value={formData.status || candidate.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger className="mt-1">
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
                  <Badge className="mt-1 bg-purple-100 text-purple-800">{candidate.status}</Badge>
                )}
              </div>

              {/* 메모 */}
              <div>
                <label className="text-xs font-medium text-gray-600">메모</label>
                {isEditing ? (
                  <textarea
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    rows={2}
                    value={formData.memo || candidate.memo || ""}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  />
                ) : (
                  <p className="text-sm text-gray-900 mt-1 min-h-8">{candidate.memo || "-"}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 동기화 정보 */}
          <Card className="bg-white border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">동기화 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>원본 시스템 ID:</span>
                <span className="font-mono text-gray-900">{candidate.sourceSystemId}</span>
              </div>
              <div className="flex justify-between">
                <span>등록일시:</span>
                <span>{new Date(candidate.createdAt).toLocaleString("ko-KR")}</span>
              </div>
              <div className="flex justify-between">
                <span>수정일시:</span>
                <span>{new Date(candidate.updatedAt).toLocaleString("ko-KR")}</span>
              </div>
              {candidate.joinDate && (
                <div className="flex justify-between">
                  <span>joinDate:</span>
                  <span>{new Date(candidate.joinDate).toLocaleDateString("ko-KR")}</span>
                </div>
              )}
              {candidate.certificateDate && (
                <div className="flex justify-between">
                  <span>certificateDate:</span>
                  <span>{new Date(candidate.certificateDate).toLocaleDateString("ko-KR")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                취소
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                닫기
              </Button>
              <Button onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700">
                편집
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
