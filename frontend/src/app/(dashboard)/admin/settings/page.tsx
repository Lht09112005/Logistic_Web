"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { authApi } from "@/lib/api";
import {
  Settings, User, Lock, Bell, Monitor,
  Save, X, AlertTriangle, CheckCircle,
  Eye, EyeOff, RefreshCw,
} from "lucide-react";

type Tab = "profile" | "password" | "notifications" | "system";

const TABS: { key: Tab; label: string; icon: typeof User }[] = [
  { key: "profile", label: "Hồ sơ", icon: User },
  { key: "password", label: "Mật khẩu", icon: Lock },
  { key: "notifications", label: "Thông báo", icon: Bell },
  { key: "system", label: "Hệ thống", icon: Monitor },
];

interface NotificationPrefs {
  lowStock: boolean;
  expiring: boolean;
  shipmentUpdate: boolean;
  newUser: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  lowStock: true,
  expiring: true,
  shipmentUpdate: true,
  newUser: false,
};

const PREFS_KEY = "logistiq_notification_prefs";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const isDriver = user?.role === 'DRIVER';

  // Tài xế: chỉ cần Hồ sơ + Mật khẩu
  const visibleTabs = isDriver
    ? TABS.filter((t) => t.key === 'profile' || t.key === 'password')
    : TABS;

  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Safety: nếu activeTab không còn trong danh sách tab cho phép, về mặc định
  if (isDriver && activeTab !== 'profile' && activeTab !== 'password') {
    setActiveTab('profile');
  }

  // Profile state
  const [profile, setProfile] = useState({ name: "", email: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password state
  const [passwords, setPasswords] = useState({ newPass: "", confirm: "" });
  const [showPw, setShowPw] = useState({ newPass: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");

  // Notification state
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [notifSaved, setNotifSaved] = useState(false);

  // Load profile & prefs
  useEffect(() => {
    if (user) {
      setProfile({ name: user.name, email: user.email, phone: user.phone || "" });
    }
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) setPrefs(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [user]);

  const savePrefs = (newPrefs: NotificationPrefs) => {
    setPrefs(newPrefs);
    localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 2000);
  };

  const handleSaveProfile = async () => {
    setProfileError("");
    setProfileSuccess("");
    if (!profile.name.trim() || !profile.email.trim()) {
      setProfileError("Vui lòng nhập họ tên và email");
      return;
    }
    setProfileSaving(true);
    try {
      await authApi.updateMe(profile);
      setProfileSuccess("Cập nhật hồ sơ thành công");
      setTimeout(() => {
        setProfileSuccess("");
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setProfileError(err?.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError("");
    setPwSuccess("");
    if (!passwords.newPass || !passwords.confirm) {
      setPwError("Vui lòng nhập đầy đủ các trường");
      return;
    }
    if (passwords.newPass.length < 6) {
      setPwError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      setPwError("Mật khẩu xác nhận không khớp");
      return;
    }
    setPwSaving(true);
    try {
      await authApi.updateMe({ password: passwords.newPass });
      setPwSuccess("Đổi mật khẩu thành công");
      setPasswords({ newPass: "", confirm: "" });
      setTimeout(() => setPwSuccess(""), 3000);
    } catch (err: any) {
      setPwError(err?.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setPwSaving(false);
    }
  };

  const SYSTEM_INFO = [
    { label: "Tên ứng dụng", value: "LogistiQ" },
    { label: "Phiên bản", value: "1.0.0" },
    { label: "Môi trường", value: process.env.NODE_ENV || "development" },
    { label: "Framework", value: "Next.js + Express" },
    { label: "Cơ sở dữ liệu", value: "PostgreSQL (Prisma)" },
    { label: "Xác thực", value: "NextAuth v5 + JWT" },
    { label: "Thời gian thực", value: "Socket.io" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>
          <Settings size={20} color="white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            Cài đặt
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Quản lý thông tin cá nhân và tùy chỉnh hệ thống
          </p>
        </div>
      </div>

      {/* Tabs — horizontal scroll on mobile */}
      <div className="card p-1 flex overflow-x-auto gap-1 snap-x snap-mandatory no-scrollbar sm:flex-wrap sm:overflow-visible sm:snap-none">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all snap-start shrink-0 whitespace-nowrap ${
                activeTab === tab.key ? "text-white shadow-sm" : "hover:bg-[var(--bg-input)]"
              }`}
              style={activeTab === tab.key ? { background: "linear-gradient(135deg,#f97316,#ea580c)" } : { color: "var(--text-secondary)" }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== PROFILE TAB ==================== */}
      {activeTab === "profile" && (
        <div className="card p-6 animate-fade-in">
          <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>Thông tin hồ sơ</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Cập nhật thông tin cá nhân của bạn
          </p>

          {profileSuccess && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm font-medium dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/50" style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}>
              <CheckCircle size={16} /> {profileSuccess}
            </div>
          )}
          {profileError && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm font-medium dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50" style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
              <AlertTriangle size={16} /> {profileError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Họ và tên <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Nguyễn Văn A"
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Email <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="email@example.com"
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Số điện thoại
              </label>
              <input
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="0901234567"
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Vai trò
              </label>
              <div className="input-base flex items-center gap-2 cursor-not-allowed" style={{ opacity: 0.7 }}>
                <div className="w-2 h-2 rounded-full" style={{ background: user?.role === "ADMIN" ? "#ef4444" : user?.role === "MANAGER" ? "#8b5cf6" : user?.role === "STAFF" ? "#6366f1" : "#f97316" }} />
                <span style={{ color: "var(--text-secondary)" }}>
                  {user?.role === "ADMIN" ? "Quản trị viên" : user?.role === "MANAGER" ? "Quản lý kho" : user?.role === "DRIVER" ? "Tài xế" : "Nhân viên"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t" style={{ borderColor: "var(--border-light)" }}>
            <button onClick={handleSaveProfile} disabled={profileSaving} className="btn btn-primary">
              {profileSaving ? "Đang lưu..." : <><Save size={16} /> Lưu thay đổi</>}
            </button>
          </div>
        </div>
      )}

      {/* ==================== PASSWORD TAB ==================== */}
      {activeTab === "password" && (
        <div className="card p-6 animate-fade-in">
          <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>Đổi mật khẩu</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Cập nhật mật khẩu đăng nhập của bạn
          </p>

          {pwSuccess && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm font-medium dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/50" style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}>
              <CheckCircle size={16} /> {pwSuccess}
            </div>
          )}
          {pwError && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm font-medium dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50" style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
              <AlertTriangle size={16} /> {pwError}
            </div>
          )}

          <div className="space-y-4 max-w-md">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Mật khẩu mới <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div className="relative">
                <input
                  type={showPw.newPass ? "text" : "password"}
                  value={passwords.newPass}
                  onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                  placeholder="Ít nhất 6 ký tự"
                  className="input-base pr-10"
                />
                <button
                  onClick={() => setShowPw({ ...showPw, newPass: !showPw.newPass })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon"
                >
                  {showPw.newPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwords.newPass && (
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="h-1.5 flex-1 rounded-full" style={{
                    background: passwords.newPass.length < 6
                      ? "#ef4444"
                      : passwords.newPass.length < 10
                      ? "#f97316"
                      : "#22c55e"
                  }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {passwords.newPass.length < 6 ? "Yếu" : passwords.newPass.length < 10 ? "Trung bình" : "Mạnh"}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Xác nhận mật khẩu mới <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div className="relative">
                <input
                  type={showPw.confirm ? "text" : "password"}
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  placeholder="Nhập lại mật khẩu mới"
                  className={`input-base pr-10 ${passwords.confirm && passwords.newPass !== passwords.confirm ? "input-error" : ""}`}
                />
                <button
                  onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon"
                >
                  {showPw.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwords.confirm && passwords.newPass !== passwords.confirm && (
                <p className="text-xs mt-1" style={{ color: "#ef4444" }}>Mật khẩu không khớp</p>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t" style={{ borderColor: "var(--border-light)" }}>
            <button
              onClick={handleChangePassword}
              disabled={pwSaving || !!(!passwords.confirm || passwords.newPass !== passwords.confirm)}
              className="btn btn-primary"
            >
              {pwSaving ? "Đang lưu..." : "Đổi mật khẩu"}
            </button>
          </div>
        </div>
      )}

      {/* ==================== NOTIFICATIONS TAB ==================== */}
      {activeTab === "notifications" && (
        <div className="card p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Tùy chỉnh thông báo</h2>
            {notifSaved && (
              <span className="text-xs font-medium flex items-center gap-1" style={{ color: "#15803d" }}>
                <CheckCircle size={12} /> Đã lưu
              </span>
            )}
          </div>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Chọn loại thông báo bạn muốn nhận
          </p>

          <div className="space-y-1">
            {[
              { key: "lowStock" as const, label: "Tồn kho thấp", desc: "Khi sản phẩm dưới ngưỡng tồn kho tối thiểu" },
              { key: "expiring" as const, label: "Hàng sắp hết hạn", desc: "Khi sản phẩm sắp đến hạn sử dụng" },
              { key: "shipmentUpdate" as const, label: "Cập nhật vận chuyển", desc: "Khi trạng thái vận đơn thay đổi" },
              { key: "newUser" as const, label: "Người dùng mới", desc: "Khi có tài khoản mới được tạo trong hệ thống" },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all hover:bg-[var(--bg-input)]"
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.desc}</div>
                </div>
                <div
                  className={`relative w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0 ${
                    prefs[item.key] ? "bg-[#f97316]" : "bg-[var(--border-color)]"
                  }`}
                  onClick={() => {
                    const next = { ...prefs, [item.key]: !prefs[item.key] };
                    savePrefs(next);
                  }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200"
                    style={{ left: prefs[item.key] ? "22px" : "2px" }}
                  />
                </div>
              </label>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--border-light)" }}>
            <button
              onClick={() => savePrefs(DEFAULT_PREFS)}
              className="btn btn-ghost btn-sm"
            >
              <RefreshCw size={14} /> Khôi phục mặc định
            </button>
          </div>
        </div>
      )}

      {/* ==================== SYSTEM TAB ==================== */}
      {activeTab === "system" && (
        <div className="card p-6 animate-fade-in">
          <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>Thông tin hệ thống</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Tổng quan về hệ thống LogistiQ
          </p>

          <div className="space-y-0.5">
            {SYSTEM_INFO.map((info) => (
              <div
                key={info.label}
                className="flex items-center justify-between py-3 px-4 rounded-lg"
                style={{ borderBottom: "1px solid var(--border-light)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{info.label}</span>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{info.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="live-dot" />
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Tình trạng hệ thống</span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Hệ thống đang hoạt động ổn định. Tất cả các dịch vụ đều trực tuyến.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
