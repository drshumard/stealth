import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog        = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal  = DialogPrimitive.Portal
const DialogClose   = DialogPrimitive.Close

// ── Motion-wrapped Radix primitives ──────────────────────────────────────────
// motion.create() is the v11+ API for wrapping non-HTML components.
const MotionOverlay = motion.create(DialogPrimitive.Overlay)
const MotionContent = motion.create(DialogPrimitive.Content)

// ── Overlay ───────────────────────────────────────────────────────────────────
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <MotionOverlay
    ref={ref}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18, ease: "easeOut" }}
    // No Radix CSS animation classes — Framer Motion owns the transition
    className={cn("fixed inset-0 z-50 bg-black/60", className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// ── Content ───────────────────────────────────────────────────────────────────
const DialogContent = React.forwardRef(({ className, children, hideClose, ...props }, ref) => {
  // Radix passes `data-state` via context; we read `open` directly from props
  // so AnimatePresence can control mount/unmount timing.
  // Strategy: forceMount keeps the portal in the DOM; AnimatePresence with
  // the boolean `open` key handles enter/exit.  This gives us smooth exits
  // without needing to thread `open` through every call site.
  const [isOpen, setIsOpen] = React.useState(false)

  // Detect open state from Radix data-state attribute via a tiny MutationObserver
  // — simplest way that doesn't require changing DialogContent's public API.
  // Instead, we rely on the Dialog root's open prop via context.
  // Simpler: just use forceMount + let AnimatePresence key on the content itself.
  // Radix fires unmount immediately; we intercept with forceMount and animate out.

  return (
    <DialogPortal forceMount>
      <AnimatePresence>
        {/* Radix keeps the Portal mounted (forceMount), but the children
            are only rendered when the Dialog is open — Radix gates this
            internally.  AnimatePresence wraps both so exit plays before DOM removal. */}
        <DialogOverlay key="overlay" />
        <MotionContent
          key="content"
          ref={ref}
          // Enter: fade in + gentle scale-up from 96% + slide up 2%
          initial={{ opacity: 0, scale: 0.97, x: "-50%", y: "-48%" }}
          animate={{ opacity: 1, scale: 1,    x: "-50%", y: "-50%" }}
          exit={{    opacity: 0, scale: 0.97, x: "-50%", y: "-48%" }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            // Remove ALL Radix animation classes — Framer Motion owns transitions
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
            className
          )}
          {...props}
        >
          {children}
          {!hideClose && (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </MotionContent>
      </AnimatePresence>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

// ── Unchanged helpers ─────────────────────────────────────────────────────────
const DialogHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
