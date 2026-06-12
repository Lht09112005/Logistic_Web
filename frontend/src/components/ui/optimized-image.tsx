import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type OptimizedImageProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  containerClassName?: string;
  fallback?: React.ReactNode;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "full" | "none";
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
};

const ROUNDED_MAP = {
  none: "",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

/**
 * OptimizedImage — wrapper around next/image with:
 * - Lazy loading by default (set priority=true for above-fold images)
 * - AVIF/WebP auto-optimization (configured in next.config.ts)
 * - Placeholder blur effect
 * - Fallback content on error
 * - Consistent rounded corner styling
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className,
  containerClassName,
  fallback,
  priority = false,
  quality = 80,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  rounded = "md",
  objectFit = "cover",
}: OptimizedImageProps) {
  const [error, setError] = useState(false);
  const roundedClass = ROUNDED_MAP[rounded];

  // Fallback display when image fails to load
  if (error || !src) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div
        className={cn(
          "flex items-center justify-center bg-[var(--bg-input)] text-[var(--text-muted)]",
          roundedClass,
          containerClassName,
          fill ? "relative w-full h-full" : ""
        )}
        style={!fill ? { width, height } : undefined}
      >
        <svg
          width="40%"
          height="40%"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.4"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        roundedClass,
        fill ? "w-full h-full" : "",
        containerClassName
      )}
      style={!fill ? { width, height } : undefined}
    >
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        quality={quality}
        sizes={sizes}
        style={{ objectFit }}
        className={cn(
          "transition-opacity duration-300",
          roundedClass,
          className
        )}
        onError={() => setError(true)}
      />
    </div>
  );
}
