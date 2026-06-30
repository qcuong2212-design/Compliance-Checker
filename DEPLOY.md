# Hướng dẫn Deploy VTG Compliance Checker lên Vercel

## Cấu trúc project

```
vtg-checker/
├── api/
│   ├── check.js     ← Backend: gọi Gemini, giữ API key an toàn
│   └── ping.js       ← Backend: kiểm tra server đã sẵn sàng chưa
├── public/
│   └── index.html    ← Frontend: giao diện người dùng, KHÔNG chứa key
├── vercel.json
└── .gitignore
```

**Nguyên tắc:** API key chỉ tồn tại trên server (qua Environment Variable), không bao giờ
xuất hiện trong code phía client. Người dùng mở `index.html` chỉ thấy giao diện,
không có chỗ nào nhập hoặc nhìn thấy key.

---

## Bước 1 — Đẩy code lên GitHub

```bash
cd vtg-checker
git init
git add .
git commit -m "VTG Compliance Checker - initial"
```

Tạo repo mới trên GitHub (private hoặc public đều được), sau đó:

```bash
git remote add origin https://github.com/<tên-anh>/vtg-checker.git
git branch -M main
git push -u origin main
```

---

## Bước 2 — Import vào Vercel

1. Vào https://vercel.com/new
2. Chọn **Import Git Repository** → chọn repo `vtg-checker` vừa tạo
3. Ở phần **Configure Project**, để nguyên mặc định (Vercel tự nhận diện `vercel.json`)
4. **Chưa bấm Deploy ngay** — chuyển sang bước 3 để thêm API key trước

---

## Bước 3 — Thêm Environment Variable (QUAN TRỌNG NHẤT)

Trong màn hình Configure Project (hoặc vào **Settings → Environment Variables** sau khi đã tạo project):

| Name | Value | Environment |
|---|---|---|
| `GEMINI_API_KEY` | `AIza...` (key thật của anh, lấy tại https://aistudio.google.com/app/apikey) | Production, Preview, Development (chọn cả 3) |

Bấm **Save**.

> ⚠️ Đây là bước duy nhất chứa key thật. Key này KHÔNG nằm trong code, KHÔNG bị đẩy lên
> GitHub, chỉ tồn tại trong hệ thống quản lý biến môi trường của Vercel.

---

## Bước 4 — Deploy

Bấm **Deploy**. Sau ~30-60 giây, Vercel trả về 1 URL dạng:

```
https://vtg-checker-xxxx.vercel.app
```

Gửi URL này cho nhân viên VTG — ai có link là dùng được ngay, không cần đăng nhập,
không cần nhập key.

---

## Bước 5 — Kiểm tra hoạt động

1. Mở URL vừa deploy
2. Bấm **"Kiểm tra kết nối hệ thống"** ở Bước 2 trên giao diện
3. Nếu hiện **"Hệ thống sẵn sàng ✓"** màu xanh → đã hoạt động đúng
4. Nếu hiện lỗi **"Server chưa cấu hình key"** → quay lại Bước 3, kiểm tra đã lưu đúng `GEMINI_API_KEY` chưa, sau đó vào tab **Deployments** → bấm **Redeploy** (biến môi trường mới chỉ áp dụng cho lần deploy sau khi thêm)

---

## Cập nhật code sau này

Mỗi khi anh sửa file (`index.html`, `check.js`...), chỉ cần:

```bash
git add .
git commit -m "Mô tả thay đổi"
git push
```

Vercel tự động deploy lại bản mới trong vài chục giây, không cần làm lại từ đầu.

---

## Chi phí thực tế dự kiến

| Hạng mục | Free tier | Khi vượt |
|---|---|---|
| Vercel hosting | 100GB bandwidth/tháng, không giới hạn deploy | ~$20/tháng (Pro) — khó xảy ra với quy mô nội bộ |
| Gemini 2.5 Flash | 15 request/phút, 1.500 request/ngày | ~$0.075 / 1M token input — vài USD/tháng nếu dùng nhiều |

Với quy mô vài chục đến vài trăm nhân viên dùng không liên tục, khả năng cao
**không tốn phí Vercel**, chỉ có thể phát sinh phí Gemini nhỏ nếu vượt free tier.

---

## Giới hạn cần lưu ý (đã xử lý trong code)

- Backend đã giới hạn (`whitelist`) chỉ cho phép 3 model: `gemini-2.5-flash`,
  `gemini-2.0-flash`, `gemini-2.5-pro` — tránh client gọi model lạ ngoài kiểm soát
- Mỗi serverless function có timeout 110 giây (`AbortSignal.timeout`) — phù hợp với
  giới hạn 60s mặc định của Vercel Hobby plan và buffer an toàn cho Pro plan
- Nếu lượng truy cập tăng cao và lo ngại chi phí Gemini, có thể bổ sung thêm rate
  limiting theo IP ở `api/check.js` — báo tôi nếu cần triển khai phần này
