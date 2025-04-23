import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { Send, Info, Bot, User } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Define types for our chat messages
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatInterfaceProps {
  userId: string
  contentId?: string
  selectedText: string
}

export default function ChatInterface({ 
  userId, 
  contentId = '4a3b165c-fae2-4965-bfcc-7cf1af28d4d1', 
  selectedText 
}: ChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "👋 Hi there! I'm your AI mentor. Select some text from the content and ask me a question about it.",
      timestamp: new Date()
    }
  ])
  const [loading, setLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Make sure the ScrollArea is initialized properly
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current;
    if (scrollContainer) {
      // Force a reflow to make sure the scroll area is properly initialized
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, []);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (!inputMessage.trim()) return
    
    // Check if there's selected text
    if (!selectedText) {
      toast.error("Please select some text from the content first")
      return
    }

    // Create new user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date()
    }
    
    // Add user message to chat
    setMessages(prev => [...prev, userMessage])
    
    // Clear input
    setInputMessage("")
    
    // Show loading state
    setLoading(true)
    
    try {
      // Call the API
      const res = await fetch("http://localhost:8000/mentor/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: selectedText,
          question: userMessage.content,
          userId,
          contentId
        }),
      })
      
      const data = await res.json()
      
      // Create new assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date()
      }
      
      // Add assistant message to chat
      setMessages(prev => [...prev, assistantMessage])
      
    } catch (error) {
      toast.error("Failed to get response from AI mentor")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send message on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Mentor Chat
          </CardTitle>
          {selectedText ? (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-2 text-xs">
              <span className="font-medium text-blue-500">Selected Context:</span>
              <p className="line-clamp-2 text-muted-foreground mt-1">
                {selectedText.substring(0, 100)}
                {selectedText.length > 100 ? '...' : ''}
              </p>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-2">
              <div className="flex items-center gap-2 text-amber-500">
                <Info className="h-4 w-4" />
                <p className="text-xs font-medium">Please select text from the content</p>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-3 overflow-hidden">
          {/* Messages area */}
          <ScrollArea className="flex-1 h-full overflow-y-auto pr-4" ref={scrollAreaRef}>
            <div className="space-y-4 pb-4 min-h-full">
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`flex items-start gap-3 ${message.role === 'assistant' ? '' : 'flex-row-reverse'}`}
                >
                  <Avatar className={`h-8 w-8 ${message.role === 'user' ? 'bg-primary' : 'bg-muted'}`}>
                    {message.role === 'user' ? (
                      <>
                        <AvatarFallback>U</AvatarFallback>
                        <AvatarImage src="/avatar-placeholder.png" />
                      </>
                    ) : (
                      <>
                        <AvatarFallback>AI</AvatarFallback>
                        <AvatarImage src="/ai-avatar.png" />
                      </>
                    )}
                  </Avatar>
                  
                  <div className={`rounded-lg p-3 max-w-[85%] ${
                    message.role === 'assistant' 
                      ? 'bg-muted text-foreground' 
                      : 'bg-primary text-primary-foreground'
                  }`}>
                    {message.role === 'assistant' ? (
                      <div className="prose dark:prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                            pre: ({ children }) => (
                              <pre className="bg-background text-foreground rounded-md p-2 my-2 overflow-x-auto text-xs">
                                {children}
                              </pre>
                            ),
                            code: ({ children }) => (
                              <code className="bg-background text-foreground px-1 py-0.5 rounded text-xs">
                                {children}
                              </code>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {/* Loading indicator */}
              {loading && (
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 bg-muted">
                    <AvatarFallback>AI</AvatarFallback>
                    <AvatarImage src="/ai-avatar.png" />
                  </Avatar>
                  <div className="rounded-lg p-3 bg-muted">
                    <Spinner className="h-4 w-4" />
                  </div>
                </div>
              )}
              {/* This div helps us scroll to the bottom */}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          
          {/* Input area */}
          <form onSubmit={sendMessage} className="mt-4 flex items-end gap-2">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedText ? "Ask a question about the selected text..." : "Please select text first..."}
              className="min-h-[60px] max-h-[150px] resize-none"
              disabled={loading || !selectedText}
            />
            <Button 
              type="submit" 
              disabled={loading || !selectedText || !inputMessage.trim()}
              className="h-10 w-10 p-0"
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 