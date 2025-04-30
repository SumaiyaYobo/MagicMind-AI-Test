"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import { Content } from "@/types/content"
import ContentView from "@/components/content/ContentView"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Check, X, RefreshCw } from "lucide-react"
import { RadioGroup, RadioGroupItem, Progress } from "@/components/ui/quiz-components"
import dynamic from "next/dynamic"

// Dynamically import Confetti to avoid SSR issues
const ReactConfetti = dynamic(() => import('react-confetti'), {
  ssr: false
})

// Define props interface for the wrapper
interface ConfettiProps {
  width: number;
  height: number;
  recycle?: boolean;
  numberOfPieces?: number;
}

// Wrapper component with proper typing
function Confetti({ width, height, recycle = false, numberOfPieces = 200 }: ConfettiProps) {
  return (
    <ReactConfetti
      width={width}
      height={height}
      recycle={recycle}
      numberOfPieces={numberOfPieces}
    />
  )
}

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

export default function PythonCourse() {
  const { user } = useUser()
  const userId = "user_2rfLQ3ssZOGC6VrVoQg03EeBKgI"
  const [contents, setContents] = useState<Content[]>([])
  const [selectedContent, setSelectedContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
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
  const [shortAnswerMode, setShortAnswerMode] = useState(false)
  const [shortAnswerQuestions, setShortAnswerQuestions] = useState<any[]>([])
  const [shortAnswers, setShortAnswers] = useState<Record<number, string>>({})
  const [shortAnswerSubmitted, setShortAnswerSubmitted] = useState(false)
  const [shortAnswerResults, setShortAnswerResults] = useState<any>(null)
  const [shortAnswerLoading, setShortAnswerLoading] = useState(false)
  const [shortAnswerRetakeLoading, setShortAnswerRetakeLoading] = useState(false)
  
  // Track unlocked Python days
  const [unlockedDays, setUnlockedDays] = useState<number[]>([1]) // Day 1 is always unlocked
  const [generatingContent, setGeneratingContent] = useState(false)
  const [examResults, setExamResults] = useState<any[]>([])
  const [fetchingExams, setFetchingExams] = useState(false)

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

  useEffect(() => {
    if (userId) {
      fetchContents()
      fetchCompletedExams()
    }
  }, [userId])

  // Fetch completed exams to determine which days to unlock
  const fetchCompletedExams = async () => {
    setFetchingExams(true)
    try {
      const response = await fetch(`http://localhost:8000/exams/user/${userId}`)
      
      console.log('Exam API response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Exam results fetched:', data)
        setExamResults(data)
        
        // Determine which days to unlock based on exam results
        const newUnlockedDays = [1] // Day 1 is always unlocked
        
        // Loop through exam results and unlock next day if passing grade (>= 60%)
        data.forEach((exam: any) => {
          // Extract the day number from the course name (Python Day-X)
          const match = exam.courseName.match(/Python Day-(\d+)/)
          if (match) {
            const completedDay = parseInt(match[1])
            const nextDay = completedDay + 1
            
            // If they passed this exam and the next day is valid (2 or 3)
            if (exam.percentage >= 60 && nextDay <= 3) {
              console.log(`Unlocking Day-${nextDay} based on exam result for Day-${completedDay} with score ${exam.percentage}%`)
              newUnlockedDays.push(nextDay)
            }
          }
        })
        
        // Update unlocked days
        console.log('Unlocked days after checking exams:', Array.from(new Set(newUnlockedDays)))
        setUnlockedDays(Array.from(new Set(newUnlockedDays)))
      } else {
        // Handle error response
        const errorData = await response.json().catch(() => null)
        console.error("Error fetching exam results:", errorData || response.statusText)
        
        // Continue with default unlock state (Day-1 only)
        console.log("Using default unlock state (Day-1 only)")
      }
    } catch (error) {
      console.error("Failed to fetch exam results:", error)
      // Continue with default unlock state
    } finally {
      setFetchingExams(false)
    }
  }

  const fetchContents = async () => {
    try {
      const response = await fetch(`http://localhost:8000/content/user/${userId}`)
      const data = await response.json()
      // Filter for Python course content (Day-1, Day-2, Day-3)
      const pythonContent = data.filter((content: Content) => 
        content.title.includes('Python Day')
      )
      
      // Determine which days are unlocked based on the existing content
      const days = pythonContent.map((content: Content) => {
        // Extract day number from title (Python Day-1, Python Day-2, etc.)
        const match = content.title.match(/Python Day-(\d+)/)
        return match ? parseInt(match[1]) : 0
      })
      
      setContents(pythonContent)
      setLoading(false)
    } catch (error) {
      toast.error("Failed to fetch contents")
      setLoading(false)
    }
  }

  // Save exam result to database
  const saveExamResult = async (day: number, courseName: string, percentage: number, score: number, total: number) => {
    try {
      // Create simplified exam record
      const examRecord = {
        userId: userId,
        courseId: `python-day-${day}`,
        courseName: courseName,
        examDate: new Date().toISOString(),
        difficulty: day === 1 ? 'beginner' : day === 2 ? 'intermediate' : 'advanced',
        timeLimit: 1800, // 30 minutes in seconds
        timeSpent: 900, // Placeholder - 15 minutes in seconds
        mcqQuestions: JSON.stringify(quiz?.quiz || []),
        shortAnswerQuestions: '[]',
        codingProblems: '[]',
        mcqScore: score,
        mcqTotal: total,
        mcqPercentage: percentage,
        shortAnswerScore: 0,
        shortAnswerTotal: 0,
        shortAnswerPercentage: 0,
        codingScore: 0,
        codingTotal: 0,
        codingPercentage: 0,
        totalScore: score,
        totalPossible: total,
        percentage: percentage,
        feedback: percentage >= 80 
          ? "Excellent work! You've mastered this section." 
          : percentage >= 60 
            ? "Good job! You're on the right track." 
            : "Keep practicing. You'll get it!"
      }
      
      console.log('Saving exam result to database:', examRecord)
      
      // Save to database
      const response = await fetch('http://localhost:8000/exams/save_result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examRecord)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to save exam results:', errorText)
        
        // Show error message to user
        toast.error("Failed to save exam results. The course is still unlocked for this session.")
        
        // Still unlock the next day in the UI for this session
        if (percentage >= 60) {
          const match = courseName.match(/Python Day-(\d+)/)
          if (match) {
            const currentDay = parseInt(match[1])
            const nextDay = currentDay + 1
            
            if (nextDay <= 3 && !unlockedDays.includes(nextDay)) {
              setUnlockedDays(prev => [...prev, nextDay])
              toast.success(`Python Day-${nextDay} has been unlocked!`)
            }
          }
        }
      } else {
        console.log('Exam results saved successfully!')
        toast.success("Exam results saved successfully!")
        // Refresh exam results
        fetchCompletedExams()
      }
    } catch (error) {
      console.error('Error saving exam results:', error)
      toast.error("Failed to save exam results due to a network error.")
    }
  }

  // Function to handle when a Python day card is clicked
  const handleDayClick = async (dayNumber: number) => {
    // Check if the content for this day already exists
    const existingContent = contents.find(content => 
      content.title === `Python Day-${dayNumber}`
    )
    
    if (existingContent) {
      // If content exists, just select it
      setSelectedContent(existingContent)
    } else if (unlockedDays.includes(dayNumber)) {
      // If day is unlocked but content doesn't exist, generate it
      setGeneratingContent(true)
      
      try {
        let title = `Python Day-${dayNumber}`
        let prompt = ""
        
        // Set the base prompt based on the day
        if (dayNumber === 2) {
          prompt = "Python functions, modules, error handling"
          
          // Fetch wrong answers from Day-1 to include in the prompt
          prompt = await fetchWrongAnswersForPrompt(1, prompt, dayNumber)
        } else if (dayNumber === 3) {
          prompt = "Python file I/O, object‑oriented programming, key libraries"
          
          // Fetch wrong answers from Day-2 to include in the prompt
          prompt = await fetchWrongAnswersForPrompt(2, prompt, dayNumber)
        }
        
        console.log(`Final prompt for Day-${dayNumber}:`, prompt)
        
        // Create the request body object
        const requestBody = {
            title,
            prompt,
            public: true,
            userId,
        };
        
        // Log the request body for debugging
        console.log(`Request body for content creation:`, JSON.stringify(requestBody));
        
        // Call the API to create content
        const response = await fetch("http://localhost:8000/content/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })
        
        if (!response.ok) throw new Error("Failed to create content")
        
        const data = await response.json()
        
        // Add the new content to the state
        setContents(prev => [...prev, data])
        setSelectedContent(data)
        toast.success(`Python Day-${dayNumber} content generated successfully!`)
      } catch (error) {
        console.error(error)
        toast.error(`Failed to generate Python Day-${dayNumber} content`)
      } finally {
        setGeneratingContent(false)
      }
    } else {
      // If day is locked, show a message
      toast.error(`Complete Python Day-${dayNumber-1} quiz first to unlock this content`)
    }
  }
  
  // Function to fetch wrong answers from previous days and include in prompt
  const fetchWrongAnswersForPrompt = async (previousDay: number, basePrompt: string, currentDay: number) => {
    try {
      // First try to get wrong answers from the wrong_answers endpoint
      const wrongAnswersResponse = await fetch(`http://localhost:8000/exams/wrong_answers/${userId}`)
      
      if (wrongAnswersResponse.ok) {
        const wrongAnswersData = await wrongAnswersResponse.json()
        console.log(`Wrong answers data for Day-${previousDay}:`, wrongAnswersData)
        
        // Filter wrong answers for the specific previous day
        const previousDayWrongAnswers = wrongAnswersData.filter((answer: any) => 
          answer.courseName && answer.courseName.includes(`Python Day-${previousDay}`)
        )
        
        // If there are wrong answers for the previous day
        if (previousDayWrongAnswers.length > 0) {
          // Create a detailed section for wrong answers to include in the prompt
          let wrongAnswersPrompt = `\n\nFocus on these concepts that the student had difficulty with in Day-${previousDay}:\n`
          
          // Add wrong MCQ questions and answers
          const mcqWrongAnswers = previousDayWrongAnswers.filter((a: any) => a.questionType === "MCQ")
          if (mcqWrongAnswers.length > 0) {
            wrongAnswersPrompt += "\nMultiple Choice Questions they got wrong:\n"
            
            mcqWrongAnswers.forEach((mcq: any, index: number) => {
              wrongAnswersPrompt += `${index + 1}. Question: ${mcq.question}\n`
              wrongAnswersPrompt += `   Correct Answer: ${mcq.correctAnswer}\n`
              wrongAnswersPrompt += `   Their Answer: ${mcq.userAnswer}\n`
              if (mcq.explanation) {
                wrongAnswersPrompt += `   Explanation: ${mcq.explanation}\n`
              }
              wrongAnswersPrompt += "\n"
            })
          }
          
          // Add wrong short answer questions and answers
          const shortAnswerWrongAnswers = previousDayWrongAnswers.filter((a: any) => a.questionType === "ShortAnswer")
          if (shortAnswerWrongAnswers.length > 0) {
            wrongAnswersPrompt += "\nShort Answer Questions they got wrong:\n"
            
            shortAnswerWrongAnswers.forEach((sa: any, index: number) => {
              wrongAnswersPrompt += `${index + 1}. Question: ${sa.question}\n`
              wrongAnswersPrompt += `   Expected Answer: ${sa.correctAnswer}\n`
              wrongAnswersPrompt += `   Their Answer: ${sa.userAnswer}\n`
              if (sa.explanation) {
                wrongAnswersPrompt += `   Feedback: ${sa.explanation}\n`
              }
              wrongAnswersPrompt += "\n"
            })
          }
          
          // Then fetch exam records to get overall performance
          const examsResponse = await fetch(`http://localhost:8000/exams/user/${userId}`)
          if (examsResponse.ok) {
            const examsData = await examsResponse.json()
            
            // Filter for the previous day's exams
            const previousDayExams = examsData.filter((exam: any) => 
              exam.courseName && exam.courseName.includes(`Python Day-${previousDay}`)
            )
            
            if (previousDayExams.length > 0) {
              // Get the most recent exam (first one)
              const latestExam = previousDayExams[0]
              wrongAnswersPrompt += `\nOverall performance on Day-${previousDay}: ${latestExam.percentage}%\n`
              
              // Add specific instructions based on their performance
              if (latestExam.percentage < 70) {
                wrongAnswersPrompt += `The student struggled with Day-${previousDay} concepts. Please include more examples and explanations.\n`
              } else if (latestExam.percentage < 90) {
                wrongAnswersPrompt += `The student did reasonably well on Day-${previousDay}, but could use reinforcement of key concepts.\n`
              } else {
                wrongAnswersPrompt += `The student did very well on Day-${previousDay}, but would benefit from advanced applications of these concepts.\n`
              }
            }
          }
          
          // Update the prompt with the wrong answers section
          let enhancedPrompt = basePrompt;
          if (currentDay === 2) {
            // For Day-2, append wrong answers from Day-1 to the base prompt
            enhancedPrompt = `${basePrompt}\n${wrongAnswersPrompt}\n\nTeach Python functions, modules, and error handling while addressing these areas of difficulty.`
          } else if (currentDay === 3) {
            // For Day-3, append wrong answers from Day-2 to the base prompt
            enhancedPrompt = `${basePrompt}\n${wrongAnswersPrompt}\n\nTeach Python file I/O, object-oriented programming, and key libraries while addressing these areas of difficulty.`
          }
          
          console.log(`Enhanced prompt for Day-${currentDay} with wrong answers from Day-${previousDay}:`, enhancedPrompt)
          return enhancedPrompt
        } else {
          console.log(`No wrong answers found for Day-${previousDay}`)
          // If no wrong answers, just use the base prompt
          return basePrompt
        }
      } else {
        console.error("Error fetching wrong answers:", await wrongAnswersResponse.text())
        // If error, just use the base prompt
        return basePrompt
      }
    } catch (error) {
      console.error("Error processing wrong answers for prompt:", error)
      // If error, just use the base prompt
      return basePrompt
    }
  }

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
    
    // If quiz is passed, save the quiz result as an exam
    if (selectedContent && quiz) {
      const score = getScore()
      const percentage = Math.round((score / quiz.quiz.length) * 100)
      
      // Extract current day number from selected content
      const match = selectedContent.title.match(/Python Day-(\d+)/)
      if (match) {
        const currentDay = parseInt(match[1])
        const nextDay = currentDay + 1
        
        // Save the exam result if score is passing (e.g., 60% or higher)
        if (percentage >= 60) {
          saveExamResult(currentDay, selectedContent.title, percentage, score, quiz.quiz.length)
          
          // Unlock the next day if it's not already unlocked and it's a valid day (2 or 3)
          if (nextDay <= 3 && !unlockedDays.includes(nextDay)) {
            setUnlockedDays(prev => [...prev, nextDay])
            toast.success(`Python Day-${nextDay} has been unlocked!`)
          }
        }
      }
    }
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
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
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
          topic: selectedContent?.title || 'Python'
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
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
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
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
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
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Python Course</h1>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading course content...</p>
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
      ) : (
        <div className="grid gap-6">
          {!selectedContent ? (
            <>
              <h2 className="text-2xl font-semibold text-foreground">Your Learning Contents</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((day) => {
                  // Find content for this day if it exists
                  const dayContent = contents.find(content => 
                    content.title === `Python Day-${day}`
                  )
                  
                  // Determine if this day is unlocked
                  const isUnlocked = unlockedDays.includes(day)
                  
                  return (
                    <Card 
                      key={day} 
                      className={`group transition-all duration-300 transform hover:-translate-y-1 overflow-hidden rounded-xl border-0 ${
                        isUnlocked ? 'hover:shadow-xl cursor-pointer' : 'opacity-70 cursor-not-allowed'
                      }`}
                      onClick={() => isUnlocked && handleDayClick(day)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/80 via-indigo-500/70 to-purple-600/80 opacity-90 z-0" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,theme(colors.purple.300/20%),transparent_70%)]" />
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-purple-500 z-10" />
                      
                      <div className="relative z-10">
                        <CardHeader className="pb-0">
                          <div className="mb-1 flex justify-between items-center">
                            <span className="px-2 py-1 rounded-md text-xs font-bold bg-white/20 text-white backdrop-blur-sm">
                              {day === 1 ? 'Beginner' : 
                               day === 2 ? 'Intermediate' : 'Advanced'}
                            </span>
                            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                              <span className="text-white text-xs font-bold">{day}</span>
                            </div>
                          </div>
                          <CardTitle className="text-lg font-bold text-white drop-shadow-sm">
                            Python Day-{day}
                            {!isUnlocked && <span className="ml-2 text-xs">🔒</span>}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3">
                          <p className="text-sm text-white/80 line-clamp-3 drop-shadow-sm">
                            {day === 1 ? "Variables, Data Types, Control Structures" : 
                             day === 2 ? "Functions, Modules, Error Handling" : 
                             "File I/O, Object-Oriented Programming, Key Libraries"}
                          </p>
                        </CardContent>
                        <CardFooter className="pt-3 pb-4">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className={`text-xs font-semibold bg-white/20 text-white transition-colors backdrop-blur-sm w-full ${
                              isUnlocked ? 'hover:bg-white/30' : ''
                            }`}
                            disabled={!isUnlocked || generatingContent}
                          >
                            {generatingContent && dayContent === undefined && day !== 1 ? (
                              <div className="flex items-center">
                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
                                <span>Generating Content...</span>
                              </div>
                            ) : (
                              <>Start Learning →</>
                            )}
                          </Button>
                        </CardFooter>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </>
          ) : (
            <div>
              <button 
                onClick={() => setSelectedContent(null)}
                className="mb-4 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
              >
                ← Back to Course List
              </button>
              
              <div className="mb-6 flex justify-end gap-3">
                <Button 
                  onClick={() => startQuiz()}
                  disabled={quizLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {quizLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
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
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                      <span className="ml-2">Generating Questions...</span>
                    </>
                  ) : (
                    'Take Short Answer Quiz'
                  )}
                </Button>
              </div>
              
              <ContentView content={selectedContent} />
            </div>
          )}
        </div>
      )}
      
      {showConfetti && windowSize.width > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={200}
        />
      )}
    </div>
  )
}
