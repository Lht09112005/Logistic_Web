import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // --- Users ---
  const adminPassword = await bcrypt.hash('admin123', 12)
  const staffPassword = await bcrypt.hash('staff123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@logistiq.vn' },
    update: {},
    create: {
      name: 'Nguyễn Văn Admin',
      email: 'admin@logistiq.vn',
      password: adminPassword,
      role: 'ADMIN',
      phone: '0901234567',
    },
  })

  const manager = await prisma.user.upsert({
    where: { email: 'manager@logistiq.vn' },
    update: {},
    create: {
      name: 'Hoàng Văn Quản Lý',
      email: 'manager@logistiq.vn',
      password: staffPassword,
      role: 'MANAGER',
      phone: '0909876543',
    },
  })

  const staff1 = await prisma.user.upsert({
    where: { email: 'nam@logistiq.vn' },
    update: {},
    create: {
      name: 'Trần Văn Nam',
      email: 'nam@logistiq.vn',
      password: staffPassword,
      role: 'STAFF',
      phone: '0912345678',
    },
  })

  const driver1 = await prisma.user.upsert({
    where: { email: 'driver1@logistiq.vn' },
    update: {},
    create: {
      name: 'Lê Minh Đức',
      email: 'driver1@logistiq.vn',
      password: staffPassword,
      role: 'DRIVER',
      phone: '0923456789',
    },
  })

  const driver2 = await prisma.user.upsert({
    where: { email: 'driver2@logistiq.vn' },
    update: {},
    create: {
      name: 'Phạm Quốc Hùng',
      email: 'driver2@logistiq.vn',
      password: staffPassword,
      role: 'DRIVER',
      phone: '0934567890',
    },
  })

  console.log('✅ Users seeded')

  // --- Warehouses ---
  const wh1 = await prisma.warehouse.upsert({
    where: { code: 'WH-HCM-01' },
    update: {},
    create: {
      name: 'Kho Trung Tâm HCM',
      code: 'WH-HCM-01',
      address: '123 Đường Nguyễn Văn Linh, Quận 7',
      city: 'TP. Hồ Chí Minh',
      province: 'Hồ Chí Minh',
      latitude: 10.7290,
      longitude: 106.7218,
      totalArea: 5000,
      capacity: 10000,
      managerId: admin.id,
      status: 'ACTIVE',
      description: 'Kho trung tâm chính tại TP. Hồ Chí Minh',
      zones: {
        create: [
          { name: 'Zone A', description: 'Điện tử & Công nghệ', capacity: 3000 },
          { name: 'Zone B', description: 'Quần áo & Thời trang', capacity: 2500 },
          { name: 'Zone C', description: 'Thực phẩm & Đồ uống', capacity: 2000 },
        ],
      },
    },
  })

  const wh2 = await prisma.warehouse.upsert({
    where: { code: 'WH-HN-01' },
    update: {},
    create: {
      name: 'Kho Hà Nội',
      code: 'WH-HN-01',
      address: '45 Đường Phạm Hùng, Nam Từ Liêm',
      city: 'Hà Nội',
      province: 'Hà Nội',
      latitude: 21.0285,
      longitude: 105.8542,
      totalArea: 3000,
      capacity: 6000,
      managerId: staff1.id,
      status: 'ACTIVE',
      description: 'Kho phân phối miền Bắc',
      zones: {
        create: [
          { name: 'Zone A', description: 'Hàng điện tử', capacity: 2000 },
          { name: 'Zone B', description: 'Hàng tổng hợp', capacity: 2000 },
        ],
      },
    },
  })

  const wh3 = await prisma.warehouse.upsert({
    where: { code: 'WH-DN-01' },
    update: {},
    create: {
      name: 'Kho Đà Nẵng',
      code: 'WH-DN-01',
      address: '78 Đường Trần Phú, Hải Châu',
      city: 'Đà Nẵng',
      province: 'Đà Nẵng',
      latitude: 16.0544,
      longitude: 108.2022,
      totalArea: 2000,
      capacity: 4000,
      managerId: manager.id,
      status: 'ACTIVE',
      description: 'Kho phân phối miền Trung',
      zones: {
        create: [
          { name: 'Zone A', description: 'Hàng tổng hợp', capacity: 2000 },
        ],
      },
    },
  })

  console.log('✅ Warehouses seeded')

  // --- Products ---
  const products = [
    {
      name: 'Laptop Dell XPS 15', sku: 'LAPTOP-DELL-001',
      category: 'ELECTRONICS' as const, unit: 'Chiếc',
      weight: 1.8, minStockLevel: 5, costPrice: 28000000, sellPrice: 35000000,
      qrCode: 'LOGISTIQ-DELL001',
    },
    {
      name: 'iPhone 15 Pro Max', sku: 'PHONE-APPLE-001',
      category: 'ELECTRONICS' as const, unit: 'Chiếc',
      weight: 0.22, minStockLevel: 10, costPrice: 25000000, sellPrice: 34990000,
      qrCode: 'LOGISTIQ-IPHONE01',
    },
    {
      name: 'Áo Polo Nam', sku: 'CLOTH-POLO-001',
      category: 'CLOTHING' as const, unit: 'Chiếc',
      weight: 0.25, minStockLevel: 30, costPrice: 120000, sellPrice: 250000,
      qrCode: 'LOGISTIQ-POLO001',
    },
    {
      name: 'Quần Jeans Levi\'s', sku: 'CLOTH-JEAN-001',
      category: 'CLOTHING' as const, unit: 'Chiếc',
      weight: 0.6, minStockLevel: 20, costPrice: 450000, sellPrice: 890000,
      qrCode: 'LOGISTIQ-JEAN001',
    },
    {
      name: 'Gạo Thơm ST25 5kg', sku: 'FOOD-RICE-001',
      category: 'FOOD' as const, unit: 'Túi',
      weight: 5, minStockLevel: 50, costPrice: 60000, sellPrice: 85000,
      qrCode: 'LOGISTIQ-RICE001',
    },
    {
      name: 'Nước Suối Aquafina 500ml', sku: 'FOOD-WATER-001',
      category: 'FOOD' as const, unit: 'Thùng 24 chai',
      weight: 12, minStockLevel: 100, costPrice: 60000, sellPrice: 95000,
      qrCode: 'LOGISTIQ-WATER01',
    },
    {
      name: 'Bàn Làm Việc Gỗ', sku: 'FURN-DESK-001',
      category: 'FURNITURE' as const, unit: 'Cái',
      weight: 35, minStockLevel: 5, costPrice: 1500000, sellPrice: 2800000,
      qrCode: 'LOGISTIQ-DESK001',
    },
    {
      name: 'Samsung Galaxy Tab S9', sku: 'TABLET-SAM-001',
      category: 'ELECTRONICS' as const, unit: 'Chiếc',
      weight: 0.49, minStockLevel: 8, costPrice: 12000000, sellPrice: 18990000,
      qrCode: 'LOGISTIQ-TABS901',
    },
    {
      name: 'Khẩu Trang Y Tế (hộp 50)', sku: 'MED-MASK-001',
      category: 'MEDICAL' as const, unit: 'Hộp',
      weight: 0.15, minStockLevel: 200, costPrice: 25000, sellPrice: 45000,
      qrCode: 'LOGISTIQ-MASK001',
    },
    {
      name: 'Lốp Xe Bridgestone 205/55R16', sku: 'AUTO-TIRE-001',
      category: 'AUTOMOTIVE' as const, unit: 'Cái',
      weight: 8.5, minStockLevel: 10, costPrice: 1200000, sellPrice: 1890000,
      qrCode: 'LOGISTIQ-TIRE001',
    },
    {
      name: 'Màn Hình LG 27 inch 4K', sku: 'MONITOR-LG-001',
      category: 'ELECTRONICS' as const, unit: 'Chiếc',
      weight: 5.5, minStockLevel: 6, costPrice: 7500000, sellPrice: 12500000,
      qrCode: 'LOGISTIQ-MON001',
    },
    {
      name: 'Cà Phê Trung Nguyên 500g', sku: 'FOOD-COFFEE-001',
      category: 'FOOD' as const, unit: 'Gói',
      weight: 0.5, minStockLevel: 80, costPrice: 55000, sellPrice: 95000,
      qrCode: 'LOGISTIQ-CAFE001',
    },
  ]

  const createdProducts = []
  for (const p of products) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    })
    createdProducts.push(prod)
  }

  console.log('✅ Products seeded')

  // --- Inventory Items ---
  const wh1Zones = await prisma.warehouseZone.findMany({ where: { warehouseId: wh1.id } })
  const wh2Zones = await prisma.warehouseZone.findMany({ where: { warehouseId: wh2.id } })

  const inventoryData = [
    // WH-HCM-01 Zone A (Electronics)
    { productId: createdProducts[0].id, warehouseId: wh1.id, zoneId: wh1Zones[0]?.id, quantity: 45, rack: 'R1', shelf: 'S1' },
    { productId: createdProducts[1].id, warehouseId: wh1.id, zoneId: wh1Zones[0]?.id, quantity: 3, rack: 'R1', shelf: 'S2' }, // LOW STOCK
    { productId: createdProducts[7].id, warehouseId: wh1.id, zoneId: wh1Zones[0]?.id, quantity: 12, rack: 'R2', shelf: 'S1' },
    { productId: createdProducts[10].id, warehouseId: wh1.id, zoneId: wh1Zones[0]?.id, quantity: 0, rack: 'R2', shelf: 'S2' }, // OUT OF STOCK
    // WH-HCM-01 Zone B (Clothing)
    { productId: createdProducts[2].id, warehouseId: wh1.id, zoneId: wh1Zones[1]?.id, quantity: 120, rack: 'R1', shelf: 'S1' },
    { productId: createdProducts[3].id, warehouseId: wh1.id, zoneId: wh1Zones[1]?.id, quantity: 15, rack: 'R1', shelf: 'S2' }, // LOW STOCK
    // WH-HCM-01 Zone C (Food)
    { productId: createdProducts[4].id, warehouseId: wh1.id, zoneId: wh1Zones[2]?.id, quantity: 200, rack: 'R1', shelf: 'S1' },
    { productId: createdProducts[5].id, warehouseId: wh1.id, zoneId: wh1Zones[2]?.id, quantity: 85, rack: 'R1', shelf: 'S2' },
    { productId: createdProducts[11].id, warehouseId: wh1.id, zoneId: wh1Zones[2]?.id, quantity: 60, rack: 'R2', shelf: 'S1' },
    // WH-HN-01
    { productId: createdProducts[0].id, warehouseId: wh2.id, zoneId: wh2Zones[0]?.id, quantity: 20, rack: 'R1', shelf: 'S1' },
    { productId: createdProducts[8].id, warehouseId: wh2.id, zoneId: wh2Zones[0]?.id, quantity: 150, rack: 'R2', shelf: 'S1' },
    { productId: createdProducts[9].id, warehouseId: wh2.id, zoneId: wh2Zones[1]?.id, quantity: 4, rack: 'R1', shelf: 'S1' }, // LOW STOCK
    { productId: createdProducts[6].id, warehouseId: wh2.id, zoneId: wh2Zones[1]?.id, quantity: 8, rack: 'R2', shelf: 'S1' },
    // WH-DN-01
    { productId: createdProducts[4].id, warehouseId: wh3.id, quantity: 300, rack: 'R1', shelf: 'S1' },
    { productId: createdProducts[5].id, warehouseId: wh3.id, quantity: 40, rack: 'R1', shelf: 'S2' },
  ]

  for (const item of inventoryData) {
    const existing = await prisma.inventoryItem.findFirst({
      where: {
        productId: item.productId,
        warehouseId: item.warehouseId,
        zoneId: item.zoneId || null,
        rack: item.rack || null,
        shelf: item.shelf || null,
      },
    })

    if (existing) {
      await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: { quantity: item.quantity },
      })
    } else {
      await prisma.inventoryItem.create({
        data: {
          productId: item.productId,
          warehouseId: item.warehouseId,
          zoneId: item.zoneId || null,
          rack: item.rack || null,
          shelf: item.shelf || null,
          quantity: item.quantity,
          lastAuditAt: new Date(),
          auditedById: admin.id,
        },
      })
    }
  }

  console.log('✅ Inventory seeded')

  // --- Stock Alerts for low stock items ---
  const lowStockAlerts = [
    { productId: createdProducts[1].id, alertType: 'LOW_STOCK' as const, severity: 'HIGH' as const, message: 'iPhone 15 Pro Max sắp hết hàng tại WH-HCM-01 (còn 3 chiếc)', currentQty: 3, threshold: 10 },
    { productId: createdProducts[10].id, alertType: 'OUT_OF_STOCK' as const, severity: 'CRITICAL' as const, message: 'Màn Hình LG 27 inch 4K đã hết hàng tại WH-HCM-01', currentQty: 0, threshold: 6 },
    { productId: createdProducts[3].id, alertType: 'LOW_STOCK' as const, severity: 'MEDIUM' as const, message: 'Quần Jeans Levi\'s sắp hết hàng tại WH-HCM-01 (còn 15 chiếc)', currentQty: 15, threshold: 20 },
    { productId: createdProducts[9].id, alertType: 'LOW_STOCK' as const, severity: 'HIGH' as const, message: 'Lốp Xe Bridgestone sắp hết hàng tại WH-HN-01 (còn 4 cái)', currentQty: 4, threshold: 10 },
  ]

  for (const alert of lowStockAlerts) {
    await prisma.stockAlert.create({ data: alert })
  }

  console.log('✅ Stock alerts seeded')

  // --- Shipments ---
  const shipment1 = await prisma.shipment.upsert({
    where: { shipmentCode: 'SHP-000001' },
    update: {},
    create: {
      shipmentCode: 'SHP-000001',
      status: 'IN_TRANSIT',
      driverId: driver1.id,
      createdById: admin.id,
      vehicleNumber: '51C-123.45',
      vehicleType: 'truck',
      originWarehouseId: wh1.id,
      destinationWarehouseId: wh2.id,
      originAddress: '123 Đường Nguyễn Văn Linh, Quận 7, TP. HCM',
      destinationAddress: '45 Đường Phạm Hùng, Nam Từ Liêm, Hà Nội',
      originLat: 10.7290, originLng: 106.7218,
      destinationLat: 21.0285, destinationLng: 105.8542,
      currentLat: 13.0827, currentLng: 108.2772,
      estimatedArrival: new Date(Date.now() + 8 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      totalDistance: 1726,
      notes: 'Giao hàng ưu tiên, cẩn thận hàng điện tử',
      items: {
        create: [
          { productId: createdProducts[0].id, quantity: 10, weight: 18 },
          { productId: createdProducts[7].id, quantity: 5, weight: 2.5 },
        ],
      },
      checkpoints: {
        create: [
          { name: 'Bình Dương', address: 'QL 13, Bình Dương', latitude: 11.0686, longitude: 106.6528, sequence: 1, isCompleted: true, arrivedAt: new Date(Date.now() - 5 * 60 * 60 * 1000) },
          { name: 'Đà Lạt', address: 'QL 20, Lâm Đồng', latitude: 11.9404, longitude: 108.4584, sequence: 2, isCompleted: true, arrivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
          { name: 'Buôn Ma Thuột', address: 'QL 14, Đắk Lắk', latitude: 12.6667, longitude: 108.0333, sequence: 3, isCompleted: false, estimatedAt: new Date(Date.now() + 1 * 60 * 60 * 1000) },
          { name: 'Pleiku', address: 'QL 14, Gia Lai', latitude: 13.9833, longitude: 108.0, sequence: 4, isCompleted: false, estimatedAt: new Date(Date.now() + 3 * 60 * 60 * 1000) },
          { name: 'Đà Nẵng', address: '78 Trần Phú, Hải Châu, Đà Nẵng', latitude: 16.0544, longitude: 108.2022, sequence: 5, isCompleted: false, estimatedAt: new Date(Date.now() + 5 * 60 * 60 * 1000) },
          { name: 'Hà Nội', address: '45 Phạm Hùng, Nam Từ Liêm, Hà Nội', latitude: 21.0285, longitude: 105.8542, sequence: 6, isCompleted: false, estimatedAt: new Date(Date.now() + 8 * 60 * 60 * 1000) },
        ],
      },
    },
  })

  await prisma.shipment.upsert({
    where: { shipmentCode: 'SHP-000002' },
    update: {},
    create: {
      shipmentCode: 'SHP-000002',
      status: 'PENDING',
      driverId: driver2.id,
      createdById: staff1.id,
      vehicleNumber: '43C-567.89',
      vehicleType: 'van',
      originWarehouseId: wh2.id,
      destinationWarehouseId: wh3.id,
      originAddress: '45 Đường Phạm Hùng, Nam Từ Liêm, Hà Nội',
      destinationAddress: '78 Đường Trần Phú, Hải Châu, Đà Nẵng',
      originLat: 21.0285, originLng: 105.8542,
      destinationLat: 16.0544, destinationLng: 108.2022,
      currentLat: 21.0285, currentLng: 105.8542,
      estimatedArrival: new Date(Date.now() + 24 * 60 * 60 * 1000),
      totalDistance: 764,
      items: {
        create: [
          { productId: createdProducts[2].id, quantity: 50, weight: 12.5 },
          { productId: createdProducts[4].id, quantity: 100, weight: 500 },
        ],
      },
      checkpoints: {
        create: [
          { name: 'Ninh Bình', address: 'QL 1A, Ninh Bình', latitude: 20.2506, longitude: 105.9748, sequence: 1, estimatedAt: new Date(Date.now() + 4 * 60 * 60 * 1000) },
          { name: 'Vinh', address: 'QL 1A, Nghệ An', latitude: 18.6697, longitude: 105.6881, sequence: 2, estimatedAt: new Date(Date.now() + 10 * 60 * 60 * 1000) },
          { name: 'Đà Nẵng', address: '78 Trần Phú, Đà Nẵng', latitude: 16.0544, longitude: 108.2022, sequence: 3, estimatedAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        ],
      },
    },
  })

  await prisma.shipment.upsert({
    where: { shipmentCode: 'SHP-000003' },
    update: {},
    create: {
      shipmentCode: 'SHP-000003',
      status: 'DELIVERED',
      driverId: driver1.id,
      createdById: admin.id,
      vehicleNumber: '51C-123.45',
      vehicleType: 'truck',
      originWarehouseId: wh3.id,
      destinationWarehouseId: wh1.id,
      originAddress: '78 Đường Trần Phú, Hải Châu, Đà Nẵng',
      destinationAddress: '123 Đường Nguyễn Văn Linh, Quận 7, TP. HCM',
      originLat: 16.0544, originLng: 108.2022,
      destinationLat: 10.7290, destinationLng: 106.7218,
      currentLat: 10.7290, currentLng: 106.7218,
      estimatedArrival: new Date(Date.now() - 2 * 60 * 60 * 1000),
      actualArrival: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 14 * 60 * 60 * 1000),
      totalDistance: 964,
      items: {
        create: [
          { productId: createdProducts[8].id, quantity: 200, weight: 30 },
          { productId: createdProducts[9].id, quantity: 20, weight: 170 },
        ],
      },
    },
  })

  // Tracking history for shipment 1
  const trackingPoints = [
    { lat: 10.7290, lng: 106.7218, desc: 'Xuất phát từ kho HCM' },
    { lat: 11.0686, lng: 106.6528, desc: 'Qua trạm Bình Dương' },
    { lat: 11.5, lng: 107.2, desc: 'Đang di chuyển' },
    { lat: 11.9404, lng: 108.4584, desc: 'Nghỉ tại Đà Lạt' },
    { lat: 13.0827, lng: 108.2772, desc: 'Đang trên đường' },
  ]
  for (const point of trackingPoints) {
    await prisma.trackingHistory.create({
      data: {
        shipmentId: shipment1.id,
        latitude: point.lat,
        longitude: point.lng,
        speed: 65 + Math.random() * 30,
        status: 'IN_TRANSIT',
        description: point.desc,
        recordedAt: new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000),
      },
    })
  }

  console.log('✅ Shipments seeded')
  console.log('\n🎉 Database seeded successfully!')
  console.log('📧 Admin: admin@logistiq.vn / admin123')
  console.log('📧 Manager: manager@logistiq.vn / staff123')
  console.log('📧 Staff: nam@logistiq.vn / staff123')
  console.log('📧 Driver: driver1@logistiq.vn / staff123')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
