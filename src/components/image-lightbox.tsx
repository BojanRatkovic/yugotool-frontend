import { ChevronLeft, ChevronRight, Expand, ImageOff, Maximize, Scan, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** One picture in a lightbox gallery. */
export interface LightboxImage {
  src: string
  /** Short tag: "Base", "PR", "Diff". Shown on thumbnails and in the counter. */
  label?: string
  /** What it shows; the caption under the image. */
  caption: string
  /** Secondary line, e.g. the artifact file. */
  detail?: string
}

/** Next index in a ring of `count`. */
export function cycleIndex(index: number, step: 1 | -1, count: number): number {
  if (count <= 0) return 0
  return (index + step + count) % count
}

/**
 * Fullscreen viewer over a dark backdrop. Fits the screen by default; "1:1"
 * shows actual pixels and scrolls (tall full-page shots). With several images
 * it is a gallery: ←/→ and the side buttons move, the counter says where you
 * are. Closes on Esc, the close button, or a click on the backdrop.
 */
export function ImageLightbox({
  images,
  startIndex = 0,
  open,
  onOpenChange,
}: {
  images: readonly LightboxImage[]
  startIndex?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [index, setIndex] = useState(startIndex)
  const [actualSize, setActualSize] = useState(false)
  const image = images[index] ?? images[0]
  const many = images.length > 1
  if (image === undefined) return null

  const step = (direction: 1 | -1) => setIndex((i) => cycleIndex(i, direction, images.length))
  const title = image.label === undefined ? image.caption : `${image.label} · ${image.caption}`

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Focus the viewer itself (arrow keys work at once), not the first tab.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
          }}
          onKeyDown={(event) => {
            if (!many) return
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              step(1)
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault()
              step(-1)
            }
          }}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex flex-col text-white outline-none data-open:animate-in data-open:fade-in-0"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <div className="flex h-12 shrink-0 items-center gap-2 px-4">
            {many ? (
              <div className="flex items-center gap-1" role="tablist" aria-label="Images">
                {images.map((item, i) => (
                  <button
                    key={`${item.src}-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    onClick={() => setIndex(i)}
                    className={cn(
                      'h-7 rounded-md px-2.5 text-xs font-medium transition-colors',
                      i === index
                        ? 'bg-white text-black'
                        : 'text-white/70 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {item.label ?? `Image ${i + 1}`}
                  </button>
                ))}
                <span className="ml-2 font-mono text-xs text-white/60 tabular-nums">
                  {index + 1} / {images.length}
                </span>
              </div>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                aria-pressed={actualSize}
                onClick={() => setActualSize((value) => !value)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/20 px-2.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                {actualSize ? (
                  <Maximize aria-hidden="true" className="size-3.5" />
                ) : (
                  <Scan aria-hidden="true" className="size-3.5" />
                )}
                {actualSize ? 'Fit' : '1:1'}
              </button>
              <DialogPrimitive.Close
                aria-label="Close"
                className="inline-flex size-8 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X aria-hidden="true" className="size-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* The stage: a click on empty space (the backdrop) closes. */}
          {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop click; Esc and the close button are the keyboard paths */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) onOpenChange(false)
            }}
          >
            {many ? (
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => step(-1)}
                className="absolute top-1/2 left-3 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-white/15"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </button>
            ) : null}
            {actualSize ? (
              // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop click, as above
              <div
                className="size-full scrollbar-thin overflow-auto px-16"
                onClick={(event) => {
                  if (event.target === event.currentTarget) onOpenChange(false)
                }}
              >
                <img src={image.src} alt={title} className="mx-auto block max-w-none" />
              </div>
            ) : (
              <img
                src={image.src}
                alt={title}
                className="block max-h-full max-w-[calc(100%-8rem)] object-contain"
              />
            )}
            {many ? (
              <button
                type="button"
                aria-label="Next image"
                onClick={() => step(1)}
                className="absolute top-1/2 right-3 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-white/15"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-0.5 px-4 py-3 text-center">
            <p className="text-sm text-white/90">
              {image.label === undefined ? null : (
                <span className="font-medium text-white">{image.label} · </span>
              )}
              {image.caption}
            </p>
            {image.detail === undefined ? null : (
              <p className="font-mono text-[0.6875rem] text-white/50">{image.detail}</p>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Open state + the lightbox element, for any click target. */
export function useLightbox(images: readonly LightboxImage[]) {
  const [openAt, setOpenAt] = useState<number | null>(null)
  const element =
    openAt === null ? null : (
      <ImageLightbox
        key={openAt}
        images={images}
        startIndex={openAt}
        open
        onOpenChange={(open) => (open ? null : setOpenAt(null))}
      />
    )
  return { open: (index = 0) => setOpenAt(index), element }
}

/** The hover affordance on anything that opens the lightbox. */
function ExpandHint() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-md bg-background/85 text-foreground opacity-0 shadow-sm transition-opacity group-hover/zoom:opacity-100 group-focus-visible/zoom:opacity-100"
    >
      <Expand className="size-3.5" />
    </span>
  )
}

/**
 * Fixed-size screenshot thumbnail (never shifts layout while loading).
 * Opens the gallery `images` at `index`; the label sits bottom-left.
 */
export function ImageThumb({
  images,
  index = 0,
  className,
}: {
  images: readonly LightboxImage[]
  index?: number
  className?: string
}) {
  const lightbox = useLightbox(images)
  const [failed, setFailed] = useState(false)
  const image = images[index]
  if (image === undefined) return null
  return (
    <>
      <button
        type="button"
        onClick={() => lightbox.open(index)}
        disabled={failed}
        className={cn(
          'group/zoom relative h-[100px] w-[160px] shrink-0 overflow-hidden rounded-md border bg-muted/40 transition-colors hover:border-foreground/30 disabled:cursor-default',
          className,
        )}
      >
        {failed ? (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-[0.6875rem] text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-4" />
            Image unavailable
          </span>
        ) : (
          <img
            src={image.src}
            alt={image.label === undefined ? image.caption : `${image.label}: ${image.caption}`}
            width={160}
            height={100}
            loading="lazy"
            onError={() => setFailed(true)}
            className="size-full object-cover object-top"
          />
        )}
        {image.label === undefined ? null : (
          <span className="absolute bottom-1 left-1 rounded-sm bg-background/85 px-1 text-[0.6875rem] leading-4 font-medium text-foreground">
            {image.label}
          </span>
        )}
        {failed ? null : <ExpandHint />}
        <span className="sr-only">Open full size</span>
      </button>
      {lightbox.element}
    </>
  )
}

/** Wraps a full-width image: a click anywhere on it opens the gallery at `index`. */
export function ZoomableImage({
  images,
  index = 0,
  className,
  children,
}: {
  images: readonly LightboxImage[]
  index?: number
  className?: string
  children: ReactNode
}) {
  const lightbox = useLightbox(images)
  return (
    <>
      <button
        type="button"
        onClick={() => lightbox.open(index)}
        className={cn('group/zoom relative block w-full cursor-zoom-in text-left', className)}
      >
        {children}
        <ExpandHint />
        <span className="sr-only">Open full screen</span>
      </button>
      {lightbox.element}
    </>
  )
}
