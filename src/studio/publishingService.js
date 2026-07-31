import { supabase } from "../supabaseClient.js";

export async function listProfessorPublicationCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("id,course_code,title,status,education_division")
    .order("updated_at", { ascending: false });
  return { data: data || [], error };
}

export async function setPublicationLibraryAccess({
  publicationId,
  accessModel,
  readingMode,
  courseId,
  priceCents,
  rentalDays,
}) {
  return supabase.rpc("set_publication_library_access", {
    p_publication_id: publicationId,
    p_access_model: accessModel,
    p_reading_mode: readingMode,
    p_course_id: courseId || null,
    p_price_cents: priceCents ?? null,
    p_rental_days: rentalDays ?? null,
  });
}
