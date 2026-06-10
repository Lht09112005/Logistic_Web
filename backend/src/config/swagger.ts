import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "LogistiQ API — Hệ thống quản lý Logistics & Chuỗi cung ứng",
      version: "1.0.0",
      description: `
API backend cho hệ thống quản lý logistics. Hỗ trợ quản lý kho hàng, vận đơn, tồn kho, người dùng và thông báo realtime.

## Authentication
Hầu hết API yêu cầu **Bearer token** trong header \`Authorization\`. Token nhận được từ \`POST /api/auth/login\` hoặc \`POST /api/auth/register\`.

## Base URL
\`http://localhost:5000/api\`

## Response Format
\`\`\`json
{
  "success": true,
  "message": "Thành công",
  "data": { ... },
  "meta": { "total": 10, "page": 1, "limit": 20, "totalPages": 1 }
}
\`\`\`
      `,
      contact: {
        name: "LogistiQ Team",
      },
    },
    servers: [
      { url: "http://localhost:5000", description: "Development" },
      {
        url: "https://logistics-backend-byis.onrender.com",
        description: "Production",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Nhập JWT token nhận từ login/register",
        },
      },
      schemas: {
        // ─── Shared Response Schemas ─────────────────────────
        ApiResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Thành công" },
            data: { type: "object", nullable: true },
            meta: {
              type: "object",
              properties: {
                total: { type: "integer" },
                page: { type: "integer" },
                limit: { type: "integer" },
                totalPages: { type: "integer" },
                unreadCount: { type: "integer" },
              },
            },
          },
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Lỗi xử lý yêu cầu" },
            errors: { type: "object", nullable: true },
          },
        },

        // ─── Auth ────────────────────────────────────────────
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "admin@logistiq.vn" },
            password: { type: "string", format: "password", example: "admin123" },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", example: "Nguyễn Văn A" },
            email: { type: "string", format: "email", example: "user@logistiq.vn" },
            password: { type: "string", format: "password", example: "Password123" },
            role: {
              type: "string",
              enum: ["ADMIN", "MANAGER", "STAFF", "DRIVER"],
              example: "STAFF",
            },
            phone: { type: "string", example: "0901234567" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                user: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    email: { type: "string" },
                    role: { type: "string", enum: ["ADMIN", "MANAGER", "STAFF", "DRIVER"] },
                    phone: { type: "string", nullable: true },
                    managedWarehouses: { type: "array", items: { type: "object" } },
                    staffedWarehouses: { type: "array", items: { type: "object" } },
                  },
                },
                accessToken: { type: "string" },
                refreshToken: { type: "string" },
              },
            },
          },
        },
        ForgotPasswordRequest: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email", example: "admin@logistiq.vn" },
          },
        },
        ResetPasswordRequest: {
          type: "object",
          required: ["token", "password"],
          properties: {
            token: { type: "string", example: "a1b2c3d4e5f6..." },
            password: { type: "string", format: "password", example: "NewPass123" },
          },
        },
        RefreshTokenRequest: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" },
          },
        },

        // ─── User ────────────────────────────────────────────
        CreateUserRequest: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", example: "Nguyễn Văn B" },
            email: { type: "string", format: "email", example: "staff@logistiq.vn" },
            password: { type: "string", format: "password", example: "staff123" },
            role: {
              type: "string",
              enum: ["ADMIN", "MANAGER", "STAFF", "DRIVER"],
              example: "STAFF",
            },
            phone: { type: "string", example: "0901234567" },
          },
        },
        UpdateUserRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string", format: "password" },
            role: { type: "string", enum: ["ADMIN", "MANAGER", "STAFF", "DRIVER"] },
            phone: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
        UpdateMeRequest: {
          type: "object",
          properties: {
            name: { type: "string", example: "Nguyễn Văn A" },
            email: { type: "string", format: "email", example: "newemail@logistiq.vn" },
            phone: { type: "string", example: "0901234567" },
            password: { type: "string", format: "password", example: "NewPass123" },
          },
        },

        // ─── Product ─────────────────────────────────────────
        CreateProductRequest: {
          type: "object",
          required: ["name", "sku", "unit"],
          properties: {
            name: { type: "string", example: "Laptop Dell XPS 15" },
            sku: { type: "string", example: "LAP-DELL-XPS-001" },
            category: {
              type: "string",
              enum: ["ELECTRONICS", "CLOTHING", "FOOD", "FURNITURE", "MEDICAL", "AUTOMOTIVE", "CHEMICAL", "OTHER"],
              example: "ELECTRONICS",
            },
            description: { type: "string", example: "Laptop cao cấp" },
            unit: { type: "string", example: "pcs" },
            weight: { type: "number", example: 2.5 },
            minStockLevel: { type: "integer", example: 10 },
            costPrice: { type: "number", example: 25000000 },
            sellPrice: { type: "number", example: 30000000 },
          },
        },

        // ─── Inventory ───────────────────────────────────────
        CreateInventoryRequest: {
          type: "object",
          required: ["productId", "warehouseId", "quantity"],
          properties: {
            productId: { type: "string", format: "uuid", example: "uuid-product" },
            warehouseId: { type: "string", format: "uuid", example: "uuid-warehouse" },
            zoneId: { type: "string", format: "uuid", example: "uuid-zone", nullable: true },
            quantity: { type: "integer", example: 100 },
            notes: { type: "string", example: "Kệ A-01" },
          },
        },
        UpdateInventoryRequest: {
          type: "object",
          properties: {
            quantity: { type: "integer", example: 150 },
            zoneId: { type: "string", format: "uuid", nullable: true },
            notes: { type: "string" },
          },
        },

        // ─── Shipment ────────────────────────────────────────
        CreateShipmentRequest: {
          type: "object",
          required: ["originAddress", "destinationAddress"],
          properties: {
            originAddress: { type: "string", example: "123 Nguyễn Huệ, Q1, HCM" },
            destinationAddress: { type: "string", example: "45 Phạm Hùng, HN" },
            originWarehouseId: { type: "string", format: "uuid", nullable: true },
            destinationWarehouseId: { type: "string", format: "uuid", nullable: true },
            driverId: { type: "string", format: "uuid", nullable: true },
            vehicleNumber: { type: "string", example: "51G-12345" },
            estimatedArrival: { type: "string", format: "date-time" },
            notes: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productId: { type: "string", format: "uuid" },
                  quantity: { type: "integer" },
                },
              },
            },
            checkpoints: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Trạm dừng Bình Dương" },
                  address: { type: "string", example: "QL 13, Bình Dương" },
                  sequence: { type: "integer", example: 1 },
                  estimatedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        UpdateShipmentRequest: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["PENDING", "CONFIRMED", "LOADING", "IN_TRANSIT", "AT_CHECKPOINT", "DELIVERING", "DELIVERED", "CANCELLED", "FAILED"],
            },
            driverId: { type: "string", format: "uuid" },
            vehicleNumber: { type: "string" },
            currentLat: { type: "number" },
            currentLng: { type: "number" },
            notes: { type: "string" },
            checkpoints: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  isCompleted: { type: "boolean" },
                  arrivedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        RejectShipmentRequest: {
          type: "object",
          required: ["reason"],
          properties: {
            reason: { type: "string", example: "Thông tin vận đơn không chính xác" },
          },
        },

        // ─── Warehouse ───────────────────────────────────────
        CreateWarehouseRequest: {
          type: "object",
          required: ["name", "code", "address", "city", "province", "totalArea", "capacity"],
          properties: {
            name: { type: "string", example: "Kho Hồ Chí Minh" },
            code: { type: "string", example: "WH-HCM-01" },
            address: { type: "string", example: "123 Nguyễn Huệ" },
            city: { type: "string", example: "Hồ Chí Minh" },
            province: { type: "string", example: "TP. Hồ Chí Minh" },
            totalArea: { type: "number", example: 5000 },
            capacity: { type: "integer", example: 10000 },
            latitude: { type: "number", example: 10.7769 },
            longitude: { type: "number", example: 106.7009 },
            managerId: { type: "string", format: "uuid", nullable: true },
            description: { type: "string", example: "Kho chính tại HCM" },
          },
        },
        UpdateWarehouseRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            address: { type: "string" },
            city: { type: "string" },
            province: { type: "string" },
            totalArea: { type: "number" },
            capacity: { type: "integer" },
            latitude: { type: "number" },
            longitude: { type: "number" },
            managerId: { type: "string", format: "uuid", nullable: true },
            staffId: { type: "string", format: "uuid", nullable: true },
            status: {
              type: "string",
              enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"],
            },
            description: { type: "string" },
          },
        },
      },
    },
    paths: {
      // ════════════════════════════════════════════════════════
      // AUTH
      // ════════════════════════════════════════════════════════
      "/api/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Đăng ký tài khoản mới",
          description: "Tạo tài khoản người dùng mới. Trả về user + accessToken + refreshToken.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } },
            },
          },
          responses: {
            201: { description: "Đăng ký thành công", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
            409: { description: "Email đã được sử dụng" },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Đăng nhập",
          description: "Đăng nhập với email và mật khẩu. Trả về JWT accessToken + refreshToken.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } },
            },
          },
          responses: {
            200: { description: "Đăng nhập thành công", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
            401: { description: "Email hoặc mật khẩu không đúng" },
          },
        },
      },
      "/api/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Làm mới token",
          description: "Dùng refreshToken để lấy accessToken mới.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RefreshTokenRequest" } },
            },
          },
          responses: {
            200: { description: "Làm mới token thành công" },
            401: { description: "Refresh token không hợp lệ" },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Đăng xuất",
          description: "Xóa refresh token khỏi database. Yêu cầu Bearer token.",
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: "Đăng xuất thành công" },
            401: { description: "Không có token xác thực" },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Lấy thông tin người dùng hiện tại",
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: "Thông tin người dùng" },
            401: { description: "Chưa xác thực" },
          },
        },
        put: {
          tags: ["Auth"],
          summary: "Cập nhật thông tin cá nhân",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateMeRequest" } } },
          },
          responses: {
            200: { description: "Cập nhật thành công" },
            400: { description: "Dữ liệu không hợp lệ" },
          },
        },
      },
      "/api/auth/drivers": {
        get: {
          tags: ["Auth"],
          summary: "Danh sách tài xế",
          description: "Lấy danh sách tài xế đang hoạt động. Yêu cầu Bearer token.",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Danh sách tài xế" } },
        },
      },
      "/api/auth/forgot-password": {
        post: {
          tags: ["Auth"],
          summary: "Quên mật khẩu",
          description: "Gửi email đặt lại mật khẩu. Luôn trả về success để chống email enumeration.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ForgotPasswordRequest" } },
            },
          },
          responses: { 200: { description: "Email hướng dẫn đã được gửi (nếu email tồn tại)" } },
        },
      },
      "/api/auth/reset-password": {
        post: {
          tags: ["Auth"],
          summary: "Đặt lại mật khẩu",
          description: "Dùng token từ email để đặt mật khẩu mới. Token có hiệu lực 60 phút.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ResetPasswordRequest" } },
            },
          },
          responses: {
            200: { description: "Mật khẩu đã được đặt lại" },
            400: { description: "Token không hợp lệ hoặc đã hết hạn" },
          },
        },
      },

      // ════════════════════════════════════════════════════════
      // USERS
      // ════════════════════════════════════════════════════════
      "/api/users": {
        get: {
          tags: ["Users"],
          summary: "Danh sách người dùng",
          description: "ADMIN thấy tất cả, MANAGER chỉ thấy STAFF & DRIVER.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 15 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "role", in: "query", schema: { type: "string", enum: ["ADMIN", "MANAGER", "STAFF", "DRIVER"] } },
          ],
          responses: { 200: { description: "Danh sách người dùng (có meta phân trang)" } },
        },
        post: {
          tags: ["Users"],
          summary: "Tạo người dùng mới",
          description: "Chỉ ADMIN mới có quyền tạo người dùng.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserRequest" } } },
          },
          responses: { 201: { description: "Tạo người dùng thành công" }, 403: { description: "Không có quyền" } },
        },
      },
      "/api/users/{id}": {
        get: {
          tags: ["Users"],
          summary: "Chi tiết người dùng",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Thông tin người dùng" }, 404: { description: "Không tìm thấy" } },
        },
        put: {
          tags: ["Users"],
          summary: "Cập nhật người dùng",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateUserRequest" } } },
          },
          responses: { 200: { description: "Cập nhật thành công" } },
        },
        delete: {
          tags: ["Users"],
          summary: "Xóa người dùng",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Xóa thành công" } },
        },
      },

      // ════════════════════════════════════════════════════════
      // PRODUCTS
      // ════════════════════════════════════════════════════════
      "/api/products": {
        get: {
          tags: ["Products"],
          summary: "Danh sách sản phẩm",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "category", in: "query", schema: { type: "string" } },
          ],
          responses: { 200: { description: "Danh sách sản phẩm" } },
        },
        post: {
          tags: ["Products"],
          summary: "Tạo sản phẩm mới",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProductRequest" } } },
          },
          responses: { 201: { description: "Tạo sản phẩm thành công" } },
        },
      },
      "/api/products/by-qr/{qrCode}": {
        get: {
          tags: ["Products"],
          summary: "Tìm sản phẩm theo QR code",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "qrCode", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Thông tin sản phẩm" }, 404: { description: "Không tìm thấy" } },
        },
      },
      "/api/products/{id}": {
        get: {
          tags: ["Products"],
          summary: "Chi tiết sản phẩm",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Thông tin sản phẩm" } },
        },
        put: {
          tags: ["Products"],
          summary: "Cập nhật sản phẩm",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProductRequest" } } },
          },
          responses: { 200: { description: "Cập nhật thành công" } },
        },
        delete: {
          tags: ["Products"],
          summary: "Xóa sản phẩm",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Xóa thành công" } },
        },
      },

      // ════════════════════════════════════════════════════════
      // INVENTORY
      // ════════════════════════════════════════════════════════
      "/api/inventory": {
        get: {
          tags: ["Inventory"],
          summary: "Danh sách tồn kho",
          description: "ADMIN thấy tất cả, MANAGER/STAFF chỉ thấy kho được phân công.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "warehouseId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "lowStock", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          ],
          responses: { 200: { description: "Danh sách tồn kho" } },
        },
        post: {
          tags: ["Inventory"],
          summary: "Thêm hàng tồn kho",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateInventoryRequest" } } },
          },
          responses: { 201: { description: "Thêm hàng thành công" } },
        },
      },
      "/api/inventory/alerts": {
        get: {
          tags: ["Inventory"],
          summary: "Cảnh báo tồn kho",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "isResolved", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          ],
          responses: { 200: { description: "Danh sách cảnh báo" } },
        },
      },
      "/api/inventory/alerts/{id}/resolve": {
        put: {
          tags: ["Inventory"],
          summary: "Giải quyết cảnh báo",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Đã giải quyết cảnh báo" } },
        },
      },
      "/api/inventory/{id}": {
        get: {
          tags: ["Inventory"],
          summary: "Chi tiết hàng tồn kho",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Chi tiết hàng tồn kho" } },
        },
        put: {
          tags: ["Inventory"],
          summary: "Cập nhật hàng tồn kho",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateInventoryRequest" } } },
          },
          responses: { 200: { description: "Cập nhật thành công" } },
        },
      },

      // ════════════════════════════════════════════════════════
      // SHIPMENTS
      // ════════════════════════════════════════════════════════
      "/api/shipments/stats": {
        get: {
          tags: ["Shipments"],
          summary: "Thống kê vận đơn",
          description: "Thống kê số lượng vận đơn theo trạng thái. Filter theo role.",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Thống kê",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          total: { type: "integer" },
                          inTransit: { type: "integer" },
                          delivered: { type: "integer" },
                          pending: { type: "integer" },
                          failed: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/shipments": {
        get: {
          tags: ["Shipments"],
          summary: "Danh sách vận đơn",
          description: "DRIVER chỉ thấy vận đơn được gán, MANAGER/STAFF thấy vận đơn theo kho, ADMIN thấy tất cả.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "status", in: "query", schema: { type: "string", enum: ["PENDING", "CONFIRMED", "LOADING", "IN_TRANSIT", "DELIVERED", "CANCELLED", "FAILED"] } },
            { name: "search", in: "query", schema: { type: "string" } },
          ],
          responses: { 200: { description: "Danh sách vận đơn" } },
        },
        post: {
          tags: ["Shipments"],
          summary: "Tạo vận đơn mới",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateShipmentRequest" } } },
          },
          responses: { 201: { description: "Tạo vận đơn thành công" } },
        },
      },
      "/api/shipments/{id}": {
        get: {
          tags: ["Shipments"],
          summary: "Chi tiết vận đơn",
          description: "DRIVER chỉ xem được vận đơn của mình.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Chi tiết vận đơn (kèm items, checkpoints, tracking history)" } },
        },
        put: {
          tags: ["Shipments"],
          summary: "Cập nhật vận đơn",
          description: "DRIVER chỉ cập nhật được checkpoint trên vận đơn của mình.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateShipmentRequest" } } },
          },
          responses: { 200: { description: "Cập nhật thành công" } },
        },
      },
      "/api/shipments/{id}/approve": {
        put: {
          tags: ["Shipments"],
          summary: "Duyệt vận đơn",
          description: "ADMIN và MANAGER (của kho nguồn) duyệt vận đơn.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Duyệt thành công" } },
        },
      },
      "/api/shipments/{id}/reject": {
        put: {
          tags: ["Shipments"],
          summary: "Từ chối vận đơn",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RejectShipmentRequest" } } },
          },
          responses: { 200: { description: "Từ chối thành công" } },
        },
      },
      "/api/shipments/{id}/loading": {
        put: {
          tags: ["Shipments"],
          summary: "Bắt đầu xếp hàng",
          description: "ADMIN, MANAGER, STAFF xác nhận bắt đầu xếp hàng lên xe.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Bắt đầu xếp hàng" } },
        },
      },
      "/api/shipments/{id}/receive": {
        post: {
          tags: ["Shipments"],
          summary: "Nhập kho (nhận hàng)",
          description: "ADMIN, MANAGER, STAFF (của kho đích) xác nhận nhập kho.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Nhập kho thành công" } },
        },
      },

      // ════════════════════════════════════════════════════════
      // WAREHOUSES
      // ════════════════════════════════════════════════════════
      "/api/warehouses": {
        get: {
          tags: ["Warehouses"],
          summary: "Danh sách kho",
          description: "ADMIN thấy tất cả, MANAGER/STAFF chỉ thấy kho được phân quyền.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "all", in: "query", schema: { type: "string", enum: ["true"] }, description: "Bỏ qua phân trang" },
          ],
          responses: { 200: { description: "Danh sách kho" } },
        },
        post: {
          tags: ["Warehouses"],
          summary: "Tạo kho mới",
          description: "Chỉ ADMIN mới có quyền tạo kho.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateWarehouseRequest" } } },
          },
          responses: { 201: { description: "Tạo kho thành công" } },
        },
      },
      "/api/warehouses/{id}": {
        get: {
          tags: ["Warehouses"],
          summary: "Chi tiết kho",
          description: "Kèm danh sách zones và inventory items.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Chi tiết kho" } },
        },
        put: {
          tags: ["Warehouses"],
          summary: "Cập nhật kho",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateWarehouseRequest" } } },
          },
          responses: { 200: { description: "Cập nhật thành công" } },
        },
        delete: {
          tags: ["Warehouses"],
          summary: "Xóa kho",
          description: "Chỉ ADMIN mới có quyền xóa kho.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Xóa kho thành công" } },
        },
      },

      // ════════════════════════════════════════════════════════
      // NOTIFICATIONS
      // ════════════════════════════════════════════════════════
      "/api/notifications": {
        get: {
          tags: ["Notifications"],
          summary: "Danh sách thông báo",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          ],
          responses: {
            200: {
              description: "Danh sách thông báo (kèm meta.unreadCount)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { type: "array", items: { type: "object" } },
                      meta: {
                        type: "object",
                        properties: {
                          unreadCount: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/notifications/read-all": {
        put: {
          tags: ["Notifications"],
          summary: "Đánh dấu tất cả đã đọc",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Đã đánh dấu tất cả" } },
        },
      },
      "/api/notifications/{id}/read": {
        put: {
          tags: ["Notifications"],
          summary: "Đánh dấu một thông báo đã đọc",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Đã đánh dấu" } },
        },
      },

      // ════════════════════════════════════════════════════════
      // HEALTH
      // ════════════════════════════════════════════════════════
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Kiểm tra trạng thái server",
          description: "Endpoint công khai, không yêu cầu auth.",
          responses: {
            200: {
              description: "Server đang hoạt động",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "OK" },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [], // No file-based annotations needed
};

export const swaggerSpec = swaggerJsdoc(options);
