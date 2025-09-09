import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'

export function PersonalNotes() {
  const [content, setContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const displayRef = useRef<HTMLDivElement>(null)

  // Load content from localStorage on mount
  useEffect(() => {
    const savedContent = localStorage.getItem('personal-notes')
    if (savedContent) {
      setContent(savedContent)
    }
  }, [])

  // Save to localStorage whenever content changes
  useEffect(() => {
    if (content) {
      localStorage.setItem('personal-notes', content)
    }
  }, [content])

  const handleClick = () => {
    setIsEditing(true)
    // Focus the textarea after a brief delay to ensure it's rendered
    setTimeout(() => {
      if (textareaRef.current && displayRef.current) {
        // Set initial height based on display content
        const displayHeight = displayRef.current.offsetHeight
        textareaRef.current.style.height = `${Math.max(displayHeight, 32)}px`
        textareaRef.current.focus()
        textareaRef.current.select()
      }
    }, 0)
  }

  const handleBlur = () => {
    // Only exit edit mode if we're actually in edit mode
    if (isEditing) {
      setIsEditing(false)
    }
  }



  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [])

  // Resize textarea when content changes
  useEffect(() => {
    if (isEditing) {
      autoResize()
    }
  }, [content, isEditing, autoResize])

  // Handle clicking outside to close edit mode and keyboard shortcuts
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditing && textareaRef.current) {
        const target = event.target as Node
        const textarea = textareaRef.current
        
        // Check if the click is outside the textarea
        if (!textarea.contains(target)) {
          setIsEditing(false)
        }
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditing) {
        // Save on Ctrl+Enter or Escape - works regardless of text selection
        if (event.key === 'Escape' || (event.ctrlKey && event.key === 'Enter')) {
          event.preventDefault()
          setIsEditing(false)
        }
      }
    }

    if (isEditing) {
      // Add a small delay to prevent immediate closing when entering edit mode
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
      }, 100)
      
      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isEditing])

  // Simple markdown renderer
  const renderMarkdown = (text: string) => {
    if (!text.trim()) {
      return <p className="text-gray-500 italic">Click here to add your personal notes and todos...</p>
    }

    return text.split('\n').map((line, index) => {
      // Headers
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-bold mb-2">{line.slice(2)}</h1>
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-semibold mb-2">{line.slice(3)}</h2>
      }
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg font-medium mb-1">{line.slice(4)}</h3>
      }
      
      // Lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={index} className="ml-4 mb-1">{line.slice(2)}</li>
      }
      if (line.startsWith('  - ') || line.startsWith('  * ')) {
        return <li key={index} className="ml-8 mb-1 text-sm text-gray-600">{line.slice(4)}</li>
      }
      
      // Checkboxes
      if (line.startsWith('- [ ] ')) {
        return (
          <li key={index} className="ml-4 mb-1 flex items-center">
            <input type="checkbox" className="mr-2" disabled />
            <span>{line.slice(6)}</span>
          </li>
        )
      }
      if (line.startsWith('- [x] ')) {
        return (
          <li key={index} className="ml-4 mb-1 flex items-center">
            <input type="checkbox" className="mr-2" checked disabled />
            <span className="line-through text-gray-500">{line.slice(6)}</span>
          </li>
        )
      }
      
      // Code blocks
      if (line.startsWith('```')) {
        return <div key={index} className="bg-gray-100 p-2 rounded font-mono text-sm my-2">Code block</div>
      }
      
      // Regular paragraphs
      if (line.trim()) {
        return <p key={index} className="mb-2">{line}</p>
      }
      
      // Empty lines
      return <br key={index} />
    })
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-blue-600" />
          Personal Notes & Todos
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pb-6">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            placeholder="Write your personal notes and todos in markdown...

# Today's Tasks
- [ ] Review PR #123
- [ ] Fix bug in authentication
- [ ] Update documentation

## Notes
- Remember to check with team about new API
- Schedule meeting for next week

## Ideas
- Consider implementing dark mode
- Add keyboard shortcuts for common actions"
            className="w-full p-3 border-0 bg-transparent focus:outline-none font-mono text-sm resize-none overflow-hidden"
            style={{ 
              minHeight: '2rem',
              lineHeight: '1.5'
            }}
          />
        ) : (
          <div 
            ref={displayRef}
            className="prose prose-sm max-w-none cursor-text hover:bg-gray-50 rounded p-3 -m-3 transition-colors"
            onClick={handleClick}
          >
            {renderMarkdown(content)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
