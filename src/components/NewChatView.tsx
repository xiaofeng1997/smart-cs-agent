import { Tag } from 'tdesign-react';
import {
  ChatIcon,
  RefreshIcon,
  HelpCircleIcon,
  ServiceIcon
} from 'tdesign-icons-react';
import { APP_CONFIG } from '../config';

// 快捷问题
const QUICK_QUESTIONS = [
  { icon: <RefreshIcon />, label: '退款', text: '如何申请退款？', color: '#e34d59' },
  { icon: <ChatIcon />, label: '订单', text: '查询我的订单状态', color: '#0052d9' },
  { icon: <ServiceIcon />, label: '技术', text: '无法登录怎么办？', color: '#2ba471' },
  { icon: <HelpCircleIcon />, label: '支付', text: '支付失败怎么办？', color: '#ed7b2f' },
];

interface NewChatViewProps {
  onQuickQuestion: (text: string) => void;
}

export function NewChatView({ onQuickQuestion }: NewChatViewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-full max-w-lg">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg mx-auto"
            style={{
              background: 'linear-gradient(135deg, var(--td-brand-color), var(--td-brand-color-hover))'
            }}
          >
            <span className="text-3xl font-bold text-white">{APP_CONFIG.nameInitial}</span>
          </div>
          <h2
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            {APP_CONFIG.name}
          </h2>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            {APP_CONFIG.description}
          </p>
        </div>

        {/* 快捷问题 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-primary)' }}>
            常见问题
          </label>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_QUESTIONS.map((q, index) => (
              <div
                key={index}
                className="p-3 rounded-xl cursor-pointer transition-all border hover:shadow-md hover:-translate-y-0.5"
                style={{
                  borderColor: 'var(--td-component-border)',
                  backgroundColor: 'var(--td-bg-color-component)',
                }}
                onClick={() => onQuickQuestion(q.text)}
              >
                <div className="flex items-center gap-2">
                  <Tag color={q.color} variant="light" icon={q.icon}>
                    {q.label}
                  </Tag>
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--td-text-color-secondary)' }}>
                  {q.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 提示文字 */}
        <div
          className="p-4 rounded-xl text-center"
          style={{ backgroundColor: 'var(--td-bg-color-component)' }}
        >
          <p className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
            您可以直接输入问题，或点击上方常见问题快速开始
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Tag size="small" color="blue" variant="light">退款</Tag>
            <Tag size="small" color="green" variant="light">订单</Tag>
            <Tag size="small" color="orange" variant="light">技术支持</Tag>
            <Tag size="small" color="red" variant="light">投诉</Tag>
          </div>
        </div>
      </div>
    </div>
  );
}
