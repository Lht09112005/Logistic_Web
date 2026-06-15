# 🚛 LogistiQ — Hệ Thống Quản Lý Kho Hàng & Vận Chuyển Thông Minh

> **Đề tài bài tập lớn môn Lập trình Web và Dịch vụ (INT1334)**  
> *Một giải pháp chuyển đổi số toàn diện cho chuỗi cung ứng và vận tải logistics thời gian thực.*

> 📖 **Xem [WALKTHROUGH.md](./WALKTHROUGH.md)** để có tài liệu hướng dẫn chi tiết về kiến trúc, luồng nghiệp vụ, API endpoints, phân quyền và deployment.

---

## 🌟 Tổng Quan Dự Án

**LogistiQ** là hệ thống quản lý logistics và kho bãi hiện đại, tích hợp bản đồ số thông minh và định vị GPS thời gian thực. Hệ thống giúp doanh nghiệp tự động hóa quy trình quản lý lưu kho, giám sát hành trình di chuyển của đội xe, cảnh báo tồn kho an toàn và tối ưu hóa luồng công việc giữa các phòng ban (Quản trị viên, Nhân viên kho, Tài xế).

---

## 📸 Các Tính Năng Cốt Lõi

### 1. 📊 Bản Đồ Giám Sát Hành Trình & Giả Lập GPS Thời Gian Thực (Real-time GPS Tracking)
*   **Bản đồ tương tác Leaflet.js**: Tích hợp theme bản đồ tối giản cao cấp **CartoDB Positron**, trực quan hóa toàn bộ trạm kiểm soát (checkpoints) và lộ trình di chuyển.
*   **Hoạt ảnh Radar Pulse Cam**: Định vị thời gian thực của xe tải bằng CSS animation phát sóng radar sinh động.
*   **Bộ giả lập GPS (GPS Simulator Console)**: Tích hợp nút điều khiển mô phỏng tốc độ thực tế, tự động cập nhật tọa độ liên tục gửi qua **Socket.io** và lưu trực tiếp vào database.
*   **Bám đuổi tự động (Auto-pan)**: Bản đồ tự động di chuyển mượt mà bám theo sát vị trí xe tải trong quá trình di chuyển.

### 2. 🏢 Quản Lý Mạng Lưới Kho Phân Phối (Warehouse Management)
*   **Thống kê công suất m² trực quan**: Hiển thị thanh tiến trình sử dụng diện tích thực tế so với tổng diện tích kho, tự động đổi màu đỏ cảnh báo khi kho quá tải (>85%).
*   **Chi tiết kho thông minh**: Liệt kê số lượng phân khu (zones), các mặt hàng lưu kho, thông tin người quản lý và tổng số lượng sản phẩm chi tiết.

### 3. 📦 Kiểm Soát Tồn Kho & Cảnh Báo Thiếu Hàng (Inventory & Stock Alerts)
*   **Quản lý tồn kho theo lô/vị trí**: Theo dõi chính xác vị trí sản phẩm nằm tại khu vực nào của từng kho hàng.
*   **Hệ thống cảnh báo tự động**: Đưa ra cảnh báo đỏ đối với các mặt hàng có số lượng tồn kho giảm xuống dưới hạn mức an toàn tối thiểu.

### 4. 📈 Phân Tích Số Liệu & Dashboard Trực Quan (Analytics & Dashboard)
*   **Thống kê tổng quan**: Biểu đồ phân tích doanh thu, sản lượng xuất/nhập kho và tỷ lệ hoàn thành đơn hàng.
*   **Dashboard động**: Tự động phản ánh dữ liệu thực từ PostgreSQL theo thời gian thực.

### 5. 🔐 Bảo Mật Phiên Đăng Nhập & Phân Quyền (NextAuth v5 & JWT)
*   **Phân quyền chặt chẽ (RBAC)**: Phân chia vai trò rõ ràng gồm **Admin** (Quản trị toàn hệ thống), **Staff** (Nhân viên quản lý kho), và **Driver** (Tài xế theo dõi chuyến đi).
*   **Cơ chế chống lặp vòng vô hạn (Safe Sign-Out)**: Tự động xóa cookies phiên khi nhận lỗi `401 Unauthorized` từ API để bảo vệ tài khoản người dùng và duy trì trải nghiệm liền mạch.

---

## 🏗️ Kiến Trúc Hệ Thống (System Architecture)

```mermaid
graph TD
    %% Frontend Layer
    subgraph Frontend [Next.js Client]
        UI[React Components - Dashboard, Map, Warehouses]
        NextAuth[NextAuth.js v5 - Session Management]
        Axios[Axios Interceptor - Token Injector & SignOut Handler]
        SocketClient[Socket.io-client - GPS Listener]
    end

    %% Network Layer
    Axios -->|HTTP API Requests + Bearer Token| Express
    SocketClient -->|WebSocket Connection| SocketServer

    %% Backend Layer
    subgraph Backend [Express Server - Node.js & TS]
        Express[Express REST API - Controllers & Routes]
        AuthMiddleware[JWT Verify Middleware]
        SocketServer[Socket.io Gateway - GPS Broadcast]
        GPSSimulator[GPS Route Simulator Engine]
    end

    %% Database Layer
    Express -->|Prisma Client| DB[(PostgreSQL Database - Supabase)]
    GPSSimulator -->|Prisma Save Coordinates| DB
```

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

| Thành phần | Công nghệ chính | Vai trò |
|---|---|---|
| **Frontend Framework** | `Next.js 15` (App Router) | Xây dựng giao diện ứng dụng phía Client |
| **Styling** | `Vanilla CSS` + `Lucide React` | Tạo giao diện cao cấp, micro-animations và các tokens tối giản |
| **Client Auth** | `NextAuth.js v5` (Auth.js) | Bảo mật phiên đăng nhập, JWT caching |
| **Bản đồ** | `Leaflet.js` & `OpenStreetMap` | Hiển thị lộ trình và bản đồ động |
| **API Client** | `Axios` + Request/Response Interceptors | Kết nối API, tự động đính kèm Token và xử lý lỗi 401 |
| **Backend Engine** | `Express.js` + `TypeScript` | Phát triển RESTful API cho toàn hệ thống |
| **Real-time Engine**| `Socket.io` (WebSockets) | Truyền tải tọa độ GPS xe tải thời gian thực |
| **ORM** | `Prisma Client` | Tương tác cơ sở dữ liệu an toàn kiểu dữ liệu (Type-safe) |
| **Database** | `PostgreSQL` (Supabase Hosted) | Cơ sở dữ liệu đám mây lưu trữ thông tin hệ thống |

---

## 📂 Cấu Trúc Thư Mục Dự Án (Project Structure)

```text
Logistics_management/
├── backend/                  # MÃ NGUỒN BACKEND (NODE.JS & EXPRESS TS)
│   ├── prisma/
│   │   ├── schema.prisma     # Định nghĩa cơ sở dữ liệu PostgreSQL
│   │   └── seed.ts           # Script nạp dữ liệu mẫu tự động
│   ├── src/
│   │   ├── config/           # Khởi tạo Prisma Client, Socket.io
│   │   ├── controllers/      # Logic xử lý API (Warehouse, Shipment, Inventory...)
│   │   ├── middleware/       # JWT Auth validator middleware
│   │   ├── routes/           # Định tuyến endpoint API
│   │   └── index.ts          # Điểm chạy chính (Server entrypoint)
│   └── package.json
│
├── frontend/                 # MÃ NGUỒN FRONTEND (NEXT.JS 15)
│   ├── src/
│   │   ├── app/              # Next.js App Router (Dashboard, Login, Shipments...)
│   │   ├── components/       # Các component dùng chung UI (Sidebar, Header...)
│   │   ├── lib/              # Cấu hình Axios api client, utils helper
│   │   ├── auth.ts           # Cấu hình Providers credentials và JWT của NextAuth
│   │   └── proxy.ts          # Cấu hình proxy định hướng luồng mạng
│   └── package.json
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Local

### 1. Khởi tạo Cơ sở dữ liệu (Supabase PostgreSQL)
*   Tạo cơ sở dữ liệu mới trên Supabase và lấy đường dẫn URL.
*   Tạo tệp `backend/.env` dựa theo `backend/.env.example` và điền:
    ```env
    DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    DIRECT_URL="postgresql://postgres:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
    JWT_SECRET="YOUR_SUPER_SECRET_KEY"
    PORT=5000
    ```

### 2. Cài đặt & Chạy Backend
```bash
cd backend
npm install

# Tạo Prisma client và đẩy schema lên database
npx prisma generate
npx prisma db push

# Nạp dữ liệu mẫu (Seed database)
npm run seed

# Khởi động chế độ phát triển
npm run dev
```

### 3. Cài đặt & Chạy Frontend
*   Tạo tệp `frontend/.env` điền các thông tin:
    ```env
    NEXTAUTH_SECRET="NEXTAUTH_GENERATED_SECRET"
    NEXT_PUBLIC_API_URL="http://localhost:5000/api"
    NEXT_PUBLIC_SOCKET_URL="http://localhost:5000"
    ```
*   Khởi chạy dự án:
    ```bash
    cd ../frontend
    npm install
    npm run dev
    ```
*   Truy cập: `http://localhost:3000`

---

## 👥 Tài Khoản Kiểm Thử (Demo Credentials)

| Vai trò | Email | Mật khẩu |
|---|---|---|
| **Admin** | `admin@logistiq.vn` | `admin123` |
| **Manager HCM** | `manager.hcm@logistiq.vn` | `staff123` |
| **Manager HN** | `manager.hn@logistiq.vn` | `staff123` |
| **Manager ĐN** | `manager.dn@logistiq.vn` | `staff123` |
| **Staff** | `nam@logistiq.vn` | `staff123` |
| **Driver 1** | `driver1@logistiq.vn` | `staff123` |
| **Driver 2** | `driver2@logistiq.vn` | `staff123` |

> 🎯 **Mỗi manager quản lý đúng 1 kho**: Xem chi tiết tài khoản và mật mã mẫu trong hệ thống.

