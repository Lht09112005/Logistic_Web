import { body, validationResult } from 'express-validator'
import { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response'

export const validateResult = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const errorArray = errors.array()
    sendError(res, errorArray[0].msg, 400, errorArray)
    return
  }
  next()
}

// Authentication
export const validateRegister = [
  body('name').trim().notEmpty().withMessage('Họ tên không được để trống'),
  body('email').trim().isEmail().withMessage('Email không hợp lệ'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  body('role').optional().isIn(['ADMIN', 'MANAGER', 'STAFF', 'DRIVER']).withMessage('Vai trò không hợp lệ'),
  body('phone').optional().trim().notEmpty().withMessage('Số điện thoại không được để trống'),
  validateResult
]

export const validateLogin = [
  body('email').trim().isEmail().withMessage('Email không hợp lệ'),
  body('password').notEmpty().withMessage('Mật khẩu không được để trống'),
  validateResult
]

export const validateForgotPassword = [
  body('email').trim().isEmail().withMessage('Email không hợp lệ'),
  validateResult
]

export const validateResetPassword = [
  body('token').notEmpty().withMessage('Token không được để trống'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  validateResult
]

export const validateUpdateMe = [
  body('name').optional().trim().notEmpty().withMessage('Họ tên không được để trống'),
  body('email').optional().trim().isEmail().withMessage('Email không hợp lệ'),
  body('phone').optional().trim().notEmpty().withMessage('Số điện thoại không được để trống'),
  body('password').optional().isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  body('oldPassword').optional().notEmpty().withMessage('Mật khẩu hiện tại không được để trống'),
  validateResult
]

// Users (Admin routes)
export const validateCreateUser = [
  body('name').trim().notEmpty().withMessage('Họ tên không được để trống'),
  body('email').trim().isEmail().withMessage('Email không hợp lệ'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  body('role').isIn(['ADMIN', 'MANAGER', 'STAFF', 'DRIVER']).withMessage('Vai trò không hợp lệ'),
  body('phone').optional().trim().notEmpty().withMessage('Số điện thoại không được để trống'),
  validateResult
]

export const validateUpdateUser = [
  body('name').optional().trim().notEmpty().withMessage('Họ tên không được để trống'),
  body('email').optional().trim().isEmail().withMessage('Email không hợp lệ'),
  body('password').optional().isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  body('role').optional().isIn(['ADMIN', 'MANAGER', 'STAFF', 'DRIVER']).withMessage('Vai trò không hợp lệ'),
  body('phone').optional().trim().notEmpty().withMessage('Số điện thoại không được để trống'),
  validateResult
]

// Product
export const validateCreateProduct = [
  body('name').trim().notEmpty().withMessage('Tên sản phẩm không được để trống'),
  body('sku').trim().notEmpty().withMessage('Mã SKU không được để trống'),
  body('category').isIn(['ELECTRONICS', 'CLOTHING', 'FOOD', 'FURNITURE', 'MEDICAL', 'AUTOMOTIVE', 'CHEMICAL', 'OTHER']).withMessage('Danh mục không hợp lệ'),
  body('unit').trim().notEmpty().withMessage('Đơn vị tính không được để trống'),
  body('weight').optional().isFloat({ min: 0 }).withMessage('Cân nặng phải là số dương'),
  body('length').optional().isFloat({ min: 0 }).withMessage('Chiều dài phải là số dương'),
  body('width').optional().isFloat({ min: 0 }).withMessage('Chiều rộng phải là số dương'),
  body('height').optional().isFloat({ min: 0 }).withMessage('Chiều cao phải là số dương'),
  body('minStockLevel').optional().isInt({ min: 0 }).withMessage('Ngưỡng tồn kho tối thiểu phải là số nguyên không âm'),
  body('maxStockLevel').optional().isInt({ min: 0 }).withMessage('Ngưỡng tồn kho tối đa phải là số nguyên không âm'),
  body('costPrice').optional().isFloat({ min: 0 }).withMessage('Giá vốn phải là số dương'),
  body('sellPrice').optional().isFloat({ min: 0 }).withMessage('Giá bán phải là số dương'),
  validateResult
]

export const validateUpdateProduct = [
  body('name').optional().trim().notEmpty().withMessage('Tên sản phẩm không được để trống'),
  body('sku').optional().trim().notEmpty().withMessage('Mã SKU không được để trống'),
  body('category').optional().isIn(['ELECTRONICS', 'CLOTHING', 'FOOD', 'FURNITURE', 'MEDICAL', 'AUTOMOTIVE', 'CHEMICAL', 'OTHER']).withMessage('Danh mục không hợp lệ'),
  body('unit').optional().trim().notEmpty().withMessage('Đơn vị tính không được để trống'),
  body('weight').optional().isFloat({ min: 0 }).withMessage('Cân nặng phải là số dương'),
  body('length').optional().isFloat({ min: 0 }).withMessage('Chiều dài phải là số dương'),
  body('width').optional().isFloat({ min: 0 }).withMessage('Chiều rộng phải là số dương'),
  body('height').optional().isFloat({ min: 0 }).withMessage('Chiều cao phải là số dương'),
  body('minStockLevel').optional().isInt({ min: 0 }).withMessage('Ngưỡng tồn kho tối thiểu phải là số nguyên không âm'),
  body('maxStockLevel').optional().isInt({ min: 0 }).withMessage('Ngưỡng tồn kho tối đa phải là số nguyên không âm'),
  body('costPrice').optional().isFloat({ min: 0 }).withMessage('Giá vốn phải là số dương'),
  body('sellPrice').optional().isFloat({ min: 0 }).withMessage('Giá bán phải là số dương'),
  validateResult
]

// Warehouse
export const validateCreateWarehouse = [
  body('name').trim().notEmpty().withMessage('Tên kho không được để trống'),
  body('code').trim().notEmpty().withMessage('Mã kho không được để trống'),
  body('address').trim().notEmpty().withMessage('Địa chỉ không được để trống'),
  body('city').trim().notEmpty().withMessage('Thành phố không được để trống'),
  body('province').trim().notEmpty().withMessage('Tỉnh/Thành không được để trống'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Vĩ độ không hợp lệ'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Kinh độ không hợp lệ'),
  body('capacity').optional().isFloat({ min: 0 }).withMessage('Sức chứa phải là số dương'),
  body('managerId').optional().trim().notEmpty().withMessage('ID quản lý không hợp lệ'),
  body('staffId').optional().trim().notEmpty().withMessage('ID nhân viên không hợp lệ'),
  validateResult
]

export const validateUpdateWarehouse = [
  body('name').optional().trim().notEmpty().withMessage('Tên kho không được để trống'),
  body('code').optional().trim().notEmpty().withMessage('Mã kho không được để trống'),
  body('address').optional().trim().notEmpty().withMessage('Địa chỉ không được để trống'),
  body('city').optional().trim().notEmpty().withMessage('Thành phố không được để trống'),
  body('province').optional().trim().notEmpty().withMessage('Tỉnh/Thành không được để trống'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Vĩ độ không hợp lệ'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Kinh độ không hợp lệ'),
  body('capacity').optional().isFloat({ min: 0 }).withMessage('Sức chứa phải là số dương'),
  body('managerId').optional().trim().notEmpty().withMessage('ID quản lý không hợp lệ'),
  body('staffId').optional().trim().notEmpty().withMessage('ID nhân viên không hợp lệ'),
  validateResult
]

// Inventory
export const validateCreateInventory = [
  body('productId').trim().notEmpty().withMessage('ID sản phẩm không được để trống'),
  body('warehouseId').trim().notEmpty().withMessage('ID kho hàng không được để trống'),
  body('quantity').isInt({ min: 0 }).withMessage('Số lượng tồn kho phải là số nguyên không âm'),
  body('zoneName').optional().trim().notEmpty().withMessage('Tên phân khu không được để trống'),
  validateResult
]

export const validateUpdateInventory = [
  body('quantity').isInt({ min: 0 }).withMessage('Số lượng tồn kho phải là số nguyên không âm'),
  body('zoneName').optional().trim().notEmpty().withMessage('Tên phân khu không được để trống'),
  validateResult
]

// Shipment
export const validateCreateShipment = [
  body('driverId').trim().notEmpty().withMessage('Vui lòng chọn tài xế'),
  body('originWarehouseId').trim().notEmpty().withMessage('Vui lòng chọn kho gửi hàng'),
  body('destinationWarehouseId').trim().notEmpty().withMessage('Vui lòng chọn kho nhận hàng'),
  body('vehicleNumber').trim().notEmpty().withMessage('Vui lòng nhập biển số xe'),
  body('estimatedDelivery').optional().isISO8601().withMessage('Thời gian giao hàng ước tính không hợp lệ'),
  body('items').isArray({ min: 1 }).withMessage('Vui lòng thêm ít nhất một sản phẩm vào chuyến hàng'),
  body('items.*.productId').trim().notEmpty().withMessage('Sản phẩm không hợp lệ'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Số lượng sản phẩm vận chuyển phải lớn hơn 0'),
  validateResult
]
