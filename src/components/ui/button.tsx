import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl font-display text-[15px] font-extrabold tracking-[0.01em] whitespace-nowrap transition-[background-color,color,box-shadow,transform,filter] duration-100 outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Botões "de tecla": sombra sólida embaixo que some ao pressionar.
        default: "bg-primary text-primary-foreground shadow-[0_4px_0_var(--primary-edge)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_var(--primary-edge)]",
        mint: "bg-mint text-mint-foreground shadow-[0_4px_0_var(--primary-edge)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_var(--primary-edge)]",
        destructive:
          "bg-destructive text-white shadow-[0_4px_0_var(--destructive-edge)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_var(--destructive-edge)] focus-visible:ring-destructive/20 dark:text-[#2a0f0b] dark:focus-visible:ring-destructive/40",
        outline:
          "border-2 bg-card shadow-[0_4px_0_var(--edge)] hover:bg-accent hover:text-accent-foreground active:translate-y-[3px] active:shadow-[0_1px_0_var(--edge)] dark:border-input",
        secondary:
          "bg-secondary text-secondary-foreground hover:brightness-[0.98] active:translate-y-px",
        ghost:
          "font-bold hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-5 has-[>svg]:px-4",
        xs: "h-6 gap-1 rounded-md px-2 text-xs shadow-none has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-xl px-3.5 text-sm has-[>svg]:px-3",
        lg: "h-14 rounded-[18px] px-7 text-base has-[>svg]:px-5",
        icon: "size-11",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-13 rounded-2xl",
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
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
