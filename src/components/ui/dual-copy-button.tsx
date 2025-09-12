import { Copy, Link, Check } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"

interface DualCopyButtonProps {
  identifier: string // e.g., "PROJ-123" or "#456"
  url: string
  identifierTooltip?: string
  urlTooltip?: string
  className?: string
  iconSize?: string
}

export function DualCopyButton({ 
  identifier, 
  url, 
  identifierTooltip = "Copy identifier",
  urlTooltip = "Copy URL",
  className = "text-gray-400 hover:text-gray-600 transition-colors",
  iconSize = "h-3 w-3"
}: DualCopyButtonProps) {
  return (
    <div className="flex items-center gap-1">
      <CopyButton
        textToCopy={identifier}
        tooltip={identifierTooltip}
        icon={<Copy className={iconSize} />}
        className={className}
        successIcon={<Check className={`${iconSize} text-green-600`} />}
      />
      <CopyButton
        textToCopy={url}
        tooltip={urlTooltip}
        icon={<Link className={iconSize} />}
        className={className}
        successIcon={<Check className={`${iconSize} text-green-600`} />}
      />
    </div>
  )
}
