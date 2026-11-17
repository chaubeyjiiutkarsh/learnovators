// ---------------------------------------------------------------------------
// Advisor service — the "AI Career Advisor" chat engine.
//
// This is a rule-based advisor: it inspects the student's real profile
// (interest scores, stream, marks, mindset soft labels) and composes a
// personalised answer from keyword-matched templates. Moving it to the
// backend means every reply is grounded in the stored profile — and the
// conversation logic can be upgraded (e.g. to a real LLM API) without
// touching the frontend.
// ---------------------------------------------------------------------------

import { toSoftLabel } from './scoring.service.js';

export function generateAdvisorReply(message, user) {
  const q = (message || '').toLowerCase();

  const topInterest = getTopInterest(user);
  const stream = user.academic_stream || 'General';
  const marks = user.academic_marks || '75';
  const resilienceLabel = toSoftLabel(safeScores(user.mindset_scores).resilience ?? 2);
  const focusLabel = toSoftLabel(safeScores(user.mindset_scores).focus ?? 2);

  if (q.includes('project') || q.includes('portfolio') || q.includes('build')) {
    if (topInterest === 'technical' || stream === 'Engineering' || stream === 'Science') {
      return `Given your ${topInterest} focus and ${stream} background, recruiters value end-to-end working systems over textbook code. Consider building: 1) A full-stack application addressing a campus or community problem (e.g. peer note exchange or lab equipment booking); 2) An automated data pipeline or API with live documentation on GitHub. With your ${focusLabel.toLowerCase()} focus, setting aside two 90-minute building blocks per week will help you complete a capstone in 6 weeks.`;
    }
    if (topInterest === 'creative' || stream === 'Arts') {
      return `For your creative profile, portfolios should highlight your *thinking process* as much as visual polish. Document 2 in-depth case studies where you show: the original problem, user interviews, rough sketches, failed drafts, and the final solution. This proves your design reasoning to prospective employers.`;
    }
    return `Build projects that demonstrate practical application. With your ${topInterest} orientation, create a comprehensive case study, community initiative, or research presentation with measurable before-and-after impact metrics.`;
  }

  if (q.includes('internship') || q.includes('job') || q.includes('hire')) {
    return `For a student in ${stream} with a ${marks}% academic benchmark, here is the high-yield internship strategy: 1) Don't solely rely on cold applications on mega-portals. Target growing Series A/B startups where founders and engineering/product leads read concise, personalized LinkedIn notes; 2) Include a 2-sentence summary of your ${topInterest} skill strengths and link 1 tangible project; 3) Your mindset check shows ${resilienceLabel.toLowerCase()} resilience — remember that 10 polite rejections are normal before the right offer lands.`;
  }

  if (q.includes('exam') || q.includes('balance') || q.includes('schedule') || q.includes('time')) {
    return `Balancing curricular exams (${stream}) with external career preparation requires cognitive compartmentalization: Use the "80/20 Rule": Dedicate weekdays strictly to your coursework and college assignments so your ${marks}% foundation stays solid. Reserve Saturday mornings (2.5 hours) exclusively for your career roadmap projects or certifications. Your ${focusLabel.toLowerCase()} focus label suggests that time-boxing without notification distractions will yield the highest retention.`;
  }

  if (q.includes('certif') || q.includes('course')) {
    return `Certifications carry the most weight when combined with public proof-of-work. For ${stream} and a ${topInterest} trajectory, prioritize: 1) Google or AWS Foundational/Associate credentials via Coursera financial aid; 2) FreeCodeCamp or Harvard CS50/OpenCourseWare if you want deep conceptual grounding; 3) Always attach a mini GitHub repo or LinkedIn case breakdown for every certificate you earn.`;
  }

  return `That's a thoughtful question. Looking at your ${topInterest} orientation, ${stream} background, and ${marks}% score, you have strong raw ingredients. Because your mindset assessment reflects ${resilienceLabel.toLowerCase()} resilience and ${focusLabel.toLowerCase()} focus, your best move is taking consistent micro-actions rather than stressing over a 10-year master plan. Would you like me to suggest specific weekly milestones for this semester?`;
}

function getTopInterest(user) {
  const scores = safeScores(user.interest_scores);
  if (!scores || Object.values(scores).every((v) => v === 0)) return 'technical';
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function safeScores(json) {
  try {
    return JSON.parse(json || '{}');
  } catch {
    return {};
  }
}
