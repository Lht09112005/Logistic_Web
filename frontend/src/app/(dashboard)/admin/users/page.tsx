"use client";

import { useEffect, useState, useCallback } from "react";
import { usersApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Users, Search, Plus, Shield, ShieldCheck,
  ShieldAlert, Mail, Phone, Calendar, MoreVertical,
  Edit3, Trash2, X, CheckCircle, AlertTriangle,
  UserCheck, UserX, RefreshCw,
} from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "DRIVER";
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

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  STAFF: "Nhân viên",
  DRIVER: "Tài xế",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#ef4444",
  STAFF: "#6366f1",
  DRIVER: "#f97316",
};

const ROLE_BG: Record<string, string> = {
  ADMIN: "#fef2f2",
  STAFF: "#eef2ff",
  DRIVER: "#fff7ed",
};

const emptyForm: UserForm = { name: "", email: "", password: "", role: "STAFF", phone: "" };

export default function AdminUsersPage() {
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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
    setModalOpen(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.name.trim() || !form.email.trim()) {
      setFormError("Vui lòng nhập họ tên và email");
      return;
    }
    if (!editingUser && !form.password.trim()) {
      setFormError("Vui lòng nhập mật khẩu");
      return;
    }

    setSaving(true);
    try {
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
        await usersApi.create({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone,
        });
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await usersApi.delete(id);
      setDeleteConfirm(null);
      fetchUsers();
    } catch {
      // ignore
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await usersApi.update(user.id, { isActive: !user.isActive });
      fetchUsers();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            Quản lý người dùng
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {total} người dùng trong hệ thống
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="btn btn-ghost btn-sm">
            <RefreshCw size={14} /> Làm mới
          </button>
          <button onClick={openCreate} className="btn btn-primary btn-sm">
            <Plus size={14} /> Thêm người dùng
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên, email, số điện thoại..."
            className="input-base pl-9 py-2 text-sm"
            style={{ height: "38px" }}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[
            { v: "", label: "Tất cả" },
            { v: "ADMIN", label: "Quản trị" },
            { v: "STAFF", label: "Nhân viên" },
            { v: "DRIVER", label: "Tài xế" },
          ].map((tab) => (
            <button
              key={tab.v}
              onClick={() => { setRoleFilter(tab.v); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                roleFilter === tab.v ? "text-white" : "hover:bg-[var(--bg-input)]"
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
          <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--text-muted)" }}>
            <Users size={48} style={{ opacity: 0.2 }} />
            <p className="font-medium">Không tìm thấy người dùng</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Vai trò</th>
                  <th>Liên hệ</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[user.role]}, ${user.role === "ADMIN" ? "#dc2626" : user.role === "STAFF" ? "#4f46e5" : "#ea580c"})` }}
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: ROLE_BG[user.role], color: ROLE_COLORS[user.role] }}
                      >
                        {user.role === "ADMIN" ? <ShieldAlert size={12} /> :
                         user.role === "STAFF" ? <ShieldCheck size={12} /> :
                         <Shield size={12} />}
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td>
                      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {user.phone || "—"}
                      </div>
                    </td>
                    <td>
                      {user.isActive ? (
                        <span className="badge badge-success flex-shrink-0 inline-flex">Hoạt động</span>
                      ) : (
                        <span className="badge badge-danger flex-shrink-0 inline-flex">Đã khóa</span>
                      )}
                    </td>
                    <td>
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
                          onClick={() => handleToggleActive(user)}
                          className="btn-icon"
                          title={user.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                        >
                          {user.isActive ? <UserX size={15} style={{ color: "#ef4444" }} /> : <UserCheck size={15} style={{ color: "#10b981" }} />}
                        </button>
                        {deleteConfirm === user.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                            >
                              Xóa
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(user.id)}
                            className="btn-icon"
                            title="Xóa"
                          >
                            <Trash2 size={15} style={{ color: "var(--text-muted)" }} />
                          </button>
                        )}
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
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                page === p ? "text-white" : "hover:bg-[var(--bg-input)]"
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
              <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm font-medium" style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
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
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  className="input-base"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Email <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  className="input-base"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Mật khẩu {editingUser ? <span className="text-xs" style={{ color: "var(--text-muted)" }}>(để trống nếu không đổi)</span> : <span style={{ color: "#ef4444" }}>*</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editingUser ? "Nhập mật khẩu mới..." : "Nhập mật khẩu..."}
                  className="input-base"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Vai trò
                </label>
                <div className="flex gap-2">
                  {["ADMIN", "STAFF", "DRIVER"].map((role) => (
                    <button
                      key={role}
                      onClick={() => setForm({ ...form, role })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        form.role === role ? "text-white" : "hover:bg-[var(--bg-input)]"
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
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0901234567"
                  className="input-base"
                />
              </div>
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
    </div>
  );
}
