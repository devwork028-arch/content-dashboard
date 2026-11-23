import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { twMerge } from "tailwind-merge"
import type { ComponentProps } from "react"

const styles = cva(
  "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
        outline: "border border-zinc-700 hover:bg-zinc-800",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

export function Button({
  asChild,
  variant,
  className,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof styles> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button"
  return (
    <Component className={twMerge(styles({ variant }), className)} {...props} />
  )
}
