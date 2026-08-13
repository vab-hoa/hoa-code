'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

export function Nav() {
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/properties', label: 'Properties' },
    { href: '/emails', label: 'Emails' },
    { href: '/snapshots', label: 'Snapshots' },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-surface border-b border-edge shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-semibold text-ink hover:text-blue-300">
              🏠 HOA Tracker
            </Link>
            <div className="flex items-center gap-1">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                    pathname === href
                      ? 'bg-edge/50 text-blue-300'
                      : 'text-mute hover:text-ink hover:bg-edge/25'
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
