import { useId } from 'react'

import { cn } from '@/lib/utils'

/**
 * Productive's brandmark (white mark on the indigo gradient tile), from
 * productive.io/brand-guidelines. Used beside imported work and in Integrations.
 * The drop shadow of the original is left out: it blurs at icon sizes.
 */
export function ProductiveMark({ className }: { className?: string }) {
  // Gradient ids are document-global; one per instance keeps several marks apart.
  const gradient = useId()
  return (
    <svg
      viewBox="19 19 177 177"
      aria-hidden="true"
      className={cn('size-4 shrink-0', className)}
    >
      <defs>
        <linearGradient
          id={gradient}
          gradientUnits="userSpaceOnUse"
          x1="19.1113"
          x2="205.54"
          y1="19.1113"
          y2="185.047"
        >
          <stop offset="0" stopColor="#ab40ff" />
          <stop offset="1" stopColor="#5d2bff" />
        </linearGradient>
      </defs>
      <path
        d="m155.529 195.889h-96.0578c-22.2871 0-40.3599-18.073-40.3599-40.36v-96.0578c0-22.2871 18.0728-40.3599 40.3599-40.3599h96.0578c22.287 0 40.36 18.0728 40.36 40.3599v96.0578c0 22.287-18.073 40.36-40.36 40.36z"
        fill={`url(#${gradient})`}
      />
      <g fill="#fff">
        <path d="m73.1919 146.456-21.6697-36.625c-1.2643-2.137-.5586-4.891 1.5779-6.155l17.1123-10.1246c2.1366-1.2643 4.8906-.5586 6.1549 1.578l12.1923 20.6016 12.6524-21.7581c15.809-25.9233 32.186 2.7246 24.718 14.9071l-21.758 37.449c-1.872 3.215-5.3019 5.204-9.0165 5.214l-12.8979.049c-3.7243.02-7.1742-1.941-9.0657-5.136z" />
        <path d="m164.84 118.994c0 8.978-7.282 16.26-16.26 16.26s-16.26-7.282-16.26-16.26c0-8.977 7.282-16.26 16.26-16.26s16.26 7.283 16.26 16.26zm-67.4498 11.732c3.5678 6.057 12.3388 6.027 15.8678-.049l12.662-21.797c6.606-10.7715 14.065-16.5344 23.395-17.7987 2.264-.3038 4.479-.8331 5.077-4.234l3.46-19.4252c.588-2.8325-1.569-5.4885-4.46-5.4885-17.004 0-36.773 6.743-52.199 32.0291l-12.653 21.7583z" />
      </g>
    </svg>
  )
}
