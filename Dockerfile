# Use Python 3.13 slim
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install only essential dependencies
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    numpy \
    pandas \
    scikit-learn \
    pydantic

# Copy app
COPY app/ ./app/
COPY data/ ./data/

# Expose port
EXPOSE 8000

# Start server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]