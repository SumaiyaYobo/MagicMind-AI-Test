"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Content } from "@/types/content"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { BookOpen, Calendar, Clock, ArrowLeft, Check, X, RefreshCw } from "lucide-react"
import ContentView from "@/components/content/ContentView"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/quiz-components"
import dynamic from "next/dynamic"

// Dynamically import Confetti to avoid SSR issues
const Confetti = dynamic(() => import('react-confetti'), {
  ssr: false
})

interface QuizQuestion {
  question: string
  options: {
    id: string
    text: string
  }[]
  correctAnswer: string
  explanation: string
}

interface Quiz {
  quiz: QuizQuestion[]
}

// Define types for the evaluations
interface ShortAnswerEvaluation {
  questionId: number;
  isCorrect: boolean;
  pointsEarned: number;
  feedback: string;
}

interface ShortAnswerResults {
  evaluations: ShortAnswerEvaluation[];
  totalScore: number;
  percentageScore: number;
  overallFeedback: string;
}

export default function GeneratedCourses() {
  const { user } = useUser()
  const userId = "user_2rfLQ3ssZOGC6VrVoQg03EeBKgI" // Use actual user ID in production
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContent, setSelectedContent] = useState<Content | null>(null)
  
  // Quiz state
  const [quizMode, setQuizMode] = useState(false)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizLoading, setQuizLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0
  })
  const [wrongAnswers, setWrongAnswers] = useState<QuizQuestion[]>([])
  const [retakeLoading, setRetakeLoading] = useState(false)
  
  // Short answer state
  const [shortAnswerMode, setShortAnswerMode] = useState(false)
  const [shortAnswerQuestions, setShortAnswerQuestions] = useState<any[]>([])
  const [shortAnswers, setShortAnswers] = useState<Record<number, string>>({})
  const [shortAnswerSubmitted, setShortAnswerSubmitted] = useState(false)
  const [shortAnswerResults, setShortAnswerResults] = useState<any>(null)
  const [shortAnswerLoading, setShortAnswerLoading] = useState(false)
  const [shortAnswerRetakeLoading, setShortAnswerRetakeLoading] = useState(false)

  useEffect(() => {
    if (userId) {
      fetchContents()
    }
  }, [userId])

  const fetchContents = async () => {
    try {
      const response = await fetch(`http://localhost:8000/content/user/${userId}`)
      const data = await response.json()
      // Filter OUT Python courses (Day-1, Day-2, Day-3)
      const nonPythonContent = data.filter((content: any) => 
        !content.title.includes('Python Day')
      )
      setContents(nonPythonContent)
      setLoading(false)
    } catch (error) {
      toast.error("Failed to fetch contents")
      setLoading(false)
    }
  }

  // Function to extract or generate a course image based on title
  const getCourseImage = (title: string) => {
    const topics = [
      { keyword: "javascript", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" },
      { keyword: "react", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" },
      { keyword: "node", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" },
      { keyword: "css", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg" },
      { keyword: "html", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg" },
      { keyword: "java", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg" },
      { keyword: "c++", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg" },
      { keyword: "c#", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg" },
      { keyword: "ruby", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/ruby/ruby-original.svg" },
      { keyword: "php", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/php/php-original.svg" },
      { keyword: "go", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg" },
      { keyword: "rust", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-plain.svg" },
      { keyword: "typescript", img: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" }
    ]

    const lowerTitle = title.toLowerCase()
    const matchedTopic = topics.find(topic => lowerTitle.includes(topic.keyword))
    
    if (matchedTopic) {
      return matchedTopic.img
    }
    
    // Default image if no match
    return "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/devicon/devicon-original.svg"
  }

  // Function to extract a course duration from content
  const getCourseDuration = (content: Content) => {
    // This is an example - you might need to adjust based on actual data
    const contentLength = 
      (content.contentTheory?.length || 0) + 
      (content.contentCodes?.length || 0) + 
      (content.contentSyntax?.length || 0)
    
    if (contentLength > 8000) return "10-15 hours"
    if (contentLength > 5000) return "5-10 hours"
    if (contentLength > 2000) return "3-5 hours"
    return "1-3 hours"
  }

  // Function to extract date created or last updated
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Recently added"
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Update window size for confetti
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight
        })
      }
      
      // Set initial size
      handleResize()
      
      // Add event listener
      window.addEventListener('resize', handleResize)
      
      // Clean up
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  }

  // Quiz Functions
  const startQuiz = async (includeWrongAnswers = false) => {
    if (!selectedContent) return
    
    setQuizLoading(true)
    try {
      // Combine all content sections to create a comprehensive quiz
      const content = `
        ${selectedContent.contentTheory || ''}
        ${selectedContent.contentCodes || ''}
        ${selectedContent.contentSyntax || ''}
      `
      
      let requestBody = {
        content,
        topic: selectedContent.title
      }
      
      // If we have wrong answers and this is a retake, include them
      if (includeWrongAnswers && wrongAnswers.length > 0) {
        requestBody = {
          ...requestBody,
          // @ts-ignore - adding a property for wrong answers
          wrongAnswers: wrongAnswers.map(q => ({
            question: q.question,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation
          }))
        }
      }
      
      const response = await fetch('http://localhost:8000/newcontent/generate_json_quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
      
      const data = await response.json()
      
      // Check if the response is a string, parse it if needed
      const quizData = typeof data === 'string' ? JSON.parse(data) : data
      
      setQuiz(quizData)
      setQuizMode(true)
      setSelectedAnswers({})
      setCurrentQuestionIndex(0)
      setQuizSubmitted(false)
      setWrongAnswers([])
    } catch (error) {
      console.error('Quiz generation error:', error)
      toast.error('Failed to generate quiz')
    } finally {
      setQuizLoading(false)
      setRetakeLoading(false)
    }
  }

  const handleAnswerSelect = (answerId: string) => {
    // Check if the answer is correct and show confetti if it is
    if (quiz && answerId === quiz.quiz[currentQuestionIndex].correctAnswer) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2000)
    } else if (quiz) {
      // If wrong, add to wrong answers for potential retake
      const wrongQuestion = quiz.quiz[currentQuestionIndex]
      // Only add if not already in the wrong answers
      if (!wrongAnswers.some(q => q.question === wrongQuestion.question)) {
        setWrongAnswers([...wrongAnswers, wrongQuestion])
      }
    }
    
    // Update selected answers
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestionIndex]: answerId
    })
  }

  const nextQuestion = () => {
    if (!quiz) return
    // Move to next question if not at the end
    if (currentQuestionIndex < quiz.quiz.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const submitQuiz = () => {
    setQuizSubmitted(true)
  }

  const resetQuiz = () => {
    setQuizMode(false)
    setQuiz(null)
    setSelectedAnswers({})
    setQuizSubmitted(false)
  }

  const retakeQuiz = () => {
    // Start a new quiz with focus on wrong answers
    setRetakeLoading(true)
    startQuiz(true)
  }

  const getScore = () => {
    if (!quiz) return 0
    let score = 0
    quiz.quiz.forEach((_, index) => {
      if (selectedAnswers[index] === quiz.quiz[index].correctAnswer) {
        score++
      }
    })
    return score
  }

  // Short Answer Quiz Functions
  const startShortAnswerQuiz = async (includeWrongAnswers = false) => {
    if (!selectedContent) return
    
    setShortAnswerLoading(true)
    try {
      // Combine all content sections to create comprehensive questions
      const content = `
        ${selectedContent.contentTheory || ''}
        ${selectedContent.contentCodes || ''}
        ${selectedContent.contentSyntax || ''}
      `
      
      const response = await fetch('http://localhost:8000/newcontent/generate_short_answer_questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          topic: selectedContent.title
        }),
      })
      
      const data = await response.json()
      
      // Check if the response is a string, parse it if needed
      const questionsData = typeof data === 'string' ? JSON.parse(data) : data
      
      setShortAnswerQuestions(questionsData.questions)
      setShortAnswerMode(true)
      setShortAnswers({})
      setShortAnswerSubmitted(false)
      setShortAnswerResults(null)
    } catch (error) {
      console.error('Short answer questions generation error:', error)
      toast.error('Failed to generate short answer questions')
    } finally {
      setShortAnswerLoading(false)
      setShortAnswerRetakeLoading(false)
    }
  }

  const handleShortAnswerChange = (id: number, answer: string) => {
    setShortAnswers({
      ...shortAnswers,
      [id]: answer
    })
  }

  const submitShortAnswers = async () => {
    if (shortAnswerQuestions.length === 0) return
    
    setShortAnswerLoading(true)
    try {
      // Prepare answers in the same order as questions
      const orderedAnswers = shortAnswerQuestions.map(q => shortAnswers[q.id] || '')
      
      const response = await fetch('http://localhost:8000/newcontent/evaluate_short_answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questions: shortAnswerQuestions,
          answers: orderedAnswers,
          topic: selectedContent?.title || 'Course'
        }),
      })
      
      const data = await response.json()
      
      // Check if the response is a string, parse it if needed
      const resultsData = typeof data === 'string' ? JSON.parse(data) : data
      
      setShortAnswerResults(resultsData)
      setShortAnswerSubmitted(true)
    } catch (error) {
      console.error('Short answer evaluation error:', error)
      toast.error('Failed to evaluate short answers')
    } finally {
      setShortAnswerLoading(false)
    }
  }

  const resetShortAnswerQuiz = () => {
    setShortAnswerMode(false)
    setShortAnswerQuestions([])
    setShortAnswers({})
    setShortAnswerSubmitted(false)
    setShortAnswerResults(null)
  }

  const retakeShortAnswerQuiz = () => {
    setShortAnswerRetakeLoading(true)
    startShortAnswerQuiz(true)
  }

  const renderQuizResults = () => {
    if (!quiz) return null
    
    const score = getScore()
    const percentage = Math.round((score / quiz.quiz.length) * 100)
    
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="text-center p-8 bg-card/50 rounded-lg shadow-md border border-border/40 backdrop-blur-sm">
          <h2 className="text-3xl font-bold mb-6 text-foreground">Quiz Results</h2>
          
          <div className="flex justify-center items-center space-x-6 mb-8">
            <div className="text-5xl font-bold text-foreground">{score}<span className="text-2xl text-foreground/70">/{quiz.quiz.length}</span></div>
            <div className="w-72 h-6 bg-background/50 rounded-full overflow-hidden border border-border/40">
              <div 
                className="h-full" 
                style={{
                  width: `${percentage}%`,
                  background: percentage >= 80 
                    ? 'linear-gradient(90deg, rgba(22,163,74,0.7) 0%, rgba(34,197,94,0.7) 100%)' 
                    : percentage >= 60 
                    ? 'linear-gradient(90deg, rgba(202,138,4,0.7) 0%, rgba(234,179,8,0.7) 100%)' 
                    : 'linear-gradient(90deg, rgba(220,38,38,0.7) 0%, rgba(239,68,68,0.7) 100%)'
                }}
              />
            </div>
            <div className="text-2xl font-semibold text-foreground">{percentage}%</div>
          </div>
          
          <div className="p-5 rounded-md mb-8 inline-block font-medium text-lg max-w-2xl" 
               style={{ 
                 backgroundColor: percentage >= 80 ? 'rgba(22, 163, 74, 0.15)' : percentage >= 60 ? 'rgba(202, 138, 4, 0.15)' : 'rgba(220, 38, 38, 0.15)',
                 borderLeft: percentage >= 80 ? '4px solid rgb(22, 163, 74)' : percentage >= 60 ? '4px solid rgb(202, 138, 4)' : '4px solid rgb(220, 38, 38)',
                 color: percentage >= 80 ? 'rgb(22, 163, 74)' : percentage >= 60 ? 'rgb(202, 138, 4)' : 'rgb(220, 38, 38)' 
               }}
          >
            {percentage >= 80 
              ? "Excellent! You've mastered this section." 
              : percentage >= 60 
                ? "Good work! You're on the right track with some room for improvement." 
                : "Review recommended. Let's strengthen your understanding of this topic."}
          </div>
          
          <div className="flex justify-center gap-4 mt-8">
            <Button 
              onClick={resetQuiz} 
              className="px-8 py-2 text-white bg-primary hover:bg-primary/90 rounded-md shadow"
            >
              Return to Course
            </Button>
            
            <Button 
              onClick={retakeQuiz} 
              variant="outline"
              disabled={retakeLoading}
              className="px-8 py-2 rounded-md shadow flex items-center gap-2"
            >
              {retakeLoading ? (
                <>
                  <Spinner />
                  <span>Generating Quiz...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Retake Quiz
                </>
              )}
            </Button>
          </div>
        </div>
        
        <div className="space-y-6">
          <h3 className="text-2xl font-semibold text-foreground">Question Review</h3>
          
          <div className="flex gap-6 mb-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500/20 border border-green-500 rounded-full"></div>
              <span className="text-foreground/80">Correct</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500/20 border border-red-500 rounded-full"></div>
              <span className="text-foreground/80">Incorrect</span>
            </div>
          </div>
          
          {quiz.quiz.map((question, index) => (
            <Card 
              key={index} 
              className={`border-l-4 ${
                selectedAnswers[index] === question.correctAnswer 
                  ? 'border-l-green-500 bg-green-500/5' 
                  : 'border-l-red-500 bg-red-500/5'
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  {selectedAnswers[index] === question.correctAnswer ? (
                    <Check className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  ) : (
                    <X className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
                  )}
                  <div>
                    <CardTitle className="text-lg text-foreground flex items-center">
                      Question {index + 1}
                    </CardTitle>
                    <p className="text-base mt-1 text-foreground/90">{question.question}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {question.options.map((option) => (
                    <div 
                      key={option.id} 
                      className={`p-3 rounded-md ${
                        option.id === question.correctAnswer 
                          ? 'bg-green-500/10 border border-green-500/30' 
                          : option.id === selectedAnswers[index] && option.id !== question.correctAnswer
                            ? 'bg-red-500/10 border border-red-500/30'
                            : 'bg-card/60 border border-border/50'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 flex items-center justify-center rounded-full mr-3 text-sm font-medium"
                             style={{
                               backgroundColor: option.id === question.correctAnswer 
                                 ? 'rgba(22, 163, 74, 0.2)' 
                                 : option.id === selectedAnswers[index] && option.id !== question.correctAnswer
                                   ? 'rgba(220, 38, 38, 0.2)'
                                   : 'rgba(75, 85, 99, 0.1)',
                               color: option.id === question.correctAnswer 
                                 ? 'rgb(22, 163, 74)' 
                                 : option.id === selectedAnswers[index] && option.id !== question.correctAnswer
                                   ? 'rgb(220, 38, 38)'
                                   : 'rgb(156, 163, 175)'
                             }}
                        >
                          {option.id}
                        </div>
                        <span className="text-foreground/90">{option.text}</span>
                        {option.id === question.correctAnswer && (
                          <Check className="h-5 w-5 text-green-500 ml-2" />
                        )}
                        {option.id === selectedAnswers[index] && option.id !== question.correctAnswer && (
                          <X className="h-5 w-5 text-red-500 ml-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-5 p-4 bg-blue-500/5 rounded-md border border-blue-500/20">
                  <h4 className="font-semibold text-blue-400 mb-2">Explanation</h4>
                  <p className="text-foreground/80">{question.explanation}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const renderQuiz = () => {
    if (!quiz) return null
    
    const currentQuestion = quiz.quiz[currentQuestionIndex]
    const isAnswered = currentQuestionIndex in selectedAnswers
    const isLastQuestion = currentQuestionIndex === quiz.quiz.length - 1
    
    const progress = ((currentQuestionIndex + 1) / quiz.quiz.length) * 100
    
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        {showConfetti && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={200} />}
        
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Question {currentQuestionIndex + 1} of {quiz.quiz.length}</h2>
          <div className="text-sm text-foreground/60">
            {Object.keys(selectedAnswers).length} of {quiz.quiz.length} answered
          </div>
        </div>
        
        <Progress value={progress} className="w-full h-2" />
        
        <Card className="border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-foreground">{currentQuestion.question}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {currentQuestion.options.map((option) => (
                <div 
                  key={option.id} 
                  onClick={() => handleAnswerSelect(option.id)}
                  className={`flex items-center space-x-3 p-3 border rounded-md cursor-pointer hover:bg-accent/50 transition-colors
                    ${selectedAnswers[currentQuestionIndex] === option.id ? 'border-primary bg-primary/10' : 'border-border'}
                  `}
                >
                  <input
                    type="radio"
                    id={`option-${option.id}`}
                    name={`question-${currentQuestionIndex}`}
                    value={option.id}
                    checked={selectedAnswers[currentQuestionIndex] === option.id}
                    onChange={() => handleAnswerSelect(option.id)}
                    className="w-4 h-4 text-primary"
                  />
                  <label htmlFor={`option-${option.id}`} className="flex-1 cursor-pointer text-foreground">
                    <span className="font-medium">{option.id}.</span> {option.text}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between pt-4 border-t border-border">
            <Button 
              variant="outline" 
              onClick={prevQuestion}
              disabled={currentQuestionIndex === 0}
              className="border-border text-foreground"
            >
              Previous
            </Button>
            
            <div className="flex gap-2">
              {isLastQuestion ? (
                <Button 
                  onClick={submitQuiz} 
                  disabled={Object.keys(selectedAnswers).length < quiz.quiz.length}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Submit Quiz
                </Button>
              ) : (
                <Button 
                  onClick={nextQuestion} 
                  disabled={!isAnswered}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  Next
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
        
        <div className="flex gap-2 flex-wrap mt-4">
          {quiz.quiz.map((_, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className={`w-10 h-10 ${
                index === currentQuestionIndex
                  ? 'border-2 border-primary bg-primary/10'
                  : index in selectedAnswers
                  ? 'bg-secondary/50 border-border'
                  : 'border-border'
              } text-foreground`}
              onClick={() => setCurrentQuestionIndex(index)}
            >
              {index + 1}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  const renderShortAnswerQuiz = () => {
    if (shortAnswerQuestions.length === 0) return null
    
    return (
      <div className="space-y-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Short Answer Questions</h2>
          <div className="text-sm text-foreground/60">
            {Object.keys(shortAnswers).length} of {shortAnswerQuestions.length} answered
          </div>
        </div>
        
        <div className="space-y-6">
          {shortAnswerQuestions.map((question) => (
            <Card key={question.id} className="border-border">
              <CardHeader className="border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg text-foreground">Question {question.id}</CardTitle>
                    <p className="text-base mt-1 text-foreground/90">{question.question}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      question.difficulty === 'easy' 
                        ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                        : question.difficulty === 'medium'
                        ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                        : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                      {question.difficulty}
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      {question.points} pts
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <Label htmlFor={`answer-${question.id}`} className="text-foreground">
                    Your Answer:
                  </Label>
                  <textarea
                    id={`answer-${question.id}`}
                    value={shortAnswers[question.id] || ''}
                    onChange={(e) => handleShortAnswerChange(question.id, e.target.value)}
                    className="w-full min-h-[120px] p-3 rounded-md border border-border bg-card/50 text-foreground"
                    placeholder="Type your answer here..."
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="flex justify-end mt-8">
          <Button 
            onClick={submitShortAnswers} 
            disabled={shortAnswerLoading || Object.keys(shortAnswers).length < shortAnswerQuestions.length}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-2"
          >
            {shortAnswerLoading ? (
              <>
                <Spinner />
                <span className="ml-2">Evaluating...</span>
              </>
            ) : (
              'Submit Answers'
            )}
          </Button>
        </div>
      </div>
    )
  }

  const renderShortAnswerResults = () => {
    if (!shortAnswerResults) return null
    
    const { evaluations, totalScore, percentageScore, overallFeedback } = shortAnswerResults
    
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="text-center p-8 bg-card/50 rounded-lg shadow-md border border-border/40 backdrop-blur-sm">
          <h2 className="text-3xl font-bold mb-6 text-foreground">Short Answer Results</h2>
          
          <div className="flex justify-center items-center space-x-6 mb-8">
            <div className="text-5xl font-bold text-foreground">{totalScore}<span className="text-2xl text-foreground/70">/100</span></div>
            <div className="w-72 h-6 bg-background/50 rounded-full overflow-hidden border border-border/40">
              <div 
                className="h-full" 
                style={{
                  width: `${percentageScore}%`,
                  background: percentageScore >= 80 
                    ? 'linear-gradient(90deg, rgba(22,163,74,0.7) 0%, rgba(34,197,94,0.7) 100%)' 
                    : percentageScore >= 60 
                    ? 'linear-gradient(90deg, rgba(202,138,4,0.7) 0%, rgba(234,179,8,0.7) 100%)' 
                    : 'linear-gradient(90deg, rgba(220,38,38,0.7) 0%, rgba(239,68,68,0.7) 100%)'
                }}
              />
            </div>
            <div className="text-2xl font-semibold text-foreground">{percentageScore}%</div>
          </div>
          
          <div className="p-5 rounded-md mb-8 text-left max-w-2xl mx-auto bg-blue-500/5 border border-blue-500/20">
            <h3 className="font-semibold text-blue-400 mb-2">Overall Feedback</h3>
            <p className="text-foreground/80">{overallFeedback}</p>
          </div>
          
          <div className="flex justify-center gap-4 mt-8">
            <Button 
              onClick={resetShortAnswerQuiz} 
              className="px-8 py-2 text-white bg-primary hover:bg-primary/90 rounded-md shadow"
            >
              Return to Course
            </Button>
            
            <Button 
              onClick={retakeShortAnswerQuiz} 
              variant="outline"
              disabled={shortAnswerRetakeLoading}
              className="px-8 py-2 rounded-md shadow flex items-center gap-2"
            >
              {shortAnswerRetakeLoading ? (
                <>
                  <Spinner />
                  <span>Generating Questions...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Retake Quiz
                </>
              )}
            </Button>
          </div>
        </div>
        
        <div className="space-y-6">
          <h3 className="text-2xl font-semibold text-foreground">Question Review</h3>
          
          {evaluations.map((evaluation: ShortAnswerEvaluation) => {
            const question = shortAnswerQuestions.find(q => q.id === evaluation.questionId)
            if (!question) return null
            
            const percentCorrect = Math.round((evaluation.pointsEarned / question.points) * 100)
            
            return (
              <Card 
                key={question.id} 
                className={`border-l-4 ${
                  evaluation.isCorrect
                    ? 'border-l-green-500 bg-green-500/5' 
                    : 'border-l-red-500 bg-red-500/5'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {evaluation.isCorrect ? (
                        <Check className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
                      )}
                      <div>
                        <CardTitle className="text-lg text-foreground flex items-center">
                          Question {question.id}
                          <span className="ml-2 text-sm px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {evaluation.pointsEarned}/{question.points} pts
                          </span>
                        </CardTitle>
                        <p className="text-base mt-1 text-foreground/90">{question.question}</p>
                      </div>
                    </div>
                    <div className="w-12 h-12 flex items-center justify-center rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: percentCorrect >= 80 
                          ? 'rgba(22, 163, 74, 0.2)' 
                          : percentCorrect >= 60 
                          ? 'rgba(202, 138, 4, 0.2)'
                          : 'rgba(220, 38, 38, 0.2)',
                        color: percentCorrect >= 80 
                          ? 'rgb(22, 163, 74)' 
                          : percentCorrect >= 60 
                          ? 'rgb(202, 138, 4)'
                          : 'rgb(220, 38, 38)'
                      }}
                    >
                      {percentCorrect}%
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 mt-2">
                    <div className="rounded-md p-4 bg-card/60 border border-border/50">
                      <h4 className="font-medium text-foreground mb-2">Your Answer:</h4>
                      <p className="text-foreground/90">{shortAnswers[question.id] || 'No answer provided'}</p>
                    </div>
                    
                    <div className="rounded-md p-4 bg-green-500/5 border border-green-500/20">
                      <h4 className="font-medium text-green-500 mb-2">Expected Answer:</h4>
                      <p className="text-foreground/90">{question.expectedAnswer}</p>
                    </div>
                    
                    <div className="rounded-md p-4 bg-blue-500/5 border border-blue-500/20">
                      <h4 className="font-medium text-blue-500 mb-2">Feedback:</h4>
                      <p className="text-foreground/80">{evaluation.feedback}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-2 text-foreground">Generated Courses</h1>
      <p className="text-muted-foreground mb-8">Explore our AI-generated course collection</p>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <Spinner />
            <p className="text-muted-foreground">Loading courses...</p>
          </div>
        </div>
      ) : quizMode ? (
        quizSubmitted ? (
          renderQuizResults()
        ) : (
          renderQuiz()
        )
      ) : shortAnswerMode ? (
        shortAnswerSubmitted ? (
          renderShortAnswerResults()
        ) : (
          renderShortAnswerQuiz()
        )
      ) : !selectedContent ? (
        contents.length === 0 ? (
          <div className="text-center py-16 bg-card/40 rounded-lg border border-border">
            <h3 className="text-xl font-medium mb-2">No courses found</h3>
            <p className="text-muted-foreground mb-6">Check back later for new generated content</p>
            <Button onClick={() => fetchContents()}>Refresh</Button>
          </div>
        ) : (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {contents.map((content, index) => (
              <motion.div key={content.id || index} variants={item}>
                <Card 
                  className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 border-border hover:border-primary/20 cursor-pointer"
                  onClick={() => setSelectedContent(content)}
                >
                  <div className="bg-gradient-to-r from-background/80 to-card flex justify-center py-6 border-b border-border">
                    <img 
                      src={getCourseImage(content.title || "")} 
                      alt={content.title} 
                      className="h-24 w-24"
                    />
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl text-foreground">{content.title}</CardTitle>
                    <CardDescription className="line-clamp-2 h-10">
                      {content.prompt?.substring(0, 150)}
                      {content.prompt && content.prompt.length > 150 ? '...' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        <span>{getCourseDuration(content)}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        <span>{formatDate(content.createdAt)}</span>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full"
                      variant="outline"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      View Course
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )
      ) : (
        <div>
          <Button 
            onClick={() => setSelectedContent(null)} 
            variant="outline"
            className="mb-6 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Course List
          </Button>
          
          <div className="mb-4">
            <div className="flex items-center gap-4 mb-6">
              <img 
                src={getCourseImage(selectedContent.title || "")}
                alt={selectedContent.title}
                className="h-16 w-16"
              />
              <div>
                <h2 className="text-2xl font-bold text-foreground">{selectedContent.title}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    <span>{getCourseDuration(selectedContent)}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    <span>{formatDate(selectedContent.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6 flex justify-end gap-3">
              <Button 
                onClick={() => startQuiz()}
                disabled={quizLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {quizLoading ? (
                  <>
                    <Spinner />
                    <span className="ml-2">Generating Quiz...</span>
                  </>
                ) : (
                  'Take Quiz'
                )}
              </Button>
              
              <Button 
                onClick={() => startShortAnswerQuiz()}
                disabled={shortAnswerLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {shortAnswerLoading ? (
                  <>
                    <Spinner />
                    <span className="ml-2">Generating Questions...</span>
                  </>
                ) : (
                  'Take Short Answer Quiz'
                )}
              </Button>
            </div>
          </div>
          
          <ContentView content={selectedContent} />
        </div>
      )}
    </div>
  )
}
