https://owncare.onrender.com/

AI health insurance plan assistant compatible with 4,500+ insurance plans from 140+ insurance companies.
Designed to seamlessly allow users to better understand their healthcare plan.


## Prerequisites

Before setting up the project, make sure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **Python** (version 3.8 or higher)
- **pip** (Python package manager)


## Setup Instructions

### Supabase Setup
This is the longest part of the setup. You'll need to create a Supabase project and set up the database schema and functions.

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)
2. **Set up the database schema** using the table definitions in [`supabase-schema.csv`](./supabase-schema.csv)
3. **Add the custom functions** from [`supabase-functions.csv`](./supabase-functions.csv) to your project
4. **Disable Row Level Security (RLS)** on your tables (you should enable RLS later, but for ease of setup you should disable for now)
5. **Populate your insurance_companies and insurance_plans tables** with the data from [`insurance_companies_data.csv`](./insurance_companies_data.csv)
    and [`insurance_plans_data.csv`](./insurance_plans_data.csv)
6. **Get your project credentials** from Settings → API for the environment variables below

### Environment Variables

Before running the project, you'll need to set up environment variables for both frontend and backend.

#### Frontend Environment Variables
Create a `.env` file in the `frontend/` directory with:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL= http://localhost:3001
# Note the VITE_API_URL env variable must be changed to your backend URL when hosting
```

#### Backend Environment Variables
Create a `.env` file in the `backend/` directory with:
```env
OPENAI_API_KEY=your_openai_api_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_service_role_key
```


## Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```


## Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   *Note: Make sure you have Python 3.8+ installed on your system*

4. **Start the backend server:**
   ```bash
   npm start
   ```


## Technologies Used

### Frontend:
- **React** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling framework
- **Supabase** - Database and authentication

### Backend:
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Python** - For PDF processing
- **Docling** - PDF document conversion
- **OpenAI API** - AI embeddings and chat completions
- **Supabase** - Database and vector search