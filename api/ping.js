// api/ping.js
// Trang web tự gọi endpoint này khi mở để biết hệ thống đã sẵn sàng chưa.
// Kiểm tra: (1) server có GEMINI_API_KEY; (2) khóa còn hợp lệ với Google (gọi danh sách model, không tốn token).
// Không bao giờ trả giá trị khóa ra ngoài.

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(200).json({ ready: false, reason: "no_key" });

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
      { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(8000) }
    );
    if (r.status === 400 || r.status === 401 || r.status === 403) {
      return res.status(200).json({ ready: false, reason: "bad_key" });
    }
    return res.status(200).json({ ready: true, verified: r.ok });
  } catch (e) {
    // Không liên lạc được Google trong 8s: vẫn coi là sẵn sàng, lỗi thật sẽ báo lúc chạy.
    return res.status(200).json({ ready: true, verified: false });
  }
}
