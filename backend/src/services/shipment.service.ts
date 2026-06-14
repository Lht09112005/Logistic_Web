import { prisma } from '../config/database'

interface ShipmentQuery {
  page?: number
  limit?: number
  status?: string
  driverId?: string
  search?: string
  role?: string
  userId?: string
}

/**
 * Helper: resolve warehouse IDs accessible by MANAGER/STAFF.
 */
async function getUserWhIds(role: string | undefined, userId: string | undefined): Promise<string[] | null> {
  if (role === 'MANAGER') {
    return (await prisma.warehouse.findMany({
      where: { managerId: userId },
      select: { id: true },
    })).map(w => w.id)
  }
  if (role === 'STAFF') {
    return (await prisma.warehouse.findMany({
      where: { staffId: userId },
      select: { id: true },
    })).map(w => w.id)
  }
  return null
}

async function buildShipmentWhere(query: ShipmentQuery): Promise<Record<string, unknown>> {
  const where: Record<string, unknown> = {}

  if (query.status) {
    const statusValues = query.status.split(',').filter(Boolean)
    where.status = statusValues.length === 1 ? statusValues[0] : { in: statusValues }
  }
  if (query.driverId) where.driverId = query.driverId

  const searchOr: Record<string, unknown>[] | null = query.search
    ? [
        { shipmentCode: { contains: query.search, mode: 'insensitive' as const } },
        { originAddress: { contains: query.search, mode: 'insensitive' as const } },
        { destinationAddress: { contains: query.search, mode: 'insensitive' as const } },
      ]
    : null

  const role = query.role
  const userId = query.userId

  if (role === 'DRIVER') {
    where.driverId = userId || 'none'
    if (searchOr) where.OR = searchOr
  } else if (role === 'MANAGER' || role === 'STAFF') {
    const whIds = (await getUserWhIds(role, userId)) || []
    if (whIds.length > 0) {
      const roleOr = [
        { originWarehouseId: { in: whIds } },
        { destinationWarehouseId: { in: whIds } },
      ]
      if (searchOr) {
        where.AND = [{ OR: searchOr }, { OR: roleOr }]
      } else {
        where.OR = roleOr
      }
    } else {
      where.id = 'none'
    }
  } else if (searchOr) {
    where.OR = searchOr
  }

  return where
}

export async function getShipments(query: ShipmentQuery) {
  const where = await buildShipmentWhere(query)
  const page = query.page || 1
  const limit = query.limit || 20

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { select: { id: true, name: true, phone: true, avatar: true } },
        createdBy: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, unit: true } } } },
        checkpoints: { orderBy: { sequence: 'asc' } },
        _count: { select: { items: true, checkpoints: true } },
      },
    }),
    prisma.shipment.count({ where }),
  ])

  return { shipments, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getShipmentById(id: string, role?: string, userId?: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      driver: { select: { id: true, name: true, phone: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
      originWarehouse: { select: { id: true, name: true, code: true, address: true } },
      destinationWarehouse: { select: { id: true, name: true, code: true, address: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, weight: true } } } },
      checkpoints: { orderBy: { sequence: 'asc' } },
      trackingHistory: { orderBy: { recordedAt: 'desc' }, take: 50 },
    },
  })

  if (!shipment) {
    throw Object.assign(new Error('Không tìm thấy vận đơn'), { statusCode: 404 })
  }

  if (role === 'DRIVER' && shipment.driverId !== userId) {
    throw Object.assign(new Error('Bạn không có quyền xem vận đơn này'), { statusCode: 403 })
  }

  return shipment
}

async function generateShipmentCode(): Promise<string> {
  const count = await prisma.shipment.count()
  return `SHP-${String(count + 1).padStart(6, '0')}`
}

export async function createShipment(data: {
  driverId: string
  vehicleNumber: string
  vehicleType: string
  originWarehouseId?: string
  destinationWarehouseId?: string
  originAddress: string
  destinationAddress: string
  originLat?: number
  originLng?: number
  destinationLat?: number
  destinationLng?: number
  estimatedArrival?: string
  items?: { productId: string; quantity: number; weight?: number; notes?: string }[]
  checkpoints?: { name: string; address: string; latitude?: number; longitude?: number; sequence: number; estimatedAt?: string }[]
  notes?: string
  createdById: string
}) {
  const missingFields: string[] = []
  if (!data.driverId) missingFields.push('Tài xế')
  if (!data.vehicleType) missingFields.push('Loại phương tiện')
  if (!data.vehicleNumber) missingFields.push('Biển số xe')
  if (!data.estimatedArrival) missingFields.push('Ngày giao dự kiến')

  if (missingFields.length > 0) {
    throw Object.assign(new Error(`Vui lòng nhập các thông tin bắt buộc: ${missingFields.join(', ')}.`), { statusCode: 400 })
  }

  const shipmentCode = await generateShipmentCode()

  const shipment = await prisma.shipment.create({
    data: {
      shipmentCode,
      driverId: data.driverId,
      createdById: data.createdById,
      vehicleNumber: data.vehicleNumber,
      vehicleType: data.vehicleType,
      originWarehouseId: data.originWarehouseId,
      destinationWarehouseId: data.destinationWarehouseId,
      originAddress: data.originAddress,
      destinationAddress: data.destinationAddress,
      originLat: data.originLat,
      originLng: data.originLng,
      destinationLat: data.destinationLat,
      destinationLng: data.destinationLng,
      currentLat: data.originLat,
      currentLng: data.originLng,
      estimatedArrival: data.estimatedArrival ? new Date(data.estimatedArrival) : undefined,
      notes: data.notes,
      items: { create: (data.items || []).map(item => ({ productId: item.productId, quantity: item.quantity, weight: item.weight, notes: item.notes })) },
      checkpoints: { create: (data.checkpoints || []).map((cp, idx) => ({ name: cp.name, address: cp.address, latitude: cp.latitude, longitude: cp.longitude, sequence: cp.sequence || idx + 1, estimatedAt: cp.estimatedAt ? new Date(cp.estimatedAt) : undefined })) },
    },
    include: {
      driver: { select: { id: true, name: true, phone: true } },
      items: { include: { product: { select: { id: true, name: true } } } },
      checkpoints: { orderBy: { sequence: 'asc' } },
    },
  })

  // Notify admins
  await notifyAdmins(shipment.id, shipmentCode)

  return shipment
}

async function notifyAdmins(shipmentId: string, shipmentCode: string) {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    for (const admin of admins) {
      const notif = await prisma.notification.create({
        data: {
          userId: admin.id,
          title: 'Vận đơn mới cần duyệt',
          message: `Vận đơn ${shipmentCode} vừa được tạo và đang chờ duyệt.`,
          type: 'INFO',
          link: `/dashboard/shipments/${shipmentId}`,
        },
      })
      // Dynamic import to avoid circular dependency
      import('../index').then(({ io }) => { io.emit(`notification:${admin.id}`, notif) })
    }
  } catch (err) {
    console.error('[ShipmentService] Failed to notify admins:', err)
  }
}

export async function updateShipment(
  id: string,
  data: {
    status?: string
    currentLat?: number
    currentLng?: number
    vehicleNumber?: string
    estimatedArrival?: string
    notes?: string
    checkpoints?: { id: string; isCompleted?: boolean; arrivedAt?: string }[]
  },
  userId: string,
  userRole: string
) {
  const existing = await prisma.shipment.findUnique({
    where: { id },
    select: {
      id: true, driverId: true, originWarehouseId: true, destinationWarehouseId: true,
      shipmentCode: true,
      destinationWarehouse: { select: { id: true, name: true, managerId: true, staffId: true } },
    },
  })

  if (!existing) {
    throw Object.assign(new Error('Không tìm thấy vận đơn'), { statusCode: 404 })
  }

  if (userRole === 'DRIVER' && existing.driverId !== userId) {
    throw Object.assign(new Error('Bạn không có quyền cập nhật vận đơn này'), { statusCode: 403 })
  }

  const updateData: Record<string, unknown> = {}
  if (data.status) updateData.status = data.status
  if (data.vehicleNumber) updateData.vehicleNumber = data.vehicleNumber
  if (data.estimatedArrival) updateData.estimatedArrival = new Date(data.estimatedArrival)
  if (data.notes !== undefined) updateData.notes = data.notes

  // Tracking history
  if (data.currentLat !== undefined && data.currentLng !== undefined) {
    updateData.currentLat = data.currentLat
    updateData.currentLng = data.currentLng
    await prisma.trackingHistory.create({
      data: {
        shipmentId: id, latitude: data.currentLat, longitude: data.currentLng,
        status: data.status || undefined,
        description: data.status ? `Trạng thái: ${data.status}` : 'Cập nhật vị trí',
      },
    })
  }

  if (data.status === 'IN_TRANSIT') updateData.startedAt = new Date()
  if (data.status === 'DELIVERED') updateData.actualArrival = new Date()

  // Handle checkpoint updates
  const completedNames: { id: string; name: string }[] = []
  if (data.checkpoints?.length) {
    for (const cp of data.checkpoints) {
      if (!cp.id) continue
      const cpData: Record<string, unknown> = {}
      if (cp.isCompleted !== undefined) cpData.isCompleted = cp.isCompleted
      if (cp.isCompleted) cpData.arrivedAt = cp.arrivedAt ? new Date(cp.arrivedAt) : new Date()
      if (Object.keys(cpData).length > 0) {
        const updatedCp = await prisma.shipmentCheckpoint.update({ where: { id: cp.id }, data: cpData })
        if (cp.isCompleted) completedNames.push({ id: updatedCp.id, name: updatedCp.name })
      }
    }
  }

  const shipment = await prisma.shipment.update({
    where: { id },
    data: updateData,
    include: {
      driver: { select: { id: true, name: true, phone: true } },
      checkpoints: { orderBy: { sequence: 'asc' } },
    },
  })

  // Incident notifications
  if (data.notes?.includes('[SỰ CỐ')) {
    await notifyIncident(id, shipment.shipmentCode, data.notes, shipment.originWarehouseId, shipment.destinationWarehouseId)
  }

  // Realtime checkpoint notifications
  if (completedNames.length > 0 && existing.destinationWarehouseId) {
    emitCheckpointEvents(id, existing.shipmentCode, completedNames, existing.destinationWarehouseId, existing.destinationWarehouse?.name)
  }

  // Position broadcast
  if (data.currentLat !== undefined && data.currentLng !== undefined) {
    emitPositionEvents(id, data.currentLat, data.currentLng, data.status, existing.originWarehouseId, existing.destinationWarehouseId)
  }

  return shipment
}

async function notifyIncident(
  shipmentId: string, shipmentCode: string,
  notes: string, originId?: string | null, destId?: string | null
) {
  try {
    const managers = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'ADMIN' },
          { role: 'MANAGER', managedWarehouses: { some: { id: { in: [originId, destId].filter(Boolean) as string[] } } } },
        ],
      },
    })

    const incidentMessage = notes.split(']')[1]?.trim() || notes
    const notifications = managers.map(user => ({
      userId: user.id,
      title: `Sự cố chuyến ${shipmentCode}`,
      message: incidentMessage,
      type: 'ERROR' as const,
      link: `/dashboard/shipments/${shipmentId}`,
    }))

    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications })
      const { io } = await import('../index')
      notifications.forEach(n => {
        io.emit(`notification:${n.userId}`, { ...n, id: Date.now().toString() + Math.random().toString(36).substring(7), isRead: false, createdAt: new Date().toISOString() })
      })
    }
  } catch (err) {
    console.error('[ShipmentService] Incident notification error:', err)
  }
}

function emitCheckpointEvents(
  shipmentId: string, shipmentCode: string,
  checkpoints: { id: string; name: string }[],
  destWhId: string, destWhName?: string
) {
  import('../index').then(({ io }) => {
    for (const cp of checkpoints) {
      const payload = {
        shipmentId, shipmentCode, checkpointId: cp.id, checkpointName: cp.name,
        destinationWarehouseId: destWhId, destinationWarehouseName: destWhName,
        timestamp: new Date().toISOString(),
      }
      io.to(`shipment:${shipmentId}`).emit('checkpoint:completed', payload)
      io.to(`warehouse:${destWhId}`).emit('shipment:checkpoint_update', payload)
    }
  }).catch(err => console.error('[ShipmentService] Socket emit error:', err))
}

function emitPositionEvents(
  shipmentId: string, lat: number, lng: number, status: string | undefined,
  originId?: string | null, destId?: string | null
) {
  import('../index').then(({ io }) => {
    const payload = { shipmentId, latitude: lat, longitude: lng, status }
    io.to(`shipment:${shipmentId}`).emit('shipment:position', payload)
    if (originId) io.to(`warehouse:${originId}`).emit('shipment:position', payload)
    if (destId) io.to(`warehouse:${destId}`).emit('shipment:position', payload)
  }).catch(err => console.error('[ShipmentService] Socket emit error:', err))
}

export async function receiveShipment(id: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, destinationWarehouse: true },
  })

  if (!shipment) throw Object.assign(new Error('Không tìm thấy vận đơn'), { statusCode: 404 })
  if (shipment.status === 'DELIVERED') return { shipment, inventoryItems: [] }
  if (shipment.status !== 'DELIVERING' && shipment.status !== 'IN_TRANSIT') {
    throw Object.assign(new Error('Vận đơn chưa đến kho đích'), { statusCode: 400 })
  }
  if (!shipment.destinationWarehouseId) {
    throw Object.assign(new Error('Vận đơn không có kho đích'), { statusCode: 400 })
  }

  const inventoryResults = []
  for (const item of shipment.items) {
    const existing = await prisma.inventoryItem.findFirst({
      where: { productId: item.productId, warehouseId: shipment.destinationWarehouseId! },
      include: { product: true },
    })

    if (existing) {
      const newQty = existing.quantity + item.quantity
      const updated = await prisma.inventoryItem.update({ where: { id: existing.id }, data: { quantity: newQty } })
      inventoryResults.push(updated)
      if (newQty >= existing.product.minStockLevel) {
        await prisma.stockAlert.updateMany({
          where: { productId: item.productId, warehouseId: shipment.destinationWarehouseId!, isResolved: false },
          data: { isResolved: true, resolvedAt: new Date() },
        })
      }
    } else {
      const created = await prisma.inventoryItem.create({
        data: { productId: item.productId, warehouseId: shipment.destinationWarehouseId!, quantity: item.quantity },
      })
      inventoryResults.push(created)
    }
  }

  const updated = await prisma.shipment.update({
    where: { id }, data: { status: 'DELIVERED', actualArrival: new Date() },
    include: { driver: { select: { id: true, name: true, phone: true } }, checkpoints: { orderBy: { sequence: 'asc' } } },
  })

  return { shipment: updated, inventoryItems: inventoryResults }
}

export async function approveShipment(id: string, userId: string, userRole: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { originWarehouse: { select: { id: true, managerId: true } }, items: true },
  })

  if (!shipment) throw Object.assign(new Error('Không tìm thấy vận đơn'), { statusCode: 404 })
  if (shipment.status !== 'PENDING') {
    throw Object.assign(new Error('Chỉ có thể duyệt vận đơn đang ở trạng thái chờ'), { statusCode: 400 })
  }

  if (userRole !== 'ADMIN') {
    if (!shipment.originWarehouse || shipment.originWarehouse.managerId !== userId) {
      throw Object.assign(new Error('Bạn không có quyền duyệt vận đơn này. Chỉ quản lý kho nguồn mới có thể duyệt.'), { statusCode: 403 })
    }
  }

  // Reserve inventory
  if (shipment.originWarehouseId && shipment.items.length > 0) {
    for (const item of shipment.items) {
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: { productId: item.productId, warehouseId: shipment.originWarehouseId, quantity: { gt: 0 } },
        orderBy: { quantity: 'desc' },
      })
      const totalAvailable = inventoryItems.reduce((sum, inv) => sum + (inv.quantity - inv.reservedQty), 0)
      if (totalAvailable < item.quantity) {
        throw Object.assign(new Error(`Kho nguồn không đủ hàng. Yêu cầu ${item.quantity}, khả dụng ${totalAvailable}`), { statusCode: 400 })
      }
      let remaining = item.quantity
      for (const inv of inventoryItems) {
        if (remaining <= 0) break
        const available = inv.quantity - inv.reservedQty
        if (available <= 0) continue
        const toReserve = Math.min(remaining, available)
        await prisma.inventoryItem.update({ where: { id: inv.id }, data: { reservedQty: inv.reservedQty + toReserve } })
        remaining -= toReserve
      }
    }
  }

  const updated = await prisma.shipment.update({
    where: { id }, data: { status: 'CONFIRMED' },
    include: { driver: { select: { id: true, name: true, phone: true } }, checkpoints: { orderBy: { sequence: 'asc' } } },
  })

  // Notifications
  await notifyApproval(id, shipment.shipmentCode, shipment.createdById, shipment.driverId, userId)

  return updated
}

async function notifyApproval(shipmentId: string, code: string, createdById: string, driverId?: string | null, actorId?: string) {
  try {
    if (createdById !== actorId) {
      const n1 = await prisma.notification.create({
        data: { userId: createdById, title: 'Vận đơn đã được duyệt', message: `Vận đơn ${code} đã được duyệt.`, type: 'SUCCESS', link: `/dashboard/shipments/${shipmentId}` },
      })
      import('../index').then(({ io }) => io.emit(`notification:${createdById}`, n1))
    }
    if (driverId) {
      const n2 = await prisma.notification.create({
        data: { userId: driverId, title: 'Được phân công chuyến xe mới', message: `Bạn được phân công vận chuyển mã ${code}.`, type: 'INFO', link: `/dashboard/shipments/${shipmentId}` },
      })
      import('../index').then(({ io }) => io.emit(`notification:${driverId}`, n2))
    }
  } catch (err) {
    console.error('[ShipmentService] Approval notification error:', err)
  }
}

export async function rejectShipment(id: string, reason: string, userId: string, userRole: string) {
  if (!reason?.trim()) {
    throw Object.assign(new Error('Vui lòng cung cấp lý do từ chối'), { statusCode: 400 })
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { originWarehouse: { select: { id: true, managerId: true } } },
  })

  if (!shipment) throw Object.assign(new Error('Không tìm thấy vận đơn'), { statusCode: 404 })
  if (shipment.status !== 'PENDING') {
    throw Object.assign(new Error('Chỉ có thể từ chối vận đơn đang ở trạng thái chờ'), { statusCode: 400 })
  }

  if (userRole !== 'ADMIN') {
    if (!shipment.originWarehouse || shipment.originWarehouse.managerId !== userId) {
      throw Object.assign(new Error('Bạn không có quyền từ chối vận đơn này'), { statusCode: 403 })
    }
  }

  const updated = await prisma.shipment.update({
    where: { id }, data: { status: 'CANCELLED', rejectionReason: reason },
    include: { driver: { select: { id: true, name: true, phone: true } }, checkpoints: { orderBy: { sequence: 'asc' } } },
  })

  // Notify creator
  if (shipment.createdById !== userId) {
    const notif = await prisma.notification.create({
      data: { userId: shipment.createdById, title: 'Vận đơn bị từ chối', message: `Vận đơn ${shipment.shipmentCode} đã bị từ chối. Lý do: ${reason}`, type: 'ERROR', link: `/dashboard/shipments/${shipment.id}` },
    })
    import('../index').then(({ io }) => io.emit(`notification:${shipment.createdById}`, notif))
  }

  return updated
}

export async function startLoadingShipment(id: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { originWarehouse: { select: { id: true, managerId: true } }, items: true },
  })

  if (!shipment) throw Object.assign(new Error('Không tìm thấy vận đơn'), { statusCode: 404 })
  if (shipment.status !== 'CONFIRMED') {
    throw Object.assign(new Error('Chỉ có thể xếp hàng cho vận đơn đã duyệt'), { statusCode: 400 })
  }

  // Deduct inventory
  if (shipment.originWarehouseId && shipment.items.length > 0) {
    for (const item of shipment.items) {
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: { productId: item.productId, warehouseId: shipment.originWarehouseId, reservedQty: { gte: 1 } },
        orderBy: { reservedQty: 'desc' },
      })
      let remaining = item.quantity
      for (const inv of inventoryItems) {
        if (remaining <= 0) break
        const toDeduct = Math.min(remaining, inv.reservedQty, inv.quantity)
        await prisma.inventoryItem.update({
          where: { id: inv.id },
          data: { quantity: inv.quantity - toDeduct, reservedQty: inv.reservedQty - toDeduct },
        })
        remaining -= toDeduct
      }
    }
  }

  return prisma.shipment.update({ where: { id }, data: { status: 'LOADING' } })
}

export async function getShipmentStats(role?: string, userId?: string) {
  let roleWhere: Record<string, unknown> = {}

  if (role === 'DRIVER') {
    roleWhere = { driverId: userId || 'none' }
  } else if (role === 'MANAGER' || role === 'STAFF') {
    const whIds = (await getUserWhIds(role, userId)) || []
    if (whIds.length > 0) {
      roleWhere = { OR: [{ originWarehouseId: { in: whIds } }, { destinationWarehouseId: { in: whIds } }] }
    } else {
      roleWhere = { id: 'none' }
    }
  }

  // Single groupBy query
  const grouped = await prisma.shipment.groupBy({
    by: ['status'],
    where: roleWhere,
    _count: { status: true },
  })

  const counts: Record<string, number> = { total: 0, inTransit: 0, delivered: 0, pending: 0, failed: 0 }
  for (const g of grouped) {
    let key = g.status.toLowerCase()
    if (g.status === 'IN_TRANSIT' || g.status === 'LOADING' || g.status === 'DELIVERING') {
      key = 'inTransit'
    }
    if (counts[key] !== undefined) {
      counts[key] += g._count.status
    }
    counts.total += g._count.status
  }

  // Pending for current user
  let pendingForCurrentUser = 0
  if (userId) {
    const userWhs = await prisma.warehouse.findMany({ where: { managerId: userId }, select: { id: true } })
    const whIds = userWhs.map(w => w.id)
    if (whIds.length > 0) {
      pendingForCurrentUser = await prisma.shipment.count({ where: { status: 'PENDING', originWarehouseId: { in: whIds } } })
    }
  }

  return { ...counts, pendingForCurrentUser }
}
