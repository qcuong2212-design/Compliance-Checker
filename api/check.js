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

export default async function handler(req, res) {
  // Chỉ cho phép POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Server chưa cấu hình GEMINI_API_KEY. Liên hệ quản trị viên."
    });
  }

  const { prompt, model } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Thiếu nội dung prompt" });
  }

  // Whitelist model được phép gọi — tránh client tự ý gọi model đắt tiền không kiểm soát
  const ALLOWED_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];
  const selectedModel = ALLOWED_MODELS.includes(model) ? model : "gemini-2.5-flash-lite";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: maskPII(prompt) }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 6000
        }
      }),
      signal: AbortSignal.timeout(110000)
    });

    const data = await upstream.json();

    // Forward y nguyên status code + body để frontend tự xử lý retry/429/503
    return res.status(upstream.status).json(data);

  } catch (e) {
    return res.status(502).json({
      error: { message: `Lỗi gọi Gemini từ server: ${e.message}` }
    });
  }
}
