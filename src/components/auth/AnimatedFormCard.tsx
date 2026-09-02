import { ReactNode } from 'react'

interface AnimatedFormCardProps {
  children: ReactNode
  className?: string
}

export function AnimatedFormCard({ children, className = '' }: AnimatedFormCardProps) {
  return <div className={`relative animate-auth-card-in ${className}`}>{children}</div>
}

export function AnimatedFormItem({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`animate-auth-item-in ${className}`}>{children}</div>
}
