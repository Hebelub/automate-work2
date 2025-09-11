import { Copy, Check } from "lucide-react"
import { useState } from "react"

interface CopyButtonProps {
  textToCopy: string
  tooltip: string
  icon?: React.ReactNode
  className?: string
  successIcon?: React.ReactNode
  successDuration?: number
}

export function CopyButton({ 
  textToCopy, 
  tooltip, 
  icon = <Copy className="h-4 w-4" />,
  className = "text-gray-400 hover:text-gray-600 transition-colors",
  successIcon = <Check className="h-4 w-4 text-green-600" />,
  successDuration = 2000
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), successDuration)
    }).catch(() => {
      // Handle error if copying fails
    })
  }

  return (
    <button
      onClick={handleCopy}
      className={className}
      title={tooltip}
    >
      {copied ? successIcon : icon}
    </button>
  )
}
