import express from 'express';
import { spawn } from 'child_process';  // node.js module to run python script
import cors from 'cors';  // node.js module for listening on different ports
import dotenv from 'dotenv';
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize supabase
const supabase = createClient( 
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const app = express();  // Initialize express for routes

app.use(express.json());

// Temporary: allow all origins
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});


// ------------------- ROUTES -------------------  //
// ROUTE 1: Runs a pdf URL into docling_runner.py script to return as markdown
app.post('/api/extract-pdf', (req, res) => {
  console.log("PDF parsing + chunking route successfully called")
  
  // 1. Get the PDF URL from request body
  const { pdfUrl } = req.body;
  
  if (!pdfUrl) {
    return res.status(400).json({ success: false, error: 'PDF URL is required' });
  }

  console.log("Now processing PDF URL:", pdfUrl);
  const startTime = Date.now(); // measuring when docling python script started running

  // 2. Start a Python process to run "docling_runner.py" with the PDF URL as an argument
  const python = spawn('python', ['docling_runner.py', pdfUrl],{
      env: {
        ...process.env,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY
      }
    });
  console.log("Docling python process sucessfully started");

  let data = '';
  let error = '';

  // When Python script writes data to stdout, append it to 'data'
  python.stdout.on('data', (chunk) => {
    data += chunk.toString();
  });

  // When Python script writes data to stderr, append it to 'error'
  python.stderr.on('data', (chunk) => {
    error += chunk.toString();
  });

  // 3. Once python script finishes running
  python.on('close', (code) => {
    const endTime = Date.now(); // measure when docling python script finishes running
    console.log('Python exited with code:', code);
    // console.log('Python stdout:', data);
    console.log('Python stderr:', error);

    // Log memory usage (see how much RAM the PDF file processing used)
    const mem = process.memoryUsage();
    const rssMB = (mem.rss / 1024 / 1024).toFixed(2);
    console.log(`Total PDF parsing + chunking RAM Usage (MB): ${rssMB}`);

    // Log route's runtime duration
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`Total PDF parsing + chunking runtime: ${durationSeconds} seconds`);


    if (code !== 0) {
      return res.status(500).json({ success: false, error });
    }
    try {
      // Try to parse Python's stdout as JSON and send it back to the client
      res.json(JSON.parse(data));
    } catch (err) {
      res.status(500).json({ success: false, error: 'Invalid JSON from Python' });
    }
  });
});


// ROUTE 2: Returns topK matching PDF chunks given a user query
app.post('/api/semantic-search', async (req, res) => {
  console.log("Semantic search route successfully called");

  const { query, topK = 10, sob_url } = req.body; // add sobUrl

  if (!query || !sob_url) {
    return res.status(400).json({ success: false, error: 'Query and sobUrl are required' });
  }

  try {
    // 1. Embed the user query
    const openai_client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const queryEmbedding = (await openai_client.embeddings.create({
      input: query,
      model: 'text-embedding-3-large',
    })).data[0].embedding;

    // 2. Query Supabase embeddings table using vector similarity
    // You need to update your RPC to also filter by sob_url
    const { data: chunks, error } = await supabase.rpc('match_embeddings', {
      query_embedding: queryEmbedding,
      match_count: topK,
      target_sob_url: sob_url,
    });

    if (error) throw error;

    console.log(
      "Chunks returned from Supabase RPC:\n" +
      chunks
        .map((chunk, idx) => `\x1b[1mChunk ${idx + 1}:\x1b[0m\n${chunk.content}`)
        .join('\n\n')
    );

    res.json({ chunks });
  } catch (err) {
    console.error("Error in semantic search:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ROUTE 3: Generate AI response given PDF chunks as context
app.post("/api/RAGresponse", async (req, res) => {
  try {
    console.log("RAGresponse route successfully called")
    const { contextText, userQuestion } = req.body;

    if (!contextText || !userQuestion) {
      return res.status(400).json({ error: "Both contextText and userQuestion are required" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
            You are an insurance assistant. Your primary goal is to answer the user's questions using the provided insurance plan excerpts (the context). 
            - Use the context whenever possible. 
            - If the context doesn't fully answer the question, provide helpful guidance or general knowledge, 
              but clearly indicate that the information is not directly from the user's current insurance plan's documents. 
            - Be concise, clear, and professional.
            `
          },
          {
            role: "user",
            content: `Context:\n${contextText}\n\nUser Question: ${userQuestion}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error generating LLM response:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log(`Server listening on port ${process.env.PORT || 3001}`);
});
