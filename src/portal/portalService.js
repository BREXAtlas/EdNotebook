import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

export async function listPublishedCourses(educationDivision = "university") {
  if (!isSupabaseConfigured) return { data: [], source: "demo" };

  const { data, error } = await supabase
    .from("published_course_directory")
    .select("course_id,institution_id,institution_name,professor_id,professor_display_name,course_code,title,subject,term,schedule,summary,enrollment_open,education_division,educator_verification_status")
    .eq("is_listed", true)
    .eq("education_division", educationDivision)
    .order("institution_name")
    .order("course_code");

  if (error) {
    console.info("Published class directory is not available yet; using demonstration listings.", error.message);
    return { data: [], source: "demo" };
  }

  return { data: data || [], source: data?.length ? "live" : "demo" };
}

export async function requestClassLink({ courseId, rosterEntryId = null, studentId }) {
  if (!isSupabaseConfigured || !courseId || !studentId) {
    return { data: null, error: new Error("A signed-in student and published class are required.") };
  }
  const created = await supabase
    .from("student_enrollment_requests")
    .insert({
      course_id: courseId,
      roster_entry_id: rosterEntryId,
      student_id: studentId,
      status: "pending",
    })
    .select("id,course_id,student_id,status,requested_at")
    .single();
  if (created.error?.code !== "23505") return created;
  return supabase
    .from("student_enrollment_requests")
    .select("id,course_id,student_id,status,requested_at")
    .eq("course_id", courseId)
    .eq("student_id", studentId)
    .maybeSingle();
}

export async function approveClassLink(requestId) {
  return supabase.rpc("approve_student_enrollment", { p_request_id: requestId });
}

export async function savePublicStudentPage(profile) {
  return supabase.from("student_public_profiles").upsert(profile, { onConflict: "user_id,education_division" });
}

export async function loadPublicStudentPage(userId, educationDivision) {
  if (!isSupabaseConfigured || !userId) return { data: null, source: "device" };
  const { data, error } = await supabase
    .from("student_public_profiles")
    .select("user_id,education_division,display_name,school_name,graduation_year,bio,youtube_url,social_links,theme_key,visibility,discoverable_by_name")
    .eq("user_id", userId)
    .eq("education_division", educationDivision)
    .maybeSingle();
  return { data, error, source: error ? "device" : "cloud" };
}

export async function searchStudentProfiles(query, educationDivision, currentUserId) {
  if (!isSupabaseConfigured || query.trim().length < 2) return { data: [], source: "device" };
  let request = supabase
    .from("student_public_profiles")
    .select("user_id,display_name,school_name,graduation_year,bio,theme_key,visibility")
    .eq("education_division", educationDivision)
    .eq("discoverable_by_name", true)
    .neq("visibility", "private")
    .ilike("display_name", `%${query.trim().replaceAll("%", "").replaceAll("_", "")}%`)
    .order("display_name")
    .limit(20);
  if (currentUserId) request = request.neq("user_id", currentUserId);
  const { data, error } = await request;
  return { data: data || [], error, source: error ? "device" : "cloud" };
}

export async function searchEducatorProfiles(query, educationDivision) {
  if (!isSupabaseConfigured || query.trim().length < 2) return { data: [], source: "device" };
  const clean = query.trim().replaceAll("%", "").replaceAll("_", "");
  const { data, error } = await supabase
    .from("published_course_directory")
    .select("professor_id,professor_display_name,institution_name,educator_verification_status")
    .eq("education_division", educationDivision)
    .ilike("professor_display_name", `%${clean}%`)
    .order("professor_display_name")
    .limit(40);
  const unique = [...new Map((data || []).map((person) => [person.professor_id, {
    user_id: person.professor_id,
    display_name: person.professor_display_name || "Educator",
    school_name: person.institution_name || "Educator",
    bio: person.educator_verification_status === "approved" ? "Verified school affiliation" : "Published educator",
    role: "Educator",
  }])).values()];
  return { data: unique, error, source: error ? "device" : "cloud" };
}

export async function listCurrentStudentCourses() {
  if (!isSupabaseConfigured) return { data: [], source: "device" };
  const { data, error } = await supabase
    .from("courses")
    .select("id,course_code,title,subject,teaching_window,status,education_division")
    .order("updated_at", { ascending: false });
  if (error || !data?.length) return { data: data || [], error, source: error ? "device" : "cloud" };
  const [publicationResult, directoryResult] = await Promise.all([
    supabase
      .from("course_publications")
      .select("id,course_id,status,current_version")
      .in("course_id", data.map((course) => course.id))
      .eq("status", "published"),
    supabase
      .from("published_course_directory")
      .select("course_id,professor_display_name,institution_name")
      .in("course_id", data.map((course) => course.id)),
  ]);
  const publicationByCourse = new Map((publicationResult.data || []).map((publication) => [publication.course_id, publication]));
  const directoryByCourse = new Map((directoryResult.data || []).map((course) => [course.course_id, course]));
  return {
    data: data.map((course) => ({
      ...course,
      publication_id: publicationByCourse.get(course.id)?.id || null,
      publication_version: publicationByCourse.get(course.id)?.current_version || null,
      professor_display_name: directoryByCourse.get(course.id)?.professor_display_name || "Educator",
      institution_name: directoryByCourse.get(course.id)?.institution_name || "Independent course",
    })),
    error: error || publicationResult.error || directoryResult.error,
    source: publicationResult.error || directoryResult.error ? "device" : "cloud",
  };
}

export async function listCurrentStudentEnrollmentRequests(studentId) {
  if (!isSupabaseConfigured || !studentId) return { data: [], source: "device" };
  const { data, error } = await supabase
    .from("student_enrollment_requests")
    .select("id,course_id,status,requested_at,decided_at")
    .eq("student_id", studentId)
    .order("requested_at", { ascending: false });
  if (error || !data?.length) return { data: data || [], error, source: error ? "device" : "cloud" };
  const courseIds = [...new Set(data.map((request) => request.course_id))];
  const directory = await supabase
    .from("published_course_directory")
    .select("course_id,course_code,title,professor_display_name,institution_name,education_division")
    .in("course_id", courseIds);
  const directoryByCourse = new Map((directory.data || []).map((course) => [course.course_id, course]));
  return {
    data: data.map((request) => ({ ...request, course: directoryByCourse.get(request.course_id) || null })),
    error: error || directory.error,
    source: directory.error ? "device" : "cloud",
  };
}

export async function listProfessorCourseLibrary() {
  if (!isSupabaseConfigured) return { data: [], source: "device" };
  const coursesResult = await supabase
    .from("courses")
    .select("id,owner_id,institution_id,course_code,title,subject,audience,teaching_window,status,education_division,access_scope,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (coursesResult.error || !coursesResult.data?.length) {
    return { data: [], error: coursesResult.error, source: coursesResult.error ? "device" : "cloud" };
  }
  const ids = coursesResult.data.map((course) => course.id);
  const [directoryResult, membershipResult, requestResult] = await Promise.all([
    supabase
      .from("published_course_directory")
      .select("course_id,is_listed,enrollment_open,published_at,educator_verification_status,institution_name")
      .in("course_id", ids),
    supabase
      .from("course_memberships")
      .select("course_id,user_id,role")
      .in("course_id", ids),
    supabase
      .from("student_enrollment_requests")
      .select("course_id,status")
      .in("course_id", ids),
  ]);
  const directoryByCourse = new Map((directoryResult.data || []).map((item) => [item.course_id, item]));
  return {
    data: coursesResult.data.map((course) => {
      const listing = directoryByCourse.get(course.id);
      return {
        ...course,
        code: course.course_code || "CLASS",
        term: course.teaching_window || "Term not set",
        division: course.education_division,
        published: course.status === "published" && Boolean(listing?.is_listed),
        publicationStatus: course.status,
        students: (membershipResult.data || []).filter((item) => item.course_id === course.id && item.role === "learner").length,
        pendingRequests: (requestResult.data || []).filter((item) => item.course_id === course.id && item.status === "pending").length,
        verificationStatus: listing?.educator_verification_status || "unverified",
        institutionName: listing?.institution_name || "Independent course",
      };
    }),
    error: coursesResult.error || directoryResult.error || membershipResult.error || requestResult.error,
    source: "cloud",
  };
}

export async function listProfessorEnrollmentRequests() {
  if (!isSupabaseConfigured) return { data: [], source: "device" };
  const requestResult = await supabase
    .from("student_enrollment_requests")
    .select("id,course_id,student_id,status,requested_at,decided_at")
    .order("requested_at", { ascending: false });
  if (requestResult.error || !requestResult.data?.length) {
    return { data: requestResult.data || [], error: requestResult.error, source: requestResult.error ? "device" : "cloud" };
  }
  const courseIds = [...new Set(requestResult.data.map((request) => request.course_id))];
  const courseResult = await supabase
    .from("courses")
    .select("id,course_code,title,education_division")
    .in("id", courseIds);
  const coursesById = new Map((courseResult.data || []).map((course) => [course.id, course]));
  return {
    data: requestResult.data.map((request) => ({ ...request, course: coursesById.get(request.course_id) || null })),
    error: requestResult.error || courseResult.error,
    source: courseResult.error ? "device" : "cloud",
  };
}

export async function submitPortalInterest(payload) {
  if (!isSupabaseConfigured) return { data: null, error: new Error("The signup service is not connected."), source: "device" };
  const { error } = await supabase
    .from("portal_interest_submissions")
    .insert({
      kind: payload.kind,
      name: payload.name?.trim() || "",
      email: payload.email?.trim().toLowerCase() || "",
      school: payload.school?.trim() || "",
      message: payload.message?.trim() || "",
      education_division: payload.educationDivision === "k12" ? "k12" : "university",
      source_path: `${window.location.pathname}${window.location.hash}`.slice(0, 500),
    });
  return { data: error ? null : { submitted: true }, error, source: error ? "device" : "cloud" };
}

export async function submitEducatorVerification(request) {
  return supabase.from("educator_verification_requests").upsert(request, { onConflict: "user_id" }).select().single();
}

export async function listEducatorVerificationRequests() {
  return supabase
    .from("educator_verification_requests")
    .select("user_id,institution_name,education_division,department,teacher_identifier_last4,secure_file_id,status,submitted_at,profiles(full_name,email)")
    .order("submitted_at", { ascending: true });
}

export async function reviewEducatorVerification(userId, decision) {
  return supabase.rpc("review_educator_verification", { p_user_id: userId, p_decision: decision });
}
