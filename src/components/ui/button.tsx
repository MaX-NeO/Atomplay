import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Primary — solid pink with glow that intensifies on hover
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-[0_0_24px_-4px_oklch(0.69_0.27_350_/_0.6)] active:scale-[0.98]",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 hover:shadow-[0_0_20px_-4px_oklch(0.62_0.24_25_/_0.5)] active:scale-[0.98] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        // Outline — glass border that glows pink on hover
        outline:
          "border border-primary/30 bg-white/[0.03] backdrop-blur-md text-foreground shadow-xs hover:bg-primary/10 hover:border-primary/60 hover:shadow-[0_0_20px_-6px_oklch(0.69_0.27_350_/_0.4)] active:scale-[0.98] dark:bg-white/[0.04] dark:border-primary/30 dark:hover:bg-primary/10 dark:hover:border-primary/60",
        // Secondary — subtle glass
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 hover:shadow-[0_4px_16px_-6px_oklch(0_0_0_/_0.5)] active:scale-[0.98]",
        // Ghost — transparent, pink tint on hover
        ghost:
          "hover:bg-primary/10 hover:text-primary active:scale-[0.98] dark:hover:bg-primary/10 dark:hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-md px-6 text-base has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
