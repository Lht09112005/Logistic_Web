"use client"

import { useState, useCallback, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { Eye, EyeOff, Loader2, X, ArrowLeft, Shield, User, ClipboardList, Truck } from "lucide-react"

const schema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu ít nhất 6 ký tự"),
})

type FormData = z.infer<typeof schema>

export default function LoginModalIntercepted() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // Close modal on Escape key
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back()
    }
    window.addEventListener("keydown", onEscape)
    return () => window.removeEventListener("keydown", onEscape)
  }, [router])

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  const closeModal = useCallback(() => {
    router.back()
  }, [router])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setServerError("")
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })
      if (result?.error) {
        setServerError("Email hoặc mật khẩu không đúng")
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setServerError("Có lỗi xảy ra. Vui lòng thử lại.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={closeModal}
      >
        {/* Modal panel */}
        <div
          className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] animate-scale-in"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:rotate-90 z-10"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
          >
            <X size={16} />
          </button>

          <div className="p-6 md:p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={closeModal}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  Đăng nhập
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Đăng nhập để tiếp tục quản lý
                </p>
              </div>
            </div>

            {/* Quick role select — smaller version */}
            <div className="mb-5 grid grid-cols-2 gap-2">
              {[
                { role: "ADMIN", label: "Admin", email: "admin@logistiq.vn", color: "#ef4444", icon: Shield },
                { role: "MANAGER", label: "Manager", email: "manager.hcm@logistiq.vn", color: "#8b5cf6", icon: ClipboardList },
                { role: "STAFF", label: "Staff", email: "nam@logistiq.vn", color: "#4f46e5", icon: User },
                { role: "DRIVER", label: "Driver", email: "driver1@logistiq.vn", color: "#f97316", icon: Truck },
              ].map((item) => (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => {
                    setValue("email", item.email, { shouldValidate: true })
                    setValue("password", "staff123", { shouldValidate: true })
                    if (item.role === "ADMIN") {
                      setValue("password", "admin123", { shouldValidate: true })
                    }
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-color)" }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}15` }}>
                    <item.icon size={16} style={{ color: item.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      {item.label}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                      {item.email}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                  Email
                </label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="admin@logistiq.vn"
                  disabled={isLoading}
                  className={`input-base ${errors.email ? "input-error" : ""} ${isLoading ? "opacity-60" : ""}`}
                />
                {errors.email && <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className={`input-base pr-12 ${errors.password ? "input-error" : ""} ${isLoading ? "opacity-60" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>{errors.password.message}</p>}
              </div>

              {serverError && (
                <div className="p-3 rounded-lg text-sm text-center animate-shake" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full btn-lg"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Đang đăng nhập</span>
                  </span>
                ) : (
                  "Đăng nhập"
                )}
              </button>
            </form>

            <p className="text-center mt-5 text-sm" style={{ color: "var(--text-secondary)" }}>
              Chưa có tài khoản?{" "}
              <Link href="/auth/register" onClick={closeModal} className="font-semibold" style={{ color: "#f97316" }}>
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
