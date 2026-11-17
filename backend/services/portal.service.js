// ---------------------------------------------------------------------------
// Portal service — the server-side rules of the student portal economy.
//
// Quiz questions, task rewards and store prices live HERE, not in the client.
// The frontend displays them, but grading, rewards and prices are decided by
// the backend so nothing can be earned or redeemed by editing the client code.
// ---------------------------------------------------------------------------

export const QUIZ_COIN_REWARD = 10;
export const TASK_COIN_REWARD = 5;

// Tasks completed via their dedicated checkbox/button (task2 is earned by
// writing a real journal entry instead — see journal endpoint).
export const DIRECT_TASK_IDS = ['task1', 'task3'];

export const weeklyQuiz = {
  title: "This week's focus quiz",
  questions: [
    {
      id: 1,
      question: 'Which of the following is a transferable skill valued across almost every career?',
      options: [
        'Knowing a specific programming language',
        'Clear written and verbal communication',
        'Having a postgraduate degree',
        'Experience in a single industry',
      ],
      answer: 1,
    },
    {
      id: 2,
      question: 'When building a career plan, the most important starting point is usually:',
      options: [
        'Choosing the highest-paying field',
        'Following what your friends are doing',
        'Understanding your own strengths, interests, and values',
        'Picking the most prestigious college available',
      ],
      answer: 2,
    },
    {
      id: 3,
      question: 'Which habit is most associated with long-term learning and career growth?',
      options: [
        'Memorising information before exams',
        'Avoiding feedback to protect your confidence',
        "Reflecting on what you've learned and how to apply it",
        'Waiting for opportunities to come to you',
      ],
      answer: 2,
    },
  ],
};

export function gradeQuiz(answers) {
  let score = 0;
  weeklyQuiz.questions.forEach((q, i) => {
    if (answers[i] === q.answer) score += 1;
  });
  return { score, total: weeklyQuiz.questions.length };
}

export const storeItems = {
  library: { id: 'library', title: 'Library Book Date Extension', cost: 20 },
  ebook: { id: 'ebook', title: 'eBook Discount Voucher', cost: 15 },
  mentorship: { id: 'mentorship', title: 'Alumni Mentorship Session', cost: 50 },
};

export function makeVoucherCode(itemId, userId) {
  const prefixes = { library: 'LN-LIB', ebook: 'LN-EBK30', mentorship: 'LN-ALUMNI' };
  const suffix = userId.replace(/\W/g, '').slice(0, 6).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefixes[itemId] || 'LN-REWARD'}-${suffix}-${rand}`;
}
