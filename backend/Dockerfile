FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App kodi
COPY app.py .

# Modellarni build paytida yuklab olish (HuggingFace public repo)
RUN python -c "\
from huggingface_hub import hf_hub_download; \
import os; \
os.makedirs('models', exist_ok=True); \
files = [ \
    'uz_v8_tagger.pt', 'uz_v8_lemmatizer.pt', 'uz_v8_parser.pt', \
    'uz_custom_nocharlm_tagger.pt', 'uz_custom_nocharlm_lemmatizer.pt', 'uz_custom_nocharlm_parser.pt', \
    'uz_fasttext.pt' \
]; \
[hf_hub_download('Azizwebdev/uzbek-dependency-parser', f, local_dir='models') for f in files]; \
print('All models downloaded.')"

# HuggingFace Spaces default port: 7860
EXPOSE 7860

CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
