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
  return supabase.from("student_enrollment_requests").upsert(
    {
      course_id: courseId,
      roster_entry_id: rosterEntryId,
      student_id: studentId,
      status: "pending",
    },
    { onConflict: "course_id,student_id" }
  );
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

export async function listCurrentStudentCourses() {
  if (!isSupabaseConfigured) return { data: [], source: "device" };
  const { data, error } = await supabase
    .from("courses")
    .select("id,course_code,title,subject,teaching_window,status,education_division")
    .order("updated_at", { ascending: false });
  return { data: data || [], error, source: error ? "device" : "cloud" };
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
