"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Truck } from "lucide-react";

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

      {/* Demo credentials hint */}
      <div
        className="mb-6 p-4 rounded-xl text-sm"
        style={{ background: "var(--brand-50)", border: "1px solid #fed7aa" }}
      >
        <p className="font-semibold mb-1" style={{ color: "#c2410c" }}>
          🔑 Tài khoản demo:
        </p>
        <p style={{ color: "#9a3412" }}>Admin: admin@logistiq.vn / admin123</p>
        <p style={{ color: "#9a3412" }}>Staff: nam@logistiq.vn / staff123</p>
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
        </div>

        {serverError && (
          <div
            className="p-3 rounded-lg text-sm text-center"
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
