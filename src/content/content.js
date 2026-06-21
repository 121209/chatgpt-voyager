(function () {
  const APP_ID = "cgpt-question-rail";
  const USER_MESSAGE_SELECTOR = '[data-message-author-role="user"]';
  const STRICT_CONVERSATION_TURN_SELECTOR = '[data-testid^="conversation-turn-"], [data-testid*="conversation-turn"]';
  const CONVERSATION_TURN_SELECTOR = `${STRICT_CONVERSATION_TURN_SELECTOR}, article`;
  const USER_MESSAGE_CANDIDATE_SELECTOR = [
    USER_MESSAGE_SELECTOR,
    '[data-testid*="user-message" i]',
    '[class*="user-message" i]',
    '[aria-label*="用户消息"]',
    '[aria-label*="your message" i]',
    '[aria-label*="message from you" i]'
  ].join(",");
  const GITHUB_ISSUE_URL = "https://github.com/121209/chatgpt-voyager/issues/new/choose";
  const CQR_ANCHOR_VERSION = 2;
  const CQR_CACHE_VERSION = 3;
  const IGNORED_QUESTION_TEXTS = new Set([
    "展开收起",
    "展开",
    "收起",
    "分享",
    "更多",
    "目录",
    "导出",
    "复制",
    "编辑",
    "删除",
    "重试",
    "重新生成",
    "新聊天",
    "搜索聊天",
    "项目",
    "正在思考",
    "思考中",
    "已思考",
    "正在推理",
    "推理中",
    "已推理",
    "反馈问题 / Report Issue"
  ]);

  let rail = null;
  let directory = null;
  let directoryButton = null;
  let directoryButtonTrigger = null;
  let tooltip = null;
  let railTrack = null;
  let railTrackContent = null;
  let railDotList = null;
  let questions = [];
  let observer = null;
  let refreshTimer = null;
  let scrollTimer = null;
  let mutationTimer = null;
  let urlTimer = null;
  let chatScrollContainer = null;
  let observedScrollContainer = null;
  let activeQuestionId = null;
  let searchQuery = "";
  let activeTab = "directory";
  let exportMode = "questions";
  let exportSelectionReady = false;
  let selectedMessageKeys = new Set();
  let knownMessageKeys = new Set();
  let exportQuestionSelectionReady = false;
  let selectedQuestionKeys = new Set();
  let knownQuestionExportKeys = new Set();
  let hideDirectoryButtonTimer = null;
  let directoryResizeState = null;
  let currentConversationId = "";
  let ephemeralConversationId = createEphemeralConversationId();
  let ephemeralFirstQuestionHash = "";
  let lastLocationHref = location.href;
  let isHydratingQuestions = false;
  let isRealtimeCaptureEnabled = true;
  let isCapturingFullConversation = false;
  let isManualCaptureEnabled = false;
  let cancelFullConversationCapture = false;
  let captureCompleted = false;
  let captureStatusMessage = "";
  let activeFullScanOrder = null;
  let lastRenderedQuestionSignature = "";
  let lastScanLogAt = 0;
  let lastChatScrollTop = null;
  let lastCaptureStatusRenderAt = 0;
  let railUserScrollUntil = 0;
  let activeLocateToken = 0;
  let cacheLoadToken = 0;
  let railPointerInside = false;
  let railWheelClassTimer = null;
  let railWheelDirection = 0;
  let railWheelDirectionUntil = 0;
  let railDocumentWheelListenerAttached = false;
  const handledRailWheelEvents = new WeakSet();

  function isDirectoryInteractiveTarget(target) {
    const element = target instanceof Element ? target : target?.parentElement;
    if (!element) return false;

    return Boolean(element.closest(
      "button, input, textarea, select, a, label, .cqr-resize-handle, .cqr-directory-list, .cqr-export-list"
    ));
  }

  function uniqueElements(elements) {
    return Array.from(new Set(elements.filter(Boolean)));
  }

  function isElementVisible(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isInsideComposerOrCqr(element) {
    return Boolean(element.closest(
      `#${APP_ID}, form, textarea, input, [contenteditable="true"], [data-testid*="composer" i], [id*="composer" i]`
    ));
  }

  function getConversationTurn(element) {
    return element.closest(CONVERSATION_TURN_SELECTOR) || element;
  }

  function isStrictConversationTurn(element) {
    return element instanceof Element && element.matches(STRICT_CONVERSATION_TURN_SELECTOR);
  }

  function getConversationTurnNumber(element) {
    const turn = element instanceof Element
      ? (isStrictConversationTurn(element) ? element : element.closest(STRICT_CONVERSATION_TURN_SELECTOR))
      : null;
    const testId = turn?.getAttribute("data-testid") || "";
    const match = testId.match(/conversation-turn-(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function hasExplicitUserMarker(element) {
    if (!(element instanceof Element)) return false;
    return element.matches?.(USER_MESSAGE_SELECTOR)
      || /user-message/i.test(element.getAttribute("data-testid") || "")
      || Boolean(element.querySelector(USER_MESSAGE_SELECTOR))
      || Boolean(element.querySelector('[data-testid*="user-message" i]'));
  }

  function hasExplicitAssistantMarker(element) {
    if (!(element instanceof Element)) return false;
    return element.matches?.('[data-message-author-role="assistant"]')
      || /assistant-message/i.test(element.getAttribute("data-testid") || "")
      || Boolean(element.querySelector('[data-message-author-role="assistant"]'))
      || Boolean(element.querySelector('[data-testid*="assistant-message" i]'));
  }

  function looksLikeGeneratedContent(text) {
    const normalized = normalizeQuestionText(text);
    const compact = normalized.replace(/\s+/g, "");
    const lower = normalized.toLowerCase();
    if (!normalized) return true;

    return /^(?:thought for|thinking for|reasoning for)\b/i.test(normalized)
      || /^(?:正在)?(?:思考|推理)(?:中|完成)?(?:\d+(?:秒|分钟|小时|s|m|min|mins|sec|secs|seconds?))?(?:[>›….\-:：]*)?$/.test(compact)
      || /^(?:已)(?:思考|推理)(?:\d+(?:秒|分钟|小时|s|m|min|mins|sec|secs|seconds?))?(?:[>›….\-:：]*)?$/.test(compact)
      || /^(?:thought|thinking|reasoning)(?:\s+for)?\s+\d+/i.test(normalized)
      || /^post\s+see new posts\s+conversation\b/i.test(normalized)
      || /^see new posts\b/i.test(normalized)
      || /(?:^|\s)(?:chatgpt|regenerate|重新生成|read aloud|朗读|copy code|复制代码)(?:\s|$)/i.test(normalized)
      || (/\b(?:reply|repost|quote|like|bookmark|share|translate post|view on x|show more|show less)\b/i.test(normalized)
        && /\b(?:post|conversation|followers?|following|@[\w-]+)\b/i.test(normalized))
      || (/\bconversation\b/.test(lower) && /@\w/.test(lower) && /\bpost\b/.test(lower));
  }

  function looksLikeAssistantTurn(turn) {
    if (!(turn instanceof Element)) return false;
    if (hasExplicitAssistantMarker(turn)) return true;

    const text = (turn.innerText || turn.textContent || "").toLowerCase();
    return looksLikeGeneratedContent(text) && !hasExplicitUserMarker(turn);
  }

  function looksLikeUserMessageElement(element) {
    if (!(element instanceof Element)) return false;
    if (isInsideComposerOrCqr(element)) return false;
    if (!isElementVisible(element)) return false;
    if (element.closest('[data-message-author-role="assistant"], [data-testid*="assistant-message" i]')) return false;

    const text = getMessageText(element);
    if (!text || text.length < 1) return false;
    if (isIgnoredQuestionText(text)) return false;

    const turn = getConversationTurn(element);
    if (looksLikeAssistantTurn(turn)) return false;

    const className = String(element.className || "");
    const testId = element.getAttribute("data-testid") || "";
    const ariaLabel = element.getAttribute("aria-label") || "";

    if (looksLikeGeneratedContent(text)) return false;

    return /user-message/i.test(testId)
      || /user-message|user.*bubble|message.*user/i.test(className)
      || /message from you|your message|用户消息|你发送的消息/i.test(ariaLabel)
      || hasExplicitUserMarker(turn);
  }

  function findRightAlignedUserBubble(turn) {
    if (!(turn instanceof Element) || looksLikeAssistantTurn(turn)) return null;

    const candidates = Array.from(turn.querySelectorAll("div, p"))
      .filter((element) => !isInsideComposerOrCqr(element))
      .filter((element) => !element.closest('[data-message-author-role="assistant"], [data-testid*="assistant-message" i]'))
      .filter(isElementVisible)
      .map((element) => ({
        element,
        text: getMessageText(element),
        rect: element.getBoundingClientRect()
      }))
      .filter((candidate) => {
        if (isIgnoredQuestionText(candidate.text)) return false;
        if (looksLikeGeneratedContent(candidate.text)) return false;
        if (!candidate.text || candidate.text.length > 3000) return false;
        if (candidate.rect.width < 24 || candidate.rect.height < 18) return false;
        return candidate.rect.left > window.innerWidth * 0.36
          || candidate.rect.right > window.innerWidth * 0.68;
      })
      .sort((a, b) => {
        const aScore = a.rect.left + (a.rect.right / window.innerWidth) * 100 - a.text.length * 0.02;
        const bScore = b.rect.left + (b.rect.right / window.innerWidth) * 100 - b.text.length * 0.02;
        return bScore - aScore;
      });

    return candidates[0]?.element || null;
  }

  function isLikelyUserTurn(turn) {
    if (!(turn instanceof Element)) return false;
    if (hasExplicitUserMarker(turn)) return true;
    if (looksLikeAssistantTurn(turn)) return false;
    return Boolean(findRightAlignedUserBubble(turn));
  }

  function resolveUserMessageElementFromTurn(turn) {
    if (!(turn instanceof Element)) return null;
    return turn.querySelector(USER_MESSAGE_SELECTOR)
      || turn.querySelector('[data-testid*="user-message" i]')
      || turn.querySelector('[class*="user-message" i]')
      || Array.from(turn.querySelectorAll([
        '[aria-label*="用户消息"]',
        '[aria-label*="your message" i]',
        '[aria-label*="message from you" i]',
        '[class*="user"]'
      ].join(","))).find(looksLikeUserMessageElement)
      || findRightAlignedUserBubble(turn);
  }

  function filterNestedUserMessages(elements) {
    const unique = uniqueElements(elements).filter((element) => element instanceof Element);
    return unique.filter((element) => {
      const elementTurn = getConversationTurn(element);
      return !unique.some((other) => {
        if (other === element) return false;
        if (getConversationTurn(other) !== elementTurn) return false;
        return element.contains(other) && getMessageText(other).length >= Math.max(1, getMessageText(element).length * 0.45);
      });
    });
  }

  function scoreUserMessageCandidate(element) {
    const text = getMessageText(element);
    const className = String(element.className || "");
    const testId = element.getAttribute("data-testid") || "";
    const role = element.getAttribute("data-message-author-role") || "";
    const aria = element.getAttribute("aria-label") || "";
    let score = 0;

    if (role === "user") score += 100;
    if (/user-message/i.test(testId)) score += 80;
    if (/user-message|message.*user/i.test(className)) score += 50;
    if (/用户消息|your message|message from you/i.test(aria)) score += 45;
    if (text.length > 0) score += Math.min(40, text.length / 8);
    if (text.length > 1200) score -= 30;
    if (element.querySelector(USER_MESSAGE_CANDIDATE_SELECTOR)) score -= 12;

    return score;
  }

  function getUserMessageDedupeKey(element) {
    const strictTurn = element.closest(STRICT_CONVERSATION_TURN_SELECTOR);
    if (strictTurn) {
      const testId = strictTurn.getAttribute("data-testid") || "";
      if (testId) return `turn:${testId}`;
    }

    const text = getMessageText(element);
    const rect = element.getBoundingClientRect();
    const topBucket = Math.round(rect.top / 36);
    return `pos:${hashQuestionText(text)}:${topBucket}`;
  }

  function dedupeUserMessages(elements) {
    const grouped = new Map();

    filterNestedUserMessages(elements)
      .filter((element) => getMessageText(element).length > 0)
      .forEach((element) => {
        const key = getUserMessageDedupeKey(element);
        const current = grouped.get(key);
        if (!current || scoreUserMessageCandidate(element) > scoreUserMessageCandidate(current)) {
          grouped.set(key, element);
        }
      });

    return Array.from(grouped.values())
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  }

  function getUserMessages() {
    const strictTurns = Array.from(document.querySelectorAll(STRICT_CONVERSATION_TURN_SELECTOR));
    const turnSelector = strictTurns.length > 0 ? STRICT_CONVERSATION_TURN_SELECTOR : CONVERSATION_TURN_SELECTOR;
    const turnMatches = Array.from(document.querySelectorAll(turnSelector))
      .filter((turn) => !turn.closest(`#${APP_ID}`))
      .filter(isLikelyUserTurn)
      .map(resolveUserMessageElementFromTurn)
      .filter(Boolean);

    const directMatches = Array.from(document.querySelectorAll(USER_MESSAGE_CANDIDATE_SELECTOR))
      .filter(looksLikeUserMessageElement);

    return dedupeUserMessages([...turnMatches, ...directMatches])
      .filter((node) => !node.closest(`#${APP_ID}`))
      .filter((node) => !isInsideComposerOrCqr(node))
      .filter((node) => {
        const turn = getConversationTurn(node);
        return !looksLikeAssistantTurn(turn);
      });
  }

  function getMessageText(node) {
    return (node.innerText || node.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getQuestionScrollTarget(node) {
    if (!(node instanceof Element)) return node;

    return node.closest(CONVERSATION_TURN_SELECTOR) || node;
  }

  function createEphemeralConversationId() {
    return `new-chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getPersistentConversationIdFromUrl() {
    const match = location.pathname.match(/\/c\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  }

  function isUnsavedConversationUrl() {
    return location.pathname === "/" || location.pathname === "";
  }

  function getConversationIdFromUrl() {
    const persistentId = getPersistentConversationIdFromUrl();
    if (persistentId) return persistentId;
    return isUnsavedConversationUrl() ? ephemeralConversationId : hashQuestionText(location.pathname + location.search);
  }

  function questionCacheKey(conversationId) {
    return `cqr_questions_v${CQR_CACHE_VERSION}_${conversationId}`;
  }

  function questionCacheBackupKey(conversationId) {
    return `${questionCacheKey(conversationId)}_backup`;
  }

  function getQuestionIdConversationId(question) {
    const id = String(question?.id || "");
    const hash = question?.hash || (question?.text ? hashQuestionText(question.text) : "");
    if (!id || !hash) return "";

    const marker = `:${hash}:`;
    const markerIndex = id.indexOf(marker);
    return markerIndex > 0 ? id.slice(0, markerIndex) : "";
  }

  function questionBelongsToConversation(question, conversationId, { allowUnknown = false } = {}) {
    if (!question || !conversationId) return false;

    const questionConversationId = String(question.conversationId || "");
    if (questionConversationId && questionConversationId !== conversationId) return false;

    const idConversationId = getQuestionIdConversationId(question);
    if (idConversationId && idConversationId !== conversationId) return false;

    return allowUnknown || Boolean(questionConversationId || idConversationId);
  }

  function filterQuestionsForConversation(items = [], conversationId = currentConversationId) {
    return items.filter((question) => questionBelongsToConversation(question, conversationId));
  }

  function normalizeQuestionText(text) {
    return String(text || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function hashQuestionText(text) {
    const normalized = normalizeQuestionText(text).slice(0, 300);
    let hash = 5381;

    for (let index = 0; index < normalized.length; index += 1) {
      hash = ((hash << 5) + hash) ^ normalized.charCodeAt(index);
    }

    return `q${(hash >>> 0).toString(36)}`;
  }

  function hashFullQuestionText(text) {
    const normalized = normalizeQuestionText(text);
    let hash = 2166136261;

    for (let index = 0; index < normalized.length; index += 1) {
      hash ^= normalized.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return `f${(hash >>> 0).toString(36)}`;
  }

  function getQuestionOrderKey(question) {
    if (Number.isFinite(question?.turnNumber)) return `turn:${question.turnNumber}`;
    if (question?.elementKey) return `element:${question.elementKey}`;
    if (question?.id) return `id:${question.id}`;

    const text = normalizeQuestionText(question?.text);
    return text ? `exact:${question?.exactHash || hashFullQuestionText(text)}` : "";
  }

  function findQuestionByStableIdentity(items, targetQuestion) {
    if (!targetQuestion) return null;
    const targetHasTurn = Number.isFinite(targetQuestion.turnNumber);

    if (targetHasTurn) {
      const byTurn = items.find((question) => question.turnNumber === targetQuestion.turnNumber);
      if (byTurn) return byTurn;
    }

    if (targetQuestion.id) {
      const byId = items.find((question) => question.id === targetQuestion.id
        && (!targetHasTurn || !Number.isFinite(question.turnNumber)));
      if (byId) return byId;
    }

    if (targetQuestion.elementKey) {
      const byElementKey = items.find((question) => question.elementKey === targetQuestion.elementKey
        && (!targetHasTurn || !Number.isFinite(question.turnNumber)));
      if (byElementKey) return byElementKey;
    }

    const text = normalizeQuestionText(targetQuestion.text);
    if (!text) return null;
    const exactHash = targetQuestion.exactHash || hashFullQuestionText(text);
    const candidates = items.filter((question) => {
      if ((question.exactHash || hashFullQuestionText(question.text)) !== exactHash) return false;
      if (Number.isFinite(targetQuestion.turnNumber) && Number.isFinite(question.turnNumber)) return false;
      if (targetQuestion.elementKey && question.elementKey) return false;
      return true;
    });

    return candidates.length === 1 ? candidates[0] : null;
  }

  function shortQuestionText(text) {
    const normalized = normalizeQuestionText(text);
    return normalized.length > 88 ? `${normalized.slice(0, 85)}...` : normalized;
  }

  function isIgnoredQuestionText(text) {
    const normalized = normalizeQuestionText(text);
    if (!normalized) return true;
    if (IGNORED_QUESTION_TEXTS.has(normalized)) return true;
    if (/^(?:展开收起|展开|收起|分享|更多|目录|导出|复制|编辑|删除|重试|重新生成)$/.test(normalized)) return true;
    if (/^(?:反馈问题\s*\/\s*Report Issue|Report Issue)$/i.test(normalized)) return true;
    if (/^thought for\s+\d+\s*(?:s|sec|secs|second|seconds|min|mins|m|分钟|秒)(?:\s+\d+\s*(?:s|sec|secs|seconds|秒))?\s*>?$/i.test(normalized)) return true;
    if (looksLikeGeneratedContent(normalized)) return true;
    return false;
  }

  function getCacheQuestionCount(cache, conversationId = currentConversationId) {
    return Array.isArray(cache?.questions)
      ? cache.questions
        .filter((question) => question?.text && !isIgnoredQuestionText(question.text))
        .filter((question) => questionBelongsToConversation(question, conversationId))
        .length
      : 0;
  }

  function sanitizeQuestionCache(cache, conversationId) {
    if (!cache) return null;
    if (cache.cacheVersion && cache.cacheVersion !== CQR_CACHE_VERSION) return null;
    if (cache.conversationId && cache.conversationId !== conversationId) return null;

    return {
      ...cache,
      conversationId,
      questions: Array.isArray(cache.questions)
        ? cache.questions.filter((question) => questionBelongsToConversation(question, conversationId, { allowUnknown: false }))
        : []
    };
  }

  function chooseBestQuestionCache(caches, conversationId = currentConversationId) {
    return caches
      .map((cache) => sanitizeQuestionCache(cache, conversationId))
      .filter(Boolean)
      .sort((a, b) => {
        const countDiff = getCacheQuestionCount(b, conversationId) - getCacheQuestionCount(a, conversationId);
        if (countDiff !== 0) return countDiff;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      })[0] || null;
  }

  function parseQuestionCache(raw) {
    if (!raw) return null;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }

  function getSerializedQuestionKey(question) {
    const text = normalizeQuestionText(question?.text);
    if (!text) return "";
    if (Number.isFinite(question?.turnNumber)) return `turn:${question.turnNumber}`;
    if (question?.id) return `id:${question.id}`;
    if (question?.elementKey) return `element:${question.elementKey}`;
    return `exact:${question.exactHash || hashFullQuestionText(text)}`;
  }

  function mergeSerializedQuestion(existing, incoming) {
    const existingHasAnchor = hasReliableQuestionAnchor(existing);
    const incomingHasAnchor = hasReliableQuestionAnchor(incoming);
    const preferIncomingPosition = incoming.loaded || incomingHasAnchor || !existingHasAnchor;

    return {
      ...existing,
      ...incoming,
      id: existing.id || incoming.id,
      conversationId: incoming.conversationId || existing.conversationId,
      firstSeenAt: existing.firstSeenAt || incoming.firstSeenAt,
      lastSeenAt: Math.max(existing.lastSeenAt || 0, incoming.lastSeenAt || 0),
      loaded: Boolean(incoming.loaded),
      element: null,
      anchorTop: preferIncomingPosition ? incoming.anchorTop : existing.anchorTop,
      anchorScrollTop: preferIncomingPosition ? incoming.anchorScrollTop : existing.anchorScrollTop,
      anchorTargetScrollTop: preferIncomingPosition ? incoming.anchorTargetScrollTop : existing.anchorTargetScrollTop,
      anchorScrollHeight: preferIncomingPosition ? incoming.anchorScrollHeight : existing.anchorScrollHeight,
      anchorClientHeight: preferIncomingPosition ? incoming.anchorClientHeight : existing.anchorClientHeight,
      anchorRatio: preferIncomingPosition ? incoming.anchorRatio : existing.anchorRatio,
      anchorTargetRatio: preferIncomingPosition ? incoming.anchorTargetRatio : existing.anchorTargetRatio,
      anchorScrollRatio: preferIncomingPosition ? incoming.anchorScrollRatio : existing.anchorScrollRatio,
      anchorViewportOffset: preferIncomingPosition ? incoming.anchorViewportOffset : existing.anchorViewportOffset,
      anchorVersion: preferIncomingPosition ? incoming.anchorVersion : existing.anchorVersion
    };
  }

  function normalizeSerializedQuestion(question, conversationId, fallbackIndex) {
    const text = normalizeQuestionText(question?.text);
    const hash = question?.hash || hashQuestionText(text);
    const exactHash = question?.exactHash || hashFullQuestionText(text);

    return {
      ...question,
      id: question?.id || `${conversationId}:${hash}:${fallbackIndex + 1}`,
      conversationId,
      index: Number.isFinite(question?.index) ? question.index : fallbackIndex + 1,
      text,
      shortText: question?.shortText || shortQuestionText(text),
      hash,
      exactHash,
      element: null,
      loaded: Boolean(question?.loaded)
    };
  }

  function mergeSerializedQuestionLists(existingQuestions = [], incomingQuestions = [], conversationId = currentConversationId) {
    const merged = [];
    const byKey = new Map();

    [...existingQuestions, ...incomingQuestions].forEach((question, sourceIndex) => {
      if (!questionBelongsToConversation(question, conversationId, { allowUnknown: false })) return;
      const normalized = normalizeSerializedQuestion(question, conversationId, sourceIndex);
      if (!normalized.text || isIgnoredQuestionText(normalized.text)) return;

      const key = getSerializedQuestionKey(normalized);
      if (!key) return;

      const existingIndex = byKey.get(key);
      if (existingIndex === undefined) {
        byKey.set(key, merged.length);
        merged.push(normalized);
        return;
      }

      merged[existingIndex] = mergeSerializedQuestion(merged[existingIndex], normalized);
    });

    return dedupeQuestionsByTurnNumber(merged);
  }

  function serializeQuestion(question) {
    return {
      id: question.id,
      conversationId: question.conversationId,
      index: question.index,
      text: question.text,
      shortText: question.shortText,
      hash: question.hash || hashQuestionText(question.text),
      exactHash: question.exactHash || hashFullQuestionText(question.text),
      elementKey: question.elementKey,
      turnNumber: Number.isFinite(question.turnNumber) ? question.turnNumber : null,
      anchorTop: question.anchorTop,
      anchorScrollTop: question.anchorScrollTop,
      anchorTargetScrollTop: question.anchorTargetScrollTop,
      anchorScrollHeight: question.anchorScrollHeight,
      anchorClientHeight: question.anchorClientHeight,
      anchorRatio: question.anchorRatio,
      anchorTargetRatio: question.anchorTargetRatio,
      anchorScrollRatio: question.anchorScrollRatio,
      anchorViewportOffset: question.anchorViewportOffset,
      anchorVersion: question.anchorVersion || null,
      firstSeenAt: question.firstSeenAt,
      lastSeenAt: question.lastSeenAt,
      loaded: Boolean(question.loaded)
    };
  }

  async function readQuestionCache(conversationId) {
    if (!conversationId || conversationId.startsWith("new-chat-")) return null;

    const key = questionCacheKey(conversationId);
    const backupKey = questionCacheBackupKey(conversationId);
    const candidates = [];

    try {
      if (window.ChatGPTVoyagerStore?.get) {
        const result = await window.ChatGPTVoyagerStore.get([key, backupKey]);
        candidates.push(parseQuestionCache(result?.[key]));
        candidates.push(parseQuestionCache(result?.[backupKey]));
      }

      const raw = localStorage.getItem(key);
      const backupRaw = localStorage.getItem(backupKey);
      candidates.push(parseQuestionCache(raw));
      candidates.push(parseQuestionCache(backupRaw));

      const best = chooseBestQuestionCache(candidates, conversationId);
      if (best) {
        console.log("[CQR] question cache loaded", {
          conversationId,
          cachedCount: getCacheQuestionCount(best, conversationId)
        });
      }
      return best;
    } catch (error) {
      console.warn("[CQR] Failed to read question cache", error);
      return chooseBestQuestionCache(candidates, conversationId);
    }
  }

  async function writeQuestionCache(conversationId) {
    if (!conversationId || conversationId.startsWith("new-chat-")) return;

    const key = questionCacheKey(conversationId);
    const backupKey = questionCacheBackupKey(conversationId);
    if (conversationId !== currentConversationId || conversationId !== getConversationIdFromUrl()) return;

    const serializedQuestions = filterQuestionsForConversation(questions, conversationId)
      .map((question) => serializeQuestion({ ...question, conversationId }));
    const existingCache = await readQuestionCache(conversationId);
    if (conversationId !== currentConversationId || conversationId !== getConversationIdFromUrl()) return;
    const mergedQuestions = mergeSerializedQuestionLists(existingCache?.questions || [], serializedQuestions, conversationId);
    const payload = {
      cacheVersion: CQR_CACHE_VERSION,
      conversationId,
      updatedAt: Date.now(),
      captureCompleted: Boolean(captureCompleted || existingCache?.captureCompleted || existingCache?.fullScanCompleted),
      questions: mergedQuestions
    };

    try {
      if (window.ChatGPTVoyagerStore?.set) {
        await window.ChatGPTVoyagerStore.set({ [key]: payload, [backupKey]: payload });
      }

      localStorage.setItem(key, JSON.stringify(payload));
      localStorage.setItem(backupKey, JSON.stringify(payload));
    } catch (error) {
      console.warn("[CQR] Failed to write question cache", error);
    }
  }

  function hydrateCachedQuestion(question, index, conversationId) {
    const text = normalizeQuestionText(question.text);
    const hash = question.hash || hashQuestionText(text);
    const exactHash = question.exactHash || hashFullQuestionText(text);
    const id = question.id || `${conversationId}:${hash}:${index + 1}`;

    return {
      id,
      conversationId,
      index: index + 1,
      text,
      shortText: question.shortText || shortQuestionText(text),
      hash,
      exactHash,
      element: null,
      elementKey: question.elementKey || hash,
      turnNumber: Number.isFinite(question.turnNumber) ? question.turnNumber : null,
      anchorTop: Number.isFinite(question.anchorTop) ? question.anchorTop : null,
      anchorScrollTop: Number.isFinite(question.anchorScrollTop) ? question.anchorScrollTop : null,
      anchorTargetScrollTop: Number.isFinite(question.anchorTargetScrollTop) ? question.anchorTargetScrollTop : null,
      anchorScrollHeight: Number.isFinite(question.anchorScrollHeight) ? question.anchorScrollHeight : null,
      anchorClientHeight: Number.isFinite(question.anchorClientHeight) ? question.anchorClientHeight : null,
      anchorRatio: Number.isFinite(question.anchorRatio) ? question.anchorRatio : null,
      anchorTargetRatio: Number.isFinite(question.anchorTargetRatio) ? question.anchorTargetRatio : null,
      anchorScrollRatio: Number.isFinite(question.anchorScrollRatio) ? question.anchorScrollRatio : null,
      anchorViewportOffset: Number.isFinite(question.anchorViewportOffset) ? question.anchorViewportOffset : null,
      anchorVersion: question.anchorVersion || null,
      firstSeenAt: question.firstSeenAt || Date.now(),
      lastSeenAt: question.lastSeenAt || Date.now(),
      loaded: false
    };
  }

  function reindexQuestions(items) {
    return items.map((question, index) => ({
      ...question,
      index: index + 1
    }));
  }

  function getQuestionKeepScore(question) {
    return (question.loaded ? 1000000000 : 0)
      + (hasReliableQuestionAnchor(question) ? 1000000 : 0)
      + (Number.isFinite(question.lastSeenAt) ? question.lastSeenAt : 0);
  }

  function dedupeQuestionsByTurnNumber(items) {
    const output = [];
    const turnIndex = new Map();

    items.forEach((question) => {
      if (!Number.isFinite(question.turnNumber)) {
        output.push(question);
        return;
      }

      const existingIndex = turnIndex.get(question.turnNumber);
      if (existingIndex === undefined) {
        turnIndex.set(question.turnNumber, output.length);
        output.push(question);
        return;
      }

      const existing = output[existingIndex];
      if (getQuestionKeepScore(question) >= getQuestionKeepScore(existing)) {
        output[existingIndex] = question;
      }
    });

    return reindexQuestions(output);
  }

  function pruneQuestionsMissingFromScannedTurnWindow(items, scannedQuestions) {
    const scannedTurns = scannedQuestions
      .map((question) => question.turnNumber)
      .filter(Number.isFinite);
    if (scannedTurns.length < 3) return items;

    const minTurn = Math.min(...scannedTurns);
    const maxTurn = Math.max(...scannedTurns);
    const scannedTurnSet = new Set(scannedTurns);

    return items.filter((question) => {
      if (!Number.isFinite(question.turnNumber)) return true;
      if (question.loaded) return true;
      if (question.turnNumber < minTurn || question.turnNumber > maxTurn) return true;
      return scannedTurnSet.has(question.turnNumber);
    });
  }

  function findQuestionInsertIndex(items, scannedQuestions, scannedIndex, scanContext) {
    for (let index = scannedIndex - 1; index >= 0; index -= 1) {
      const previousQuestion = findQuestionByStableIdentity(items, scannedQuestions[index]);
      const previousIndex = previousQuestion ? items.indexOf(previousQuestion) : -1;
      if (previousIndex >= 0) return previousIndex + 1;
    }

    for (let index = scannedIndex + 1; index < scannedQuestions.length; index += 1) {
      const nextQuestion = findQuestionByStableIdentity(items, scannedQuestions[index]);
      const nextIndex = nextQuestion ? items.indexOf(nextQuestion) : -1;
      if (nextIndex >= 0) return nextIndex;
    }

    if (scanContext?.isNearTop) return 0;
    return items.length;
  }

  function mergeQuestionIndex(oldQuestions, newlyScannedQuestions, scanContext = {}) {
    const now = Date.now();
    const merged = oldQuestions
      .filter((question) => !isIgnoredQuestionText(question.text))
      .filter((question) => questionBelongsToConversation(question, currentConversationId, { allowUnknown: false }))
      .map((question, index) => ({
        ...question,
        hash: question.hash || hashQuestionText(question.text),
        exactHash: question.exactHash || hashFullQuestionText(question.text),
        index: index + 1,
        element: null,
        loaded: false
      }));
    newlyScannedQuestions.forEach((question, scannedIndex) => {
      if (question.conversationId && question.conversationId !== currentConversationId) return;
      const text = normalizeQuestionText(question.text);
      if (!text) return;
      if (isIgnoredQuestionText(text)) return;

      const hash = question.hash || hashQuestionText(text);
      const exactHash = question.exactHash || hashFullQuestionText(text);
      const existing = findQuestionByStableIdentity(merged, question);

      if (existing) {
        const target = existing;
        target.conversationId = currentConversationId;
        target.text = text;
        target.shortText = shortQuestionText(text);
        target.hash = hash;
        target.exactHash = exactHash;
        target.element = question.element;
        target.elementKey = question.elementKey || hash;
        target.turnNumber = Number.isFinite(question.turnNumber) ? question.turnNumber : target.turnNumber;
        target.anchorTop = question.anchorTop;
        target.anchorScrollTop = question.anchorScrollTop;
        target.anchorTargetScrollTop = question.anchorTargetScrollTop;
        target.anchorScrollHeight = question.anchorScrollHeight;
        target.anchorClientHeight = question.anchorClientHeight;
        target.anchorRatio = question.anchorRatio;
        target.anchorTargetRatio = question.anchorTargetRatio;
        target.anchorScrollRatio = question.anchorScrollRatio;
        target.anchorViewportOffset = question.anchorViewportOffset;
        target.anchorVersion = question.anchorVersion || null;
        target.lastSeenAt = now;
        target.loaded = true;
        return;
      }

      const next = {
        id: `${currentConversationId}:${hash}:${Date.now().toString(36)}-${scannedIndex}`,
        conversationId: currentConversationId,
        index: 0,
        text,
        shortText: shortQuestionText(text),
        hash,
        exactHash,
        element: question.element,
        elementKey: question.elementKey || hash,
        turnNumber: Number.isFinite(question.turnNumber) ? question.turnNumber : null,
        anchorTop: question.anchorTop,
        anchorScrollTop: question.anchorScrollTop,
        anchorTargetScrollTop: question.anchorTargetScrollTop,
        anchorScrollHeight: question.anchorScrollHeight,
        anchorClientHeight: question.anchorClientHeight,
        anchorRatio: question.anchorRatio,
        anchorTargetRatio: question.anchorTargetRatio,
        anchorScrollRatio: question.anchorScrollRatio,
        anchorViewportOffset: question.anchorViewportOffset,
        anchorVersion: question.anchorVersion || null,
        firstSeenAt: now,
        lastSeenAt: now,
        loaded: true
      };
      const insertIndex = findQuestionInsertIndex(merged, newlyScannedQuestions, scannedIndex, scanContext);
      merged.splice(insertIndex, 0, next);
    });

    return dedupeQuestionsByTurnNumber(pruneQuestionsMissingFromScannedTurnWindow(merged, newlyScannedQuestions));
  }

  function resetEphemeralConversationIfNeeded(scannedQuestions) {
    if (!isUnsavedConversationUrl() || scannedQuestions.length === 0) return;

    const firstHash = scannedQuestions[0].exactHash || scannedQuestions[0].hash || hashFullQuestionText(scannedQuestions[0].text);
    if (!ephemeralFirstQuestionHash) {
      ephemeralFirstQuestionHash = firstHash;
      return;
    }

    if (firstHash === ephemeralFirstQuestionHash) return;

    ephemeralConversationId = createEphemeralConversationId();
    ephemeralFirstQuestionHash = firstHash;
    currentConversationId = ephemeralConversationId;
    questions = [];
    activeQuestionId = null;
    captureCompleted = false;
    captureStatusMessage = "";
    lastRenderedQuestionSignature = "";
    console.log("[CQR] reset unsaved chat cache", { conversationId: currentConversationId });
  }

  function applyQuestionHashOrder(items, orderedQuestionKeys) {
    if (!Array.isArray(orderedQuestionKeys) || orderedQuestionKeys.length === 0) return items;

    const order = new Map();
    orderedQuestionKeys.forEach((questionKey, index) => {
      if (!order.has(questionKey)) order.set(questionKey, index);
    });

    return reindexQuestions([...items]
      .sort((a, b) => {
        const aKey = getQuestionOrderKey(a);
        const bKey = getQuestionOrderKey(b);
        const aOrder = order.has(aKey) ? order.get(aKey) : Number.MAX_SAFE_INTEGER;
        const bOrder = order.has(bKey) ? order.get(bKey) : Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.index - b.index;
      }));
  }

  function applyScannedSegmentOrder(items, scannedQuestions, scanContext = {}) {
    const scannedQuestionKeys = [];
    scannedQuestions.forEach((question) => {
      const questionKey = getQuestionOrderKey(question);
      if (questionKey && !scannedQuestionKeys.includes(questionKey)) scannedQuestionKeys.push(questionKey);
    });

    if (scannedQuestionKeys.length === 0) return items;
    if (!scanContext.isNearTop) return items;

    const order = new Map(scannedQuestionKeys.map((questionKey, index) => [questionKey, index]));
    const scannedItems = items
      .filter((question) => order.has(getQuestionOrderKey(question)))
      .sort((a, b) => order.get(getQuestionOrderKey(a)) - order.get(getQuestionOrderKey(b)));
    const remainingItems = items.filter((question) => !order.has(getQuestionOrderKey(question)));

    return reindexQuestions([...scannedItems, ...remainingItems]);
  }

  function isScrollableContainer(element) {
    if (!(element instanceof Element)) return false;
    const style = window.getComputedStyle(element);
    const hasScrollableOverflow = /(auto|scroll)/.test(style.overflowY);
    return hasScrollableOverflow && element.scrollHeight > element.clientHeight + 16;
  }

  function isChatScrollContainerCandidate(element) {
    if (!(element instanceof Element)) return false;
    const style = window.getComputedStyle(element);
    const hasUserMessageCandidate = Boolean(element.querySelector(USER_MESSAGE_CANDIDATE_SELECTOR))
      || Array.from(element.querySelectorAll(CONVERSATION_TURN_SELECTOR))
        .some(isLikelyUserTurn);
    return /(auto|scroll)/.test(style.overflowY)
      && element.scrollHeight > element.clientHeight + 200
      && hasUserMessageCandidate;
  }

  function logScrollContainer(container) {
    const element = isPageScroller(container) ? document.scrollingElement || document.documentElement : container;
    console.log("[CQR] scroll container detected", {
      tagName: element?.tagName || "WINDOW",
      className: element?.className || "",
      scrollTop: getScrollTop(container),
      scrollHeight: getScrollHeight(container),
      clientHeight: getClientHeight(container)
    });
  }

  function attachChatScrollListener(container) {
    if (!container || observedScrollContainer === container) return;

    if (observedScrollContainer && observedScrollContainer !== window) {
      observedScrollContainer.removeEventListener("scroll", scheduleScrollWork, true);
    }

    observedScrollContainer = container;
    if (container !== window) {
      container.addEventListener("scroll", scheduleScrollWork, { passive: true, capture: true });
    }
  }

  function findChatScrollContainer({ force = false } = {}) {
    const messages = getUserMessages();
    if (!force && chatScrollContainer && !isPageScroller(chatScrollContainer) && document.documentElement.contains(chatScrollContainer)) {
      return chatScrollContainer;
    }
    if (!force && chatScrollContainer && isPageScroller(chatScrollContainer) && messages.length === 0) {
      return chatScrollContainer;
    }

    const visibleMessages = messages.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
    const roots = visibleMessages.length > 0 ? visibleMessages : messages;

    for (const node of roots) {
      let current = node.parentElement;
      while (current && current !== document.body && current !== document.documentElement) {
        if (isChatScrollContainerCandidate(current)) {
          chatScrollContainer = current;
          attachChatScrollListener(chatScrollContainer);
          logScrollContainer(chatScrollContainer);
          return chatScrollContainer;
        }
        current = current.parentElement;
      }
    }

    const fallbackCandidates = Array.from(document.querySelectorAll("main, [role='main'], section, div"))
      .filter(isChatScrollContainerCandidate)
      .sort((a, b) => b.scrollHeight - a.scrollHeight);

    chatScrollContainer = fallbackCandidates[0]
      || document.scrollingElement
      || document.documentElement
      || window;
    attachChatScrollListener(chatScrollContainer);
    logScrollContainer(chatScrollContainer);
    return chatScrollContainer;
  }

  function getScrollableContainers(node) {
    const containers = [];
    let current = node?.parentElement || null;

    while (current && current !== document.body && current !== document.documentElement) {
      if (isScrollableContainer(current)) containers.push(current);
      current = current.parentElement;
    }

    const pageScroller = document.scrollingElement || document.documentElement;
    if (pageScroller && !containers.includes(pageScroller)) {
      containers.push(pageScroller);
    }

    return containers;
  }

  function getContainerScrollTopForTarget(container, target, offset) {
    const targetRect = target.getBoundingClientRect();

    if (isPageScroller(container)) {
      return window.scrollY + targetRect.top - offset;
    }

    const containerRect = container.getBoundingClientRect();
    return container.scrollTop + targetRect.top - containerRect.top - offset;
  }

  function getElementTopInContainer(container, target) {
    if (!(target instanceof Element)) return getScrollTop(container);
    const targetRect = target.getBoundingClientRect();

    if (isPageScroller(container)) {
      return window.scrollY + targetRect.top;
    }

    const containerRect = container.getBoundingClientRect();
    return container.scrollTop + targetRect.top - containerRect.top;
  }

  function getQuestionPositionAnchor(container, target) {
    const anchorTop = getElementTopInContainer(container, target);
    const scrollHeight = getScrollHeight(container);
    const clientHeight = getClientHeight(container);
    const maxScrollTop = Math.max(1, scrollHeight - clientHeight);
    const scrollTop = getScrollTop(container);
    const offset = Math.min(120, Math.max(72, clientHeight * 0.14));
    const anchorTargetScrollTop = Math.max(0, Math.min(maxScrollTop, Math.round(anchorTop - offset)));
    const targetRect = target instanceof Element ? target.getBoundingClientRect() : null;
    const containerRect = !isPageScroller(container) && container instanceof Element
      ? container.getBoundingClientRect()
      : null;
    const anchorViewportOffset = targetRect
      ? targetRect.top - (containerRect?.top || 0)
      : null;

    return {
      anchorTop,
      anchorScrollTop: scrollTop,
      anchorTargetScrollTop,
      anchorScrollHeight: scrollHeight,
      anchorClientHeight: clientHeight,
      anchorRatio: Math.max(0, Math.min(1, anchorTop / maxScrollTop)),
      anchorTargetRatio: Math.max(0, Math.min(1, anchorTargetScrollTop / maxScrollTop)),
      anchorScrollRatio: Math.max(0, Math.min(1, scrollTop / maxScrollTop)),
      anchorViewportOffset,
      anchorVersion: CQR_ANCHOR_VERSION
    };
  }

  function scrollContainerToTop(container, top, behavior) {
    const nextTop = Math.max(0, Math.round(top));

    if (container === window || container === document.scrollingElement || container === document.documentElement || container === document.body) {
      window.scrollTo({ top: nextTop, behavior });
      return;
    }

    container.scrollTo({ top: nextTop, behavior });
  }

  function isPageScroller(container) {
    return container === window || container === document.scrollingElement || container === document.documentElement || container === document.body;
  }

  function getPrimaryScrollContainer() {
    return findChatScrollContainer();
  }

  function getScrollTop(container) {
    return isPageScroller(container) ? window.scrollY : container.scrollTop;
  }

  function getScrollHeight(container) {
    return isPageScroller(container) ? (document.scrollingElement || document.documentElement).scrollHeight : container.scrollHeight;
  }

  function getClientHeight(container) {
    return isPageScroller(container) ? window.innerHeight : container.clientHeight;
  }

  function scrollContainerBy(container, deltaY) {
    const top = getScrollTop(container) + deltaY;
    scrollContainerToTop(container, top, "auto");
  }

  function isAtScrollEdge(container, direction) {
    const top = getScrollTop(container);
    if (direction < 0) return top <= 4;
    return top + getClientHeight(container) >= getScrollHeight(container) - 24;
  }

  function scrollElementToView(target) {
    if (!(target instanceof Element)) return;

    const containers = getScrollableContainers(target);
    const offset = Math.min(120, Math.max(72, window.innerHeight * 0.14));
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    containers.forEach((container) => {
      const top = getContainerScrollTopForTarget(container, target, offset);
      const currentTop = container === document.scrollingElement || container === document.documentElement || container === document.body
        ? window.scrollY
        : container.scrollTop;
      const distance = Math.abs(top - currentTop);
      const behavior = prefersReducedMotion || distance > window.innerHeight * 2 ? "auto" : "smooth";

      scrollContainerToTop(container, top, behavior);
    });

    window.setTimeout(() => {
      getScrollableContainers(target).forEach((container) => {
        scrollContainerToTop(container, getContainerScrollTopForTarget(container, target, offset), "auto");
      });
      updateActiveDot();
    }, 320);
  }

  function jumpElementToView(target) {
    if (!(target instanceof Element)) return;

    const containers = getScrollableContainers(target);
    const offset = Math.min(120, Math.max(72, window.innerHeight * 0.14));

    containers.forEach((container) => {
      scrollContainerToTop(container, getContainerScrollTopForTarget(container, target, offset), "auto");
    });
  }

  function scanLoadedUserQuestions({ render = true, persist = true, silent = false } = {}) {
    const routeConversationId = getConversationIdFromUrl();
    if (currentConversationId && routeConversationId !== currentConversationId) {
      loadQuestionCacheForCurrentConversation();
      return questions;
    }
    if (!currentConversationId) currentConversationId = routeConversationId;
    if (isHydratingQuestions) return questions;
    const container = findChatScrollContainer();

    const scanned = getUserMessages()
      .map((node, index) => {
        const text = normalizeQuestionText(getMessageText(node));
        const hash = hashQuestionText(text);
        const exactHash = hashFullQuestionText(text);
        const element = getQuestionScrollTarget(node);
        const turnNumber = getConversationTurnNumber(node);
        const anchor = getQuestionPositionAnchor(container, node);

        return {
          conversationId: routeConversationId,
          text,
          hash,
          exactHash,
          element,
          elementKey: `${hash}:${index}`,
          turnNumber,
          ...anchor
        };
      })
      .filter((question) => question.text.length > 0 && !isIgnoredQuestionText(question.text));

    if (routeConversationId !== getConversationIdFromUrl()) return questions;

    resetEphemeralConversationIfNeeded(scanned);

    if (activeFullScanOrder) {
      scanned.forEach((question) => {
        const questionKey = getQuestionOrderKey(question);
        if (questionKey && !activeFullScanOrder.includes(questionKey)) {
          activeFullScanOrder.push(questionKey);
        }
      });
    }

    const previousSignature = questions
      .map((question) => `${question.id}:${question.loaded ? "1" : "0"}:${question.elementKey || ""}:${Math.round(question.anchorTop || -1)}:${Math.round(question.anchorScrollHeight || -1)}:${question.anchorVersion || ""}`)
      .join("|");
    const previousCount = questions.length;
    const currentScrollTop = getScrollTop(container);
    const scanContext = {
      isNearTop: currentScrollTop <= Math.max(80, getClientHeight(container) * 0.08),
      isScrollingUp: lastChatScrollTop !== null && currentScrollTop < lastChatScrollTop - 20,
      scrollTop: currentScrollTop,
      scrollHeight: getScrollHeight(container),
      clientHeight: getClientHeight(container)
    };
    questions = mergeQuestionIndex(questions, scanned, scanContext);
    questions = applyScannedSegmentOrder(questions, scanned, scanContext);
    questions = applyQuestionHashOrder(questions, activeFullScanOrder);
    lastChatScrollTop = currentScrollTop;
    const nextSignature = questions
      .map((question) => `${question.id}:${question.loaded ? "1" : "0"}:${question.elementKey || ""}:${Math.round(question.anchorTop || -1)}:${Math.round(question.anchorScrollHeight || -1)}:${question.anchorVersion || ""}`)
      .join("|");
    const changed = previousSignature !== nextSignature;
    const newCount = Math.max(0, questions.length - previousCount);

    const now = Date.now();
    if (changed && now - lastScanLogAt > 650) {
      lastScanLogAt = now;
      console.log("[CQR] scan result", {
        conversationId: currentConversationId,
        loadedDomCount: scanned.length,
        cachedCount: questions.length,
        newCount,
        scrollTop: getScrollTop(container),
        scrollHeight: getScrollHeight(container),
        clientHeight: getClientHeight(container)
      });
    }

    if (persist && changed) {
      writeQuestionCache(currentConversationId);
    }

    if (!silent && (render || changed || isCapturingFullConversation || isRealtimeCaptureEnabled || isManualCaptureEnabled)) {
      renderQuestionUi();
    }

    return questions;
  }

  async function scanLoadedUserQuestionsAndMerge(options = {}) {
    return scanLoadedUserQuestions({ render: true, persist: true, ...options });
  }

  function getLoadedQuestionCount() {
    return questions.filter((question) => question.loaded).length;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function hasReliableQuestionAnchor(question) {
    if (question.anchorVersion !== CQR_ANCHOR_VERSION) return false;
    return isFiniteNumber(question.anchorTop)
      || isFiniteNumber(question.anchorRatio)
      || isFiniteNumber(question.anchorTargetScrollTop)
      || isFiniteNumber(question.anchorTargetRatio)
      || isFiniteNumber(question.anchorScrollRatio)
      || isFiniteNumber(question.anchorScrollTop);
  }

  function isQuestionNavigable(question) {
    return Boolean(question.loaded && question.element) || hasReliableQuestionAnchor(question);
  }

  function canAttemptQuestionLocate(question) {
    return Boolean(question)
      && questionBelongsToConversation(question, currentConversationId)
      && !isIgnoredQuestionText(question.text)
      && (
        isQuestionNavigable(question)
        || Number.isFinite(question.turnNumber)
        || Number.isFinite(question.index)
      );
  }

  function getTimelineSortValue(question) {
    if (!hasReliableQuestionAnchor(question) && !question.loaded) return Number.MAX_SAFE_INTEGER + question.index;
    if (isFiniteNumber(question.anchorTop)) return question.anchorTop;
    if (isFiniteNumber(question.anchorTargetScrollTop)) return question.anchorTargetScrollTop;
    if (isFiniteNumber(question.anchorRatio) && isFiniteNumber(question.anchorScrollHeight) && isFiniteNumber(question.anchorClientHeight)) {
      return question.anchorRatio * Math.max(1, question.anchorScrollHeight - question.anchorClientHeight);
    }
    if (Number.isFinite(question.turnNumber)) return question.turnNumber;
    if (isFiniteNumber(question.anchorScrollRatio) && isFiniteNumber(question.anchorScrollHeight) && isFiniteNumber(question.anchorClientHeight)) {
      return question.anchorScrollRatio * Math.max(1, question.anchorScrollHeight - question.anchorClientHeight);
    }
    if (isFiniteNumber(question.anchorScrollTop)) return question.anchorScrollTop;
    return Number.MAX_SAFE_INTEGER + question.index;
  }

  function getRailQuestions() {
    return questions
      .filter(canAttemptQuestionLocate)
      .slice()
      .sort(compareDirectoryQuestions);
  }

  function compareDirectoryQuestions(a, b) {
    const aTurn = Number.isFinite(a.turnNumber) ? a.turnNumber : null;
    const bTurn = Number.isFinite(b.turnNumber) ? b.turnNumber : null;
    if (aTurn !== null && bTurn !== null && aTurn !== bTurn) {
      return aTurn - bTurn;
    }

    const aNavigable = isQuestionNavigable(a);
    const bNavigable = isQuestionNavigable(b);
    if (aNavigable && bNavigable) {
      const diff = getTimelineSortValue(a) - getTimelineSortValue(b);
      if (diff !== 0) return diff;
    }

    return a.index - b.index;
  }

  function getDirectoryQuestions() {
    return questions
      .filter((question) => questionBelongsToConversation(question, currentConversationId))
      .filter((question) => !isIgnoredQuestionText(question.text))
      .slice()
      .sort(compareDirectoryQuestions);
  }

  function getQuestionStatusText(question) {
    if (question.loaded) return "";
    if (hasReliableQuestionAnchor(question)) return "已记录位置";
    return "需重新采集";
  }

  function getLoadedQuestionTextHashes() {
    return getUserMessages()
      .map((node) => hashQuestionText(getMessageText(node)))
      .filter(Boolean);
  }

  function shouldMigrateEphemeralQuestionsToPersistent(previousConversationId, persistentConversationId) {
    if (!persistentConversationId || !previousConversationId?.startsWith?.("new-chat-")) return false;

    const cachedHashes = filterQuestionsForConversation(questions, previousConversationId)
      .map((question) => question.hash || hashQuestionText(question.text))
      .filter(Boolean);
    if (cachedHashes.length === 0) return false;

    const loadedHashes = new Set(getLoadedQuestionTextHashes());
    if (loadedHashes.size === 0) return false;

    return cachedHashes.some((hash) => loadedHashes.has(hash));
  }

  async function loadQuestionCacheForCurrentConversation() {
    const loadToken = cacheLoadToken + 1;
    cacheLoadToken = loadToken;
    const previousConversationId = currentConversationId;
    const persistentConversationId = getPersistentConversationIdFromUrl();
    const conversationId = getConversationIdFromUrl();
    if (
      persistentConversationId
      && shouldMigrateEphemeralQuestionsToPersistent(previousConversationId, persistentConversationId)
      && questions.length > 0
    ) {
      const migratedQuestions = questions.map((question) => ({
        ...question,
        conversationId: persistentConversationId,
        id: String(question.id || "").startsWith(previousConversationId)
          ? String(question.id).replace(previousConversationId, persistentConversationId)
          : `${persistentConversationId}:${question.hash || hashQuestionText(question.text)}:${question.index}`
      }));
      questions = migratedQuestions;
      currentConversationId = persistentConversationId;
      await writeQuestionCache(persistentConversationId);
      if (loadToken !== cacheLoadToken || conversationId !== getConversationIdFromUrl()) return;
    }

    if (previousConversationId && previousConversationId !== conversationId) {
      activeLocateToken += 1;
      questions = [];
      activeQuestionId = null;
      lastRenderedQuestionSignature = "";
      renderQuestionUi();
    }

    currentConversationId = conversationId;
    isHydratingQuestions = true;

    const cache = await readQuestionCache(conversationId);
    if (loadToken !== cacheLoadToken || conversationId !== getConversationIdFromUrl()) return;
    questions = Array.isArray(cache?.questions)
      ? cache.questions
        .filter((question) => questionBelongsToConversation(question, conversationId, { allowUnknown: false }))
        .filter((question) => !isIgnoredQuestionText(question.text))
        .map((question, index) => hydrateCachedQuestion(question, index, conversationId))
      : [];
    captureCompleted = Boolean(cache?.captureCompleted || cache?.fullScanCompleted);
    captureStatusMessage = "";
    isRealtimeCaptureEnabled = true;
    isManualCaptureEnabled = false;
    if (isUnsavedConversationUrl()) {
      ephemeralFirstQuestionHash = "";
    }
    activeQuestionId = null;
    chatScrollContainer = null;
    lastRenderedQuestionSignature = "";
    lastCaptureStatusRenderAt = 0;
    isHydratingQuestions = false;

    if (conversationId === getConversationIdFromUrl()) {
      scanLoadedUserQuestions({ render: true, persist: true });
      scheduleQuestionScan(900);
    }
  }

  function isChatGeneratingResponse() {
    return Boolean(document.querySelector(
      "[data-testid='stop-button'], [aria-label*='Stop' i], [aria-label*='停止']"
    ));
  }

  function shouldRealtimeCapture() {
    return isRealtimeCaptureEnabled && !isHydratingQuestions;
  }

  function refreshCaptureStatus(force = false) {
    if (!directory || directory.hidden) return;

    const now = Date.now();
    if (!force && now - lastCaptureStatusRenderAt < 700) return;

    let nextMessage = "";
    if (isCapturingFullConversation) {
      nextMessage = `正在深度采集：已记录 ${questions.length} 个问题，当前 DOM 中 ${getUserMessages().length} 个问题`;
    } else if (isRealtimeCaptureEnabled) {
      nextMessage = `实时采集中：已记录 ${questions.length} 个问题，当前 DOM 中 ${getUserMessages().length} 个问题`;
    } else {
      nextMessage = `实时采集已暂停：已记录 ${questions.length} 个问题`;
    }

    if (!force && nextMessage === captureStatusMessage) return;
    lastCaptureStatusRenderAt = now;
    captureStatusMessage = nextMessage;
    renderDirectory();
  }

  function scheduleQuestionScan(delay = 500) {
    window.clearTimeout(mutationTimer);
    mutationTimer = window.setTimeout(() => {
      if (shouldRealtimeCapture() || isCapturingFullConversation) {
        scanLoadedUserQuestions();
      }
      refreshCaptureStatus();
      updateActiveDot();
    }, delay);
  }

  function scheduleScrollWork() {
    if (scrollTimer) return;

    scrollTimer = window.setTimeout(() => {
      scrollTimer = null;
      if (shouldRealtimeCapture() || isCapturingFullConversation) {
        scanLoadedUserQuestions({ render: false, persist: true });
      }
      refreshCaptureStatus();
      updateActiveDot();
    }, isChatGeneratingResponse() ? 260 : 190);
  }

  function padDatePart(value) {
    return String(value).padStart(2, "0");
  }

  function currentTimestampForFile() {
    const now = new Date();
    return [
      now.getFullYear(),
      padDatePart(now.getMonth() + 1),
      padDatePart(now.getDate())
    ].join("-") + "-" + [
      padDatePart(now.getHours()),
      padDatePart(now.getMinutes()),
      padDatePart(now.getSeconds())
    ].join("-");
  }

  function getLoadedMessages() {
    return Array.from(document.querySelectorAll("[data-message-author-role]"))
      .filter((node) => !node.closest(`#${APP_ID}`))
      .map((node, index) => ({
        role: node.getAttribute("data-message-author-role") || "message",
        text: getMessageText(node),
        node,
        index,
        key: `${node.getAttribute("data-message-author-role") || "message"}-${index}`
      }))
      .filter((message) => message.text.length > 0);
  }

  function getExportQuestions() {
    return getDirectoryQuestions();
  }

  function getQuestionExportKey(question) {
    const stableKey = getSerializedQuestionKey(question) || getQuestionOrderKey(question);
    if (stableKey) return `question:${stableKey}`;

    const text = normalizeQuestionText(question?.text);
    const fallbackHash = question?.exactHash || hashFullQuestionText(text);
    return `question:${question?.index || 0}:${fallbackHash}`;
  }

  function syncQuestionExportSelection(exportQuestions) {
    const nextKeys = new Set(exportQuestions.map(getQuestionExportKey));

    if (!exportQuestionSelectionReady) {
      selectedQuestionKeys = new Set(nextKeys);
      exportQuestionSelectionReady = true;
    } else {
      exportQuestions.forEach((question) => {
        const key = getQuestionExportKey(question);
        if (!knownQuestionExportKeys.has(key)) {
          selectedQuestionKeys.add(key);
        }
      });

      selectedQuestionKeys = new Set(
        Array.from(selectedQuestionKeys).filter((key) => nextKeys.has(key))
      );
    }

    knownQuestionExportKeys = nextKeys;
  }

  function syncExportSelection(messages) {
    const nextKeys = new Set(messages.map((message) => message.key));

    if (!exportSelectionReady) {
      selectedMessageKeys = new Set(nextKeys);
      exportSelectionReady = true;
    } else {
      messages.forEach((message) => {
        if (!knownMessageKeys.has(message.key)) {
          selectedMessageKeys.add(message.key);
        }
      });

      selectedMessageKeys = new Set(
        Array.from(selectedMessageKeys).filter((key) => nextKeys.has(key))
      );
    }

    knownMessageKeys = nextKeys;
  }

  function getSelectedExportQuestions() {
    const exportQuestions = getExportQuestions();
    syncQuestionExportSelection(exportQuestions);
    return exportQuestions.filter((question) => selectedQuestionKeys.has(getQuestionExportKey(question)));
  }

  function getSelectedMessages() {
    const messages = getLoadedMessages();
    syncExportSelection(messages);
    return messages.filter((message) => selectedMessageKeys.has(message.key));
  }

  function trimTextToLength(text, maxLength) {
    const normalized = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
  }

  function cleanAssistantReplyForOverview(text) {
    return String(text || "")
      .replace(/```[\s\S]*?```/g, (block) => {
        const lines = block
          .replace(/```[a-z0-9_-]*\s*/i, "")
          .replace(/```$/, "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        return lines.length > 0 ? `代码：${lines.slice(0, 2).join(" ")}` : "";
      })
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+[.)、]\s+/gm, "")
      .replace(/^(?:你说得对|没错|是的|当然|好的|明白了|收到|看了你发的截图|看了截图|从截图来看)[，,。.!！\s]*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splitOverviewSentences(text) {
    const cleaned = cleanAssistantReplyForOverview(text);
    return (cleaned.match(/[^。！？!?；;.]+[。！？!?；;.]?/g) || [cleaned])
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 6);
  }

  function stripOverviewSentence(sentence) {
    return String(sentence || "")
      .replace(/^(?:你说得对|没错|是的|当然|好的|明白了|收到|看了你发的截图|看了截图|从截图来看)[，,。.!！\s]*/i, "")
      .replace(/^(?:首先|其次|再次|最后|总之|综上|因此|所以|也就是说|换句话说|具体来说|简单来说|简而言之|核心是|结论是|最终结论是|可以确定的是|这意味着)[，,:：\s]*/i, "")
      .replace(/[。！？!?；;.\s]+$/g, "")
      .trim();
  }

  function isLowSignalOverviewSentence(sentence) {
    const normalized = stripOverviewSentence(sentence);
    if (!normalized || normalized.length < 8) return true;

    return /^(?:希望这能帮到你|如果你愿意|如果需要|需要的话|你可以继续|欢迎继续|还有问题|我可以继续|我再帮你|下面我来|接下来我会)/i.test(normalized);
  }

  function scoreOverviewSentence(sentence, index, total) {
    const normalized = stripOverviewSentence(sentence);
    let score = 0;

    if (normalized.length >= 18 && normalized.length <= 110) score += 4;
    if (normalized.length > 160) score -= 3;
    if (index >= Math.max(1, total - Math.ceil(total * 0.35))) score += 3;
    if (index > 0 && index < total - 1) score += 1;
    if (/(?:结论|总结|总之|综上|因此|所以|最终|核心|本质|关键|可以确定|意味着)/.test(sentence)) score += 7;
    if (/(?:原因|问题在于|由于|因为|导致|说明|表明|区别|取决于)/.test(sentence)) score += 4;
    if (/(?:建议|应该|需要|可以通过|解决|修复|做法|方案)/.test(sentence)) score += 4;
    if (/(?:但是|不过|而不是|并非|实际上|同时|另外)/.test(sentence)) score += 2;
    if (/[0-9%]|(?:API|DOM|CSS|JavaScript|ChatGPT|GPT|Codex|Plus)/i.test(sentence)) score += 1;
    if (isLowSignalOverviewSentence(sentence)) score -= 12;

    return score;
  }

  function chooseOverviewSentence(sentences, startIndex = 0, endIndex = sentences.length) {
    return sentences
      .map((sentence, index) => ({
        sentence,
        index,
        score: scoreOverviewSentence(sentence, index, sentences.length)
      }))
      .filter((candidate) => candidate.index >= startIndex && candidate.index < endIndex)
      .sort((a, b) => b.score - a.score || a.index - b.index)[0] || null;
  }

  function buildAssistantReplyOverview(text) {
    const cleaned = cleanAssistantReplyForOverview(text);
    if (!cleaned) return "";

    const sentences = splitOverviewSentences(cleaned);
    if (sentences.length === 0) return trimTextToLength(cleaned, 190);
    if (sentences.length === 1) return trimTextToLength(stripOverviewSentence(sentences[0]), 190);

    const splitIndex = Math.max(1, Math.ceil(sentences.length * 0.45));
    const opening = chooseOverviewSentence(sentences, 0, splitIndex);
    const conclusion = chooseOverviewSentence(sentences, splitIndex, sentences.length)
      || chooseOverviewSentence(sentences);
    const openingText = stripOverviewSentence(opening?.sentence);
    const conclusionText = stripOverviewSentence(conclusion?.sentence);

    if (!openingText) return trimTextToLength(conclusionText || cleaned, 190);
    if (!conclusionText || textsLikelyMatch(openingText, conclusionText)) {
      return trimTextToLength(openingText, 190);
    }

    return trimTextToLength(`回答先说明${openingText}，并最终指出${conclusionText}。`, 210);
  }

  function getQuestionAnswerPairs() {
    const pairs = [];
    let currentPair = null;

    function commitPair() {
      if (!currentPair) return;

      const answerText = currentPair.assistantMessages
        .map((message) => message.text)
        .filter(Boolean)
        .join("\n\n");

      pairs.push({
        ...currentPair,
        questionHash: hashQuestionText(currentPair.userMessage.text),
        questionExactHash: hashFullQuestionText(currentPair.userMessage.text),
        answerText,
        answerOverview: buildAssistantReplyOverview(answerText)
      });
    }

    getLoadedMessages().forEach((message) => {
      if (message.role === "user") {
        commitPair();
        currentPair = {
          userMessage: message,
          assistantMessages: []
        };
        return;
      }

      if (message.role === "assistant" && currentPair) {
        currentPair.assistantMessages.push(message);
      }
    });

    commitPair();
    return pairs;
  }

  function questionMatchesMessage(question, message) {
    if (!question || !message) return false;

    const questionText = normalizeQuestionText(question.text);
    const messageText = normalizeQuestionText(message.text);
    if (!questionText || !messageText) return false;
    if (questionText === messageText) return true;

    const questionExactHash = question.exactHash || hashFullQuestionText(question.text);
    const messageExactHash = hashFullQuestionText(message.text);
    if (questionExactHash && questionExactHash === messageExactHash) return true;

    const questionHash = question.hash || hashQuestionText(question.text);
    const messageHash = hashQuestionText(message.text);
    return Boolean(questionHash && questionHash === messageHash && textsLikelyMatch(question.text, message.text));
  }

  function findAnswerPairForQuestion(question, pairs) {
    return pairs.find((pair) => questionMatchesMessage(question, pair.userMessage)) || null;
  }

  function getAnswerOverviewForQuestion(question, pairs) {
    const pair = findAnswerPairForQuestion(question, pairs);
    if (pair?.answerOverview) return pair.answerOverview;
    if (pair && pair.assistantMessages.length === 0) return "GPT 回复暂未生成或仍在加载。";
    if (!question.loaded) return "一句话概览需先加载到当前页面。";
    return "当前未识别到这个问题下面的 GPT 回复。";
  }

  function roleHeading(role) {
    if (role === "user") return "User";
    if (role === "assistant") return "Assistant";
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  function buildQuestionMarkdownExport(exportQuestions = getSelectedExportQuestions()) {
    const sections = exportQuestions.map((question, index) => {
      const status = getQuestionStatusText(question);
      const meta = status ? `\n\n> 状态：${status}` : "";
      return `## Question ${index + 1}${meta}\n\n${question.text}`;
    });

    return [
      "# ChatGPT Questions Export",
      "",
      `Exported at: ${new Date().toLocaleString()}`,
      `Source: ${location.href}`,
      `Questions: ${exportQuestions.length}`,
      "",
      sections.join("\n\n---\n\n")
    ].join("\n");
  }

  function buildConversationMarkdownExport(messages = getSelectedMessages()) {
    const counters = {};
    const sections = messages.map((message) => {
      const heading = roleHeading(message.role);
      counters[heading] = (counters[heading] || 0) + 1;
      return `## ${heading} ${counters[heading]}\n\n${message.text}`;
    });

    return [
      "# ChatGPT Conversation Export",
      "",
      `Exported at: ${new Date().toLocaleString()}`,
      `Source: ${location.href}`,
      "",
      sections.join("\n\n---\n\n")
    ].join("\n");
  }

  function buildMarkdownExport() {
    return exportMode === "questions"
      ? buildQuestionMarkdownExport()
      : buildConversationMarkdownExport();
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function appendTextSegment(segments, content) {
    if (!content) return;

    const previous = segments[segments.length - 1];
    if (previous?.type === "text") {
      previous.content += content;
    } else {
      segments.push({
        type: "text",
        content
      });
    }
  }

  function appendNewline(segments) {
    const previous = segments[segments.length - 1];
    if (!previous || previous.type !== "text" || !/\n\s*$/.test(previous.content)) {
      appendTextSegment(segments, "\n");
    }
  }

  function isPdfBlockElement(element) {
    return [
      "ADDRESS",
      "ARTICLE",
      "ASIDE",
      "BLOCKQUOTE",
      "DIV",
      "FIGURE",
      "FOOTER",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "HEADER",
      "LI",
      "MAIN",
      "OL",
      "P",
      "PRE",
      "SECTION",
      "TABLE",
      "TR",
      "UL"
    ].includes(element.tagName);
  }

  function languageFromCode(code) {
    const className = code?.className || "";
    const match = String(className).match(/language-([^\s]+)/);
    return match ? match[1] : "";
  }

  function shouldSkipPdfElement(element) {
    if (element.matches("button, [role='button'], svg, style, script")) return true;

    const selector = [
      "[data-testid*='reasoning' i]",
      "[data-testid*='thinking' i]",
      "[data-testid*='thought' i]",
      "[aria-label*='思考']",
      "[aria-label*='推理']",
      "[aria-label*='thinking' i]",
      "[aria-label*='reasoning' i]",
      "[class*='reasoning' i]",
      "[class*='thinking' i]",
      "[class*='thought' i]"
    ].join(",");

    if (element.matches(selector) || element.closest(selector)) return true;

    const compactText = (element.innerText || element.textContent || "")
      .replace(/\s+/g, "");
    return /^(已)?思考(中|完成)?(.*)?(展开|收起)?$/.test(compactText)
      || /^(展开|收起)$/.test(compactText);
  }

  function extractRichMessageContent(messageElement) {
    const segments = [];
    const visitedFormulas = new Set();

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        appendTextSegment(segments, node.nodeValue || "");
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const element = node;
      if (element.closest(`#${APP_ID}`)) return;
      if (shouldSkipPdfElement(element)) return;

      const formulaElement = window.CQRFormulaExtract?.findFormulaElement?.(element);
      if (formulaElement && formulaElement === element && !visitedFormulas.has(formulaElement)) {
        const formula = window.CQRFormulaExtract.extractFormulaData(formulaElement);
        visitedFormulas.add(formulaElement);
        if (formula?.latex) {
          segments.push({
            type: "formula",
            latex: formula.latex,
            mathml: formula.mathml,
            display: formula.isDisplay,
            isFallback: formula.isFallback
          });
        }
        return;
      }

      if (element.matches("pre")) {
        const code = element.querySelector("code") || element;
        segments.push({
          type: "code",
          content: code.innerText || code.textContent || "",
          language: languageFromCode(code)
        });
        return;
      }

      if (element.matches("br")) {
        appendNewline(segments);
        return;
      }

      const isBlock = isPdfBlockElement(element);
      if (isBlock && segments.length > 0) appendNewline(segments);
      Array.from(element.childNodes).forEach(walk);
      if (isBlock) appendNewline(segments);
    }

    walk(messageElement);

    return segments
      .map((segment) => {
        if (segment.type !== "text") return segment;
        return {
          ...segment,
          content: segment.content
            .replace(/\u00a0/g, " ")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
        };
      })
      .filter((segment) => segment.type !== "text" || segment.content.trim().length > 0);
  }

  function getSelectedRichMessages() {
    return getSelectedMessages().map((message) => ({
      role: message.role,
      index: message.index,
      segments: extractRichMessageContent(message.node)
    })).filter((message) => message.segments.length > 0);
  }

  function stripMathDelimitersForPdf(latex) {
    return window.CQRFormulaClipboard?.stripMathDelimiters?.(latex)
      || String(latex || "").trim()
        .replace(/^\\\[\s*([\s\S]*?)\s*\\\]$/, "$1")
        .replace(/^\\\(\s*([\s\S]*?)\s*\\\)$/, "$1")
        .replace(/^\$\$\s*([\s\S]*?)\s*\$\$$/, "$1")
        .replace(/^\$\s*([\s\S]*?)\s*\$$/, "$1")
        .trim();
  }

  function renderFormulaToHtml(segment) {
    const latex = stripMathDelimitersForPdf(segment.latex);
    const fallback = `<span class="formula-fallback">${escapeHtml(latex)}</span>`;

    if (!segment.isFallback && segment.mathml) {
      const mathml = window.CQRFormulaClipboard?.ensureMathMLNamespace
        ? window.CQRFormulaClipboard.ensureMathMLNamespace(segment.mathml)
        : segment.mathml;
      return mathml || fallback;
    }

    return fallback;
  }

  function renderRichSegmentsToHtml(segments) {
    return segments.map((segment) => {
      if (segment.type === "code") {
        const language = segment.language
          ? `<div class="code-language">${escapeHtml(segment.language)}</div>`
          : "";
        return `<pre>${language}<code>${escapeHtml(segment.content)}</code></pre>`;
      }

      if (segment.type === "formula") {
        const formulaHtml = renderFormulaToHtml(segment);
        if (segment.display) {
          return `<div class="formula formula-display">${formulaHtml}</div>`;
        }

        return `<span class="formula formula-inline">${formulaHtml}</span>`;
      }

      return `<span class="content-text">${escapeHtml(segment.content)}</span>`;
    }).join("");
  }

  function generatePrintHtml(messages, sourceUrl) {
    const exportedAt = new Date().toLocaleString();
    const counters = {};
    const messageHtml = messages.map((message) => {
      const heading = roleHeading(message.role);
      counters[heading] = (counters[heading] || 0) + 1;

      return `
        <section class="message">
          <div class="role">${escapeHtml(`${heading} ${counters[heading]}`)}</div>
          <div class="content">${renderRichSegmentsToHtml(message.segments)}</div>
        </section>
      `;
    }).join("");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ChatGPT Conversation Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      background: #f6f7f9;
      color: #111827;
      margin: 0;
      padding: 32px;
    }

    .page {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
    }

    .toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }

    .print-button {
      padding: 10px 16px;
      border: 1px solid #d0d7de;
      border-radius: 10px;
      background: #ffffff;
      color: #111827;
      cursor: pointer;
      font-size: 14px;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 28px;
      line-height: 1.25;
    }

    .meta {
      color: #64748b;
      font-size: 13px;
      line-height: 1.7;
      margin-bottom: 18px;
      word-break: break-all;
    }

    .message {
      border-top: 1px solid #e5e7eb;
      padding: 14px 0;
      break-inside: auto;
      page-break-inside: auto;
    }

    .role {
      color: #334155;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .content {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 15px;
      line-height: 1.65;
    }

    .content-text {
      white-space: pre-wrap;
    }

    .formula {
      color: #111827;
    }

    .formula-inline {
      display: inline;
      white-space: normal;
    }

    .formula-display {
      display: block;
      margin: 10px 0;
      overflow-x: auto;
      text-align: center;
      white-space: normal;
    }

    .formula math {
      font-size: 1.08em;
      max-width: 100%;
    }

    .formula-inline math {
      display: inline math;
      vertical-align: middle;
    }

    .formula-display math {
      display: block math;
      margin: 0 auto;
    }

    .formula-fallback {
      border-radius: 6px;
      background: #f8fafc;
      padding: 0 4px;
      color: #334155;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      white-space: pre-wrap;
    }

    pre,
    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }

    pre {
      background: #f3f4f6;
      padding: 12px;
      border-radius: 10px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .code-language {
      margin: 0 0 8px;
      color: #64748b;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    }

    @page {
      size: A4;
      margin: 14mm;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }

      .page {
        max-width: none;
        box-shadow: none;
        border-radius: 0;
        padding: 0;
      }

      .toolbar {
        display: none;
      }

      .message {
        break-inside: auto;
        page-break-inside: auto;
      }

      .formula-display {
        overflow: visible;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="toolbar">
      <button id="cqr-print-button" class="print-button" type="button">打印 / 保存为 PDF</button>
    </div>
    <h1>ChatGPT Conversation Export</h1>
    <div class="meta">
      <div>Exported at: ${escapeHtml(exportedAt)}</div>
      <div>Source: ${escapeHtml(sourceUrl)}</div>
      <div>Messages: ${messages.length}</div>
    </div>
    ${messageHtml}
  </div>
  <script>window.focus();<\/script>
</body>
</html>`;
  }

  function openPdfPreview(messages) {
    const preview = window.open("", "_blank");
    if (!preview) {
      showToast("无法打开 PDF 预览页", true);
      return;
    }

    preview.document.open();
    preview.document.write(generatePrintHtml(messages, location.href));
    preview.document.close();
    preview.focus();

    window.setTimeout(() => {
      const printButton = preview.document.getElementById("cqr-print-button");
      const printPreview = () => {
        preview.focus();
        window.setTimeout(() => preview.print(), 50);
      };

      if (printButton) {
        printButton.addEventListener("click", printPreview);
      }

      printPreview();
    }, 100);
  }

  function handleExportPdf() {
    if (exportMode === "questions") {
      showToast("问题导出仅支持 Markdown；切换到对话可导出 PDF。", true);
      return;
    }

    const messages = getSelectedRichMessages();
    if (messages.length === 0) {
      showToast("请至少选择一条消息", true);
      return;
    }

    openPdfPreview(messages);
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function startDirectoryResize(event, direction) {
    if (!directory) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = directory.getBoundingClientRect();
    directoryResizeState = {
      direction,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };

    directory.style.left = `${Math.round(rect.left)}px`;
    directory.style.top = `${Math.round(rect.top)}px`;
    directory.style.right = "auto";
    directory.style.width = `${Math.round(rect.width)}px`;
    directory.style.height = `${Math.round(rect.height)}px`;
    directory.style.transform = "none";
    directory.classList.add("is-resizing");

    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", handleDirectoryResizeMove, true);
    window.addEventListener("pointerup", stopDirectoryResize, true);
    window.addEventListener("pointercancel", stopDirectoryResize, true);
  }

  function handleDirectoryResizeMove(event) {
    if (!directoryResizeState || !directory) return;

    event.preventDefault();

    const state = directoryResizeState;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const minWidth = 320;
    const minHeight = 280;
    const maxWidth = Math.max(minWidth, window.innerWidth - 24);
    const maxHeight = Math.max(minHeight, window.innerHeight - 24);

    let nextLeft = state.left;
    let nextTop = state.top;
    let nextWidth = state.width;
    let nextHeight = state.height;

    if (state.direction.includes("e")) {
      nextWidth = state.width + dx;
    }

    if (state.direction.includes("s")) {
      nextHeight = state.height + dy;
    }

    if (state.direction.includes("w")) {
      nextWidth = state.width - dx;
      nextLeft = state.left + dx;
    }

    if (state.direction.includes("n")) {
      nextHeight = state.height - dy;
      nextTop = state.top + dy;
    }

    nextWidth = clampNumber(nextWidth, minWidth, maxWidth);
    nextHeight = clampNumber(nextHeight, minHeight, maxHeight);

    if (state.direction.includes("w")) {
      nextLeft = state.left + state.width - nextWidth;
    }

    if (state.direction.includes("n")) {
      nextTop = state.top + state.height - nextHeight;
    }

    nextLeft = clampNumber(nextLeft, 12, window.innerWidth - nextWidth - 12);
    nextTop = clampNumber(nextTop, 12, window.innerHeight - nextHeight - 12);

    directory.style.left = `${Math.round(nextLeft)}px`;
    directory.style.top = `${Math.round(nextTop)}px`;
    directory.style.width = `${Math.round(nextWidth)}px`;
    directory.style.height = `${Math.round(nextHeight)}px`;
  }

  function stopDirectoryResize(event) {
    if (!directoryResizeState) return;

    if (event?.pointerId === directoryResizeState.pointerId) {
      event.target?.releasePointerCapture?.(event.pointerId);
    }

    directoryResizeState = null;
    directory?.classList.remove("is-resizing");
    window.removeEventListener("pointermove", handleDirectoryResizeMove, true);
    window.removeEventListener("pointerup", stopDirectoryResize, true);
    window.removeEventListener("pointercancel", stopDirectoryResize, true);
  }

  function ensureDirectoryResizeHandles() {
    if (!directory) return;

    ["n", "e", "s", "w", "ne", "se", "sw", "nw"].forEach((direction) => {
      if (directory.querySelector(`.cqr-resize-handle[data-direction="${direction}"]`)) return;

      const handle = document.createElement("div");
      handle.className = `cqr-resize-handle is-${direction}`;
      handle.dataset.direction = direction;
      handle.setAttribute("aria-hidden", "true");
      handle.addEventListener("pointerdown", (event) => startDirectoryResize(event, direction));
      directory.append(handle);
    });
  }

  function ensureRail() {
    if (rail) return rail;

    document.querySelectorAll(`#${APP_ID}`).forEach((existingRail) => existingRail.remove());

    rail = document.createElement("nav");
    rail.id = APP_ID;
    rail.className = "cqr-rail cqr-rail-viewport";
    rail.setAttribute("aria-hidden", "true");
    rail.hidden = true;
    document.documentElement.append(rail);

    directory = document.createElement("aside");
    directory.className = "cqr-directory";
    directory.setAttribute("aria-label", "All user questions");
    directory.hidden = true;
    document.documentElement.append(directory);

    directoryButtonTrigger = document.createElement("div");
    directoryButtonTrigger.className = "cqr-menu-trigger";
    document.documentElement.append(directoryButtonTrigger);

    directoryButton = document.createElement("button");
    directoryButton.type = "button";
    directoryButton.className = "cqr-menu-button";
    directoryButton.title = "Questions";
    directoryButton.setAttribute("aria-label", "Open question directory");
    directoryButton.innerHTML = "<span></span><span></span><span></span>";
    directoryButton.addEventListener("click", () => toggleDirectory());
    document.documentElement.append(directoryButton);

    tooltip = document.createElement("div");
    tooltip.className = "cqr-tooltip";
    tooltip.hidden = true;
    document.documentElement.append(tooltip);

    directoryButtonTrigger.addEventListener("mouseenter", showDirectoryButton);
    directoryButtonTrigger.addEventListener("mouseleave", scheduleHideDirectoryButton);
    directoryButtonTrigger.addEventListener("click", () => toggleDirectory());
    directoryButton.addEventListener("mouseenter", showDirectoryButton);
    directoryButton.addEventListener("mouseleave", scheduleHideDirectoryButton);

    document.addEventListener("pointerdown", (event) => {
      if (!directory || directory.hidden) return;

      if (directoryButton?.contains(event.target) || directoryButtonTrigger?.contains(event.target) || rail?.contains(event.target)) {
        return;
      }

      if (directory.contains(event.target) && isDirectoryInteractiveTarget(event.target)) {
        return;
      }

      toggleDirectory(false);
    }, true);

    return rail;
  }

  function getRailScrollViewport() {
    return railTrack || railDotList || rail;
  }

  function getRailContentElement() {
    return railTrackContent || railDotList || rail;
  }

  function ensureRailDocumentWheelListener() {
    if (railDocumentWheelListenerAttached) return;
    railDocumentWheelListenerAttached = true;
    document.addEventListener("wheel", handleRailWheel, { passive: false, capture: true });
  }

  function isEventInsideRail(event) {
    if (!rail || rail.hidden) return false;

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(rail)) return true;
    if (event.target instanceof Node && rail.contains(event.target)) return true;

    const rect = rail.getBoundingClientRect();
    return event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom;
  }

  function handleRailWheel(event) {
    if (handledRailWheelEvents.has(event)) return;
    if (!isEventInsideRail(event)) return;
    handledRailWheelEvents.add(event);

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    if (!rail) return;
    const viewport = getRailScrollViewport();
    if (!viewport) return;

    const deltaMultiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? viewport.clientHeight
        : 1;
    let deltaY = event.deltaY * deltaMultiplier;
    const now = Date.now();

    const currentTop = viewport.scrollTop;
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

    railPointerInside = true;
    railUserScrollUntil = now + 1800;
    rail.classList.add("is-wheel-scrolling");
    hideTooltip();
    window.clearTimeout(railWheelClassTimer);
    railWheelClassTimer = window.setTimeout(() => {
      rail?.classList.remove("is-wheel-scrolling");
    }, 420);

    if (maxScrollTop <= 0) return;

    const nextTop = Math.max(0, Math.min(maxScrollTop, currentTop + deltaY));
    if (Math.abs(nextTop - currentTop) < 0.5) return;
    viewport.scrollTop = nextTop;
    railWheelDirection = Math.sign(deltaY);
    railWheelDirectionUntil = now + 80;
  }

  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `cqr-toast${isError ? " is-error" : ""}`;
    toast.textContent = message;
    document.documentElement.append(toast);
    window.setTimeout(() => toast.remove(), 2400);
  }

  function toggleDirectory(forceOpen) {
    if (!directory || questions.length === 0) return;

    const shouldOpen = forceOpen ?? directory.hidden;
    directory.hidden = !shouldOpen;
    directoryButton?.classList.toggle("is-active", shouldOpen);
    if (shouldOpen) {
      showDirectoryButton();
    } else {
      scheduleHideDirectoryButton();
    }
  }

  function openIssueTemplateChooser() {
    window.open(GITHUB_ISSUE_URL, "_blank", "noopener,noreferrer");
  }

  function createReportIssueEntry() {
    const wrapper = document.createElement("div");
    wrapper.className = "cqr-feedback-row";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cqr-feedback-button";
    button.textContent = "反馈问题 / Report Issue";
    button.addEventListener("click", openIssueTemplateChooser);

    wrapper.append(button);
    return wrapper;
  }

  function showDirectoryButton() {
    window.clearTimeout(hideDirectoryButtonTimer);
    directoryButton?.classList.add("is-visible");
  }

  function scheduleHideDirectoryButton() {
    window.clearTimeout(hideDirectoryButtonTimer);
    hideDirectoryButtonTimer = window.setTimeout(() => {
      if (!directory || !directory.hidden) return;
      directoryButton?.classList.remove("is-visible");
    }, 260);
  }

  function showTooltip(dot, text) {
    if (!tooltip) return;

    const rect = dot.getBoundingClientRect();
    tooltip.textContent = text || dot.getAttribute("aria-label") || "";
    tooltip.hidden = false;
    tooltip.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
    tooltip.style.right = `${Math.round(window.innerWidth - rect.left + 13)}px`;
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  function textsLikelyMatch(a, b) {
    const left = normalizeQuestionText(a);
    const right = normalizeQuestionText(b);
    if (!left || !right) return false;
    if (left === right) return true;

    const leftHead = left.slice(0, 80);
    const rightHead = right.slice(0, 80);
    return leftHead.length >= 12
      && rightHead.length >= 12
      && (left.startsWith(rightHead) || right.startsWith(leftHead) || left.includes(rightHead) || right.includes(leftHead));
  }

  function findLoadedQuestionMatch(targetQuestion) {
    return findQuestionByStableIdentity(
      questions.filter((item) => item.loaded && item.element),
      targetQuestion
    );
  }

  function findLoadedQuestionBySequence(targetQuestion) {
    const loaded = questions
      .filter((item) => item.loaded && item.element instanceof Element)
      .sort((a, b) => a.index - b.index);
    if (loaded.length === 0) return null;

    if (Number.isFinite(targetQuestion.turnNumber)) {
      const byTurn = loaded.find((item) => item.turnNumber === targetQuestion.turnNumber);
      if (byTurn) return byTurn;
    }

    if (Number.isFinite(targetQuestion.index)) {
      const exactIndex = loaded.find((item) => item.index === targetQuestion.index);
      if (exactIndex) return exactIndex;

      const nearest = loaded
        .map((item) => ({
          item,
          distance: Math.abs(item.index - targetQuestion.index)
        }))
        .filter((candidate) => candidate.distance <= 1)
        .sort((a, b) => a.distance - b.distance)[0];
      if (nearest) return nearest.item;
    }

    return null;
  }

  function findLatestQuestionByIdentity(question) {
    if (!question) return null;
    return findQuestionByStableIdentity(questions, question);
  }

  function findLatestQuestionForElement(element, fallbackQuestion = null) {
    const id = element?.dataset?.questionId;
    const railIndex = Number(element?.dataset?.railIndex);
    const questionIndex = Number(element?.dataset?.questionIndex);
    const turnNumber = Number(element?.dataset?.turnNumber);
    const exactHash = element?.dataset?.exactHash;
    const hash = element?.dataset?.hash;

    const latestById = id ? questions.find((question) => question.id === id) : null;
    const latestByTurn = Number.isFinite(turnNumber)
      ? questions.find((question) => question.turnNumber === turnNumber)
      : null;
    const latestByIndexAndExactHash = Number.isFinite(questionIndex) && exactHash
      ? questions.find((question) => question.index === questionIndex
        && (question.exactHash || hashFullQuestionText(question.text)) === exactHash)
      : null;
    const latestByExactHash = exactHash
      ? questions.find((question) => (question.exactHash || hashFullQuestionText(question.text)) === exactHash)
      : null;
    const latestByHash = hash
      ? questions.find((question) => (question.hash || hashQuestionText(question.text)) === hash)
      : null;
    const indexedRailQuestion = Number.isFinite(railIndex) ? getRailQuestions()[railIndex] : null;
    const latestByRailIndex = indexedRailQuestion && (
      indexedRailQuestion.id === id
      || (exactHash && indexedRailQuestion.exactHash === exactHash)
      || (hash && indexedRailQuestion.hash === hash)
    )
      ? indexedRailQuestion
      : null;

    return latestById
      || latestByTurn
      || latestByRailIndex
      || latestByIndexAndExactHash
      || latestByExactHash
      || latestByHash
      || findLatestQuestionByIdentity(fallbackQuestion)
      || fallbackQuestion;
  }

  async function rescanAndFindQuestion(question, options = {}) {
    const { render = false, persist = true, silent = true, allowSequence = false } = options;
    await scanLoadedUserQuestions({ render, persist, silent });
    return findLoadedQuestionMatch(question)
      || findQuestionInLoadedTurn(question)
      || (allowSequence ? findLoadedQuestionBySequence(question) : null);
  }

  function buildNearbyProbePositions(container, baseTop) {
    const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    const viewport = Math.max(360, getClientHeight(container));
    const offsets = [
      0,
      -0.45 * viewport,
      0.45 * viewport,
      -0.95 * viewport,
      0.95 * viewport,
      -1.6 * viewport,
      1.6 * viewport,
      -2.4 * viewport,
      2.4 * viewport
    ];

    return Array.from(new Set(
      offsets.map((offset) => Math.max(0, Math.min(maxTop, Math.round(baseTop + offset))))
    ));
  }

  function getQuestionAnchorCandidates(question, container) {
    const offset = Math.min(120, Math.max(72, getClientHeight(container) * 0.14));
    const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    const candidates = [];
    const indexRatio = questions.length > 1
      ? (Math.max(1, question.index) - 1) / Math.max(1, questions.length - 1)
      : 0;

    const anchoredQuestions = questions.filter(hasReliableQuestionAnchor);
    const previousAnchor = anchoredQuestions
      .filter((item) => item.index < question.index)
      .sort((a, b) => b.index - a.index)[0];
    const nextAnchor = anchoredQuestions
      .filter((item) => item.index > question.index)
      .sort((a, b) => a.index - b.index)[0];

    if (hasReliableQuestionAnchor(question) && Number.isFinite(question.anchorScrollTop)) {
      candidates.push(question.anchorScrollTop);
    }

    if (hasReliableQuestionAnchor(question) && Number.isFinite(question.anchorTop)) {
      candidates.push(question.anchorTop - offset);
    }

    if (hasReliableQuestionAnchor(question) && Number.isFinite(question.anchorRatio)) {
      candidates.push(question.anchorRatio * maxTop - offset);
    }

    if (previousAnchor && nextAnchor) {
      const previousTop = Number.isFinite(previousAnchor.anchorTop)
        ? previousAnchor.anchorTop
        : previousAnchor.anchorRatio * maxTop;
      const nextTop = Number.isFinite(nextAnchor.anchorTop)
        ? nextAnchor.anchorTop
        : nextAnchor.anchorRatio * maxTop;
      const localRatio = (question.index - previousAnchor.index) / Math.max(1, nextAnchor.index - previousAnchor.index);
      candidates.push(previousTop + (nextTop - previousTop) * localRatio - offset);
    } else if (previousAnchor) {
      const previousTop = Number.isFinite(previousAnchor.anchorTop)
        ? previousAnchor.anchorTop
        : previousAnchor.anchorRatio * maxTop;
      const averageGap = maxTop / Math.max(1, questions.length - 1);
      candidates.push(previousTop + (question.index - previousAnchor.index) * averageGap - offset);
    } else if (nextAnchor) {
      const nextTop = Number.isFinite(nextAnchor.anchorTop)
        ? nextAnchor.anchorTop
        : nextAnchor.anchorRatio * maxTop;
      const averageGap = maxTop / Math.max(1, questions.length - 1);
      candidates.push(nextTop - (nextAnchor.index - question.index) * averageGap - offset);
    }

    candidates.push(indexRatio * maxTop - offset);

    if (question.index <= 3) candidates.push(0);
    if (question.index >= questions.length - 2) candidates.push(maxTop);

    return Array.from(new Set(
      candidates
        .filter(Number.isFinite)
        .map((value) => Math.max(0, Math.min(maxTop, Math.round(value))))
    ));
  }

  function getRecordedQuestionScrollTops(question, container) {
    if (!hasReliableQuestionAnchor(question)) return [];

    const offset = Math.min(120, Math.max(72, getClientHeight(container) * 0.14));
    const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    const storedMaxTop = Math.max(1, (question.anchorScrollHeight || 0) - (question.anchorClientHeight || 0));
    const candidates = [];

    if (isFiniteNumber(question.anchorTargetScrollTop)) {
      const scaledTargetTop = storedMaxTop > 1
        ? question.anchorTargetScrollTop * (Math.max(1, maxTop) / storedMaxTop)
        : question.anchorTargetScrollTop;
      const useScaledTargetTop = Math.abs(maxTop - storedMaxTop) > Math.max(500, storedMaxTop * 0.12);
      candidates.push(useScaledTargetTop ? scaledTargetTop : question.anchorTargetScrollTop);
      candidates.push(scaledTargetTop);
    }

    if (isFiniteNumber(question.anchorTargetRatio)) {
      candidates.push(question.anchorTargetRatio * maxTop);
    }

    if (isFiniteNumber(question.anchorTop)) {
      candidates.push(question.anchorTop - offset);
    }

    if (isFiniteNumber(question.anchorScrollTop)) {
      const scaledScrollTop = storedMaxTop > 1
        ? question.anchorScrollTop * (Math.max(1, maxTop) / storedMaxTop)
        : question.anchorScrollTop;
      const useScaledScrollTop = Math.abs(maxTop - storedMaxTop) > Math.max(500, storedMaxTop * 0.12);
      candidates.push(useScaledScrollTop ? scaledScrollTop : question.anchorScrollTop);
      candidates.push(scaledScrollTop);
    }

    if (isFiniteNumber(question.anchorScrollRatio)) {
      candidates.push(question.anchorScrollRatio * maxTop);
    }

    if (isFiniteNumber(question.anchorTop) && isFiniteNumber(question.anchorViewportOffset)) {
      candidates.push(question.anchorTop - Math.max(0, Math.min(getClientHeight(container), question.anchorViewportOffset)));
    }

    if (isFiniteNumber(question.anchorRatio)) {
      candidates.push(question.anchorRatio * maxTop - offset);
    }

    return Array.from(new Set(
      candidates
        .filter(Number.isFinite)
        .map((value) => Math.max(0, Math.min(maxTop, Math.round(value))))
    ));
  }

  async function wakeVirtualizedQuestionAt(container, question, baseTop, options = {}) {
    const { thorough = false } = options;
    const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    const viewport = Math.max(360, getClientHeight(container));
    const fastOffsets = [
      0,
      -viewport * 0.14,
      viewport * 0.14
    ];
    const thoroughOffsets = [
      0,
      -viewport * 0.16,
      viewport * 0.16,
      -viewport * 0.38,
      viewport * 0.38,
      -viewport * 0.72,
      viewport * 0.72
    ];
    const offsets = thorough ? thoroughOffsets : fastOffsets;

    for (const offset of offsets) {
      const top = Math.max(0, Math.min(maxTop, Math.round(baseTop + offset)));
      setScrollTop(container, top);
      await waitAfterLocateScroll(thorough ? (offset === 0 ? 120 : 90) : (offset === 0 ? 82 : 68));

      const found = await rescanAndFindQuestion(question);
      if (found?.element) return found;
    }

    setScrollTop(container, Math.max(0, Math.min(maxTop, Math.round(baseTop))));
    await delay(thorough ? 50 : 30);
    return rescanAndFindQuestion(question);
  }

  async function jumpToRecordedQuestionPosition(question, container, options = {}) {
    const { maxCandidates = 2, restoreOnMiss = true, token = activeLocateToken, thorough = false } = options;
    const candidates = getRecordedQuestionScrollTops(question, container);
    if (candidates.length === 0) return null;

    setActiveQuestion(question.id);
    for (const top of candidates.slice(0, maxCandidates)) {
      if (token !== activeLocateToken) return null;
      const found = await wakeVirtualizedQuestionAt(container, question, top, { thorough });
      if (found?.element) return found;
    }

    if (restoreOnMiss) {
      setScrollTop(container, candidates[0]);
      setActiveQuestion(question.id);
    }
    return null;
  }

  function getDirectionalLocateStep(question, container) {
    const viewport = Math.max(360, getClientHeight(container));
    const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    const currentTop = getScrollTop(container);
    const range = getLoadedQuestionRange();

    if (range) {
      const targetIndex = question.index || 1;
      if (targetIndex < range.minIndex) return Math.max(0, currentTop - viewport * 1.15);
      if (targetIndex > range.maxIndex) return Math.min(maxTop, currentTop + viewport * 1.15);
    }

    if (Number.isFinite(question.turnNumber)) {
      const visibleTurns = getVisibleTurnRange();
      if (visibleTurns) {
        if (question.turnNumber < visibleTurns.minTurn) return Math.max(0, currentTop - viewport * 1.15);
        if (question.turnNumber > visibleTurns.maxTurn) return Math.min(maxTop, currentTop + viewport * 1.15);
      }
    }

    return null;
  }

  function getLocateDirection(question, container) {
    const visibleTurns = getVisibleTurnRange();
    if (visibleTurns && Number.isFinite(question.turnNumber)) {
      if (question.turnNumber < visibleTurns.minTurn) return -1;
      if (question.turnNumber > visibleTurns.maxTurn) return 1;
      return 0;
    }

    const loadedRange = getLoadedQuestionRange();
    if (loadedRange && Number.isFinite(question.index)) {
      if (question.index < loadedRange.minIndex) return -1;
      if (question.index > loadedRange.maxIndex) return 1;
      return 0;
    }

    const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    const indexRatio = questions.length > 1
      ? (Math.max(1, question.index || 1) - 1) / Math.max(1, questions.length - 1)
      : 0;
    const estimatedTop = indexRatio * maxTop;
    return estimatedTop >= getScrollTop(container) ? 1 : -1;
  }

  function getLocateRangeSignature(container) {
    const visibleTurns = getVisibleTurnRange();
    const loadedRange = getLoadedQuestionRange();
    return [
      Math.round(getScrollTop(container) / 32),
      visibleTurns ? `${visibleTurns.minTurn}-${visibleTurns.maxTurn}` : "no-turns",
      loadedRange ? `${loadedRange.minIndex}-${loadedRange.maxIndex}` : "no-loaded"
    ].join("|");
  }

  async function waitAfterLocateScroll(delayMs) {
    await delay(isChatGeneratingResponse() ? Math.max(delayMs, 420) : delayMs);
  }

  async function sweepLocateQuestion(question, container, options = {}) {
    const { token = activeLocateToken } = options;
    const startedAt = Date.now();
    const viewport = Math.max(360, getClientHeight(container));
    const startFromTop = (question.index || 1) <= Math.max(1, questions.length / 2);
    let maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    let direction = startFromTop ? 1 : -1;
    let top = startFromTop ? 0 : maxTop;
    let stableCount = 0;
    let lastSignature = "";

    setScrollTop(container, top);
    await waitAfterLocateScroll(520);

    for (let step = 0; step < 120; step += 1) {
      if (token !== activeLocateToken) return null;
      if (Date.now() - startedAt > 32000) break;

      const found = await rescanAndFindQuestion(question, {
        render: step % 8 === 0,
        persist: true,
        silent: step % 8 !== 0
      });
      if (found?.element) return found;

      maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
      const currentTop = getScrollTop(container);
      const signature = getLocateRangeSignature(container);
      if (signature === lastSignature) {
        stableCount += 1;
      } else {
        stableCount = 0;
        lastSignature = signature;
      }

      if ((direction < 0 && currentTop <= 4) || (direction > 0 && currentTop >= maxTop - 8)) {
        if (stableCount >= 2) break;
      }

      const stepSize = viewport * (stableCount >= 2 ? 1.25 : 0.72);
      top = Math.max(0, Math.min(maxTop, currentTop + direction * stepSize));
      if (Math.abs(top - currentTop) < 12) {
        break;
      }

      setScrollTop(container, top);
      await waitAfterLocateScroll(stableCount >= 2 ? 360 : 210);
    }

    return null;
  }

  async function directedDeepLocateQuestion(question, container, options = {}) {
    const { token = activeLocateToken } = options;
    const startedAt = Date.now();
    const viewport = Math.max(360, getClientHeight(container));
    const visitedBuckets = new Set();
    let staleCount = 0;
    let lastSignature = "";

    for (let step = 0; step < 90; step += 1) {
      if (token !== activeLocateToken) return null;
      if (Date.now() - startedAt > 26000) break;

      const found = await rescanAndFindQuestion(question, {
        render: step % 8 === 0,
        persist: true,
        silent: step % 8 !== 0
      });
      if (found?.element) return found;

      const currentTop = getScrollTop(container);
      const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
      let direction = getLocateDirection(question, container);
      if (direction === 0) {
        direction = getLocateDirection(question, container) || (currentTop < maxTop / 2 ? 1 : -1);
      }

      const signature = getLocateRangeSignature(container);
      if (signature === lastSignature) {
        staleCount += 1;
      } else {
        staleCount = 0;
        lastSignature = signature;
      }

      const bucket = Math.round(currentTop / Math.max(120, viewport * 0.33));
      visitedBuckets.add(bucket);
      let stepSize = viewport * (staleCount >= 2 ? 1.55 : 0.82);
      let nextTop = Math.max(0, Math.min(maxTop, currentTop + direction * stepSize));
      let nextBucket = Math.round(nextTop / Math.max(120, viewport * 0.33));

      if (visitedBuckets.has(nextBucket) || Math.abs(nextTop - currentTop) < 16) {
        stepSize = viewport * (2.2 + Math.min(3, staleCount) * 0.45);
        nextTop = Math.max(0, Math.min(maxTop, currentTop + direction * stepSize));
        nextBucket = Math.round(nextTop / Math.max(120, viewport * 0.33));
      }

      if ((direction < 0 && currentTop <= 4) || (direction > 0 && currentTop >= maxTop - 8)) {
        break;
      }

      setScrollTop(container, nextTop);
      await waitAfterLocateScroll(staleCount >= 2 ? 320 : 180);
    }

    return sweepLocateQuestion(question, container, { token });
  }

  async function retryLocateAfterScrollSettles(question, container, options = {}) {
    const { token = activeLocateToken } = options;
    const settleDelay = isChatGeneratingResponse() ? 620 : 420;
    await delay(settleDelay);

    let stuckCount = 0;

    for (let step = 0; step < 14; step += 1) {
      if (token !== activeLocateToken) return null;

      const found = await rescanAndFindQuestion(question, { render: true, persist: true });
      if (found?.element) return found;

      const latest = getLatestQuestionSnapshot(question);
      let nextTop = getDirectionalLocateStep(latest, container);

      // Fallback when no directional info: use index-based estimation
      if (!Number.isFinite(nextTop)) {
        const indexRatio = questions.length > 1
          ? (Math.max(1, question.index || 1) - 1) / Math.max(1, questions.length - 1)
          : 0;
        const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
        const viewport = Math.max(360, getClientHeight(container));
        const estimatedTop = indexRatio * maxTop;
        const currentTop = getScrollTop(container);
        const direction = estimatedTop > currentTop ? 1 : -1;
        nextTop = Math.max(0, Math.min(maxTop, currentTop + direction * viewport * 1.8));
      }

      const currentTop = getScrollTop(container);
      const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
      const viewport = Math.max(360, getClientHeight(container));

      if (Math.abs(nextTop - currentTop) < 24) {
        stuckCount += 1;
        if (stuckCount > 3) break;
        await delay(240);
        continue;
      } else {
        stuckCount = 0;
      }

      setScrollTop(container, nextTop);
      await delay(step < 2 ? 520 : 680);
    }

    return rescanAndFindQuestion(question, { render: true, persist: true });
  }

  async function backtrackToQuestionBeforeAnswer(question, container, options = {}) {
    const { token = activeLocateToken } = options;
    const viewport = Math.max(360, getClientHeight(container));

    for (let step = 0; step < 26; step += 1) {
      if (token !== activeLocateToken) return null;

      const found = await rescanAndFindQuestion(question, { render: false, persist: true, silent: true });
      if (found?.element) return found;

      const currentTop = getScrollTop(container);
      const multiplier = step < 4 ? 0.85 : step < 12 ? 1.35 : 2.1;
      const nextTop = Math.max(0, currentTop - viewport * multiplier);
      if (Math.abs(nextTop - currentTop) < 12) {
        return null;
      }

      setScrollTop(container, nextTop);
      await delay(step < 4 ? 90 : 130);
    }

    return rescanAndFindQuestion(question, { render: false, persist: true, silent: true });
  }

  async function settleAndRetryQuestionLocate(question, container, options = {}) {
    const { token = activeLocateToken } = options;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (token !== activeLocateToken) return null;
      await waitAfterLocateScroll(attempt < 2 ? 720 : 420);
      const found = await rescanAndFindQuestion(question, {
        render: true,
        persist: true,
        silent: false
      });
      if (found?.element) return found;
    }

    const beforeAnswer = await backtrackToQuestionBeforeAnswer(question, container, { token });
    if (beforeAnswer?.element) return beforeAnswer;

    const byTurn = await locateQuestionByTurnNumber(question, container, { token, maxSteps: 8, fast: true });
    if (byTurn?.element) return byTurn;

    return null;
  }

  function getLatestQuestionSnapshot(question) {
    return findQuestionByStableIdentity(questions, question) || question;
  }

  function getLoadedQuestionRange() {
    const loaded = questions
      .filter((item) => item.loaded && item.element instanceof Element)
      .sort((a, b) => a.index - b.index);

    if (loaded.length === 0) return null;

    return {
      minIndex: loaded[0].index,
      maxIndex: loaded[loaded.length - 1].index,
      centerIndex: (loaded[0].index + loaded[loaded.length - 1].index) / 2,
      count: loaded.length
    };
  }

  function getVisibleTurnRange() {
    const turns = Array.from(document.querySelectorAll(STRICT_CONVERSATION_TURN_SELECTOR))
      .map((turn) => ({
        turn,
        number: getConversationTurnNumber(turn),
        rect: turn.getBoundingClientRect()
      }))
      .filter((item) => Number.isFinite(item.number))
      .filter((item) => item.rect.bottom > -200 && item.rect.top < window.innerHeight + 200)
      .sort((a, b) => a.number - b.number);

    if (turns.length === 0) return null;

    return {
      minTurn: turns[0].number,
      maxTurn: turns[turns.length - 1].number,
      turns
    };
  }

  function findLoadedTurnByNumber(turnNumber) {
    if (!Number.isFinite(turnNumber)) return null;
    return Array.from(document.querySelectorAll(STRICT_CONVERSATION_TURN_SELECTOR))
      .find((turn) => getConversationTurnNumber(turn) === turnNumber) || null;
  }

  function findQuestionInLoadedTurn(question) {
    if (!Number.isFinite(question.turnNumber)) return null;

    const turn = findLoadedTurnByNumber(question.turnNumber);
    if (!turn || !isLikelyUserTurn(turn)) return null;

    const element = resolveUserMessageElementFromTurn(turn);
    if (!element) return null;

    const text = normalizeQuestionText(getMessageText(element));
    if (!textsLikelyMatch(text, question.text)) return null;

    const existing = questions.find((item) => item.id === question.id);
    return {
      ...(existing || question),
      text,
      element: getQuestionScrollTarget(element),
      loaded: true
    };
  }

  async function waitForQuestionToLoad(question, attempts = 5, delayMs = 120) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const found = await rescanAndFindQuestion(question);
      if (found?.element) return found;
      if (attempt < attempts - 1) await delay(delayMs);
    }

    return null;
  }

  async function findLoadedQuestionNow(question, options = {}) {
    const { allowSequence = false } = options;
    const target = getLatestQuestionSnapshot(question);
    const direct = findLoadedQuestionMatch(target) || findQuestionInLoadedTurn(target);
    if (direct?.element) return direct;

    return rescanAndFindQuestion(target, {
      render: false,
      persist: true,
      silent: true,
      allowSequence
    });
  }

  async function locateQuestionByVerifiedPositions(question, container, options = {}) {
    const { token = activeLocateToken, maxCandidates = 8, thorough = false } = options;
    let target = getLatestQuestionSnapshot(question);
    const immediate = await findLoadedQuestionNow(target);
    if (immediate?.element) return immediate;

    const candidates = Array.from(new Set([
      ...getRecordedQuestionScrollTops(target, container),
      ...getQuestionAnchorCandidates(target, container),
      getIndexBasedEstimate(target, container)
    ]))
      .filter(Number.isFinite)
      .slice(0, maxCandidates);

    for (const top of candidates) {
      if (token !== activeLocateToken) return null;
      target = getLatestQuestionSnapshot(target);
      const found = await wakeVirtualizedQuestionAt(container, target, top, { thorough });
      if (found?.element) return found;
    }

    return null;
  }

  async function locateQuestionByTurnNumber(question, container, options = {}) {
    const { token = activeLocateToken, maxSteps = 22, fast = false } = options;
    if (!Number.isFinite(question.turnNumber)) return null;

    const maxTop = () => Math.max(0, getScrollHeight(container) - getClientHeight(container));
    const viewport = Math.max(360, getClientHeight(container));
    let low = 0;
    let high = maxTop();
    const turnCandidates = [
      ...getRecordedQuestionScrollTops(question, container),
      ...getQuestionAnchorCandidates(question, container)
    ];
    const knownTurnNumbers = questions
      .map((item) => item.turnNumber)
      .filter(Number.isFinite);
    let lastSignature = "";
    let staleCount = 0;

    if (knownTurnNumbers.length > 1) {
      const minKnownTurn = Math.min(...knownTurnNumbers);
      const maxKnownTurn = Math.max(...knownTurnNumbers);
      const ratio = (question.turnNumber - minKnownTurn) / Math.max(1, maxKnownTurn - minKnownTurn);
      turnCandidates.push(Math.max(0, Math.min(maxTop(), ratio * maxTop())));
    }

    for (let step = 0; step < maxSteps; step += 1) {
      if (token !== activeLocateToken) return null;

      const top = turnCandidates.length > 0
        ? turnCandidates.shift()
        : Math.round((low + high) / 2);

      setScrollTop(container, Math.max(0, Math.min(maxTop(), Math.round(top))));
      await waitAfterLocateScroll(fast ? (step < 3 ? 95 : 135) : (step < 3 ? 145 : 190));

      const found = await rescanAndFindQuestion(question);
      if (found?.element) return found;

      const range = getVisibleTurnRange();
      if (!range) continue;

      const currentTop = getScrollTop(container);
      const signature = getLocateRangeSignature(container);
      if (signature === lastSignature) {
        staleCount += 1;
      } else {
        staleCount = 0;
        lastSignature = signature;
      }

      if (question.turnNumber < range.minTurn) {
        high = Math.min(high, Math.max(0, currentTop - viewport * 0.18));
        const nextTop = Math.max(0, Math.min(high, Math.round((low + high) / 2)));
        turnCandidates.unshift(nextTop, Math.max(0, currentTop - viewport * (1.1 + Math.min(staleCount, 3) * 0.45)));
      } else if (question.turnNumber > range.maxTurn) {
        low = Math.max(low, Math.min(maxTop(), currentTop + viewport * 0.18));
        const nextTop = Math.min(maxTop(), Math.max(low, Math.round((low + high) / 2)));
        turnCandidates.unshift(nextTop, Math.min(maxTop(), currentTop + viewport * (1.1 + Math.min(staleCount, 3) * 0.45)));
      } else {
        turnCandidates.unshift(
          Math.max(0, currentTop - viewport * 0.22),
          Math.min(maxTop(), currentTop + viewport * 0.22),
          Math.max(0, currentTop - viewport * 0.58),
          Math.min(maxTop(), currentTop + viewport * 0.58),
          Math.max(0, currentTop - viewport * 1.05),
          Math.min(maxTop(), currentTop + viewport * 1.05)
        );
      }

      if (high < low) {
        const direction = question.turnNumber > range.maxTurn ? 1 : -1;
        const nextTop = currentTop + direction * viewport * (1.8 + Math.min(staleCount, 3) * 0.6);
        low = Math.max(0, Math.min(maxTop(), nextTop));
        high = low;
      }

      if (staleCount >= 7) {
        const direction = question.turnNumber < range.minTurn ? -1 : question.turnNumber > range.maxTurn ? 1 : 0;
        if (direction === 0) break;
        const escapeTop = Math.max(0, Math.min(maxTop(), currentTop + direction * viewport * 3.2));
        if (Math.abs(escapeTop - currentTop) < 20) break;
        turnCandidates.unshift(escapeTop);
        staleCount = 0;
      }
    }

    return null;
  }

  async function hydrateAroundRecordedPosition(question, container) {
    const candidates = getRecordedQuestionScrollTops(question, container);
    if (candidates.length === 0) return null;

    const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    const viewport = Math.max(360, getClientHeight(container));
    const baseTop = Math.max(0, Math.min(maxTop, Math.round(candidates[0])));

    // Phase 1: direct jump to estimated position, wait for virtual scrolling to load content
    setScrollTop(container, baseTop);
    let found = await waitForQuestionToLoad(question, 4, 160);
    if (found?.element) return found;

    await delay(420);
    return rescanAndFindQuestion(question, { render: true, persist: true });
  }

  function getQuestionLocateScrollTops(question, container) {
    const offset = Math.min(120, Math.max(72, getClientHeight(container) * 0.14));
    const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    const targetIndex = Math.max(1, question.index || 1);
    const indexRatio = questions.length > 1
      ? (targetIndex - 1) / Math.max(1, questions.length - 1)
      : 0;
    const candidates = [
      ...getRecordedQuestionScrollTops(question, container),
      ...getQuestionAnchorCandidates(question, container),
      indexRatio * maxTop - offset
    ];

    return Array.from(new Set(
      candidates
        .filter(Number.isFinite)
        .map((value) => Math.max(0, Math.min(maxTop, Math.round(value))))
    ));
  }

  async function locateQuestionAdaptively(question, container) {
    let target = getLatestQuestionSnapshot(question);
    let targetIndex = target.index || question.index || 1;
    let maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    let low = 0;
    let high = maxTop;
    const visited = [];
    const candidateQueue = getQuestionLocateScrollTops(target, container);
    const viewport = Math.max(360, getClientHeight(container));

    for (let step = 0; step < 3; step += 1) {
      maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
      high = Math.max(low, Math.min(high, maxTop));

      let nextTop = candidateQueue.length > 0
        ? candidateQueue.shift()
        : Math.round((low + high) / 2);

      if (!Number.isFinite(nextTop)) break;
      nextTop = Math.max(0, Math.min(maxTop, Math.round(nextTop)));

      if (visited.some((top) => Math.abs(top - nextTop) < 24)) {
        const range = getLoadedQuestionRange();
        if (range && targetIndex > range.maxIndex) {
          nextTop = Math.min(maxTop, getScrollTop(container) + viewport * 1.6);
        } else if (range && targetIndex < range.minIndex) {
          nextTop = Math.max(0, getScrollTop(container) - viewport * 1.6);
        } else {
          nextTop = Math.max(0, Math.min(maxTop, getScrollTop(container) + (step % 2 === 0 ? viewport : -viewport)));
        }
      }

      visited.push(nextTop);
      setScrollTop(container, nextTop);
      await delay(step === 0 ? 120 : 95);

      const found = await rescanAndFindQuestion(target);
      if (found?.element) return found;

      target = getLatestQuestionSnapshot(target);
      targetIndex = target.index || targetIndex;
      const range = getLoadedQuestionRange();
      if (!range) continue;

      const currentTop = getScrollTop(container);
      const guard = Math.max(40, viewport * 0.18);

      if (targetIndex < range.minIndex) {
        high = Math.min(high, Math.max(0, currentTop - guard));
      } else if (targetIndex > range.maxIndex) {
        low = Math.max(low, Math.min(maxTop, currentTop + guard));
      } else {
        candidateQueue.unshift(
          Math.max(0, currentTop - viewport * 0.5),
          Math.min(maxTop, currentTop + viewport * 0.5)
        );
      }

      if (low > high) {
        const direction = targetIndex > range.centerIndex ? 1 : -1;
        low = Math.max(0, Math.min(maxTop, currentTop + direction * viewport * 1.2));
        high = low;
      }
    }

    return null;
  }

  async function jumpToQuestionAnchor(question, container) {
    const candidates = getQuestionAnchorCandidates(question, container);
    if (candidates.length === 0) return null;

    const probePositions = candidates.flatMap((candidate) => buildNearbyProbePositions(container, candidate));
    const uniqueProbePositions = Array.from(new Set(probePositions));

    setActiveQuestion(question.id);
    for (const top of uniqueProbePositions) {
      setScrollTop(container, top);
      await delay(120);
      const found = await rescanAndFindQuestion(question);
      if (found?.element) return found;
    }

    return null;
  }

  function getIndexBasedEstimate(question, container) {
    const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    const total = Math.max(1, questions.length);
    const ratio = (Math.max(1, question.index || 1) - 1) / Math.max(1, total - 1);
    return Math.max(0, Math.min(maxTop, ratio * maxTop));
  }

  async function navigateByTurnOrIndex(question, container, options = {}) {
    const { token = activeLocateToken } = options;
    const maxTop = Math.max(0, getScrollHeight(container) - getClientHeight(container));
    const viewport = Math.max(360, getClientHeight(container));
    const targetIndex = question.index || 1;
    const totalQuestions = Math.max(1, questions.length);
    const estimatedTop = getIndexBasedEstimate(question, container);
    const distance = Math.abs(estimatedTop - getScrollTop(container));

    // Phase 1: direct jump to index-based estimated position
    setScrollTop(container, Math.round(estimatedTop));
    await delay(distance < viewport * 2 ? 350 : 600);

    // Try turn-number lookup (most reliable match)
    if (Number.isFinite(question.turnNumber)) {
      const byTurn = findQuestionInLoadedTurn(question);
      if (byTurn) return { ...question, element: byTurn.element, loaded: true, id: byTurn.id || question.id };
    }

    // Standard scan
    let found = await rescanAndFindQuestion(question, { render: true, persist: true });
    if (found?.element) return found;

    // Phase 2: check if we're in the right region
    const range = getLoadedQuestionRange();
    if (range && targetIndex >= range.minIndex && targetIndex <= range.maxIndex) {
      const probes = [estimatedTop - viewport * 0.25, estimatedTop + viewport * 0.25];
      for (const probe of probes) {
        if (token !== activeLocateToken) return null;
        setScrollTop(container, Math.max(0, Math.min(maxTop, Math.round(probe))));
        await delay(180);
        found = await rescanAndFindQuestion(question, { render: true, persist: true });
        if (found?.element) return found;
      }
      return null;
    }

    // Phase 3: far-away target — use one boundary wait or directional scroll
    const isExtremeTop = estimatedTop <= viewport * 0.5 && targetIndex <= 3;
    const isExtremeBottom = estimatedTop >= maxTop - viewport * 0.5 && targetIndex >= totalQuestions - 2;

    if (isExtremeTop || isExtremeBottom) {
      const boundary = isExtremeTop ? 0 : maxTop;
      setScrollTop(container, boundary);
      await delay(720);

      if (token !== activeLocateToken) return null;
      if (Number.isFinite(question.turnNumber)) {
        const byTurn = findQuestionInLoadedTurn(question);
        if (byTurn) return { ...question, element: byTurn.element, loaded: true, id: byTurn.id || question.id };
      }
      found = await rescanAndFindQuestion(question, { render: true, persist: true });
      if (found?.element) return found;

      return rescanAndFindQuestion(question, { render: true, persist: true });
    }

    // Directional progressive scroll for mid-range targets
    const direction = estimatedTop > getScrollTop(container) ? 1 : -1;
    for (let step = 0; step < 12; step += 1) {
      if (token !== activeLocateToken) return null;

      const stepSize = viewport * (1.3 + step * 0.4);
      const nextTop = Math.max(0, Math.min(maxTop, getScrollTop(container) + direction * stepSize));
      setScrollTop(container, nextTop);
      await delay(380 + step * 70);

      if (Number.isFinite(question.turnNumber)) {
        const byTurn = findQuestionInLoadedTurn(question);
        if (byTurn) return { ...question, element: byTurn.element, loaded: true, id: byTurn.id || question.id };
      }
      found = await rescanAndFindQuestion(question, { render: true, persist: true });
      if (found?.element) return found;

      const newRange = getLoadedQuestionRange();
      if (newRange) {
        const reached = direction === 1 ? newRange.maxIndex >= targetIndex : newRange.minIndex <= targetIndex;
        if (reached) {
          setScrollTop(container, Math.round(estimatedTop));
          await delay(400);
          return rescanAndFindQuestion(question, { render: true, persist: true });
        }
      }
    }

    return null;
  }

  function finishLocatedQuestion(found, fallbackQuestion) {
    if (!found?.element) return false;

    jumpElementToView(found.element);
    setActiveQuestion(found.id || fallbackQuestion?.id || activeQuestionId);
    window.setTimeout(updateActiveDot, 200);
    return true;
  }

  async function locateQuestion(question) {
    if (!question) return;
    hideTooltip();
    const locateToken = activeLocateToken + 1;
    activeLocateToken = locateToken;
    question = getLatestQuestionSnapshot(question);

    const loadedNow = await findLoadedQuestionNow(question);
    if (locateToken !== activeLocateToken) return false;
    if (finishLocatedQuestion(loadedNow, question)) {
      return true;
    }

    const scroller = findChatScrollContainer({ force: true });

    showToast("正在定位到目标问题...");
    const verified = await locateQuestionByVerifiedPositions(question, scroller, {
      token: locateToken,
      maxCandidates: hasReliableQuestionAnchor(question) ? 8 : 5,
      thorough: hasReliableQuestionAnchor(question)
    });
    if (locateToken !== activeLocateToken) return false;
    if (finishLocatedQuestion(verified, question)) {
      return true;
    }

    if (Number.isFinite(question.turnNumber)) {
      const quickByTurn = await locateQuestionByTurnNumber(question, scroller, {
        token: locateToken,
        maxSteps: hasReliableQuestionAnchor(question) ? 8 : 14,
        fast: true
      });
      if (locateToken !== activeLocateToken) return false;
      if (finishLocatedQuestion(quickByTurn, question)) {
        return true;
      }
    }

    if (hasReliableQuestionAnchor(question)) {
      showToast("正在按缓存位置快速定位...");
      const recorded = await jumpToRecordedQuestionPosition(question, scroller, {
        maxCandidates: 3,
        token: locateToken
      });
      if (finishLocatedQuestion(recorded, question)) {
        return true;
      }

      const quickByTurn = await locateQuestionByTurnNumber(question, scroller, {
        token: locateToken,
        maxSteps: 8,
        fast: true
      });
      if (locateToken !== activeLocateToken) return false;
      if (finishLocatedQuestion(quickByTurn, question)) {
        return true;
      }

      showToast("目标段落未完全加载，正在唤醒附近历史内容...");
      const hydrated = await hydrateAroundRecordedPosition(question, scroller);
      if (locateToken !== activeLocateToken) return false;
      if (finishLocatedQuestion(hydrated, question)) {
        return true;
      }

      const byTurn = await locateQuestionByTurnNumber(question, scroller, { token: locateToken });
      if (locateToken !== activeLocateToken) return false;
      if (finishLocatedQuestion(byTurn, question)) {
        return true;
      }

      showToast("正在回找该回答上方的问题...");
      const beforeAnswer = await backtrackToQuestionBeforeAnswer(question, scroller, { token: locateToken });
      if (finishLocatedQuestion(beforeAnswer, question)) {
        return true;
      }

      const adaptive = await locateQuestionAdaptively(question, scroller);
      if (locateToken !== activeLocateToken) return false;
      if (finishLocatedQuestion(adaptive, question)) {
        return true;
      }

      showToast("正在刷新定位锚点...");
      const settled = await retryLocateAfterScrollSettles(question, scroller, { token: locateToken });
      if (finishLocatedQuestion(settled, question)) {
        return true;
      }

      showToast("正在等待历史段落加载并二次定位...");
      const retryFound = await settleAndRetryQuestionLocate(question, scroller, { token: locateToken });
      if (locateToken !== activeLocateToken) return false;
      if (finishLocatedQuestion(retryFound, question)) {
        return true;
      }

      setActiveQuestion(question.id);
      showToast("未找到该问题本身，已停止在最接近的缓存位置。请滚动经过该问题一次以刷新精确锚点。", true);
      return false;
    }

    const primaryResult = await navigateByTurnOrIndex(question, scroller, { token: locateToken });
    if (locateToken !== activeLocateToken) return false;
    if (finishLocatedQuestion(primaryResult, question)) {
      return true;
    }

    showToast("正在尝试定位该问题...");
    const anchored = await jumpToQuestionAnchor(question, scroller);
    if (finishLocatedQuestion(anchored, question)) {
      return true;
    }

    const candidates = getQuestionAnchorCandidates(question, scroller);
    if (candidates.length > 0) {
      setScrollTop(scroller, candidates[0]);
      setActiveQuestion(question.id);
      const found = await waitForQuestionToLoad(question, 4, 120);
      if (locateToken !== activeLocateToken) return false;
      if (finishLocatedQuestion(found, question)) {
        return true;
      }

      const settled = await retryLocateAfterScrollSettles(question, scroller, { token: locateToken });
      if (finishLocatedQuestion(settled, question)) {
        return true;
      }

      showToast("正在等待历史段落加载并二次定位...");
      const retryFound = await settleAndRetryQuestionLocate(question, scroller, { token: locateToken });
      if (finishLocatedQuestion(retryFound, question)) {
        return true;
      }
    }

    showToast("正在深度查找该问题...");
    const deepFound = await directedDeepLocateQuestion(question, scroller, { token: locateToken });
    if (locateToken !== activeLocateToken) return false;
    if (finishLocatedQuestion(deepFound, question)) {
      return true;
    }

    showToast("暂未定位到该问题，请滚动经过该位置或使用深度采集补全历史段落。", true);
    return false;
  }

  function isRailUserScrolling() {
    return Date.now() < railUserScrollUntil;
  }

  function setActiveQuestion(questionId, { reveal = true } = {}) {
    void reveal;
    activeQuestionId = questionId;
    directory?.querySelectorAll(".cqr-directory-item").forEach((item) => {
      const isActive = item.dataset.questionId === questionId;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-current", isActive ? "true" : "false");
    });
  }

  function updateActiveDot() {
    if (questions.length === 0) {
      setActiveQuestion(null, { reveal: false });
      return;
    }

    const anchorY = Math.min(window.innerHeight * 0.35, 260);
    let nextQuestion = questions.find((question) => question.loaded && question.element) || null;

    questions.forEach((question) => {
      if (!question.loaded || !(question.element instanceof Element)) return;
      if (question.element.getBoundingClientRect().top <= anchorY) {
        nextQuestion = question;
      }
    });

    setActiveQuestion(nextQuestion?.id || null, { reveal: true });
  }

  function renderQuestionUi() {
    const root = ensureRail();
    const questionSignature = questions
      .map((question) => `${question.id}:${question.index}:${question.loaded ? "1" : "0"}:${isQuestionNavigable(question) ? "1" : "0"}:${question.anchorVersion || ""}:${question.turnNumber || ""}:${Math.round(question.anchorTop || -1)}:${Math.round(question.anchorTargetScrollTop || -1)}:${Math.round(question.anchorScrollTop || -1)}:${Math.round((question.anchorTargetRatio || 0) * 10000)}`)
      .join("|");
    const renderSignature = `${questionSignature}::menu-only`;
    if (lastRenderedQuestionSignature && renderSignature === lastRenderedQuestionSignature) {
      return;
    }
    lastRenderedQuestionSignature = renderSignature;

    root.hidden = true;
    if (directoryButton) directoryButton.hidden = questions.length === 0;
    if (directoryButtonTrigger) directoryButtonTrigger.hidden = questions.length === 0;
    if (directory) {
      directory.hidden = directory.hidden || questions.length === 0;
      directory.textContent = "";
      renderDirectory();
    }

    updateActiveDot();
  }

  function renderRail() {
    scanLoadedUserQuestions({ render: true, persist: true });
  }

  function setScrollTop(container, top) {
    scrollContainerToTop(container, top, "auto");
  }

  function forceScrollKnownContainersToTop(container) {
    setScrollTop(window, 0);
    setScrollTop(document.scrollingElement || document.documentElement, 0);
    if (container && !isPageScroller(container)) setScrollTop(container, 0);

    getUserMessages().forEach((message) => {
      getScrollableContainers(message).forEach((scrollContainer) => setScrollTop(scrollContainer, 0));
    });
  }

  function isAtBottom(container) {
    return getScrollTop(container) + getClientHeight(container) >= getScrollHeight(container) - 24;
  }

  async function scrollByAmount(container, amount) {
    scrollContainerBy(container, amount);
    await delay(360);
  }

  async function waitForDomStable() {
    let stable = 0;
    let lastSignature = "";

    while (stable < 2) {
      await delay(260);
      const signature = `${getUserMessages().length}:${document.body.childElementCount}:${getScrollHeight(findChatScrollContainer())}`;
      if (signature === lastSignature) {
        stable += 1;
      } else {
        stable = 0;
        lastSignature = signature;
      }
    }
  }

  async function scrollToTopAndWait(container) {
    let stable = 0;
    let lastHeight = getScrollHeight(container);

    while (stable < 3 && !cancelFullConversationCapture) {
      forceScrollKnownContainersToTop(container);
      await delay(700);
      await scanLoadedUserQuestionsAndMerge();

      const height = getScrollHeight(container);
      const top = getScrollTop(container);
      if (top < 10 && Math.abs(height - lastHeight) < 5) {
        stable += 1;
      } else {
        stable = 0;
      }

      lastHeight = height;
    }
  }

  function updateCaptureStatus(message) {
    captureStatusMessage = message;
    renderDirectory();
  }

  async function captureFullConversation() {
    if (isCapturingFullConversation) {
      cancelFullConversationCapture = true;
      updateCaptureStatus(`正在取消深度采集：已记录 ${questions.length} 个问题，当前 DOM 中 ${getUserMessages().length} 个问题`);
      return;
    }

    const startedAt = Date.now();
    const container = findChatScrollContainer({ force: true });
    const originalScrollTop = getScrollTop(container);
    isCapturingFullConversation = true;
    cancelFullConversationCapture = false;
    activeFullScanOrder = [];
    captureCompleted = false;
    updateCaptureStatus(`正在深度采集：已记录 ${questions.length} 个问题，当前 DOM 中 ${getUserMessages().length} 个问题`);

    try {
      await scrollToTopAndWait(container);
      await scanLoadedUserQuestionsAndMerge();

      let lastScrollTop = -1;
      let lastScrollHeight = getScrollHeight(container);
      let stableCount = 0;

      while (!cancelFullConversationCapture && stableCount < 6) {
        await scrollByAmount(container, Math.max(420, getClientHeight(container) * 0.9));
        await waitForDomStable();
        await scanLoadedUserQuestionsAndMerge();
        updateCaptureStatus(`正在深度采集：已记录 ${questions.length} 个问题，当前 DOM 中 ${getUserMessages().length} 个问题`);

        const currentScrollTop = getScrollTop(container);
        const currentScrollHeight = getScrollHeight(container);

        if (
          Math.abs(currentScrollTop - lastScrollTop) < 5
          && Math.abs(currentScrollHeight - lastScrollHeight) < 5
        ) {
          stableCount += 1;
        } else {
          stableCount = 0;
        }

        lastScrollTop = currentScrollTop;
        lastScrollHeight = currentScrollHeight;
        if (isAtBottom(container)) stableCount += 1;
      }

      captureCompleted = !cancelFullConversationCapture;
      const finishedMessage = cancelFullConversationCapture
        ? `深度采集已取消：已记录 ${questions.length} 个问题`
        : `深度采集完成：共记录 ${questions.length} 个问题`;
      updateCaptureStatus(finishedMessage);
      await writeQuestionCache(currentConversationId);
      console.log("[CQR] capture finished", {
        conversationId: currentConversationId,
        cachedCount: questions.length,
        durationMs: Date.now() - startedAt
      });
      showToast(finishedMessage);
    } finally {
      setScrollTop(container, originalScrollTop);
      await delay(220);
      await scanLoadedUserQuestionsAndMerge();
      isCapturingFullConversation = false;
      cancelFullConversationCapture = false;
      activeFullScanOrder = null;
      renderDirectory();
      updateActiveDot();
    }
  }

  function toggleManualCapture() {
    isRealtimeCaptureEnabled = !isRealtimeCaptureEnabled;
    isManualCaptureEnabled = false;
    if (isRealtimeCaptureEnabled) {
      findChatScrollContainer({ force: true });
      captureCompleted = false;
      captureStatusMessage = `实时采集中：已记录 ${questions.length} 个问题，当前 DOM 中 ${getUserMessages().length} 个问题`;
      scanLoadedUserQuestionsAndMerge();
      showToast("已开启实时采集，浏览时会自动记录问题位置。");
    } else {
      captureStatusMessage = `实时采集已暂停：已记录 ${questions.length} 个问题`;
      writeQuestionCache(currentConversationId);
      showToast("已暂停实时采集");
    }
    refreshCaptureStatus(true);
  }

  function createScanPrompt() {
    const wrapper = document.createElement("div");
    wrapper.className = "cqr-scan-prompt";

    const text = document.createElement("div");
    text.className = "cqr-scan-text";
    text.textContent = captureStatusMessage || (captureCompleted
      ? `实时采集中：已记录 ${questions.length} 个问题`
      : "实时采集中：浏览或滚动时会自动记录问题位置。");

    const stats = document.createElement("div");
    stats.className = "cqr-scan-stats";
    stats.textContent = `已记录 ${questions.length} 个问题，目录 ${getDirectoryQuestions().length} 个，当前已加载 ${getLoadedQuestionCount()} 个`;

    const hint = document.createElement("div");
    hint.className = "cqr-scan-hint";
    hint.textContent = "无需先点深度采集；只有 ChatGPT 尚未加载到 DOM 的历史段落，才需要深度采集或滚动经过一次。";

    const actions = document.createElement("div");
    actions.className = "cqr-scan-actions";

    const captureButton = document.createElement("button");
    captureButton.type = "button";
    captureButton.className = "cqr-scan-button";
    captureButton.textContent = isCapturingFullConversation ? "取消深度采集" : "深度采集完整对话";
    captureButton.addEventListener("click", captureFullConversation);

    const manualButton = document.createElement("button");
    manualButton.type = "button";
    manualButton.className = "cqr-scan-button";
    manualButton.textContent = isRealtimeCaptureEnabled ? "暂停实时采集" : "开启实时采集";
    manualButton.addEventListener("click", toggleManualCapture);

    actions.append(captureButton, manualButton);
    wrapper.append(text, stats, hint, actions);
    return wrapper;
  }

  function questionMatchesSearch(question, answerOverview = "") {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return String(question.text || "").toLowerCase().includes(query)
      || String(answerOverview || "").toLowerCase().includes(query);
  }

  function renderDirectory(keepSearchFocus = false) {
    if (!directory) return;

    directory.textContent = "";

    const tabs = document.createElement("div");
    tabs.className = "cqr-tabs";

    const directoryTab = document.createElement("button");
    directoryTab.type = "button";
    directoryTab.className = "cqr-tab";
    directoryTab.textContent = "目录";
    directoryTab.setAttribute("aria-selected", String(activeTab === "directory"));
    directoryTab.addEventListener("click", () => {
      activeTab = "directory";
      renderDirectory();
      updateActiveDot();
    });

    const exportTab = document.createElement("button");
    exportTab.type = "button";
    exportTab.className = "cqr-tab";
    exportTab.textContent = "导出";
    exportTab.setAttribute("aria-selected", String(activeTab === "export"));
    exportTab.addEventListener("click", () => {
      activeTab = "export";
      renderDirectory();
    });

    tabs.append(directoryTab, exportTab);
    directory.append(tabs);

    if (activeTab === "export") {
      renderExportPanel();
      ensureDirectoryResizeHandles();
      return;
    }

    const search = document.createElement("input");
    search.className = "cqr-directory-search";
    search.type = "search";
    search.placeholder = "搜索...";
    search.value = searchQuery;
    search.addEventListener("input", () => {
      searchQuery = search.value.trim();
      renderDirectory(true);
      updateActiveDot();
    });

    const list = document.createElement("div");
    list.className = "cqr-directory-list";
    const answerPairs = getQuestionAnswerPairs();

    getDirectoryQuestions()
      .map((question) => ({
        question,
        answerOverview: getAnswerOverviewForQuestion(question, answerPairs)
      }))
      .filter((entry) => questionMatchesSearch(entry.question, entry.answerOverview))
      .forEach(({ question, answerOverview }, visibleIndex) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "cqr-directory-item";
        item.classList.toggle("is-unloaded", !question.loaded);
        item.classList.toggle("is-stale", !isQuestionNavigable(question));
        item.dataset.questionId = question.id;
        item.dataset.questionIndex = String(question.index);
        if (Number.isFinite(question.turnNumber)) item.dataset.turnNumber = String(question.turnNumber);
        item.dataset.hash = question.hash || hashQuestionText(question.text);
        item.dataset.exactHash = question.exactHash || hashFullQuestionText(question.text);
        item.setAttribute("aria-current", question.id === activeQuestionId ? "true" : "false");
        item.classList.toggle("is-active", question.id === activeQuestionId);

        const number = document.createElement("span");
        number.className = "cqr-directory-number";
        number.textContent = String(visibleIndex + 1);

        const body = document.createElement("span");
        body.className = "cqr-directory-body";

        const titleRow = document.createElement("span");
        titleRow.className = "cqr-directory-title-row";

        const text = document.createElement("span");
        text.className = "cqr-directory-text";
        text.textContent = question.shortText || question.text || `Question ${visibleIndex + 1}`;

        const status = document.createElement("span");
        status.className = "cqr-directory-status";
        status.textContent = getQuestionStatusText(question);

        const answer = document.createElement("span");
        answer.className = "cqr-directory-answer-overview";
        answer.classList.toggle("is-empty", !findAnswerPairForQuestion(question, answerPairs)?.answerOverview);
        answer.textContent = `一句话概览：${answerOverview}`;

        titleRow.append(text, status);
        body.append(titleRow, answer);
        item.append(number, body);
        item.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const trigger = event.currentTarget;
          if (trigger.disabled) return;
          trigger.disabled = true;
          trigger.style.opacity = "0.5";
          scanLoadedUserQuestions({ render: false, persist: true, silent: true });
          const latestQuestion = findLatestQuestionForElement(trigger, question);
          try {
            await locateQuestion(latestQuestion);
          } finally {
            trigger.disabled = false;
            trigger.style.opacity = "";
          }
          toggleDirectory(false);
        });
        list.append(item);
      });

    directory.append(createScanPrompt(), search, list, createReportIssueEntry());
    ensureDirectoryResizeHandles();

    if (keepSearchFocus) {
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }
  }

  async function copyMarkdown() {
    const selectedCount = exportMode === "questions"
      ? getSelectedExportQuestions().length
      : getSelectedMessages().length;
    if (selectedCount === 0) {
      showToast(exportMode === "questions" ? "请先选择要导出的问题" : "请先选择要导出的对话", true);
      return;
    }

    const markdown = buildMarkdownExport();

    try {
      await navigator.clipboard.writeText(markdown);
      showToast("已复制 Markdown");
    } catch (error) {
      console.error("Failed to copy Markdown", error);
      showToast("复制 Markdown 失败", true);
    }
  }

  function downloadMarkdown() {
    const selectedCount = exportMode === "questions"
      ? getSelectedExportQuestions().length
      : getSelectedMessages().length;
    if (selectedCount === 0) {
      showToast(exportMode === "questions" ? "请先选择要导出的问题" : "请先选择要导出的对话", true);
      return;
    }

    const markdown = buildMarkdownExport();
    const filename = exportMode === "questions"
      ? `chatgpt-questions-${currentTimestampForFile()}.md`
      : `chatgpt-conversation-${currentTimestampForFile()}.md`;

    chrome.runtime.sendMessage({
      type: "download-markdown",
      filename,
      markdown
    }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        console.error("Failed to export Markdown", chrome.runtime.lastError || response?.error);
        showToast("导出 Markdown 失败", true);
        return;
      }

      showToast("已导出 Markdown");
    });
  }

  function shouldRemoveFromImageExport(element) {
    if (!(element instanceof Element)) return false;
    if (element.closest(`#${APP_ID}`)) return true;
    if (element.matches("script, style, link, textarea, input, select")) return true;
    if (element.matches("button, [role='button']")) return true;

    const selector = [
      "[data-testid*='copy' i]",
      "[data-testid*='reasoning' i]",
      "[data-testid*='thinking' i]",
      "[data-testid*='thought' i]",
      "[aria-label*='复制']",
      "[aria-label*='copy' i]",
      "[aria-label*='思考']",
      "[aria-label*='推理']",
      "[aria-label*='thinking' i]",
      "[aria-label*='reasoning' i]",
      "[class*='reasoning' i]",
      "[class*='thinking' i]",
      "[class*='thought' i]"
    ].join(",");

    if (element.matches(selector) || element.closest(selector)) return true;

    const compactText = (element.innerText || element.textContent || "")
      .replace(/\s+/g, "");
    return /^(已)?思考(中|完成)?(.*)?(展开|收起)?$/.test(compactText)
      || /^(展开|收起)$/.test(compactText);
  }

  function sanitizeImageExportClone(root) {
    Array.from(root.querySelectorAll("*")).forEach((element) => {
      if (shouldRemoveFromImageExport(element)) element.remove();
    });
  }

  function cloneMessageForImageExport(message) {
    const clone = message.node.cloneNode(true);
    sanitizeImageExportClone(clone);

    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    clone.style.animation = "none";
    clone.style.transition = "none";
    clone.style.maxWidth = "none";
    clone.style.width = "100%";

    const wrapper = document.createElement("section");
    wrapper.className = "cqr-image-message";
    wrapper.dataset.role = message.role;
    wrapper.style.cssText = [
      "display:block",
      "width:100%",
      "margin:0",
      "padding:0",
      "color:#111827",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif"
    ].join(";");

    const content = document.createElement("div");
    content.className = "cqr-image-message-content";
    content.style.cssText = [
      "display:block",
      "width:100%",
      "margin:0",
      "padding:0"
    ].join(";");
    content.append(clone);
    wrapper.append(content);

    return wrapper;
  }

  function createImageExportDocument(messages) {
    const width = Math.min(1080, Math.max(320, window.innerWidth - 32));
    const stage = document.createElement("div");
    stage.className = "cqr-image-export-stage";
    stage.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "inset:0",
      "overflow:hidden",
      "background:#ffffff",
      "pointer-events:none"
    ].join(";");

    const root = document.createElement("div");
    root.className = "cqr-image-export-root";
    root.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:0",
      `width:${width}px`,
      "box-sizing:border-box",
      "padding:42px 52px",
      "background:#ffffff",
      "color:#111827",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif",
      "line-height:1.5",
      "transform:translateX(-50%)"
    ].join(";");

    const title = document.createElement("div");
    title.style.cssText = [
      "margin:0 0 8px",
      "font-size:26px",
      "font-weight:700",
      "line-height:1.25",
      "color:#111827"
    ].join(";");
    title.textContent = "ChatGPT Conversation Export";

    const meta = document.createElement("div");
    meta.style.cssText = [
      "margin:0 0 30px",
      "font-size:14px",
      "line-height:1.7",
      "color:#64748b"
    ].join(";");
    meta.textContent = `导出时间：${new Date().toLocaleString()} · 已选消息：${messages.length}`;

    const list = document.createElement("div");
    list.style.cssText = [
      "display:grid",
      "gap:26px",
      "width:100%"
    ].join(";");

    messages.forEach((message) => {
      list.append(cloneMessageForImageExport(message));
    });

    root.append(title, meta, list);
    stage.append(root);
    document.documentElement.append(stage);

    return {
      stage,
      root,
      width
    };
  }

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Failed to encode PNG"));
      }, "image/png");
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.documentElement.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function requestVisibleTabCapture() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: "capture-visible-tab"
      }, (response) => {
        if (chrome.runtime.lastError || !response?.ok || !response.url) {
          reject(new Error(chrome.runtime.lastError?.message || response?.error || "Failed to capture tab"));
          return;
        }

        resolve(response.url);
      });
    });
  }

  async function captureVisibleTabPng() {
    let lastError = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await requestVisibleTabCapture();
      } catch (error) {
        lastError = error;
        if (!/capture|quota|rate|activeTab|permission|invoked|visible/i.test(error?.message || "")) {
          break;
        }
        await delay(900 + attempt * 400);
      }
    }

    throw lastError || new Error("Failed to capture tab");
  }

  async function renderMessagesToPngBlob(messages) {
    const exportDocument = createImageExportDocument(messages);

    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const width = Math.ceil(exportDocument.width);
      const height = Math.ceil(exportDocument.root.scrollHeight);
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const viewportHeight = window.innerHeight;
      const rootLeft = Math.round((window.innerWidth - width) / 2);

      if (height * scale > 30000) {
        throw new Error("Image export is too tall");
      }

      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      for (let offset = 0; offset < height; offset += viewportHeight) {
        const segmentHeight = Math.min(viewportHeight, height - offset);
        exportDocument.root.style.transform = `translateX(-50%) translateY(-${offset}px)`;

        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const captureUrl = await captureVisibleTabPng();
        const image = await loadImageFromUrl(captureUrl);
        const imageScale = image.width / window.innerWidth;

        ctx.drawImage(
          image,
          rootLeft * imageScale,
          0,
          width * imageScale,
          segmentHeight * imageScale,
          0,
          offset,
          width,
          segmentHeight
        );

        if (offset + viewportHeight < height) {
          await delay(650);
        }
      }

      return canvasToPngBlob(canvas);
    } finally {
      exportDocument.stage.remove();
    }
  }

  async function handleExportImage() {
    if (exportMode === "questions") {
      showToast("问题导出仅支持 Markdown；切换到对话可导出图片。", true);
      return;
    }

    const messages = getSelectedMessages();
    if (messages.length === 0) {
      showToast("请先选择要导出的对话", true);
      return;
    }

    let blob = null;
    try {
      showToast("正在导出图片...");
      blob = await renderMessagesToPngBlob(messages);
    } catch (error) {
      console.error("Failed to render PNG", error);
      const message = error?.message === "Image export is too tall"
        ? "图片过长，请少选几条消息后再导出"
        : `导出图片失败：${error?.message || "请稍后重试"}`;
      showToast(message, true);
      return;
    }

    downloadBlob(blob, `chatgpt-conversation-${currentTimestampForFile()}.png`);
    showToast("已导出图片");
  }

  function renderExportPanel() {
    if (!directory) return;

    const exportQuestions = getExportQuestions();
    const messages = getLoadedMessages();
    syncQuestionExportSelection(exportQuestions);
    syncExportSelection(messages);

    const panel = document.createElement("div");
    panel.className = "cqr-export-panel";

    const modeSwitcher = document.createElement("div");
    modeSwitcher.className = "cqr-export-mode";

    [
      ["questions", "问题"],
      ["messages", "对话"]
    ].forEach(([mode, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cqr-export-mode-button";
      button.textContent = label;
      button.setAttribute("aria-selected", String(exportMode === mode));
      button.addEventListener("click", () => {
        exportMode = mode;
        renderDirectory();
      });
      modeSwitcher.append(button);
    });

    const status = document.createElement("div");
    status.className = "cqr-export-status";

    const statusText = document.createElement("span");
    statusText.className = "cqr-export-status-text";
    statusText.textContent = exportMode === "questions"
      ? `问题索引：已识别 ${exportQuestions.length} 个问题，可导出全部已记录问题。`
      : `对话消息：当前已加载 ${messages.length} 条消息，PDF 和图片只导出已加载内容。`;

    const captureButton = document.createElement("button");
    captureButton.type = "button";
    captureButton.className = "cqr-export-mini-button cqr-export-scan-button";
    captureButton.textContent = isCapturingFullConversation ? "取消深度采集" : "深度采集";
    captureButton.addEventListener("click", captureFullConversation);

    status.append(statusText, captureButton);

    const selectionActions = document.createElement("div");
    selectionActions.className = "cqr-export-actions";

    const selectAllButton = document.createElement("button");
    selectAllButton.type = "button";
    selectAllButton.className = "cqr-export-mini-button";
    selectAllButton.textContent = "全选";
    selectAllButton.addEventListener("click", () => {
      if (exportMode === "questions") {
        selectedQuestionKeys = new Set(exportQuestions.map(getQuestionExportKey));
      } else {
        selectedMessageKeys = new Set(messages.map((message) => message.key));
      }
      renderDirectory();
    });

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "cqr-export-mini-button";
    clearButton.textContent = "清空";
    clearButton.addEventListener("click", () => {
      if (exportMode === "questions") {
        selectedQuestionKeys.clear();
      } else {
        selectedMessageKeys.clear();
      }
      renderDirectory();
    });

    selectionActions.append(selectAllButton, clearButton);

    const selectionList = document.createElement("div");
    selectionList.className = "cqr-export-list";

    if (exportMode === "questions") {
      exportQuestions.forEach((question, index) => {
        const key = getQuestionExportKey(question);
        const label = document.createElement("label");
        label.className = "cqr-export-choice";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selectedQuestionKeys.has(key);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            selectedQuestionKeys.add(key);
          } else {
            selectedQuestionKeys.delete(key);
          }
        });

        const role = document.createElement("span");
        role.className = "cqr-export-role";
        role.textContent = `问题 ${index + 1}`;

        const text = document.createElement("span");
        text.className = "cqr-export-text";
        text.textContent = question.text;

        label.append(checkbox, role, text);
        selectionList.append(label);
      });
    } else {
      messages.forEach((message) => {
        const label = document.createElement("label");
        label.className = "cqr-export-choice";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selectedMessageKeys.has(message.key);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            selectedMessageKeys.add(message.key);
          } else {
            selectedMessageKeys.delete(message.key);
          }
        });

        const role = document.createElement("span");
        role.className = "cqr-export-role";
        role.textContent = `${roleHeading(message.role)} ${message.index + 1}`;

        const text = document.createElement("span");
        text.className = "cqr-export-text";
        text.textContent = message.text;

        label.append(checkbox, role, text);
        selectionList.append(label);
      });
    }

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "cqr-export-button";
    copyButton.textContent = "复制 Markdown";
    copyButton.addEventListener("click", copyMarkdown);

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "cqr-export-button";
    downloadButton.textContent = "导出 Markdown";
    downloadButton.addEventListener("click", downloadMarkdown);

    const pdfButton = document.createElement("button");
    pdfButton.type = "button";
    pdfButton.className = "cqr-export-button";
    pdfButton.textContent = "导出 PDF";
    pdfButton.disabled = exportMode === "questions";
    if (pdfButton.disabled) pdfButton.title = "问题导出仅支持 Markdown；切换到对话可导出 PDF。";
    pdfButton.addEventListener("click", handleExportPdf);

    const imageButton = document.createElement("button");
    imageButton.type = "button";
    imageButton.className = "cqr-export-button";
    imageButton.textContent = "导出图片";
    imageButton.disabled = exportMode === "questions";
    if (imageButton.disabled) imageButton.title = "问题导出仅支持 Markdown；切换到对话可导出图片。";
    imageButton.addEventListener("click", handleExportImage);

    const exportButtonGrid = document.createElement("div");
    exportButtonGrid.className = "cqr-export-button-grid";
    exportButtonGrid.append(copyButton, downloadButton, pdfButton, imageButton);

    panel.append(modeSwitcher, status, selectionActions, selectionList, exportButtonGrid, createReportIssueEntry());
    directory.append(panel);
  }

  function scheduleRender() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      scanLoadedUserQuestions();
      updateActiveDot();
    }, 180);
  }

  function initFormulaCopyFallback() {
    if (window.__CQRFormulaCopyPrimaryReady) return;
    if (window.__CQRFormulaCopyFallbackReady) return;
    window.__CQRFormulaCopyFallbackReady = true;

    let toolbar = null;
    let menu = null;
    let activeFormula = null;
    let hideTimer = null;

    function findFormulaElement(target) {
      if (!(target instanceof Element)) return null;
      return target.closest(".katex-display")
        || target.closest(".katex")
        || target.closest("math");
    }

    function extractLatex(root) {
      const selectionText = window.getSelection?.().toString().trim() || "";
      const annotation = root?.querySelector?.("annotation[encoding='application/x-tex']")
        || root?.closest?.(".katex-display, .katex")?.querySelector?.("annotation[encoding='application/x-tex']");
      const latex = annotation?.textContent?.trim()
        || root?.getAttribute?.("data-math")?.trim()
        || root?.getAttribute?.("aria-label")?.trim()
        || selectionText
        || root?.textContent?.trim()
        || "";

      return {
        latex,
        display: Boolean(root?.closest?.(".katex-display") || root?.matches?.(".katex-display"))
      };
    }

    function stripDelimiters(latex) {
      return String(latex || "")
        .trim()
        .replace(/^\\\[\s*([\s\S]*?)\s*\\\]$/, "$1")
        .replace(/^\\\(\s*([\s\S]*?)\s*\\\)$/, "$1")
        .replace(/^\$\$\s*([\s\S]*?)\s*\$\$$/, "$1")
        .replace(/^\$\s*([\s\S]*?)\s*\$$/, "$1")
        .trim();
    }

    function markdownLatex(formula) {
      const body = stripDelimiters(formula.latex);
      return formula.display ? `\\[\n${body}\n\\]` : `\\( ${body} \\)`;
    }

    function wpsLatex(formula) {
      if (window.CQRFormulaClipboard?.formatForWpsLatex) {
        return window.CQRFormulaClipboard.formatForWpsLatex(formula?.latex);
      }

      return stripDelimiters(formula?.latex);
    }

    function showFormulaToast(message, isError = false) {
      const toast = document.createElement("div");
      toast.textContent = message;
      toast.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "top:24px",
        "right:52px",
        "max-width:360px",
        "padding:9px 12px",
        "border-radius:8px",
        "box-shadow:0 12px 30px rgba(15,23,42,.18)",
        `background:${isError ? "#fef2f2" : "#f0fdf4"}`,
        `color:${isError ? "#991b1b" : "#166534"}`,
        `border:1px solid ${isError ? "rgba(239,68,68,.34)" : "rgba(34,197,94,.34)"}`,
        "font:13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
      ].join(";");
      document.body.append(toast);
      window.setTimeout(() => toast.remove(), 2400);
    }

    function ensureToolbar() {
      if (toolbar) return;

      toolbar = document.createElement("div");
      toolbar.id = "cqr-formula-copy-toolbar-fallback";
      toolbar.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "display:none",
        "gap:4px",
        "padding:6px",
        "border:1px solid rgba(37,99,235,.42)",
        "border-radius:10px",
        "background:rgba(255,255,255,.98)",
        "box-shadow:0 10px 30px rgba(15,23,42,.28)",
        "font:12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
      ].join(";");

      const main = document.createElement("button");
      main.type = "button";
      main.textContent = "复制公式";
      main.style.cssText = "padding:6px 10px;border:0;border-radius:7px;background:#eff6ff;color:#1e3a8a;cursor:pointer;font-weight:700;";
      main.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        menu.style.display = menu.style.display === "grid" ? "none" : "grid";
      });

      menu = document.createElement("div");
      menu.style.cssText = "display:none;gap:3px;margin-top:4px;padding-top:4px;border-top:1px solid rgba(148,163,184,.35);";

      [
        ["Markdown LaTeX", () => markdownLatex(activeFormula)],
        ["WPS LaTeX", () => wpsLatex(activeFormula)]
      ].forEach(([label, getter]) => {
        const item = document.createElement("button");
        item.type = "button";
        item.textContent = label;
        item.style.cssText = "padding:6px 10px;border:0;border-radius:7px;background:transparent;color:#111827;cursor:pointer;text-align:left;";
        item.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const text = getter();
          if (!text) {
            showFormulaToast("未识别到可靠 LaTeX 源码", true);
            return;
          }
          await navigator.clipboard.writeText(text);
          showFormulaToast(`已复制 ${label}`);
          hideToolbar();
        });
        menu.append(item);
      });

      toolbar.append(main, menu);
      toolbar.addEventListener("mouseenter", () => window.clearTimeout(hideTimer));
      toolbar.addEventListener("mouseleave", scheduleHide);
      document.body.append(toolbar);
    }

    function showToolbar(rect, formula) {
      ensureToolbar();
      activeFormula = formula;
      toolbar.style.display = "grid";
      menu.style.display = "none";
      const top = Math.min(
        window.innerHeight - toolbar.offsetHeight - 8,
        Math.max(8, rect.top + rect.height / 2 - toolbar.offsetHeight / 2)
      );
      const preferredLeft = rect.right + 10;
      const left = preferredLeft + toolbar.offsetWidth <= window.innerWidth - 8
        ? preferredLeft
        : Math.max(8, rect.left - toolbar.offsetWidth - 10);
      toolbar.style.top = `${Math.round(top)}px`;
      toolbar.style.left = `${Math.round(left)}px`;
      console.log("[FormulaCopy] toolbar shown");
    }

    function hideToolbar() {
      if (toolbar) toolbar.style.display = "none";
      if (menu) menu.style.display = "none";
      activeFormula = null;
    }

    function scheduleHide() {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hideToolbar, 300);
    }

    document.addEventListener("pointermove", (event) => {
      if (toolbar?.contains(event.target)) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const root = findFormulaElement(target);
      if (!root) return;
      const formula = extractLatex(root);
      console.log("[FormulaCopy] formula detected", formula);
      showToolbar(root.getBoundingClientRect(), formula);
    }, true);

    document.addEventListener("mouseup", () => {
      window.setTimeout(() => {
        const selection = window.getSelection?.();
        const text = selection?.toString().trim() || "";
        if (!text) return;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) return;
        if (!/[=+\-*/^_{}×÷±]|\\[a-zA-Z]+|cos|sin|tan|θ|π|λ|Gain|Bias|DN/.test(text)) return;
        console.log("[FormulaCopy] formula detected", { latex: text, source: "selection" });
        showToolbar(rect, { latex: text, display: /\n/.test(text) });
      }, 30);
    }, true);

    console.log("[FormulaCopy] initialized");
  }

  function boot() {
    ensureRail();
    loadQuestionCacheForCurrentConversation();
    window.initFormulaCopy?.();
    initFormulaCopyFallback();

    observer = new MutationObserver((mutations) => {
      const hasExternalMutation = mutations.some((mutation) => {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;
        if (target?.closest?.(`#${APP_ID}`)) return false;
        const addedExternal = Array.from(mutation.addedNodes || []).some((node) => {
          const element = node instanceof Element ? node : node?.parentElement;
          return !element?.closest?.(`#${APP_ID}`);
        });
        const removedExternal = Array.from(mutation.removedNodes || []).some((node) => {
          const element = node instanceof Element ? node : node?.parentElement;
          return !element?.closest?.(`#${APP_ID}`);
        });
        if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
          return addedExternal || removedExternal;
        }
        return true;
      });
      if (hasExternalMutation) scheduleQuestionScan(520);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener("scroll", scheduleScrollWork, { passive: true, capture: true });
    window.addEventListener("resize", updateActiveDot);

    urlTimer = window.setInterval(() => {
      if (location.href === lastLocationHref) return;
      lastLocationHref = location.href;
      loadQuestionCacheForCurrentConversation();
    }, 800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
