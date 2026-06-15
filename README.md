# 🚛 LogistiQ — Hệ Thống Quản Lý Kho Hàng & Vận Chuyển Thông Minh

> **Đồ án cuối kỳ — Môn Lập trình Web (INT1334)**  
> *Giải pháp chuyển đổi số toàn diện cho chuỗi cung ứng và vận tải logistics thời gian thực.*

---

## 🌟 Tổng Quan

**LogistiQ** là hệ thống quản lý logistics và kho bãi hiện đại, tích hợp **bản đồ MapCN (mapcn.dev)** thông minh và **định vị GPS thời gian thực** qua Socket.io. Hệ thống giúp doanh nghiệp tự động hóa quy trình quản lý lưu kho, giám sát hành trình di chuyển của đội xe, cảnh báo tồn kho an toàn và tối ưu hóa luồng công việc giữa các phòng ban (Quản trị viên, Quản lý kho, Nhân viên, Tài xế).

Hệ thống hỗ trợ **PWA (Progressive Web App)** — có thể cài đặt như ứng dụng di động, hoạt động **offline-first** với IndexedDB cache và hàng đợi đồng bộ tự động khi có mạng trở lại.

---

## 🎯 Tính Năng Cốt Lõi

### 1. 🗺️ Bản Đồ Giám Sát Hành Trình & GPS Thời Gian Thực
- **Bản đồ tương tác MapCN (mapcn.dev)**: Thư viện component map React hiện đại, built on top of MapLibre GL, styled với Tailwind CSS. Tự động chuyển đổi theme light/dark.
- **Định vị thời gian thực**: Xe tải được hiển thị trên bản đồ với cập nhật tọa độ qua **Socket.io**.
- **Bộ điều khiển bản đồ**: Zoom In/Out, Compass, Locate (định vị người dùng), Fullscreen.
- **Marker, Popup, Route, Cluster Layer**: Hệ thống component map đầy đủ với marker tùy chỉnh, popup, tooltip, route và cluster layer.

### 2. 🏢 Quản Lý Mạng Lưới Kho Phân Phối
- **Thống kê công suất kho**: Hiển thị thanh tiến trình sử dụng diện tích, tự động cảnh báo khi quá tải.
- **Phân khu kho (Zones)**: Quản lý các khu vực A, B, C trong kho, gán sản phẩm theo vị trí (rack, shelf).
- **Chi tiết kho thông minh**: Liệt kê sản phẩm lưu kho, thông tin quản lý, nhân viên phụ trách.

### 3. 📦 Kiểm Soát Tồn Kho & Cảnh Báo Hàng Tồn
- **Quản lý tồn kho theo lô/vị trí**: Theo dõi chính xác sản phẩm tại từng khu vực của kho hàng.
- **Cảnh báo tự động**: Hệ thống cảnh báo đỏ khi tồn kho dưới ngưỡng an toàn tối thiểu, kèm theo cấp độ (LOW / MEDIUM / HIGH / CRITICAL).
- **QR Code**: Tạo và quét QR code cho sản phẩm, hỗ trợ kiểm kho nhanh bằng camera.
- **Server Actions**: `createShipmentAction`, `createInventoryAction`, `updateInventoryAction` với `"use server"`.

### 4. 📈 Phân Tích Số Liệu & Báo Cáo
- **Dashboard động**: Thống kê tổng quan vận đơn, tồn kho, cảnh báo, warehouse.
- **Biểu đồ Donut & Bar**: Phân bổ vận đơn theo trạng thái, tỷ lệ giao thành công.
- **Xuất báo cáo**: Hỗ trợ xuất PDF (jsPDF + Noto Sans font) và Excel (ExcelJS) chuyên nghiệp.
- **Sparkline**: Biểu đồ xu hướng nhỏ gọn cho các KPI chính.

### 5. 🔐 Bảo Mật & Phân Quyền (NextAuth v5 + JWT)
- **RBAC (Role-Based Access Control)**: 4 vai trò — **Admin**, **Manager**, **Staff**, **Driver** với permissions riêng biệt.
- **JWT Token**: Access Token (15 phút) + Refresh Token (7 ngày), tự động refresh khi hết hạn.
- **Route Guard**: Bảo vệ cả client-side và server-side, chặn truy cập trái phép.
- **Rate Limiting**: Giới hạn số lần đăng nhập, refresh token, API requests theo IP.

### 6. 📱 PWA & Offline-First
- **Progressive Web App**: Có thể cài đặt lên màn hình chính điện thoại.
- **Service Worker**: `/sw.js` với scope "/", cache PWA icons, tự động cập nhật phiên bản mới.
- **IndexedDB Cache**: Cache shipments, inventory, warehouses, products, alerts để xem khi offline.
- **Mutation Queue**: Các thao tác checkpoint, cập nhật được xếp hàng đợi và tự động đồng bộ khi online.
- **Offline Banner**: Hiển thị trạng thái mạng, số lượng thao tác chờ đồng bộ.

### 7. 🚀 Chiến Lược Render (Rendering Strategy)
- **SSR (Server-Side Rendering)**: Dashboard (`force-dynamic`), Inventory Detail — dữ liệu luôn mới nhất.
- **ISR (Incremental Static Regeneration)**: Warehouse List (revalidate 60s), New Shipment/Inventory forms (revalidate 120s).
- **Server API Utility**: `ssrFetch()`, `isrFetch()`, `ssgFetch()` — wrapper linh hoạt cho các chiến lược caching.

### 8. 🧪 Kiểm Thử & CI/CD
- **Unit Testing**: Jest + ts-jest, 6+ test cases (JWT, token blacklist, rate limiter, email, auth password, response utility).
- **E2E Testing**: Playwright — kiểm thử luồng đăng nhập và điều hướng.
- **CI/CD Pipeline**: GitHub Actions — tự động test backend + build frontend trên mỗi push/PR.

---

## 🏗️ Kiến Trúc Hệ Thống

```mermaid
graph TD
    subgraph Frontend [Next.js 15 Client]
        UI[React Components - Dashboard, Map, Warehouse, Shipments]
        NextAuth[NextAuth.js v5 - JWT Session]
        Axios[Axios Interceptor - Token Inject, Refresh & SignOut Handler]
        SocketClient[Socket.io-client - GPS Listener]
        SW[Service Worker / PWA]
        IDB[IndexedDB - Offline Cache & Mutation Queue]
    end

    Frontend -->|HTTP + Bearer Token| Backend
    Frontend -->|WebSocket| SocketServer

    subgraph Backend [Express Server]
        Express[Express REST API - Controllers & Routes]
        AuthMiddleware[JWT Verify + Rate Limiter]
        Validation[express-validator]
        SocketServer[Socket.io Gateway - GPS Broadcast]
        Swagger[Swagger UI - API Documentation]
    end

    Express -->|Prisma ORM| DB[(PostgreSQL - Supabase)]

    subgraph DevOps
        Docker[Docker Compose - Dev/Prod]
        GH[GitHub Actions - CI/CD]
        Vercel[Vercel - Frontend Deployment]
        Render[Render - Backend Deployment]
    end
```

---

## 🛠️ Công Nghệ Sử Dụng

### Frontend

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Framework** | `Next.js 15` (App Router) | Xây dựng giao diện & server components |
| **Ngôn ngữ** | `TypeScript` | An toàn kiểu dữ liệu |
| **Styling** | `Tailwind CSS v4` + CSS Variables | Giao diện responsive, dark/light mode |
| **UI Components** | `shadcn/ui`, `Radix UI`, `Base UI` | Component library tái sử dụng |
| **Bản đồ** | `MapCN (mapcn.dev)` — built on MapLibre GL | Component map React, styled với Tailwind CSS, hỗ trợ shadcn/ui |
| **Xác thực** | `NextAuth.js v5` (Auth.js) | Quản lý phiên JWT |
| **State Management** | `Zustand` + `Immer` | Store toàn cục (alerts, sidebar, positions) |
| **API Client** | `Axios` | Kết nối API, interceptor token |
| **Real-time** | `Socket.io-client` | GPS tracking thời gian thực |
| **Form** | `react-hook-form` + `zod` | Quản lý form & validation |
| **Offline** | `IndexedDB` (custom wrapper) | Cache dữ liệu & hàng đợi đồng bộ |
| **QR Code** | `html5-qrcode`, `qrcode` | Quét & tạo QR code |
| **Báo cáo** | `jsPDF`, `jspdf-autotable`, `ExcelJS` | Xuất PDF & Excel |
| **Toast** | `sonner` | Thông báo |
| **Date** | `date-fns` (locale vi) | Định dạng ngày tháng |
| **Icons** | `lucide-react` | Biểu tượng giao diện |

### Backend

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Runtime** | `Node.js` + `TypeScript` | Server-side logic |
| **Framework** | `Express.js` | RESTful API |
| **ORM** | `Prisma` | Type-safe database access |
| **Database** | `PostgreSQL` (Supabase) | Lưu trữ dữ liệu |
| **Xác thực** | `jsonwebtoken` + `bcryptjs` | JWT token & hash password |
| **Validation** | `express-validator` | Validate request |
| **Rate Limiting** | `express-rate-limit` | Chống brute force |
| **Bảo mật** | `helmet`, `cors` | Security headers |
| **Real-time** | `socket.io` | WebSocket GPS tracking |
| **Email** | `nodemailer` | Gửi email reset password |
| **API Docs** | `swagger-jsdoc` + `swagger-ui-express` | Tài liệu API tự động |
| **Testing** | `Jest` + `ts-jest` | Unit testing |
| **Logging** | `morgan` | HTTP request logger |

### DevOps & Triển Khai

| Thành phần | Công nghệ |
|---|---|
| **Containerization** | Docker + Docker Compose |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | Render |
| **Database Hosting** | Supabase / Render PostgreSQL |
| **CI/CD** | GitHub Actions |
| **E2E Testing** | Playwright |

---

## 📂 Cấu Trúc Thư Mục

```
LogiWeb/
├── backend/                          # MÃ NGUỒN BACKEND
│   ├── prisma/
│   │   ├── schema.prisma             # Định nghĩa database (11 models)
│   │   ├── seed.ts                   # Dữ liệu mẫu
│   │   └── dev.db                    # SQLite dev (optional)
│   ├── src/
│   │   ├── config/                   # env, database, jwt, swagger
│   │   ├── controllers/              # auth, user, warehouse, shipment, inventory, notification
│   │   ├── middleware/                # auth, rate-limiter, validation
│   │   ├── routes/                   # Route definitions
│   │   ├── services/                 # Business logic
│   │   ├── utils/                    # Response helpers
│   │   ├── lib/                      # Email utility
│   │   ├── __tests__/                # Unit tests (6+ test files)
│   │   └── index.ts                  # Server entrypoint
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                         # MÃ NGUỒN FRONTEND
│   ├── src/
│   │   ├── app/                      # Next.js App Router
│   │   │   ├── (auth)/               # auth/login, register, forgot-password, reset-password
│   │   │   ├── (dashboard)/          # dashboard (admin/manager/staff), admin (users, settings)
│   │   │   ├── @modal/               # Parallel routes (intercepted modals)
│   │   │   ├── api/                  # API routes (auth/nextauth, send-email, routing)
│   │   │   ├── offline/              # PWA offline page
│   │   │   └── actions/              # Server Actions (shipments, inventory)
│   │   ├── components/
│   │   │   ├── ui/                   # Map (MapCN / MapLibre GL), Button, OptimizedImage
│   │   │   ├── layout/               # Sidebar, Header, OfflineBanner
│   │   │   ├── auth/                 # RoleGuard
│   │   │   └── providers.tsx         # Session + Theme + Auth providers
│   │   ├── lib/                      # api.ts, server-api.ts, offline-db.ts,
│   │   │                                use-offline-sync.ts, pdf-export.ts,
│   │   │                                route-optimizer.ts, utils.ts
│   │   ├── store/                    # Zustand stores (app-store, notification-store,
│   │   │                                shared-data-store, driver-notification-store)
│   │   ├── context/                  # auth-context, theme-context
│   │   ├── auth.ts                   # NextAuth v5 config
│   │   ├── globals.css               # CSS variables, animations, utility classes
│   │   └── styles/                   # shadcn-tailwind.css, tw-animate.css
│   ├── e2e/                          # Playwright E2E tests
│   ├── public/                       # PWA icons, manifest.json, sw.js
│   ├── Dockerfile
│   ├── next.config.ts
│   └── package.json
│
├── docker-compose.yml                # Docker Compose (DB + Backend + Frontend)
├── render.yaml                       # Render deployment config
├── .github/workflows/ci-cd.yml       # GitHub Actions CI/CD
└── assessment_report.html            # Báo cáo đánh giá đồ án
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Local

### Yêu Cầu
- **Node.js** ≥ 20
- **npm** hoặc **pnpm** / **yarn**
- **PostgreSQL** (hoặc tài khoản Supabase miễn phí)
- **Docker** (tùy chọn — cho Docker Compose)

### 1. Clone & Cài Đặt

```bash
git clone <repository-url>
cd LogiWeb

# Cài đặt backend
cd backend
npm install

# Cài đặt frontend
cd ../frontend
npm install
```

### 2. Cấu Hình Backend

Tạo file `backend/.env`:

```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?schema=public"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_REFRESH_SECRET="your-refresh-token-secret-here"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=5000
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_STRICT_MAX=5
RATE_LIMIT_API_MAX=500
RATE_LIMIT_POLLING_MAX=300

# CORS
FRONTEND_URL="http://localhost:3000"

# Email (SMTP) — optional, for password reset
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-16-digit-app-password"
SMTP_FROM_EMAIL="noreply@logistiq.vn"
```

### 3. Khởi Tạo Database

```bash
cd backend
npx prisma generate
npx prisma db push
npm run seed    # Nạp dữ liệu mẫu
```

### 4. Cấu Hình Frontend

Tạo file `frontend/.env.local`:

```env
NEXTAUTH_SECRET="your-nextauth-secret"
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
NEXT_PUBLIC_SOCKET_URL="http://localhost:5000"
```

### 5. Chạy Ứng Dụng

```bash
# Terminal 1: Backend
cd backend
npm run dev    # http://localhost:5000

# Terminal 2: Frontend
cd frontend
npm run dev    # http://localhost:3000
```

### 🐳 Hoặc Dùng Docker Compose

```bash
# Khởi động tất cả services
docker compose up -d --build

# Khởi tạo database schema & seed data
docker compose exec backend npx prisma db push
docker compose exec backend npx prisma db seed

# Frontend: http://localhost:3000
# Backend:  http://localhost:5000
# Swagger:  http://localhost:5000/api-docs
```

---

## 👥 Tài Khoản Kiểm Thử

| Vai trò | Email | Mật khẩu |
|---|---|---|
| **Quản trị viên (Admin)** | `admin@logistiq.vn` | `admin123` |
| **Quản lý kho HCM** | `manager.hcm@logistiq.vn` | `staff123` |
| **Quản lý kho HN** | `manager.hn@logistiq.vn` | `staff123` |
| **Quản lý kho ĐN** | `manager.dn@logistiq.vn` | `staff123` |
| **Nhân viên kho** | `nam@logistiq.vn` | `staff123` |
| **Tài xế 1** | `driver1@logistiq.vn` | `staff123` |
| **Tài xế 2** | `driver2@logistiq.vn` | `staff123` |

> Mỗi manager quản lý đúng 1 kho. Xem chi tiết trong hệ thống.

---

## 🔗 API Endpoints

| Nhóm | Endpoint | Mô tả |
|---|---|---|
| **Auth** | `POST /api/auth/login` | Đăng nhập |
| | `POST /api/auth/register` | Đăng ký |
| | `POST /api/auth/refresh` | Refresh token |
| | `POST /api/auth/forgot-password` | Quên mật khẩu |
| | `POST /api/auth/reset-password` | Đặt lại mật khẩu |
| | `GET /api/auth/me` | Thông tin user hiện tại |
| | `PUT /api/auth/me` | Cập nhật profile |
| | `GET /api/auth/drivers` | Danh sách tài xế |
| **Users** | `GET /api/users` | Danh sách users |
| | `POST /api/users` | Tạo user (Admin) |
| | `PUT /api/users/:id` | Cập nhật user |
| | `DELETE /api/users/:id` | Xóa user |
| **Warehouses** | `GET /api/warehouses` | Danh sách kho |
| | `GET /api/warehouses/:id` | Chi tiết kho |
| | `POST /api/warehouses` | Tạo kho |
| | `PUT /api/warehouses/:id` | Cập nhật kho |
| **Inventory** | `GET /api/inventory` | Danh sách tồn kho |
| | `GET /api/inventory/:id` | Chi tiết tồn kho |
| | `POST /api/inventory` | Nhập hàng |
| | `PUT /api/inventory/:id` | Cập nhật tồn kho |
| | `GET /api/inventory/alerts` | Danh sách cảnh báo |
| | `PUT /api/inventory/alerts/:id/resolve` | Giải quyết cảnh báo |
| **Products** | `GET /api/products` | Danh sách sản phẩm |
| | `GET /api/products/:id` | Chi tiết sản phẩm |
| | `POST /api/products` | Tạo sản phẩm |
| | `GET /api/products/by-qr/:qrCode` | Tìm bằng QR |
| | `GET /api/products/by-barcode/:barcode` | Tìm bằng barcode |
| **Shipments** | `GET /api/shipments` | Danh sách vận đơn |
| | `GET /api/shipments/:id` | Chi tiết vận đơn |
| | `GET /api/shipments/stats` | Thống kê vận đơn |
| | `POST /api/shipments` | Tạo vận đơn |
| | `PUT /api/shipments/:id` | Cập nhật vận đơn |
| | `PUT /api/shipments/:id/approve` | Duyệt vận đơn |
| | `PUT /api/shipments/:id/reject` | Từ chối vận đơn |
| | `PUT /api/shipments/:id/loading` | Bắt đầu xếp hàng |
| | `POST /api/shipments/:id/receive` | Nhận hàng |
| **Notifications** | `GET /api/notifications` | Danh sách thông báo |
| | `PUT /api/notifications/:id/read` | Đánh dấu đã đọc |
| | `PUT /api/notifications/read-all` | Đọc tất cả |
| **Health** | `GET /health` | Kiểm tra server |

> 📖 API documentation tự động: `http://localhost:5000/api-docs` (Swagger UI)

---

## 🧪 Kiểm Thử

```bash
# Backend unit tests
cd backend
npm test

# Frontend E2E tests (Playwright)
cd frontend
npx playwright install
npm run test:e2e
```

---

## ☁️ Triển Khai (Deployment)

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
```
Cấu hình environment variables trên Vercel dashboard:
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXTAUTH_SECRET`, `API_URL`

### Backend → Render
Sử dụng file `render.yaml` có sẵn trong repo. Triển khai qua Render Dashboard:
1. Connect GitHub repo
2. Chọn "Blueprint" — Render tự động đọc `render.yaml`
3. Điền các secrets: `DATABASE_URL`, `JWT_SECRET`, `SMTP_*`

### Database → Supabase
1. Tạo project Supabase miễn phí
2. Lấy `DATABASE_URL` (có PgBouncer) và `DIRECT_URL` (không PgBouncer)
3. Chạy `npx prisma db push` và `npm run seed`

---

## 📚 Kiến Trúc Cơ Sở Dữ Liệu (Prisma Schema)

12 models trong database:
- **User** — Người dùng (4 roles: ADMIN, MANAGER, STAFF, DRIVER)
- **Warehouse** — Kho hàng (manager + staff, zones)
- **WarehouseZone** — Phân khu trong kho
- **Product** — Sản phẩm (SKU, barcode, QR code, categories)
- **InventoryItem** — Tồn kho (theo vị trí: zone, rack, shelf)
- **Shipment** — Vận đơn (trạng thái: PENDING → DELIVERED)
- **ShipmentItem** — Chi tiết vận đơn
- **ShipmentCheckpoint** — Trạm kiểm soát
- **TrackingHistory** — Lịch sử GPS
- **StockAlert** — Cảnh báo tồn kho
- **Notification** — Thông báo người dùng
- **TokenBlacklist** — Danh sách token bị thu hồi

---

## 📝 Ghi Chú Phát Triển

- **PWA Icons**: Chạy `npm run generate-icons` trong `frontend/` để tạo icons từ ảnh gốc.
- **MapCN (mapcn.dev)**: Thư viện component bản đồ React built on top of MapLibre GL. Theme tự động đồng bộ với dark mode của ứng dụng. Xem thêm tại [mapcn.dev](https://www.mapcn.dev/).
- **Offline**: Dữ liệu vận đơn được cache 7 ngày trong IndexedDB. Mutation queue tự động đồng bộ khi online.
- **Rate Limiting**: Có thể điều chỉnh qua env vars. Mặc định: auth=10 lần/15ph, API=500 lần/15ph.

---

> **LogistiQ** — *Nâng tầm chuỗi cung ứng Việt với công nghệ số.*
