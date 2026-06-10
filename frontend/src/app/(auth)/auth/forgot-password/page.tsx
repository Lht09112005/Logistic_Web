"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Mail, ArrowLeft, Loader2, CheckCircle, AlertTriangle, Truck } from "lucide-react";
import { authApi } from "@/lib/api";

const schema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setServerError("");
    try {
      await authApi.forgotPassword(data.email);
      setIsSuccess(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(msg || "Có lỗi xảy ra. Vui lòng thử lại.");
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

      {isSuccess ? (
        <div className="text-center animate-fade-in">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(16,185,129,0.12)" }}
          >
            <CheckCircle size={32} style={{ color: "#10b981" }} />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            Đã gửi email!
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Nếu email <strong style={{ color: "var(--text-primary)" }}>tồn tại trong hệ thống</strong>,
            bạn sẽ nhận được hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư đến (và thư mục Spam).
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: "#f97316" }}
          >
            <ArrowLeft size={16} />
            Quay lại đăng nhập
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-8">
            <Link
              href="/auth/login"
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--bg-input)] transition-all"
              style={{ border: "1px solid var(--border-color)" }}
            >
              <ArrowLeft size={16} style={{ color: "var(--text-secondary)" }} />
            </Link>
            <div>
              <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                Quên mật khẩu
              </h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Nhập email để nhận link đặt lại mật khẩu
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  {...register("email")}
                  type="email"
                  placeholder="email@example.com"
                  className={`input-base pl-10 ${errors.email ? "input-error" : ""}`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>
                  {errors.email.message}
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
                <><Loader2 size={18} className="animate-spin" /> Đang gửi...</>
              ) : (
                "Gửi yêu cầu"
              )}
            </button>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: "var(--text-secondary)" }}>
            <Link href="/auth/login" className="font-semibold" style={{ color: "#f97316" }}>
              Quay lại đăng nhập
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
