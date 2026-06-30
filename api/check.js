// api/check.js
// Backend serverless function — giữ Gemini API key an toàn, không lộ ra client.
// Frontend gọi POST /api/check, backend này forward sang Gemini và trả kết quả về.

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
  const ALLOWED_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];
  const selectedModel = ALLOWED_MODELS.includes(model) ? model : "gemini-2.5-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096
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
