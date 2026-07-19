export const SCHOOLS = [
  {
    id: "example-university",
    name: "Example University",
    location: "West Texas",
    label: "Synthetic demonstration campus",
    tips: [
      "Check the course schedule before registration closes.",
      "Keep your university ID nearby when joining a class.",
      "Digital Literacy Foundations is open for preview this term.",
    ],
    news: [
      { title: "Fall learning groups are forming", detail: "Join a course group after your enrollment is approved." },
      { title: "Student portfolio week", detail: "Build a simple page and share work you choose to make public." },
    ],
    classes: [
      {
        id: "sci-101-cell",
        code: "SCI 101",
        title: "What Is a Cell?",
        professor: "Dr. Nguyen",
        subject: "Biology",
        term: "Fall 2026",
        schedule: "Tue / Thu · 10:30 AM",
        summary: "A visual, evidence-based introduction to cell structure, energy, and division.",
        enrolled: 38,
        seats: 50,
      },
      {
        id: "univ-1101-digital",
        code: "UNIV 1101",
        title: "Digital Literacy Foundations",
        professor: "Dr. Ellis",
        subject: "Digital literacy",
        term: "Fall 2026",
        schedule: "Mon / Wed · 1:00 PM",
        summary: "Practical skills for evaluating information, using digital tools, and building good online habits.",
        enrolled: 42,
        seats: 50,
      },
      {
        id: "math-1314-algebra",
        code: "MATH 1314",
        title: "College Algebra",
        professor: "Prof. Aguilar",
        subject: "Mathematics",
        term: "Fall 2026",
        schedule: "Mon / Wed / Fri · 9:00 AM",
        summary: "Functions, equations, graphs, and applied problem solving with a clear weekly path.",
        enrolled: 47,
        seats: 50,
      },
    ],
  },
  {
    id: "north-plains-college",
    name: "North Plains College",
    location: "North Texas",
    label: "Synthetic demonstration campus",
    tips: ["Advising appointments open on Monday.", "Use your course group to compare study plans, not answers."],
    news: [{ title: "Library study night", detail: "Tutors and peer mentors will be available until 9 PM." }],
    classes: [
      {
        id: "hist-1301-us",
        code: "HIST 1301",
        title: "United States History to 1877",
        professor: "Dr. Monroe",
        subject: "History",
        term: "Fall 2026",
        schedule: "Tue / Thu · 2:30 PM",
        summary: "Primary sources, timelines, and short writing exercises organized around the major turning points.",
        enrolled: 31,
        seats: 45,
      },
      {
        id: "engl-1301-composition",
        code: "ENGL 1301",
        title: "Composition I",
        professor: "Prof. Bennett",
        subject: "Writing",
        term: "Fall 2026",
        schedule: "Online · weekly studio",
        summary: "Draft, revise, document sources, and build a repeatable college writing process.",
        enrolled: 24,
        seats: 30,
      },
    ],
  },
  {
    id: "metro-community-college",
    name: "Metro Community College",
    location: "Central Texas",
    label: "Synthetic demonstration campus",
    tips: ["Career services hosts walk-in résumé reviews each Friday."],
    news: [{ title: "New student clubs directory", detail: "Find academic, service, and career groups by interest." }],
    classes: [
      {
        id: "bus-1301-business",
        code: "BUSI 1301",
        title: "Business Principles",
        professor: "Dr. Patel",
        subject: "Business",
        term: "Fall 2026",
        schedule: "Tue · 6:00 PM",
        summary: "A practical survey of markets, teams, operations, finance, and ethical decision-making.",
        enrolled: 27,
        seats: 40,
      },
    ],
  },
];

export const STUDENT_CLASSES = [
  {
    id: "sci-101-cell",
    code: "SCI 101",
    title: "What Is a Cell?",
    professor: "Dr. Nguyen",
    progress: 64,
    points: 745,
    grade: 88.4,
    next: "Membranes knowledge check · Thursday",
  },
  {
    id: "univ-1101-digital",
    code: "UNIV 1101",
    title: "Digital Literacy Foundations",
    professor: "Dr. Ellis",
    progress: 41,
    points: 390,
    grade: 94.1,
    next: "Source verification exercise · Friday",
  },
  {
    id: "math-1314-algebra",
    code: "MATH 1314",
    title: "College Algebra",
    professor: "Prof. Aguilar",
    progress: 52,
    points: 510,
    grade: 81.7,
    next: "Functions quiz · Monday",
  },
];

export const GRADE_ROWS = [
  { id: "g1", course: "SCI 101", item: "Cell structure lab", category: "Labs", weight: 25, score: 92, status: "finalized" },
  { id: "g2", course: "SCI 101", item: "Membranes knowledge check", category: "Checks", weight: 15, score: 86, status: "pending" },
  { id: "g3", course: "UNIV 1101", item: "Source verification exercise", category: "Projects", weight: 30, score: 96, status: "finalized" },
  { id: "g4", course: "MATH 1314", item: "Functions quiz", category: "Quizzes", weight: 20, score: null, status: "missing" },
];

export const K12_SCHOOLS = [
  {
    id: "example-high-school",
    name: "Example High School",
    location: "West Texas",
    label: "Synthetic demonstration school",
    tips: ["Check today’s class list before the first bell.", "Ask your teacher when an assignment status is unclear.", "School groups stay separate from university communities."],
    news: [{ title: "Clubs meet Thursday", detail: "Find study groups, robotics, art, service, and student council in School life." }],
    classes: [
      { id: "eng10-stories", code: "ENG 10", title: "Stories and Evidence", professor: "Ms. Carter", subject: "English", term: "2026–27", schedule: "Period 2 · 9:10 AM", summary: "Read closely, build clear claims, and use evidence without losing your own voice.", enrolled: 26, seats: 30 },
      { id: "alg1-functions", code: "ALG I", title: "Algebra I", professor: "Mr. Brooks", subject: "Mathematics", term: "2026–27", schedule: "Period 4 · 11:15 AM", summary: "Equations, functions, graphs, and everyday problem solving with a clear weekly path.", enrolled: 24, seats: 30 },
      { id: "bio9-cells", code: "BIO 9", title: "Living Systems", professor: "Dr. Kim", subject: "Science", term: "2026–27", schedule: "Period 6 · 1:45 PM", summary: "Explore cells, ecosystems, heredity, and the evidence scientists use to explain living systems.", enrolled: 28, seats: 30 },
    ],
  },
  {
    id: "north-ridge-middle",
    name: "North Ridge Middle School",
    location: "North Texas",
    label: "Synthetic demonstration school",
    tips: ["Your class page shows what is due next and where to ask for help."],
    news: [{ title: "Family learning night", detail: "Teachers and student mentors will share study routines and project tips." }],
    classes: [
      { id: "math7-ratios", code: "MATH 7", title: "Ratios and Real-World Math", professor: "Ms. Patel", subject: "Mathematics", term: "2026–27", schedule: "Period 1 · 8:15 AM", summary: "Use ratios, percentages, and models to solve practical problems.", enrolled: 25, seats: 28 },
    ],
  },
];

export const K12_STUDENT_CLASSES = [
  { id: "eng10-stories", code: "ENG 10", title: "Stories and Evidence", professor: "Ms. Carter", progress: 71, points: 620, grade: 91.2, next: "Evidence paragraph · tomorrow" },
  { id: "alg1-functions", code: "ALG I", title: "Algebra I", professor: "Mr. Brooks", progress: 58, points: 510, grade: 86.5, next: "Functions practice · Friday" },
  { id: "bio9-cells", code: "BIO 9", title: "Living Systems", professor: "Dr. Kim", progress: 64, points: 575, grade: 89.7, next: "Cell model check · Monday" },
];

export const K12_GRADE_ROWS = [
  { id: "kg1", course: "ENG 10", item: "Evidence paragraph", category: "Writing", weight: 25, score: 93, status: "finalized" },
  { id: "kg2", course: "ALG I", item: "Functions practice", category: "Practice", weight: 15, score: 88, status: "pending" },
  { id: "kg3", course: "BIO 9", item: "Cell model check", category: "Projects", weight: 25, score: null, status: "missing" },
];

export const K12_STUDENT_GROUPS = [
  { id: "kg-class", name: "ENG 10 Study Room", scope: "Class", members: 26, description: "Questions, reminders, reading notes, and teacher highlights for enrolled students." },
  { id: "kg-school", name: "Example High School", scope: "School", members: 418, description: "Clubs, events, school tips, announcements, and student celebrations." },
  { id: "kg-network", name: "Teen Digital Skills", scope: "K–12 network", members: 186, description: "A school-verified learning group that never mixes with university social feeds." },
];

export const K12_COMMUNITY_POSTS = [
  { id: "kp1", author: "Avery J.", badge: "10th grade", group: "ENG 10 Study Room", body: "The claim-evidence checklist helped me see what my paragraph was missing.", reactions: 18, replies: 4 },
  { id: "kp2", author: "Ms. Carter", badge: "Teacher", group: "Class", body: "Bring one sentence you want to improve. We’ll workshop examples without posting anyone’s grade.", reactions: 27, replies: 6 },
];

export const STUDENT_GROUPS = [
  { id: "campus", name: "Example University Student Life", scope: "Campus", members: 684, description: "Campus news, study events, clubs, and student highlights." },
  { id: "sci", name: "SCI 101 Study Room", scope: "Class", members: 38, description: "Questions, study plans, professor announcements, and class milestones." },
  { id: "digital", name: "Digital Literacy Lab", scope: "Public", members: 212, description: "Useful links, short explainers, and practical digital skills." },
];

export const COMMUNITY_POSTS = [
  { id: "p1", author: "Dr. Nguyen", badge: "Professor", group: "SCI 101 Study Room", body: "The membrane review sheet is posted. Focus on transport direction and energy use.", reactions: 19, replies: 4 },
  { id: "p2", author: "Maya R.", badge: "Student", group: "Example University Student Life", body: "Three-week study streak. The small daily sessions are finally adding up.", reactions: 42, replies: 8 },
  { id: "p3", author: "Digital Literacy Lab", badge: "Course highlight", group: "Public", body: "Quick tip: open the original source before sharing a screenshot of a headline.", reactions: 73, replies: 11 },
];

export const STUDENT_PRICING = [
  {
    name: "Student Basic",
    price: "Free",
    description: "Everything needed to find classes and do course work.",
    features: ["Class discovery and enrollment matching", "Grades, report card, notes, and calculator", "Class groups and basic student page", "Device-only messages"],
  },
  {
    name: "Pocket add-ons",
    price: "$0.99 each",
    description: "Small optional upgrades without changing course access.",
    features: ["Profile color or layout packs", "Extra media or social-link block", "One custom page section", "Special badge display"],
  },
  {
    name: "Student Plus",
    price: "$2.99 / month",
    description: "For students who want a larger portfolio and synced personal tools.",
    features: ["Cloud message and note sync", "Advanced page builder and custom styling", "Extended portfolio history", "Additional private groups"],
  },
];

export const PROFESSOR_PRICING = [
  { name: "Professor Basic", price: "Free", description: "Create, publish, roster, grade, and communicate for one active class." },
  { name: "Professor Plus", price: "$8 / month", description: "More active classes, personal professor page, reusable gradebooks, and expanded reporting." },
  { name: "Founding educator", price: "Free forever", description: "Reserved for approved early educators who help test and shape the platform." },
];
