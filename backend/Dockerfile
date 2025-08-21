# Use official Node.js LTS image
FROM node:20

# Install Python, venv, and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create a symbolic link for python command
RUN ln -s /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first for better Docker layer caching
COPY package*.json ./

# Install Node.js dependencies using npm ci for production builds
RUN npm ci --production

# Copy Python requirements
COPY requirements.txt ./

# Create Python virtual environment and use it
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and install Python dependencies inside the virtual environment
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code
COPY . .

# Create uploads directory with proper permissions
RUN mkdir -p uploads && chmod 755 uploads

# Use dynamic port assignment for Cloud Run compatibility
ENV PORT=${PORT:-8080}
EXPOSE $PORT

# Start the server
CMD ["npm", "start"]

