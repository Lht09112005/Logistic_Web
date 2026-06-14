import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../config/database'

interface ProductQuery {
  page?: number
  limit?: number
  search?: string
  category?: string
  isActive?: boolean
}

export async function getProducts(query: ProductQuery) {
  const page = query.page || 1
  const limit = query.limit || 20
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' as const } },
      { sku: { contains: query.search, mode: 'insensitive' as const } },
    ]
  }
  if (query.category) where.category = query.category
  if (query.isActive !== undefined) where.isActive = query.isActive

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { inventory: true } } },
    }),
    prisma.product.count({ where }),
  ])

  return { products, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      inventory: {
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          zone: true,
        },
      },
      alerts: { where: { isResolved: false }, orderBy: { createdAt: 'desc' } },
    },
  })

  if (!product) {
    throw Object.assign(new Error('Không tìm thấy sản phẩm'), { statusCode: 404 })
  }

  return product
}

export async function createProduct(data: {
  name: string
  sku: string
  barcode?: string
  category?: string
  description?: string
  unit: string
  weight?: number
  length?: number
  width?: number
  height?: number
  imageUrl?: string
  qrCode?: string
  minStockLevel?: number
  maxStockLevel?: number
  costPrice?: number
  sellPrice?: number
}) {
  const qrCode = data.qrCode || `LOGISTIQ-${uuidv4().substring(0, 8).toUpperCase()}`

  try {
    return await prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        category: data.category || 'OTHER',
        description: data.description,
        unit: data.unit,
        weight: data.weight,
        length: data.length,
        width: data.width,
        height: data.height,
        imageUrl: data.imageUrl,
        qrCode,
        minStockLevel: data.minStockLevel || 10,
        maxStockLevel: data.maxStockLevel,
        costPrice: data.costPrice,
        sellPrice: data.sellPrice,
      },
    })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      throw Object.assign(new Error('SKU hoặc barcode đã tồn tại'), { statusCode: 409 })
    }
    throw error
  }
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  try {
    return await prisma.product.update({
      where: { id },
      data,
    })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2025') {
      throw Object.assign(new Error('Không tìm thấy sản phẩm'), { statusCode: 404 })
    }
    throw error
  }
}

export async function deleteProduct(id: string) {
  try {
    return await prisma.product.update({
      where: { id },
      data: { isActive: false },
    })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2025') {
      throw Object.assign(new Error('Không tìm thấy sản phẩm'), { statusCode: 404 })
    }
    throw error
  }
}

export async function getProductByQR(qrCode: string) {
  const product = await prisma.product.findFirst({
    where: { qrCode },
    include: {
      inventory: {
        include: { warehouse: { select: { id: true, name: true, code: true } } },
      },
    },
  })

  if (!product) {
    throw Object.assign(new Error('Không tìm thấy sản phẩm với QR này'), { statusCode: 404 })
  }

  return product
}

export async function getProductByBarcode(barcode: string) {
  const product = await prisma.product.findFirst({
    where: { barcode },
    include: {
      inventory: {
        include: { warehouse: { select: { id: true, name: true, code: true } } },
      },
    },
  })

  if (!product) {
    throw Object.assign(new Error('Không tìm thấy sản phẩm với mã vạch này'), { statusCode: 404 })
  }

  return product
}
