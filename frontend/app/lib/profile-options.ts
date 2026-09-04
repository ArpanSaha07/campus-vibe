/**
 * The fixed vocabularies the profile editor offers.
 *
 * Here rather than inline in the components because two screens read them --
 * the editor writes these values and the profile page displays them -- and
 * because they are the part most likely to be replaced by a real endpoint
 * later. When that happens this file becomes the adapter, not every form.
 */

/** Degree types, broadest population first. */
export const DEGREES = [
  "Bachelor's",
  "Master's",
  "PhD",
  "Visiting student",
  "Continuing studies",
  "Other",
] as const;

/**
 * McGill's faculties and schools.
 *
 * Transcribed from the university's own list and ordered as McGill orders it:
 * alphabetical, except that the named faculties sort under their discipline
 * rather than their benefactor -- Desautels under Management, Schulich under
 * Music -- which is how a student would look for them.
 *
 * Worth re-checking against mcgill.ca before launch; faculties do get renamed,
 * and Dental Medicine and Oral Health Sciences was called Dentistry until 2022.
 */
export const MCGILL_FACULTIES = [
  "Faculty of Agricultural and Environmental Sciences",
  "Faculty of Arts",
  "Faculty of Dental Medicine and Oral Health Sciences",
  "Faculty of Education",
  "Faculty of Engineering",
  "Faculty of Graduate and Postdoctoral Studies",
  "Faculty of Law",
  "Desautels Faculty of Management",
  "Faculty of Medicine and Health Sciences",
  "Schulich School of Music",
  "Faculty of Science",
  "School of Continuing Studies",
] as const;

/*
 * The interest catalogue used to live here, as INTEREST_CATEGORIES and
 * ALL_INTERESTS. It now lives in the database, seeded by
 * V20__insert_interest_catalogue.sql, and reaches the picker through
 * GET /api/v1/interests -- see useInterestCatalogue.
 *
 * It moved because a profile stores catalogue slugs and the FK behind
 * user_interests has to be able to check them. A copy of the list here as well
 * would be two vocabularies that must agree with nothing checking that they do,
 * which is exactly the failure contracts/api-dto-fields.json exists to stop.
 *
 * The two constants above stay: nothing stores a foreign key to a degree or a
 * faculty, so there is nothing for a table to enforce -- and faculties get
 * renamed, which a CHECK constraint or a reference table would turn into a
 * migration that has to ship before the frontend can.
 */
