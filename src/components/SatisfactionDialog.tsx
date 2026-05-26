import React, { useState } from 'react';
import { Dialog, Button, Textarea, MessagePlugin } from 'tdesign-react';
import { StarIcon } from 'tdesign-icons-react';

interface SatisfactionDialogProps {
  visible: boolean;
  sessionId: string;
  onClose: () => void;
  onSubmit: (score: number, comment: string) => void;
}

const SatisfactionDialog: React.FC<SatisfactionDialogProps> = ({
  visible,
  sessionId,
  onClose,
  onSubmit
}) => {
  const [score, setScore] = useState<number>(0);
  const [hoverScore, setHoverScore] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (score === 0) {
      MessagePlugin.warning('请选择评分');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/satisfaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          score,
          comment: comment.trim() || null
        })
      });

      if (response.ok) {
        MessagePlugin.success('感谢您的评价！');
        onSubmit(score, comment);
        setScore(0);
        setComment('');
        onClose();
      } else {
        MessagePlugin.error('提交失败，请重试');
      }
    } catch (error) {
      MessagePlugin.error('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreText = (s: number): string => {
    const texts: Record<number, string> = {
      1: '非常不满意',
      2: '不满意',
      3: '一般',
      4: '满意',
      5: '非常满意'
    };
    return texts[s] || '';
  };

  return (
    <Dialog
      header="服务评价"
      visible={visible}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="outline" onClick={onClose}>
            跳过
          </Button>
          <Button
            theme="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={score === 0}
          >
            提交评价
          </Button>
        </div>
      }
      width={420}
    >
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <p style={{ marginBottom: '16px', color: '#666' }}>
          请对本次服务进行评价
        </p>

        {/* 星星评分 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <div
              key={star}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoverScore(star)}
              onMouseLeave={() => setHoverScore(0)}
              onClick={() => setScore(star)}
            >
              <StarIcon
                size="32px"
                style={{
                  color: star <= (hoverScore || score) ? '#FFD700' : '#ddd',
                  transition: 'color 0.2s'
                }}
              />
            </div>
          ))}
        </div>

        {/* 评分文字 */}
        {(hoverScore || score) > 0 && (
          <p style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '16px' }}>
            {getScoreText(hoverScore || score)}
          </p>
        )}

        {/* 评价输入框 */}
        <div style={{ padding: '0 20px' }}>
          <Textarea
            value={comment}
            onChange={(value) => setComment(value)}
            placeholder="请留下您的评价或建议（可选）"
            maxlength={200}
            autosize={{ minRows: 3, maxRows: 5 }}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default SatisfactionDialog;
