import { PERSONAS as BASE_PERSONAS } from "./personas.js";
import { ATLAS_PORTRAIT, JAYLEN_PORTRAIT } from "./portraits.js";

export const PERSONAS = {
  ...BASE_PERSONAS,
  k12: { ...BASE_PERSONAS.k12, image: JAYLEN_PORTRAIT },
  professor: { ...BASE_PERSONAS.professor, image: ATLAS_PORTRAIT },
};
