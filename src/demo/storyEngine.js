export const STORY_TIME_ZONE = "America/Chicago";
export const STORY_ANCHOR_DATE = "2026-05-22";
export const STORY_WEEK_COUNT = 50;

export function localCalendarDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const STORY_REACTION_TYPES = Object.freeze([
  { id: "book", label: "Worth reading", symbol: "📖" },
  { id: "brain", label: "Made me think", symbol: "🧠" },
  { id: "idea", label: "Good idea", symbol: "💡" },
]);

export const STORY_MEDIA_LIMITS = Object.freeze({
  free: { imagesPerWeek: 2, videosPerWeek: 1 },
  expanded: { imagesPerWeek: null, videosPerWeek: null },
});

export const STORY_GUIDES = Object.freeze({
  student: {
    id: "student",
    shortName: "Brooke",
    name: "Brooke Mercer",
    role: "University student",
    image: "/demo-media/brooke-portrait.png",
    network: "university",
    firstFollower: true,
    followsNewAccounts: true,
  },
  k12: {
    id: "k12",
    shortName: "Jaylen",
    name: "Jaylen Carter",
    role: "High school student",
    image: "/demo-media/jaylen-portrait.png",
    network: "k12",
    firstFollower: true,
    followsNewAccounts: true,
  },
  professor: {
    id: "professor",
    shortName: "Atlas",
    name: "Atlas Reed",
    role: "Professor",
    image: "/demo-media/atlas-portrait.png",
    network: "university",
    firstFollower: true,
    followsNewAccounts: true,
  },
});

export const STORY_AUDIENCE_RULES = Object.freeze({
  student: {
    network: "university",
    defaultAudience: "campus",
    availableAudiences: ["campus", "class", "connections", "public"],
    feedTabs: ["campus", "classes", "connections"],
    facultyOnlyVisible: false,
    crossesIntoK12: false,
    supportsSilentFollowerRemoval: true,
    notifyRemovedFollower: false,
  },
  k12: {
    network: "k12",
    defaultAudience: "school",
    availableAudiences: ["school", "class", "connections"],
    feedTabs: ["school", "classes", "connections"],
    facultyOnlyVisible: false,
    crossesIntoUniversity: false,
    supportsSilentFollowerRemoval: true,
    notifyRemovedFollower: false,
  },
  professor: {
    network: "university",
    defaultAudience: "faculty",
    availableAudiences: ["faculty", "school", "class", "connections", "public"],
    feedTabs: ["faculty", "school", "classes", "connections"],
    facultyAudienceViewers: ["professor"],
    schoolAudienceViewers: ["professor", "student"],
    crossesIntoK12: false,
    supportsSilentFollowerRemoval: true,
    notifyRemovedFollower: false,
  },
});

const CHAPTERS = {
  student: [
    {
      title: "Closing year one",
      focus: "Brooke finishes her first year and gives herself room to breathe.",
      posts: [
        "First year complete. I cried, laughed, and somehow passed statistics. That counts as a win.",
        "Slept past my alarm, made pancakes, and did not open the gradebook once. Summer has officially started.",
        "Put the whole year into one sketchbook spread. Messy pages, real progress.",
        "The final statistics grade landed. Better than I feared, and proof that asking for help worked.",
        "Summer rule: protect my peace, keep my people close, and stop treating rest like a reward.",
      ],
    },
    {
      title: "A steadier summer",
      focus: "Work, friends, art, and practical preparation build a calmer rhythm.",
      posts: [
        "Family dinner and no alarm tomorrow. Elite combination.",
        "My library shift was quiet enough to finish a budget page and loud enough to keep me awake.",
        "Coffee with Maya turned into a two-hour life reset. Good friends ask the useful questions.",
        "Took the long campus walk today. Same buildings, different version of me.",
        "Made a simple fall checklist: books, move-in, class dates, snacks. Mostly snacks.",
      ],
    },
    {
      title: "Fall setup",
      focus: "Brooke turns course information into a plan she can actually follow.",
      posts: [
        "Year 2, please be kind. I am bringing better boundaries and more snacks.",
        "Found all five fall classes and saved the syllabi in one place. My tabs can finally rest.",
        "Marketing has a reflection due the first week, so future Brooke is getting a head start.",
        "Accounting notebook is labeled, calendar is color coded, and I am pretending that means I am ready.",
        "Move-in week: one box missing, three new reminders, and a room that already feels more like mine.",
      ],
    },
    {
      title: "Finding the pace",
      focus: "The new semester becomes manageable through small habits and honest check-ins.",
      posts: [
        "First week done. The goal was not perfect notes; it was knowing what happens next.",
        "Joined the Marketing Club interest meeting and spoke before I could talk myself out of it.",
        "Accounting finally clicked after I rewrote the example in plain language.",
        "Twelve-day study streak. Nothing dramatic, just showing up before the panic starts.",
        "Skipped one club night to finish my speech outline. Boundaries are apparently also calendar events.",
      ],
    },
    {
      title: "Midterm stretch",
      focus: "Brooke works through pressure without disappearing into it.",
      posts: [
        "Midterm week plan: one task, one break, one person to call when my brain gets loud.",
        "The marketing presentation earned an A-. I remembered every point except the one I practiced most.",
        "Asked Professor Chen about the journal entries instead of staring at them for another hour.",
        "Sketch Club made tiny fall postcards tonight. Mine says progress can be quiet.",
        "A missed source annotation is back on the plan. Not erased, not shameful, just scheduled.",
      ],
    },
    {
      title: "Finish with care",
      focus: "Community, recovery, and a clear plan carry Brooke through the end of term.",
      posts: [
        "Volunteering this morning reminded me that a useful day does not have to be a productive day.",
        "Thanksgiving at Aunt Kara’s: loud table, excellent pie, phone mostly forgotten.",
        "Final projects are stacked, but the calendar says there is room. I am choosing to believe it.",
        "Business Communication submitted. I read it once more, fixed two sentences, and let it go.",
        "Semester two of college complete. Proud, tired, and ready to be somebody’s favorite couch guest.",
      ],
    },
    {
      title: "Winter reset",
      focus: "Brooke reflects, rests, and chooses a smaller set of spring goals.",
      posts: [
        "Home, fuzzy socks, and a sketchbook with no assignment attached to it.",
        "Made a year-in-review page. The best parts were mostly people, not scores.",
        "New year goal: fewer dramatic reinventions, more tiny promises I can keep.",
        "Spring schedule is saved. I left actual blank space this time.",
        "Back on campus with clean sheets, a full water bottle, and reasonable expectations.",
      ],
    },
    {
      title: "Spring confidence",
      focus: "Brooke practices leadership while keeping school and life in balance.",
      posts: [
        "Led my first Marketing Club check-in. My voice shook; the meeting still went well.",
        "Personal Finance assignment made me call Mom about insurance. We both learned something.",
        "Group project roles are clear before the deadline. This may be my greatest college achievement.",
        "A quiet library table, a finished outline, and sunlight at 4 PM. Good day.",
        "Valentine’s reminder to myself: being cared for includes caring for my own time.",
      ],
    },
    {
      title: "Building momentum",
      focus: "Creative work and stronger routines make the second year feel like Brooke's own.",
      posts: [
        "Used a sketch to explain customer segments and suddenly the whole chapter made sense.",
        "Study group started with accounting and ended with everyone comparing campus snacks.",
        "Spring break list: sleep, draw, see family, do not invent work that is not due.",
        "Back from break and the calendar still makes sense. Past Brooke really came through.",
        "Shared my design-thinking prototype today. Feedback was kind, specific, and actually useful.",
      ],
    },
    {
      title: "Looking ahead",
      focus: "Brooke closes year two with clearer goals, stronger friendships, and trust in her own progress.",
      posts: [
        "Registration opened. I picked classes that fit the plan and the person taking them.",
        "Helped a first-year student build a deadline list. Apparently I know things now.",
        "Marketing Club asked me to help with fall welcome week. Nervous yes, saying yes anyway.",
        "Birthday call with Theo became a full family group chat. Loud love is still love.",
        "Year 2 is almost wrapped. More confident, less rushed, still carrying snacks.",
      ],
    },
  ],
  k12: [
    {
      title: "Junior year complete",
      focus: "Jaylen finishes strong and turns toward a focused senior summer.",
      posts: [
        "Junior year is done. Strong grades, tougher training, and a much clearer picture of what comes next.",
        "First free Saturday: morning run, pancakes with family, then absolutely no school tabs.",
        "Built a one-page list for senior year: applications, scholarships, grades, and time to train.",
        "Final class rank posted at 2. Proud of the work and already thinking about the next round.",
        "Coach says recovery is part of discipline. Taking that advice in the gym and at my desk.",
      ],
    },
    {
      title: "Senior summer",
      focus: "College research, family time, and MMA give Jaylen's summer a clear rhythm.",
      posts: [
        "Compared accounting programs with Dad. The right question is not just where, but what each place lets me build.",
        "Investment Club summer check-in turned into a good talk about risk, patience, and not chasing noise.",
        "Drafted the first paragraph of my college essay. It is rough, but a rough page beats a blank one.",
        "Hard rounds at practice today. Stayed technical when I got tired. That lesson travels.",
        "Senior year setup is simple: know the dates, do the work early, keep family time protected.",
      ],
    },
    {
      title: "College plan in motion",
      focus: "Jaylen narrows choices and prepares for the first weeks of senior year.",
      posts: [
        "Prairie View and Texas Tech both have real strengths. I made a comparison sheet instead of guessing.",
        "Requested two recommendation letters today. Asking early feels better than apologizing late.",
        "Accounting class materials are ready. Yes, the calculator has its own labeled pocket.",
        "College essay draft went to Ms. Johnson. Now I wait for the red notes and use them.",
        "First week back: five classes, one practice plan, zero mystery deadlines.",
      ],
    },
    {
      title: "Senior pace",
      focus: "School, leadership, and training settle into a demanding but workable routine.",
      posts: [
        "AP Calculus problem set took two tries. The second try is where the learning was.",
        "Helped Business Club set its fall budget. Real numbers make a meeting move faster.",
        "Prairie View visit gave me better questions about internships, class size, and student support.",
        "Accounting trial balance matched on the first check. A rare and beautiful event.",
        "MMA tournament complete. Stayed calm, listened to Coach, and learned more than the result shows.",
      ],
    },
    {
      title: "Application season",
      focus: "Jaylen handles applications as a sequence of clear, checkable steps.",
      posts: [
        "Personal statement revision three sounds like me, which matters more than sounding impressive.",
        "FAFSA checklist is ready for opening day. Documents first, stress later if necessary.",
        "Texas Tech application submitted. Read every field twice and still checked it once more.",
        "Current event brief turned into a real dinner conversation about local policy.",
        "One scholarship essay reused zero copy and three good ideas. Better system, better writing.",
      ],
    },
    {
      title: "Fall finish",
      focus: "Jaylen balances deadlines, gratitude, and a final push before winter break.",
      posts: [
        "National Honor Society project packed weekend meals. The spreadsheet mattered because the people did.",
        "Thanksgiving training was a short session before a long family table. Correct priorities.",
        "Calculus review plan is broken into four rounds. Big tests feel smaller with a clock and a purpose.",
        "Accounting final done. Checked the statements, submitted, and went straight to practice.",
        "First half of senior year complete. The plan held because people helped.",
      ],
    },
    {
      title: "Decision winter",
      focus: "Jaylen uses the break to compare choices without rushing the decision.",
      posts: [
        "Winter break morning: hot chocolate, college cost sheets, then the basketball game.",
        "Built a net-price comparison with grants, travel, housing, and the costs brochures skip.",
        "New year focus: finish senior year with the same energy I used to start it.",
        "Counselor meeting is booked. I have questions about aid, housing, and the accounting track.",
        "Back to school. Application work is lighter now, so classwork gets the front seat again.",
      ],
    },
    {
      title: "Leading the room",
      focus: "Jaylen practices leadership in class, clubs, and the gym.",
      posts: [
        "Taught the new Business Club members how to read a simple balance sheet. Teaching finds the gaps fast.",
        "AP Calculus study table had six people and one rule: explain it before checking the answer.",
        "Scholarship interview practice felt awkward until the fourth question. Repetition works.",
        "Coach asked me to lead warmups. Clear instructions are a skill everywhere.",
        "A quiet weekend with no deadline emergency. That is what early work buys.",
      ],
    },
    {
      title: "The choice gets clearer",
      focus: "Offers, aid details, and trusted conversations move Jaylen toward a college decision.",
      posts: [
        "Acceptance email arrived. I read it twice, then Mom read it out loud to everyone.",
        "Aid package comparison is not exciting, but understanding it feels powerful.",
        "Spring break campus walk answered more than the official tour did. Students tell the useful truth.",
        "Made the decision list: learning, cost, community, internships, and room to grow.",
        "Called my accounting teacher after choosing the next step. He sounded prouder than I expected.",
      ],
    },
    {
      title: "Ready for what is next",
      focus: "Jaylen closes high school with gratitude and a practical plan for college.",
      posts: [
        "Senior project connects investing basics to the choices students actually face after graduation.",
        "Helped a junior make an application calendar. Passing the system forward feels right.",
        "Final MMA event of high school season. Discipline built here is coming with me.",
        "Birthday week: grateful for family, teachers, coaches, and one more year to build.",
        "Graduation is close. The next chapter has numbers, people, and a lot left to learn.",
      ],
    },
  ],
  professor: [
    {
      title: "Closing the academic year",
      focus: "Atlas finishes grading, reflects on student growth, and protects the first days of summer.",
      posts: [
        "Final grades are in. The best notes in my inbox are the ones that say, ‘I did not think I could do this.’",
        "Archived the course shells, saved the useful revisions, and closed the laptop before dinner.",
        "One-page teaching reflection complete: keep the clear rubrics, shorten two lectures, add more practice.",
        "A student shared the project they once wanted to abandon. Their persistence was the real final product.",
        "Summer boundary: research has a schedule, and family time does too.",
      ],
    },
    {
      title: "Summer build",
      focus: "Research, course design, and mentoring shape a practical summer routine.",
      posts: [
        "Mapped the doctoral reading list into small blocks. A long study becomes possible when the next step is visible.",
        "Faculty Innovation Circle tested a cleaner course home page. Fewer clicks, clearer choices.",
        "Coffee with a former student became a good conversation about first jobs and asking better questions.",
        "Built a feedback template, then removed every sentence that sounded like a machine wrote it.",
        "Fall prep rule: automate the repetitive, protect the relational.",
      ],
    },
    {
      title: "Course launch",
      focus: "Atlas prepares syllabi, assignments, and welcoming course spaces for fall.",
      posts: [
        "Three syllabi reviewed, dates checked, and every major assignment has a plain-language purpose.",
        "Moved the first discussion prompt into week one where students can actually find it.",
        "Rubrics are linked beside the assignments instead of hidden in a resources folder.",
        "Recorded a short welcome note and kept it short. Students need direction, not a documentary.",
        "First week begins tomorrow. The course is ready enough, and ready enough is ready.",
      ],
    },
    {
      title: "Teaching rhythm",
      focus: "Consistent communication and visible feedback help the semester settle.",
      posts: [
        "First class question was better than the opening activity. Follow the curiosity in the room.",
        "Office hours filled up today. Most students needed confirmation that they were reading the task correctly.",
        "Posted the weekly overview before noon: what matters, what is due, and where to ask for help.",
        "Feedback queue is down to six. Specific comments first; polish can wait.",
        "Faculty check-in: shared one course win and one thing still not working. Both were useful.",
      ],
    },
    {
      title: "Midterm clarity",
      focus: "Atlas uses midterm signals to adjust instruction and reach students who need a clearer path.",
      posts: [
        "Midterm pulse check says the examples help and the reading map does not. The map changes this week.",
        "A student revised the leadership reflection after a ten-minute conversation. Feedback works best as dialogue.",
        "Research Methods needed another model paper, so we annotated one together in class.",
        "Blocked an hour for students who have gone quiet. A short message can reopen a door.",
        "Doctoral memo submitted. It is not perfect, but the argument is finally mine.",
      ],
    },
    {
      title: "Finish the term well",
      focus: "Atlas balances grading, department work, and a humane end-of-semester pace.",
      posts: [
        "Advising week reminder: the fastest schedule is not always the best schedule.",
        "Thanksgiving break message is posted. No surprise work, no hidden deadline, no inbox guilt.",
        "Final project conferences started today. Students explain their choices better than a score ever could.",
        "Grading plan is visible, timed, and includes a stopping point. My future self is on the roster too.",
        "Term complete. Strong work from students, useful notes for me, and dinner without a laptop.",
      ],
    },
    {
      title: "Reflect and reset",
      focus: "Winter gives Atlas space to consolidate research and revise only what needs revision.",
      posts: [
        "Read student reflections instead of course evaluations first. The stories explain the numbers.",
        "Cleaned the office shelf and found three ideas worth bringing back next semester.",
        "New year plan: fewer tools, stronger routines, more room for conversation.",
        "Spring shells are copied. Every copied item still has to earn its place.",
        "Welcome messages are scheduled for working hours. Boundaries can be designed.",
      ],
    },
    {
      title: "Spring launch",
      focus: "Atlas begins spring with clear expectations and more student choice.",
      posts: [
        "Spring opening question: what would make this course worth your time? The answers changed my examples.",
        "Students chose between a written reflection, audio response, or visual brief. Same goal, better fit.",
        "Faculty workshop focused on assignment clarity. We rewrote instructions before discussing any tool.",
        "Research cohort meeting produced one strong paragraph and four better questions.",
        "Office hours ended with a student saying, ‘I know what to do next.’ That is the metric.",
      ],
    },
    {
      title: "Mentoring momentum",
      focus: "Teaching, advising, and doctoral research connect around practical student support.",
      posts: [
        "Advising notes are organized by next action, not by meeting date. Follow-up just got easier.",
        "A class debate stayed thoughtful because students had evidence and time to think first.",
        "Spring break reading block complete. The rest of the week belongs to family.",
        "Back in class with a revised example built from last month’s student questions.",
        "Mentoring conversation today: name the skill, show the evidence, then choose the next place to grow.",
      ],
    },
    {
      title: "Carry the learning forward",
      focus: "Atlas closes the cycle by documenting improvements and celebrating student ownership.",
      posts: [
        "Registration questions are coming in. I am answering the course students need, not selling the course I teach.",
        "Shared a student-designed resource with permission and clear credit. The class made it better together.",
        "Next fall’s revision list has five items. A focused list is more honest than a total rebuild.",
        "Doctoral milestone approved. Celebrated, thanked the cohort, then took the evening off.",
        "Another academic year is nearly complete. Teach clearly, listen closely, keep learning.",
      ],
    },
  ],
};

export const STORY_REPLY_BANK = Object.freeze({
  shared: [
    "Thanks for reading — keep taking the next clear step.",
    "That is a good point. I am adding it to the next update.",
    "I appreciate you checking in. We are learning as we go.",
    "Small progress still counts. Keep me posted on yours.",
    "That question is worth carrying into class this week.",
    "I like that way of looking at it. Thanks for sharing.",
  ],
  student: [
    "Honestly, same. A checklist and a snack usually help me start.",
    "You have got this. We can be works in progress together.",
    "I saved that idea for my next study reset.",
    "That made me smile. Campus life is better with good people in it.",
    "If you try it, tell me whether it helped or just made a prettier list.",
    "One assignment at a time. That is the whole plan today.",
  ],
  k12: [
    "Good call. Preparation makes the next round easier.",
    "I am writing that down for the next study session.",
    "Stay steady. One good rep is better than rushing five.",
    "That is useful — especially for anyone planning senior year.",
    "Appreciate it. Keep building your own plan too.",
    "Ask the question early. It saves time later.",
  ],
  professor: [
    "That is a useful teaching question. I am taking it back to the course.",
    "Thank you. Clear feedback makes the next version stronger.",
    "Agreed — the human conversation is still the important part.",
    "I appreciate the perspective. Students often notice what our plans miss.",
    "That belongs in the next faculty discussion.",
    "Good reminder. Clarity before complexity.",
  ],
});

const PERSONA_ALIASES = Object.freeze({
  brooke: "student",
  university: "student",
  campus: "student",
  student: "student",
  jaylen: "k12",
  "high-school": "k12",
  highschool: "k12",
  school: "k12",
  k12: "k12",
  atlas: "professor",
  faculty: "professor",
  teacher: "professor",
  professor: "professor",
});

const PERSONA_AUDIENCE_CYCLES = Object.freeze({
  student: ["campus", "connections", "class", "campus", "public"],
  k12: ["school", "connections", "class", "school", "connections"],
  professor: ["faculty", "school", "faculty", "class", "public"],
});

const SNAPSHOT_BASES = Object.freeze({
  student: { points: 1240, gradeAverage: 87.4, progress: 8, responseRate: null, shift: 1 },
  k12: { points: 1810, gradeAverage: 93.1, progress: 12, responseRate: null, shift: 3 },
  professor: { points: 2160, gradeAverage: null, progress: 6, responseRate: 93, shift: 5 },
});

function normalizePersonaId(value = "student") {
  return PERSONA_ALIASES[String(value).trim().toLowerCase()] || "student";
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function addUtcDays(dateKey, dayCount) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + dayCount));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function storyDateForIndex(index) {
  if (index === 0) return STORY_ANCHOR_DATE;
  return addUtcDays("2026-05-24", (index - 1) * 7);
}

function weekdayForDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function monthNameForDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function isoWeekForDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${isoYear}-W${pad(week)}`;
}

function localTimeForIndex(personaId, index) {
  const personaShift = { student: 0, k12: 2, professor: 4 }[personaId];
  const hour = 9 + ((index * 2 + personaShift) % 9);
  const minute = hour === 17 ? 0 : (18 + index * 7 + personaShift * 3) % 60;
  return `${pad(hour)}:${pad(minute)}`;
}

function timeLabel(time) {
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${pad(minute)} ${suffix}`;
}

function localClock(value = new Date()) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T23:59`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(trimmed)) return trimmed.slice(0, 16);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return localClock(new Date());
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashText(value) {
  return Array.from(String(value)).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
}

function gradeLetter(average) {
  if (average == null) return null;
  if (average >= 97) return "A+";
  if (average >= 93) return "A";
  if (average >= 90) return "A-";
  if (average >= 87) return "B+";
  if (average >= 83) return "B";
  return "B-";
}

function snapshotForWeek(personaId, index) {
  const base = SNAPSHOT_BASES[personaId];
  let points = base.points;
  let gradeDeltaTotal = 0;
  for (let current = 0; current <= index; current += 1) {
    points += 14 + ((current * 7 + base.shift) % 15);
    gradeDeltaTotal += [-0.1, 0.2, 0.1, 0, 0.2, -0.1][(current + base.shift) % 6];
  }
  const pointsDelta = 14 + ((index * 7 + base.shift) % 15);
  const gradeDelta = base.gradeAverage == null ? null : [-0.1, 0.2, 0.1, 0, 0.2, -0.1][(index + base.shift) % 6];
  const gradeAverage = base.gradeAverage == null ? null : Number(clamp(base.gradeAverage + gradeDeltaTotal, 82, 99).toFixed(1));
  const progressDelta = 1 + ((index + base.shift) % 4);
  const progressPercent = clamp(base.progress + (index * 2) + Math.floor(index / 4), 0, 100);
  return {
    points,
    pointsDelta,
    gradeAverage,
    gradeDelta,
    gradeLetter: gradeLetter(gradeAverage),
    progressPercent,
    progressDelta,
    studyStreakDays: personaId === "professor" ? null : 4 + ((index * 3 + base.shift) % 19),
    responseRate: personaId === "professor" ? clamp(base.responseRate + ((index + 1) % 4), 0, 100) : null,
    feedbackCompleted: personaId === "professor" ? 3 + ((index * 5 + base.shift) % 18) : null,
  };
}

function reactionsForWeek(personaId, index) {
  const shift = { student: 5, k12: 11, professor: 17 }[personaId];
  const reactions = STORY_REACTION_TYPES.map((reaction, reactionIndex) => ({
    ...reaction,
    count: 8 + ((index * (reactionIndex + 5) + shift + reactionIndex * 9) % (reactionIndex === 0 ? 44 : 29)),
  }));
  return {
    types: reactions,
    total: reactions.reduce((total, reaction) => total + reaction.count, 0),
  };
}

function flattenBible(personaId) {
  return CHAPTERS[personaId].flatMap((chapter, chapterIndex) => chapter.posts.map((body, beatIndex) => ({
    chapter: chapter.title,
    chapterFocus: chapter.focus,
    chapterNumber: chapterIndex + 1,
    beatNumber: beatIndex + 1,
    body,
  })));
}

function buildPersonaStory(personaId) {
  const guide = STORY_GUIDES[personaId];
  const beats = flattenBible(personaId);
  return beats.slice(0, STORY_WEEK_COUNT).map((beat, index) => {
    const date = storyDateForIndex(index);
    const localTime = localTimeForIndex(personaId, index);
    const audienceCycle = PERSONA_AUDIENCE_CYCLES[personaId];
    const reactions = reactionsForWeek(personaId, index);
    return Object.freeze({
      id: `story-${personaId}-${pad(index + 1)}`,
      personaId,
      author: guide,
      storyWeek: index + 1,
      calendarWeek: isoWeekForDate(date),
      chapter: beat.chapter,
      chapterNumber: beat.chapterNumber,
      chapterFocus: beat.chapterFocus,
      beatNumber: beat.beatNumber,
      date,
      month: date.slice(0, 7),
      monthName: monthNameForDate(date),
      weekday: weekdayForDate(date),
      localTime,
      timeLabel: timeLabel(localTime),
      publishedAtLocal: `${date}T${localTime}`,
      timeZone: STORY_TIME_ZONE,
      body: beat.body,
      audience: audienceCycle[index % audienceCycle.length],
      network: STORY_AUDIENCE_RULES[personaId].network,
      snapshot: Object.freeze(snapshotForWeek(personaId, index)),
      reactions: Object.freeze(reactions),
      commentsAllowed: true,
      profilePostsAllowed: true,
      seedReply: getGenericReply(personaId, beat.body, index),
    });
  });
}

const STORY_CACHE = Object.freeze({
  student: Object.freeze(buildPersonaStory("student")),
  k12: Object.freeze(buildPersonaStory("k12")),
  professor: Object.freeze(buildPersonaStory("professor")),
});

export const STORY_BIBLES = Object.freeze(Object.fromEntries(Object.keys(CHAPTERS).map((personaId) => [personaId, Object.freeze({
  personaId,
  guide: STORY_GUIDES[personaId],
  premise: CHAPTERS[personaId].map((chapter) => chapter.focus).join(" "),
  voice: personaId === "student"
    ? ["warm", "honest", "lightly funny", "progress over perfection"]
    : personaId === "k12"
      ? ["focused", "grounded", "practical", "disciplined"]
      : ["clear", "student-centered", "reflective", "practical"],
  chapters: Object.freeze(CHAPTERS[personaId].map((chapter, index) => Object.freeze({
    number: index + 1,
    title: chapter.title,
    focus: chapter.focus,
    weeks: `${index * 5 + 1}-${index * 5 + 5}`,
  }))),
})])));

export function getStoryBible(persona = "student") {
  return STORY_BIBLES[normalizePersonaId(persona)];
}

export function getDefaultConnection(persona = "student") {
  const personaId = normalizePersonaId(persona);
  return Object.freeze({
    ...STORY_GUIDES[personaId],
    relationship: "first-follower",
    followsNewAccount: true,
    followBackRequired: false,
    canMessage: true,
    online: true,
    joinedFeedAutomatically: true,
  });
}

export function getGenericReply(persona = "student", interaction = "", salt = 0) {
  const personaId = normalizePersonaId(persona);
  const bank = [...STORY_REPLY_BANK[personaId], ...STORY_REPLY_BANK.shared];
  return bank[(hashText(`${personaId}:${interaction}`) + Number(salt || 0)) % bank.length];
}

export function createStoryReply({ persona = "student", message = "", postId = "", replyNumber = 0, now = new Date() } = {}) {
  const personaId = normalizePersonaId(persona);
  const clock = localClock(now);
  const date = clock.slice(0, 10);
  const requestedTime = clock.slice(11, 16);
  const localTime = requestedTime < "09:00" ? "09:00" : requestedTime > "17:00" ? "17:00" : requestedTime;
  return Object.freeze({
    id: `reply-${personaId}-${hashText(`${postId}:${message}:${replyNumber}`).toString(36)}`,
    author: STORY_GUIDES[personaId],
    body: getGenericReply(personaId, `${postId}:${message}`, replyNumber),
    inReplyTo: postId || null,
    date,
    localTime,
    timeLabel: timeLabel(localTime),
    publishedAtLocal: `${date}T${localTime}`,
    timeZone: STORY_TIME_ZONE,
  });
}

export function filterStoryFeed(posts, filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const audience = String(filters.audience || "").trim().toLowerCase();
  const month = String(filters.month || "").trim().toLowerCase();
  const weekday = String(filters.weekday || filters.day || "").trim().toLowerCase();
  const week = filters.week == null ? "" : String(filters.week).trim().toLowerCase();

  return posts.filter((post) => {
    if (audience && post.audience.toLowerCase() !== audience) return false;
    if (month && post.month.toLowerCase() !== month && post.monthName.toLowerCase() !== month && !post.monthName.toLowerCase().startsWith(month)) return false;
    if (weekday && post.date !== weekday && post.weekday.toLowerCase() !== weekday && !post.weekday.toLowerCase().startsWith(weekday)) return false;
    if (week) {
      if (/^\d+$/.test(week)) {
        if (post.storyWeek !== Number(week)) return false;
      } else {
        const normalizedCalendarWeek = week.startsWith("w") ? week : week.replace(/^\d{4}-/, "");
        const calendarWeekMatches = post.calendarWeek.toLowerCase() === week || post.calendarWeek.toLowerCase().endsWith(`-${normalizedCalendarWeek}`);
        if (!calendarWeekMatches) return false;
      }
    }
    if (query) {
      const searchable = [post.body, post.chapter, post.chapterFocus, post.author.name, post.audience, post.date, post.weekday, post.monthName, post.calendarWeek].join(" ").toLowerCase();
      if (!searchable.includes(query)) return false;
    }
    return true;
  });
}

export function generateStoryFeed(personaOrOptions = "student", suppliedNow) {
  const options = typeof personaOrOptions === "object" && personaOrOptions !== null
    ? personaOrOptions
    : { persona: personaOrOptions, now: suppliedNow };
  const personaId = normalizePersonaId(options.persona || options.personaId);
  const clock = localClock(options.now ?? new Date());
  const visible = STORY_CACHE[personaId].filter((post) => post.publishedAtLocal <= clock);
  const filtered = filterStoryFeed(visible, options.filters || options);
  return options.newestFirst === false ? [...filtered] : [...filtered].reverse();
}

export function getActiveWeeklyStory(personaOrOptions = "student", suppliedNow) {
  const options = typeof personaOrOptions === "object" && personaOrOptions !== null
    ? personaOrOptions
    : { persona: personaOrOptions, now: suppliedNow };
  const feed = generateStoryFeed({ ...options, newestFirst: true });
  return feed[0] || null;
}

export function getFullStory(persona = "student") {
  return [...STORY_CACHE[normalizePersonaId(persona)]];
}

export function createWelcomePost({
  persona = "student",
  accountName = "new learner",
  now = new Date(),
  allowProfilePosts = true,
  allowComments = true,
} = {}) {
  if (!allowProfilePosts) return null;
  const personaId = normalizePersonaId(persona);
  const guide = STORY_GUIDES[personaId];
  const audience = STORY_AUDIENCE_RULES[personaId].defaultAudience;
  const clock = localClock(now);
  const date = clock.slice(0, 10);
  const requestedTime = clock.slice(11, 16);
  const localTime = requestedTime < "09:00" ? "09:00" : requestedTime > "17:00" ? "17:00" : requestedTime;
  const introductions = {
    student: `Welcome to EdNotebook, ${accountName}. Brooke here — your first campus connection. Start with one class and make the space yours.`,
    k12: `Welcome to EdNotebook, ${accountName}. Jaylen here — your first school connection. Add what is due next, then build from there.`,
    professor: `Welcome to EdNotebook, ${accountName}. Atlas here — your first faculty connection. Start with one course and keep the next step clear.`,
  };
  return Object.freeze({
    id: `welcome-${personaId}-${hashText(`${accountName}:${date}`).toString(36)}`,
    personaId,
    author: guide,
    date,
    month: date.slice(0, 7),
    monthName: monthNameForDate(date),
    weekday: weekdayForDate(date),
    localTime,
    timeLabel: timeLabel(localTime),
    publishedAtLocal: `${date}T${localTime}`,
    timeZone: STORY_TIME_ZONE,
    body: introductions[personaId],
    audience,
    network: STORY_AUDIENCE_RULES[personaId].network,
    reactions: Object.freeze({
      types: STORY_REACTION_TYPES.map((reaction, index) => ({ ...reaction, count: index === 0 ? 1 : 0 })),
      total: 1,
    }),
    commentsAllowed: Boolean(allowComments),
    profilePostsAllowed: true,
    isWelcome: true,
  });
}
