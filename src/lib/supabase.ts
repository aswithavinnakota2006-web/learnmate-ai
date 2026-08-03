import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string;
  learning_goal: string;
  preferred_subjects: string[];
  created_at: string;
  updated_at: string;
};

export type StudyPlan = {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  exam_date: string | null;
  difficulty: string;
  schedule: ScheduleItem[];
  created_at: string;
  updated_at: string;
};

export type ScheduleItem = {
  day: string;
  topic: string;
  duration: number;
  resources: string[];
};

export type Task = {
  id: string;
  user_id: string;
  plan_id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  estimated_minutes: number;
  created_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  topic: string;
  content: string;
  summary: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type Quiz = {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  created_at: string;
};

export type QuizQuestion = {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  created_at: string;
};

export type ChatSession = {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
};

export type StudyProgress = {
  id: string;
  user_id: string;
  date: string;
  minutes_studied: number;
  tasks_completed: number;
};
