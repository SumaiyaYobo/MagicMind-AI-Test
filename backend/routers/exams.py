from fastapi import APIRouter, HTTPException
from prisma import Prisma
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import json

# Models for the exam record
class MCQOption(BaseModel):
    id: str
    text: str

class MCQQuestion(BaseModel):
    question: str
    options: List[MCQOption]
    correctAnswer: str
    userAnswer: str
    isCorrect: bool

class ShortAnswerQuestion(BaseModel):
    id: int
    question: str
    referenceAnswer: str
    userAnswer: str
    pointsEarned: Optional[float] = None
    feedback: Optional[str] = None

class CodingProblem(BaseModel):
    title: str
    description: str
    userSolution: str
    codeOutput: Optional[str] = None

class ScoreSection(BaseModel):
    earned: float
    total: float
    percentage: float

class ScoreRecord(BaseModel):
    mcq: ScoreSection
    shortAnswer: ScoreSection
    coding: ScoreSection
    total: ScoreSection

class ExamRecord(BaseModel):
    userId: str
    courseId: str
    courseName: str
    examDate: str
    difficulty: str
    timeLimit: int
    timeSpent: int
    mcqQuestions: List[MCQQuestion]
    shortAnswerQuestions: List[ShortAnswerQuestion]
    codingProblems: List[CodingProblem]
    scores: ScoreRecord
    feedback: str

class WrongAnswer(BaseModel):
    questionType: str  # "MCQ" or "ShortAnswer"
    questionId: str
    question: str
    userAnswer: str
    correctAnswer: str
    explanation: Optional[str] = None
    courseId: Optional[str] = None

class WrongAnswersRequest(BaseModel):
    wrong_answers: List[WrongAnswer]
    userId: str
    courseId: Optional[str] = None
    courseName: Optional[str] = None

router = APIRouter(prefix="/exams", tags=["exams"])

@router.post("/save_result")
async def save_exam_result(exam_record: ExamRecord):
    """
    Save a completed exam result to the database
    """
    try:
        # Connect to the database
        db = Prisma()
        await db.connect()
        
        # Create a new exam record in the database
        # First, prepare the data for storage
        # We need to convert some complex objects to JSON strings
        exam_data = {
            "userId": exam_record.userId,
            "courseId": exam_record.courseId,
            "courseName": exam_record.courseName,
            "examDate": exam_record.examDate,
            "difficulty": exam_record.difficulty,
            "timeLimit": exam_record.timeLimit,
            "timeSpent": exam_record.timeSpent,
            "mcqQuestions": json.dumps([question.dict() for question in exam_record.mcqQuestions]),
            "shortAnswerQuestions": json.dumps([question.dict() for question in exam_record.shortAnswerQuestions]),
            "codingProblems": json.dumps([problem.dict() for problem in exam_record.codingProblems]),
            "mcqScore": exam_record.scores.mcq.earned,
            "mcqTotal": exam_record.scores.mcq.total,
            "mcqPercentage": exam_record.scores.mcq.percentage,
            "shortAnswerScore": exam_record.scores.shortAnswer.earned,
            "shortAnswerTotal": exam_record.scores.shortAnswer.total,
            "shortAnswerPercentage": exam_record.scores.shortAnswer.percentage,
            "codingScore": exam_record.scores.coding.earned,
            "codingTotal": exam_record.scores.coding.total,
            "codingPercentage": exam_record.scores.coding.percentage,
            "totalScore": exam_record.scores.total.earned,
            "totalPossible": exam_record.scores.total.total,
            "percentage": exam_record.scores.total.percentage,
            "feedback": exam_record.feedback,
        }
        
        # Store in the database
        # Note: This assumes you have an 'ExamResult' model in your Prisma schema
        # If not, you'll need to create it
        created_record = await db.examresult.create(data=exam_data)
        
        await db.disconnect()
        
        return {
            "message": "Exam result saved successfully",
            "examId": created_record.id
        }
        
    except Exception as e:
        # Log the error for debugging
        print(f"Error saving exam result: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save exam result: {str(e)}")

@router.get("/user/{user_id}")
async def get_user_exam_history(user_id: str):
    """
    Get all exam results for a specific user
    """
    try:
        # Connect to the database
        db = Prisma()
        await db.connect()
        
        # First try to fetch from examresult table
        try:
            exam_records = await db.examresult.find_many(
                where={"userId": user_id}
            )
            
            # Format the records from examresult table
            formatted_records = []
            for record in exam_records:
                formatted_records.append({
                    "id": record.id,
                    "courseId": record.courseId,
                    "courseName": record.courseName,
                    "examDate": record.examDate,
                    "difficulty": record.difficulty,
                    "percentage": record.percentage,
                    "timeSpent": record.timeSpent,
                    "createdAt": record.createdAt.isoformat() if record.createdAt else None,
                    "table": "examresult"
                })
        except Exception as e:
            print(f"Error fetching from examresult table: {str(e)}")
            formatted_records = []
        
        # Then fetch from exam table
        try:
            exam_table_records = await db.exam.find_many(
                where={"userId": user_id}
            )
            
            # Format the records from exam table
            for record in exam_table_records:
                # Process wrongMCQs to get an overall score if available
                percentage = 0
                if record.wrongMCQs:
                    try:
                        mcqs = json.loads(record.wrongMCQs)
                        # Use a placeholder percentage - you might want to calculate this differently
                        percentage = 80  # Assuming they got most right if they only have a few wrong
                    except:
                        percentage = 0
                
                formatted_records.append({
                    "id": record.id,
                    "courseId": record.courseId or "",
                    "courseName": record.courseName or "",
                    "examDate": record.createdAt.isoformat() if record.createdAt else "",
                    "difficulty": "medium",  # Default value
                    "percentage": percentage,
                    "timeSpent": 0,  # Default value
                    "createdAt": record.createdAt.isoformat() if record.createdAt else None,
                    "table": "exam"
                })
        except Exception as e:
            print(f"Error fetching from exam table: {str(e)}")
        
        await db.disconnect()
        
        # Sort the combined records by createdAt date descending (most recent first)
        formatted_records.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        
        return formatted_records
        
    except Exception as e:
        # Log the error for debugging
        print(f"Error fetching user exam history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch exam history: {str(e)}")

@router.get("/{exam_id}")
async def get_exam_details(exam_id: str):
    """
    Get detailed information about a specific exam
    """
    try:
        # Connect to the database
        db = Prisma()
        await db.connect()
        
        # Fetch the exam record
        exam_record = await db.examresult.find_unique(where={"id": exam_id})
        
        if not exam_record:
            await db.disconnect()
            raise HTTPException(status_code=404, detail="Exam record not found")
        
        await db.disconnect()
        
        # Parse JSON strings back to objects
        mcq_questions = json.loads(exam_record.mcqQuestions)
        short_answer_questions = json.loads(exam_record.shortAnswerQuestions)
        coding_problems = json.loads(exam_record.codingProblems)
        
        # Format the record for the response
        formatted_record = {
            "id": exam_record.id,
            "userId": exam_record.userId,
            "courseId": exam_record.courseId,
            "courseName": exam_record.courseName,
            "examDate": exam_record.examDate,
            "difficulty": exam_record.difficulty,
            "timeLimit": exam_record.timeLimit,
            "timeSpent": exam_record.timeSpent,
            "mcqQuestions": mcq_questions,
            "shortAnswerQuestions": short_answer_questions,
            "codingProblems": coding_problems,
            "scores": {
                "mcq": {
                    "earned": exam_record.mcqScore,
                    "total": exam_record.mcqTotal,
                    "percentage": exam_record.mcqPercentage
                },
                "shortAnswer": {
                    "earned": exam_record.shortAnswerScore,
                    "total": exam_record.shortAnswerTotal,
                    "percentage": exam_record.shortAnswerPercentage
                },
                "coding": {
                    "earned": exam_record.codingScore,
                    "total": exam_record.codingTotal,
                    "percentage": exam_record.codingPercentage
                },
                "total": {
                    "earned": exam_record.totalScore,
                    "total": exam_record.totalPossible,
                    "percentage": exam_record.percentage
                }
            },
            "feedback": exam_record.feedback,
            "createdAt": exam_record.createdAt.isoformat() if exam_record.createdAt else None
        }
        
        return formatted_record
        
    except HTTPException:
        raise
    except Exception as e:
        # Log the error for debugging
        print(f"Error fetching exam details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch exam details: {str(e)}")

@router.post("/save_wrong_answers")
async def save_wrong_answers(request: WrongAnswersRequest):
    """
    Save wrong MCQ and short answer questions to the Exam table as a single record
    """
    try:
        # Connect to the database
        db = Prisma()
        await db.connect()
        
        # Separate MCQs and Short Answer questions
        mcqs = [answer for answer in request.wrong_answers if answer.questionType == "MCQ"]
        short_answers = [answer for answer in request.wrong_answers if answer.questionType == "ShortAnswer"]
        
        # Create a single exam record with all wrong answers
        saved_exam = await db.exam.create(
            data={
                "courseId": request.courseId,
                "courseName": request.courseName,
                "userId": request.userId,
                "wrongMCQs": json.dumps([{
                    "questionId": q.questionId,
                    "question": q.question,
                    "userAnswer": q.userAnswer,
                    "correctAnswer": q.correctAnswer,
                    "explanation": q.explanation
                } for q in mcqs]) if mcqs else None,
                "wrongShortAnswers": json.dumps([{
                    "questionId": q.questionId,
                    "question": q.question,
                    "userAnswer": q.userAnswer,
                    "correctAnswer": q.correctAnswer,
                    "explanation": q.explanation
                } for q in short_answers]) if short_answers else None
            }
        )
        
        await db.disconnect()
        
        return {
            "message": f"Successfully saved exam with wrong answers",
            "examId": saved_exam.id,
            "mcqCount": len(mcqs),
            "shortAnswerCount": len(short_answers)
        }
        
    except Exception as e:
        # Log the error for debugging
        print(f"Error saving wrong answers: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save wrong answers: {str(e)}")

@router.get("/wrong_answers/{user_id}")
async def get_user_wrong_answers(user_id: str):
    """
    Get all wrong answers for a specific user
    """
    try:
        # Connect to the database
        db = Prisma()
        await db.connect()
        
        # Fetch wrong answers for the user - without the unsupported order_by parameter
        exams = await db.exam.find_many(
            where={"userId": user_id}
        )
        
        # Sort the exams by createdAt in Python instead (descending order)
        exams = sorted(exams, key=lambda x: x.createdAt if x.createdAt else "", reverse=True)
        
        # Process the exams to extract wrong answers
        results = []
        for exam in exams:
            # Process MCQs
            if exam.wrongMCQs:
                mcqs = json.loads(exam.wrongMCQs)
                for mcq in mcqs:
                    results.append({
                        "id": f"{exam.id}_mcq_{mcq.get('questionId', '0')}",
                        "examId": exam.id,
                        "courseId": exam.courseId,
                        "courseName": exam.courseName,
                        "questionType": "MCQ",
                        "questionId": mcq.get("questionId", ""),
                        "question": mcq.get("question", ""),
                        "userAnswer": mcq.get("userAnswer", ""),
                        "correctAnswer": mcq.get("correctAnswer", ""),
                        "explanation": mcq.get("explanation", ""),
                        "createdAt": exam.createdAt.isoformat() if exam.createdAt else "",
                        "updatedAt": exam.updatedAt.isoformat() if exam.updatedAt else ""
                    })
            
            # Process Short Answers
            if exam.wrongShortAnswers:
                short_answers = json.loads(exam.wrongShortAnswers)
                for sa in short_answers:
                    results.append({
                        "id": f"{exam.id}_sa_{sa.get('questionId', '0')}",
                        "examId": exam.id,
                        "courseId": exam.courseId,
                        "courseName": exam.courseName,
                        "questionType": "ShortAnswer",
                        "questionId": sa.get("questionId", ""),
                        "question": sa.get("question", ""),
                        "userAnswer": sa.get("userAnswer", ""),
                        "correctAnswer": sa.get("correctAnswer", ""),
                        "explanation": sa.get("explanation", ""),
                        "createdAt": exam.createdAt.isoformat() if exam.createdAt else "",
                        "updatedAt": exam.updatedAt.isoformat() if exam.updatedAt else ""
                    })
        
        await db.disconnect()
        
        return results
        
    except Exception as e:
        # Log the error for debugging
        print(f"Error fetching user wrong answers: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch wrong answers: {str(e)}")