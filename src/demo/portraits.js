import atlas0 from "./portrait-data/atlas-0.js";
import atlas1 from "./portrait-data/atlas-1.js";
import atlas2 from "./portrait-data/atlas-2.js";
import atlas3 from "./portrait-data/atlas-3.js";
import atlas4 from "./portrait-data/atlas-4.js";
import jaylen0 from "./portrait-data/jaylen-0.js";
import jaylen1 from "./portrait-data/jaylen-1.js";
import jaylen2 from "./portrait-data/jaylen-2.js";
import jaylen3 from "./portrait-data/jaylen-3.js";
import jaylen4 from "./portrait-data/jaylen-4.js";

const jpegDataUri = (...chunks) => `data:image/jpeg;base64,${chunks.join("")}`;

export const ATLAS_PORTRAIT = jpegDataUri(atlas0, atlas1, atlas2, atlas3, atlas4);
export const JAYLEN_PORTRAIT = jpegDataUri(jaylen0, jaylen1, jaylen2, jaylen3, jaylen4);
