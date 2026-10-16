import { BookOpen } from 'lucide-react'
import { useState, type ComponentProps } from 'react'

import { CopyButton } from '@/components/copy-button'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** A plan or report as a document: wide, scrollable, readable type. */
export function MarkdownReader({
  open,
  onOpenChange,
  title,
  description,
  text,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  text: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88svh] flex-col gap-0 p-0 sm:max-w-[min(56rem,92vw)]">
        <DialogHeader className="flex-row items-center gap-2 border-b py-3 pr-12 pl-5">
          <BookOpen aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <DialogTitle className="truncate">{title}</DialogTitle>
            {description === undefined ? null : (
              <DialogDescription className="truncate text-xs">{description}</DialogDescription>
            )}
          </div>
          <CopyButton value={text} label="Copy as markdown" />
        </DialogHeader>
        <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-6 py-5 sm:px-10">
          <Markdown text={text} variant="reader" className="mx-auto max-w-[72ch]" />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A button that opens `text` in the reader. */
export function ReadButton({
  label = 'Read',
  title,
  description,
  text,
  className,
  size = 'xs',
  variant = 'ghost',
}: {
  label?: string
  title: string
  description?: string
  text: string
  className?: string
  size?: ComponentProps<typeof Button>['size']
  variant?: ComponentProps<typeof Button>['variant']
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn('shrink-0', className)}
        onClick={() => setOpen(true)}
      >
        <BookOpen aria-hidden="true" />
        {label}
      </Button>
      <MarkdownReader
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        text={text}
      />
    </>
  )
}
