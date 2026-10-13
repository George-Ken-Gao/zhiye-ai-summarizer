// 页面元素集中管理，方便统一更新加载、错误与摘要状态。
const form = document.querySelector("#summary-form");
const urlInput = document.querySelector("#url-input");
const submitButton = document.querySelector("#submit-button");
const resultSection = document.querySelector("#result-section");
const statusCard = document.querySelector("#status-card");
const statusMessage = document.querySelector("#status-message");
const errorCard = document.querySelector("#error-card");
const errorMessage = document.querySelector("#error-message");
const summaryCard = document.querySelector("#summary-card");
const articleTitle = document.querySelector("#article-title");
const keyPointsList = document.querySelector("#key-points-list");
const detailedSummaryText = document.querySelector("#detailed-summary-text");
const sourceLine = document.querySelector("#source-line");

const FETCH_TIMEOUT_MS = 30_000;
const MAX_ARTICLE_LENGTH = 30_000;

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = validateUrl(urlInput.value);
  if (!url) {
    showError("请输入有效的网址，网址必须以 http:// 或 https:// 开头。");
    return;
  }

  if (typeof GEMINI_API_KEY !== "string" || !GEMINI_API_KEY.trim()) {
    showError("请先在 config.js 中填写自己的 Gemini API key，然后刷新页面。");
    return;
  }

  setLoading(true, "正在抓取网页…");
  try {
    const article = await fetchArticle(url);
    setLoading(true, "正在生成中文摘要…");
    const summary = await generateSummary(article);
    renderSummary(summary, article.title, url.href);
  } catch (error) {
    showError(error instanceof Error ? error.message : "发生了未知错误，请稍后重试。");
  } finally {
    setLoading(false);
  }
});

// 仅允许常见网页协议，避免将非网页地址交给代理请求。
function validateUrl(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// 为网络请求设置超时，并将无法访问的情况转成用户可读的中文提示。
async function fetchWithTimeout(resource, options, errorMessage) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(resource, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("请求超时了，请检查网络后重试。");
    }
    throw new Error(errorMessage);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// 通过 AllOrigins 获取网页 HTML，并从语义化正文区域提取可读文本。
async function fetchArticle(url) {
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url.href)}`;
  let response;
  try {
    response = await fetchWithTimeout(
      proxyUrl,
      {},
      "无法连接网页抓取服务，请稍后重试。"
    );
  } catch (error) {
    throw new Error(`网页抓取失败：${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`网页无法打开（HTTP ${response.status}），请确认网址有效或稍后重试。`);
  }

  const html = await response.text();
  if (!html.trim()) {
    throw new Error("网页没有返回内容，请确认网址有效。");
  }

  const documentFromPage = new DOMParser().parseFromString(html, "text/html");
  const title = documentFromPage.querySelector("title")?.textContent?.trim()
    || documentFromPage.querySelector("h1")?.textContent?.trim()
    || url.hostname;

  documentFromPage.querySelectorAll(
    "script, style, noscript, nav, header, footer, aside, form, iframe, svg"
  ).forEach((element) => element.remove());

  const contentRoot = documentFromPage.querySelector("article, main") || documentFromPage.body;
  const text = contentRoot?.innerText || contentRoot?.textContent || "";
  const articleText = text.replace(/\s+/g, " ").trim();

  if (articleText.length < 80) {
    throw new Error("没有从网页中提取到足够的正文内容，可能是页面需要登录或由脚本动态加载。");
  }

  return {
    title,
    text: articleText.slice(0, MAX_ARTICLE_LENGTH),
  };
}

// 请求 Gemini 输出结构化 JSON，以便将要点与详细摘要分别呈现。
async function generateSummary(article) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(GEMINI_API_KEY.trim())}`;
  const prompt = [
    "请根据以下网页正文生成简体中文摘要。",
    "要求：keyPoints 必须恰好包含 3 条简明核心要点；detailedSummary 写一段约 200 个汉字的详细摘要。",
    "忠实于原文，不要臆造信息。只返回 JSON 对象，包含 keyPoints（字符串数组）和 detailedSummary（字符串）。",
    `文章标题：${article.title}`,
    `网页正文：${article.text}`,
  ].join("\n\n");

  let response;
  try {
    response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
      "无法连接 Gemini API，请检查网络后重试。"
    );
  } catch (error) {
    throw new Error(`摘要生成失败：${error.message}`);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const apiMessage = payload?.error?.message;
    if (response.status === 400 || response.status === 403 || response.status === 404) {
      throw new Error(`Gemini API 请求失败：${apiMessage || "请检查 API key、模型名称和 API 是否已启用。"}`);
    }
    throw new Error(`Gemini API 暂时不可用（HTTP ${response.status}）：${apiMessage || "请稍后重试。"}`);
  }

  const responseText = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!responseText) {
    throw new Error("Gemini 没有返回摘要内容，请稍后重试。");
  }

  let summary;
  try {
    summary = JSON.parse(responseText);
  } catch {
    throw new Error("Gemini 返回的摘要格式无法识别，请再试一次。");
  }

  if (
    !Array.isArray(summary.keyPoints)
    || summary.keyPoints.length !== 3
    || summary.keyPoints.some((point) => typeof point !== "string" || !point.trim())
    || typeof summary.detailedSummary !== "string"
    || !summary.detailedSummary.trim()
  ) {
    throw new Error("摘要内容格式不完整，请再试一次。");
  }

  return summary;
}

// 使用 textContent 写入模型输出，避免把网页或模型内容当作 HTML 执行。
function renderSummary(summary, title, sourceUrl) {
  articleTitle.textContent = title;
  keyPointsList.replaceChildren(
    ...summary.keyPoints.map((point) => {
      const item = document.createElement("li");
      item.textContent = point.trim();
      return item;
    })
  );
  detailedSummaryText.textContent = summary.detailedSummary.trim();
  sourceLine.textContent = `来源：${sourceUrl}`;

  statusCard.hidden = true;
  errorCard.hidden = true;
  summaryCard.hidden = false;
  resultSection.setAttribute("aria-busy", "false");
}

function setLoading(isLoading, message = "") {
  submitButton.disabled = isLoading;
  submitButton.querySelector("span").textContent = isLoading ? "请稍候" : "生成摘要";
  statusMessage.textContent = message;
  statusCard.hidden = !isLoading;
  errorCard.hidden = true;
  if (isLoading) {
    summaryCard.hidden = true;
  }
  resultSection.setAttribute("aria-busy", String(isLoading));
}

function showError(message) {
  statusCard.hidden = true;
  summaryCard.hidden = true;
  errorMessage.textContent = message;
  errorCard.hidden = false;
  resultSection.setAttribute("aria-busy", "false");
}
