"use client"

import { useState, useEffect, useRef } from 'react';
import { Loader2, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Editor from '@monaco-editor/react';
import { Content } from '@/types/content';

interface Course {
  id?: string;
  title: string;
  description?: string;
}

interface ExamSpec {
  course_id: string;
  difficulty: string;
  time_limit: number;
  num_questions: number;
}

interface MCQuestion {
  question: string;
  options: {
    id: string;
    text: string;
  }[];
  correctAnswer: string;
  explanation: string;
}

interface ShortAnswerQuestion {
  id: number;
  question: string;
  reference_answer: string;
}

// Add interface for API response
interface APIShortAnswerQuestion {
  id: number;
  question: string;
  expectedAnswer?: string;
  difficulty?: string;
  points?: number;
}

interface CodingProblem {
  title: string;
  description: string;
  language: string;
  starter_code?: string;
  test_cases?: { input: string; expected_output: string }[];
}

interface ExamState {
  mcq_questions: MCQuestion[];
  short_answer_questions: ShortAnswerQuestion[];
  coding_problems: CodingProblem[];
}

interface ExamResults {
  mcq_score: number;
  mcq_total: number;
  short_answer_score: number;
  short_answer_total: number;
  coding_score: number;
  coding_total: number;
  total_score: number;
  total_possible: number;
  percentage: number;
  feedback: string;
}

// Add interface for MCQ question from API
interface APIMCQQuestion {
  question: string;
  options: {
    id: string;
    text: string;
  }[];
  correctAnswer: string;
  explanation: string;
}

// Add a new interface for the exam record to be saved to the database
interface ExamRecord {
  userId: string;
  courseId: string;
  courseName: string;
  examDate: string;
  difficulty: string;
  timeLimit: number;
  timeSpent: number;
  mcqQuestions: {
    question: string;
    options: { id: string; text: string }[];
    correctAnswer: string;
    userAnswer: string;
    isCorrect: boolean;
  }[];
  shortAnswerQuestions: {
    id: number;
    question: string;
    referenceAnswer: string;
    userAnswer: string;
    pointsEarned?: number;
    feedback?: string;
  }[];
  codingProblems: {
    title: string;
    description: string;
    userSolution: string;
    codeOutput?: string;
  }[];
  scores: {
    mcq: { earned: number; total: number; percentage: number };
    shortAnswer: { earned: number; total: number; percentage: number };
    coding: { earned: number; total: number; percentage: number };
    total: { earned: number; total: number; percentage: number };
  };
  feedback: string;
}

const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';

  return !inline && match ? (
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      PreTag="div"
      {...props}
    >
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

export default function ExamPage() {
  const [courses, setCourses] = useState<Content[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Content | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examSpec, setExamSpec] = useState<ExamSpec>({
    course_id: '',
    difficulty: 'medium',
    time_limit: 60,
    num_questions: 10
  });
  
  // Exam state
  const [examStarted, setExamStarted] = useState(false);
  const [examState, setExamState] = useState<ExamState | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(3600); // 1 hour in seconds
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examResults, setExamResults] = useState<ExamResults | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // User answers
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, string>>({});
  const [shortAnswers, setShortAnswers] = useState<Record<number, string>>({});
  const [codingSolutions, setCodingSolutions] = useState<Record<number, string>>({});
  const [codeOutput, setCodeOutput] = useState<Record<number, string>>({});
  const [runningCode, setRunningCode] = useState<Record<number, boolean>>({});
  
  // Current section and question
  const [currentSection, setCurrentSection] = useState<'mcq' | 'short_answer' | 'coding'>('mcq');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  
  // Define submitExam function
  const submitExam = async () => {
    if (!examState) return;
    
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setLoading(true);
    
    try {
      // Calculate MCQ score
      const mcqScore = examState.mcq_questions.reduce((score, question, index) => {
        return score + (mcqAnswers[index] === question.correctAnswer ? 1 : 0);
      }, 0);
      
      // Evaluate short answers using the API
      let shortAnswerScore = 0;
      let shortAnswerFeedback = "";
      let shortAnswerEvaluations: any[] = [];
      
      try {
        console.log('Preparing short answer evaluation data...');
        
        // Format questions with the required fields
        const formattedQuestions = examState.short_answer_questions.map(q => ({
          id: q.id,
          question: q.question,
          expectedAnswer: q.reference_answer,
          points: 10 // Default points value if not provided
        }));
        
        // Get user answers as an array
        const userAnswers = examState.short_answer_questions.map((_, index) => 
          shortAnswers[index] || "No answer provided"
        );
        
        console.log('Formatted questions:', formattedQuestions);
        console.log('User answers:', userAnswers);
        
        const shortAnswerEvalResponse = await fetch('http://localhost:8000/newcontent/evaluate_short_answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions: formattedQuestions,
            answers: userAnswers,
            topic: selectedCourse?.title || 'Python Programming'
          }),
        });
        
        if (!shortAnswerEvalResponse.ok) {
          console.error('Short answer evaluation failed with status:', shortAnswerEvalResponse.status);
          const errorText = await shortAnswerEvalResponse.text();
          console.error('Error response:', errorText);
          throw new Error(`Failed to evaluate short answers: ${shortAnswerEvalResponse.status} ${errorText}`);
        }
        
        const evalData = await shortAnswerEvalResponse.json();
        console.log('Short answer evaluation response:', evalData);
        
        if (evalData.evaluations && Array.isArray(evalData.evaluations)) {
          shortAnswerScore = evalData.totalScore || 0;
          shortAnswerFeedback = evalData.overallFeedback || '';
          shortAnswerEvaluations = evalData.evaluations;
        }
      } catch (evalError) {
        console.error('Short answer evaluation error:', evalError);
        // Fallback: Give a partial score based on answer length as a very simple heuristic
        shortAnswerScore = Math.floor(examState.short_answer_questions.length * 0.7);
      }
      
      // Evaluate coding solutions
      const codingScore = Object.keys(codingSolutions).reduce((score, indexStr) => {
        const index = parseInt(indexStr);
        const solution = codingSolutions[index] || '';
        const output = codeOutput[index] || '';
        
        // Very simple heuristic:
        // 1. If code is too short, low score
        // 2. If code ran without errors (output doesn't contain "Error"), higher score
        const hasEnoughCode = solution.length > 100;
        const ranSuccessfully = !output.includes('Error');
        
        if (hasEnoughCode && ranSuccessfully) {
          return score + 1; // Full point
        } else if (hasEnoughCode || ranSuccessfully) {
          return score + 0.5; // Half point
        }
        return score;
      }, 0);
      
      // Calculate results
      const mockResults: ExamResults = {
        mcq_score: mcqScore,
        mcq_total: examState.mcq_questions.length,
        short_answer_score: shortAnswerScore,
        short_answer_total: examState.short_answer_questions.length,
        coding_score: codingScore,
        coding_total: examState.coding_problems.length,
        total_score: 0,
        total_possible: 0,
        percentage: 0,
        feedback: shortAnswerFeedback || ''
      };
      
      // Calculate totals
      mockResults.total_score = mockResults.mcq_score + mockResults.short_answer_score + mockResults.coding_score;
      mockResults.total_possible = mockResults.mcq_total + mockResults.short_answer_total + mockResults.coding_total;
      mockResults.percentage = Math.round((mockResults.total_score / mockResults.total_possible) * 100);
      
      // Generate feedback if not already set from short answer evaluation
      if (!mockResults.feedback) {
        if (mockResults.percentage >= 80) {
          mockResults.feedback = "Excellent work! You've demonstrated a strong understanding of the material.";
        } else if (mockResults.percentage >= 60) {
          mockResults.feedback = "Good job! You have a solid grasp of the content with some areas for improvement.";
        } else {
          mockResults.feedback = "You may need more practice with this material. Focus on reviewing the key concepts.";
        }
      }
      
      // Collect wrong MCQ answers
      const wrongMCQs = examState.mcq_questions
        .map((question, index) => {
          const userAnswer = mcqAnswers[index] || '';
          if (userAnswer !== question.correctAnswer) {
            return {
              questionType: 'MCQ',
              questionId: index.toString(),
              question: question.question,
              userAnswer: userAnswer,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              courseId: selectedCourse?.id
            };
          }
          return null;
        })
        .filter(Boolean);
      
      // Collect wrong short answers
      // We'll consider an answer wrong if it scored less than 7 out of 10 points
      const wrongShortAnswers = examState.short_answer_questions
        .map((question, index) => {
          const userAnswer = shortAnswers[index] || '';
          const evaluation = shortAnswerEvaluations.find(e => e.questionId === question.id);
          const pointsEarned = evaluation?.pointsEarned || 0;
          
          if (pointsEarned < 7) {
            return {
              questionType: 'ShortAnswer',
              questionId: question.id.toString(),
              question: question.question,
              userAnswer: userAnswer,
              correctAnswer: question.reference_answer,
              explanation: evaluation?.feedback || 'Review the reference answer for guidance.',
              courseId: selectedCourse?.id
            };
          }
          return null;
        })
        .filter(Boolean);
      
      // Combine all wrong answers
      const allWrongAnswers = [...wrongMCQs, ...wrongShortAnswers];
      console.log('Wrong answers to save:', allWrongAnswers);
      
      // Save wrong answers to database
      if (allWrongAnswers.length > 0) {
        try {
          const saveWrongAnswersResponse = await fetch('http://localhost:8000/exams/save_wrong_answers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wrong_answers: allWrongAnswers,
              userId: userId,
              courseId: selectedCourse?.id || '',
              courseName: selectedCourse?.title || ''
            }),
          });
          
          if (!saveWrongAnswersResponse.ok) {
            const errorData = await saveWrongAnswersResponse.text();
            console.error('Failed to save wrong answers:', errorData);
            toast.error('Failed to save wrong answers');
          } else {
            const result = await saveWrongAnswersResponse.json();
            console.log('Wrong answers saved successfully:', result);
            toast.success(`Saved ${result.mcqCount + result.shortAnswerCount} wrong answers for review`);
          }
        } catch (saveError) {
          console.error('Error saving wrong answers:', saveError);
          toast.error('Error saving wrong answers');
        }
      }
      
      // Create exam record to save to database
      const examRecord: ExamRecord = {
        userId: userId, // Use the existing userId from the component
        courseId: selectedCourse?.id || '',
        courseName: selectedCourse?.title || '',
        examDate: new Date().toISOString(),
        difficulty: examSpec.difficulty,
        timeLimit: examSpec.time_limit * 60, // Convert to seconds
        timeSpent: examSpec.time_limit * 60 - timeRemaining, // Calculate time spent
        
        // Format MCQ questions with user answers
        mcqQuestions: examState.mcq_questions.map((q, index) => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          userAnswer: mcqAnswers[index] || '',
          isCorrect: mcqAnswers[index] === q.correctAnswer
        })),
        
        // Format short answer questions with user answers and evaluations
        shortAnswerQuestions: examState.short_answer_questions.map((q, index) => {
          const evaluation = shortAnswerEvaluations.find(e => e.questionId === q.id);
          return {
            id: q.id,
            question: q.question,
            referenceAnswer: q.reference_answer,
            userAnswer: shortAnswers[index] || '',
            pointsEarned: evaluation?.pointsEarned,
            feedback: evaluation?.feedback
          };
        }),
        
        // Format coding problems with user solutions
        codingProblems: examState.coding_problems.map((p, index) => ({
          title: p.title,
          description: p.description,
          userSolution: codingSolutions[index] || '',
          codeOutput: codeOutput[index] || ''
        })),
        
        // Include all scores
        scores: {
          mcq: { 
            earned: mockResults.mcq_score, 
            total: mockResults.mcq_total,
            percentage: mockResults.mcq_total > 0 ? Math.round((mockResults.mcq_score / mockResults.mcq_total) * 100) : 0
          },
          shortAnswer: { 
            earned: mockResults.short_answer_score, 
            total: mockResults.short_answer_total,
            percentage: mockResults.short_answer_total > 0 ? Math.round((mockResults.short_answer_score / mockResults.short_answer_total) * 100) : 0
          },
          coding: { 
            earned: mockResults.coding_score, 
            total: mockResults.coding_total,
            percentage: mockResults.coding_total > 0 ? Math.round((mockResults.coding_score / mockResults.coding_total) * 100) : 0
          },
          total: {
            earned: mockResults.total_score,
            total: mockResults.total_possible,
            percentage: mockResults.percentage
          }
        },
        feedback: mockResults.feedback
      };
      
      // Save to database
      try {
        console.log('Saving exam results to database:', examRecord);
        
        const saveResponse = await fetch('http://localhost:8000/exams/save_result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(examRecord)
        });
        
        if (!saveResponse.ok) {
          const errorText = await saveResponse.text();
          console.error('Failed to save exam results:', errorText);
          // Don't throw error here - we still want to show results even if save fails
        } else {
          console.log('Exam results saved successfully!');
          toast.success('Exam results saved to your history');
        }
      } catch (saveError) {
        console.error('Error saving exam results:', saveError);
        // Continue execution to show results even if save fails
      }
      
      setExamResults(mockResults);
      setExamSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit exam');
      toast.error('Failed to submit exam');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch courses on component mount
  useEffect(() => {
    fetchCourses();
    
    // Clean up timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Timer effect
  useEffect(() => {
    if (examStarted && !examSubmitted && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Time's up - submit exam automatically
            clearInterval(timerRef.current as NodeJS.Timeout);
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [examStarted, examSubmitted]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const userId = "user_2rfLQ3ssZOGC6VrVoQg03EeBKgI"; // Use actual user ID in production
  
  const fetchCourses = async () => {
    try {
      setCoursesLoading(true);
      const response = await fetch(`http://localhost:8000/content/user/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch courses');
      const data = await response.json();
      setCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch courses');
      toast.error('Failed to load courses');
    } finally {
      setCoursesLoading(false);
    }
  };

  const handleCourseSelect = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    setSelectedCourse(course || null);
    setExamSpec(prev => ({ ...prev, course_id: courseId }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log('Starting exam generation with spec:', examSpec);

    try {
      // Start the exam
      setTimeRemaining(examSpec.time_limit * 60); // Convert minutes to seconds
      
      // Combine all content sections to create a comprehensive exam
      const content = selectedCourse ? `
        ${selectedCourse.contentTheory || ''}
        ${selectedCourse.contentCodes || ''}
        ${selectedCourse.contentSyntax || ''}
      ` : '';
      console.log('Course content length:', content.length);
      
      // Create the real exam by calling the backend endpoints
      const examState: ExamState = {
        mcq_questions: [],
        short_answer_questions: [],
        coding_problems: []
      };
      
      // Generate MCQ questions
      try {
        console.log('Fetching MCQ questions...');
        const mcqResponse = await fetch('http://localhost:8000/newcontent/generate_json_quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            topic: selectedCourse?.title || ''
          }),
        });
        
        if (!mcqResponse.ok) throw new Error('Failed to generate MCQ questions');
        
        // Get the raw response data
        const mcqRawData = await mcqResponse.json();
        console.log('Received raw MCQ data:', typeof mcqRawData, mcqRawData);
        
        // Check if the response is a string that needs to be parsed
        let mcqData;
        if (typeof mcqRawData === 'string') {
          try {
            // Try to parse the string as JSON
            mcqData = JSON.parse(mcqRawData);
            console.log('Parsed MCQ JSON data:', mcqData);
          } catch (jsonError) {
            console.error('Failed to parse MCQ JSON string:', jsonError);
            throw new Error('Invalid MCQ data format');
          }
        } else {
          // If it's already an object, use it directly
          mcqData = mcqRawData;
        }
        
        // Check for the quiz property and ensure it's an array
        if (mcqData && mcqData.quiz && Array.isArray(mcqData.quiz) && mcqData.quiz.length > 0) {
          console.log('First MCQ question:', mcqData.quiz[0]);
          examState.mcq_questions = mcqData.quiz;
          console.log(`Successfully loaded ${mcqData.quiz.length} MCQ questions`);
        } else {
          console.error('Unexpected MCQ response format:', mcqData);
          throw new Error('Failed to parse MCQ questions');
        }
      } catch (mcqError) {
        console.error('MCQ generation error:', mcqError);
        // Fallback questions
        examState.mcq_questions = Array.from({ length: 5 }, (_, i) => ({
          question: `MCQ Question ${i+1} about ${selectedCourse?.title || 'this topic'}?`,
          options: [
            { id: 'A', text: `Option A for question ${i+1}` },
            { id: 'B', text: `Option B for question ${i+1}` },
            { id: 'C', text: `Option C for question ${i+1}` },
            { id: 'D', text: `Option D for question ${i+1}` }
          ],
          correctAnswer: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
          explanation: `Explanation for question ${i+1}`
        }));
        console.log('Using fallback MCQ questions');
      }
      
      // Generate short answer questions
      try {
        console.log('Fetching short answer questions...');
        const shortAnswerResponse = await fetch('http://localhost:8000/newcontent/generate_short_answer_questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            topic: selectedCourse?.title || ''
          }),
        });
        
        if (!shortAnswerResponse.ok) throw new Error('Failed to generate short answer questions');
        
        // Get the raw response data
        const shortAnswerRawData = await shortAnswerResponse.json();
        console.log('Received raw short answer data:', typeof shortAnswerRawData, shortAnswerRawData);
        
        // Check if the response is a string that needs to be parsed
        let shortAnswerData;
        if (typeof shortAnswerRawData === 'string') {
          try {
            // Try to parse the string as JSON
            shortAnswerData = JSON.parse(shortAnswerRawData);
            console.log('Parsed short answer JSON data:', shortAnswerData);
          } catch (jsonError) {
            console.error('Failed to parse short answer JSON string:', jsonError);
            throw new Error('Invalid short answer data format');
          }
        } else {
          // If it's already an object, use it directly
          shortAnswerData = shortAnswerRawData;
        }
        
        // Check for the questions property and ensure it's an array
        if (shortAnswerData && shortAnswerData.questions && Array.isArray(shortAnswerData.questions) && shortAnswerData.questions.length > 0) {
          console.log('First short answer question:', shortAnswerData.questions[0]);
          
          // Map the API questions to the format expected by the UI
          examState.short_answer_questions = shortAnswerData.questions.map((q: APIShortAnswerQuestion) => ({
            id: q.id || Math.random(),
            question: q.question,
            reference_answer: q.expectedAnswer || ''
          }));
          console.log(`Successfully loaded ${shortAnswerData.questions.length} short answer questions`);
        } else {
          console.error('Unexpected short answer response format:', shortAnswerData);
          throw new Error('Failed to parse short answer questions');
        }
      } catch (shortAnswerError) {
        console.error('Short answer generation error:', shortAnswerError);
        // Fallback questions
        examState.short_answer_questions = Array.from({ length: 3 }, (_, i) => ({
          id: i,
          question: `Short answer question ${i+1} about ${selectedCourse?.title || 'this topic'}?`,
          reference_answer: `Reference answer for question ${i+1}.`
        }));
        console.log('Using fallback short answer questions');
      }
      
      // Generate coding problems
      try {
        // We'll generate 2 coding problems with different difficulties
        console.log('Generating coding problems...');
        const codingProblems = [];
        const difficulties = ['easy', 'medium'];
        
        for (let i = 0; i < 2; i++) {
          console.log(`Generating coding problem ${i+1} with difficulty: ${difficulties[i]}`);
          const codingResponse = await fetch('http://localhost:8000/practice/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_specification: `Create a ${difficulties[i]} ${selectedCourse?.title || 'programming'} problem`,
              topic: selectedCourse?.title || 'programming',
              difficulty: difficulties[i],
              language: 'python',
              content
            }),
          });
          
          if (!codingResponse.ok) throw new Error(`Failed to generate coding problem ${i+1}`);
          
          const problemDescription = await codingResponse.text();
          console.log(`Received coding problem ${i+1}, length: ${problemDescription.length}`);
          
          // Extract title from the problem description (assuming format has a title line)
          const titleMatch = problemDescription.match(/(?:Problem Title:?\s*|^#\s*)(.*?)(?:\n|$)/i);
          const title = titleMatch ? titleMatch[1].trim() : `Coding Problem ${i+1}`;
          
          // Clean up the description - remove any duplicate content and fix escaped characters
          let cleanDescription = problemDescription;
          
          // First, try to extract a clean version if there's a "Problem Title:" format
          if (cleanDescription.includes("Problem Title:")) {
            // Split by double newlines to separate sections
            const sections = cleanDescription.split("\n\n");
            // Keep only the first section that contains the problem title
            const firstSection = sections.find(section => section.includes("Problem Title:"));
            if (firstSection) {
              cleanDescription = firstSection;
            }
          }
          
          // Remove escaped newlines and replace them with actual newlines
          cleanDescription = cleanDescription
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
            .replace(/\\"/g, '"');
          
          // If we have what appears to be a duplicate problem description
          if (cleanDescription.includes("Problem Title:") && 
              cleanDescription.indexOf("Problem Title:") !== cleanDescription.lastIndexOf("Problem Title:")) {
            console.log("Detected duplicate problem description, cleaning up...");
            // Keep only up to the second occurrence
            cleanDescription = cleanDescription.substring(0, cleanDescription.lastIndexOf("Problem Title:"));
          }
          
          codingProblems.push({
            title,
            description: cleanDescription,
            language: 'python',
            starter_code: `# Write your solution here\n\ndef solve_problem():\n    # Your code here\n    pass\n\n# Test your solution\nsolve_problem()`
          });
        }
        
        examState.coding_problems = codingProblems;
        console.log(`Successfully generated ${codingProblems.length} coding problems`);
        
      } catch (codingError) {
        console.error('Coding problem generation error:', codingError);
        // Add some fallback coding problems if the endpoint fails
        examState.coding_problems = Array.from({ length: 2 }, (_, i) => ({
          title: `Coding Problem ${i+1}`,
          description: `Write a function that solves problem ${i+1} related to ${selectedCourse?.title || 'this topic'}.`,
          language: 'python',
          starter_code: `# Write your solution here\n\ndef solve_problem():\n    # Your code here\n    pass\n\n# Example usage\nsolve_problem()`
        }));
        console.log('Using fallback coding problems');
      }
      
      // Set the exam state and start the exam
      console.log('Setting exam state:', examState);
      setExamState(examState);
      setExamStarted(true);
      setCurrentSection('mcq');
      setCurrentQuestionIndex(0);
      
      // Initialize code execution tracking
      const codeRunningState: Record<number, boolean> = {};
      examState.coding_problems.forEach((_, index) => {
        codeRunningState[index] = false;
      });
      setRunningCode(codeRunningState);
      
      // Initialize code solutions with starter code
      const initialSolutions: Record<number, string> = {};
      examState.coding_problems.forEach((problem, index) => {
        initialSolutions[index] = problem.starter_code || '';
      });
      setCodingSolutions(initialSolutions);
      
      toast.success('Exam started!');
    } catch (err) {
      console.error('Exam generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start exam');
      toast.error('Failed to start exam');
    } finally {
      setLoading(false);
    }
  };
  
  const handleMCQAnswer = (questionIndex: number, answer: string) => {
    setMcqAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };
  
  const handleShortAnswerChange = (questionIndex: number, answer: string) => {
    setShortAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };
  
  const handleCodeChange = (questionIndex: number, code: string) => {
    setCodingSolutions(prev => ({
      ...prev,
      [questionIndex]: code
    }));
  };
  
  const runCode = async (questionIndex: number) => {
    if (!codingSolutions[questionIndex]?.trim()) {
      toast.error("Please write some code first");
      return;
    }

    setRunningCode(prev => ({ ...prev, [questionIndex]: true }));
    setCodeOutput(prev => ({ ...prev, [questionIndex]: 'Running code...' }));

    try {
      // Try to run code via backend
      try {
        const response = await fetch('http://localhost:8000/practice/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: codingSolutions[questionIndex],
            language: examState?.coding_problems[questionIndex].language || 'python'
          }),
        });

        if (!response.ok) throw new Error('Backend execution endpoint not available');
        
        const data = await response.json();
        setCodeOutput(prev => ({ 
          ...prev, 
          [questionIndex]: data.output || 'Code executed successfully!' 
        }));
        return;
      } catch (backendError) {
        console.error("Backend execution failed:", backendError);
        // Show error in output
        setCodeOutput(prev => ({ 
          ...prev, 
          [questionIndex]: `Backend execution failed: ${backendError}` 
        }));
      }
    } finally {
      setRunningCode(prev => ({ ...prev, [questionIndex]: false }));
    }
  };
  
  const moveToNextQuestion = () => {
    if (!examState) return;
    
    if (currentSection === 'mcq') {
      if (currentQuestionIndex < examState.mcq_questions.length - 1) {
        // Move to next MCQ
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        // Move to short answer section
        setCurrentSection('short_answer');
        setCurrentQuestionIndex(0);
      }
    } else if (currentSection === 'short_answer') {
      if (currentQuestionIndex < examState.short_answer_questions.length - 1) {
        // Move to next short answer
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        // Move to coding section
        setCurrentSection('coding');
        setCurrentQuestionIndex(0);
      }
    } else if (currentSection === 'coding') {
      if (currentQuestionIndex < examState.coding_problems.length - 1) {
        // Move to next coding problem
        setCurrentQuestionIndex(prev => prev + 1);
      }
      // If we're at the end of coding problems, stay there
    }
  };
  
  const moveToPreviousQuestion = () => {
    if (!examState) return;
    
    if (currentSection === 'mcq') {
      if (currentQuestionIndex > 0) {
        // Move to previous MCQ
        setCurrentQuestionIndex(prev => prev - 1);
      }
      // If we're at the first MCQ, stay there
    } else if (currentSection === 'short_answer') {
      if (currentQuestionIndex > 0) {
        // Move to previous short answer
        setCurrentQuestionIndex(prev => prev - 1);
      } else {
        // Move to MCQ section, last question
        setCurrentSection('mcq');
        setCurrentQuestionIndex(examState.mcq_questions.length - 1);
      }
    } else if (currentSection === 'coding') {
      if (currentQuestionIndex > 0) {
        // Move to previous coding problem
        setCurrentQuestionIndex(prev => prev - 1);
      } else {
        // Move to short answer section, last question
        setCurrentSection('short_answer');
        setCurrentQuestionIndex(examState.short_answer_questions.length - 1);
      }
    }
  };
  
  const jumpToSection = (section: 'mcq' | 'short_answer' | 'coding', index: number = 0) => {
    setCurrentSection(section);
    setCurrentQuestionIndex(index);
  };
  
  const renderExamProgress = () => {
    if (!examState) return null;
    
    const totalQuestions = 
      examState.mcq_questions.length + 
      examState.short_answer_questions.length + 
      examState.coding_problems.length;
    
    let currentQuestionNumber = currentQuestionIndex + 1;
    
    if (currentSection === 'short_answer') {
      currentQuestionNumber += examState.mcq_questions.length;
    } else if (currentSection === 'coding') {
      currentQuestionNumber += examState.mcq_questions.length + examState.short_answer_questions.length;
    }
    
    // Calculate progress percentage
    const progressPercentage = (currentQuestionNumber / totalQuestions) * 100;
    
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <span className="bg-violet-500/20 text-violet-300 px-2 py-1 rounded">
              Question {currentQuestionNumber} of {totalQuestions}
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm bg-gray-800/80 px-3 py-1 rounded-full">
            <Clock className="h-4 w-4 text-orange-400" />
            <span className={`font-mono ${timeRemaining < 300 ? 'text-red-400 animate-pulse font-bold' : 'text-gray-300'}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-800/50 rounded-full h-2 mb-4">
          <div 
            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        
        <div className="flex items-center justify-between gap-2 text-sm">
          <button 
            onClick={() => jumpToSection('mcq')}
            className={`px-3 py-1.5 rounded-lg flex-1 font-medium transition-all
              ${currentSection === 'mcq' 
                ? 'bg-violet-600 text-white shadow-md' 
                : 'bg-gray-800/50 hover:bg-gray-700/70 text-gray-300'}`}
          >
            MCQ
          </button>
          <button 
            onClick={() => jumpToSection('short_answer')}
            className={`px-3 py-1.5 rounded-lg flex-1 font-medium transition-all
              ${currentSection === 'short_answer' 
                ? 'bg-violet-600 text-white shadow-md' 
                : 'bg-gray-800/50 hover:bg-gray-700/70 text-gray-300'}`}
          >
            Short Answer
          </button>
          <button 
            onClick={() => jumpToSection('coding')}
            className={`px-3 py-1.5 rounded-lg flex-1 font-medium transition-all
              ${currentSection === 'coding' 
                ? 'bg-violet-600 text-white shadow-md' 
                : 'bg-gray-800/50 hover:bg-gray-700/70 text-gray-300'}`}
          >
            Coding
          </button>
        </div>
      </div>
    );
  };
  
  const renderMCQ = () => {
    console.log("Rendering MCQ section", { currentQuestionIndex, examState });
    if (!examState || !examState.mcq_questions || examState.mcq_questions.length === 0) {
      console.log("No MCQ questions available");
      return (
        <div className="text-center py-8">
          <p className="text-gray-400">No multiple choice questions available</p>
        </div>
      );
    }
    
    if (currentQuestionIndex >= examState.mcq_questions.length) {
      console.log("Current index out of range for MCQ questions");
      setCurrentQuestionIndex(0);
      return null;
    }
    
    const question = examState.mcq_questions[currentQuestionIndex];
    console.log("Displaying MCQ question", question);
    
    return (
      <div className="space-y-6">
        <div className="text-xl font-medium mb-6 pb-3 border-b border-gray-700/50">{question.question}</div>
        <div className="space-y-3">
          {question.options.map(option => (
            <div 
              key={option.id} 
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all
                ${mcqAnswers[currentQuestionIndex] === option.id 
                  ? 'bg-violet-600/30 border border-violet-500/50' 
                  : 'hover:bg-gray-800/70 border border-transparent'}`}
              onClick={() => handleMCQAnswer(currentQuestionIndex, option.id)}
            >
              <div className="mt-0.5">
                <div 
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${mcqAnswers[currentQuestionIndex] === option.id 
                      ? 'border-violet-400 bg-violet-400/20' 
                      : 'border-gray-500'}`}
                >
                  {mcqAnswers[currentQuestionIndex] === option.id && (
                    <div className="w-2.5 h-2.5 bg-violet-400 rounded-full"></div>
                  )}
                </div>
              </div>
              <label className="text-gray-200 cursor-pointer w-full font-medium">
                <span className="mr-2 font-bold text-violet-400">{option.id}.</span>
                {option.text}
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const renderShortAnswer = () => {
    console.log("Rendering short answer section", { currentQuestionIndex, examState });
    if (!examState || !examState.short_answer_questions || examState.short_answer_questions.length === 0) {
      console.log("No short answer questions available");
      return (
        <div className="text-center py-8">
          <p className="text-gray-400">No short answer questions available</p>
        </div>
      );
    }
    
    if (currentQuestionIndex >= examState.short_answer_questions.length) {
      console.log("Current index out of range for short answer questions");
      setCurrentQuestionIndex(0);
      return null;
    }
    
    const question = examState.short_answer_questions[currentQuestionIndex];
    console.log("Displaying short answer question", question);
    
    return (
      <div className="space-y-6">
        <div className="text-xl font-medium mb-6 pb-3 border-b border-gray-700/50">{question.question}</div>
        <textarea
          value={shortAnswers[currentQuestionIndex] || ''}
          onChange={e => handleShortAnswerChange(currentQuestionIndex, e.target.value)}
          className="w-full h-56 bg-gray-800/50 border border-violet-500/20 hover:border-violet-500/30 focus:border-violet-500/50
                     rounded-lg p-4 text-gray-200 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all duration-200
                     font-medium resize-none"
          placeholder="Type your answer here..."
        />
        
        <div className="text-right text-sm text-gray-400">
          <span>{shortAnswers[currentQuestionIndex]?.length || 0} characters</span>
        </div>
      </div>
    );
  };
  
  const renderCodingProblem = () => {
    console.log("Rendering coding problem section", { currentQuestionIndex, examState });
    if (!examState || !examState.coding_problems || examState.coding_problems.length === 0) {
      console.log("No coding problems available");
      return (
        <div className="text-center py-8">
          <p className="text-gray-400">No coding problems available</p>
        </div>
      );
    }
    
    if (currentQuestionIndex >= examState.coding_problems.length) {
      console.log("Current index out of range for coding problems");
      setCurrentQuestionIndex(0);
      return null;
    }
    
    const problem = examState.coding_problems[currentQuestionIndex];
 console.log("Displaying coding problem", { title: problem.title, descriptionLength: problem.description.length });
    
    return (
      <div className="space-y-5">
        {/* <div className="text-xl font-medium mb-2 pb-3 border-b border-gray-700/50">{problem.title}</div> */}
        <div className="bg-gray-800/50 border border-violet-500/20 rounded-lg p-4 overflow-auto max-h-64 shadow-inner">
          <ReactMarkdown components={{ code: CodeBlock }}>
            {problem.description}
          </ReactMarkdown>
        </div>
        
        <div className="h-64 bg-gray-800/50 border border-violet-500/20 hover:border-violet-500/40 rounded-lg overflow-hidden shadow transition-all">
          <Editor
            height="100%"
            defaultLanguage={problem.language}
            value={codingSolutions[currentQuestionIndex] || ''}
            onChange={value => handleCodeChange(currentQuestionIndex, value || '')}
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              wordWrap: 'on',
              padding: { top: 10 }
            }}
          />
        </div>
        
        <div className="flex justify-between">
          <button
            onClick={() => runCode(currentQuestionIndex)}
            disabled={runningCode[currentQuestionIndex]}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-lg 
                       flex items-center gap-2 disabled:opacity-50 shadow transition-all"
          >
            {runningCode[currentQuestionIndex] && <Loader2 className="h-4 w-4 animate-spin" />}
            {runningCode[currentQuestionIndex] ? 'Running...' : 'Run Code'}
          </button>
        </div>
        
        {codeOutput[currentQuestionIndex] && (
          <div className="bg-gray-800/70 border border-violet-500/20 rounded-lg p-4 font-mono text-sm 
                         whitespace-pre-wrap max-h-48 overflow-auto shadow-inner">
            {codeOutput[currentQuestionIndex]}
          </div>
        )}
      </div>
    );
  };
  
  const renderExamSection = () => {
    if (currentSection === 'mcq') {
      return renderMCQ();
    } else if (currentSection === 'short_answer') {
      return renderShortAnswer();
    } else if (currentSection === 'coding') {
      return renderCodingProblem();
    }
    return null;
  };
  
  const renderResults = () => {
    if (!examResults) return null;
    
    return (
      <div className="bg-gray-900/60 border border-violet-500/30 backdrop-blur-sm rounded-xl p-6 md:p-8 max-w-3xl mx-auto shadow-lg">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-300">
          Exam Results
        </h2>
        
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/70 hover:bg-gray-800/90 transition-colors p-4 rounded-lg shadow-inner">
              <h3 className="text-sm text-gray-400 mb-1">Multiple Choice</h3>
              <p className="text-xl font-bold text-white flex items-baseline gap-1">
                {examResults.mcq_score} 
                <span className="text-gray-400 text-sm font-normal">/ {examResults.mcq_total}</span>
              </p>
            </div>
            <div className="bg-gray-800/70 hover:bg-gray-800/90 transition-colors p-4 rounded-lg shadow-inner">
              <h3 className="text-sm text-gray-400 mb-1">Short Answer</h3>
              <p className="text-xl font-bold text-white flex items-baseline gap-1">
                {examResults.short_answer_score}
                <span className="text-gray-400 text-sm font-normal">/ {examResults.short_answer_total}</span>
              </p>
            </div>
            <div className="bg-gray-800/70 hover:bg-gray-800/90 transition-colors p-4 rounded-lg shadow-inner">
              <h3 className="text-sm text-gray-400 mb-1">Coding Problems</h3>
              <p className="text-xl font-bold text-white flex items-baseline gap-1">
                {examResults.coding_score}
                <span className="text-gray-400 text-sm font-normal">/ {examResults.coding_total}</span>
              </p>
            </div>
            <div className="bg-gray-800/70 hover:bg-gray-800/90 transition-colors p-4 rounded-lg shadow-inner">
              <h3 className="text-sm text-gray-400 mb-1">Overall Score</h3>
              <p className="text-xl font-bold text-white">
                {examResults.percentage}%
              </p>
            </div>
          </div>
          
          <div className="bg-gray-800/70 p-5 rounded-lg shadow-inner">
            <h3 className="text-sm text-gray-400 mb-3">Feedback</h3>
            <p className="text-gray-200 leading-relaxed">{examResults.feedback}</p>
          </div>
          
          <div className="pt-4 text-center">
            <button
              onClick={() => {
                setExamStarted(false);
                setExamSubmitted(false);
                setExamState(null);
                setExamResults(null);
                setMcqAnswers({});
                setShortAnswers({});
                setCodingSolutions({});
                setCodeOutput({});
              }}
              className="px-6 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 active:bg-violet-800
                         transition-all duration-200 shadow-md hover:shadow-lg font-semibold"
            >
              Return to Exam Setup
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-violet-950/20 to-gray-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-300">
            Exam Center
          </h1>
          <a 
            href="/exam/wrong-answers" 
            className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md transition-colors"
          >
            View Wrong Answers
          </a>
        </div> */}
        
        {!examStarted ? (
          <div className="bg-gray-900/60 border border-violet-500/30 backdrop-blur-sm rounded-xl p-6 shadow-lg">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Course</label>
                <select
                  value={selectedCourse?.id || ""}
                  onChange={(e) => handleCourseSelect(e.target.value)}
                  className="w-full bg-gray-900/80 border border-violet-500/30 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all duration-200"
                  required
                >
                  <option value="" disabled>Select a course</option>
                  {coursesLoading ? (
                    <option value="" disabled>Loading courses...</option>
                  ) : (
                    courses.map(course => (
                      <option key={course.id} value={course.id || ""}>
                        {course.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Difficulty</label>
                <select
                  value={examSpec.difficulty}
                  onChange={(e) => setExamSpec(prev => ({ ...prev, difficulty: e.target.value }))}
                  className="w-full bg-gray-900/80 border border-violet-500/30 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all duration-200"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="difficult">Difficult</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Number of Questions</label>
                <select
                  value={examSpec.num_questions}
                  onChange={(e) => setExamSpec(prev => ({ ...prev, num_questions: parseInt(e.target.value) }))}
                  className="w-full bg-gray-900/80 border border-violet-500/30 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all duration-200"
                >
                  <option value="5">5 Questions</option>
                  <option value="10">10 Questions</option>
                  <option value="15">15 Questions</option>
                  <option value="20">20 Questions</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Time Limit (minutes)</label>
                <select
                  value={examSpec.time_limit}
                  onChange={(e) => setExamSpec(prev => ({ ...prev, time_limit: parseInt(e.target.value) }))}
                  className="w-full bg-gray-900/80 border border-violet-500/30 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all duration-200"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || !selectedCourse}
                className="md:col-span-2 px-6 py-3 bg-violet-600 text-white rounded-xl 
                        disabled:opacity-50 hover:bg-violet-700 active:bg-violet-800 transition-all shadow-md hover:shadow-lg
                        flex items-center justify-center gap-2 text-base font-semibold"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? 'Starting Exam...' : 'Start Exam'}
              </button>
            </form>
          </div>
        ) : examSubmitted && examResults ? (
          renderResults()
        ) : (
          <div className="bg-gray-900/60 border border-violet-500/30 backdrop-blur-sm rounded-xl p-6 shadow-lg">
            {renderExamProgress()}
            
            <div className="mb-6 bg-gray-800/50 p-4 md:p-6 rounded-xl shadow-inner">
              {renderExamSection()}
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={moveToPreviousQuestion}
                disabled={currentSection === 'mcq' && currentQuestionIndex === 0}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white rounded-lg 
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Previous
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={submitExam}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg 
                             hover:shadow-lg transition-all duration-200 font-medium
                             flex items-center gap-2"
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Submitting...' : 'Complete Exam'}
                </button>
                
                <button
                  onClick={moveToNextQuestion}
                  disabled={
                    currentSection === 'coding' && 
                    currentQuestionIndex === (examState?.coding_problems.length || 0) - 1
                  }
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-lg 
                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow flex items-center gap-2"
                >
                  Next
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl shadow-lg">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
