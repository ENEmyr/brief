'use client'
import { useEffect, useRef, useState } from 'react'
import { copyText } from '@/shared/clipboard'
import { FOCUS_RING } from '../lib/styles'
import styles from './landing.module.css'

export function CopyButton({ text, label, className }: { text: string; label: string; className: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  async function onCopy() {
    if ((await copyText(text)) !== 'copied') return
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? 'Copied' : label}
      className={`${styles.btn} text-[12px] text-text ${FOCUS_RING} ${className}`}
    >
      {copied ? 'copied' : 'copy'}
    </button>
  )
}
