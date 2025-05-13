# Newrev

**Newrev** is a collaborative code editor powered by AI. It lets you edit any GitHub project by combining the power of large language models with your own development workflow. Built on top of [aider](https://github.com/paul-gauthier/aider), Newrev provides a seamless human-AI collaboration environment where you can edit, iterate, and ship production-ready code.

---

## 🚀 Features

* Edit any GitHub project collaboratively with AI
* Built on top of [aider](https://github.com/paul-gauthier/aider)
* Fast, local development setup
* AI-powered code suggestions and PR generation

---

## 🧰 Requirements

* [Node.js](https://nodejs.org/)
* [Python 3.10+](https://www.python.org/)
* An [Anthropic API key](https://www.anthropic.com/)

---

## 🛠️ Getting Started

Follow these steps to run Newrev locally.

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/newrev.git
cd newrev
```

---

### 2. Set up the backend

```bash
cd api
pip install -r requirements.txt
pip install -e ..  # Install aider in development mode
```

Then run the backend server:

```bash
python3 app.py --model sonnet --api-key anthropic=[your anthropic API key]
```

The backend will start on:
📍 `http://localhost:5000`

---

### 3. Set up the frontend

```bash
cd ../client
npm install
npm run dev
```

The frontend will be available at:
🌐 `http://localhost:3000`

---

### 4. Open a GitHub Project

* Open the main file of the GitHub repo you want to edit.
* Start editing collaboratively with AI.

---

## 📂 Project Structure

```
newrev/
├── api/        # Python backend (aider-based)
├── client/     # Frontend (Next.js + Node.js)
└── README.md   # You are here!
```

---



## 🙌 Contributing

We're just getting started. Contributions, ideas, and PRs are welcome! Feel free to [open an issue](https://github.com/andresuarezz26/newrev/issues) or suggest features.

---

