import { supabase } from "../supabaseClient.js";
export {
  loadMarketplaceDashboard,
  startSellerOnboarding,
  submitCommercialListing,
  submitRightsReview,
  submitSellerApplication,
} from "../marketplace/marketplaceService.js";

function normalizeSingleRpcRow(result) {
  return {
    ...result,
    data: Array.isArray(result.data) ? result.data[0] || null : result.data,
  };
}

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

export async function loadPublicationLearningLayerForAuthor(publicationId) {
  return supabase.rpc("get_publication_learning_layer_for_author", {
    p_publication_id: publicationId,
  });
}

export async function savePublicationLearningLayer({
  publicationId,
  learningLayer,
  changeSummary,
}) {
  const result = await supabase.rpc("save_publication_learning_layer", {
    p_publication_id: publicationId,
    p_learning_layer: learningLayer,
    p_change_summary: changeSummary || "",
  });
  return normalizeSingleRpcRow(result);
}

export async function loadPublicationReadingProgress(publicationId, userId) {
  let query = supabase
    .from("publication_reading_progress")
    .select("*")
    .eq("publication_id", publicationId);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.maybeSingle();
  return { data, error };
}

export async function savePublicationReadingProgress({
  publicationId,
  chapterIndex,
  chapterId,
  interactionState,
  complete = false,
}) {
  const result = await supabase.rpc("save_publication_reading_progress", {
    p_publication_id: publicationId,
    p_chapter_index: chapterIndex,
    p_chapter_id: chapterId,
    p_interaction_state: interactionState || {},
    p_complete: Boolean(complete),
  });
  return normalizeSingleRpcRow(result);
}
