import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Tabs,
  MessagePlugin
} from 'tdesign-react';
import {
  ChatIcon,
  UserIcon,
  StarIcon,
  RefreshIcon,
  ChevronLeftIcon
} from 'tdesign-icons-react';

interface DashboardStats {
  totalSessions: number;
  totalMessages: number;
  transferredSessions: number;
  averageSatisfaction: number;
  intentDistribution: Record<string, number>;
  satisfactionDistribution: Record<number, number>;
}

interface TransferRecord {
  id: string;
  session_id: string;
  sessionTitle: string;
  reason: string | null;
  intent: string | null;
  transferred_at: string;
  resolved_at: string | null;
  status: 'pending' | 'resolved' | 'cancelled';
}

interface SatisfactionRating {
  id: string;
  session_id: string;
  sessionTitle: string;
  score: number;
  comment: string | null;
  created_at: string;
}

const intentLabels: Record<string, string> = {
  refund: '退款',
  order_query: '订单查询',
  tech_support: '技术支持',
  transfer_human: '转人工',
  complaint: '投诉',
  greeting: '打招呼',
  general: '通用咨询'
};

const intentColors: Record<string, string> = {
  refund: 'red',
  order_query: 'blue',
  tech_support: 'green',
  transfer_human: 'orange',
  complaint: 'red',
  greeting: 'cyan',
  general: 'gray'
};

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [satisfactionRatings, setSatisfactionRatings] = useState<SatisfactionRating[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDashboard(),
        loadTransfers(),
        loadSatisfaction()
      ]);
    } catch {
      MessagePlugin.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    const response = await fetch('/api/admin/dashboard');
    const data = await response.json();
    setStats(data.stats);
  };

  const loadTransfers = async () => {
    const response = await fetch('/api/admin/transfers');
    const data = await response.json();
    setTransfers(data.records || []);
  };

  const loadSatisfaction = async () => {
    const response = await fetch('/api/admin/satisfaction');
    const data = await response.json();
    setSatisfactionRatings(data.ratings || []);
  };

  const transferColumns = [
    { title: '会话', colKey: 'sessionTitle', width: 200 },
    {
      title: '意图',
      colKey: 'intent',
      width: 120,
      cell: ({ row }: { row: TransferRecord }) => (
        <Tag color={intentColors[row.intent || 'general'] || 'gray'}>
          {intentLabels[row.intent || 'general'] || '未知'}
        </Tag>
      )
    },
    {
      title: '转人工原因',
      colKey: 'reason',
      width: 200,
      cell: ({ row }: { row: TransferRecord }) => (
        <span>{row.reason || '用户请求'}</span>
      )
    },
    {
      title: '状态',
      colKey: 'status',
      width: 100,
      cell: ({ row }: { row: TransferRecord }) => {
        const statusMap: Record<string, { label: string; color: string }> = {
          pending: { label: '待处理', color: 'orange' },
          resolved: { label: '已解决', color: 'green' },
          cancelled: { label: '已取消', color: 'gray' }
        };
        const status = statusMap[row.status] || statusMap.pending;
        return <Tag color={status.color}>{status.label}</Tag>;
      }
    },
    {
      title: '转人工时间',
      colKey: 'transferred_at',
      width: 180,
      cell: ({ row }: { row: TransferRecord }) => (
        <span>{new Date(row.transferred_at).toLocaleString('zh-CN')}</span>
      )
    }
  ];

  const satisfactionColumns = [
    { title: '会话', colKey: 'sessionTitle', width: 200 },
    {
      title: '评分',
      colKey: 'score',
      width: 120,
      cell: ({ row }: { row: SatisfactionRating }) => (
        <div style={{ display: 'flex', gap: '2px' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <StarIcon
              key={star}
              size="16px"
              style={{ color: star <= row.score ? '#FFD700' : '#ddd' }}
            />
          ))}
        </div>
      )
    },
    {
      title: '评价',
      colKey: 'comment',
      width: 250,
      cell: ({ row }: { row: SatisfactionRating }) => (
        <span>{row.comment || '无评价'}</span>
      )
    },
    {
      title: '评价时间',
      colKey: 'created_at',
      width: 180,
      cell: ({ row }: { row: SatisfactionRating }) => (
        <span>{new Date(row.created_at).toLocaleString('zh-CN')}</span>
      )
    }
  ];

  return (
    <div
      className="flex h-screen w-screen"
      style={{ backgroundColor: 'var(--td-bg-color-page)' }}
    >
      {/* 管理后台侧边栏 */}
      <aside
        className="flex flex-col flex-shrink-0 w-[280px]"
        style={{ backgroundColor: 'var(--td-bg-color-container)' }}
      >
        {/* Logo */}
        <div className="h-14 px-4 flex items-center flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--td-brand-color)' }}
            >
              <span className="text-white text-sm font-bold">智</span>
            </div>
            <span
              className="text-lg font-semibold"
              style={{ color: 'var(--td-text-color-primary)' }}
            >
              管理后台
            </span>
          </div>
        </div>

        {/* 返回按钮 */}
        <div className="p-3">
          <Button
            icon={<ChevronLeftIcon />}
            onClick={() => navigate('/')}
            block
            variant="outline"
          >
            返回客服
          </Button>
        </div>

        {/* 菜单 */}
        <div className="flex-1 p-2 space-y-1">
          {[
            { key: 'dashboard', label: '数据概览', icon: <ChatIcon size={16} /> },
            { key: 'transfers', label: '转人工记录', icon: <UserIcon size={16} /> },
            { key: 'satisfaction', label: '满意度评价', icon: <StarIcon size={16} /> },
          ].map(item => (
            <div
              key={item.key}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
              style={{
                backgroundColor: activeTab === item.key ? 'var(--td-brand-color-light)' : 'transparent',
                color: activeTab === item.key ? 'var(--td-brand-color)' : 'var(--td-text-color-secondary)',
              }}
              onClick={() => setActiveTab(item.key)}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto">
        <div style={{ padding: '24px' }}>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--td-text-color-primary)' }}>
              {activeTab === 'dashboard' ? '数据概览' : activeTab === 'transfers' ? '转人工记录' : '满意度评价'}
            </h1>
            <Button icon={<RefreshIcon />} onClick={loadData} loading={loading}>
              刷新数据
            </Button>
          </div>

          {activeTab === 'dashboard' && (
            <>
              {/* 统计卡片 */}
              <Row gutter={16} style={{ marginBottom: '24px' }}>
                <Col span={6}>
                  <Card>
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <ChatIcon size="32px" style={{ color: '#0052d9', marginBottom: '8px' }} />
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--td-text-color-primary)' }}>
                        {stats?.totalSessions || 0}
                      </div>
                      <div style={{ color: 'var(--td-text-color-secondary)', marginTop: '4px' }}>总会话数</div>
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <ChatIcon size="32px" style={{ color: '#2ba471', marginBottom: '8px' }} />
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--td-text-color-primary)' }}>
                        {stats?.totalMessages || 0}
                      </div>
                      <div style={{ color: 'var(--td-text-color-secondary)', marginTop: '4px' }}>总消息数</div>
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <UserIcon size="32px" style={{ color: '#ed7b2f', marginBottom: '8px' }} />
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--td-text-color-primary)' }}>
                        {stats?.transferredSessions || 0}
                      </div>
                      <div style={{ color: 'var(--td-text-color-secondary)', marginTop: '4px' }}>转人工会话</div>
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <StarIcon size="32px" style={{ color: '#FFD700', marginBottom: '8px' }} />
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--td-text-color-primary)' }}>
                        {stats?.averageSatisfaction || 0}
                        <span style={{ fontSize: '14px', color: 'var(--td-text-color-secondary)' }}>/5</span>
                      </div>
                      <div style={{ color: 'var(--td-text-color-secondary)', marginTop: '4px' }}>平均满意度</div>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* 意图分布 + 满意度分布 */}
              <Row gutter={16}>
                <Col span={12}>
                  <Card title="意图分布">
                    <div style={{ padding: '16px' }}>
                      {stats?.intentDistribution && Object.entries(stats.intentDistribution).map(([intent, count]) => (
                        <div key={intent} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <Tag color={intentColors[intent] || 'gray'}>
                            {intentLabels[intent] || intent}
                          </Tag>
                          <span style={{ fontWeight: 'bold', color: 'var(--td-text-color-primary)' }}>{count} 次</span>
                        </div>
                      ))}
                      {(!stats?.intentDistribution || Object.keys(stats.intentDistribution).length === 0) && (
                        <div style={{ textAlign: 'center', color: 'var(--td-text-color-placeholder)', padding: '20px' }}>
                          暂无数据
                        </div>
                      )}
                    </div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="满意度分布">
                    <div style={{ padding: '16px' }}>
                      {stats?.satisfactionDistribution && [5, 4, 3, 2, 1].map((score) => (
                        <div key={score} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{ width: '80px', display: 'flex', gap: '2px' }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <StarIcon
                                key={s}
                                size="14px"
                                style={{ color: s <= score ? '#FFD700' : '#ddd' }}
                              />
                            ))}
                          </div>
                          <div style={{ flex: 1, marginLeft: '12px' }}>
                            <div style={{ height: '20px', background: 'var(--td-bg-color-component)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${((stats.satisfactionDistribution[score] || 0) / Math.max(...Object.values(stats.satisfactionDistribution), 1)) * 100}%`,
                                  background: '#FFD700',
                                  transition: 'width 0.3s'
                                }}
                              />
                            </div>
                          </div>
                          <span style={{ marginLeft: '12px', fontWeight: 'bold', color: 'var(--td-text-color-primary)' }}>
                            {stats.satisfactionDistribution[score] || 0}
                          </span>
                        </div>
                      ))}
                      {(!stats?.satisfactionDistribution || Object.keys(stats.satisfactionDistribution).length === 0) && (
                        <div style={{ textAlign: 'center', color: 'var(--td-text-color-placeholder)', padding: '20px' }}>
                          暂无数据
                        </div>
                      )}
                    </div>
                  </Card>
                </Col>
              </Row>
            </>
          )}

          {activeTab === 'transfers' && (
            <Card>
              <Table
                data={transfers}
                columns={transferColumns}
                rowKey="id"
                loading={loading}
                pagination={{ defaultCurrent: 1, defaultPageSize: 10, total: transfers.length }}
              />
            </Card>
          )}

          {activeTab === 'satisfaction' && (
            <Card>
              <Table
                data={satisfactionRatings}
                columns={satisfactionColumns}
                rowKey="id"
                loading={loading}
                pagination={{ defaultCurrent: 1, defaultPageSize: 10, total: satisfactionRatings.length }}
              />
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
