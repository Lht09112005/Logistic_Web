"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";

const schema = z
  .object({
    name: z.string().min(2, "Tên ít nhất 2 ký tự"),
    email: z.string().email("Email không hợp lệ"),
    phone: z.string().regex(/^0\d{9}$/, "Số điện thoại không hợp lệ").optional().or(z.literal("")),
    password: z
      .string()
      .min(8, "Mật khẩu ít nhất 8 ký tự")
      .regex(/[A-Z]/, "Cần ít nhất 1 chữ hoa")
      .regex(/[0-9]/, "Cần ít nhất 1 chữ số"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

function Field({
  label, id, error, children,
}: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>{error}</p>}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { status } = useSession();
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);
  const [showConfirm, setShowConfirm] = useState(false);
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
      await authApi.register({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone || undefined,
      });
      // Auto-login after register
      await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(msg || "Đăng ký thất bại. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Tạo tài khoản
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>
          Điền thông tin để bắt đầu sử dụng LogistiQ.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Họ tên" id="reg-name" error={errors.name?.message}>
          <input {...register("name")} id="reg-name" placeholder="Nguyễn Văn A"
            disabled={isLoading}
            className={`input-base ${errors.name ? "input-error" : ""} ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`} />
        </Field>

        <Field label="Email" id="reg-email" error={errors.email?.message}>
          <input {...register("email")} id="reg-email" type="email" placeholder="email@example.com"
            disabled={isLoading}
            className={`input-base ${errors.email ? "input-error" : ""} ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`} />
        </Field>

        <Field label="Số điện thoại (tuỳ chọn)" id="reg-phone" error={errors.phone?.message}>
          <input {...register("phone")} id="reg-phone" placeholder="0901234567"
            disabled={isLoading}
            className={`input-base ${errors.phone ? "input-error" : ""} ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`} />
        </Field>

        <Field label="Mật khẩu" id="reg-password" error={errors.password?.message}>
          <div className="relative">
            <input {...register("password")} id="reg-password"
              type={showPwd ? "text" : "password"} placeholder="••••••••"
              disabled={isLoading}
              className={`input-base pr-12 ${errors.password ? "input-error" : ""} ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`} />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              disabled={isLoading}
              className={`absolute right-3 top-1/2 -translate-y-1/2 btn-icon ${isLoading ? "opacity-40" : ""}`}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <Field label="Xác nhận mật khẩu" id="reg-confirm" error={errors.confirmPassword?.message}>
          <div className="relative">
            <input {...register("confirmPassword")} id="reg-confirm"
              type={showConfirm ? "text" : "password"} placeholder="••••••••"
              disabled={isLoading}
              className={`input-base pr-12 ${errors.confirmPassword ? "input-error" : ""} ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`} />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
              disabled={isLoading}
              className={`absolute right-3 top-1/2 -translate-y-1/2 btn-icon ${isLoading ? "opacity-40" : ""}`}>
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        {serverError && (
          <div className="p-3 rounded-lg text-sm text-center animate-shake dark:bg-red-900/30 dark:text-red-400" style={{ background: "#fee2e2", color: "#b91c1c" }}>
            {serverError}
          </div>
        )}

        <button type="submit" id="register-submit" disabled={isLoading} className={`btn btn-primary w-full btn-lg mt-2 ${isLoading ? "btn-loading" : "btn-press"}`}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span>Đang tạo tài khoản</span>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </span>
          ) : "Tạo tài khoản"}
        </button>
      </form>

      <p className="text-center mt-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        Đã có tài khoản?{" "}
        <Link href="/auth/login" className="font-semibold" style={{ color: "#f97316" }}>
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
