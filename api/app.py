#!/usr/bin/env python

import hashlib
import json
import os
import sys
import threading
import time
from pathlib import Path
import traceback
import logging
import flask
from flask import Flask, jsonify, request, send_from_directory, Response, stream_with_context
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime
import queue
from dotenv import load_dotenv

# Add the parent directory to sys.path to be able to import aider modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from aider import urls
from aider.coders import Coder
from aider.dump import dump  # noqa: F401
from aider.io import InputOutput
from aider.main import main as cli_main
from aider.scrape import Scraper

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Store sessions by session_id
sessions = {}

# Message queues for session streaming
message_queues = {}

# Load environment variables from .env file
load_dotenv()

class AiderAPI:
    """API wrapper for Aider functionality"""
    
    class CaptureIO(InputOutput):
        """Custom IO class that captures output for the API"""
        lines = []

        def tool_output(self, msg, log_only=False):
            if not log_only:
                self.lines.append(msg)
            super().tool_output(msg, log_only=log_only)

        def tool_error(self, msg):
            self.lines.append(msg)
            super().tool_error(msg)

        def tool_warning(self, msg):
            self.lines.append(msg)
            super().tool_warning(msg)

        def get_captured_lines(self):
            lines = self.lines
            self.lines = []
            return lines

    @staticmethod
    def initialize_coder(args=None):
        """Initialize a coder instance with optional args"""
        logger = logging.getLogger(__name__)
        logger.debug("\n=== Starting Coder Initialization ===")
        logger.debug(f"Current working directory: {os.getcwd()}")
        
        try:
            # Check if we're in a git repo
            from git import Repo
            try:
                repo = Repo(os.getcwd(), search_parent_directories=True)
                logger.debug(f"Found git repo at: {repo.git_dir}")
            except Exception as e:
                logger.error(f"Failed to find git repo: {str(e)}")
                raise ValueError("API must be run inside a git repository")

            logger.debug("Creating coder instance...")
            coder = cli_main(argv=args, return_coder=True)
            logger.debug(f"Coder instance created: {type(coder)}")
            
            if not isinstance(coder, Coder):
                logger.error(f"Invalid coder type: {type(coder)}")
                raise ValueError(f"Invalid coder instance: {coder}")
            
            if not coder.repo:
                logger.error("No git repo found in coder instance")
                raise ValueError("API can currently only be used inside a git repo")
            
            logger.debug(f"Coder repo path: {coder.repo.repo.git_dir}")
            
            io = AiderAPI.CaptureIO(
                pretty=False,
                yes=True,
                dry_run=coder.io.dry_run,
                encoding=coder.io.encoding,
            )
            logger.debug("Created CaptureIO instance")
            
            coder.commands.io = io
            
            # Force the coder to cooperate, regardless of cmd line args
            coder.yield_stream = True
            coder.stream = True
            coder.pretty = False
            
            logger.debug("=== Coder initialization completed successfully ===\n")
            return coder
            
        except Exception as e:
            logger.error("\n=== Error during coder initialization ===")
            logger.error(f"Error: {str(e)}")
            logger.error(f"Traceback:\n{traceback.format_exc()}")
            raise
    
    @staticmethod
    def get_announcements(coder):
        """Get announcements from coder"""
        return coder.get_announcements()
    
    @staticmethod
    def process_chat(coder, prompt, session_id):
        """Process a chat message and queue response for streaming"""
        def run_stream():
            try:
                # Ensure the session has a message queue
                if session_id not in message_queues:
                    message_queues[session_id] = queue.Queue()
                
                # Get the queue for this session
                message_queue = message_queues[session_id]
                
                # Process the prompt and stream response
                for chunk in coder.run_stream(prompt):
                    # Add chunk to the queue
                    message_queue.put({
                        'type': 'message_chunk',
                        'data': {'chunk': chunk, 'session_id': session_id}
                    })
                
                # Mark message as complete
                message_queue.put({
                    'type': 'message_complete',
                    'data': {'session_id': session_id}
                })
                
                # Check for edits
                if coder.aider_edited_files:
                    message_queue.put({
                        'type': 'files_edited',
                        'data': {'files': list(coder.aider_edited_files), 'session_id': session_id}
                    })
                
                # Check for commits
                if sessions[session_id].get('last_aider_commit_hash') != coder.last_aider_commit_hash:
                    if coder.last_aider_commit_hash:
                        commits = f"{coder.last_aider_commit_hash}~1"
                        diff = coder.repo.diff_commits(
                            coder.pretty,
                            commits,
                            coder.last_aider_commit_hash,
                        )
                        
                        message_queue.put({
                            'type': 'commit',
                            'data': {
                                'hash': coder.last_aider_commit_hash,
                                'message': coder.last_aider_commit_message,
                                'diff': diff,
                                'session_id': session_id
                            }
                        })
                        
                        sessions[session_id]['last_aider_commit_hash'] = coder.last_aider_commit_hash
            except Exception as e:
                print(f"Error in process_chat: {str(e)}")
                print(traceback.format_exc())
                
                # Add error to queue
                if session_id in message_queues:
                    message_queues[session_id].put({
                        'type': 'error',
                        'data': {'message': str(e), 'session_id': session_id}
                    })
        
        # Create and start thread
        thread = threading.Thread(target=run_stream)
        thread.daemon = True
        thread.start()
        return True

    @staticmethod
    def scrape_url(url):
        """Scrape content from a URL"""
        scraper = Scraper(print_error=lambda x: x)
        return scraper.scrape(url)

# Helper function to get a session or create if it doesn't exist
def get_or_create_session(session_id, create=True):
    """Get or create a session by ID"""
    logger = logging.getLogger(__name__)
    
    logger.debug(f"get_or_create_session called with ID: {session_id}")
    logger.debug(f"Current sessions: {list(sessions.keys())}")
    
    if session_id not in sessions and create:
        logger.debug(f"Creating new session for ID: {session_id}")
        try:
            coder = AiderAPI.initialize_coder()
            logger.debug("Coder initialized successfully")
            
            # Get initial files before creating session
            all_files = coder.get_all_relative_files()
            inchat_files = coder.get_inchat_relative_files()
            logger.debug(f"Found files - All: {all_files}, InChat: {inchat_files}")
            
            sessions[session_id] = {
                'coder': coder,
                'messages': [],
                'files': inchat_files,
                'last_aider_commit_hash': coder.last_aider_commit_hash,
                'input_history': list(coder.io.get_input_history()),
                'created_at': time.time()
            }
            logger.debug(f"Session created successfully")
            
            # Add initialization announcements
            announcements = AiderAPI.get_announcements(coder)
            sessions[session_id]['messages'].append({
                'role': 'info', 
                'content': '\n'.join(announcements)
            })
            sessions[session_id]['messages'].append({
                'role': 'assistant', 
                'content': 'How can I help you?'
            })
            logger.debug("Added initial messages to session")
            
        except Exception as e:
            logger.error(f"Failed to create session: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None, str(e)
    else:
        logger.debug(f"Using existing session: {session_id}")
    
    return sessions.get(session_id), None

# Routes
@app.route('/api/init', methods=['POST'])
def initialize_session():
    """Initialize a new session"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    return jsonify({
        'status': 'success',
        'messages': session['messages'],
        'files': session['files']
    })

@app.route('/api/send_message', methods=['POST'])
def send_message():
    """Send a message to the aider coder"""
    data = request.json
    session_id = data.get('session_id')
    message = data.get('message')
    
    if not session_id or not message:
        return jsonify({'status': 'error', 'message': 'Session ID and message are required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    
    # Add message to history
    session['messages'].append({'role': 'user', 'content': message})
    coder.io.add_to_input_history(message)
    session['input_history'].append(message)
    
    # Process message asynchronously
    AiderAPI.process_chat(coder, message, session_id)
    
    return jsonify({'status': 'success'})

# Server-Sent Events (SSE) endpoint for streaming responses
@app.route('/api/stream', methods=['GET'])
def message_stream():
    """Stream messages for a session using Server-Sent Events"""
    session_id = request.args.get('session_id')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    # Create a queue for this session if it doesn't exist
    if session_id not in message_queues:
        message_queues[session_id] = queue.Queue()
    
    # Get the queue for this session
    message_queue = message_queues[session_id]
    
    # Define the generator function for SSE
    def generate():
        try:
            # First event to establish connection
            yield 'event: connected\ndata: {"session_id": "' + session_id + '"}\n\n'
            
            while True:
                try:
                    # Try to get a message from the queue, timeout after 30 seconds
                    message = message_queue.get(timeout=30)
                    
                    # Format the message as an SSE event
                    event_type = message['type']
                    data = json.dumps(message['data'])
                    
                    yield f"event: {event_type}\ndata: {data}\n\n"
                    
                    # If this is a message_complete event, also yield a keep-alive
                    if event_type == 'message_complete':
                        yield 'event: keep-alive\ndata: {}\n\n'
                        
                except queue.Empty:
                    # Send a keep-alive event every 30 seconds to maintain the connection
                    yield 'event: keep-alive\ndata: {}\n\n'
        except GeneratorExit:
            # Client disconnected
            print(f"Client disconnected from stream: {session_id}")
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'  # Disable buffering for Nginx
        }
    )

@app.route('/api/test_message', methods=['POST'])
def test_message():
    """Test endpoint for message streaming"""
    data = request.json
    session_id = data.get('session_id')
    message = data.get('message', 'No message provided')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    # Create a queue for this session if it doesn't exist
    if session_id not in message_queues:
        message_queues[session_id] = queue.Queue()
    
    # Create a simple response
    response = {
        'session_id': session_id,
        'message': f"Server received: {message}",
        'timestamp': time.time()
    }
    
    # Add to the message queue as chunks
    response_str = json.dumps(response)
    chunk_size = 10  # Small chunk size for testing
    
    for i in range(0, len(response_str), chunk_size):
        chunk = response_str[i:i+chunk_size]
        message_queues[session_id].put({
            'type': 'message_chunk',
            'data': {'chunk': chunk, 'session_id': session_id}
        })
        # Small sleep to simulate streaming
        time.sleep(0.1)
    
    # Mark as complete
    message_queues[session_id].put({
        'type': 'message_complete',
        'data': {'session_id': session_id}
    })
    
    return jsonify({'status': 'success'})

@app.route('/api/get_files', methods=['GET'])
def get_files():
    """Get all files and in-chat files"""
    logger = logging.getLogger(__name__)
    logger.debug("get_files endpoint called")
    
    try:
        session_id = request.args.get('session_id')
        logger.debug(f"Session ID received: {session_id}")
        
        if not session_id:
            logger.error("No session ID provided")
            return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
        
        logger.debug(f"Getting session for ID: {session_id}")
        session, error = get_or_create_session(session_id)
        
        if error:
            logger.error(f"Error getting session: {error}")
            return jsonify({'status': 'error', 'message': error}), 500
        
        if not session:
            logger.error(f"No session found for ID: {session_id}")
            return jsonify({'status': 'error', 'message': 'Session not found'}), 404
        
        logger.debug("Session retrieved successfully")
        coder = session['coder']
        
        try:
            all_files = coder.get_all_relative_files()
            inchat_files = coder.get_inchat_relative_files()
            logger.debug(f"Files retrieved - All: {all_files}, InChat: {inchat_files}")
            
            response = {
                'status': 'success',
                'all_files': all_files,
                'inchat_files': inchat_files
            }
            logger.debug(f"Returning response: {response}")
            
            return jsonify(response)
            
        except Exception as e:
            logger.error(f"Error getting files: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return jsonify({
                'status': 'error',
                'message': f'Error retrieving files: {str(e)}'
            }), 500
            
    except Exception as e:
        logger.error(f"Unexpected error in get_files: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': f'Unexpected error: {str(e)}'
        }), 500

@app.route('/api/add_files', methods=['POST'])
def add_files():
    """Add files to the chat"""
    data = request.json
    session_id = data.get('session_id')
    files = data.get('files', [])
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    added_files = []
    
    for fname in files:
        if fname not in coder.get_inchat_relative_files():
            coder.add_rel_fname(fname)
            added_files.append(fname)
            session['messages'].append({'role': 'info', 'content': f'Added {fname} to the chat'})
    
    return jsonify({
        'status': 'success',
        'added_files': added_files
    })

@app.route('/api/remove_files', methods=['POST'])
def remove_files():
    """Remove files from the chat"""
    data = request.json
    session_id = data.get('session_id')
    files = data.get('files', [])
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    removed_files = []
    
    for fname in files:
        if coder.drop_rel_fname(fname):
            removed_files.append(fname)
            session['messages'].append({'role': 'info', 'content': f'Removed {fname} from the chat'})
    
    return jsonify({
        'status': 'success',
        'removed_files': removed_files
    })

@app.route('/api/add_web_page', methods=['POST'])
def add_web_page():
    """Add web page content to chat"""
    data = request.json
    session_id = data.get('session_id')
    url = data.get('url')
    
    if not session_id or not url:
        return jsonify({'status': 'error', 'message': 'Session ID and URL are required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    content = AiderAPI.scrape_url(url)
    
    if content and content.strip():
        content = f"{url}\n\n{content}"
        session['messages'].append({'role': 'text', 'content': content})
        return jsonify({'status': 'success', 'content': content})
    else:
        return jsonify({'status': 'error', 'message': f'No web content found for {url}'}), 404

@app.route('/api/undo_commit', methods=['POST'])
def undo_commit():
    """Undo the last commit"""
    data = request.json
    session_id = data.get('session_id')
    commit_hash = data.get('commit_hash')
    
    if not session_id or not commit_hash:
        return jsonify({'status': 'error', 'message': 'Session ID and commit hash are required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    
    if session['last_aider_commit_hash'] != commit_hash or coder.last_aider_commit_hash != commit_hash:
        return jsonify({
            'status': 'error', 
            'message': f'Commit {commit_hash} is not the latest commit'
        }), 400
    
    coder.commands.io.get_captured_lines()
    reply = coder.commands.cmd_undo(None)
    lines = coder.commands.io.get_captured_lines()
    lines_text = "\n".join(lines)
    
    session['messages'].append({'role': 'info', 'content': lines_text})
    session['last_aider_commit_hash'] = None
    
    if reply:
        session['messages'].append({'role': 'assistant', 'content': reply})
    
    return jsonify({'status': 'success', 'message': lines_text})

@app.route('/api/clear_history', methods=['POST'])
def clear_history():
    """Clear chat history"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    coder.done_messages = []
    coder.cur_messages = []
    
    # Keep only the initial messages and add a new info message
    initial_messages = session['messages'][:2]  # Keep announcements and initial greeting
    session['messages'] = initial_messages
    session['messages'].append({
        'role': 'info', 
        'content': 'Cleared chat history. Now the LLM can\'t see anything before this line.'
    })
    
    return jsonify({'status': 'success'})

@app.route('/api/test_connection', methods=['GET'])
def test_connection():
    """Test endpoint for connection debugging"""
    logger = logging.getLogger(__name__)
    logger.debug("Test connection endpoint called")
    return jsonify({
        'status': 'success',
        'message': 'API is running and responding',
        'timestamp': time.time()
    })

@app.route('/api/generate_tasks_from_prd', methods=['POST'])
def generate_tasks_from_prd():
    """Generate tasks from a PRD document synchronously"""
    data = request.json
    session_id = data.get('session_id')
    prd_content = data.get('prd_content')
    num_tasks = data.get('num_tasks', 5)  # Default to 5 tasks if not specified
    
    if not session_id or not prd_content:
        return jsonify({'status': 'error', 'message': 'Session ID and PRD content are required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    try:
        # Process PRD synchronously
        result = process_prd_sync(session_id, prd_content, num_tasks)
        return jsonify({
            'status': 'success', 
            'message': 'PRD processing completed', 
            'tasks': result['tasks'],
            'metadata': result['metadata']
        })
    except Exception as e:
        print(f"Error processing PRD: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'status': 'error', 'message': f'Error processing PRD: {str(e)}'}), 500

def process_prd_sync(session_id, prd_content, num_tasks):
    """Process PRD and generate tasks with LLM - synchronous version"""
    try:
        # Check for required environment variables
        if not os.getenv('ANTHROPIC_API_KEY'):
            raise ValueError("Missing ANTHROPIC_API_KEY environment variable. Please add it to your .env file.")
        
        # Call LLM to generate tasks from PRD
        tasks = generate_tasks_from_prd_with_llm(session_id, prd_content, num_tasks)
        
        # Analyze complexity of tasks
        analyzed_tasks = analyze_task_complexity(tasks)
        
        # Generate subtasks for complex tasks
        total_complex_tasks = sum(1 for task in analyzed_tasks if task.get('complexityScore', 5) > 5)
        
        for task in analyzed_tasks:
            if task.get('complexityScore', 5) > 5:  # For tasks with complexity > 5
                # Generate subtasks
                try:
                    subtasks = generate_subtasks_for_task(session_id, task)
                    task['subtasks'] = subtasks
                except Exception as e:
                    print(f"Error generating subtasks for task {task['id']}: {str(e)}")
                    task['subtasks'] = []
                    task['subtask_error'] = str(e)
        
        # Prepare metadata
        metadata = {
            'projectName': 'PRD Implementation',
            'totalTasks': len(analyzed_tasks),
            'complexTasks': total_complex_tasks,
            'generatedAt': datetime.now().isoformat()
        }
        
        return {
            'tasks': analyzed_tasks,
            'metadata': metadata
        }
        
    except Exception as e:
        print(f"Error processing PRD: {str(e)}")
        print(traceback.format_exc())
        raise e

def generate_tasks_from_prd_with_llm(session_id, prd_content, num_tasks):
    """Generate tasks from PRD using LLM"""
    try:
        import anthropic  # Import at runtime to avoid dependency issues
        
        # Get API key from environment
        #api_key = os.getenv('ANTHROPIC_API_KEY')
        #if not api_key:
        #    raise ValueError("Anthropic API key not found in environment variables")
        api_key = "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"
        
        # Initialize Anthropic client
        client = anthropic.Anthropic(api_key=api_key)
        
        # Create system prompt based on claude-task-master
        system_prompt = f"""You are an AI assistant helping to break down a Product Requirements Document (PRD) into a set of sequential development tasks. 
Your goal is to create {num_tasks} well-structured, actionable development tasks based on the PRD provided.

Each task should follow this JSON structure:
{{
  "id": number,
  "title": string,
  "description": string,
  "status": "pending",
  "dependencies": number[] (IDs of tasks this depends on),
  "priority": "high" | "medium" | "low",
  "details": string (implementation details),
  "testStrategy": string (validation approach)
}}

Guidelines:
1. Create exactly {num_tasks} tasks, numbered from 1 to {num_tasks}
2. Each task should be atomic and focused on a single responsibility
3. Order tasks logically - consider dependencies and implementation sequence
4. Early tasks should focus on setup, core functionality first, then advanced features
5. Include clear validation/testing approach for each task
6. Set appropriate dependency IDs (a task can only depend on tasks with lower IDs)
7. Assign priority (high/medium/low) based on criticality and dependency order
8. Include detailed implementation guidance in the "details" field

Expected output format:
{{
  "tasks": [
    {{
      "id": 1,
      "title": "Setup Project Repository",
      "description": "...",
      ...
    }},
    ...
  ]
}}

Important: Your response must be valid JSON only, with no additional explanation or comments."""

        # Call Anthropic API
        try:
            response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=4000,
                temperature=0.2,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": f"Here's the Product Requirements Document (PRD) to break down into {num_tasks} tasks:\n\n{prd_content}"
                }]
            )
            
            # Extract and parse response
            response_text = response.content[0].text
            
            # Find and extract JSON
            json_start = response_text.find('{')
            json_end = response_text.rindex('}')
            json_content = response_text[json_start:json_end+1]
            
            tasks_data = json.loads(json_content)
            
            return tasks_data.get('tasks', [])
            
        except Exception as api_error:
            print(f"Anthropic API error: {str(api_error)}")
            print(f"API error details: {type(api_error).__name__}")
            raise ValueError(f"Failed to call Anthropic API: {str(api_error)}")
            
    except Exception as e:
        print(f"Error generating tasks from PRD: {str(e)}")
        print(traceback.format_exc())
        raise e

def analyze_task_complexity(tasks):
    """Analyze and score task complexity"""
    for task in tasks:
        # Calculate complexity score based on various factors
        complexity_factors = [
            len(task.get('dependencies', [])) * 1.5,  # More dependencies = more complex
            len(task.get('description', '').split()) * 0.1,  # Longer descriptions may indicate complexity
            3 if task.get('priority') == 'high' else 2 if task.get('priority') == 'medium' else 1,
            len(task.get('details', '').split()) * 0.05  # More implementation details may indicate complexity
        ]
        
        # Calculate weighted average complexity score
        complexity_score = min(10, sum(complexity_factors) / len(complexity_factors))
        task['complexityScore'] = round(complexity_score, 1)
    
    return tasks

def generate_subtasks_for_task(session_id, task):
    """Generate subtasks for a complex task using LLM"""
    try:
        import anthropic
        
        # Get API key from environment
        #api_key = os.getenv('ANTHROPIC_API_KEY')
        #if not api_key:
        #    raise ValueError("Anthropic API key not found in environment variables")
        api_key = "sk-ant-api03-2222222222222222222222222222222222222222222222222222222222222222"
        
        # Initialize Anthropic client
        client = anthropic.Anthropic(api_key=api_key)
        
        # Create system prompt for subtask generation
        system_prompt = """You are an AI assistant helping to break down a complex development task into smaller, manageable subtasks.
Each subtask should follow this JSON structure:
{
  "id": string (parent_task_id.subtask_number),
  "title": string,
  "description": string,
  "details": string (implementation guidance),
  "estimatedHours": number
}

Guidelines:
1. Break down the task into 3-5 subtasks
2. Each subtask should be clearly defined and independently testable
3. Include implementation guidance in the details field
4. Provide time estimates in hours
5. Ensure all aspects of the parent task are covered

Expected output format:
{
  "subtasks": [
    {
      "id": "task_id.1",
      "title": "First Subtask",
      ...
    },
    ...
  ]
}

Important: Your response must be valid JSON only, with no additional explanation or comments."""

        # Call Anthropic API
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=2000,
            temperature=0.2,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": f"Break down this complex task into subtasks:\n\nTask ID: {task['id']}\nTitle: {task['title']}\nDescription: {task['description']}\nImplementation Details: {task.get('details', 'No additional details provided')}"
            }]
        )
        
        # Extract and parse response
        response_text = response.content[0].text
        
        # Find and extract JSON
        json_start = response_text.find('{')
        json_end = response_text.rindex('}')
        json_content = response_text[json_start:json_end+1]
        
        subtasks_data = json.loads(json_content)
        
        return subtasks_data.get('subtasks', [])
        
    except Exception as e:
        print(f"Error generating subtasks: {str(e)}")
        print(traceback.format_exc())
        raise e

if __name__ == '__main__':
    print("=== Starting Aider API Server ===")
    print(f"Current working directory: {os.getcwd()}")
    
    # Check if we're in a git repo
    try:
        from git import Repo
        repo = Repo(os.getcwd(), search_parent_directories=True)
        print(f"Found git repository at: {repo.git_dir}")
    except Exception as e:
        print(f"Failed to find git repository: {e}")
        print("The API server must be run from within a git repository")
        sys.exit(1)
    
    # Note about using hardcoded API key
    print("NOTICE: Using hardcoded Anthropic API key for testing purposes")
    print("The API key is directly embedded in the code for the PRD analysis functionality")
    
    # Run the server
    print("Starting Flask server...")
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    ) 