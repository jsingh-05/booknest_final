import os
import json
import time
import math
import google.generativeai as genai
from PyPDF2 import PdfReader

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("⚠️ GEMINI_API_KEY environment variable is missing")


genai.configure(api_key=API_KEY)
MODEL_NAME = "gemini-2.5-flash-lite"  # fast + free

# --------------------- Utility extractors ---------------------
def extract_text_from_pdf(pdf_path):
    text = ""
    with open(pdf_path, "rb") as file:
        reader = PdfReader(file)
        for page in reader.pages:
            text += page.extract_text() or ""
    return text.strip()

def extract_text_from_txt(txt_path):
    with open(txt_path, "r", encoding="utf-8") as f:
        return f.read().strip()

# --------------------- Core summarizers ---------------------
def summarize_text(text):
    """For small/medium books (direct one-pass summary)."""
    model = genai.GenerativeModel(MODEL_NAME)
    prompt = (
        "You are a human-like, emotionally intelligent book summarizer. "
        "Summarize the following book text in one flowing paragraph. "
        "Focus on main characters, plot, tension, emotions, and suspense. "
        "Make it engaging and natural, like a thriller novel summary.\n\n"
        f"Text:\n{text}"
    )
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"[Failed to generate summary: {str(e)}]"

def _call_model(prompt, retries=3, wait=10):
    """Retry-safe Gemini call with auto-pause for free-tier quota."""
    model = genai.GenerativeModel(MODEL_NAME)
    for attempt in range(retries):
        try:
            resp = model.generate_content(prompt)
            return resp.text.strip()
        except Exception as e:
            msg = str(e)
            if "429" in msg:
                delay = wait * (attempt + 1)
                print(f"⚠️ Quota limit reached — waiting {delay}s before retry...")
                time.sleep(delay)
            else:
                if attempt == retries - 1:
                    return f"[Failed after {retries} attempts: {msg}]"
                time.sleep(3)
    return "[Failed to generate response]"

def chunk_text(text, chunk_size=20000, overlap=500):
    for i in range(0, len(text), chunk_size - overlap):
        yield text[i:i + chunk_size]

def summarize_large_book(text):
    """Chunk-based summarization for large books, auto-throttled."""
    print("📗 Large book detected — summarizing in manageable chunks...")
    chunks = list(chunk_text(text))
    partial_summaries = []

    for i, chunk in enumerate(chunks, 1):
        print(f"➡️ Summarizing chunk {i}/{len(chunks)}...")
        prompt = (
            "Summarize this portion of a thriller novel briefly (2–3 sentences) "
            "capturing key events, mood, and characters. "
            "Keep it natural, smooth, and suspenseful:\n\n"
            f"{chunk}"
        )
        summary = _call_model(prompt)
        partial_summaries.append(summary)

        # 🔸 Auto-pause to respect free-tier quota
        if i % 10 == 0:
            print("⏸️ Taking short break to avoid hitting rate limit...")
            time.sleep(45)

    print("\n✅ Combining chunk summaries into final summary...")
    combined_prompt = (
        "Combine these short summaries into one coherent, flowing paragraph "
        "like a professional book synopsis. Focus on main story arcs, tone, and suspense.\n\n"
        f"Chunk summaries:\n{'\n'.join(partial_summaries)}"
    )
    return _call_model(combined_prompt)

# --------------------- Smart selector ---------------------
def summarize_book(text):
    word_count = len(text.split())
    if word_count <= 60000:
        print("📘 Small/medium book detected — summarizing directly...")
        return summarize_text(text)
    else:
        return summarize_large_book(text)

# --------------------- CLI ---------------------
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python summarizer.py <file_path>")
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    if file_path.lower().endswith(".pdf"):
        text = extract_text_from_pdf(file_path)
    elif file_path.lower().endswith(".txt"):
        text = extract_text_from_txt(file_path)
    else:
        raise ValueError("Unsupported file type. Only PDF and TXT supported.")

    summary = summarize_book(text)
    print("\n==== Summary ====\n")
    print(summary)


