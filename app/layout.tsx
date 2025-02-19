import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Montunu Al',
  description: 'created in 5 min dont judge pls',
  generator: 'berkay.cloud',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
