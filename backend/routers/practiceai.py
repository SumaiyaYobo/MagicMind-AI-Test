from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
# from langchain_openai import ChatOpenAI
# from langchain_chroma import Chroma
# from langchain_openai import OpenAIEmbeddings
# from langchain.text_splitter import RecursiveCharacterTextSplitter
# from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
# from langchain_community.document_loaders import WebBaseLoader, PyPDFLoader
# from langchain.chains import create_history_aware_retriever, create_retrieval_chain
# from langchain.chains.combine_documents import create_stuff_documents_chain
# from langchain_core.messages import AIMessage, HumanMessage
# import os
from swarm import Swarm, Agent
from dotenv import load_dotenv
import subprocess
import tempfile
import os
import uuid
import time
from pathlib import Path
import json

from fastapi import APIRouter, HTTPException


router = APIRouter(prefix="/practice", tags=["practice"])


class QueryRequest(BaseModel):
    user_specification: str
    topic: str
    difficulty: str 
    language: str 
    content: str = None
  
  
class QueryRequestModify(BaseModel):
    user_specification: str
    topic: str
    difficulty: str 
    language: str 
    given_problem: str 
    user_wants: str # easier/harder 
    content: str = None
  

class LiveRequest(BaseModel):
    given_problem: str 
    topic: str 
    language: str 
    user_code: str 


class ExecuteCodeRequest(BaseModel):
    code: str
    language: str


class QueryResponse(BaseModel):
    response: str


class ExecuteCodeResponse(BaseModel):
    output: str
    success: bool


load_dotenv()
client = Swarm()

problem_creation_agent = Agent(
    instructions=(
        "You are a highly intelligent and creative problem generator specializing in coding exercises. "
        "A student wants to practice coding on the topic: topic.\n"
        "- The student has selected a difficulty level: difficulty (Easy, Medium, or Difficult).\n"
        "- Generate a unique, engaging problem based on the given topic and difficulty.\n"
        "- Ensure the problem is:\n"
        "  1. **Relevant** to the topic.\n"
        "  2. **Challenging** based on the selected difficulty:\n"
        "      - **Easy**: Basic-level problem requiring foundational knowledge.\n"
        "      - **Medium**: Intermediate-level problem that involves some logical complexity.\n"
        "      - **Difficult**: Advanced-level problem requiring deep understanding and problem-solving skills.\n"
        "  3. **Clear and concise**, with all necessary input/output constraints explicitly stated.\n"
        "  4. Provides **real-world context**, if possible, to make the problem engaging.\n"
        "Return the problem as a formatted text response, including the following sections:\n"
        "- **Problem Title**\n"
        "- **Problem Description**\n"
        "- **Input Format**\n"
        "- **Output Format**\n"
        "- **Example(s)**\n"
    )
)

problem_modifying_agent = Agent(
    instructions=(
        "You are an adaptive problem generator responsible for dynamically modifying and escalating problem difficulty for coding practice. "
        "A student is solving coding problems and has just successfully solved a problem at the difficulty level: that problem is done.\n"
        "Your tasks are as follows:\n"
        "4. **Problem Format**:\n"
        "   - **Problem Title**\n"
        "   - **Problem Description**\n"
        "   - **Input Format**\n"
        "   - **Output Format**\n"
        "   - **Example(s)**\n"
     
    )
)



problem_solve_helper = Agent(
    instructions="Your message would be 2 or 3 sentence max. You will be given the current progress of the user (the code, the user is writing).  Based on the code the user is writing. Give a guideline if the progress code of the user isn't on the right way. Or say something nice if the user is doing good and on the right track. Also if you the think the whole code is done. maybe comment on the time complexity of the problem."
)


# Add execution helper function
def execute_code_safely(code: str, language: str) -> dict:
    """
    Safely execute code in a controlled environment
    """
    # Create a unique ID for this execution to avoid conflicts
    execution_id = str(uuid.uuid4())
    
    # Set up execution environment
    temp_dir = Path(tempfile.gettempdir()) / f"codementor_exec_{execution_id}"
    os.makedirs(temp_dir, exist_ok=True)
    
    # Log execution details for debugging
    debug_info = {
        "language": language,
        "execution_id": execution_id,
        "temp_dir": str(temp_dir),
        "code_length": len(code)
    }
    print(f"Debug - Execution request: {json.dumps(debug_info)}")
    
    try:
        if language.lower() == "python":
            # Create Python file
            file_path = temp_dir / "code.py"
            with open(file_path, "w") as f:
                f.write(code)
            
            # Check if Python is available
            try:
                # Get Python version for debugging
                version_result = subprocess.run(
                    ["python", "--version"],
                    capture_output=True,
                    text=True,
                    timeout=2
                )
                print(f"Debug - Python version: {version_result.stdout.strip()}")
            except Exception as e:
                print(f"Debug - Python check error: {str(e)}")
                # Try with python3 instead
                try:
                    version_result = subprocess.run(
                        ["python3", "--version"],
                        capture_output=True,
                        text=True,
                        timeout=2
                    )
                    print(f"Debug - Python3 version: {version_result.stdout.strip()}")
                    # If python3 works, use it instead
                    python_cmd = "python3"
                except Exception as e2:
                    print(f"Debug - Python3 check error: {str(e2)}")
                    return {
                        "success": False,
                        "output": f"Python interpreter not found. Make sure Python is installed and in your PATH.\nError details: {str(e)}\n{str(e2) if 'e2' in locals() else ''}"
                    }
            else:
                python_cmd = "python"
            
            # Run with timeout
            print(f"Debug - Running Python code with command: {python_cmd} {str(file_path)}")
            start_time = time.time()
            try:
                result = subprocess.run(
                    [python_cmd, str(file_path)],
                    capture_output=True,
                    text=True,
                    timeout=5  # 5 second timeout
                )
                execution_time = time.time() - start_time
                
                print(f"Debug - Python execution result: returncode={result.returncode}, stdout_length={len(result.stdout)}, stderr_length={len(result.stderr)}")
                
                return {
                    "success": result.returncode == 0,
                    "output": result.stdout if result.returncode == 0 else f"Error: {result.stderr}",
                    "execution_time": f"{execution_time:.3f}s"
                }
            except Exception as exec_error:
                print(f"Debug - Python execution error: {str(exec_error)}")
                return {
                    "success": False,
                    "output": f"Error running Python code: {str(exec_error)}"
                }
                
        elif language.lower() == "javascript":
            # Create JavaScript file
            file_path = temp_dir / "code.js"
            with open(file_path, "w") as f:
                f.write(code)
            
            # Run with Node.js if available
            try:
                start_time = time.time()
                result = subprocess.run(
                    ["node", str(file_path)],
                    capture_output=True,
                    text=True,
                    timeout=5  # 5 second timeout
                )
                execution_time = time.time() - start_time
                
                return {
                    "success": result.returncode == 0,
                    "output": result.stdout if result.returncode == 0 else f"Error: {result.stderr}",
                    "execution_time": f"{execution_time:.3f}s"
                }
            except FileNotFoundError:
                return {
                    "success": False,
                    "output": "Error: Node.js not found. Please install Node.js to execute JavaScript code."
                }
                
        elif language.lower() == "java":
            # Create Java file - extract class name from code
            class_name = "Main"  # Default class name
            
            # Try to find the class name in the code
            import re
            class_match = re.search(r"public\s+class\s+(\w+)", code)
            if class_match:
                class_name = class_match.group(1)
            
            file_path = temp_dir / f"{class_name}.java"
            with open(file_path, "w") as f:
                f.write(code)
            
            # Compile Java code
            compile_result = subprocess.run(
                ["javac", str(file_path)],
                capture_output=True,
                text=True
            )
            
            if compile_result.returncode != 0:
                return {
                    "success": False,
                    "output": f"Compilation Error: {compile_result.stderr}"
                }
            
            # Run Java code
            try:
                start_time = time.time()
                result = subprocess.run(
                    ["java", "-cp", str(temp_dir), class_name],
                    capture_output=True,
                    text=True,
                    timeout=5  # 5 second timeout
                )
                execution_time = time.time() - start_time
                
                return {
                    "success": result.returncode == 0,
                    "output": result.stdout if result.returncode == 0 else f"Error: {result.stderr}",
                    "execution_time": f"{execution_time:.3f}s"
                }
            except FileNotFoundError:
                return {
                    "success": False,
                    "output": "Error: Java not found. Please install Java to execute Java code."
                }
        else:
            return {
                "success": False,
                "output": f"Unsupported language: {language}. Supported languages are Python, JavaScript, and Java."
            }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "output": "Execution timed out. Your code took too long to run (>5 seconds)."
        }
    except Exception as e:
        return {
            "success": False,
            "output": f"Execution error: {str(e)}"
        }
    finally:
        # Clean up temp files
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except Exception:
            pass


@router.post("/execute", response_model=ExecuteCodeResponse)
async def execute_code(request: ExecuteCodeRequest):
    """
    Execute code in a sandbox environment and return the output
    """
    try:
        print(f"Debug - Execute code API called with language: {request.language}, code length: {len(request.code)}")
        
        if not request.code.strip():
            print("Debug - Empty code detected")
            raise HTTPException(status_code=400, detail="Code cannot be empty")
        
        # Print a small sample of the code for debugging
        code_sample = request.code[:100] + "..." if len(request.code) > 100 else request.code
        print(f"Debug - Code sample: {code_sample}")
        
        result = execute_code_safely(request.code, request.language)
        print(f"Debug - Execution result: {json.dumps(result)}")
        
        # Format the output for readability
        if result["success"] and "execution_time" in result:
            output = f"{result['output']}\n\nExecution completed in {result['execution_time']}"
        else:
            output = result["output"]
        
        return ExecuteCodeResponse(
            output=output,
            success=result["success"]
        )
    except Exception as e:
        print(f"Debug - Unexpected error in execute_code endpoint: {str(e)}")
        # Return error to client instead of raising an exception
        return ExecuteCodeResponse(
            output=f"Server error: {str(e)}",
            success=False
        )


@router.post("/create")
async def create_a_problem(request: QueryRequest):
    response = client.run(
            agent=problem_creation_agent,
            messages=[{"role": "user", "content": f"user specification: {request.user_specification}. Topic and language: {request.topic} {request.language}. Difficulty: {request.difficulty}"}],
        )

    return response.messages[-1]["content"]


@router.post("/modify")
async def create_a_problem(request: QueryRequestModify):
    response = client.run(
            agent=problem_modifying_agent,
            messages=[{"role": "user", "content": f"user specification: {request.user_specification}. Topic and language: {request.topic} {request.language}. Difficulty: {request.difficulty}. But user wants {request.user_wants} problem"}],
        )

    return response.messages[-1]["content"]


@router.post("/live_tracking")
async def create_a_problem(request: LiveRequest):
    response = client.run(
            agent=problem_solve_helper,
            messages=[{"role": "user", "content": f"Topic and language: {request.topic} {request.language}.  Given Problem {request.given_problem} user current progress {request.user_code}."}],
        )

    return response.messages[-1]["content"]