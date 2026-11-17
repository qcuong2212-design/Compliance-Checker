// api/check.js
// Backend serverless function — giữ Gemini API key an toàn, không lộ ra client.
// Frontend gọi POST /api/check, backend này forward sang Gemini và trả kết quả về.


// Lớp che dự phòng phía server: dù trình duyệt đã che, server che thêm một lần
// trước khi gửi sang Gemini (email, số điện thoại, số định danh dài, IP, mật khẩu/khóa).
function maskPII(t) {
  return t
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .replace(/((?:mật\s*khẩu|password|passwd|pwd|api[\s_-]?key|secret|token)\s*[:=]\s*)(\S+)/gi, "$1[BÍ MẬT]")
    .replace(/\b(?:AIza[0-9A-Za-z_\-]{30,}|sk-[A-Za-z0-9_\-]{20,})\b/g, "[BÍ MẬT]")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "[IP]")
    .replace(/(^|[^\d])(\d{10}-\d{3})(?!\d)/g, "$1[SỐ ĐỊNH DANH]")
    .replace(/(^|[^\d])((?:\+?84|0)[\s.\-]?\d{2,3}[\s.\-]?\d{3}[\s.\-]?\d{3,4})(?!\d)/g, "$1[SĐT]")
    .replace(/(^|[^\d])(\d{9,19})(?!\d)/g, "$1[SỐ ĐỊNH DANH]");
}

// Giới hạn độ dài prompt (ký tự) — chặn gửi khối lượng lớn bất thường qua endpoint này.
const MAX_PROMPT_CHARS = 300000;

// Thông báo lỗi chung cho client; chi tiết thật chỉ ghi vào log của Vercel.
function clientMessage(status) {
  if (status === 400) return "Gemini từ chối yêu cầu (HTTP 400). Có thể nội dung quá dài hoặc không hợp lệ.";
  if (status === 401 || status === 403) return "Khóa AI của hệ thống không hợp lệ hoặc không có quyền. Báo quản trị viên.";
  if (status === 404) return "Mô hình AI không khả dụng. Chọn mô hình khác.";
  if (status === 429) return "Hệ thống đang quá tải hoặc hết hạn mức (HTTP 429).";
  if (status === 503) return "Hệ thống AI đang quá tải (HTTP 503).";
  return `Gemini trả lỗi (HTTP ${status}).`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Chỉ cho phép POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("check: thiếu biến môi trường GEMINI_API_KEY");
    return res.status(500).json({
      error: "Hệ thống chưa được cấu hình khóa AI. Liên hệ quản trị viên."
    });
  }

  const { prompt, model } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Thiếu nội dung prompt" });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return res.status(413).json({
      error: `Nội dung quá dài (${prompt.length} ký tự, tối đa ${MAX_PROMPT_CHARS}).`
    });
  }

  // Whitelist model được phép gọi — tránh client tự ý gọi model đắt tiền không kiểm soát
  const ALLOWED_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];
  const selectedModel = ALLOWED_MODELS.includes(model) ? model : "gemini-2.5-flash-lite";

  // Khóa đi qua header, không nằm trong URL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: maskPII(prompt) }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 6000
        }
      }),
      signal: AbortSignal.timeout(110000)
    });

    let data = null;
    try { data = await upstream.json(); } catch { data = null; }

    if (!upstream.ok) {
      // Giữ nguyên status code để frontend retry 429/503; không trả nguyên văn lỗi của Google
      console.error("check: Gemini trả lỗi", upstream.status, String(data?.error?.message || "").split(apiKey).join("[KEY]"));
      return res.status(upstream.status).json({
        error: { message: clientMessage(upstream.status) }
      });
    }

    return res.status(200).json(data || {});

  } catch (e) {
    console.error("check: lỗi gọi Gemini", String((e && e.message) || "").split(apiKey).join("[KEY]"));
    return res.status(502).json({
      error: { message: "Không kết nối được tới Gemini từ server. Thử lại sau." }
    });
  }
}
