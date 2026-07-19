import { PERSONAS as BASE_PERSONAS } from "./personas.js";

export const PERSONAS = {
  ...BASE_PERSONAS,
  student: { ...BASE_PERSONAS.student, image: "/demo-media/brooke-portrait.png" },
  k12: { ...BASE_PERSONAS.k12, image: "/demo-media/jaylen-portrait.png" },
  professor: {
    ...BASE_PERSONAS.professor,
    image: "/demo-media/atlas-portrait.png",
    profile: {
      ...BASE_PERSONAS.professor.profile,
      bio: "Former high school teacher, third-year professor, and Ed.D. student in Transformative Leadership at Angelo State University. A practical learning-technology builder who keeps the human decision in charge.",
      traits: ["Student-centered", "Curious", "Direct but kind", "Technology enthusiast", "Growth-minded"],
      activities: ["Learning Technology Workshop", "Faculty Innovation Circle", "EdTech Collective", "Doctoral cohort"],
      interests: ["Prototyping", "Instructional design", "Coffee", "Research", "Mentoring"],
    },
    posts: BASE_PERSONAS.professor.posts.map((post) => ({
      ...post,
      body: post.body.replace("Vibe coded a feedback sorter.", "Built a feedback sorter."),
    })),
  },
};
