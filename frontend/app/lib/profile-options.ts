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

/**
 * The interest catalogue, grouped for the Browse by category filter.
 *
 * A fixed list rather than free text, so that two people who both like board
 * games are discoverable as the same thing. Subjects are free text for the
 * opposite reason: nobody can enumerate every course McGill offers.
 */
export const INTEREST_CATEGORIES: { category: string; interests: string[] }[] = [
  {
    category: "Academic & career",
    interests: [
      "Study groups",
      "Research",
      "Entrepreneurship",
      "Networking",
      "Public speaking",
      "Case competitions",
      "Hackathons",
      "Career fairs",
    ],
  },
  {
    category: "Arts & culture",
    interests: [
      "Theatre",
      "Film",
      "Photography",
      "Painting",
      "Creative writing",
      "Poetry",
      "Museums",
      "Design",
    ],
  },
  {
    category: "Music",
    interests: ["Live music", "Choir", "Jazz", "Classical", "DJing", "Open mic", "Band"],
  },
  {
    category: "Sports & fitness",
    interests: [
      "Intramurals",
      "Running",
      "Climbing",
      "Yoga",
      "Hockey",
      "Soccer",
      "Basketball",
      "Swimming",
      "Ski & snowboard",
      "Cycling",
    ],
  },
  {
    category: "Food & drink",
    interests: ["Cooking", "Baking", "Coffee", "Food tours", "Potlucks"],
  },
  {
    category: "Games",
    interests: ["Board games", "Video games", "Chess", "Trivia", "Tabletop RPGs"],
  },
  {
    category: "Community & causes",
    interests: [
      "Volunteering",
      "Sustainability",
      "Mental health",
      "Mutual aid",
      "Human rights",
      "Fundraising",
    ],
  },
  {
    category: "Identity & community",
    interests: [
      "International students",
      "LGBTQ+",
      "Faith & spirituality",
      "Women in STEM",
      "Black student community",
      "Indigenous community",
    ],
  },
  {
    category: "Languages",
    interests: [
      "French conversation",
      "English conversation",
      "Language exchange",
      "Spanish",
      "Mandarin",
    ],
  },
  {
    category: "Outdoors",
    interests: ["Hiking", "Camping", "Canoeing", "Birdwatching", "Gardening"],
  },
  {
    category: "Tech",
    interests: [
      "Web development",
      "AI & machine learning",
      "Data science",
      "Cybersecurity",
      "Robotics",
      "Open source",
    ],
  },
  {
    category: "Social",
    interests: ["Make friends", "New in town", "Karaoke", "Movie nights", "Parties"],
  },
];

/** Every interest in the catalogue, flattened, in category order. */
export const ALL_INTERESTS = INTEREST_CATEGORIES.flatMap((group) => group.interests);
