# 知页 — AI 网页摘要

知页是一个纯前端网页摘要工具。输入文章网址后，它会尝试抓取网页正文，并调用 Gemini 生成简体中文摘要，帮助你快速了解文章重点。

## 功能

- 输入 `http://` 或 `https://` 开头的网页地址。
- 通过 [AllOrigins](https://api.allorigins.win) 免费代理获取网页 HTML，并提取文章正文。
- 调用 Gemini `gemini-3-flash-preview` 模型生成摘要。
- 分段展示 3 条核心要点和约 200 字的详细摘要。
- 提供抓取和生成状态提示，以及中文错误信息。
- 使用 HTML、CSS 和原生 JavaScript，无需安装前端依赖。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `index.html` | 页面结构 |
| `style.css` | 页面样式 |
| `app.js` | 网页抓取、摘要生成和页面交互逻辑 |
| `config.js` | 本地 Gemini API key 配置，不纳入 Git 版本控制 |

## 开始使用

1. 确保根目录有 `config.js`。如果克隆项目后没有此文件（它已被 `.gitignore` 排除），新建文件并写入：

   ```js
   // 请填入自己的 Gemini API key；不要提交此文件。
   const GEMINI_API_KEY = "";
   ```

2. 将自己的 Gemini API key 填入引号之间并保存。

3. 在浏览器中通过本地 HTTP 静态服务器打开项目。可以使用 VS Code 的 Live Server 扩展，或在项目目录运行：

   ```bash
   python -m http.server 8000
   ```

   然后访问 <http://localhost:8000>。建议使用本地 HTTP 服务，而不是直接用 `file://` 打开页面，以避免浏览器对本地文件网络请求的限制。

4. 在输入框中粘贴文章网址，点击“生成摘要”，等待结果显示。

## 注意事项

- **前端 API key 并不安全。** 浏览器端的 key 可被使用者查看，`.gitignore` 只能降低误提交风险，并不能隐藏已经填入的密钥。不要把包含真实 key 的 `config.js` 提交、发布或分享。若 key 曾经提交到仓库、公开发布或暴露给他人，请立即在对应控制台撤销并重新生成。面向公众部署时，应改由服务端安全保存和调用 API key。
- **网页内容会发送给第三方服务。** AllOrigins 代理会接收待抓取的网址；提取出的正文会发送给 Google Gemini 生成摘要。不要处理你无权分享或包含敏感信息的网页内容。
- **网页抓取有局限。** 需要登录、付费订阅、验证码或依赖 JavaScript 动态加载正文的页面，可能无法抓取；网页服务器、网络或代理服务也可能拒绝请求或超时。
- **正文长度有限。** 当前最多将 30,000 个字符的提取正文发送给 Gemini；不足以识别的正文会提示无法提取。
- **第三方服务受其自身条款和可用性限制。** AllOrigins 是公共免费代理，可能有访问限制或暂时不可用；Gemini API 的访问权限、配额及费用取决于你的 Google AI 服务配置。
- **摘要仅供参考。** 生成式 AI 可能遗漏细节或产生不准确表述，重要信息请以原文为准。

## 技术栈

- HTML
- CSS
- 原生 JavaScript
- AllOrigins 公共 CORS 代理
- Gemini API：`gemini-3-flash-preview`
