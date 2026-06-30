// api/ping.js
// Endpoint kiểm tra nhanh: server đã có GEMINI_API_KEY chưa, không lộ giá trị key.

export default async function handler(req, res) {
  const hasKey = !!process.env.GEMINI_API_KEY;
  return res.status(200).json({ ready: hasKey });
}
