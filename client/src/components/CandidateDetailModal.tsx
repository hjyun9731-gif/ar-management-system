import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CandidateDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: number;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>부과 대상자 상세 정보</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">성명</label>
                  <p className="text-sm text-gray-900 mt-1">{candidate.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">차량번호</label>
                  <p className="text-sm text-gray-900 mt-1">{candidate.vehicleNo}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">지역</label>
                  <p className="text-sm text-gray-900 mt-1">{candidate.region}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">구분</label>
                  <p className="text-sm text-gray-900 mt-1">{candidate.memberType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">부과항목</label>
                  <p className="text-sm text-gray-900 mt-1">{candidate.billingType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">상태</label>
                  <Badge className="mt-1 bg-blue-100 text-blue-800">{candidate.status}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 편집 가능 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">부과 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">부과시작월</label>
                  {isEditing ? (
                    <Input
                      type="month"
                      value={formData.billingStartMonth || candidate.billingStartMonth}
                      onChange={(e) => setFormData({ ...formData, billingStartMonth: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{candidate.billingStartMonth}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">상태</label>
                  {isEditing ? (
                    <Select value={formData.status || candidate.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger>
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
                    <p className="text-sm text-gray-900">{candidate.status}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">메모</label>
                {isEditing ? (
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    rows={3}
                    value={formData.memo || candidate.memo || ""}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  />
                ) : (
                  <p className="text-sm text-gray-900 min-h-12">{candidate.memo || "-"}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 등록 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">등록 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>등록일시:</span>
                <span>{new Date(candidate.createdAt).toLocaleString("ko-KR")}</span>
              </div>
              <div className="flex justify-between">
                <span>수정일시:</span>
                <span>{new Date(candidate.updatedAt).toLocaleString("ko-KR")}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                취소
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                닫기
              </Button>
              <Button onClick={() => setIsEditing(true)}>편집</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
