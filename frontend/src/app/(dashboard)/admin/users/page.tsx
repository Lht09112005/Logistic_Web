"use client";

import { useEffect, useState, useCallback } from "react";
import { usersApi, warehousesApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Users, Search, Plus, Shield, ShieldCheck,
  ShieldAlert, Calendar,
  Edit3, Trash2, X, AlertTriangle,
  UserCheck, UserX, RefreshCw, Warehouse,
} from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";

interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
  phone?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  phone: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
  city: string;
  manager: { id: string; name: string } | null;
  staff: { id: string; name: string } | null;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý kho",
  STAFF: "Nhân viên",
  DRIVER: "Tài xế",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#ef4444",
  MANAGER: "#8b5cf6",
  STAFF: "#6366f1",
  DRIVER: "#f97316",
};

const ROLE_BG: Record<string, string> = {
  ADMIN: "#fef2f2",
  MANAGER: "#f5f3ff",
  STAFF: "#eef2ff",
  DRIVER: "#fff7ed",
};

const emptyForm: UserForm = { name: "", email: "", password: "", role: "STAFF", phone: "" };

function AdminUsersContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<{ type: "DELETE" | "TOGGLE_ACTIVE"; user: User } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  // Warehouse assignment state
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  const limit = 15;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAll({
        page,
        limit,
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
      });
      setUsers(res.data.data.data || []);
      setTotal(res.data.data.meta?.total || 0);
      setTotalPages(res.data.data.meta?.totalPages || 1);
    } catch {
      // Offline/error — show empty
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setFormError("");
    setFieldErrors({});
    setSelectedWarehouseId("");
    fetchWarehouses();
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      phone: user.phone || "",
    });
    setFormError("");
    setFieldErrors({});

    // Fetch warehouses and pre-select the one managed by this user
    fetchWarehouses(user);
    setModalOpen(true);
  };

  // Fetch all warehouses with manager info
  const fetchWarehouses = (editUser?: User | null) => {
    setWarehousesLoading(true);
    warehousesApi.getAll().then((res) => {
      const list = (res.data.data || []) as WarehouseOption[];
      setWarehouses(list);

      // Pre-select the warehouse managed/staffed by the user being edited
      if (editUser) {
        const wh = list.find((w) => w.manager?.id === editUser.id || w.staff?.id === editUser.id);
        setSelectedWarehouseId(wh?.id || "");
      }
    }).catch(() => {}).finally(() => {
      setWarehousesLoading(false);
    });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Name validation
    if (!form.name.trim()) {
      errors.name = "Vui lòng nhập họ tên";
    } else if (form.name.trim().length < 2) {
      errors.name = "Họ tên phải có ít nhất 2 ký tự";
    }

    // Email validation
    if (!form.email.trim()) {
      errors.email = "Vui lòng nhập email";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        errors.email = "Email không hợp lệ";
      }
    }

    // Password validation (only for new users, or when changing password)
    if (!editingUser && !form.password.trim()) {
      errors.password = "Vui lòng nhập mật khẩu";
    } else if (form.password.trim() && form.password.trim().length < 6) {
      errors.password = "Mật khẩu phải có ít nhất 6 ký tự";
    }

    // Phone validation (optional but must be valid if provided)
    if (form.phone.trim()) {
      const phoneRegex = /^(0[35789])\d{8}$/;
      if (!phoneRegex.test(form.phone.trim())) {
        errors.phone = "Số điện thoại không hợp lệ (VD: 0912345678)";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    setFormError("");

    if (!validateForm()) return;

    setSaving(true);
    try {
      let userId = editingUser?.id || "";

      if (editingUser) {
        const payload: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          role: form.role,
          phone: form.phone,
        };
        if (form.password) payload.password = form.password;
        await usersApi.update(editingUser.id, payload);
      } else {
        const res = await usersApi.create({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone,
        });
        userId = res.data.data.id;
      }

      // Handle warehouse assignment for MANAGER or STAFF role
      if (form.role === "MANAGER" || form.role === "STAFF") {
        const currentlyAssignedWh = editingUser
          ? warehouses.find((w) => w.manager?.id === editingUser.id || w.staff?.id === editingUser.id)
          : null;
        const oldWarehouseId = currentlyAssignedWh?.id || "";

        if (selectedWarehouseId && selectedWarehouseId !== oldWarehouseId) {
          // Unassign previous warehouse if the user had one
          if (oldWarehouseId) {
            const updateData = currentlyAssignedWh?.manager?.id === editingUser?.id ? { managerId: null } : { staffId: null };
            await warehousesApi.update(oldWarehouseId, updateData).catch(() => {});
          }
          // Assign the selected warehouse to this user
          const newUpdateData = form.role === "MANAGER" ? { managerId: userId } : { staffId: userId };
          await warehousesApi.update(selectedWarehouseId, newUpdateData);
        }
      } else if (editingUser) {
        // Unassign warehouse if role changed away from MANAGER/STAFF
        const oldWh = warehouses.find((w) => w.manager?.id === editingUser.id || w.staff?.id === editingUser.id);
        if (oldWh) {
          const updateData = oldWh.manager?.id === editingUser.id ? { managerId: null } : { staffId: null };
          await warehousesApi.update(oldWh.id, updateData).catch(() => {});
        }
      }

      setModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setFormError(apiErr?.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (user: User) => {
    setConfirmName("");
    setConfirmAction({ type: "DELETE", user });
  };
  const handleToggleActiveClick = (user: User) => {
    setConfirmName("");
    setConfirmAction({ type: "TOGGLE_ACTIVE", user });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirming(true);
    try {
      if (confirmAction.type === "DELETE") {
        await usersApi.delete(confirmAction.user.id);
      } else {
        await usersApi.update(confirmAction.user.id, { isActive: !confirmAction.user.isActive });
      }
      fetchUsers();
    } catch {
      // ignore
    } finally {
      setConfirming(false);
      setConfirmAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3">
        <div className="min-w-0 w-full sm:w-auto">
          <h1 className="text-lg sm:text-2xl font-bold truncate max-w-full" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            Quản lý người dùng
          </h1>
          <p className="text-xs sm:text-sm mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
            {total} người dùng trong hệ thống
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={fetchUsers} className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center">
            <RefreshCw size={14} /> <span className="hidden sm:inline">Làm mới</span>
          </button>
          <button onClick={openCreate} className="btn btn-primary btn-sm flex-1 sm:flex-none justify-center whitespace-nowrap">
            <Plus size={14} /> <span className="hidden sm:inline">Thêm người dùng</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên, email, số điện thoại..."
            className="input-base pl-9 py-2 text-sm"
            style={{ height: "38px" }}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar flex-nowrap">
          {[
            { v: "", label: "Tất cả" },
            { v: "ADMIN", label: "Quản trị" },
            { v: "MANAGER", label: "Quản lý kho" },
            { v: "STAFF", label: "Nhân viên" },
            { v: "DRIVER", label: "Tài xế" },
          ].map((tab) => (
            <button
              key={tab.v}
              onClick={() => { setRoleFilter(tab.v); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                roleFilter === tab.v ? "text-white" : "hover:bg-(--bg-input)"
              }`}
              style={roleFilter === tab.v ? { background: "linear-gradient(135deg,#f97316,#ea580c)" } : { color: "var(--text-secondary)" }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-4 p-6 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in" style={{ color: "var(--text-muted)" }}>
            <Users size={48} style={{ opacity: 0.2 }} />
            <p className="font-medium">Không tìm thấy người dùng</p>
            <button onClick={openCreate} className="btn btn-primary btn-sm mt-2">
              <Plus size={14} /> Thêm người dùng mới
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Vai trò</th>
                  <th className="hidden sm:table-cell">Liên hệ</th>
                  <th>Trạng thái</th>
                  <th className="hidden sm:table-cell">Ngày tạo</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <tr key={user.id} className="hover:bg-(--bg-input) transition-colors animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[user.role]}, ${user.role === "ADMIN" ? "#dc2626" : user.role === "MANAGER" ? "#7c3aed" : user.role === "STAFF" ? "#4f46e5" : "#ea580c"})` }}
                        >
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                            {user.name}
                          </div>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: ROLE_BG[user.role], color: ROLE_COLORS[user.role] }}
                      >
                        {user.role === "ADMIN" ? <ShieldAlert size={12} /> :
                         user.role === "MANAGER" ? <ShieldCheck size={12} /> :
                         user.role === "STAFF" ? <ShieldCheck size={12} /> :
                         <Shield size={12} />}
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell">
                      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {user.phone || "—"}
                      </div>
                    </td>
                    <td>
                      {user.isActive ? (
                        <span className="badge badge-success shrink-0 inline-flex">Hoạt động</span>
                      ) : (
                        <span className="badge badge-danger shrink-0 inline-flex">Đã khóa</span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        <Calendar size={12} />
                        {formatDate(user.createdAt, "dd/MM/yyyy")}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(user)}
                          className="btn-icon"
                          title="Chỉnh sửa"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleToggleActiveClick(user)}
                          className="btn-icon"
                          title={user.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                        >
                          {user.isActive ? <UserX size={15} style={{ color: "#ef4444" }} /> : <UserCheck size={15} style={{ color: "#10b981" }} />}
                        </button>
                        <button
                          onClick={() => handleDeleteClick(user)}
                          className="btn-icon"
                          title="Xóa"
                        >
                          <Trash2 size={15} style={{ color: "var(--text-muted)" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex overflow-x-auto gap-2 justify-center no-scrollbar px-1 py-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                page === p ? "text-white" : "hover:bg-(--bg-input)"
              }`}
              style={page === p ? { background: "linear-gradient(135deg,#f97316,#ea580c)" } : { color: "var(--text-secondary)" }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div
            className="relative w-full max-w-lg card p-6 animate-scale-in"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {editingUser ? "Chỉnh sửa người dùng" : "Thêm người dùng mới"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm font-medium dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50" style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
                <AlertTriangle size={15} />
                {formError}
              </div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Họ và tên <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: "" })); }}
                  placeholder="Nguyễn Văn A"
                  className={`input-base ${fieldErrors.name ? "border-red-500" : ""}`}
                />
                {fieldErrors.name && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#ef4444" }}>
                    <AlertTriangle size={10} />
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Email <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => { setForm({ ...form, email: e.target.value }); if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: "" })); }}
                  placeholder="email@example.com"
                  className={`input-base ${fieldErrors.email ? "border-red-500" : ""}`}
                />
                {fieldErrors.email && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#ef4444" }}>
                    <AlertTriangle size={10} />
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Mật khẩu {editingUser ? <span className="text-xs" style={{ color: "var(--text-muted)" }}>(để trống nếu không đổi)</span> : <span style={{ color: "#ef4444" }}>*</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => { setForm({ ...form, password: e.target.value }); if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: "" })); }}
                  placeholder={editingUser ? "Nhập mật khẩu mới..." : "Nhập mật khẩu..."}
                  className={`input-base ${fieldErrors.password ? "border-red-500" : ""}`}
                />
                {fieldErrors.password && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#ef4444" }}>
                    <AlertTriangle size={10} />
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Vai trò
                </label>
                <div className="flex gap-2">
                  {["ADMIN", "MANAGER", "STAFF", "DRIVER"].map((role) => (
                    <button
                      key={role}
                      onClick={() => setForm({ ...form, role })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        form.role === role ? "text-white" : "hover:bg-(--bg-input)"
                      }`}
                      style={form.role === role ? { background: ROLE_COLORS[role] } : { color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Số điện thoại
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => { setForm({ ...form, phone: e.target.value }); if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: "" })); }}
                  placeholder="0901234567"
                  className={`input-base ${fieldErrors.phone ? "border-red-500" : ""}`}
                />
                {fieldErrors.phone && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#ef4444" }}>
                    <AlertTriangle size={10} />
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              {/* Warehouse assignment (only for MANAGER and STAFF) */}
              {(form.role === "MANAGER" || form.role === "STAFF") && (
                <div className="p-4 rounded-xl space-y-3" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
                  <div className="flex items-center gap-2">
                    <Warehouse size={16} style={{ color: "#8b5cf6" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      Phân quyền kho
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Gán kho cho {form.role === "MANAGER" ? "người quản lý" : "nhân viên"}
                    </label>
                    {warehousesLoading ? (
                      <div className="input-base text-sm flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                        <RefreshCw size={14} className="animate-spin" />
                        Đang tải danh sách kho...
                      </div>
                    ) : (
                      <select
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        className="input-base text-sm"
                      >
                        <option value="">-- Chưa gán kho --</option>
                        {warehouses.map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name} ({wh.code}) — {wh.city}
                            {form.role === "MANAGER" ? (wh.manager ? ` (QL: ${wh.manager.name})` : " (Chưa có QL)") : (wh.staff ? ` (NV: ${wh.staff.name})` : " (Chưa có NV)")}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedWarehouseId && (() => {
                      const wh = warehouses.find((w) => w.id === selectedWarehouseId);
                      if (!wh) return null;
                      if (form.role === "MANAGER" && wh.manager && wh.manager.id !== editingUser?.id) {
                        return (
                          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#f59e0b" }}>
                            <AlertTriangle size={10} />
                            Kho này đang được quản lý bởi <strong>{wh.manager.name}</strong>. Hành động này sẽ chuyển quyền quản lý.
                          </p>
                        );
                      }
                      if (form.role === "STAFF" && wh.staff && wh.staff.id !== editingUser?.id) {
                        return (
                          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#f59e0b" }}>
                            <AlertTriangle size={10} />
                            Kho này đang có nhân viên <strong>{wh.staff.name}</strong>. Hành động này sẽ thay thế nhân viên.
                          </p>
                        );
                      }
                      if (form.role === "MANAGER" && !wh.manager) {
                        return (
                          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#059669" }}>
                            Kho hiện chưa có người quản lý. Sẽ gán quyền cho người dùng này.
                          </p>
                        );
                      }
                      if (form.role === "STAFF" && !wh.staff) {
                        return (
                          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#059669" }}>
                            Kho hiện chưa có nhân viên. Sẽ gán quyền cho người dùng này.
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-4 border-t" style={{ borderColor: "var(--border-light)" }}>
              <button onClick={() => setModalOpen(false)} className="btn btn-secondary flex-1">
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary flex-1"
              >
                {saving ? "Đang lưu..." : editingUser ? "Cập nhật" : "Tạo người dùng"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setConfirmAction(null); setConfirmName(""); }} />
          <div className="relative w-full max-w-sm card p-6 animate-scale-in">
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: confirmAction.type === "DELETE" ? "#fef2f2" : "#fff7ed", color: confirmAction.type === "DELETE" ? "#ef4444" : "#f97316" }}
              >
                <AlertTriangle size={24} />
              </div>
              <div className="w-full">
                <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {confirmAction.type === "DELETE" ? "Xác nhận xóa" : confirmAction.user.isActive ? "Xác nhận khóa" : "Xác nhận kích hoạt"}
                </h3>
                <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
                  {confirmAction.type === "DELETE" 
                    ? `Bạn có chắc chắn muốn xóa người dùng "${confirmAction.user.name}"? Hành động này sẽ xóa vĩnh viễn tài khoản và tất cả dữ liệu liên quan. Không thể hoàn tác.`
                    : `Bạn có chắc chắn muốn ${confirmAction.user.isActive ? "khóa" : "kích hoạt"} tài khoản của "${confirmAction.user.name}"?`}
                </p>

                {/* Danger zone: type name to confirm for DELETE */}
                {confirmAction.type === "DELETE" && (
                  <div className="mt-4 text-left">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Nhập <strong className="text-red-500">{confirmAction.user.name}</strong> để xác nhận xóa
                    </label>
                    <input
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      placeholder="Nhập tên người dùng..."
                      className="input-base text-sm w-full text-center"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && confirmName === confirmAction.user.name && !confirming) {
                          executeConfirmAction();
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t" style={{ borderColor: "var(--border-light)" }}>
              <button onClick={() => { setConfirmAction(null); setConfirmName(""); }} className="btn btn-secondary flex-1">
                Hủy
              </button>
              <button
                onClick={executeConfirmAction}
                disabled={confirming || (confirmAction.type === "DELETE" && confirmName !== confirmAction.user.name)}
                className="btn flex-1"
                style={{
                  ...(confirmAction.type === "DELETE" 
                    ? { background: "#ef4444", color: "white" } 
                    : { background: confirmAction.user.isActive ? "#ef4444" : "#10b981", color: "white" }),
                  ...(confirmAction.type === "DELETE" && confirmName !== confirmAction.user.name ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                }}
              >
                {confirming ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]} fallback="redirect">
      <AdminUsersContent />
    </RoleGuard>
  );
}
