#!/usr/bin/env python

import hashlib
import json
import os
import sys
import threading
import time
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit

# Add the parent directory to sys.path to be able to import aider modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from aider import urls
from aider.coders import Coder
from aider.dump import dump  # noqa: F401
from aider.io import InputOutput
from aider.main import main as cli_main
from aider.scrape import Scraper

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Store sessions by session_id
sessions = {}

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
        coder = cli_main(argv=args, return_coder=True)
        if not isinstance(coder, Coder):
            raise ValueError(coder)
        if not coder.repo:
            raise ValueError("API can currently only be used inside a git repo")

        io = AiderAPI.CaptureIO(
            pretty=False,
            yes=True,
            dry_run=coder.io.dry_run,
            encoding=coder.io.encoding,
        )
        # coder.io = io  # this breaks the input_history
        coder.commands.io = io

        # Force the coder to cooperate, regardless of cmd line args
        coder.yield_stream = True
        coder.stream = True
        coder.pretty = False

        return coder
    
    @staticmethod
    def get_announcements(coder):
        """Get announcements from coder"""
        return coder.get_announcements()
    
    @staticmethod
    def process_chat(coder, prompt, session_id):
        """Process a chat message and return response via socket.io"""
        def run_stream():
            for chunk in coder.run_stream(prompt):
                emit('message_chunk', {'chunk': chunk, 'session_id': session_id})
            
            emit('message_complete', {'session_id': session_id})
            
            # Check for edits
            if coder.aider_edited_files:
                emit('files_edited', {
                    'files': list(coder.aider_edited_files),
                    'session_id': session_id
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
                    
                    emit('commit', {
                        'hash': coder.last_aider_commit_hash,
                        'message': coder.last_aider_commit_message,
                        'diff': diff,
                        'session_id': session_id
                    })
                    
                    sessions[session_id]['last_aider_commit_hash'] = coder.last_aider_commit_hash
        
        threading.Thread(target=run_stream).start()
        return True

    @staticmethod
    def scrape_url(url):
        """Scrape content from a URL"""
        scraper = Scraper(print_error=lambda x: x)
        return scraper.scrape(url)

# Helper function to get a session or create if it doesn't exist
def get_or_create_session(session_id, create=True):
    """Get or create a session by ID"""
    if session_id not in sessions and create:
        try:
            coder = AiderAPI.initialize_coder()
            sessions[session_id] = {
                'coder': coder,
                'messages': [],
                'files': coder.get_inchat_relative_files(),
                'last_aider_commit_hash': coder.last_aider_commit_hash,
                'input_history': list(coder.io.get_input_history()),
                'created_at': time.time()
            }
            
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
            
        except Exception as e:
            return None, str(e)
    
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

@app.route('/api/get_files', methods=['GET'])
def get_files():
    """Get all files and in-chat files"""
    session_id = request.args.get('session_id')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    
    return jsonify({
        'status': 'success',
        'all_files': coder.get_all_relative_files(),
        'inchat_files': coder.get_inchat_relative_files()
    })

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

# PRD and Task Automation Endpoints
@app.route('/api/generate_prd', methods=['POST'])
def generate_prd():
    """Generate a PRD from a description"""
    data = request.json
    session_id = data.get('session_id')
    description = data.get('description')
    
    if not session_id or not description:
        return jsonify({'status': 'error', 'message': 'Session ID and description are required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    
    prompt = f"""Create a detailed Product Requirements Document for:
{description}

Include:
1. Overview
2. Objectives
3. Target users
4. Features and requirements
5. Technical specifications
6. Success metrics
"""
    
    # Add message to history
    session['messages'].append({'role': 'user', 'content': prompt})
    coder.io.add_to_input_history(prompt)
    
    # Create a response collector
    prd_content = []
    
    def collect_prd():
        for chunk in coder.run_stream(prompt):
            prd_content.append(chunk)
            emit('prd_chunk', {'chunk': chunk, 'session_id': session_id})
        
        emit('prd_complete', {
            'prd': ''.join(prd_content),
            'session_id': session_id
        })
        
        # Add to messages
        session['messages'].append({'role': 'assistant', 'content': ''.join(prd_content)})
    
    threading.Thread(target=collect_prd).start()
    
    return jsonify({'status': 'success'})

@app.route('/api/generate_tasks', methods=['POST'])
def generate_tasks():
    """Generate tasks from a PRD"""
    data = request.json
    session_id = data.get('session_id')
    prd = data.get('prd')
    
    if not session_id or not prd:
        return jsonify({'status': 'error', 'message': 'Session ID and PRD are required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    
    prompt = f"""Based on this PRD:
{prd}

Generate a list of implementation tasks and subtasks in JSON format:
{{
    "tasks": [
        {{
            "name": "Task name",
            "description": "Task description",
            "subtasks": [
                {{
                    "name": "Subtask name",
                    "description": "Subtask description"
                }}
            ]
        }}
    ]
}}
"""
    
    # Add message to history
    session['messages'].append({'role': 'user', 'content': prompt})
    coder.io.add_to_input_history(prompt)
    
    # Create a response collector
    tasks_content = []
    
    def collect_tasks():
        for chunk in coder.run_stream(prompt):
            tasks_content.append(chunk)
            emit('tasks_chunk', {'chunk': chunk, 'session_id': session_id})
        
        tasks_json = ''.join(tasks_content)
        try:
            # Try to parse as JSON
            tasks = json.loads(tasks_json)
            emit('tasks_complete', {
                'tasks': tasks,
                'session_id': session_id
            })
        except json.JSONDecodeError:
            # If not valid JSON, send as string
            emit('tasks_complete', {
                'tasks_text': tasks_json,
                'session_id': session_id
            })
        
        # Add to messages
        session['messages'].append({'role': 'assistant', 'content': tasks_json})
    
    threading.Thread(target=collect_tasks).start()
    
    return jsonify({'status': 'success'})

@app.route('/api/execute_tasks', methods=['POST'])
def execute_tasks():
    """Execute a list of tasks"""
    data = request.json
    session_id = data.get('session_id')
    tasks = data.get('tasks')
    
    if not session_id or not tasks:
        return jsonify({'status': 'error', 'message': 'Session ID and tasks are required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    
    # Store task execution results
    if 'task_results' not in session:
        session['task_results'] = []
    
    def execute_task(task, subtask=None):
        description = task["description"]
        if subtask:
            task_name = f"{task['name']} - {subtask['name']}"
            description += f" - {subtask['description']}"
        else:
            task_name = task['name']
        
        prompt = f"""
I need you to implement this task:
{description}

Please write or modify the necessary code to complete this task.
"""
        
        # Add task execution start message
        emit('task_started', {
            'task_name': task_name,
            'description': description,
            'session_id': session_id
        })
        
        # Execute the task
        response_content = []
        for chunk in coder.run_stream(prompt):
            response_content.append(chunk)
            emit('task_chunk', {
                'task_name': task_name,
                'chunk': chunk,
                'session_id': session_id
            })
        
        result = ''.join(response_content)
        
        # Check if files were edited
        edited_files = list(coder.aider_edited_files) if coder.aider_edited_files else []
        
        # Check if a commit was made
        commit_hash = coder.last_aider_commit_hash
        commit_message = coder.last_aider_commit_message if commit_hash else None
        
        # Create result object
        task_result = {
            'task_name': task_name,
            'description': description,
            'result': result,
            'edited_files': edited_files,
            'commit_hash': commit_hash,
            'commit_message': commit_message
        }
        
        # Add to session results
        session['task_results'].append(task_result)
        
        # Send completion event
        emit('task_completed', {
            'task_result': task_result,
            'session_id': session_id
        })
        
        return task_result
    
    def run_tasks():
        all_results = []
        
        emit('tasks_execution_started', {
            'num_tasks': len(tasks),
            'session_id': session_id
        })
        
        for task in tasks:
            if task.get("subtasks"):
                for subtask in task["subtasks"]:
                    result = execute_task(task, subtask)
                    all_results.append(result)
            else:
                result = execute_task(task)
                all_results.append(result)
        
        emit('tasks_execution_completed', {
            'results': all_results,
            'session_id': session_id
        })
    
    threading.Thread(target=run_tasks).start()
    
    return jsonify({'status': 'success'})

@app.route('/api/task_status', methods=['GET'])
def task_status():
    """Get the status of task execution"""
    session_id = request.args.get('session_id')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session, error = get_or_create_session(session_id, create=False)
    
    if not session:
        return jsonify({'status': 'error', 'message': 'Session not found'}), 404
    
    if 'task_results' in session:
        return jsonify({'status': 'success', 'results': session['task_results']})
    
    return jsonify({'status': 'in_progress'})

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True) 