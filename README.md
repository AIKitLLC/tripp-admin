# Tripp Tarot & Chat Service (Admin Portal)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AIKitLLC/tripp-admin)

**Tripp Admin** là nền tảng quản trị dịch vụ và giao diện trải bài Tarot AI tiếng Việt, được xây dựng trên kiến trúc **Cloudflare Serverless Edge** dựa trên template [cloudflare-admin-template](https://github.com/AIKitLLC/cloudflare-admin-template).

Dự án kết hợp giữa **Payload CMS v3**, **Next.js (App Router)**, **Cloudflare D1 (SQLite)**, **Cloudflare R2**, và **Cloudflare Workers AI**.

---

## 🌟 Tính năng nổi bật

### 1. Dịch vụ Trải bài & Đối thoại Tarot (`/` và `/api/tripp/*`)
- **Bộ bài chuẩn 78 lá (Rider–Waite–Smith adaptation):** 22 lá Ẩn chính (Major Arcana) và 56 lá Ẩn phụ (Minor Arcana) với đầy đủ biểu tượng, ký tự glyph, nghĩa thuận và nghĩa ngược tiếng Việt / tiếng Anh.
- **6 Kiểu trải bài đa dạng:**
  - *Thông điệp hôm nay (Daily - 1 lá)*
  - *Trải ba lá (Three-card spread - 3 lá: Quá khứ, Hiện tại, Bước tới)*
  - *Tarot tình cảm (Love - 3 lá)*
  - *Tarot công việc & tiền bạc (Money - 3 lá)*
  - *Câu hỏi rõ - Yes / No (1 lá)*
  - *Trải bài theo năm (Yearly - 12 lá)*
- **Xáo bài ngẫu nhiên chuẩn mật mã:** Thuật toán Fisher–Yates với `crypto.getRandomValues()` loại bỏ thiên lệch modulo.
- **Hội thoại phản tư:** Đối thoại nhiều lượt theo dõi tâm lý và nguồn lực của người dùng thay vì bói toán mê tín.

### 2. Cổng Quản trị Dịch vụ Đầy Đủ (`/admin`)
Hệ thống quản trị Payload CMS v3 hiện đại chạy trực tiếp trên Cloudflare D1:
- **`Cards` (78 Lá Bài):** Biên tập ý nghĩa, biểu tượng, hình ảnh R2 cho từng lá bài.
- **`Spreads` (Kiểu Trải Bài):** Quản lý định nghĩa vị trí, số lượng lá và mô tả các kiểu trải.
- **`ContextFlows` (Cấu hình AI):** Quản lý pipeline prompt, tone giọng (warm, concise, supportive), độ sâu (brief, balanced, deep) và chỉ dẫn chất lượng của AI.
- **`ReadingSessions` (Nhật ký Phiên):** Theo dõi lịch sử người dùng trải bài, câu hỏi, lá bài đã rút, lượng token tiêu thụ và mô hình AI xử lý.
- **`AuditLogs` (Kiểm toán Hệ thống):** Ghi nhật ký mọi hành động của quản trị viên (chỉnh sửa lá bài, cập nhật flow, v.v.).
- **`Users` (Quản lý Phân quyền):** Phân chia vai trò `owner`, `admin`, `editor`, `viewer`.

---

## ⚡ Tech Stack

- **Framework:** [Payload CMS v3](https://payloadcms.com) (Code-first, type-safe headless CMS & admin engine)
- **Frontend / SSR:** [Next.js](https://nextjs.org) (App Router, React 19)
- **Runtime:** [Cloudflare Workers](https://workers.cloudflare.com) via [@opennextjs/cloudflare](https://opennext.js.org/cloudflare)
- **Database:** [Cloudflare D1](https://developers.cloudflare.com/d1/) (Serverless distributed SQLite with `@payloadcms/db-d1-sqlite`)
- **Storage:** [Cloudflare R2](https://developers.cloudflare.com/r2/) (`@payloadcms/storage-r2`)
- **AI Inference:** [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) (`@cf/qwen/qwen3-30b-a3b-fp8`)

---

## 🚀 Hướng dẫn Cài đặt & Chạy Local

### 1. Cài đặt Dependencies

```bash
git clone https://github.com/AIKitLLC/tripp-admin.git
cd tripp-admin
pnpm install
```

### 2. Cấu hình Môi trường

Local đọc `PAYLOAD_SECRET` và `OWNER_EMAIL` từ `.dev.vars` (Wrangler không commit file này):

```bash
cp .dev.vars.example .dev.vars
```

Giá trị trong `.dev.vars.example` chỉ dùng cho máy local. Production từ chối secret thiếu, là placeholder, hoặc ngắn hơn 32 ký tự.

`OWNER_EMAIL` là email cấu hình sẵn, không commit. User tạo với đúng email đó (không phân biệt hoa thường, đã trim) nhận vai trò `owner`. Đăng ký công khai và form user đầu tiên không tạo `owner` hoặc `admin`; mọi tài khoản tự tạo khác là `viewer`. Nếu production thiếu `OWNER_EMAIL`, app vẫn chạy, không tạo owner, và ghi log.

### 3. Chạy Development Server

Đăng nhập Wrangler (nếu chưa):
```bash
pnpm wrangler login
```

Khởi chạy local (Wrangler sẽ giả lập D1 và R2 local):
```bash
pnpm dev
```

- **Giao diện Trải bài:** [http://localhost:3000](http://localhost:3000)
- **Cổng Quản trị Admin:** [http://localhost:3000/admin](http://localhost:3000/admin)

### 4. Khởi tạo Dữ liệu Ban đầu (Seed Cards & Spreads)

Tài khoản `owner` là user được tạo với đúng `OWNER_EMAIL`. Owner đó tạo `admin`. Đăng nhập Payload rồi gọi seed. Endpoint từ chối khách (401) và tài khoản `editor` / `viewer` (403). Gọi lại không tạo thêm bản ghi nếu Cards hoặc Spreads đã có dữ liệu. Production vẫn bật route này: lần nạp đầu cho D1 trống dùng cùng đường đó, sau khi owner đã tạo admin. Không thêm cờ env riêng.

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"your-password"}'

curl -X POST http://localhost:3000/api/tripp/seed \
  -H "Authorization: JWT <token>"
```

---

## 📡 API Endpoints

| Endpoint | Method | Mô tả |
| :--- | :--- | :--- |
| `/api/tripp/reading` | `POST` | Bốc bài và nhận phân tích trải bài ban đầu |
| `/api/tripp/chat` | `POST` | Gửi câu hỏi đối thoại tiếp theo trong phiên |
| `/api/tripp/cards` | `GET` | Danh sách 78 lá bài Tarot |
| `/api/tripp/spreads` | `GET` | Danh sách các kiểu trải bài |
| `/api/tripp/status` | `GET` | Trạng thái dịch vụ |
| `/api/tripp/seed` | `POST` | Nạp Cards và Spreads khi chưa có. Chỉ `owner` hoặc `admin`. |
| `/api/cards`, `/api/spreads`... | `GET/POST` | Auto-generated Payload CMS REST APIs |

---

## 🚢 Triển khai lên Cloudflare Workers

1. Tạo database D1:
```bash
pnpm wrangler d1 create tripp-admin
```

2. Tạo bucket R2:
```bash
pnpm wrangler r2 bucket create tripp-admin
```

3. Cập nhật `database_id` trong `wrangler.jsonc`.

4. Đặt `PAYLOAD_SECRET` **mới** trước khi deploy. Giá trị cũ nằm trong git history: coi như đã lộ, kể cả khi repo private, và phải xoay. Không viết lại git history.

```bash
openssl rand -base64 48
pnpm wrangler secret put PAYLOAD_SECRET
```

Dán giá trị mới khi Wrangler hỏi. Không dùng lại giá trị cũ. Xoay secret đăng xuất mọi phiên. `wrangler secret put` tạo version và deploy Worker ngay.

`pnpm run deploy:database` chạy migrate với `NODE_ENV=production`, nên process đó cũng cần `PAYLOAD_SECRET` hợp lệ trong environment (không commit). Secret trên Worker không tự có trong shell.

5. Đặt `OWNER_EMAIL`. Không commit email này. User tạo với đúng email đó trở thành owner; mọi đăng ký khác là viewer.

```bash
pnpm wrangler secret put OWNER_EMAIL
```

Đăng ký công khai vẫn mở. Ngay sau khi secret được đặt, tạo tài khoản với đúng email đó trước khi chia sẻ URL. Người đăng ký trùng email trước sẽ thành owner và chặn đăng ký sau (email là duy nhất). Đổi email của một viewer sang địa chỉ đó không cấp role owner, nhưng cũng chiếm địa chỉ và chặn đăng ký owner.

6. Chạy migration và deploy:
```bash
pnpm payload migrate:create
pnpm run deploy
```

---

## 📄 License

MIT © [AIKit LLC](https://github.com/AIKitLLC)
