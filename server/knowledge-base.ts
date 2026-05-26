// FAQ 知识库模块
export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
}

// 意图类型
export type IntentType = 'refund' | 'order_query' | 'tech_support' | 'transfer_human' | 'general' | 'greeting' | 'complaint';

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  entities?: Record<string, string>;
  description: string;
}

// FAQ 知识库数据
export const faqDatabase: FaqItem[] = [
  // 退款相关
  {
    id: 'refund-001',
    category: '退款',
    question: '如何申请退款？',
    answer: '您好！申请退款的步骤如下：\n1. 登录您的账号，进入"我的订单"\n2. 找到需要退款的订单，点击"申请退款"\n3. 选择退款原因并提交\n4. 我们会在1-3个工作日内处理您的退款申请\n\n退款到账时间取决于您的支付方式，一般3-7个工作日。',
    keywords: ['退款', '退钱', '退货', '不要了', '取消订单', '申请退款'],
    priority: 1
  },
  {
    id: 'refund-002',
    category: '退款',
    question: '退款多久能到账？',
    answer: '退款到账时间取决于您的支付方式：\n• 支付宝/微信支付：1-3个工作日\n• 银行卡：3-7个工作日\n• 信用卡：7-15个工作日\n\n如果超过上述时间仍未到账，请联系客服查询。',
    keywords: ['退款到账', '多久退款', '退款时间', '什么时候退'],
    priority: 2
  },
  {
    id: 'refund-003',
    category: '退款',
    question: '退款被拒绝怎么办？',
    answer: '如果您的退款申请被拒绝，可能是以下原因：\n1. 超过退款期限（一般为收货后7天内）\n2. 商品已使用或损坏\n3. 不符合退款政策\n\n您可以：\n• 查看拒绝原因，补充材料重新申请\n• 联系客服说明情况\n• 如有异议，可申请人工复审',
    keywords: ['退款拒绝', '退款失败', '不给退', '拒绝退款'],
    priority: 3
  },

  // 订单查询相关
  {
    id: 'order-001',
    category: '订单',
    question: '如何查询订单状态？',
    answer: '查询订单状态的方法：\n1. 登录账号，点击"我的订单"\n2. 在订单列表中查看状态标签\n3. 点击订单可查看详细物流信息\n\n订单状态说明：\n• 待付款：订单已创建，等待支付\n• 待发货：已支付，商家准备发货\n• 已发货：商品已发出，可查看物流\n• 已完成：交易成功',
    keywords: ['订单状态', '查订单', '订单查询', '我的订单', '查看订单'],
    priority: 1
  },
  {
    id: 'order-002',
    category: '订单',
    question: '订单物流在哪里查？',
    answer: '查看物流信息：\n1. 进入"我的订单"\n2. 找到对应订单，点击"查看物流"\n3. 可以看到实时物流轨迹\n\n您也可以复制运单号，到对应快递公司官网查询。',
    keywords: ['物流', '快递', '发货了吗', '到哪了', '运单号', '追踪'],
    priority: 2
  },
  {
    id: 'order-003',
    category: '订单',
    question: '订单可以修改吗？',
    answer: '订单修改规则：\n• 待付款订单：可以取消重新下单\n• 已付款未发货：联系客服修改收货地址\n• 已发货订单：无法修改，可收货后申请退换\n\n修改地址请提供：订单号、新地址、联系电话',
    keywords: ['修改订单', '改地址', '改电话', '订单改'],
    priority: 3
  },

  // 技术支持相关
  {
    id: 'tech-001',
    category: '技术支持',
    question: '无法登录怎么办？',
    answer: '登录问题排查：\n1. 检查账号密码是否正确（注意大小写）\n2. 清除浏览器缓存和Cookie\n3. 尝试使用"忘记密码"重置\n4. 检查网络连接是否正常\n5. 尝试更换浏览器或设备\n\n如果仍无法登录，可能是账号被锁定，请联系客服。',
    keywords: ['登录', '登陆', '无法登录', '登不上', '账号', '密码错误'],
    priority: 1
  },
  {
    id: 'tech-002',
    category: '技术支持',
    question: '页面加载不出来怎么办？',
    answer: '页面加载问题解决方法：\n1. 检查网络连接\n2. 刷新页面（Ctrl+F5 强制刷新）\n3. 清除浏览器缓存\n4. 禁用浏览器扩展插件\n5. 尝试使用无痕/隐私模式\n6. 更换浏览器（推荐Chrome）\n\n如仍有问题，可能是服务器维护中，请稍后再试。',
    keywords: ['加载', '打不开', '页面错误', '白屏', '卡住', '崩溃'],
    priority: 2
  },
  {
    id: 'tech-003',
    category: '技术支持',
    question: '支付失败怎么办？',
    answer: '支付失败常见原因及解决：\n1. 余额不足：请确认支付账户有足够余额\n2. 银行卡限额：联系银行提高限额\n3. 网络问题：切换网络后重试\n4. 支付密码错误：确认密码正确\n5. 风控拦截：更换支付方式\n\n如多次失败，建议更换支付方式或联系客服。',
    keywords: ['支付失败', '付款失败', '支付不了', '付不了款', '支付错误'],
    priority: 3
  },

  // 通用问题
  {
    id: 'general-001',
    category: '通用',
    question: '营业时间是什么时候？',
    answer: '我们的服务时间：\n• 在线客服：7×24小时\n• 电话客服：工作日 9:00-18:00\n• 工单处理：工作日 9:00-18:00\n\n节假日可能有调整，请关注公告。',
    keywords: ['营业时间', '工作时间', '上班时间', '客服时间'],
    priority: 2
  },
  {
    id: 'general-002',
    category: '通用',
    question: '如何联系人工客服？',
    answer: '联系人工客服的方式：\n1. 在线客服：点击页面右下角"联系客服"\n2. 电话客服：400-XXX-XXXX\n3. 邮箱：support@example.com\n4. 微信公众号：XXX\n\n您也可以直接对我说"转人工"，我会为您转接。',
    keywords: ['人工客服', '转人工', '真人', '客服电话', '联系客服'],
    priority: 1
  },
  {
    id: 'general-003',
    category: '通用',
    question: '如何投诉？',
    answer: '投诉渠道：\n1. 在线投诉：登录后进入"帮助中心"→"投诉建议"\n2. 电话投诉：400-XXX-XXXX 转投诉专线\n3. 邮箱投诉：complaint@example.com\n\n我们会在24小时内响应您的投诉，3个工作日内给出处理结果。',
    keywords: ['投诉', '举报', '不满', '差评', '服务差'],
    priority: 2
  }
];

// 意图识别关键词映射
const intentPatterns: Record<IntentType, { keywords: string[]; weight: number }> = {
  refund: {
    keywords: ['退款', '退钱', '退货', '退回', '不要了', '取消订单', '退订', '返还'],
    weight: 1.0
  },
  order_query: {
    keywords: ['订单', '物流', '快递', '发货', '到哪了', '查单', '运单', '追踪', '配送'],
    weight: 0.9
  },
  tech_support: {
    keywords: ['登录', '密码', '打不开', '加载', '报错', '崩溃', '支付失败', '无法', '故障', 'bug'],
    weight: 0.8
  },
  transfer_human: {
    keywords: ['人工', '真人', '转接', '客服', '经理', '主管', '投诉'],
    weight: 1.0
  },
  complaint: {
    keywords: ['投诉', '举报', '不满', '差评', '骗子', '欺诈', '曝光'],
    weight: 0.9
  },
  greeting: {
    keywords: ['你好', '您好', 'hi', 'hello', '嗨', '在吗', '在不在'],
    weight: 0.5
  },
  general: {
    keywords: ['什么', '怎么', '如何', '为什么', '可以', '能', '吗'],
    weight: 0.3
  }
};

// 意图识别函数
export function identifyIntent(message: string): IntentResult {
  const lowerMessage = message.toLowerCase();
  const scores: Record<IntentType, number> = {} as any;

  // 计算每个意图的匹配分数
  for (const [intent, pattern] of Object.entries(intentPatterns)) {
    let score = 0;
    let matchCount = 0;

    for (const keyword of pattern.keywords) {
      if (lowerMessage.includes(keyword)) {
        score += pattern.weight;
        matchCount++;
      }
    }

    // 如果匹配到多个关键词，增加分数
    if (matchCount > 1) {
      score *= (1 + matchCount * 0.2);
    }

    scores[intent as IntentType] = score;
  }

  // 找到最高分的意图
  let maxIntent: IntentType = 'general';
  let maxScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxIntent = intent as IntentType;
    }
  }

  // 如果没有明显的意图匹配，返回 general
  if (maxScore < 0.3) {
    return {
      intent: 'general',
      confidence: 0.5,
      description: '通用咨询'
    };
  }

  // 计算置信度（归一化到 0-1）
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = Math.min(maxScore / (totalScore || 1) * 2, 1);

  // 意图描述
  const intentDescriptions: Record<IntentType, string> = {
    refund: '退款/退货咨询',
    order_query: '订单/物流查询',
    tech_support: '技术支持',
    transfer_human: '转人工客服',
    complaint: '投诉建议',
    greeting: '打招呼',
    general: '通用咨询'
  };

  // 提取可能的实体
  const entities: Record<string, string> = {};

  // 提取订单号
  const orderMatch = message.match(/\d{10,}/);
  if (orderMatch) {
    entities.orderId = orderMatch[0];
  }

  // 提取退款金额
  const amountMatch = message.match(/(\d+\.?\d*)\s*元/);
  if (amountMatch) {
    entities.amount = amountMatch[1];
  }

  return {
    intent: maxIntent,
    confidence,
    entities,
    description: intentDescriptions[maxIntent]
  };
}

// FAQ 检索函数
export function searchFaq(query: string, limit: number = 3): FaqItem[] {
  const lowerQuery = query.toLowerCase();
  const results: Array<{ item: FaqItem; score: number }> = [];

  for (const item of faqDatabase) {
    let score = 0;

    // 检查问题匹配
    if (item.question.toLowerCase().includes(lowerQuery)) {
      score += 10;
    }

    // 检查关键词匹配
    for (const keyword of item.keywords) {
      if (lowerQuery.includes(keyword)) {
        score += 5;
      }
    }

    // 检查分类匹配
    if (lowerQuery.includes(item.category)) {
      score += 3;
    }

    // 根据优先级调整分数
    score += (4 - item.priority) * 0.5;

    if (score > 0) {
      results.push({ item, score });
    }
  }

  // 按分数排序并返回
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.item);
}

// 根据意图获取相关 FAQ
export function getFaqByIntent(intent: IntentType): FaqItem[] {
  const categoryMap: Record<IntentType, string[]> = {
    refund: ['退款'],
    order_query: ['订单'],
    tech_support: ['技术支持'],
    transfer_human: ['通用'],
    complaint: ['通用'],
    greeting: [],
    general: []
  };

  const categories = categoryMap[intent] || [];
  if (categories.length === 0) {
    return [];
  }

  return faqDatabase.filter(item => categories.includes(item.category));
}
