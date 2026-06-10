"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle, AlertTriangle, Truck, ArrowLeft, Lock } from "lucide-react";
import { authApi } from "@/lib/api";
import { Suspense } from "react";

const schema = z
  .object({
    password: z
      .string()
      .min(6, "Mật khẩu ít nhất 6 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [showPw, setShowPw] = useState({ password: false, confirm: false });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      setServerError("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
      return;
    }
    setIsLoading(true);
    setServerError("");
    try {
      await authApi.resetPassword(token, data.password);
      setIsSuccess(true);
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(msg || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="animate-fade-in text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "var(--color-error-bg)" }}
        >
          <AlertTriangle size={32} style={{ color: "var(--color-error)" }} />
        </div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Link không hợp lệ
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu link mới.
        </p>
        <Link
          href="/auth/forgot-password"
          className="inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "#f97316" }}
        >
          Yêu cầu link mới
        </Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="animate-fade-in text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "rgba(16,185,129,0.12)" }}
        >
          <CheckCircle size={32} style={{ color: "#10b981" }} />
        </div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Đặt lại mật khẩu thành công!
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Mật khẩu của bạn đã được cập nhật. Đang chuyển hướng đến trang đăng nhập...
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "#f97316" }}
        >
          <ArrowLeft size={16} />
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Mobile logo */}
      <div className="flex items-center gap-2 mb-8 lg:hidden">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center gradient-brand">
          <Truck size={16} color="white" />
        </div>
        <span className="font-bold text-lg">LogistiQ</span>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(249,115,22,0.12)" }}
        >
          <Lock size={20} style={{ color: "#f97316" }} />
        </div>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Đặt lại mật khẩu
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Nhập mật khẩu mới cho tài khoản của bạn
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
            Mật khẩu mới
          </label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPw.password ? "text" : "password"}
              placeholder="Ít nhất 6 ký tự"
              className={`input-base pr-12 ${errors.password ? "input-error" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPw({ ...showPw, password: !showPw.password })}
              className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon"
            >
              {showPw.password ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
            Xác nhận mật khẩu
          </label>
          <div className="relative">
            <input
              {...register("confirmPassword")}
              type={showPw.confirm ? "text" : "password"}
              placeholder="Nhập lại mật khẩu mới"
              className={`input-base pr-12 ${errors.confirmPassword ? "input-error" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}
              className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon"
            >
              {showPw.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {serverError && (
          <div
            className="p-3 rounded-lg text-sm text-center flex items-center gap-2 justify-center"
            style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}
          >
            <AlertTriangle size={14} />
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary w-full btn-lg"
        >
          {isLoading ? (
            <><Loader2 size={18} className="animate-spin" /> Đang cập nhật...</>
          ) : (
            "Đặt lại mật khẩu"
          )}
        </button>
      </form>

      <p className="text-center mt-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        <Link href="/auth/login" className="font-semibold" style={{ color: "#f97316" }}>
          Quay lại đăng nhập
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="animate-pulse space-y-4 p-8">
        <div className="skeleton h-10 w-48 mx-auto" />
        <div className="skeleton h-8 w-64 mx-auto" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
