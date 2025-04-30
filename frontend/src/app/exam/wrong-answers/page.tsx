"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface WrongAnswer {
  id: string;
  title: string;
  questionType: string;
  questionId: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string | null;
  courseId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
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

export default function WrongAnswersPage() {
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = "user_2rfLQ3ssZOGC6VrVoQg03EeBKgI"; // Use actual user ID in production

  useEffect(() => {
    const fetchWrongAnswers = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:8000/exams/wrong_answers/${userId}`);
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error('Failed to fetch wrong answers:', errorData);
          throw new Error(`Failed to fetch wrong answers: ${response.status} ${errorData}`);
        }
        
        const data = await response.json();
        console.log('Fetched wrong answers:', data);
        
        // Check if data is empty or not an array
        if (!data || !Array.isArray(data)) {
          console.warn('Received empty or invalid data from API');
          setWrongAnswers([]);
        } else {
          setWrongAnswers(data);
        }
      } catch (err) {
        console.error('Error fetching wrong answers:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch wrong answers');
        toast.error('Failed to load wrong answers');
      } finally {
        setLoading(false);
      }
    };

    fetchWrongAnswers();
  }, [userId]);

  const mcqQuestions = wrongAnswers.filter(answer => answer.questionType === 'MCQ');
  const shortAnswerQuestions = wrongAnswers.filter(answer => answer.questionType === 'ShortAnswer');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-950 via-violet-950/20 to-gray-950 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        <p className="mt-4 text-gray-400">Loading your wrong answers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-950 via-violet-950/20 to-gray-950 p-4">
        <h1 className="text-2xl font-bold text-red-400">Error</h1>
        <p className="mt-2 text-gray-400">{error}</p>
      </div>
    );
  }

  if (wrongAnswers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-950 via-violet-950/20 to-gray-950 p-4">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-300">No Wrong Answers</h1>
        <p className="mt-2 text-gray-400">You haven't answered any questions incorrectly yet.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-violet-950/20 to-gray-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-300">
            Your Wrong Answers
          </h1>
          <a 
            href="/exam" 
            className="px-4 py-2 bg-gray-800 text-gray-200 hover:bg-gray-700 rounded-md transition-colors"
          >
            Back to Exams
          </a>
        </div>
      
        <div className="bg-gray-900/60 border border-violet-500/30 backdrop-blur-sm rounded-xl p-6 shadow-lg">
          <Tabs defaultValue="mcq" className="w-full">
            <TabsList className="mb-6 bg-gray-800/70 p-1">
              <TabsTrigger value="mcq" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                Multiple Choice ({mcqQuestions.length})
              </TabsTrigger>
              <TabsTrigger value="shortAnswer" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                Short Answer ({shortAnswerQuestions.length})
              </TabsTrigger>
            </TabsList>
          
            <TabsContent value="mcq">
              <div className="grid gap-6">
                {mcqQuestions.map((answer) => (
                  <Card key={answer.id} className="bg-gray-800/50 border border-violet-500/20 overflow-hidden">
                    <CardHeader className="bg-gray-800/80">
                      <CardTitle className="text-xl text-gray-200">
                        <ReactMarkdown>{answer.question}</ReactMarkdown>
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Taken on {new Date(answer.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 text-gray-300">
                      <div className="mb-4">
                        <p className="font-semibold text-red-400 mb-1">Your Answer:</p>
                        <p>{answer.userAnswer}</p>
                      </div>
                      <div className="mb-4">
                        <p className="font-semibold text-green-400 mb-1">Correct Answer:</p>
                        <p>{answer.correctAnswer}</p>
                      </div>
                      {answer.explanation && (
                        <div className="mt-4 p-4 bg-gray-800/70 rounded-md">
                          <p className="font-semibold text-violet-400 mb-2">Explanation:</p>
                          <ReactMarkdown components={{ code: CodeBlock }}>
                            {answer.explanation}
                          </ReactMarkdown>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          
            <TabsContent value="shortAnswer">
              <div className="grid gap-6">
                {shortAnswerQuestions.map((answer) => (
                  <Card key={answer.id} className="bg-gray-800/50 border border-violet-500/20 overflow-hidden">
                    <CardHeader className="bg-gray-800/80">
                      <CardTitle className="text-xl text-gray-200">
                        <ReactMarkdown>{answer.question}</ReactMarkdown>
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Taken on {new Date(answer.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 text-gray-300">
                      <div className="mb-4">
                        <p className="font-semibold text-red-400 mb-1">Your Answer:</p>
                        <ReactMarkdown components={{ code: CodeBlock }}>
                          {answer.userAnswer}
                        </ReactMarkdown>
                      </div>
                      <div className="mb-4">
                        <p className="font-semibold text-green-400 mb-1">Reference Answer:</p>
                        <ReactMarkdown components={{ code: CodeBlock }}>
                          {answer.correctAnswer}
                        </ReactMarkdown>
                      </div>
                      {answer.explanation && (
                        <div className="mt-4 p-4 bg-gray-800/70 rounded-md">
                          <p className="font-semibold text-violet-400 mb-2">Feedback:</p>
                          <ReactMarkdown components={{ code: CodeBlock }}>
                            {answer.explanation}
                          </ReactMarkdown>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
} 