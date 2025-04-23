"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Content } from "@/types/content"
import ContentList from "@/components/content/ContentList"
import ContentView from "@/components/content/ContentView"
import { Spinner } from "@/components/ui/spinner"

interface ContentClientProps {
  userId: string;
}

export default function ContentClient({ userId }: ContentClientProps) {
  // ... rest of your existing ContentPage code ...

  const [title, setTitle] = useState("")
    const [prompt, setPrompt] = useState("")
    const [isPublic, setIsPublic] = useState(false)
    const [loading, setLoading] = useState(false)
    const [contents, setContents] = useState<Content[]>([])
    const [selectedContent, setSelectedContent] = useState<Content | null>(null)
    const [generatingTutorial, setGeneratingTutorial] = useState(false)
  
    useEffect(() => {
      fetchContents()
    }, [userId])
  
    const fetchContents = async () => {
      try {
        const response = await fetch(`http://localhost:8000/content/user/${userId}`)
        const data = await response.json()
        console.log(data)
        // Filter OUT Python course content (Day-1, Day-2, Day-3)
        const nonPythonContent = data.filter((content: Content) => 
          !content.title.includes('Python Day')
        )
        setContents(nonPythonContent)
      } catch (error) {
        toast.error("Failed to fetch contents")
      }
    }
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
  
      try {
        const response = await fetch("http://localhost:8000/content/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            prompt,
            public: isPublic,
            userId,
          }),
        })
  
        if (!response.ok) throw new Error("Failed to create content")
        
        const data = await response.json()
        setContents(prev => [...prev, data])
        setSelectedContent(data)
        toast.success("Content generated successfully!")
        setTitle("")
        setPrompt("")
      } catch (error) {
        toast.error("Failed to create content")
      } finally {
        setLoading(false)
      }
    }
  
    // const generatePythonTutorial = async () => {
    //   setGeneratingTutorial(true);
  
    //   try {
    //     const response = await fetch(`http://localhost:8000/content/create_python_tutorial?user_id=${userId}`, {
    //       method: "POST",
    //     });
  
    //     if (!response.ok) throw new Error("Failed to create Python tutorial");
        
    //     const data = await response.json();
    //     setContents(prev => [...prev, ...data]);
    //     setSelectedContent(data[0]);
    //     toast.success("3-day Python tutorial generated successfully!");
        
    //     // Refresh the content list to show the new tutorials
    //     fetchContents();
    //   } catch (error) {
    //     toast.error("Failed to create Python tutorial");
    //     console.error(error);
    //   } finally {
    //     setGeneratingTutorial(false);
    //   }
    // }
  
    return (
      <div className="flex h-[calc(100vh-4rem)] bg-background/95">
        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto p-8">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Create Learning Content</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Python Lists Explained"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prompt">Prompt</Label>
                    <Input
                      id="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g., Explain Python lists for a 10-year-old beginner"
                      required
                    />
                  </div>
                  {/* <div className="flex items-center space-x-2">
                    <Switch
                      id="public"
                      checked={isPublic}
                      onCheckedChange={setIsPublic}
                    />
                    <Label htmlFor="public">Make this content public</Label>
                  </div> */}
                  <Button 
                    type="submit" 
                    disabled={loading || generatingTutorial}
                    size="lg"
                    className="w-full"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner />
                        Generating Content...
                      </span>
                    ) : (
                      "Generate Content"
                    )}
                  </Button>
                </form>
                
                {/* <div className="mt-4 pt-4 border-t">
                  <Button 
                    onClick={generatePythonTutorial}
                    disabled={loading || generatingTutorial}
                    variant="outline"
                    className="w-full"
                  >
                    {generatingTutorial ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner />
                        Generating 3-Day Python Tutorial...
                      </span>
                    ) : (
                      "Generate 3-Day Python Tutorial"
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Creates a comprehensive 3-day Python tutorial covering variables, data types, 
                    control structures, functions, modules, error handling, file I/O, OOP, and key libraries.
                  </p>
                </div> */}
              </CardContent>
            </Card>
  
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-4">
                  <Spinner />
                  <p className="text-muted-foreground">Generating your content...</p>
                </div>
              </div>
            ) : (
              selectedContent && (
                <div className="animate-fadeIn">
                  <ContentView content={selectedContent} />
                </div>
              )
            )}
          </div>
        </div>
        <ContentList 
          contents={contents}
          onContentClick={setSelectedContent}
          selectedContent={selectedContent}
        />
      </div>
    );



}