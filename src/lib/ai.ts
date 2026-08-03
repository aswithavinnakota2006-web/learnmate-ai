import type { ScheduleItem, QuizQuestion } from '@/lib/supabase';

export type GeneratedPlan = {
  schedule: ScheduleItem[];
  tasks: { title: string; description: string; priority: string; estimated_minutes: number }[];
};

export function generateStudyPlan(
  subject: string,
  topic: string,
  difficulty: string,
  examDate: string | null,
  hoursPerWeek: number
): GeneratedPlan {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const topics = topic
    ? topic.split(',').map((t) => t.trim()).filter(Boolean)
    : [`Fundamentals of ${subject}`, `Core Concepts in ${subject}`, `Advanced ${subject}`, `Practice & Review`];

  const perDay = Math.max(30, Math.round((hoursPerWeek * 60) / 7));
  const schedule: ScheduleItem[] = days.map((day, i) => ({
    day,
    topic: topics[i % topics.length] || `Review Session ${i + 1}`,
    duration: perDay,
    resources: [`Textbook chapter on ${topics[i % topics.length] || subject}`, 'Practice problems', 'Video lecture'],
  }));

  const tasks = [
    { title: `Read: ${topics[0] || subject + ' fundamentals'}`, description: `Study the foundational concepts of ${topics[0] || subject}.`, priority: 'high', estimated_minutes: perDay },
    { title: `Practice problems: ${topics[1] || subject}`, description: `Work through practice problems to reinforce learning.`, priority: 'high', estimated_minutes: perDay },
    { title: `Review notes: ${topics[2] || subject}`, description: `Consolidate notes and create summary cards.`, priority: 'medium', estimated_minutes: Math.round(perDay * 0.7) },
    { title: `Mock test: ${subject}`, description: `Take a practice test under timed conditions.`, priority: 'high', estimated_minutes: perDay * 2 },
    { title: `Weak area review`, description: `Identify and review areas that need improvement.`, priority: 'medium', estimated_minutes: perDay },
  ];

  if (examDate) {
    tasks.push({
      title: `Final review before exam on ${examDate}`,
      description: `Comprehensive review of all topics in preparation for the exam.`,
      priority: 'high',
      estimated_minutes: perDay * 2,
    });
  }

  return { schedule, tasks };
}

export function generateNotes(subject: string, topic: string, detail: string): { title: string; content: string; summary: string; tags: string[] } {
  const t = topic || subject;
  const sections = [
    {
      heading: `Introduction to ${t}`,
      body: `${t} is a key area within ${subject}. Understanding its core principles provides a foundation for more advanced study. This section covers the essential definitions and context you need.`,
    },
    {
      heading: 'Key Concepts',
      body: `The central ideas in ${t} include its fundamental principles, common patterns, and the relationships between its components. Mastery of these concepts allows you to reason about ${t} systematically and apply knowledge to new problems.`,
    },
    {
      heading: 'Important Formulas & Definitions',
      body: `Core definitions in ${t} form the building blocks of the subject. Make sure to memorize key terms and understand how they relate. Practice deriving results from first principles to deepen understanding.`,
    },
    {
      heading: 'Common Mistakes to Avoid',
      body: `Students often confuse related concepts in ${t} or skip foundational steps. Always verify your assumptions and check your work. A common pitfall is applying formulas without understanding their conditions of validity.`,
    },
    {
      heading: 'Practice Tips',
      body: `To master ${t}, work through progressively harder problems. Start with basic exercises, then move to applied scenarios. Review mistakes carefully — they reveal gaps in understanding.`,
    },
  ];

  const content = sections
    .map((s) => `## ${s.heading}\n\n${s.body}`)
    .join('\n\n');

  const summary = `${t} covers essential ${subject} concepts including key definitions, formulas, and common pitfalls. Focus on understanding fundamentals, practicing progressively harder problems, and reviewing mistakes. This ${detail}-level overview provides a structured path to mastery.`;

  const tags = [subject, t, detail, 'study', 'notes'].filter(Boolean);

  return { title: `${t} — ${subject} Notes`, content, summary, tags };
}

export function generateQuiz(subject: string, topic: string, difficulty: string, count: number): { title: string; questions: Omit<QuizQuestion, 'id' | 'quiz_id' | 'created_at'>[] } {
  const t = topic || subject;
  const bank: Omit<QuizQuestion, 'id' | 'quiz_id' | 'created_at'>[] = [
    {
      question_text: `What is the primary focus of ${t}?`,
      options: ['Memorizing formulas', 'Understanding core principles and their applications', 'Reading textbooks', 'Watching lectures'],
      correct_index: 1,
      explanation: `${t} centers on understanding principles and applying them, not just memorization.`,
    },
    {
      question_text: `Which approach is most effective for learning ${t}?`,
      options: ['Cramming the night before', 'Consistent practice with progressively harder problems', 'Only reading notes', 'Skipping fundamentals'],
      correct_index: 1,
      explanation: 'Spaced, progressive practice leads to deeper retention and understanding.',
    },
    {
      question_text: `What is a common mistake when studying ${t}?`,
      options: ['Practicing too much', 'Applying formulas without understanding their conditions', 'Reviewing notes', 'Asking questions'],
      correct_index: 1,
      explanation: 'Applying formulas without understanding when they apply leads to errors.',
    },
    {
      question_text: `In ${subject}, ${t} is best described as:`,
      options: ['An isolated topic with no prerequisites', 'A foundational area connecting to broader concepts', 'Only relevant for exams', 'Not worth studying deeply'],
      correct_index: 1,
      explanation: `${t} connects to many broader ${subject} concepts, making it foundational.`,
    },
    {
      question_text: `What should you do after getting a ${t} problem wrong?`,
      options: ['Move on immediately', 'Review the solution and understand the mistake', 'Give up', 'Memorize the answer'],
      correct_index: 1,
      explanation: 'Analyzing mistakes reveals gaps and prevents repeating them.',
    },
    {
      question_text: `Which study method reinforces ${t} understanding most effectively?`,
      options: ['Passive reading', 'Active recall and self-testing', 'Highlighting notes', 'Listening to music'],
      correct_index: 1,
      explanation: 'Active recall strengthens memory pathways more than passive review.',
    },
    {
      question_text: `For ${difficulty}-level ${t}, what is recommended?`,
      options: ['Skip the basics', 'Build on fundamentals with complex applications', 'Only memorize', 'Avoid practice problems'],
      correct_index: 1,
      explanation: `${difficulty[0].toUpperCase() + difficulty.slice(1)} study builds on fundamentals with harder applications.`,
    },
    {
      question_text: `What role do practice problems play in mastering ${t}?`,
      options: ['Minimal role', 'Essential for applying and testing knowledge', 'Only for grading', 'Optional if you read enough'],
      correct_index: 1,
      explanation: 'Practice problems bridge the gap between theory and application.',
    },
    {
      question_text: `How should you structure study sessions for ${t}?`,
      options: ['One long session', 'Short focused sessions with breaks', 'Only study when stressed', 'Random timing'],
      correct_index: 1,
      explanation: 'Short focused sessions with breaks (Pomodoro) maintain concentration and retention.',
    },
    {
      question_text: `What indicates you have mastered ${t}?`,
      options: ['You can recite definitions', 'You can solve novel problems and explain concepts to others', 'You finished the textbook', 'You got one good grade'],
      correct_index: 1,
      explanation: 'True mastery shows in applying knowledge to new problems and teaching others.',
    },
  ];

  const selected = bank.slice(0, Math.min(count, bank.length));

  return {
    title: `${t} Quiz — ${subject}`,
    questions: selected,
  };
}

export function generateTutorResponse(userMessage: string, subject: string): string {
  const msg = userMessage.toLowerCase();
  const subj = subject || 'your subject';

  if (msg.includes('explain') || msg.includes('what is') || msg.includes('define')) {
    return `Great question! Let me break this down for you.\n\nIn ${subj}, the concept you're asking about has a few key parts:\n\n1. **Definition**: The core idea is about understanding the fundamental principle and why it matters.\n\n2. **How it works**: Think of it as a system where each component plays a specific role. When you understand the roles, the whole picture becomes clear.\n\n3. **Example**: Imagine you're applying this to a real scenario — the theory gives you a framework to analyze the situation and predict outcomes.\n\nWould you like me to go deeper into any part, or would you like a practice question to test your understanding?`;
  }

  if (msg.includes('help') || msg.includes('stuck') || msg.includes('confused')) {
    return `I'm here to help! Let's work through this together.\n\nFirst, let's identify what's giving you trouble:\n\n- Is it a specific concept that's unclear?\n- A problem you can't solve?\n- Or connecting ideas together?\n\nTry breaking the problem into smaller pieces. Start with what you know and build from there. Sometimes drawing a diagram or writing out what you DO understand reveals the gap.\n\nWhat specific part can I help clarify?`;
  }

  if (msg.includes('practice') || msg.includes('quiz') || msg.includes('test')) {
    return `Excellent initiative! Active practice is the best way to learn.\n\nHere's a practice question for you:\n\n**Question**: Explain the most important concept in ${subj} and give an example of how it applies.\n\nTake your time thinking through it. When you're ready, share your answer and I'll give you feedback. Or, if you'd prefer, I can generate a full quiz for you in the Quiz Generator section!`;
  }

  if (msg.includes('study') && (msg.includes('plan') || msg.includes('schedule'))) {
    return `A study plan is a powerful tool! Here's what I'd recommend:\n\n1. **Set a goal**: What do you want to achieve and by when?\n2. **Break it down**: Divide your subject into topics and allocate time to each.\n3. **Practice daily**: Short, consistent sessions beat long cramming sessions.\n4. **Review regularly**: Revisit older topics to reinforce memory.\n\nYou can use the Study Planner feature to generate a personalized plan — just enter your subject, topics, and exam date!`;
  }

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `Hello! I'm your AI tutor for ${subj}. I'm here to help you understand concepts, work through problems, and guide your study sessions.\n\nWhat would you like to work on today? You can ask me to:\n- Explain a concept\n- Help with a problem you're stuck on\n- Give you a practice question\n- Suggest a study strategy`;
  }

  return `That's an interesting point about ${subj}! Let me help you think through it.\n\nHere's how I'd approach this:\n\n1. **Identify the key idea**: What is the core concept at play here?\n2. **Connect to what you know**: How does this relate to other topics you've studied?\n3. **Apply it**: Can you think of an example or work through a problem?\n\nIf you can share more details about what specifically you'd like to understand, I can give you a more targeted explanation. What part would you like me to focus on?`;
}
