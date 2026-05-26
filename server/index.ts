import 'dotenv/config';
import express from "express";
import { query, unstable_v2_createSession, unstable_v2_authenticate, PermissionResult, CanUseTool } from "@tencent-ai/agent-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "./db.js";
import { identifyIntent, searchFaq, getFaqByIntent, IntentType } from "./knowledge-base.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// 静态文件服务（生产环境）
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
}

// 缓存可用模型列表
let cachedModels: Array<{ modelId: string; name: string; description?: string }> = [];
const defaultModel = "claude-sonnet-4";

// 智能客服系统提示词
const CS_SYSTEM_PROMPT = `你是一个专业的智能客服助手，名叫"小智"。你的职责是帮助用户解决各种问题。

## 你的能力
1. **FAQ 检索**：可以查询常见问题的答案
2. **意图识别**：自动识别用户的问题类型（退款、订单查询、技术支持等）
3. **转人工**：当无法解决问题时，可以转接人工客服

## 回答原则
- 保持友好、专业的态度
- 回答要简洁明了，避免过长
- 如果不确定答案，建议转人工客服
- 使用中文回答

## 可用工具
你可以使用以下工具来帮助用户：
- search_faq: 搜索 FAQ 知识库
- transfer_to_human: 转接人工客服
- record_intent: 记录用户意图

当用户的问题超出你的能力范围时，请主动使用 transfer_to_human 工具转接人工客服。`;

// 待处理的权限请求
interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  reject: (error: Error) => void;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

const pendingPermissions = new Map<string, PendingPermission>();

// 权限请求超时时间（5分钟）
const PERMISSION_TIMEOUT = 5 * 60 * 1000;

// 健康检查
app.get("/api/health", async (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 登录方式类型
type LoginMethod = 'env' | 'cli' | 'none';

interface LoginStatusResponse {
  isLoggedIn: boolean;
  method?: LoginMethod;
  envConfigured?: boolean;
  cliConfigured?: boolean;
  error?: string;
  apiKey?: string;
  envVars?: {
    apiKey?: string;
    authToken?: string;
    internetEnv?: string;
    baseUrl?: string;
  };
}

// 检查 CodeBuddy CLI 登录状态
app.get("/api/check-login", async (req, res) => {
  const response: LoginStatusResponse = {
    isLoggedIn: false,
    envConfigured: false,
    cliConfigured: false,
    envVars: {},
  };

  // 1. 检查环境变量
  const apiKey = process.env.CODEBUDDY_API_KEY;
  const authToken = process.env.CODEBUDDY_AUTH_TOKEN;
  const internetEnv = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
  const baseUrl = process.env.CODEBUDDY_BASE_URL;

  if (apiKey || authToken) {
    response.envConfigured = true;
    if (apiKey) {
      response.envVars!.apiKey = apiKey.slice(0, 8) + '****' + apiKey.slice(-4);
      response.apiKey = response.envVars!.apiKey;
    }
    if (authToken) {
      response.envVars!.authToken = authToken.slice(0, 8) + '****' + authToken.slice(-4);
    }
    if (internetEnv) {
      response.envVars!.internetEnv = internetEnv;
    }
    if (baseUrl) {
      response.envVars!.baseUrl = baseUrl;
    }
  }

  // 2. 使用 unstable_v2_authenticate 检查登录状态
  try {
    let needsLogin = false;

    const result = await unstable_v2_authenticate({
      environment: 'external',
      onAuthUrl: async (authState) => {
        needsLogin = true;
        console.log('[Check Login] 需要登录，认证 URL:', authState.authUrl);
        response.error = '未登录，请先登录 CodeBuddy CLI';
      }
    });

    if (!needsLogin && result?.userinfo) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
      console.log('[Check Login] 已登录用户:', result.userinfo.userName);
    } else if (!needsLogin) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
    }
  } catch (error: any) {
    console.error("[Check Login] SDK Error:", error);
    if (response.envConfigured) {
      response.isLoggedIn = true;
      response.method = 'env';
    } else {
      response.error = error?.message || String(error);
      response.method = 'none';
    }
  }

  res.json(response);
});

// 保存环境变量配置
app.post("/api/save-env-config", (req, res) => {
  const { apiKey, authToken, internetEnv, baseUrl } = req.body;

  if (!apiKey && !authToken) {
    return res.status(400).json({ error: '请至少配置 API Key 或 Auth Token' });
  }

  const configuredVars: string[] = [];

  if (apiKey) {
    process.env.CODEBUDDY_API_KEY = apiKey;
    configuredVars.push('CODEBUDDY_API_KEY');
  }
  if (authToken) {
    process.env.CODEBUDDY_AUTH_TOKEN = authToken;
    configuredVars.push('CODEBUDDY_AUTH_TOKEN');
  }
  if (internetEnv) {
    process.env.CODEBUDDY_INTERNET_ENVIRONMENT = internetEnv;
    configuredVars.push('CODEBUDDY_INTERNET_ENVIRONMENT');
  }
  if (baseUrl) {
    process.env.CODEBUDDY_BASE_URL = baseUrl;
    configuredVars.push('CODEBUDDY_BASE_URL');
  }

  cachedModels = [];

  res.json({
    success: true,
    message: `已设置: ${configuredVars.join(', ')}`,
    note: '环境变量仅在当前服务器进程有效，重启后需要重新设置'
  });
});

// 获取可用模型列表
app.get("/api/models", async (req, res) => {
  try {
    if (cachedModels.length === 0) {
      console.log("[Models] Creating session to fetch available models...");
      const session = await unstable_v2_createSession({
        cwd: process.cwd()
      });
      console.log("[Models] Session created, calling getAvailableModels()...");
      const models = await session.getAvailableModels();
      console.log("[Models] Got", models.length, "models");

      if (models && Array.isArray(models)) {
        cachedModels = models;
      }
    }

    res.json({
      models: cachedModels.length > 0 ? cachedModels : [
        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }
      ],
      defaultModel
    });
  } catch (error: any) {
    console.error("[Models] Error:", error);
    res.json({
      models: [
        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" },
        { modelId: "claude-opus-4", name: "Claude Opus 4" }
      ],
      defaultModel,
      error: error?.message || String(error)
    });
  }
});

// ============= 智能客服 API =============

// 意图识别 API
app.post("/api/intent", (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "消息不能为空" });
  }

  const intent = identifyIntent(message);
  res.json({ intent });
});

// FAQ 搜索 API
app.post("/api/faq/search", (req, res) => {
  const { query, limit = 3 } = req.body;

  if (!query) {
    return res.status(400).json({ error: "查询内容不能为空" });
  }

  const results = searchFaq(query, limit);
  res.json({ results });
});

// 根据意图获取 FAQ
app.get("/api/faq/by-intent/:intent", (req, res) => {
  const { intent } = req.params;
  const results = getFaqByIntent(intent as IntentType);
  res.json({ results });
});

// 转人工 API
app.post("/api/transfer", (req, res) => {
  const { sessionId, reason, intent } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "会话ID不能为空" });
  }

  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "会话不存在" });
  }

  const transferRecord = db.createTransferRecord({
    id: uuidv4(),
    session_id: sessionId,
    reason: reason || '用户请求转人工',
    intent: intent || null,
    transferred_at: new Date().toISOString(),
    resolved_at: null,
    status: 'pending'
  });

  res.json({ success: true, record: transferRecord });
});

// 提交满意度评价
app.post("/api/satisfaction", (req, res) => {
  const { sessionId, score, comment } = req.body;

  if (!sessionId || !score) {
    return res.status(400).json({ error: "会话ID和评分不能为空" });
  }

  if (score < 1 || score > 5) {
    return res.status(400).json({ error: "评分必须在1-5之间" });
  }

  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "会话不存在" });
  }

  const rating = db.createSatisfactionRating({
    id: uuidv4(),
    session_id: sessionId,
    score,
    comment: comment || null,
    created_at: new Date().toISOString()
  });

  res.json({ success: true, rating });
});

// ============= 会话 API =============

// 获取所有会话（包含消息数量和统计信息）
app.get("/api/sessions", (req, res) => {
  try {
    const sessions = db.getAllSessions();
    const sessionsWithDetails = sessions.map(session => {
      const messages = db.getMessagesBySession(session.id);
      const satisfaction = db.getSatisfactionBySession(session.id);
      const transfer = db.getTransferBySession(session.id);

      return {
        ...session,
        messageCount: messages.length,
        satisfaction,
        transfer,
        isTransferred: session.is_transferred === 1
      };
    });
    res.json({ sessions: sessionsWithDetails });
  } catch (error: any) {
    console.error("[Sessions] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 获取单个会话及其消息
app.get("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
    }

    const messages = db.getMessagesBySession(sessionId);
    const satisfaction = db.getSatisfactionBySession(sessionId);
    const transfer = db.getTransferBySession(sessionId);

    const parsedMessages = messages.map(msg => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
    }));

    res.json({
      session: {
        ...session,
        isTransferred: session.is_transferred === 1
      },
      messages: parsedMessages,
      satisfaction,
      transfer
    });
  } catch (error: any) {
    console.error("[Session] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 创建新会话
app.post("/api/sessions", (req, res) => {
  try {
    const { model = defaultModel, title = "新对话" } = req.body;
    const now = new Date().toISOString();

    const session = db.createSession({
      id: uuidv4(),
      title,
      model,
      sdk_session_id: null,
      intent: null,
      is_transferred: 0,
      satisfaction_score: null,
      created_at: now,
      updated_at: now
    });

    res.json({ session });
  } catch (error: any) {
    console.error("[Create Session] Error:", error);
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

// 更新会话
app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model, intent, is_transferred, satisfaction_score } = req.body;

    const success = db.updateSession(sessionId, {
      title,
      model,
      intent,
      is_transferred,
      satisfaction_score
    });

    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Update Session] Error:", error);
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

// 删除会话
app.delete("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = db.deleteSession(sessionId);

    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Session] Error:", error);
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ============= 管理后台 API =============

// 获取仪表盘统计数据
app.get("/api/admin/dashboard", (req, res) => {
  try {
    const stats = db.getDashboardStats();
    res.json({ stats });
  } catch (error: any) {
    console.error("[Dashboard] Error:", error);
    res.status(500).json({ error: error?.message || "获取统计数据失败" });
  }
});

// 获取所有转人工记录
app.get("/api/admin/transfers", (req, res) => {
  try {
    const records = db.getTransferRecords();
    const recordsWithSession = records.map(record => {
      const session = db.getSession(record.session_id);
      return {
        ...record,
        sessionTitle: session?.title || '未知会话'
      };
    });
    res.json({ records: recordsWithSession });
  } catch (error: any) {
    console.error("[Transfers] Error:", error);
    res.status(500).json({ error: error?.message || "获取转人工记录失败" });
  }
});

// 获取所有满意度评价
app.get("/api/admin/satisfaction", (req, res) => {
  try {
    const ratings = db.getAllSatisfactionRatings();
    const ratingsWithSession = ratings.map(rating => {
      const session = db.getSession(rating.session_id);
      return {
        ...rating,
        sessionTitle: session?.title || '未知会话'
      };
    });
    res.json({ ratings: ratingsWithSession });
  } catch (error: any) {
    console.error("[Satisfaction] Error:", error);
    res.status(500).json({ error: error?.message || "获取满意度数据失败" });
  }
});

// ============= 聊天 API =============

// 权限响应 API
app.post("/api/permission-response", (req, res) => {
  const { requestId, behavior, message } = req.body;

  console.log(`[Permission] Response received: requestId=${requestId}, behavior=${behavior}`);

  const pending = pendingPermissions.get(requestId);
  if (!pending) {
    console.log(`[Permission] Request not found: ${requestId}`);
    return res.status(404).json({ error: "权限请求不存在或已超时" });
  }

  pendingPermissions.delete(requestId);

  if (behavior === 'allow') {
    pending.resolve({
      behavior: 'allow',
      updatedInput: pending.input
    });
  } else {
    pending.resolve({
      behavior: 'deny',
      message: message || '用户拒绝了此操作'
    });
  }

  res.json({ success: true });
});

// 发送消息并获取流式响应
app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model, systemPrompt, cwd, permissionMode } = req.body;

  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}`);
  console.log(`[Chat] Model: ${model}`);
  console.log(`[Chat] Message: ${message?.slice(0, 100)}${message?.length > 100 ? '...' : ''}`);

  if (!message) {
    return res.status(400).json({ error: "消息不能为空" });
  }

  // 意图识别
  const intentResult = identifyIntent(message);
  console.log(`[Chat] Intent: ${intentResult.intent} (confidence: ${intentResult.confidence})`);

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();

  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
      model: model || defaultModel,
      sdk_session_id: null,
      intent: intentResult.intent,
      is_transferred: 0,
      satisfaction_score: null,
      created_at: now,
      updated_at: now
    });
  } else {
    // 更新会话意图
    db.updateSession(session.id, { intent: intentResult.intent });
  }

  const selectedModel = model || session.model;
  const sdkSessionId = session.sdk_session_id;

  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  // 保存用户消息
  try {
    db.createMessage({
      id: userMessageId,
      session_id: session.id,
      role: 'user',
      content: message,
      model: null,
      created_at: now,
      tool_calls: null,
      intent: intentResult.intent
    });
  } catch (dbError: any) {
    console.error(`[Chat] 保存用户消息失败:`, dbError);
    return res.status(500).json({ error: "保存消息失败", detail: dbError?.message });
  }

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 构建包含 FAQ 信息的系统提示词
  let enhancedSystemPrompt = systemPrompt || CS_SYSTEM_PROMPT;

  // 如果识别到意图，添加相关 FAQ 信息
  if (intentResult.intent !== 'general' && intentResult.intent !== 'greeting') {
    const relatedFaq = getFaqByIntent(intentResult.intent);
    if (relatedFaq.length > 0) {
      enhancedSystemPrompt += `\n\n## 相关 FAQ 信息\n以下是与用户问题相关的常见问题解答，请参考回答：\n`;
      relatedFaq.forEach(faq => {
        enhancedSystemPrompt += `\n### ${faq.question}\n${faq.answer}\n`;
      });
    }
  }

  const workingDir = cwd || process.cwd();

  try {
    console.log(`[Chat] 调用 SDK query...`);

    // 创建 canUseTool 回调
    const canUseTool: CanUseTool = async (toolName, input, options) => {
      console.log(`[Permission] Tool request: ${toolName}`);

      if (permissionMode === 'bypassPermissions') {
        return { behavior: 'allow', updatedInput: input };
      }

      const requestId = uuidv4();
      const permissionRequest = {
        requestId,
        toolUseId: options.toolUseID,
        toolName,
        input,
        sessionId: session.id,
        timestamp: Date.now()
      };

      res.write(`data: ${JSON.stringify({
        type: "permission_request",
        ...permissionRequest
      })}\n\n`);

      return new Promise<PermissionResult>((resolve, reject) => {
        const pending: PendingPermission = {
          resolve,
          reject,
          toolName,
          input,
          sessionId: session.id,
          timestamp: Date.now()
        };

        pendingPermissions.set(requestId, pending);

        setTimeout(() => {
          if (pendingPermissions.has(requestId)) {
            pendingPermissions.delete(requestId);
            resolve({
              behavior: 'deny',
              message: '权限请求超时'
            });
          }
        }, PERMISSION_TIMEOUT);
      });
    };

    // 使用 Query API
    const stream = query({
      prompt: message,
      options: {
        cwd: workingDir,
        model: selectedModel,
        maxTurns: 10,
        systemPrompt: enhancedSystemPrompt,
        permissionMode: permissionMode || 'default',
        canUseTool,
        ...(sdkSessionId ? { resume: sdkSessionId } : {})
      }
    });

    let fullResponse = "";
    let toolCalls: Array<{
      id: string;
      name: string;
      input?: Record<string, unknown>;
      status: string;
      result?: string;
      isError?: boolean;
    }> = [];
    let newSdkSessionId: string | null = null;

    // 发送初始化信息
    res.write(`data: ${JSON.stringify({
      type: "init",
      sessionId: session.id,
      userMessageId,
      assistantMessageId,
      model: selectedModel,
      intent: intentResult
    })}\n\n`);

    let currentToolId: string | null = null;

    // 处理流式响应
    for await (const msg of stream) {
      console.log("[Stream] Message type:", msg.type);

      if (msg.type === "system" && (msg as any).subtype === "init") {
        newSdkSessionId = (msg as any).session_id;
        if (newSdkSessionId && newSdkSessionId !== sdkSessionId) {
          db.updateSession(session.id, { sdk_session_id: newSdkSessionId });
        }
      } else if (msg.type === "assistant") {
        const content = msg.message.content;

        if (typeof content === "string") {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              fullResponse += block.text;
              res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              currentToolId = block.id || uuidv4();
              const toolInput = (block as any).input || {};

              const toolCall = {
                id: currentToolId,
                name: block.name,
                input: toolInput,
                status: "running"
              };
              toolCalls.push(toolCall);
              res.write(`data: ${JSON.stringify({
                type: "tool",
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.input,
                status: toolCall.status
              })}\n\n`);
            }
          }
        }
      } else if (msg.type === "tool_result") {
        const msgAny = msg as any;
        const toolId = msgAny.tool_use_id || currentToolId;
        const isError = msgAny.is_error || false;
        const content = msgAny.content;

        const tool = toolCalls.find(t => t.id === toolId) || toolCalls[toolCalls.length - 1];
        if (tool) {
          tool.status = isError ? "error" : "completed";
          tool.isError = isError;
          tool.result = typeof content === 'string'
            ? content
            : JSON.stringify(content);
          res.write(`data: ${JSON.stringify({
            type: "tool_result",
            toolId: tool.id,
            content: tool.result,
            isError: isError
          })}\n\n`);
        }
        currentToolId = null;
      } else if (msg.type === "result") {
        toolCalls.forEach(tool => {
          if (tool.status === "running") {
            tool.status = "completed";
            res.write(`data: ${JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result || "已完成" })}\n\n`);
          }
        });
        res.write(`data: ${JSON.stringify({ type: "done", duration: msg.duration, cost: msg.cost })}\n\n`);
      }
    }

    // 保存助手消息
    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: fullResponse,
      model: selectedModel,
      created_at: new Date().toISOString(),
      tool_calls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
      intent: intentResult.intent
    });

    // 更新会话标题
    const messages = db.getMessagesBySession(session.id);
    if (messages.length <= 2) {
      db.updateSession(session.id, {
        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        model: selectedModel
      });
    }

    console.log(`[Chat] 请求完成 ✓`);
    res.end();
  } catch (error: any) {
    console.error(`\n[Chat] ========== 错误 ==========`);
    console.error(`[Chat] Error:`, error?.message);

    const errorMessage = error?.message || "处理请求时发生错误";
    res.write(`data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`);
    res.end();
  }
});

// ============= 自定义模型 API（OpenAI 兼容）============

// 获取自定义模型配置
app.get("/api/custom-model/config", (req, res) => {
  const customApiUrl = process.env.CUSTOM_MODEL_API_URL;
  const customModelName = process.env.CUSTOM_MODEL_NAME;
  const hasApiKey = !!process.env.CUSTOM_MODEL_API_KEY;

  res.json({
    enabled: !!(customApiUrl && hasApiKey),
    modelName: customModelName || null,
    apiUrl: customApiUrl || null
  });
});

// 自定义模型聊天（SSE 流式）
app.post("/api/custom-model/chat", async (req, res) => {
  const { sessionId, message, systemPrompt } = req.body;

  const customApiUrl = process.env.CUSTOM_MODEL_API_URL;
  const customApiKey = process.env.CUSTOM_MODEL_API_KEY;
  const customModelName = process.env.CUSTOM_MODEL_NAME || 'gpt-3.5-turbo';

  if (!customApiUrl || !customApiKey) {
    return res.status(400).json({ error: "自定义模型未配置" });
  }

  if (!message) {
    return res.status(400).json({ error: "消息不能为空" });
  }

  console.log(`\n[CustomChat] ========== 新请求 ==========`);
  console.log(`[CustomChat] Model: ${customModelName}`);
  console.log(`[CustomChat] Message: ${message?.slice(0, 100)}`);

  // 意图识别
  const intentResult = identifyIntent(message);
  console.log(`[CustomChat] Intent: ${intentResult.intent}`);

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();

  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
      model: customModelName,
      sdk_session_id: null,
      intent: intentResult.intent,
      is_transferred: 0,
      satisfaction_score: null,
      created_at: now,
      updated_at: now
    });
  } else {
    db.updateSession(session.id, { intent: intentResult.intent });
  }

  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  // 保存用户消息
  db.createMessage({
    id: userMessageId,
    session_id: session.id,
    role: 'user',
    content: message,
    model: null,
    created_at: now,
    tool_calls: null,
    intent: intentResult.intent
  });

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 构建系统提示词
  let enhancedSystemPrompt = systemPrompt || CS_SYSTEM_PROMPT;

  // 添加 FAQ 信息
  if (intentResult.intent !== 'general' && intentResult.intent !== 'greeting') {
    const relatedFaq = getFaqByIntent(intentResult.intent);
    if (relatedFaq.length > 0) {
      enhancedSystemPrompt += `\n\n## 相关 FAQ 信息\n以下是与用户问题相关的常见问题解答，请参考回答：\n`;
      relatedFaq.forEach(faq => {
        enhancedSystemPrompt += `\n### ${faq.question}\n${faq.answer}\n`;
      });
    }
  }

  // 发送初始化信息
  res.write(`data: ${JSON.stringify({
    type: "init",
    sessionId: session.id,
    userMessageId,
    assistantMessageId,
    model: customModelName,
    intent: intentResult
  })}\n\n`);

  try {
    // 获取历史消息（最近10条）
    const historyMessages = db.getMessagesBySession(session.id)
      .filter(m => m.id !== userMessageId)
      .slice(-10)
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

    // 构建 OpenAI 格式的请求
    const openaiMessages = [
      { role: 'system', content: enhancedSystemPrompt },
      ...historyMessages,
      { role: 'user', content: message }
    ];

    // 调用 OpenAI 兼容 API
    const apiUrl = customApiUrl.endsWith('/chat/completions')
      ? customApiUrl
      : `${customApiUrl}/chat/completions`;

    console.log(`[CustomChat] Calling API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customApiKey}`
      },
      body: JSON.stringify({
        model: customModelName,
        messages: openaiMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CustomChat] API Error: ${response.status}`, errorText);
      throw new Error(`API 调用失败: ${response.status} ${errorText}`);
    }

    // 处理 SSE 流式响应
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    if (reader) {
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

          const dataStr = trimmedLine.slice(6);
          if (dataStr === '[DONE]') {
            res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
            continue;
          }

          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content;

            if (content) {
              fullResponse += content;
              res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    // 保存助手消息
    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: fullResponse,
      model: customModelName,
      created_at: new Date().toISOString(),
      tool_calls: null,
      intent: intentResult.intent
    });

    // 更新会话标题
    const messages = db.getMessagesBySession(session.id);
    if (messages.length <= 2) {
      db.updateSession(session.id, {
        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        model: customModelName
      });
    }

    console.log(`[CustomChat] 请求完成 ✓`);
    res.end();
  } catch (error: any) {
    console.error(`[CustomChat] Error:`, error?.message);
    res.write(`data: ${JSON.stringify({ type: "error", message: error?.message || "处理请求时发生错误" })}\n\n`);
    res.end();
  }
});

// SPA fallback
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// 初始化数据库并启动服务器
async function startServer() {
  await db.initDatabase();

  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     ◉ 智能客服系统已启动                      ║
║                                            ║
║     地址: http://localhost:${PORT}            ║
║     数据库: SQLite (data/chat.db)          ║
║                                            ║
╚════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(console.error);
