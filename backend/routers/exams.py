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
            "createdAt": datetime.now().isoformat(),
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
        
        # Fetch exam records for the user
        exam_records = await db.examresult.find_many(
            where={"userId": user_id},
            order_by={"createdAt": "desc"}
        )
        
        await db.disconnect()
        
        # Format the records for the response
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
                "createdAt": record.createdAt.isoformat() if record.createdAt else None
            })
        
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