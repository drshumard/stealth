import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog        = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal  = DialogPrimitive.Portal
const DialogClose   = DialogPrimitive.Close

// ── Overlay ───────────────────────────────────────────────────────────────────
// asChild merges Radix's overlay behaviour (data-state, aria, role) onto
// the motion.div so Framer Motion can animate it freely.
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay asChild {...props}>
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      // No Radix animation classes — Framer Motion owns the transition
      className={cn("fixed inset-0 z-50 bg-black/60", className)}
    />
  </DialogPrimitive.Overlay>
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// ── Content ───────────────────────────────────────────────────────────────────
const DialogContent = React.forwardRef(({ className, children, hideClose, ...props }, ref) => (
  <DialogPortal forceMount>
    <AnimatePresence>
      <DialogOverlay key="overlay" />
      <DialogPrimitive.Content asChild {...props}>
        <motion.div
          ref={ref}
          // Enter: fade + scale + 2px slide up
          initial={{ opacity: 0, scale: 0.97, x: "-50%", y: "-48%" }}
          animate={{ opacity: 1, scale: 1,    x: "-50%", y: "-50%" }}
          exit={{    opacity: 0, scale: 0.97, x: "-50%", y: "-48%" }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          // No Radix animation classes — remove ALL data-[state=*]:animate-* classes
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
            className
          )}
        >
          {children}
          {!hideClose && (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </motion.div>
      </DialogPrimitive.Content>
    </AnimatePresence>
  </DialogPortal>
))
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
