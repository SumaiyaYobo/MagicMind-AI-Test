"use client"
import Navbar from "./navbar";
import { User } from "@/types/user";
import Sidebar from "./sidebar";
import { Content } from "@/types/content";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";

import { 
  BookOpen, 
  Code2, 
  Users, 
  FolderGit2,
  GraduationCap,
  Timer,
  GitBranch,
  TrendingUp,
  Award,
  Clock,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface DashboardProps {
  userData: User;
}

interface CourseProgress {
  category: string;
  percentage: number;
  color: string;
}

interface ExamSummary {
  courseId: string;
  courseName: string;
  percentage: number;
  date: string;
}

const Dashboard = ({ userData }: DashboardProps) => {
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [examResults, setExamResults] = useState<ExamSummary[]>([]);
  const [activityData, setActivityData] = useState<number[]>([20, 45, 30, 80, 65, 15, 40]);

  useEffect(() => {
    if (userData.id) {
      fetchContents();
      fetchExamResults();
    }
  }, [userData.id]);
  
  const fetchContents = async () => {
    try {
      const response = await fetch(`http://localhost:8000/content/user/${userData.id}`);
      const data = await response.json();
      console.log(data);
      // Filter OUT Python course content (Day-1, Day-2, Day-3)
      const nonPythonContent = data.filter((content: Content) => 
        !content.title.includes('Python Day')
      );
      setContents(nonPythonContent);
      setLoading(false);
    } catch (error) {
      toast.error("Failed to fetch courses");
      setLoading(false);
    }
  };
  
  const fetchExamResults = async () => {
    try {
      const response = await fetch(`http://localhost:8000/exams/user/${userData.id}`);
      if (response.ok) {
        const data = await response.json();
        setExamResults(data.map((result: any) => ({
          courseId: result.courseId,
          courseName: result.courseName,
          percentage: result.percentage,
          date: result.examDate
        })));
      }
    } catch (error) {
      console.error("Failed to fetch exam results:", error);
    }
  };
  
  // Calculate course progress metrics by category
  const courseProgress = useMemo<CourseProgress[]>(() => {
    const categories: { [key: string]: { total: number; completed: number } } = {};
    
    // Initialize with defaults in case we don't have data
    if (!contents.length) {
      return [
        { category: "Frontend Development", percentage: 68, color: "bg-indigo-600" },
        { category: "Backend Development", percentage: 45, color: "bg-emerald-600" },
        { category: "Database Design", percentage: 20, color: "bg-amber-600" }
      ];
    }
    
    // Count courses per category
    contents.forEach(course => {
      // Extract category from title
      let category = "Other";
      if (course.title.toLowerCase().includes("javascript") || 
          course.title.toLowerCase().includes("react") || 
          course.title.toLowerCase().includes("css") ||
          course.title.toLowerCase().includes("html")) {
        category = "Frontend Development";
      } else if (course.title.toLowerCase().includes("node") || 
                course.title.toLowerCase().includes("express") ||
                course.title.toLowerCase().includes("api")) {
        category = "Backend Development";  
      } else if (course.title.toLowerCase().includes("sql") || 
                course.title.toLowerCase().includes("database") ||
                course.title.toLowerCase().includes("mongo")) {
        category = "Database Design";
      } else if (course.title.toLowerCase().includes("python")) {
        category = "Python";
      }
      
      if (!categories[category]) {
        categories[category] = { total: 0, completed: 0 };
      }
      
      categories[category].total += 1;
      // Check if course has exam results with passing score
      const hasPassedExam = examResults.some(
        result => result.courseId === course.id && result.percentage >= 70
      );
      
      if (hasPassedExam) {
        categories[category].completed += 1;
      }
    });
    
    // Convert to percentages
    const colors = ["bg-indigo-600", "bg-emerald-600", "bg-amber-600", "bg-blue-600", "bg-violet-600"];
    return Object.entries(categories).map(([category, data], index) => {
      const percentage = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
      return {
        category,
        percentage,
        color: colors[index % colors.length]
      };
    });
  }, [contents, examResults]);
  
  // Get the next course to continue learning
  const nextCourse = useMemo(() => {
    if (!contents.length) return null;
    
    // Look for a course that has been started but not completed
    const inProgressCourse = contents.find(course => {
      const relatedExam = examResults.find(exam => exam.courseId === course.id);
      return relatedExam && relatedExam.percentage < 70; // Less than passing grade
    });
    
    if (inProgressCourse) return inProgressCourse;
    
    // If no course is in progress, return the most recently created course
    return contents.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  }, [contents, examResults]);
  
  // Extract most recent completed courses
  const recentlyCompletedCourses = useMemo(() => {
    return examResults
      .filter(result => result.percentage >= 70)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  }, [examResults]);
  
  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (!examResults.length) return { completed: 0, total: 0, hours: 0 };
    
    const completed = examResults.filter(result => result.percentage >= 70).length;
    return {
      completed,
      total: contents.length,
      hours: completed * 3.5 // Assume 3.5 hours per completed course
    };
  }, [examResults, contents]);
  
  // Function to get course image based on title
  const getCourseImage = (title: string) => {
    if (title.toLowerCase().includes("javascript")) {
      return "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg";
    } else if (title.toLowerCase().includes("react")) {
      return "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg";
    } else if (title.toLowerCase().includes("node")) {
      return "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg";
    } else if (title.toLowerCase().includes("python")) {
      return "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg";
    } else {
      return "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg";
    }
  };
  
  // Format date to relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return date.toLocaleDateString();
  };
  
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-zinc-900">
        {/* Top section with welcome message */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Welcome back, {userData.name ?? 'Learner'}
            </p>
          </div>
          <div className="flex gap-3">
            <button className="bg-white dark:bg-zinc-800 px-4 py-2 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors">
              <Calendar className="w-4 h-4 mr-2 inline-block" />
              Schedule
            </button>
            <button 
              className="bg-indigo-600 px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              onClick={() => window.location.href = "/content"}
            >
              Explore Courses
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <>
            {/* Progress overview */}
            <section className="mb-8">
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                    <Sparkles className="h-5 w-5 text-indigo-500 mr-2" />
                    Learning Progress
                  </h2>
                  <button 
                    className="text-indigo-600 dark:text-indigo-400 font-medium text-sm flex items-center hover:underline"
                    onClick={() => window.location.href = "/roadmap"}
                  >
                    View roadmap
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {courseProgress.map((progress, index) => (
                    <div className="space-y-2" key={index}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{progress.category}</span>
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{progress.percentage}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div className={`h-full ${progress.color} rounded-full`} style={{width: `${progress.percentage}%`}}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Current Course */}
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden">
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Continue Learning</h2>
                    
                    {nextCourse ? (
                      <div className="flex flex-col md:flex-row gap-4 items-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                        <div className="flex-shrink-0 w-16 h-16 bg-white dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                          <img 
                            src={getCourseImage(nextCourse.title)}
                            alt={nextCourse.title}
                            className="h-10 w-10"
                          />
                        </div>
                        
                        <div className="flex-grow">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{nextCourse.title}</h3>
                          <div className="flex items-center mt-1">
                            <div className="flex-grow">
                              <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-600 rounded-full" style={{
                                  width: `${examResults.find(e => e.courseId === nextCourse.id)?.percentage || 0}%`
                                }}></div>
                              </div>
                            </div>
                            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                              {examResults.find(e => e.courseId === nextCourse.id)?.percentage || 0}%
                            </span>
                          </div>
                        </div>
                        
                        <button 
                          className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                          onClick={() => window.location.href = `/generated-courses?id=${nextCourse.id}`}
                        >
                          Resume
                        </button>
                      </div>
                    ) : (
                      <div className="text-center p-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                        <p className="text-gray-600 dark:text-gray-300">No courses in progress.</p>
                        <button 
                          className="mt-4 bg-indigo-600 text-white py-2 px-4 rounded-lg text-sm font-medium"
                          onClick={() => window.location.href = "/content"}
                        >
                          Find a course
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-gray-200 dark:border-zinc-700 p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Available Courses</h3>
                    
                    <div className="space-y-4">
                      {contents.slice(0, 2).map((course, index) => (
                        <div key={index} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-zinc-700/30 rounded-lg transition-colors">
                          <div className="w-10 h-10 bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center mr-4">
                            <img 
                              src={getCourseImage(course.title)}
                              alt={course.title}
                              className="h-6 w-6"
                            />
                          </div>
                          <div className="flex-grow">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">{course.title}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {course.prompt?.substring(0, 60)}
                              {course.prompt && course.prompt.length > 60 ? '...' : ''}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Weekly Activity */}
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Weekly Activity</h2>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                      <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
                      <span>12% more than last week</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-2">
                    {activityData.map((height, i) => (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <div className="w-full bg-gray-100 dark:bg-zinc-700 rounded-md relative" style={{height: '120px'}}>
                          <div 
                            className="absolute bottom-0 w-full bg-indigo-500 dark:bg-indigo-600 rounded-md transition-all duration-300" 
                            style={{height: `${height}%`}}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 p-4">
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-3">
                        <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Learning Hours</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{overallProgress.hours.toFixed(1)}</p>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">+4.5 this month</span>
                  </div>
                  
                  <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 p-4">
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mr-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Courses</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {overallProgress.completed}/{overallProgress.total}
                    </p>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      {overallProgress.total ? Math.round((overallProgress.completed / overallProgress.total) * 100) : 0}% completed
                    </span>
                  </div>
                </div>
                
                {/* Achievements */}
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Achievements</h2>
                  
                  {recentlyCompletedCourses.length > 0 ? (
                    <div className="space-y-4">
                      {recentlyCompletedCourses.map((course, index) => (
                        <div className="flex items-start" key={index}>
                          <div className="flex-shrink-0 mr-4">
                            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                              <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">{course.courseName} Completed</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Passed with {course.percentage}% score
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Complete courses to earn achievements
                      </p>
                    </div>
                  )}
                  
                  <button className="w-full mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium flex items-center justify-center">
                    View all achievements
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
                
                {/* Upcoming Mentor Sessions */}
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Upcoming Sessions</h2>
                  
                  <div className="bg-gray-50 dark:bg-zinc-700/30 rounded-lg p-4 border border-gray-200 dark:border-zinc-700">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Mentorship Session</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tomorrow, 2:00 PM</p>
                      </div>
                    </div>
                    <button 
                      className="w-full text-xs bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg py-2 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                      onClick={() => window.location.href = "/mentor_ship"}
                    >
                      Prepare for Session
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;