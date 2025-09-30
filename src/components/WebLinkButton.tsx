import { Link as LinkIcon } from "lucide-react"

interface WebLinkButtonProps {
  onClick: () => void
  isActive?: boolean
}

export function WebLinkButton({ 
  onClick,
  isActive = false
}: WebLinkButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`transition-colors ${
        isActive 
          ? "text-blue-600 hover:text-blue-700" 
          : "text-gray-500 hover:text-gray-700"
      }`}
      title="Add web link"
    >
      <LinkIcon className="h-4 w-4" />
    </button>
  )
}
