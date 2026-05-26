import { Loading, Tag } from 'tdesign-react';
import { ChatMarkdown } from '@tdesign-react/chat';
import { User, Bot } from 'lucide-react';
import { Message, ContentBlock, IntentType } from '../types';

// 意图标签配置
const INTENT_LABELS: Record<IntentType, string> = {
  refund: '退款/退货',
  order_query: '订单查询',
  tech_support: '技术支持',
  transfer_human: '转人工',
  complaint: '投诉建议',
  greeting: '打招呼',
  general: '通用咨询'
};

const INTENT_COLORS: Record<IntentType, string> = {
  refund: 'red',
  order_query: 'blue',
  tech_support: 'green',
  transfer_human: 'orange',
  complaint: 'red',
  greeting: 'cyan',
  general: 'gray'
};

interface ChatMessagesProps {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export function ChatMessages({
  messages,
  messagesEndRef,
}: ChatMessagesProps) {
  // 渲染单个内容块
  const renderContentBlock = (block: ContentBlock, index: number, isStreaming?: boolean, isLast?: boolean) => {
    if (block.type === 'text') {
      return (
        <div
          key={`text-${index}`}
          className="px-4 py-3 leading-relaxed break-words"
          style={{
            backgroundColor: 'var(--td-bg-color-component)',
            color: 'var(--td-text-color-primary)',
            borderRadius: '16px 16px 16px 4px'
          }}
        >
          <div className="chat-markdown">
            <ChatMarkdown content={block.text} />
          </div>
          {isStreaming && isLast && (
            <span
              className="animate-cursor-blink ml-0.5"
              style={{ color: 'var(--td-brand-color)' }}
            >
              |
            </span>
          )}
        </div>
      );
    }
    return null;
  };

  // 渲染 assistant 消息内容
  const renderAssistantContent = (message: Message) => {
    if (message.contentBlocks && message.contentBlocks.length > 0) {
      return message.contentBlocks.map((block, index) =>
        renderContentBlock(block, index, message.isStreaming, index === message.contentBlocks!.length - 1)
      );
    }

    return (
      <>
        {message.content && (
          <div
            className="px-4 py-3 leading-relaxed break-words"
            style={{
              backgroundColor: 'var(--td-bg-color-component)',
              color: 'var(--td-text-color-primary)',
              borderRadius: '16px 16px 16px 4px'
            }}
          >
            <div className="chat-markdown">
              <ChatMarkdown content={message.content} />
            </div>
            {message.isStreaming && (
              <span
                className="animate-cursor-blink ml-0.5"
                style={{ color: 'var(--td-brand-color)' }}
              >
                |
              </span>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {messages.map(message => (
        <div
          key={message.id}
          className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          <div
            className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-full self-start"
            style={{
              backgroundColor: message.role === 'user'
                ? 'var(--td-brand-color)'
                : 'var(--td-bg-color-component)',
              color: message.role === 'user'
                ? 'white'
                : 'var(--td-text-color-primary)'
            }}
          >
            {message.role === 'user' ? <User size={18} /> : <Bot size={18} />}
          </div>
          <div
            className={`flex flex-col gap-2 max-w-[80%] ${message.role === 'user' ? 'items-end' : ''}`}
          >
            {message.role === 'assistant' && (
              <div className="flex items-center gap-2">
                <span
                  className="text-xs"
                  style={{ color: 'var(--td-text-color-placeholder)' }}
                >
                  小智
                </span>
                {/* 显示意图标签 */}
                {message.intent && message.intent !== 'greeting' && (
                  <Tag
                    size="small"
                    color={INTENT_COLORS[message.intent as IntentType] || 'gray'}
                    variant="light"
                  >
                    {INTENT_LABELS[message.intent as IntentType] || message.intent}
                  </Tag>
                )}
              </div>
            )}

            {/* 用户消息 */}
            {message.role === 'user' && (
              <div
                className="px-4 py-3 leading-relaxed break-words"
                style={{
                  backgroundColor: 'var(--td-brand-color)',
                  color: 'white',
                  borderRadius: '16px 16px 4px 16px'
                }}
              >
                {message.content}
              </div>
            )}

            {/* 助手消息 */}
            {message.role === 'assistant' && renderAssistantContent(message)}

            {/* 思考中状态 */}
            {message.role === 'assistant' && message.isStreaming &&
             !message.content &&
             (!message.contentBlocks || message.contentBlocks.length === 0) && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--td-bg-color-component)' }}
              >
                <Loading size="small" />
                <span
                  className="text-sm"
                  style={{ color: 'var(--td-text-color-secondary)' }}
                >
                  思考中...
                </span>
              </div>
            )}
          </div>
        </div>
      ))}

      <div ref={messagesEndRef} />
    </div>
  );
}
