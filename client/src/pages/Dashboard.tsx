import {
  Activity, AlertTriangle, Building2, CalendarCheck, CheckCircle2, Clock3,
  CreditCard, History, Receipt, TrendingUp, UserCheck, Users, XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

function MetricCard({ label, value, unit = "명", sub, icon: Icon, tone = "blue", href }: {
  label: string; value: number; unit?: string; sub: string; icon: React.ElementType; tone?: string; href: string;
}) {
  return (
    <a href={href} className="ar-metric-card">
      <div className={`ar-metric-icon ${tone}`}><Icon className="h-[18px] w-[18px]" /></div>
      <p>{label}</p>
      <div><strong>{value.toLocaleString()}</strong><span>{unit}</span></div>
      <small>{sub}</small>
    </a>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="ar-insight-card"><header><h3>{title}</h3>{action}</header>{children}</section>;
}

export default function Dashboard() {
  const { data: dashboardData } = trpc.billing.getDashboardStats.useQuery();
  const { data: recentLogs = [] } = trpc.billing.listSyncLogs.useQuery({});

  const stats = dashboardData ?? { nextMonthCount: 0, thisMonthCount: 0, closurePendingCount: 0, unpaidCount: 0, confirmNeededCount: 0 };
  const logs = recentLogs as any[];
  const successCount = logs.filter((log) => log.status === "SUCCESS").length;
  const failCount = logs.filter((log) => log.status === "FAIL").length;
  const warningCount = logs.filter((log) => log.status === "WARNING").length;
  const latestLogs = logs.slice(0, 5);
  const totalCandidates = stats.nextMonthCount + stats.thisMonthCount;
  const maxWork = Math.max(stats.nextMonthCount, stats.thisMonthCount, stats.closurePendingCount, stats.confirmNeededCount, 1);

  const metrics = [
    { label: "전체 관리 대상", value: totalCandidates, sub: "현재 부과 대상 기준", icon: Users, href: "/candidates" },
    { label: "현재 미수 인원", value: stats.unpaidCount, sub: "확인이 필요한 회원", icon: AlertTriangle, tone: "red", href: "/candidates" },
    { label: "이번 달 부과 예정", value: stats.thisMonthCount, sub: "처리 예정 건수", icon: Receipt, tone: "violet", href: "/billing-records" },
    { label: "다음 달 부과 대상", value: stats.nextMonthCount, sub: "예정 명단 기준", icon: CalendarCheck, tone: "blue", href: "/candidates" },
    { label: "폐업 반영 대기", value: stats.closurePendingCount, sub: "폐업·양도·이관", icon: Building2, tone: "amber", href: "/closures" },
    { label: "확인 필요", value: stats.confirmNeededCount, sub: "수동 확인 대상", icon: UserCheck, tone: "red", href: "/approval" },
    { label: "연동 성공", value: successCount, sub: "최근 연동 로그", icon: CheckCircle2, tone: "green", href: "/sync-logs" },
    { label: "연동 오류", value: failCount + warningCount, sub: "실패 및 경고", icon: Activity, tone: "amber", href: "/sync-logs" },
  ];

  return (
    <div className="ar-page ar-dashboard-page">
      <div className="ar-kpi-grid">{metrics.map((item) => <MetricCard key={item.label} {...item} />)}</div>

      <div className="ar-insight-grid">
        <Panel title="지역별 미수금 TOP" action={<a href="/candidates">전체보기</a>}>
          <div className="ar-empty-compact"><Activity /><p>지역 필터에서 실제 미수금 현황을 확인하세요.</p></div>
        </Panel>

        <Panel title="계정별 미수금">
          <div className="ar-account-list">
            <div><i className="blue" /><span>부과 예정</span><strong>{stats.thisMonthCount.toLocaleString()}명</strong></div>
            <div><i className="amber" /><span>확인 필요</span><strong>{stats.confirmNeededCount.toLocaleString()}명</strong></div>
          </div>
          <div className="ar-stacked-bar"><i style={{ width: `${totalCandidates ? stats.thisMonthCount / totalCandidates * 100 : 0}%` }} /><i /></div>
        </Panel>

        <Panel title="미수개월수별 현황">
          <div className="ar-bucket-grid">
            {[{ label: "이번 달", value: stats.thisMonthCount }, { label: "다음 달", value: stats.nextMonthCount }, { label: "확인 필요", value: stats.confirmNeededCount }, { label: "미수 대상", value: stats.unpaidCount }].map((item) => (
              <a href="/candidates" key={item.label}><span>{item.label}</span><strong>{item.value.toLocaleString()}명</strong></a>
            ))}
          </div>
        </Panel>

        <Panel title="처리 대기 현황" action={<a href="/approval">처리하기</a>}>
          <div className="ar-progress-list">
            {[{ label: "부과 예정", value: stats.nextMonthCount, tone: "blue" }, { label: "폐업 반영", value: stats.closurePendingCount, tone: "amber" }, { label: "확인 필요", value: stats.confirmNeededCount, tone: "red" }].map((item) => (
              <div key={item.label}><p><span>{item.label}</span><strong>{item.value.toLocaleString()}건</strong></p><div><i className={item.tone} style={{ width: `${item.value / maxWork * 100}%` }} /></div></div>
            ))}
          </div>
        </Panel>

        <Panel title="최근 수납 내역" action={<a href="/payment-history">전체보기</a>}>
          {latestLogs.length ? <div className="ar-activity-list">{latestLogs.map((log) => (
            <div key={log.id}><span className={`ar-status-dot ${log.status?.toLowerCase()}`} />
              <p><strong>{log.eventType === "REGISTER" ? "신규 등록 연동" : "운영 데이터 연동"}</strong><small>{new Date(log.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></p>
              {log.status === "SUCCESS" ? <CheckCircle2 /> : log.status === "FAIL" ? <XCircle /> : <Clock3 />}
            </div>
          ))}</div> : <div className="ar-empty-compact"><History /><p>최근 수납·연동 내역이 없습니다.</p></div>}
        </Panel>

        <Panel title="회원 구성 비율">
          <div className="ar-ratio-wrap"><div className="ar-ratio-ring" style={{ "--ratio": `${totalCandidates ? stats.thisMonthCount / totalCandidates * 100 : 0}%` } as React.CSSProperties}><strong>{totalCandidates.toLocaleString()}</strong><span>전체</span></div>
            <div className="ar-ratio-legend"><p><i className="blue" />이번 달 <strong>{stats.thisMonthCount.toLocaleString()}명</strong></p><p><i className="grey" />다음 달 <strong>{stats.nextMonthCount.toLocaleString()}명</strong></p></div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
