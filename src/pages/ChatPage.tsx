import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessagePlugin } from 'tdesign-react';
import { Session, PermissionMode } from '../types';
import { NewChatView } from '../components/NewChatView';
import { ChatMessages } from '../components/ChatMessages';
import { ChatInput } from '../components/ChatInput';
import SatisfactionDialog from '../components/SatisfactionDialog';

interface ChatPageProps {
  currentSession: Session | undefined;
  isLoading: boolean;
  inputValue: string;
  onSendMessage: (message: string, newChatOptions?: NewChatOptions, onNavigate?: (path: string) => void) => void;
  onStop: () => void;
  onInputChange: (value: string) => void;
}

interface NewChatOptions {
  agentId: string;
  cwd: string;
  permissionMode: PermissionMode;
}

export function ChatPage({
  currentSession,
  isLoading,
  inputValue,
  onSendMessage,
  onStop,
  onInputChange,
}: ChatPageProps) {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 满意度评价弹窗
  const [satisfactionVisible, setSatisfactionVisible] = useState(false);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // 处理发送消息
  const handleSend = useCallback((message: string) => {
    if (!currentSession) {
      // 新对话
      onSendMessage(message, {
        agentId: 'default',
        cwd: '',
        permissionMode: 'default',
      }, (path) => {
        navigate(path);
      });
    } else {
      onSendMessage(message);
    }
  }, [currentSession, onSendMessage, navigate]);

  // 快捷问题点击
  const handleQuickQuestion = useCallback((text: string) => {
    handleSend(text);
  }, [handleSend]);

  // 转人工
  const handleTransferToHuman = useCallback(async () => {
    if (!currentSession) {
      MessagePlugin.warning('请先开始对话');
      return;
    }

    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          reason: '用户请求转人工',
          intent: currentSession.intent || 'general'
        })
      });

      if (response.ok) {
        MessagePlugin.success('已为您转接人工客服，请稍候...');
        onSendMessage('【系统】用户请求转接人工客服，正在为您分配人工客服...');
      } else {
        MessagePlugin.error('转人工失败，请重试');
      }
    } catch {
      MessagePlugin.error('网络错误，请重试');
    }
  }, [currentSession, onSendMessage]);

  const showNewChatView = !currentSession || currentSession.messages.length === 0;

  return (
    <>
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {showNewChatView ? (
          <NewChatView onQuickQuestion={handleQuickQuestion} />
        ) : (
          <ChatMessages
            messages={currentSession!.messages}
            messagesEndRef={messagesEndRef}
          />
        )}
      </div>

      {/* 输入区域 */}
      <ChatInput
        inputValue={inputValue}
        isLoading={isLoading}
        onSend={handleSend}
        onStop={onStop}
        onChange={onInputChange}
        onTransferToHuman={currentSession ? handleTransferToHuman : undefined}
        showSatisfactionDialog={currentSession ? () => setSatisfactionVisible(true) : undefined}
      />

      {/* 满意度评价弹窗 */}
      {currentSession && (
        <SatisfactionDialog
          visible={satisfactionVisible}
          sessionId={currentSession.id}
          onClose={() => setSatisfactionVisible(false)}
          onSubmit={() => {}}
        />
      )}
    </>
  );
}
