import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Newsprint: Anton uppercase, hard ink borders, offset shadows instead of blur.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-display uppercase tracking-wide text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-x-[2px] active:translate-y-[2px]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-[3px] border-foreground hard-shadow-lg hover:brightness-110 active:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground border-[3px] border-foreground hard-shadow-sm hover:brightness-110 active:shadow-none",
        outline:
          "bg-transparent text-foreground border-[3px] [border-color:var(--button-outline)] hover:bg-foreground hover:text-background active:shadow-none",
        secondary:
          "bg-secondary text-secondary-foreground border-[3px] border-foreground hard-shadow-sm hover:brightness-110 active:shadow-none",
        ghost:
          "border-[2px] border-transparent hover:border-foreground active:translate-x-0 active:translate-y-0",
        link:
          "text-primary underline underline-offset-4 border-none active:translate-x-0 active:translate-y-0",
      },
      size: {
        default: "min-h-10 px-5 py-2",
        sm: "min-h-8 px-3 text-xs",
        lg: "min-h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
