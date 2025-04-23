from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_community.document_loaders import WebBaseLoader, PyPDFLoader
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.messages import AIMessage, HumanMessage
import os

from fastapi import APIRouter, HTTPException

# Initialize variables
global retriever
retriever = None

router = APIRouter(prefix="/newcontent", tags=["newcontent"])



llm = ChatOpenAI(model="gpt-4o")
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

# Request Models
class SourceInput(BaseModel):
    sources: list[str]

class ChatInput(BaseModel):
    prompt: str
    topic: str 
    chat_history: list[dict]

class TopicInput(BaseModel):
    specific_section: str 
    chat_history: list[dict]

class QuizBody(BaseModel):
    chat_history: list[dict]

class QuizResult(BaseModel):
    wrong_text: str
    chat_history: list[dict]


class RetakeBody(BaseModel):
    chat_history: list[dict]

class ContentQuizInput(BaseModel):
    content: str
    topic: str

class ShortAnswerQuestionsInput(BaseModel):
    content: str
    topic: str
    
class ShortAnswerEvaluationInput(BaseModel):
    questions: list[dict]
    answers: list[str]
    topic: str

# Helper Functions
def process_documents(sources):
    documents = []
    for source in sources:
        if source.endswith(".pdf"):
            loader = PyPDFLoader(source)
        else:
            loader = WebBaseLoader(source)
        documents.extend(loader.load())

    document_chunks = text_splitter.split_documents(documents)
    vectorstore = Chroma.from_documents(document_chunks, OpenAIEmbeddings())
    return vectorstore.as_retriever()

def get_conversational_rag_chain(retriever):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Teach the user on the certain topic based on the context. Also give him a question after each response. If the user is correct move ahead.:\n\n{context}"),
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{input}"),
    ])
    stuff_documents_chain = create_stuff_documents_chain(llm, prompt)
    return create_retrieval_chain(retriever, stuff_documents_chain)

def get_context_retriever_chain(retriever):
    prompt = ChatPromptTemplate.from_messages([
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{input}"),
        ("user", "Based on the conversation, generate a search query to get relevant information."),
    ])
    return create_history_aware_retriever(llm, retriever, prompt)

# API Endpoints
@router.post("/load_sources")
async def load_sources(input: SourceInput):
    global retriever
    try:
        retriever = process_documents(input.sources)
        return {"message": "Sources processed and retriever initialized successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing sources: {str(e)}")

@router.post("/chat")
async def chat(input: ChatInput):
    global retriever
    if retriever is None:
        raise HTTPException(status_code=400, detail="Retriever not initialized. Please load sources first.")

    try:
        # Reconstruct chat history
        chat_history = [
            AIMessage(content=msg["content"]) if msg["role"] == "ai" else HumanMessage(content=msg["content"])
            for msg in input.chat_history
        ]

        # Generate response
        retriever_chain = get_context_retriever_chain(retriever)
        conversation_rag_chain = get_conversational_rag_chain(retriever_chain)
        response = conversation_rag_chain.invoke({
            "chat_history": chat_history,
            "input": f"Your task is to teach the user the topic {input.topic}. This is the {chat_history}. If the chat history covers concept, programming and example, then the user learnt everything for now. Tell that he learnt the topic. If not.   Teach him slowly. Also after explaining something, ask him 2 or 3 question with multiple choice. Each question will be formatted by ((question?*a) *b) *c) *d))). Analysis the chat history provided to check if the user is answering correct or not. If he answers correct, explain further on the topic. After explaining the concept, move on to code part. and show some example codes. Then ask for output of the code. Later at the end of your chat stream, tell the user to point out error in a code in MCQ. Finally when y think the user has learnt it everything, show a ending message.",
        })

        # Update chat history
        chat_history.append(HumanMessage(content=input.prompt))
        chat_history.append(AIMessage(content=response["answer"]))

        # Return updated history and response
        return {
            "response": response["answer"],
            "chat_history": [
                {"role": "ai" if isinstance(msg, AIMessage) else "human", "content": msg.content}
                for msg in chat_history
            ],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")



@router.post("/topic_list")
async def topic(input: TopicInput):
    global retriever
    if retriever is None:
        raise HTTPException(status_code=400, detail="Retriever not initialized. Please load sources first.")

    try:
        # Reconstruct chat history
        chat_history = [
            AIMessage(content=msg["content"]) if msg["role"] == "ai" else HumanMessage(content=msg["content"])
            for msg in input.chat_history
        ]

        # Generate response
        retriever_chain = get_context_retriever_chain(retriever)
        conversation_rag_chain = get_conversational_rag_chain(retriever_chain)
        response = conversation_rag_chain.invoke({
            "chat_history": chat_history,
            "input":f"Generate a topic list on the specific part specified or whole section. Use only bulletin points of number. Dont generate other things. Specified Section: {input.specific_section}",
        })

        # Update chat history
        chat_history.append(AIMessage(content=response["answer"]))

        # Return updated history and response
        return {
            "response": response["answer"],
            "chat_history": [
                {"role": "ai" if isinstance(msg, AIMessage) else "human", "content": msg.content}
                for msg in chat_history
            ],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")


@router.post("/take_quiz")
async def quiz(input: QuizBody):
    global retriever
    if retriever is None:
        raise HTTPException(status_code=400, detail="Retriever not initialized. Please load sources first.")

    try:
        # Reconstruct chat history
        chat_history = [
            AIMessage(content=msg["content"]) if msg["role"] == "ai" else HumanMessage(content=msg["content"])
            for msg in input.chat_history
        ]

        # Generate response
        retriever_chain = get_context_retriever_chain(retriever)
        conversation_rag_chain = get_conversational_rag_chain(retriever_chain)
        response = conversation_rag_chain.invoke({
            "chat_history": chat_history,
            "input":f"Generate 15 Multiple Choice Questions based on the chat history and also the context. Moreover, after each question say the answer too. put the answer in /box() with the number inside. so if question 1's answer is A. then /box(1A)",
        })

        # Update chat history
        chat_history.append(AIMessage(content=response["answer"]))

        # Return updated history and response
        return {
            "response": response["answer"],
            "chat_history": [
                {"role": "ai" if isinstance(msg, AIMessage) else "human", "content": msg.content}
                for msg in chat_history
            ],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")


@router.post("/generate_json_quiz")
async def generate_json_quiz(input: ContentQuizInput):
    try:
        # Generate MCQs directly from content without retriever
        response = llm.invoke(
            f"""
            Based on the following content about {input.topic}, create 15 multiple-choice questions with 4 options each.
            
            CONTENT:
            {input.content}
            
            Return the result in the following JSON format:
            {{
                "quiz": [
                    {{
                        "question": "Question text here",
                        "options": [
                            {{
                                "id": "A",
                                "text": "Option A text"
                            }},
                            {{
                                "id": "B", 
                                "text": "Option B text"
                            }},
                            {{
                                "id": "C",
                                "text": "Option C text"
                            }},
                            {{
                                "id": "D",
                                "text": "Option D text"
                            }}
                        ],
                        "correctAnswer": "A",
                        "explanation": "Explanation of why A is correct"
                    }},
                    // ... more questions
                ]
            }}
            
            Make sure the response is valid JSON. Include a variety of difficulty levels. Make sure the answer options are plausible and challenging.
            """,
            response_format={ "type": "json_object" }
        )

        return response.content

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")


@router.post("/generate_short_answer_questions")
async def generate_short_answer_questions(input: ShortAnswerQuestionsInput):
    try:
        # Generate short answer questions from content without retriever
        response = llm.invoke(
            f"""
            Based on the following content about {input.topic}, create 10 thoughtful short answer questions that test deep understanding.
            
            CONTENT:
            {input.content}
            
            Return the result in the following JSON format:
            {{
                "questions": [
                    {{
                        "id": 1,
                        "question": "Question text here",
                        "expectedAnswer": "A detailed expected answer that will be used for evaluation",
                        "difficulty": "easy|medium|hard",
                        "points": 10
                    }},
                    // ... more questions (10 total)
                ]
            }}
            
            Make sure the response is valid JSON. Include a variety of difficulty levels (easy, medium, hard).
            The expectedAnswer should be comprehensive but concise, around 2-3 sentences.
            Total points should add up to 100, with harder questions worth more points.
            """,
            response_format={ "type": "json_object" }
        )

        return response.content

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating short answer questions: {str(e)}")


@router.post("/evaluate_short_answers")
async def evaluate_short_answers(input: ShortAnswerEvaluationInput):
    try:
        # Format questions and answers for evaluation
        qa_pairs = []
        for i, question in enumerate(input.questions):
            # Make sure we have an answer for this question
            answer = input.answers[i] if i < len(input.answers) else ""
            qa_pairs.append(f"Question {question['id']}: {question['question']}\nExpected Answer: {question['expectedAnswer']}\nUser's Answer: {answer}\nPoints Possible: {question['points']}")
        
        questions_and_answers = "\n\n".join(qa_pairs)
        
        # Evaluate the answers
        response = llm.invoke(
            f"""
            You are an expert evaluator for {input.topic}. You need to grade the following short answers.
            
            For each question, evaluate how well the user's answer matches the expected answer.
            Consider correctness, completeness, clarity, and use of proper terminology.
            
            {questions_and_answers}
            
            Return your evaluation in the following JSON format:
            {{
                "evaluations": [
                    {{
                        "questionId": 1,
                        "pointsEarned": 8,  // out of the points possible
                        "feedback": "Concise feedback on the answer, including strengths and areas for improvement",
                        "isCorrect": true  // true if at least 60% of possible points were earned
                    }},
                    // ... one evaluation for each question
                ],
                "totalScore": 75,  // sum of all pointsEarned
                "percentageScore": 75,  // percentage of total possible points
                "overallFeedback": "A paragraph of helpful overall feedback about all answers"
            }}
            
            Be fair but rigorous in your evaluation. Provide constructive feedback that helps the user understand why they earned their score.
            """,
            response_format={ "type": "json_object" }
        )
        
        return response.content
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evaluating short answers: {str(e)}")


@router.post("/evaluate_quiz")
async def evaluate(input: QuizResult):
    global retriever
    if retriever is None:
        raise HTTPException(status_code=400, detail="Retriever not initialized. Please load sources first.")

    try:
        # Reconstruct chat history
        chat_history = [
            AIMessage(content=msg["content"]) if msg["role"] == "ai" else HumanMessage(content=msg["content"])
            for msg in input.chat_history
        ]

        # Generate response
        retriever_chain = get_context_retriever_chain(retriever)
        conversation_rag_chain = get_conversational_rag_chain(retriever_chain)
        response = conversation_rag_chain.invoke({
            "chat_history": chat_history,
            "input":f"These are the questions i got wrong in the quiz. {input.wrong_text}. Now teach me those questions.",
        })

        # Update chat history
        chat_history.append(HumanMessage(content=f"(I got these questions wrong. {input.wrong_text})"))
        chat_history.append(AIMessage(content=response["answer"]))

        # Return updated history and response
        return {
            "response": response["answer"],
            "chat_history": [
                {"role": "ai" if isinstance(msg, AIMessage) else "human", "content": msg.content}
                for msg in chat_history
            ],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")



@router.post("/retake_quiz")
async def retake(input: RetakeBody):
    global retriever
    if retriever is None:
        raise HTTPException(status_code=400, detail="Retriever not initialized. Please load sources first.")

    try:
        # Reconstruct chat history
        chat_history = [
            AIMessage(content=msg["content"]) if msg["role"] == "ai" else HumanMessage(content=msg["content"])
            for msg in input.chat_history
        ]

        # Generate response
        retriever_chain = get_context_retriever_chain(retriever)
        conversation_rag_chain = get_conversational_rag_chain(retriever_chain)
        response = conversation_rag_chain.invoke({
            "chat_history": chat_history,
            "input":f"Generate me a quiz again on 15 questions but these time generate 70% questions on the topic i got wrong. Moreover, after each question say the answer too. put the answer in /box() with the number inside. so if question 1's answer is A. then /box(1A)",
        })

        # Update chat history
        chat_history.append(AIMessage(content=response["answer"]))

        # Return updated history and response
        return {
            "response": response["answer"],
            "chat_history": [
                {"role": "ai" if isinstance(msg, AIMessage) else "human", "content": msg.content}
                for msg in chat_history
            ],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}") 
    

