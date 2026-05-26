import { useRef, useCallback } from 'react';
import { Tooltip, Button, Tag } from 'tdesign-react';
import { ChatSender } from '@tdesign-react/chat';
import { UserIcon } from 'tdesign-icons-react';

interface ChatInputProps {
  inputValue: string;
  isLoading: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
  onChange: (value: string) => void;
  onTransferToHuman?: () => void;
  showSatisfactionDialog?: () => void;
}

export function ChatInput({
  inputValue,
  isLoading,
  onSend,
  onStop,
  onChange,
  onTransferToHuman,
  showSatisfactionDialog,
}: ChatInputProps) {
  const chatSenderRef = useRef<any>(null);

  const handleSend = useCallback((e: any) => {
    const content = e?.detail?.message || e?.detail || e?.message || inputValue;
    if (content && typeof content === 'string' && content.trim()) {
      onSend(content.trim());
    } else if (inputValue.trim()) {
      onSend(inputValue.trim());
    }
  }, [inputValue, onSend]);

  const handleChange = useCallback((e: any) => {
    const value = e?.detail ?? e ?? '';
    onChange(typeof value === 'string' ? value : '');
  }, [onChange]);

  return (
    <div
      className="px-4 pb-6 pt-4"
      style={{
        backgroundColor: 'var(--td-bg-color-page)'
      }}
    >
      <div className="max-w-3xl mx-auto">
        {/* 功能按钮区 */}
        <div className="flex items-center gap-2 mb-2">
          <Tag color="blue" variant="light">LongCat-Flash-Lite</Tag>
          {onTransferToHuman && (
            <Tooltip content="转接人工客服" placement="top">
              <Button
                icon={<UserIcon />}
                size="small"
                variant="outline"
                onClick={onTransferToHuman}
                style={{ color: '#ed7b2f', borderColor: '#ed7b2f' }}
              >
                转人工
              </Button>
            </Tooltip>
          )}
          {showSatisfactionDialog && (
            <Tooltip content="对本次服务进行评价" placement="top">
              <Button
                size="small"
                variant="outline"
                onClick={showSatisfactionDialog}
                style={{ color: '#FFD700', borderColor: '#FFD700' }}
              >
                评价服务
              </Button>
            </Tooltip>
          )}
        </div>

        <ChatSender
          ref={chatSenderRef}
          value={inputValue}
          placeholder="输入您的问题，例如：如何申请退款？"
          loading={isLoading}
          autosize={{ minRows: 1, maxRows: 6 }}
          actions={['send']}
          onSend={handleSend}
          onStop={onStop}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
