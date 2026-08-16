/**
 * Compile-time face for the platform module table.
 * At runtime the web shell seeds `@deepseek-ai/dsh-client-ui-primitives`.
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ButtonHTMLAttributes, ReactNode } from 'react'

  export function Button(props: {
    variant?: 'primary' | 'ghost' | 'outline' | 'toolbar'
    size?: 'md' | 'sm'
    icon?: ReactNode
    className?: string | undefined
    children?: ReactNode
  } & ButtonHTMLAttributes<HTMLButtonElement>): ReactNode

  export function IconRefreshOutline16(props: { size?: number; className?: string | undefined }): ReactNode
  export function IconPlusOutline16(props: { size?: number; className?: string | undefined }): ReactNode
  export function IconChevronDownOutline14(props: { size?: number; className?: string | undefined }): ReactNode
  export function IconLinkOutline14(props: { size?: number; className?: string | undefined }): ReactNode
  export function StateDot(props: { state: 'done' | 'warning' | 'ongoing' | 'error'; size?: number; className?: string | undefined }): ReactNode
  export function DisclosureRow(props: {
    icon: ReactNode
    title: string
    open: boolean
    expandable: boolean
    onToggle: () => void
    expandOnRowClick?: boolean
    keepContentWhenOpen?: boolean
    collapsedContent?: ReactNode
    children?: ReactNode
  }): ReactNode

  export function Input(props: {
    icon?: ReactNode
    className?: string | undefined
    value?: string
    placeholder?: string
    disabled?: boolean
    'aria-label'?: string
    onChange?: (event: { target: { value: string } }) => void
  }): ReactNode
}
