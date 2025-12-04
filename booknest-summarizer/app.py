from flask import Flask, request, jsonify, send_from_directory
import os
import pdfplumber
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from concurrent.futures import ThreadPoolExecutor
from deep_translator import GoogleTranslator
from summarizer import summarize_book, extract_text_from_pdf as sum_extract_pdf, extract_text_from_txt as sum_extract_txt

app = Flask(__name__, static_folder="../frontend/public", static_url_path="")

MAX_CHUNK = 7000
MAX_WORKERS = 8

def chunk_text(text, max_chunk=MAX_CHUNK):
    chunks, current = [], ""
    for line in text.split("\n"):
        if len(current) + len(line) > max_chunk:
            chunks.append(current)
            current = ""
        current += line + "\n"
    if current:
        chunks.append(current)
    return chunks

def translate_chunk(chunk, target_language):
    try:
        return GoogleTranslator(source='auto', target=target_language).translate(chunk)
    except Exception as e:
        return f"[Translation error: {e}]"

def translate_page(text, target_language):
    if not text.strip():
        return "[Blank page]\n"
    chunks = chunk_text(text)
    return "\n".join([translate_chunk(c, target_language) for c in chunks])

def extract_text_from_pdf(pdf_path):
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return pages

def create_translated_pdf(translated_pages, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    for page_text in translated_pages:
        text_obj = c.beginText(50, height - 50)
        text_obj.setFont("Helvetica", 12)
        for line in page_text.split("\n"):
            text_obj.textLine(line)
            if text_obj.getY() < 50:
                c.drawText(text_obj)
                c.showPage()
                text_obj = c.beginText(50, height - 50)
                text_obj.setFont("Helvetica", 12)
        c.drawText(text_obj)
        c.showPage()
    c.save()

# Serve frontend
@app.route('/')
def serve_index():
    return app.send_static_file("index.html")

@app.route('/translate', methods=['POST'])
def translate_pdf():
    file = request.files.get('file')
    target_language = request.form.get('language', 'en')

    if not file:
        return jsonify({'success': False, 'message': 'No file uploaded'}), 400

    os.makedirs("uploads", exist_ok=True)
    os.makedirs("translated_books", exist_ok=True)
    pdf_path = os.path.join("uploads", file.filename)
    file.save(pdf_path)

    pages = extract_text_from_pdf(pdf_path)
    translated_pages = [None] * len(pages)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(translate_page, pages[i], target_language): i for i in range(len(pages))}
        for future in futures:
            idx = futures[future]
            translated_pages[idx] = future.result()

    output_file_name = f"translated_{file.filename}"
    output_file_path = os.path.join("translated_books", output_file_name)
    create_translated_pdf(translated_pages, output_file_path)

    return jsonify({
        'success': True,
        'translated_pdf': f"/download/{output_file_name}"
    })

@app.route('/summarize', methods=['POST'])
def summarize():
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()
    if not text and 'file' in request.files:
        f = request.files['file']
        os.makedirs("uploads", exist_ok=True)
        path = os.path.join("uploads", f.filename)
        f.save(path)
        if path.lower().endswith('.pdf'):
            pages = sum_extract_pdf(path)
            text = "\n".join(pages)
        elif path.lower().endswith('.txt'):
            text = sum_extract_txt(path)
    if not text:
        return jsonify({ 'summary': '' })
    summary = summarize_book(text)
    return jsonify({ 'summary': summary })

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory("translated_books", filename, as_attachment=True)

if __name__ == "__main__":
    port = int(os.getenv("SUMMARIZER_PORT", 5003))
    app.run(debug=True, port=port)

