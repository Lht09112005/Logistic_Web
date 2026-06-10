"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Truck, Shield, User, ClipboardList } from "lucide-react";

const schema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu ít nhất 6 ký tự"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setServerError("");
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (result?.error) {
        setServerError("Email hoặc mật khẩu không đúng");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setServerError("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Mobile logo */}
      <div className="flex items-center gap-2 mb-8 lg:hidden">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center gradient-brand">
          <Truck size={16} color="white" />
        </div>
        <span className="font-bold text-lg">LogistiQ</span>
      </div>

      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Đăng nhập
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>
          Chào mừng trở lại! Vui lòng nhập thông tin tài khoản.
        </p>
      </div>

      {/* Role guide */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-1 rounded-full" style={{ background: "linear-gradient(180deg, #f97316, #ea580c)" }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Chọn vai trò để đăng nhập nhanh
          </span>
        </div>

        {[
          {
            role: "ADMIN",
            label: "Quản trị viên",
            email: "admin@logistiq.vn",
            password: "admin123",
            desc: "Toàn quyền quản lý hệ thống, người dùng, kho hàng & vận chuyển",
            color: "#ef4444",
            bg: "#fef2f2",
            darkBg: "#7f1d1d40",
            icon: Shield,
          },
          {
            role: "MANAGER",
            label: "Quản lý kho (HCM)",
            email: "manager.hcm@logistiq.vn",
            password: "staff123",
            desc: "Quản lý kho HCM, tồn kho, xác nhận & tạo lô hàng",
            color: "#8b5cf6",
            bg: "#f5f3ff",
            darkBg: "#4c1d9540",
            icon: ClipboardList,
          },
          {
            role: "STAFF",
            label: "Nhân viên",
            email: "nam@logistiq.vn",
            password: "staff123",
            desc: "Theo dõi kho, quét QR, cập nhật tồn kho & vận đơn",
            color: "#4f46e5",
            bg: "#eef2ff",
            darkBg: "#312e8140",
            icon: User,
          },
          {
            role: "DRIVER",
            label: "Tài xế",
            email: "driver1@logistiq.vn",
            password: "staff123",
            desc: "Xem lộ trình giao hàng & cập nhật trạng thái",
            color: "#f97316",
            bg: "#fff7ed",
            darkBg: "#7c2d1240",
            icon: Truck,
          },
        ].map((item) => (
          <button
            key={item.role}
            type="button"
            onClick={() => {
              setValue("email", item.email, { shouldValidate: true, shouldDirty: true });
              setValue("password", item.password, { shouldValidate: true, shouldDirty: true });
            }}
            className="w-full text-left p-3.5 rounded-xl transition-all duration-200 group"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = item.color;
              e.currentTarget.style.boxShadow = `0 0 0 2px ${item.color}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-color)";
              e.currentTarget.style.boxShadow = "var(--shadow-card)";
            }}
          >
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 transition-transform duration-200 group-hover:scale-110"
                style={{ background: `${item.color}15` }}
              >
                <item.icon size={20} style={{ color: item.color }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {item.label}
                  </span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ background: `${item.color}15`, color: item.color }}
                  >
                    {item.role}
                  </span>
                </div>
                <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                  {item.desc}
                </p>
                <p className="text-[11px] mt-1 font-mono" style={{ color: "var(--text-secondary)" }}>
                  {item.email} <span className="opacity-50">/</span> {item.password}
                </p>
              </div>

              {/* Arrow */}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
                style={{ background: `${item.color}15` }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        ))}

        <p className="text-[11px] text-center pt-1" style={{ color: "var(--text-muted)" }}>
          Nhấp vào vai trò để tự động điền thông tin đăng nhập
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
            Email
          </label>
          <input
            {...register("email")}
            type="email"
            id="login-email"
            placeholder="admin@logistiq.vn"
            className={`input-base ${errors.email ? "input-error" : ""}`}
          />
          {errors.email && (
            <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
            Mật khẩu
          </label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              id="login-password"
              placeholder="••••••••"
              className={`input-base pr-12 ${errors.password ? "input-error" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>
              {errors.password.message}
            </p>
          )}

          {/* Forgot password link */}
          <div className="flex justify-end -mt-1">
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium hover:underline transition-all"
              style={{ color: "#f97316" }}
            >
              Quên mật khẩu?
            </Link>
          </div>
        </div>

        {serverError && (
          <div
            className="p-3 rounded-lg text-sm text-center dark:bg-red-900/30 dark:text-red-400"
            style={{ background: "#fee2e2", color: "#b91c1c" }}
          >
            {serverError}
          </div>
        )}

        <button
          type="submit"
          id="login-submit"
          disabled={isLoading}
          className="btn btn-primary w-full btn-lg"
        >
          {isLoading ? (
            <><Loader2 size={18} className="animate-spin" /> Đang đăng nhập...</>
          ) : (
            "Đăng nhập"
          )}
        </button>
      </form>

      <p className="text-center mt-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        Chưa có tài khoản?{" "}
        <Link href="/auth/register" className="font-semibold" style={{ color: "#f97316" }}>
          Đăng ký ngay
        </Link>
      </p>
    </div>
  );
}
