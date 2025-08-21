import sys
import json
from docling.document_converter import DocumentConverter
import re
import os
from uuid import uuid4
from openai import OpenAI
from supabase import create_client, Client
from concurrent.futures import ThreadPoolExecutor, as_completed


# Normalizes markdown by removing empty lines
#    - Removes extra blank lines
#    - Strips leading/trailing whitespace
#    - Collapses multiple blank lines to a single blank line
def normalize_markdown(md_text: str) -> str:
    lines = md_text.splitlines()
    normalized_lines = []

    for line in lines:
        stripped = line.strip()
        # Skip lines that are completely empty
        if not stripped:
            # Only append a blank line if the previous line wasn't blank
            if normalized_lines and normalized_lines[-1] != "":
                normalized_lines.append("")
            continue
        normalized_lines.append(stripped)

    return "\n".join(normalized_lines)


# Split markdown into chunks by headings, tables, and paragraphs while respecting max_chars per chunk.
#     - Consecutive table lines are grouped into one chunk.
#    - Headings start a new chunk.
def chunk_markdown(md_text, max_chars=1000):
    chunks = []
    current_chunk = ""
    table_buffer = []

    lines = md_text.splitlines()

    for line in lines:
        line_stripped = line.strip()

        if not line_stripped:
            continue

        # Handle table lines
        if line_stripped.startswith("|"):
            table_buffer.append(line_stripped)
            continue
        else:
            # Flush table buffer if table ended
            if table_buffer:
                table_chunk = "\n".join(table_buffer)
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                chunks.append(table_chunk)
                table_buffer = []

        # Start a new chunk at headings
        if re.match(r"^#+ ", line_stripped):
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""
        current_chunk += line_stripped + "\n"

        # Split chunk if too long
        if len(current_chunk) >= max_chars:
            chunks.append(current_chunk.strip())
            current_chunk = ""

    # Flush remaining table or chunk
    if table_buffer:
        chunks.append("\n".join(table_buffer))
    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks

# Thread function used below in embed_and_store
# Takes a chunk of text and generates embedding for the chunk
def embed_chunk(chunk, sob_url, openai_client):
    embedding = openai_client.embeddings.create(
        input=chunk,
        model="text-embedding-3-large"
    ).data[0].embedding

    return {
        "embedding_id": str(uuid4()),
        "content": chunk,
        "embedding": embedding,
        "sob_url": sob_url
    }

# Embed the PDF chunks into Supabase
def embed_and_store(chunks, sob_url: str):
    openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    # Connect to Supabase
    supabase_url = os.environ["VITE_SUPABASE_URL"]
    supabase_key = os.environ["VITE_SUPABASE_ANON_KEY"]  # service key for writes
    supabase: Client = create_client(supabase_url, supabase_key)

    rows = []
    # Use a ThreadPoolExecutor to run API calls concurrently
    with ThreadPoolExecutor(max_workers=5) as executor:  # adjust max_workers as needed
        futures = [executor.submit(embed_chunk, chunk, sob_url, openai_client) for chunk in chunks]
        for future in as_completed(futures):
            rows.append(future.result())

    # Batch insert into our table (e.g., 'insurance_docs')
    supabase.table("sob_embeddings").insert(rows).execute()

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        return

    pdf_path = sys.argv[1]
    conv = DocumentConverter()
    result = conv.convert(pdf_path)
    doc = result.document

    # 1. Convert result to markdown
    markdown_text = doc.export_to_markdown()
    # Normalize the markdown
    markdown_text = normalize_markdown(markdown_text)

    # 2. Chunk the markdown
    chunks = chunk_markdown(markdown_text, max_chars=1000)

    # 3. Store embeddings and insert into Supabase
    embed_and_store(chunks, pdf_path)

    # Ensure UTF-8 output so Node can read it
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps({"chunks": chunks}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
