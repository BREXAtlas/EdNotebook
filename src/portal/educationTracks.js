export const EDUCATION_TRACKS = {
  university: {
    id: "university",
    label: "University & college",
    shortLabel: "University",
    studentLabel: "College student",
    schoolLabel: "College or university",
    idLabel: "University ID",
    classLabel: "course",
    teacherLabel: "professor",
    communityLabel: "campus",
    graduationLabel: "Graduation year",
  },
  k12: {
    id: "k12",
    label: "Early Prep · Grades 9–12",
    shortLabel: "Early Prep",
    studentLabel: "High-school student",
    schoolLabel: "High school or district",
    idLabel: "Student ID",
    classLabel: "class",
    teacherLabel: "teacher",
    communityLabel: "school",
    graduationLabel: "Expected graduation year",
  },
};

export function educationTrack(track = "university") {
  return EDUCATION_TRACKS[track] || EDUCATION_TRACKS.university;
}
