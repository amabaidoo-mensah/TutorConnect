import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { isStudentVerificationActive, isTutorVerificationActive } from "./accountVerification";
import "./App.css";

type Role = "student" | "tutor" | "admin";
type Section = "discover" | "student" | "tutor" | "admin" | "profile" | "programmes" | "resources";
type Institution = { id: number; name: string };
type AcademicUnit = { id: number; name: string; unit_type: string; parent_id: number | null };
type Profile = {
  id: string;
  full_name: string;
  role: Role;
  bio: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  phone: string | null;
  contact_email: string | null;
  whatsapp_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  website_url: string | null;
};
type SearchTutor = {
  id: string;
  name: string;
  bio: string | null;
  rate: number | null;
  delivery: string | null;
  course_code: string;
  avg_rating: number | null;
  review_count: number;
  featured: boolean;
  department_id: number | null;
  department: string | null;
  school: string | null;
  college: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
};
type GroupedSearchTutor = Omit<SearchTutor, "course_code"> & { course_codes: string[] };
type TutorResource = { id: number; tutor_id: string; course_id: number | null; course_code?: string | null; resource_type: "teaching_video" | "course_resource" | "past_questions"; title: string; url: string | null; storage_path: string | null; resource_payment_id: string | null; signed_url?: string | null; description: string | null; created_at: string };
type TutorResourceWithCourse = TutorResource & { courses: { code: string } | { code: string }[] | null };
type CourseLearningResource = { id: number; course_id: number; resource_type: "video" | "notes" | "open_textbook" | "practice" | "past_questions"; title: string; url: string; source_name: string; description: string | null; license_name: string | null; license_url: string | null };
type SubjectLearningResource = { title: string; kind: string; url: string; source: string; description: string; license?: string; license_url?: string };
type SubjectLearningResourceGroup = { subject: string; resources: SubjectLearningResource[] };
type ContactDetails = {
  phone: string | null;
  email: string | null;
  whatsapp_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  website_url: string | null;
};
type Contact = ContactDetails & { tutor_id: string };
type Review = { id: number; tutor_id: string; student_id: string; rating: number; comment: string | null; status: string; created_at: string };
type Report = { id: number; tutor_id: string; reporter_id: string; category: string; description: string; status: string; resolution: string | null; created_at: string };
type TutorProfile = { id: string; bio: string | null; qualifications: string | null; rate: number | null; delivery: string | null; availability: string | null; status: string; premium_until: string | null; views: number };
type Course = { id: number; institution_id: number; code: string; title: string; academic_unit_id: number | null; source_url: string | null };
type AcademicProgramme = { id: number; programme_title: string; award: string; level: string; catalogue_unit: string; college_name: string | null; school_name: string | null; source_url: string };
type TutorCourse = { id: number; status: string; courses: Course | null };
type CourseCatalogueRequest = {
  id: number;
  institution_id: number;
  requested_by: string;
  code: string;
  title: string;
  academic_unit_id: number | null;
  source_url: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  course_id: number | null;
  created_at: string;
};
type TutorStats = { profile_views: number; contact_unlocks: number; review_count: number; average_rating: number | null };
type AdminTutor = { id: string; bio: string | null; qualifications: string | null; status: string };
type AdminTutorCourse = { id: number; tutor_id: string; status: string; courses: Course | null };
type AdminProfile = { id: string; full_name: string | null; role: Role };
type AdminAction = { id: number; admin_id: string; target_id: string; action: string; reason: string; created_at: string };
type DemoPaymentReceipt = {
  reference: string;
  purpose: "contact" | "premium" | "resource";
  amount: number;
  description: string;
  created_at: string;
};

function ContactLinks({ contact }: { contact: ContactDetails }) {
  const phoneHref = contact.phone?.replace(/[^\d+]/g, "");
  return <div className="contact-details">
    {contact.phone ? <a href={`tel:${phoneHref}`}>Phone: {contact.phone}</a> : <span>Phone not listed</span>}
    {contact.email ? <a href={`mailto:${contact.email}`}>Email: {contact.email}</a> : <span>Email not listed</span>}
    {contact.whatsapp_url && <a href={contact.whatsapp_url} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
    {contact.instagram_url && <a href={contact.instagram_url} target="_blank" rel="noopener noreferrer">Instagram</a>}
    {contact.facebook_url && <a href={contact.facebook_url} target="_blank" rel="noopener noreferrer">Facebook</a>}
    {contact.linkedin_url && <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
    {contact.x_url && <a href={contact.x_url} target="_blank" rel="noopener noreferrer">X</a>}
    {contact.website_url && <a href={contact.website_url} target="_blank" rel="noopener noreferrer">Website</a>}
  </div>;
}

function optionalFormValue(values: FormData, name: string) {
  return String(values.get(name) || "").trim() || null;
}
function readDemoResources(): TutorResource[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem("tutorconnect-demo-resources") || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item: unknown): item is TutorResource =>
      item !== null
      && typeof item === "object"
      && "id" in item && typeof item.id === "number"
      && "tutor_id" in item && typeof item.tutor_id === "string"
      && "course_id" in item && typeof item.course_id === "number"
      && "course_code" in item && typeof item.course_code === "string"
      && "resource_type" in item && ["teaching_video", "course_resource", "past_questions"].includes(String(item.resource_type))
      && "title" in item && typeof item.title === "string"
      && "url" in item && typeof item.url === "string"
      && "created_at" in item && typeof item.created_at === "string",
    );
  } catch {
    return [];
  }
}
function readDemoCourseCatalogueRequests(): CourseCatalogueRequest[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem("tutorconnect-demo-course-requests") || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item: unknown): item is CourseCatalogueRequest =>
      item !== null
      && typeof item === "object"
      && "id" in item && typeof item.id === "number"
      && "institution_id" in item && typeof item.institution_id === "number"
      && "requested_by" in item && typeof item.requested_by === "string"
      && "code" in item && typeof item.code === "string"
      && "title" in item && typeof item.title === "string"
      && "academic_unit_id" in item && (item.academic_unit_id === null || typeof item.academic_unit_id === "number")
      && "source_url" in item && (item.source_url === null || typeof item.source_url === "string")
      && "status" in item && ["pending", "approved", "rejected"].includes(String(item.status))
      && "admin_note" in item && (item.admin_note === null || typeof item.admin_note === "string")
      && "course_id" in item && (item.course_id === null || typeof item.course_id === "number")
      && "created_at" in item && typeof item.created_at === "string",
    );
  } catch {
    return [];
  }
}
async function paymentErrorMessage(error: unknown) {
  let detail = error instanceof Error ? error.message : "The payment request failed.";
  let status: number | null = null;
  if (error && typeof error === "object" && "context" in error && error.context instanceof Response) {
    const response = error.context;
    status = response.status;
    try {
      const body: unknown = await response.clone().json();
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        detail = body.error;
      } else if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
        detail = body.message;
      }
    } catch {
      detail = response.statusText || detail;
    }
  }
  const statusText = status ? ` (HTTP ${status})` : "";
  return `Payment service${statusText}: ${detail} If this is a live checkout, verify the payments Edge Function is deployed and PAYSTACK_SECRET is configured.`;
}
function VerifiedBadge({ label }: { label: string }) {
  return <span className="verified-mark" role="img" aria-label={label} title={label}>
    <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3.3 8.2 3 3 6.4-6.5" /></svg>
  </span>;
}

async function signTutorResourceFiles(resources: TutorResource[]) {
  const client = supabase;
  if (!client) return resources;
  return Promise.all(resources.map(async (resource) => {
    if (!resource.storage_path) return { ...resource, signed_url: null };
    const { data, error } = await client.storage.from("tutor-resources").createSignedUrl(resource.storage_path, 3600);
    if (error) throw new Error(`Could not load a tutor resource: ${error.message}`);
    return { ...resource, signed_url: data.signedUrl };
  }));
}

const unitPath = (id: number | null, units: AcademicUnit[]) => {
  const parts: string[] = [];
  let unit = units.find((item) => item.id === id);
  while (unit) {
    parts.unshift(unit.name);
    unit = units.find((item) => item.id === unit?.parent_id);
  }
  return parts.join(" / ") || "Unassigned department";
};

const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
const roleFrom = (value: string): Role => value === "admin" || value === "tutor" ? value : "student";
const resourceLabel = (type: TutorResource["resource_type"]) => type === "teaching_video" ? "Teaching preview" : type === "past_questions" ? "Past questions" : "Course resource";
const resourceFileSizeLimit = 50 * 1024 * 1024;
const resourceFileExtensions: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const courseResourceLabel = (type: CourseLearningResource["resource_type"]) => ({
  video: "Video lesson",
  notes: "Notes",
  open_textbook: "Open textbook",
  practice: "Practice materials",
  past_questions: "Past questions",
}[type]);

const presentationInstitution: Institution = { id: -1, name: "University of Cape Coast (demo)" };
const presentationUnits: AcademicUnit[] = [
  { id: -1, name: "College of Science and Technology", unit_type: "college", parent_id: null },
  { id: -2, name: "School of Physical Sciences", unit_type: "school", parent_id: -1 },
  { id: -3, name: "Computer Science and Information Technology", unit_type: "department", parent_id: -2 },
  { id: -4, name: "School of Business", unit_type: "school", parent_id: -1 },
  { id: -5, name: "Management Studies", unit_type: "department", parent_id: -4 },
  { id: -6, name: "Mathematics", unit_type: "department", parent_id: -2 },
];
const presentationTutors: SearchTutor[] = [
  {
    id: "demo-tutor-computing",
    name: "Tutor Ama",
    bio: "Fictional profile for demonstrating course-matched tutor discovery.",
    rate: 45,
    delivery: "Online",
    course_code: "CS101",
    avg_rating: 4.8,
    review_count: 12,
    featured: false,
    department_id: -3,
    department: "Computer Science and Information Technology",
    school: "School of Physical Sciences",
    college: "College of Science and Technology",
    avatar_path: null,
    avatar_url: null,
  },
  {
    id: "demo-tutor-computing",
    name: "Tutor Ama",
    bio: "Fictional profile for demonstrating course-matched tutor discovery.",
    rate: 45,
    delivery: "Online",
    course_code: "CS102",
    avg_rating: 4.8,
    review_count: 12,
    featured: false,
    department_id: -3,
    department: "Computer Science and Information Technology",
    school: "School of Physical Sciences",
    college: "College of Science and Technology",
    avatar_path: null,
    avatar_url: null,
  },
  {
    id: "demo-tutor-mathematics",
    name: "Tutor Kofi",
    bio: "Fictional profile for demonstrating online mathematics support.",
    rate: 55,
    delivery: "Both",
    course_code: "MATH120",
    avg_rating: 4.6,
    review_count: 8,
    featured: false,
    department_id: -6,
    department: "Mathematics",
    school: "School of Physical Sciences",
    college: "College of Science and Technology",
    avatar_path: null,
    avatar_url: null,
  },
  {
    id: "demo-tutor-business",
    name: "Tutor Esi",
    bio: "Fictional profile for demonstrating business-course support.",
    rate: 40,
    delivery: "Online",
    course_code: "BUS204",
    avg_rating: 4.9,
    review_count: 15,
    featured: false,
    department_id: -5,
    department: "Management Studies",
    school: "School of Business",
    college: "College of Science and Technology",
    avatar_path: null,
    avatar_url: null,
  },
];
const presentationTutorResources: TutorResource[] = [
  {
    id: -1,
    tutor_id: "demo-tutor-computing",
    course_id: -2,
    course_code: "CS101",
    resource_type: "course_resource",
    title: "CS50 Week 0: Scratch and computational thinking",
    url: "https://youtu.be/2WtPyqwTLKM",
    storage_path: null,
    resource_payment_id: null,
    description: "External Harvard CS50 lecture, not created by this fictional tutor.",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: -2,
    tutor_id: "demo-tutor-computing",
    course_id: -3,
    course_code: "CS102",
    resource_type: "course_resource",
    title: "CS50P: Programming with Python video course",
    url: "https://www.youtube.com/playlist?list=PLhQjrBD2T3817j24-GogXmWqO5Q5vYy0V",
    storage_path: null,
    resource_payment_id: null,
    description: "External Harvard CS50 playlist, not created by this fictional tutor.",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: -3,
    tutor_id: "demo-tutor-mathematics",
    course_id: -1,
    course_code: "MATH120",
    resource_type: "course_resource",
    title: "MIT 18.06 Linear Algebra lecture playlist",
    url: "https://www.youtube.com/playlist?list=PLE7DDD91010BC51F8",
    storage_path: null,
    resource_payment_id: null,
    description: "External MIT OpenCourseWare lectures, not created by this fictional tutor.",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: -4,
    tutor_id: "demo-tutor-business",
    course_id: -4,
    course_code: "BUS204",
    resource_type: "course_resource",
    title: "OpenStax: Principles of Management",
    url: "https://openstax.org/books/principles-management/pages/1-introduction",
    storage_path: null,
    resource_payment_id: null,
    description: "External free-to-read OpenStax textbook, not created by this fictional tutor.",
    created_at: "2026-01-01T00:00:00Z",
  },
];
const presentationResources: Array<Course & { resources: CourseLearningResource[] }> = [
  {
    id: -1,
    institution_id: presentationInstitution.id,
    code: "MATH120",
    title: "Linear Algebra I (demo course)",
    academic_unit_id: -6,
    source_url: null,
    resources: [{
      id: -1,
      course_id: -1,
      resource_type: "video",
      title: "MIT OpenCourseWare: Linear Algebra",
      url: "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/",
      source_name: "MIT OpenCourseWare (external example)",
      description: "Free course materials include lecture videos, problem sets and exams; not a TutorConnect tutor lesson.",
      license_name: "CC BY-NC-SA 4.0 (check individual asset credits)",
      license_url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    }, {
      id: -4,
      course_id: -1,
      resource_type: "video",
      title: "MIT 18.06 Linear Algebra lectures on YouTube",
      url: "https://www.youtube.com/playlist?list=PLE7DDD91010BC51F8",
      source_name: "MIT OpenCourseWare",
      description: "MIT professor Gilbert Strang's Spring 2005 lecture playlist.",
      license_name: "CC BY-NC-SA 4.0 (check individual asset credits)",
      license_url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    }],
  },
  {
    id: -2,
    institution_id: presentationInstitution.id,
    code: "CS101",
    title: "Introduction to Computer Science (demo course)",
    academic_unit_id: -3,
    source_url: null,
    resources: [{
      id: -2,
      course_id: -2,
      resource_type: "open_textbook",
      title: "Harvard CS50: Introduction to Computer Science",
      url: "https://cs50.harvard.edu/x/",
      source_name: "Harvard CS50 (external example)",
      description: "Public external study material used to illustrate the library; not a TutorConnect tutor lesson.",
      license_name: null,
      license_url: null,
    }, {
      id: -5,
      course_id: -2,
      resource_type: "video",
      title: "CS50 Week 0: Scratch and computational thinking",
      url: "https://youtu.be/2WtPyqwTLKM",
      source_name: "Harvard CS50",
      description: "Official introductory lecture video; free course materials are available on the CS50 site.",
      license_name: null,
      license_url: null,
    }],
  },
  {
    id: -3,
    institution_id: presentationInstitution.id,
    code: "CS102",
    title: "Programming with Python (demo course)",
    academic_unit_id: -3,
    source_url: null,
    resources: [{
      id: -6,
      course_id: -3,
      resource_type: "open_textbook",
      title: "Harvard CS50P: Introduction to Programming with Python",
      url: "https://cs50.harvard.edu/python/",
      source_name: "Harvard CS50 (external example)",
      description: "Free self-paced course materials; not a TutorConnect tutor lesson.",
      license_name: null,
      license_url: null,
    }, {
      id: -7,
      course_id: -3,
      resource_type: "video",
      title: "CS50P Python programming video playlist",
      url: "https://www.youtube.com/playlist?list=PLhQjrBD2T3817j24-GogXmWqO5Q5vYy0V",
      source_name: "Harvard CS50",
      description: "Official CS50P lecture playlist on YouTube.",
      license_name: null,
      license_url: null,
    }],
  },
  {
    id: -4,
    institution_id: presentationInstitution.id,
    code: "BUS204",
    title: "Business and Management (demo course)",
    academic_unit_id: -5,
    source_url: null,
    resources: [{
      id: -8,
      course_id: -4,
      resource_type: "open_textbook",
      title: "OpenStax: Principles of Management",
      url: "https://openstax.org/books/principles-management/pages/1-introduction",
      source_name: "OpenStax",
      description: "Free-to-read management textbook. The book is licensed for non-commercial sharing and adaptation.",
      license_name: "CC BY-NC-SA 4.0",
      license_url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    }, {
      id: -9,
      course_id: -4,
      resource_type: "notes",
      title: "MIT OpenCourseWare: Financial and Managerial Accounting",
      url: "https://ocw.mit.edu/courses/15-501-introduction-to-financial-and-managerial-accounting-spring-2004/",
      source_name: "MIT OpenCourseWare",
      description: "Course notes, exams and problem sets for undergraduate accounting.",
      license_name: "CC BY-NC-SA 4.0 (check individual asset credits)",
      license_url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    }, {
      id: -10,
      course_id: -4,
      resource_type: "video",
      title: "MIT OpenCourseWare business lecture videos on YouTube",
      url: "https://www.youtube.com/mitocw",
      source_name: "MIT OpenCourseWare",
      description: "Official video channel; use the course guide above to find the matching topic.",
      license_name: null,
      license_url: null,
    }],
  },
];
const curatedSubjectResources: SubjectLearningResourceGroup[] = [
  {
    subject: "Mathematics",
    resources: [
      {
        title: "MIT OpenCourseWare: Linear Algebra (18.06)",
        kind: "Free course materials",
        url: "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/",
        source: "MIT OpenCourseWare",
        description: "Lecture videos, problem sets, exams and solutions covering matrix theory and linear algebra.",
        license: "CC BY-NC-SA 4.0 (check individual asset credits)",
        license_url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
      },
      {
        title: "MIT 18.06 Linear Algebra lectures (YouTube)",
        kind: "YouTube playlist",
        url: "https://www.youtube.com/playlist?list=PLE7DDD91010BC51F8",
        source: "MIT OpenCourseWare",
        description: "Gilbert Strang's Spring 2005 lecture playlist.",
        license: "CC BY-NC-SA 4.0 (check individual asset credits)",
        license_url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
      },
      {
        title: "3Blue1Brown: Essence of Calculus",
        kind: "YouTube playlist",
        url: "https://www.youtube.com/playlist?list=PLZHQObOWTQDMsr9K-rj53DwVRMYO3t5Yr",
        source: "3Blue1Brown",
        description: "Visual intuition for core calculus concepts.",
      },
    ],
  },
  {
    subject: "Computer Science",
    resources: [
      {
        title: "Harvard CS50x: Introduction to Computer Science",
        kind: "Free self-paced course",
        url: "https://cs50.harvard.edu/x/",
        source: "Harvard CS50",
        description: "Free course covering algorithms, programming, data structures, SQL and web development.",
      },
      {
        title: "CS50 Week 0: Scratch and computational thinking",
        kind: "YouTube lecture",
        url: "https://youtu.be/2WtPyqwTLKM",
        source: "Harvard CS50",
        description: "Official introductory lecture; course notes and exercises are linked from CS50x.",
      },
      {
        title: "CS50P: Introduction to Programming with Python",
        kind: "YouTube playlist",
        url: "https://www.youtube.com/playlist?list=PLhQjrBD2T3817j24-GogXmWqO5Q5vYy0V",
        source: "Harvard CS50",
        description: "Official lecture playlist for the free Python programming course.",
      },
    ],
  },
  {
    subject: "Business and Management",
    resources: [
      {
        title: "OpenStax: Principles of Management",
        kind: "Free-to-read textbook",
        url: "https://openstax.org/books/principles-management/pages/1-introduction",
        source: "OpenStax, Rice University",
        description: "Introductory management text. Its CC BY-NC-SA license limits reuse to non-commercial sharing and adaptation.",
        license: "CC BY-NC-SA 4.0",
        license_url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
      },
      {
        title: "MIT OpenCourseWare: Financial and Managerial Accounting",
        kind: "Free course materials",
        url: "https://ocw.mit.edu/courses/15-501-introduction-to-financial-and-managerial-accounting-spring-2004/",
        source: "MIT OpenCourseWare",
        description: "Undergraduate accounting course with lecture notes, problem sets and exams.",
        license: "CC BY-NC-SA 4.0 (check individual asset credits)",
        license_url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
      },
      {
        title: "MIT OpenCourseWare business lecture videos",
        kind: "YouTube channel",
        url: "https://www.youtube.com/mitocw",
        source: "MIT OpenCourseWare",
        description: "Official video channel; use the accounting course guide above to find the matching subject material.",
      },
    ],
  },
];
const presentationProgrammes: AcademicProgramme[] = [
  { id: -1, programme_title: "Example BSc Computer Science", award: "Bachelor's degree", level: "Undergraduate", catalogue_unit: "Computer Science and Information Technology", college_name: "College of Science and Technology", school_name: "School of Physical Sciences", source_url: "" },
  { id: -2, programme_title: "Example BSc Business Administration", award: "Bachelor's degree", level: "Undergraduate", catalogue_unit: "Management Studies", college_name: "College of Science and Technology", school_name: "School of Business", source_url: "" },
  { id: -3, programme_title: "Example MSc Information Technology", award: "Master's degree", level: "Postgraduate", catalogue_unit: "Computer Science and Information Technology", college_name: "College of Science and Technology", school_name: "School of Physical Sciences", source_url: "" },
];
const presentationDemoCourses: Course[] = [
  { id: -2, institution_id: -1, code: "CS101", title: "Introduction to Computing", academic_unit_id: -3, source_url: null },
  { id: -3, institution_id: -1, code: "CS102", title: "Programming Fundamentals", academic_unit_id: -3, source_url: null },
  { id: -1, institution_id: -1, code: "MATH120", title: "Linear Algebra", academic_unit_id: -6, source_url: null },
  { id: -4, institution_id: -1, code: "BUS204", title: "Business Management", academic_unit_id: -5, source_url: null },
  { id: -5, institution_id: -1, code: "STAT101", title: "Introduction to Statistics", academic_unit_id: -6, source_url: null },
  { id: -6, institution_id: -1, code: "ECON101", title: "Principles of Economics", academic_unit_id: -5, source_url: null },
  { id: -7, institution_id: -1, code: "ACCT101", title: "Introduction to Accounting", academic_unit_id: -5, source_url: null },
  { id: -8, institution_id: -1, code: "PHYS101", title: "General Physics", academic_unit_id: -2, source_url: null },
  { id: -9, institution_id: -1, code: "CHEM101", title: "General Chemistry", academic_unit_id: -2, source_url: null },
  { id: -10, institution_id: -1, code: "BIOL101", title: "General Biology", academic_unit_id: -2, source_url: null },
  { id: -11, institution_id: -1, code: "WRIT101", title: "Academic Writing", academic_unit_id: null, source_url: null },
];

export default function App() {
  const presentationDemo = new URLSearchParams(window.location.search).get("demo") === "1";
  const demoRole = new URLSearchParams(window.location.search).get("role");
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const authUserId = useRef<string | null>(null);
  const profileLoadRequest = useRef(0);
  const avatarPreviewUrl = useRef<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [recentlyUnlockedContact, setRecentlyUnlockedContact] = useState<Contact | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>(presentationDemo ? [presentationInstitution] : []);
  const [institutionId, setInstitutionId] = useState<number | "">(presentationDemo ? presentationInstitution.id : "");
  const [units, setUnits] = useState<AcademicUnit[]>(presentationDemo ? presentationUnits : []);
  const [unitId, setUnitId] = useState<number | "">("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchTutor[]>(presentationDemo ? presentationTutors : []);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [studentReviews, setStudentReviews] = useState<Review[]>([]);
  const [studentReports, setStudentReports] = useState<Report[]>([]);
  const [tutorProfile, setTutorProfile] = useState<TutorProfile | null>(null);
  const [tutorContact, setTutorContact] = useState<Contact | null>(null);
  const [tutorCourses, setTutorCourses] = useState<TutorCourse[]>([]);
  const [courseCatalogueRequests, setCourseCatalogueRequests] = useState<CourseCatalogueRequest[]>([]);
  const [tutorResources, setTutorResources] = useState<TutorResource[]>([]);
  const [resourceCredits, setResourceCredits] = useState<string[]>([]);
  const [resourceCreditsError, setResourceCreditsError] = useState<string | null>(null);
  const [resourcesByTutor, setResourcesByTutor] = useState<Record<string, TutorResource[]>>({});
  const [tutorReviews, setTutorReviews] = useState<Review[]>([]);
  const [tutorStats, setTutorStats] = useState<TutorStats | null>(null);
  const [courseOptions, setCourseOptions] = useState<Course[]>([]);
  const [courseSearchPerformed, setCourseSearchPerformed] = useState(false);
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [courseCatalogueFormOpen, setCourseCatalogueFormOpen] = useState(false);
  const [adminTutors, setAdminTutors] = useState<AdminTutor[]>([]);
  const [adminTutorCourses, setAdminTutorCourses] = useState<AdminTutorCourse[]>([]);
  const [adminCourseCatalogueRequests, setAdminCourseCatalogueRequests] = useState<CourseCatalogueRequest[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>([]);
  const [adminReports, setAdminReports] = useState<Report[]>([]);
  const [adminReviews, setAdminReviews] = useState<Review[]>([]);
  const [adminCourses, setAdminCourses] = useState<Course[]>([]);
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [academicProgrammes, setAcademicProgrammes] = useState<AcademicProgramme[]>(presentationDemo ? presentationProgrammes : []);
  const [courseResourceCourses, setCourseResourceCourses] = useState<Array<Course & { resources: CourseLearningResource[] }>>(presentationDemo ? presentationResources : []);
  const [courseResourcesLoading, setCourseResourcesLoading] = useState(false);
  const [courseResourcesError, setCourseResourcesError] = useState<string | null>(null);
  const [courseResourceQuery, setCourseResourceQuery] = useState("");
  const [courseResourceReload, setCourseResourceReload] = useState(0);
  const [programmesLoading, setProgrammesLoading] = useState(false);
  const [programmesError, setProgrammesError] = useState<string | null>(null);
  const [programmeQuery, setProgrammeQuery] = useState("");
  const [programmeLevel, setProgrammeLevel] = useState("");
  const [programmeReload, setProgrammeReload] = useState(0);
  const [hasSearched, setHasSearched] = useState(presentationDemo);
  const [section, setSection] = useState<Section>("discover");
  const [adminTab, setAdminTab] = useState("applications");
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot" | "update">("login");
  const [demoAuthRequested, setDemoAuthRequested] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoReceipt, setDemoReceipt] = useState<DemoPaymentReceipt | null>(null);
  const unitOptions = useMemo(() => units.filter((unit) => unit.unit_type === "department" || unit.unit_type === "school" || unit.unit_type === "college"), [units]);
  const profileNames = useMemo(() => Object.fromEntries(adminProfiles.map((item) => [item.id, item.full_name || "TutorConnect member"])), [adminProfiles]);
  const tutorVerified = isTutorVerificationActive(
    tutorProfile?.status ?? "",
    tutorProfile?.premium_until ?? null,
  );

  useEffect(() => () => {
    if (avatarPreviewUrl.current) URL.revokeObjectURL(avatarPreviewUrl.current);
  }, []);

  function clearAccountData() {
    setContacts({});
    setRecentlyUnlockedContact(null);
    setStudentReviews([]);
    setStudentReports([]);
    setTutorProfile(null);
    setTutorContact(null);
    setTutorCourses([]);
    setCourseCatalogueRequests([]);
    setTutorResources([]);
    setResourceCredits([]);
    setResourceCreditsError(null);
    setTutorReviews([]);
    setTutorStats(null);
    setAdminTutors([]);
    setAdminTutorCourses([]);
    setAdminCourseCatalogueRequests([]);
    setAdminProfiles([]);
    setAdminReports([]);
    setAdminReviews([]);
    setAdminCourses([]);
    setAdminActions([]);
  }

  useEffect(() => {
    if (!presentationDemo || (demoRole !== "student" && demoRole !== "tutor")) return;
    const role: Role = demoRole;
    const id = role === "tutor" ? "demo-tutor-computing" : "demo-student";
    setUser({ id, email: role === "tutor" ? "tutor.demo@example.com" : "student.demo@example.com" });
    setProfile({
      id,
      full_name: role === "tutor" ? "Tutor Ama" : "Demo Student",
      role,
      bio: role === "tutor" ? "Fictional tutor approved for the presentation demo." : "Fictional student account for the presentation demo.",
      avatar_path: null,
      avatar_url: null,
      is_verified: role === "tutor",
      phone: role === "student" ? "+233 20 000 0001" : null,
      contact_email: role === "student" ? "student.demo@example.com" : null,
      whatsapp_url: null,
      instagram_url: null,
      facebook_url: null,
      linkedin_url: null,
      x_url: null,
      website_url: null,
    });
    if (role === "tutor") {
      setTutorProfile({
        id,
        bio: "Fictional tutor profile for demonstrating premium listings and resource publishing.",
        qualifications: "Demo qualifications",
        rate: 45,
        delivery: "Online",
        availability: "Weekdays",
        status: "approved",
        premium_until: null,
        views: 0,
      });
      setTutorContact({
        tutor_id: id,
        phone: "+233 20 000 0002",
        email: "tutor.demo@example.com",
        whatsapp_url: "https://wa.me/233200000002",
        instagram_url: null,
        facebook_url: null,
        linkedin_url: null,
        x_url: null,
        website_url: null,
      });
      setTutorCourses([
        { id: -1, status: "approved", courses: { id: -2, institution_id: -1, code: "CS101", title: "Introduction to Computing", academic_unit_id: -3, source_url: null } },
        { id: -2, status: "approved", courses: { id: -3, institution_id: -1, code: "CS102", title: "Programming Fundamentals", academic_unit_id: -3, source_url: null } },
      ]);
      setCourseCatalogueRequests(readDemoCourseCatalogueRequests());
      setTutorResources([
        ...presentationTutorResources.filter((resource) => resource.tutor_id === id),
        ...readDemoResources().filter((resource) => resource.tutor_id === id),
      ]);
      try {
        const storedCredits = JSON.parse(localStorage.getItem("tutorconnect-demo-resource-credits") || "[]");
        setResourceCredits(Array.isArray(storedCredits) ? storedCredits : []);
      } catch {
        setResourceCredits([]);
      }
      setTutorStats({ profile_views: 24, contact_unlocks: 3, review_count: 2, average_rating: 4.8 });
    } else {
      setContacts({});
      setRecentlyUnlockedContact(null);
      setTutorResources(readDemoResources());
    }
  }, [presentationDemo, demoRole]);

  async function loadProfile(id: string) {
    if (!supabase) return;
    const requestId = ++profileLoadRequest.current;
    const client = supabase;
    setProfileLoading(true);
    setProfileLoadError("");
    try {
      let { data, error } = await client.from("profiles")
        .select("id,full_name,role,bio,avatar_path,account_status,phone,contact_email,whatsapp_url,instagram_url,facebook_url,linkedin_url,x_url,website_url")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);

      if (!data) {
        const { error: repairError } = await client.rpc("ensure_my_profile");
        if (repairError) {
          throw new Error(`Your account is signed in, but its profile could not be created. Apply Supabase migration 009, then retry. ${repairError.message}`);
        }
        const retry = await client.from("profiles")
          .select("id,full_name,role,bio,avatar_path,account_status,phone,contact_email,whatsapp_url,instagram_url,facebook_url,linkedin_url,x_url,website_url")
          .eq("id", id)
          .maybeSingle();
        if (retry.error) throw new Error(retry.error.message);
        data = retry.data;
      }
      if (!data) throw new Error("Your login is active, but no profile was found. Please retry or contact support.");
      if (authUserId.current && authUserId.current !== id) return;

      let avatarUrl: string | null = null;
      if (data.avatar_path) {
        const { data: signedPhoto, error: photoError } = await client.storage.from("profile-photos").createSignedUrl(data.avatar_path, 3600);
        if (photoError) setNotice(`Profile loaded, but the profile photo could not be loaded: ${photoError.message}`);
        else avatarUrl = signedPhoto.signedUrl;
      }

      let isVerified = false;
      if (data.account_status === "active" && data.role === "tutor") {
        const { data: tutor, error: tutorError } = await client.from("tutor_profiles")
          .select("status,premium_until")
          .eq("id", id)
          .maybeSingle();
        if (tutorError) setNotice(`Profile loaded, but tutor verification could not be checked: ${tutorError.message}`);
        else isVerified = isTutorVerificationActive(tutor?.status ?? "", tutor?.premium_until ?? null);
      } else if (data.account_status === "active" && data.role === "student") {
        const { data: paidUnlock, error: paymentError } = await client.from("payments")
          .select("id")
          .eq("user_id", id)
          .eq("purpose", "contact")
          .eq("status", "paid")
          .limit(1)
          .maybeSingle();
        if (paymentError) setNotice(`Profile loaded, but student verification could not be checked: ${paymentError.message}`);
        else isVerified = isStudentVerificationActive(data.role, data.account_status, !!paidUnlock);
      }

      if (requestId !== profileLoadRequest.current || (authUserId.current && authUserId.current !== id)) return;
      setProfile({
        id: data.id,
        full_name: data.full_name || "TutorConnect member",
        role: roleFrom(data.role),
        bio: data.bio,
        avatar_path: data.avatar_path,
        avatar_url: avatarUrl,
        is_verified: isVerified,
        phone: data.phone ?? null,
        contact_email: data.contact_email ?? null,
        whatsapp_url: data.whatsapp_url ?? null,
        instagram_url: data.instagram_url ?? null,
        facebook_url: data.facebook_url ?? null,
        linkedin_url: data.linkedin_url ?? null,
        x_url: data.x_url ?? null,
        website_url: data.website_url ?? null,
      });
    } catch (error) {
      if (requestId !== profileLoadRequest.current) return;
      const message = error instanceof Error ? error.message : "Could not load your account profile.";
      setProfileLoadError(message);
      setNotice(message);
    } finally {
      if (requestId === profileLoadRequest.current) setProfileLoading(false);
    }
  }

  useEffect(() => {
    if (presentationDemo && (demoRole === "student" || demoRole === "tutor")) return;
    if (!supabase) return;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      const accountChanged = authUserId.current !== nextUserId;
      if (accountChanged) {
        profileLoadRequest.current += 1;
        authUserId.current = nextUserId;
        clearAccountData();
        setProfile(null);
        setProfileLoadError("");
        setProfileLoading(false);
      }
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null);
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("update");
        setSection("discover");
        setNotice("Choose a new password for your account.");
      }
      if (session?.user && (accountChanged || event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "PASSWORD_RECOVERY")) {
        void Promise.resolve().then(() => loadProfile(session.user.id));
      }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setNotice(error.message);
      const sessionUser = data.session?.user;
      const nextUserId = sessionUser?.id ?? null;
      const accountChanged = authUserId.current !== nextUserId;
      if (accountChanged) {
        profileLoadRequest.current += 1;
        authUserId.current = nextUserId;
        clearAccountData();
        setProfile(null);
        setProfileLoadError("");
        setProfileLoading(false);
      }
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? null } : null);
      if (sessionUser && (accountChanged || !profile)) void loadProfile(sessionUser.id);
    }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not restore your sign-in session."));
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || presentationDemo) return;
    void supabase.from("institutions").select("id,name").eq("active", true).order("name").then(({ data, error }) => {
      if (error) {
        setNotice(error.message);
        return;
      }
      const rows: Institution[] = data ?? [];
      setInstitutions(rows);
      const ucc = rows.find((item) => item.name.toLowerCase().includes("cape coast"));
      if (ucc) setInstitutionId(ucc.id);
      else if (rows[0]) setInstitutionId(rows[0].id);
    });
  }, []);

  useEffect(() => {
    if (presentationDemo) {
      setUnits(presentationUnits);
      return;
    }
    if (!supabase || institutionId === "") {
      setUnits([]);
      return;
    }
    void supabase.from("academic_units").select("id,name,unit_type,parent_id").eq("institution_id", institutionId).eq("active", true).order("name").then(({ data, error }) => {
      if (error) {
        setNotice(error.message);
        return;
      }
      setUnits(data ?? []);
    });
  }, [institutionId]);

  useEffect(() => {
    if (section !== "resources") return;
    if (presentationDemo) {
      setCourseResourceCourses(presentationResources);
      setCourseResourcesError(null);
      setCourseResourcesLoading(false);
      return;
    }
    if (!supabase || institutionId === "") {
      setCourseResourceCourses([]);
      setCourseResourcesLoading(false);
      return;
    }

    let active = true;
    const client = supabase;
    setCourseResourcesLoading(true);
    setCourseResourcesError(null);
    void (async () => {
      try {
        const { data: courses, error: coursesError } = await client.from("courses")
          .select("id,institution_id,code,title,academic_unit_id,source_url")
          .eq("institution_id", institutionId)
          .eq("active", true)
          .order("title");
        if (!active) return;
        if (coursesError) {
          setCourseResourcesError(coursesError.message);
          setCourseResourceCourses([]);
          return;
        }

        const rows = (courses ?? []) as Course[];
        if (!rows.length) {
          setCourseResourceCourses([]);
          return;
        }

        const { data: resources, error: resourcesError } = await client.from("course_learning_resources")
          .select("id,course_id,resource_type,title,url,source_name,description,license_name,license_url")
          .in("course_id", rows.map((course) => course.id))
          .eq("active", true)
          .order("title");
        if (!active) return;
        if (resourcesError) {
          setCourseResourcesError(resourcesError.message);
          setCourseResourceCourses([]);
          return;
        }

        const grouped = (resources ?? []).reduce<Record<number, CourseLearningResource[]>>((items, resource: CourseLearningResource) => {
          items[resource.course_id] = [...(items[resource.course_id] ?? []), resource];
          return items;
        }, {});
        setCourseResourceCourses(rows
          .map((course) => ({ ...course, resources: grouped[course.id] ?? [] }))
          .filter((course) => course.resources.length > 0));
      } catch (error) {
        if (!active) return;
        setCourseResourcesError(error instanceof Error ? error.message : "An unexpected error occurred.");
        setCourseResourceCourses([]);
      } finally {
        if (active) setCourseResourcesLoading(false);
      }
    })();

    return () => { active = false; };
  }, [section, institutionId, courseResourceReload]);

  useEffect(() => {
    if (presentationDemo) {
      setAcademicProgrammes(presentationProgrammes);
      setProgrammesError(null);
      setProgrammesLoading(false);
      return;
    }
    if (!supabase || institutionId === "") {
      setAcademicProgrammes([]);
      return;
    }
    let active = true;
    setProgrammesLoading(true);
    void supabase.from("academic_programmes")
      .select("id,programme_title,award,level,catalogue_unit,college_name,school_name,source_url")
      .eq("institution_id", institutionId)
      .eq("active", true)
      .order("programme_title")
      .then(({ data, error }) => {
        if (!active) return;
        setProgrammesLoading(false);
        if (error) {
          setProgrammesError(error.message);
          setNotice(error.message);
          return;
        }
        setProgrammesError(null);
        setAcademicProgrammes(data ?? []);
      });
    return () => { active = false; };
  }, [institutionId, programmeReload]);

  useEffect(() => {
    if (!profile) return;
    if (presentationDemo) {
      if (profile.role === "tutor") setSection("tutor");
      else if (profile.role === "student") setSection("discover");
      return;
    }
    if (profile.role === "tutor") {
      setSection("tutor");
      void loadTutorDashboard(profile.id);
    } else if (profile.role === "admin") {
      setSection("admin");
      void loadAdminDashboard();
    } else {
      setSection("discover");
    }
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    const client = supabase;
    if (!client || !user) return;
    const reference = new URLSearchParams(location.search).get("reference");
    if (!reference) return;
    void client.functions.invoke<{ status?: string; purpose?: string; tutor_id?: string | null }>("payments", { body: { action: "verify", reference } }).then(async ({ data, error }) => {
      if (error) {
        setNotice(error.message);
      } else if (data?.status === "paid" && data.tutor_id) {
        const { data: contact, error: contactError } = await client.from("tutor_contacts")
          .select("tutor_id,phone,email,whatsapp_url,instagram_url,facebook_url,linkedin_url,x_url,website_url")
          .eq("tutor_id", data.tutor_id).maybeSingle();
        if (contactError) setNotice(`Payment verified, but contact details could not be loaded: ${contactError.message}`);
        else if (contact) {
          setRecentlyUnlockedContact(contact);
          setContacts((current) => ({ ...current, [contact.tutor_id]: contact }));
          await loadProfile(user.id);
          setNotice("Payment verified. Tutor contact unlocked.");
        } else {
          setNotice("Payment verified, but this tutor has no contact details listed.");
        }
      } else if (data?.status === "paid" && data.purpose === "resource") {
        setSection("tutor");
        await loadTutorDashboard(user.id);
        setNotice("Payment verified. Your resource publishing credit is ready.");
      } else if (data?.status === "paid" && (data.purpose === "premium" || !data.tutor_id)) {
        setSection("tutor");
        await loadProfile(user.id);
        await loadTutorDashboard(user.id);
        setNotice("Paystack verified your tutor plan. Your blue verified mark is now active.");
      } else {
        setNotice(data?.purpose === "resource"
          ? "Payment was not completed; no resource publishing credit was added."
          : data?.purpose === "premium"
            ? "Payment was not completed; your tutor plan was not activated."
            : "Payment was not completed; contact details remain locked.");
      }
      history.replaceState({}, "", "/");
    }).catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "Could not verify the payment. Please contact support before trying again.");
      history.replaceState({}, "", "/");
    });
  }, [user?.id]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setNotice("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to enable authentication.");
      return;
    }
    const form = event.currentTarget;
    const values = new FormData(form);
    const mode = authMode;
    const signUp = authMode === "signup";
    const forgot = authMode === "forgot";
    setBusy(true);
    try {
      if (forgot) {
        const email = String(values.get("e")).trim().toLowerCase();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin,
        });
        setNotice(error?.message ?? "If an account exists for that email, a password reset link has been sent.");
        return;
      }

      if (mode === "update") {
        const { error } = await supabase.auth.updateUser({ password: String(values.get("p")) });
        if (error) {
          setNotice(error.message);
          return;
        }
        setAuthMode("login");
        setNotice("Your password has been updated. You can continue using your account.");
        return;
      }

      const email = String(values.get("e")).trim().toLowerCase();
      const password = String(values.get("p"));
      const result = signUp
        ? await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: String(values.get("n")).trim(), role: String(values.get("r")) },
            emailRedirectTo: location.origin,
          },
        })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        const lowerMessage = result.error.message.toLowerCase();
        const duplicateAccount = lowerMessage.includes("already registered")
          || lowerMessage.includes("already exists")
          || lowerMessage.includes("user already");
        if (duplicateAccount && signUp) {
          setAuthMode("login");
          setNotice("This email is already registered. Use the Log in tab or reset your password.");
          return;
        }
        if (!signUp && lowerMessage.includes("email not confirmed")) {
          setNotice("Confirm your email using the link we sent before logging in. Check your inbox and spam folder.");
          return;
        }
        setNotice(lowerMessage.includes("invalid login")
          ? "The email or password is incorrect. Use “Forgot password?” below the password field to recover your account."
          : result.error.message);
        return;
      }
      if (signUp && !result.data.session) {
        setAuthMode("login");
        setNotice("Your account was created. Confirm your email using the link we sent, then log in. Check your inbox and spam folder.");
        return;
      }
      setNotice(signUp ? "Account created. You are signed in and ready to continue." : "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice("");
    setSection("discover");
    setProfile(null);
    setDemoAuthRequested(false);
  }

  async function runSearch() {
    if (presentationDemo) {
      const search = query.trim().toLowerCase();
      const selectedUnit = unitId === "" ? "" : unitPath(unitId, presentationUnits);
      const matchingTutors = presentationTutors.filter((tutor) =>
        (!search || `${tutor.course_code} ${tutor.name} ${tutor.department}`.toLowerCase().includes(search))
        && (!selectedUnit || unitPath(tutor.department_id, presentationUnits).startsWith(selectedUnit)),
      );
      setResults(matchingTutors);
      setContacts({});
      const demoResources = [
        ...presentationTutorResources,
        ...tutorResources.filter((resource) => resource.resource_payment_id?.startsWith("demo-resource-")),
      ];
      const matchingResources = demoResources.filter((resource) =>
        matchingTutors.some((tutor) => tutor.id === resource.tutor_id && tutor.course_code === resource.course_code),
      );
      setResourcesByTutor(matchingResources.reduce<Record<string, TutorResource[]>>((grouped, resource) => {
        grouped[resource.tutor_id] = [...(grouped[resource.tutor_id] ?? []), resource];
        return grouped;
      }, {}));
      setRecentlyUnlockedContact(null);
      setHasSearched(true);
      setNotice("Presentation search uses fictional profiles. Contact unlocks and payments are disabled.");
      return;
    }
    if (!supabase || institutionId === "") {
      setNotice("Choose an institution after connecting Supabase.");
      return;
    }
    const client = supabase;
    setBusy(true);
    setHasSearched(true);
    setRecentlyUnlockedContact(null);
    setResourcesByTutor({});
    try {
      const { data, error } = await client.rpc("search_tutors_grouped", {
        p_institution: institutionId,
        p_query: query.trim(),
        p_academic_unit: unitId === "" ? null : unitId,
      });
      if (error) {
        setNotice(error.message);
        setResults([]);
        setResourcesByTutor({});
        return;
      }
      const rows: SearchTutor[] = await Promise.all((data ?? []).map(async (row: SearchTutor) => {
        if (!row.avatar_path) return { ...row, avatar_url: null };
        const { data: photo, error: photoError } = await client.storage.from("profile-photos").createSignedUrl(row.avatar_path, 3600);
        if (photoError) {
          setNotice(photoError.message);
          return { ...row, avatar_url: null };
        }
        return { ...row, avatar_url: photo.signedUrl };
      }));
      setResults(rows);
      const ids = [...new Set(rows.map((row) => row.id))];
      if (ids.length) {
        const { data: resources, error: resourceError } = await client.from("tutor_resources")
            .select("id,tutor_id,course_id,resource_type,title,url,storage_path,resource_payment_id,description,created_at,courses(code)")
          .in("tutor_id", ids).eq("is_public", true).order("created_at", { ascending: false });
        if (resourceError) {
          setNotice(resourceError.message);
          setResourcesByTutor({});
          } else {
            try {
              const resourceRows: TutorResource[] = ((resources ?? []) as TutorResourceWithCourse[]).map((resource) => {
                const course = Array.isArray(resource.courses) ? resource.courses[0] : resource.courses;
                return { ...resource, course_code: course?.code ?? null };
              });
              const signedResources = await signTutorResourceFiles(resourceRows);
              setResourcesByTutor(signedResources.reduce<Record<string, TutorResource[]>>((grouped, item) => {
                grouped[item.tutor_id] = [...(grouped[item.tutor_id] ?? []), item];
                return grouped;
              }, {}));
            } catch (error) {
              setNotice(error instanceof Error ? error.message : "Could not load tutor resources.");
              setResourcesByTutor({});
            }
          }
      } else {
        setResourcesByTutor({});
      }
      if (user && ids.length) {
        const { data: unlocked, error: contactError } = await client.from("tutor_contacts")
          .select("tutor_id,phone,email,whatsapp_url,instagram_url,facebook_url,linkedin_url,x_url,website_url")
          .in("tutor_id", ids);
        if (contactError) setNotice(contactError.message);
        else setContacts(Object.fromEntries((unlocked ?? []).map((contact) => [contact.tutor_id, contact])));
      } else {
        setContacts({});
      }
    } finally {
      setBusy(false);
    }
  }

  async function searchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch();
  }

  function createDemoReceipt(purpose: DemoPaymentReceipt["purpose"], amount: number, description: string) {
    const reference = `TC-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const receipt: DemoPaymentReceipt = {
      reference,
      purpose,
      amount,
      description,
      created_at: new Date().toISOString(),
    };
    setDemoReceipt(receipt);
    try {
      const stored = JSON.parse(localStorage.getItem("tutorconnect-demo-receipts") || "[]");
      localStorage.setItem("tutorconnect-demo-receipts", JSON.stringify([receipt, ...(Array.isArray(stored) ? stored : [])].slice(0, 20)));
    } catch {
      localStorage.setItem("tutorconnect-demo-receipts", JSON.stringify([receipt]));
    }
    return receipt;
  }

  function downloadDemoReceipt(receipt: DemoPaymentReceipt) {
    const text = [
      "TutorConnect — DEMO PAYMENT RECEIPT",
      "",
      `Reference: ${receipt.reference}`,
      `Status: SUCCESSFUL (simulated)`,
      `Purpose: ${receipt.description}`,
      `Amount: GHS ${receipt.amount.toFixed(2)}`,
      "Payment method: Simulated presentation demo",
      `Date: ${new Date(receipt.created_at).toLocaleString()}`,
      "",
      "This is a presentation demo receipt. No real money was charged.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${receipt.reference}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function unlockContact(tutorId: string) {
    if (presentationDemo) {
      const tutor = presentationTutors.find((item) => item.id === tutorId);
      const contact: Contact = {
        tutor_id: tutorId,
        phone: tutorId === "demo-tutor-computing" ? "+233 20 000 0002" : "+233 20 000 0003",
        email: tutorId === "demo-tutor-computing" ? "tutor.demo@example.com" : "demo.tutor@example.com",
        whatsapp_url: tutorId === "demo-tutor-computing" ? "https://wa.me/233200000002" : null,
        instagram_url: null,
        facebook_url: null,
        linkedin_url: null,
        x_url: null,
        website_url: null,
      };
      createDemoReceipt("contact", 10, `Tutor contact unlock — ${tutor?.name ?? "Demo tutor"}`);
      setContacts((current) => ({ ...current, [tutorId]: contact }));
      setRecentlyUnlockedContact(contact);
      setProfile((current) => current ? { ...current, is_verified: current.role === "student" } : current);
      setNotice("Demo payment successful. The tutor's contact details are now unlocked.");
      return;
    }
    if (!supabase || !user) {
      setNotice("Log in as a student before unlocking contact details.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("payments", {
        body: { action: "contact", tutor_id: tutorId, callback_url: location.origin },
      });
      if (error) setNotice(await paymentErrorMessage(error));
      else if (data?.already_unlocked) {
        setNotice("You have already unlocked this tutor's contact details.");
        await runSearch();
      }
      else if (data?.url) location.href = data.url;
      else setNotice(data?.error || "Payment could not be started. Please try again.");
    } catch (error) {
      setNotice(await paymentErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function startPremiumCheckout(plan: "monthly" | "semester") {
    if (presentationDemo) {
      const amount = plan === "monthly" ? 50 : 200;
      const days = plan === "monthly" ? 30 : 120;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);
      setTutorProfile((current) => current ? {
        ...current,
        premium_until: expiry.toISOString(),
      } : current);
      setProfile((current) => current ? { ...current, is_verified: true } : current);
      createDemoReceipt("premium", amount, `${plan === "monthly" ? "Monthly" : "Semester"} tutor listing plan`);
      setNotice("Demo payment successful. Your tutor listing mark is now active.");
      return;
    }
    if (!supabase || !user || profile?.role !== "tutor") {
      setNotice("Sign in to a tutor account before subscribing.");
      return;
    }
    if (tutorProfile?.status !== "approved") {
      setNotice("Your tutor profile must be approved before you can activate a paid listing.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>("payments", {
        body: { action: "premium", plan, callback_url: location.origin },
      });
      if (error) {
        setNotice(await paymentErrorMessage(error));
        return;
      }
      if (!data?.url || !/^https:\/\/checkout\.paystack\.com\//.test(data.url)) {
        setNotice(data?.error || "Secure checkout could not be started. Please try again.");
        return;
      }
      location.assign(data.url);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Secure checkout could not be started. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function startResourceCheckout() {
    if (presentationDemo) {
      const credit = `demo-resource-${crypto.randomUUID().slice(0, 8)}`;
      setResourceCredits((current) => {
        const next = [credit, ...current];
        localStorage.setItem("tutorconnect-demo-resource-credits", JSON.stringify(next));
        return next;
      });
      createDemoReceipt("resource", 50, "Tutor resource publishing credit");
      setNotice("Demo payment successful. One resource publishing credit is ready.");
      return;
    }
    if (!supabase || !user || profile?.role !== "tutor") {
      setNotice("Sign in to a tutor account before publishing resources.");
      return;
    }
    if (tutorProfile?.status !== "approved") {
      setNotice("Your tutor profile must be approved before you can publish resources.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>("payments", {
        body: { action: "resource", callback_url: location.origin },
      });
      if (error) {
        setNotice(await paymentErrorMessage(error));
        return;
      }
      if (!data?.url || !/^https:\/\/checkout\.paystack\.com\//.test(data.url)) {
        setNotice(data?.error || "Secure checkout could not be started. Please try again.");
        return;
      }
      location.assign(data.url);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Secure checkout could not be started. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>, tutorId: string) {
    event.preventDefault();
    if (!supabase || !user) return;
    const values = new FormData(event.currentTarget);
    const { error } = await supabase.from("reviews").insert({
      student_id: user.id,
      tutor_id: tutorId,
      rating: Number(values.get("rating")),
      comment: String(values.get("comment") || "").trim(),
      status: "published",
    });
    setNotice(error?.message ?? "Thanks. Your review has been submitted.");
    if (!error) await loadStudentActivity(user.id);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>, tutorId: string) {
    event.preventDefault();
    if (!supabase || !user) return;
    const values = new FormData(event.currentTarget);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      tutor_id: tutorId,
      category: String(values.get("category")),
      description: String(values.get("description")).trim(),
      status: "open",
    });
    setNotice(error?.message ?? "Your report was sent to the moderation team.");
    if (!error) await loadStudentActivity(user.id);
  }

  async function loadStudentActivity(id: string) {
    if (!supabase) return;
    const [reviewsResult, reportsResult] = await Promise.all([
      supabase.from("reviews").select("id,tutor_id,student_id,rating,comment,status,created_at").eq("student_id", id).order("created_at", { ascending: false }),
      supabase.from("reports").select("id,tutor_id,reporter_id,category,description,status,resolution,created_at").eq("reporter_id", id).order("created_at", { ascending: false }),
    ]);
    if (reviewsResult.error) setNotice(reviewsResult.error.message);
    else setStudentReviews(reviewsResult.data ?? []);
    if (reportsResult.error) setNotice(reportsResult.error.message);
    else setStudentReports(reportsResult.data ?? []);
  }

  async function loadTutorDashboard(id: string) {
    if (presentationDemo || !supabase) return;
    const [profileResult, contactResult, coursesResult, catalogueRequestsResult, reviewsResult, statsResult, resourcesResult, creditsResult] = await Promise.all([
      supabase.from("tutor_profiles").select("id,bio,qualifications,rate,delivery,availability,status,premium_until,views").eq("id", id).maybeSingle(),
      supabase.from("tutor_contacts")
        .select("tutor_id,phone,email,whatsapp_url,instagram_url,facebook_url,linkedin_url,x_url,website_url")
        .eq("tutor_id", id).maybeSingle(),
      supabase.from("tutor_courses").select("id,status,courses(id,institution_id,code,title,academic_unit_id,source_url)").eq("tutor_id", id).order("id"),
      supabase.from("course_catalogue_requests").select("id,institution_id,requested_by,code,title,academic_unit_id,source_url,status,admin_note,course_id,created_at").eq("requested_by", id).order("created_at", { ascending: false }),
      supabase.from("reviews").select("id,tutor_id,student_id,rating,comment,status,created_at").eq("tutor_id", id).order("created_at", { ascending: false }),
      supabase.rpc("tutor_dashboard_stats"),
      supabase.from("tutor_resources").select("id,tutor_id,course_id,resource_type,title,url,storage_path,resource_payment_id,description,created_at").eq("tutor_id", id).order("created_at", { ascending: false }),
      supabase.from("payments").select("id").eq("user_id", id).eq("purpose", "resource").eq("status", "paid").is("resource_claimed_at", null).order("created_at"),
    ]);
    const failure = profileResult.error || contactResult.error || coursesResult.error || catalogueRequestsResult.error || reviewsResult.error || statsResult.error || resourcesResult.error || creditsResult.error;
    if (failure) setNotice(failure.message);
    setTutorProfile(profileResult.data ?? null);
    setTutorContact(contactResult.data ?? null);
    setTutorCourses((coursesResult.data ?? []).map((row) => ({
      ...row,
      courses: Array.isArray(row.courses) ? row.courses[0] ?? null : row.courses,
    })));
    setCourseCatalogueRequests(catalogueRequestsResult.data ?? []);
    setTutorReviews(reviewsResult.data ?? []);
    try {
      setTutorResources(await signTutorResourceFiles(resourcesResult.data ?? []));
    } catch (error) {
      setTutorResources(resourcesResult.data ?? []);
      setNotice(error instanceof Error ? error.message : "Could not load your resource files.");
    }
    setResourceCreditsError(creditsResult.error?.message ?? null);
    setResourceCredits((creditsResult.data ?? []).map((credit) => credit.id));
    setTutorStats(statsResult.data?.[0] ?? null);
  }

  async function savePersonalProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !profile) return;
    const values = new FormData(event.currentTarget);
    const fullName = String(values.get("full_name") || "").trim();
    const bio = String(values.get("personal_bio") || "").trim();
    const contactUpdates = profile.role === "student" ? {
      phone: optionalFormValue(values, "contact_phone"),
      contact_email: optionalFormValue(values, "contact_email"),
      whatsapp_url: optionalFormValue(values, "whatsapp_url"),
      instagram_url: optionalFormValue(values, "instagram_url"),
      facebook_url: optionalFormValue(values, "facebook_url"),
      linkedin_url: optionalFormValue(values, "linkedin_url"),
      x_url: optionalFormValue(values, "x_url"),
      website_url: optionalFormValue(values, "website_url"),
    } : {};
    const avatar = values.get("avatar");
    let nextAvatarPath = profile.avatar_path;
    if (avatar instanceof File && avatar.size > 0) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(avatar.type) || avatar.size > 5 * 1024 * 1024) {
        setNotice("Choose a JPG, PNG or WebP image no larger than 5 MB.");
        return;
      }
      const extension = avatar.type === "image/png" ? "png" : avatar.type === "image/webp" ? "webp" : "jpg";
      nextAvatarPath = `${profile.id}/${Date.now()}.${extension}`;
      setBusy(true);
      const { error: uploadError } = await supabase.storage.from("profile-photos").upload(nextAvatarPath, avatar, { contentType: avatar.type, upsert: false });
      if (uploadError) {
        setNotice(uploadError.message);
        setBusy(false);
        return;
      }
    } else {
      setBusy(true);
    }
    const { error: updateError } = await supabase.from("profiles").update({
      full_name: fullName,
      bio,
      avatar_path: nextAvatarPath,
      ...contactUpdates,
    }).eq("id", profile.id);
    if (updateError) {
      if (nextAvatarPath && nextAvatarPath !== profile.avatar_path) {
        const { error: cleanupError } = await supabase.storage.from("profile-photos").remove([nextAvatarPath]);
        setNotice(cleanupError ? `${updateError.message} Photo cleanup failed: ${cleanupError.message}` : updateError.message);
      } else {
        setNotice(updateError.message);
      }
      setBusy(false);
      return;
    }
    let successNotice = "Profile saved.";
    if (profile.avatar_path && nextAvatarPath !== profile.avatar_path) {
      const { error: cleanupError } = await supabase.storage.from("profile-photos").remove([profile.avatar_path]);
      if (cleanupError) successNotice = `Profile saved, but the previous photo could not be removed: ${cleanupError.message}`;
    }
    let avatarUrl: string | null = null;
    if (nextAvatarPath) {
      const { data: photo, error: photoError } = await supabase.storage.from("profile-photos").createSignedUrl(nextAvatarPath, 3600);
      if (photoError) successNotice = `Profile saved, but the photo preview could not be loaded: ${photoError.message}`;
      else avatarUrl = photo.signedUrl;
    }
    setProfile({ ...profile, full_name: fullName, bio, avatar_path: nextAvatarPath, avatar_url: avatarUrl, ...contactUpdates });
    if (avatarPreviewUrl.current) URL.revokeObjectURL(avatarPreviewUrl.current);
    avatarPreviewUrl.current = null;
    setAvatarPreview(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    setBusy(false);
    setNotice(successNotice);
  }

  function previewProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      if (avatarPreviewUrl.current) URL.revokeObjectURL(avatarPreviewUrl.current);
      avatarPreviewUrl.current = null;
      setAvatarPreview(null);
      event.currentTarget.value = "";
      setNotice("Choose a JPG, PNG or WebP image no larger than 5 MB.");
      return;
    }

    if (avatarPreviewUrl.current) URL.revokeObjectURL(avatarPreviewUrl.current);
    avatarPreviewUrl.current = URL.createObjectURL(file);
    setAvatarPreview(avatarPreviewUrl.current);
    setNotice("");
  }

  async function removeProfilePhoto() {
    if (!supabase || !profile?.avatar_path) return;
    if (!window.confirm("Remove your current profile photo?")) return;
    setBusy(true);
    const { error: updateError } = await supabase.from("profiles")
      .update({ avatar_path: null })
      .eq("id", profile.id);
    if (updateError) {
      setNotice(updateError.message);
      setBusy(false);
      return;
    }
    const { error: cleanupError } = await supabase.storage.from("profile-photos").remove([profile.avatar_path]);
    setProfile({ ...profile, avatar_path: null, avatar_url: null });
    setAvatarPreview(null);
    if (avatarPreviewUrl.current) URL.revokeObjectURL(avatarPreviewUrl.current);
    avatarPreviewUrl.current = null;
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    setBusy(false);
    setNotice(cleanupError ? `Photo removed, but storage cleanup needs attention: ${cleanupError.message}` : "Profile photo removed.");
  }

  async function saveTutorResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (presentationDemo) {
      if (!profile || profile.role !== "tutor") return;
      if (tutorProfile?.status !== "approved") {
        setNotice("Only approved demo tutors can publish resources.");
        return;
      }
      const paymentId = resourceCredits[0];
      if (!paymentId) {
        setNotice("Complete the demo GHS 50 resource payment first.");
        return;
      }
      const form = event.currentTarget;
      const values = new FormData(form);
      const url = String(values.get("url") || "").trim();
      const selectedFile = values.get("resource_file");
      const file = selectedFile instanceof File && selectedFile.size > 0 ? selectedFile : null;
      if (file && url) {
        setNotice("Choose either a file upload or an external link, not both.");
        return;
      }
      if (file && file.size > resourceFileSizeLimit) {
        setNotice("Resource files must be no larger than 50 MB.");
        return;
      }
      if (file && !resourceFileExtensions[file.type]) {
        setNotice("Choose an MP4/WebM video, PDF, Word/PowerPoint document, text file or JPG/PNG/WebP image.");
        return;
      }
      if (file && String(values.get("resource_type")) === "teaching_video" && !file.type.startsWith("video/")) {
        setNotice("Teaching video uploads must be MP4 or WebM videos.");
        return;
      }
      if (!file && !url) {
        setNotice("Choose a file or provide an external HTTPS link.");
        return;
      }
      if (!file && !url.startsWith("https://")) {
        setNotice("Resource links must use HTTPS.");
        return;
      }
      const resourceType = String(values.get("resource_type")) as TutorResource["resource_type"];
      if (!file && resourceType === "teaching_video") {
        try {
          const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
          if (!["youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com"].includes(host)) {
            setNotice("Teaching videos must be YouTube links.");
            return;
          }
        } catch {
          setNotice("Enter a valid YouTube video or playlist URL.");
          return;
        }
      }
      const courseId = Number(values.get("course_id"));
      if (!courseId) {
        setNotice("Choose one of your approved courses.");
        return;
      }
      const objectUrl = file ? URL.createObjectURL(file) : null;
      const resource: TutorResource = {
        id: Date.now(),
        tutor_id: profile.id,
        course_id: courseId,
        course_code: tutorCourses.find((item) => item.courses?.id === courseId)?.courses?.code ?? null,
        resource_type: resourceType,
        title: String(values.get("title")).trim(),
        url: file ? null : url,
        storage_path: null,
        resource_payment_id: paymentId,
        signed_url: objectUrl,
        description: String(values.get("description") || "").trim() || null,
        created_at: new Date().toISOString(),
      };
      setTutorResources((current) => [resource, ...current]);
      let resourcePersistenceWarning = "";
      if (!file) {
        try {
          const stored = readDemoResources();
          localStorage.setItem("tutorconnect-demo-resources", JSON.stringify([resource, ...stored].slice(0, 100)));
        } catch {
          resourcePersistenceWarning = " It will be available only until this tab is closed because browser storage is unavailable.";
        }
      }
      setResourceCredits((current) => {
        const next = current.filter((credit) => credit !== paymentId);
        localStorage.setItem("tutorconnect-demo-resource-credits", JSON.stringify(next));
        return next;
      });
      form.reset();
      setNotice(`Demo resource published successfully. The publishing credit has been used.${resourcePersistenceWarning}`);
      return;
    }
    if (!supabase || !profile || profile.role !== "tutor") return;
    if (tutorProfile?.status !== "approved") {
      setNotice("Only approved tutors can publish resources.");
      return;
    }
    const paymentId = resourceCredits[0];
    if (!paymentId) {
      setNotice("Pay GHS 50 to receive one resource publishing credit.");
      return;
    }

    const form = event.currentTarget;
    const values = new FormData(form);
    const url = String(values.get("url") || "").trim();
    const selectedFile = values.get("resource_file");
    const file = selectedFile instanceof File && selectedFile.size > 0 ? selectedFile : null;
    if (file && url) {
      setNotice("Choose either a file upload or an external link, not both.");
      return;
    }
    if (!file && !url) {
      setNotice("Choose a file or provide an external HTTPS link.");
      return;
    }
    let storagePath: string | null = null;
    if (file) {
      if (file.size > resourceFileSizeLimit) {
        setNotice("Resource files must be no larger than 50 MB.");
        return;
      }
      const extension = resourceFileExtensions[file.type];
      if (!extension) {
        setNotice("Choose an MP4/WebM video, PDF, Word/PowerPoint document, text file or JPG/PNG/WebP image.");
        return;
      }
      if (String(values.get("resource_type")) === "teaching_video" && !file.type.startsWith("video/")) {
        setNotice("Teaching video uploads must be MP4 or WebM videos.");
        return;
      }
      storagePath = `${profile.id}/${paymentId}/resource.${extension}`;
    } else if (!url.startsWith("https://")) {
      setNotice("Resource links must use HTTPS.");
      return;
    }
    if (!file && String(values.get("resource_type")) === "teaching_video") {
      let videoUrl: URL;
      try {
        videoUrl = new URL(url);
      } catch {
        setNotice("Enter a valid YouTube video or playlist URL.");
        return;
      }
      const host = videoUrl.hostname.toLowerCase().replace(/^www\./, "");
      if (!["youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com"].includes(host)) {
        setNotice("Teaching videos must be YouTube links.");
        return;
      }
    }

    const courseId = String(values.get("course_id") || "");
    if (!courseId) {
      setNotice("Choose one of your approved courses.");
      return;
    }

    setBusy(true);
    try {
      if (file && storagePath) {
        const { error: uploadError } = await supabase.storage.from("tutor-resources").upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) {
          setNotice(uploadError.message);
          return;
        }
      }

      const { data, error } = await supabase.from("tutor_resources").insert({
        tutor_id: profile.id,
        course_id: Number(courseId),
        resource_type: String(values.get("resource_type")),
        title: String(values.get("title")).trim(),
        url: file ? null : url,
        storage_path: storagePath,
        resource_payment_id: paymentId,
        description: String(values.get("description") || "").trim() || null,
      }).select("id,tutor_id,course_id,resource_type,title,url,storage_path,resource_payment_id,description,created_at").single();

      if (error) {
        if (storagePath) {
          const { error: cleanupError } = await supabase.storage.from("tutor-resources").remove([storagePath]);
          setNotice(cleanupError
            ? `${error.message} Uploaded file cleanup failed: ${cleanupError.message}`
            : error.message);
        } else {
          setNotice(error.message);
        }
        return;
      }

      let resourceWithSignedUrl = data;
      let publicationNotice = "Resource published. Your paid credit has been used.";
      try {
        [resourceWithSignedUrl] = await signTutorResourceFiles([data]);
      } catch (error) {
        publicationNotice = error instanceof Error
          ? `Resource published, but its file link could not be loaded: ${error.message}`
          : "Resource published, but its file link could not be loaded.";
      }
      setTutorResources((current) => [resourceWithSignedUrl, ...current]);
      setResourceCredits((current) => current.filter((credit) => credit !== paymentId));
      form.reset();
      setNotice(publicationNotice);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not publish the resource.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTutorResource(id: number) {
    if (presentationDemo) {
      setTutorResources((current) => current.filter((item) => item.id !== id));
      setNotice("Demo resource removed.");
      return;
    }
    if (!supabase || !profile || profile.role !== "tutor") return;
    const resource = tutorResources.find((item) => item.id === id);
    const { error } = await supabase.from("tutor_resources").delete().eq("id", id).eq("tutor_id", profile.id);
    if (error) {
      setNotice(error.message);
      return;
    }
    setTutorResources((current) => current.filter((item) => item.id !== id));
    if (resource?.storage_path) {
      const { error: storageError } = await supabase.storage.from("tutor-resources").remove([resource.storage_path]);
      setNotice(storageError ? `Resource removed, but its file needs cleanup: ${storageError.message}` : "Resource removed.");
    } else setNotice("Resource removed.");
  }

  async function saveTutorProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !profile) return;
    const values = new FormData(event.currentTarget);
    setBusy(true);
    const { error: profileError } = await supabase.from("tutor_profiles").update({
      bio: String(values.get("bio")).trim(),
      qualifications: String(values.get("qualifications")).trim(),
      rate: Number(values.get("rate")),
      delivery: String(values.get("delivery")),
      availability: String(values.get("availability")).trim(),
    }).eq("id", profile.id);
    if (profileError) {
      setBusy(false);
      setNotice(profileError.message);
      return;
    }
    const nextContact: Contact = {
      tutor_id: profile.id,
      phone: optionalFormValue(values, "phone"),
      email: optionalFormValue(values, "contact_email"),
      whatsapp_url: optionalFormValue(values, "whatsapp_url"),
      instagram_url: optionalFormValue(values, "instagram_url"),
      facebook_url: optionalFormValue(values, "facebook_url"),
      linkedin_url: optionalFormValue(values, "linkedin_url"),
      x_url: optionalFormValue(values, "x_url"),
      website_url: optionalFormValue(values, "website_url"),
    };
    const { error: contactError } = await supabase.from("tutor_contacts").upsert(nextContact, { onConflict: "tutor_id" });
    setBusy(false);
    if (contactError) {
      setNotice(`Tutor profile saved, but contact details were not saved: ${contactError.message}`);
      await loadTutorDashboard(profile.id);
      return;
    }
    setTutorContact(nextContact);
    setNotice("Profile and contact details saved.");
    await loadTutorDashboard(profile.id);
  }

  async function searchCourseOptions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCourseSearchPerformed(true);
    const values = new FormData(event.currentTarget);
    const term = String(values.get("course_query")).trim();
    setCourseSearchTerm(term);
    setCourseCatalogueFormOpen(false);
    if (!term) {
      setCourseOptions([]);
      return;
    }
    if (presentationDemo) {
      setCourseOptions(presentationDemoCourses.filter((course) =>
        `${course.code} ${course.title}`.toLowerCase().includes(term.toLowerCase()),
      ));
      setNotice("");
      return;
    }
    if (!supabase || institutionId === "") {
      setNotice("Choose an institution before searching the course catalogue.");
      return;
    }
    const [codeResult, titleResult] = await Promise.all([
      supabase.from("courses").select("id,institution_id,code,title,academic_unit_id,source_url").eq("institution_id", institutionId).ilike("code", `%${term}%`).eq("active", true).limit(20),
      supabase.from("courses").select("id,institution_id,code,title,academic_unit_id,source_url").eq("institution_id", institutionId).ilike("title", `%${term}%`).eq("active", true).limit(20),
    ]);
    const error = codeResult.error || titleResult.error;
    if (error) {
      setCourseOptions([]);
      setNotice(error.message);
    }
    else setCourseOptions(Array.from(new Map([...(codeResult.data ?? []), ...(titleResult.data ?? [])].map((course) => [course.id, course])).values()));
  }

  async function requestCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (presentationDemo) {
      const courseId = Number(values.get("course_id"));
      const course = presentationDemoCourses.find((item) => item.id === courseId);
      if (!profile || profile.role !== "tutor" || !course) {
        setNotice("Choose a demo catalogue course from the tutor demo.");
        return;
      }
      if (tutorCourses.some((item) => item.courses?.id === courseId)) {
        setNotice("This course is already on your demo tutor profile.");
        return;
      }
      setTutorCourses((current) => [...current, {
        id: Date.now(),
        status: "pending",
        courses: course,
      }]);
      setCourseOptions((current) => current.filter((item) => item.id !== courseId));
      setNotice("Demo course request sent for administrator approval.");
      return;
    }
    if (!supabase || !profile) return;
    const { error } = await supabase.from("tutor_courses").insert({
      tutor_id: profile.id,
      course_id: Number(values.get("course_id")),
      status: "pending",
    });
    setNotice(error?.message ?? "Course request sent for administrator approval.");
    if (!error) await loadTutorDashboard(profile.id);
  }

  async function submitCourseCatalogueRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const code = String(values.get("code") || "").trim().toUpperCase();
    const title = String(values.get("title") || "").trim();
    const academicUnitValue = String(values.get("academic_unit_id") || "");
    const sourceUrl = optionalFormValue(values, "source_url");
    if (!code || !title) {
      setNotice("Enter both a course code and title.");
      return;
    }
    if (sourceUrl) {
      try {
        if (new URL(sourceUrl).protocol !== "https:") throw new Error();
      } catch {
        setNotice("Course sources must use a valid HTTPS link.");
        return;
      }
    }
    if (!profile || profile.role !== "tutor" || institutionId === "") {
      setNotice("Sign in as a tutor and choose an institution before requesting a course.");
      return;
    }
    const academicUnitId = academicUnitValue ? Number(academicUnitValue) : null;
    if (presentationDemo) {
      const request: CourseCatalogueRequest = {
        id: Date.now(),
        institution_id: Number(institutionId),
        requested_by: profile.id,
        code,
        title,
        academic_unit_id: academicUnitId,
        source_url: sourceUrl,
        status: "pending",
        admin_note: null,
        course_id: null,
        created_at: new Date().toISOString(),
      };
      const next = [request, ...courseCatalogueRequests];
      setCourseCatalogueRequests(next);
      try {
        localStorage.setItem("tutorconnect-demo-course-requests", JSON.stringify(next));
      } catch {
        setCourseCatalogueRequests((current) => current.filter((item) => item.id !== request.id));
        setNotice("The demo suggestion could not be saved in this browser. Check available browser storage and try again.");
        return;
      }
      setNotice("Demo course suggestion saved to your tutor dashboard for administrator review.");
      setCourseCatalogueFormOpen(false);
      form.reset();
      return;
    }
    if (!supabase) {
      setNotice("Course catalogue is unavailable. Please try again later.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("course_catalogue_requests").insert({
        institution_id: Number(institutionId),
        requested_by: profile.id,
        code,
        title,
        academic_unit_id: academicUnitId,
        source_url: sourceUrl,
      }).select("id,institution_id,requested_by,code,title,academic_unit_id,source_url,status,admin_note,course_id,created_at").single();
      if (error) {
        setNotice(error.message);
        return;
      }
      setCourseCatalogueRequests((current) => [data, ...current]);
      setNotice("Course suggestion saved to your dashboard. It will join the shared catalogue after an administrator verifies it.");
      setCourseCatalogueFormOpen(false);
      form.reset();
    } finally {
      setBusy(false);
    }
  }

  async function loadAdminDashboard() {
    if (!supabase) return;
    const [tutorsResult, tutorCoursesResult, catalogueRequestsResult, profilesResult, reportsResult, reviewsResult, coursesResult, actionsResult] = await Promise.all([
      supabase.from("tutor_profiles").select("id,bio,qualifications,status"),
      supabase.from("tutor_courses").select("id,tutor_id,status,courses(id,institution_id,code,title,academic_unit_id,source_url)").eq("status", "pending").order("id"),
      supabase.from("course_catalogue_requests").select("id,institution_id,requested_by,code,title,academic_unit_id,source_url,status,admin_note,course_id,created_at").eq("status", "pending").order("created_at"),
      supabase.from("profiles").select("id,full_name,role"),
      supabase.from("reports").select("id,tutor_id,reporter_id,category,description,status,resolution,created_at").order("created_at", { ascending: false }),
      supabase.from("reviews").select("id,tutor_id,student_id,rating,comment,status,created_at").order("created_at", { ascending: false }),
      supabase.from("courses").select("id,institution_id,code,title,academic_unit_id,source_url").order("title"),
      supabase.from("admin_actions").select("id,admin_id,target_id,action,reason,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    const failure = tutorsResult.error || tutorCoursesResult.error || catalogueRequestsResult.error || profilesResult.error || reportsResult.error || reviewsResult.error || coursesResult.error || actionsResult.error;
    if (failure) setNotice(failure.message);
    setAdminTutors(tutorsResult.data ?? []);
    setAdminTutorCourses((tutorCoursesResult.data ?? []).map((row) => ({
      ...row,
      courses: Array.isArray(row.courses) ? row.courses[0] ?? null : row.courses,
    })));
    setAdminCourseCatalogueRequests(catalogueRequestsResult.data ?? []);
    setAdminProfiles((profilesResult.data ?? []).map((item) => ({ ...item, role: roleFrom(item.role) })));
    setAdminReports(reportsResult.data ?? []);
    setAdminReviews(reviewsResult.data ?? []);
    setAdminCourses(coursesResult.data ?? []);
    setAdminActions(actionsResult.data ?? []);
  }

  async function moderateTutor(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!supabase) return;
    const values = new FormData(event.currentTarget);
    const { error } = await supabase.rpc("admin_set_tutor_status", {
      p_tutor: id,
      p_status: String(values.get("status")),
      p_reason: String(values.get("reason")).trim(),
    });
    setNotice(error?.message ?? "Tutor status updated and recorded in the audit log.");
    if (!error) await loadAdminDashboard();
  }

  async function moderateReview(event: FormEvent<HTMLFormElement>, reviewId: number) {
    event.preventDefault();
    if (!supabase) return;
    const values = new FormData(event.currentTarget);
    const { error } = await supabase.rpc("admin_moderate_review", {
      p_review: reviewId,
      p_status: String(values.get("status")),
      p_reason: String(values.get("reason")).trim(),
    });
    setNotice(error?.message ?? "Review decision saved to the audit log.");
    if (!error) await loadAdminDashboard();
  }

  async function moderateTutorCourse(event: FormEvent<HTMLFormElement>, requestId: number) {
    event.preventDefault();
    if (!supabase) return;
    const values = new FormData(event.currentTarget);
    const { error } = await supabase.rpc("admin_moderate_tutor_course", {
      p_tutor_course: requestId,
      p_status: String(values.get("status")),
      p_reason: String(values.get("reason")).trim(),
    });
    setNotice(error?.message ?? "Course decision saved to the audit log.");
    if (!error) await loadAdminDashboard();
  }

  async function moderateCourseCatalogueRequest(event: FormEvent<HTMLFormElement>, requestId: number) {
    event.preventDefault();
    if (!supabase) return;
    const values = new FormData(event.currentTarget);
    const { error } = await supabase.rpc("admin_review_course_catalogue_request", {
      p_request: requestId,
      p_status: String(values.get("status")),
      p_reason: String(values.get("reason")).trim(),
      p_source_url: optionalFormValue(values, "source_url"),
    });
    setNotice(error?.message ?? "Catalogue request decision saved to the audit log.");
    if (!error) await loadAdminDashboard();
  }

  async function moderateReport(event: FormEvent<HTMLFormElement>, reportId: number) {
    event.preventDefault();
    if (!supabase) return;
    const values = new FormData(event.currentTarget);
    const { error } = await supabase.rpc("admin_resolve_report", {
      p_report: reportId,
      p_status: String(values.get("status")),
      p_resolution: String(values.get("resolution")).trim(),
      p_reason: String(values.get("reason")).trim(),
    });
    setNotice(error?.message ?? "Report decision saved to the audit log.");
    if (!error) await loadAdminDashboard();
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || institutionId === "") return;
    const values = new FormData(event.currentTarget);
    const unitValue = String(values.get("academic_unit_id"));
    const { error } = await supabase.from("courses").insert({
      institution_id: institutionId,
      academic_unit_id: unitValue ? Number(unitValue) : null,
      code: String(values.get("code")).trim(),
      title: String(values.get("title")).trim(),
      source_url: String(values.get("source_url")).trim(),
    });
    setNotice(error?.message ?? "Course added to the academic-unit catalogue.");
    if (!error) await loadAdminDashboard();
  }

  async function createAcademicUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || institutionId === "") return;
    const values = new FormData(event.currentTarget);
    const parentValue = String(values.get("parent_id"));
    const { error } = await supabase.from("academic_units").insert({
      institution_id: institutionId,
      parent_id: parentValue ? Number(parentValue) : null,
      name: String(values.get("name")).trim(),
      unit_type: String(values.get("unit_type")),
      source_url: String(values.get("unit_source_url")).trim() || null,
    });
    if (error) {
      setNotice(error.message);
      return;
    }
    const { data, error: unitsError } = await supabase.from("academic_units").select("id,name,unit_type,parent_id").eq("institution_id", institutionId).eq("active", true).order("name");
    if (unitsError) setNotice(unitsError.message);
    else {
      setUnits(data ?? []);
      setNotice("Academic unit added.");
    }
  }

  function navigate(target: Section) {
    setSection(target);
    setNotice("");
    if (target === "student" && user) void loadStudentActivity(user.id);
    if (target === "tutor" && profile) void loadTutorDashboard(profile.id);
    if (target === "admin") void loadAdminDashboard();
    window.requestAnimationFrame(() => {
      const main = document.getElementById("main-content");
      main?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const groupedCourses = useMemo(() => {
    const groups = new Map<string, Course[]>();
    for (const course of adminCourses) {
      const label = unitPath(course.academic_unit_id, units);
      groups.set(label, [...(groups.get(label) ?? []), course]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [adminCourses, units]);

  const groupedTutors = useMemo<GroupedSearchTutor[]>(() => {
    const tutors = new Map<string, GroupedSearchTutor>();
    for (const result of results) {
      const existing = tutors.get(result.id);
      if (existing) {
        if (!existing.course_codes.includes(result.course_code)) existing.course_codes.push(result.course_code);
        continue;
      }
      const { course_code, ...tutor } = result;
      tutors.set(result.id, { ...tutor, course_codes: [course_code] });
    }
    return [...tutors.values()];
  }, [results]);

  const filteredProgrammes = useMemo(() => {
    const search = programmeQuery.trim().toLowerCase();
    return academicProgrammes.filter((programme) =>
      (!programmeLevel || programme.level === programmeLevel)
      && (!search || [programme.programme_title, programme.award, programme.catalogue_unit, programme.college_name, programme.school_name]
        .some((value) => value?.toLowerCase().includes(search))),
    );
  }, [academicProgrammes, programmeLevel, programmeQuery]);

  const groupedProgrammes = useMemo(() => {
    const groups = new Map<string, AcademicProgramme[]>();
    for (const programme of filteredProgrammes) {
      const path = [programme.college_name, programme.school_name, programme.catalogue_unit]
        .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
        .join(" / ") || `College/school not listed / ${programme.catalogue_unit}`;
      groups.set(path, [...(groups.get(path) ?? []), programme]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredProgrammes]);

  const programmeLevels = useMemo(() => [...new Set(academicProgrammes.map((item) => item.level))].sort(), [academicProgrammes]);

  const filteredCourseResourceCourses = useMemo(() => {
    const search = courseResourceQuery.trim().toLowerCase();
    return courseResourceCourses.filter((course) =>
      !search || `${course.code} ${course.title} ${unitPath(course.academic_unit_id, units)}`.toLowerCase().includes(search),
    );
  }, [courseResourceCourses, courseResourceQuery, units]);

  const filteredCuratedSubjectResources = useMemo(() => {
    const search = courseResourceQuery.trim().toLowerCase();
    return curatedSubjectResources
      .map((group) => ({
        ...group,
        resources: group.resources.filter((resource) =>
          !search || `${group.subject} ${resource.title} ${resource.source} ${resource.description}`.toLowerCase().includes(search),
        ),
      }))
      .filter((group) => group.resources.length > 0);
  }, [courseResourceQuery]);

  const unresolvedReports = adminReports.filter((item) => item.status !== "resolved").length;
  const pendingTutors = adminTutors.filter((item) => item.status === "pending").length;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="app-header">
      <a className="brand" href="/" aria-label="TutorConnect home" onClick={(event) => { event.preventDefault(); navigate(profile?.role === "tutor" ? "tutor" : profile?.role === "admin" ? "admin" : "discover"); }}>
        <span className="brand-mark">TC</span><span>TutorConnect</span>
      </a>
      <nav aria-label="Main navigation">
        {!presentationDemo && <a className="nav-link" href="/?demo=1">Presentation demo</a>}
        <button className={section === "resources" ? "nav-link active" : "nav-link"} aria-current={section === "resources" ? "page" : undefined} onClick={() => navigate("resources")}>Courses & resources</button>
        {(user || (presentationDemo && !demoAuthRequested)) && <button className={section === "programmes" ? "nav-link active" : "nav-link"} aria-current={section === "programmes" ? "page" : undefined} onClick={() => navigate("programmes")}>UCC programmes</button>}
        {profile?.role === "student" && <>
          <button className={section === "discover" ? "nav-link active" : "nav-link"} aria-current={section === "discover" ? "page" : undefined} onClick={() => navigate("discover")}>Find tutors</button>
          <button className={section === "student" ? "nav-link active" : "nav-link"} aria-current={section === "student" ? "page" : undefined} onClick={() => navigate("student")}>My activity</button>
        </>}
        {profile?.role === "tutor" && <button className="nav-link active" aria-current={section === "tutor" ? "page" : undefined} onClick={() => navigate("tutor")}>Tutor dashboard</button>}
        {profile?.role === "admin" && <button className="nav-link active" aria-current={section === "admin" ? "page" : undefined} onClick={() => navigate("admin")}>Moderation</button>}
        {profile && <button className={section === "profile" ? "nav-link active" : "nav-link"} aria-current={section === "profile" ? "page" : undefined} onClick={() => navigate("profile")}>My profile{profile.is_verified && <VerifiedBadge label="TutorConnect verified member" />}</button>}
        {user ? <button className="button button-outline" onClick={() => void signOut()}>Log out</button> : <button className="button button-outline" onClick={() => { setAuthMode("login"); setDemoAuthRequested(true); navigate("discover"); }}>Log in</button>}
      </nav>
    </header>

    {presentationDemo && <aside className="presentation-banner" aria-label="Presentation demo notice">
      <div><strong>Presentation demo</strong><span>Profiles and course codes are examples, not official UCC records. Payments are simulated locally; no real money is charged.</span></div>
      {demoRole !== "student" && <button className="button button-outline" type="button" onClick={() => location.assign("/?demo=1&role=student")}>Demo as student</button>}
      {demoRole !== "tutor" && <button className="button button-outline" type="button" onClick={() => location.assign("/?demo=1&role=tutor")}>Demo as tutor</button>}
      {!user && <button className="button button-primary" type="button" onClick={() => { setAuthMode("signup"); setDemoAuthRequested(true); setSection("discover"); }}>Create a real account</button>}
      <a className="button button-outline" href="/">Exit demo</a>
    </aside>}

    {notice && <div className="notice" role="status">{notice}
      {notice.startsWith("Payment service") && <a className="notice-demo-link" href={`/?demo=1&role=${profile?.role === "tutor" ? "tutor" : "student"}`}>Open the no-charge demo</a>}
      <button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button>
    </div>}

    {demoReceipt && presentationDemo && <div className="demo-payment-backdrop" role="presentation">
      <section className="demo-receipt" role="dialog" aria-modal="true" aria-labelledby="demo-receipt-title">
        <div className="demo-receipt-status"><span aria-hidden="true">✓</span> Payment successful</div>
        <p className="eyebrow">DEMO RECEIPT</p>
        <h2 id="demo-receipt-title">{demoReceipt.description}</h2>
        <dl>
          <div><dt>Reference</dt><dd>{demoReceipt.reference}</dd></div>
          <div><dt>Amount</dt><dd>GHS {demoReceipt.amount.toFixed(2)}</dd></div>
          <div><dt>Payment method</dt><dd>Simulated demo</dd></div>
          <div><dt>Status</dt><dd>Successful (simulated)</dd></div>
          <div><dt>Date</dt><dd>{new Date(demoReceipt.created_at).toLocaleString()}</dd></div>
        </dl>
        <p className="muted">No real payment was processed. This receipt proves the demo workflow only.</p>
        <div className="demo-receipt-actions">
          <button className="button button-outline" type="button" onClick={() => downloadDemoReceipt(demoReceipt)}>Download receipt</button>
          <button className="button button-primary" type="button" onClick={() => setDemoReceipt(null)}>Continue</button>
        </div>
      </section>
    </div>}

    {authMode === "update" && user ? <main id="main-content" tabIndex={-1} className="auth-layout">
      <section className="auth-story"><div className="auth-brand-lockup"><span className="brand-mark">TC</span><span>Secure account recovery</span></div><p className="eyebrow">PASSWORD RESET</p><h1>Choose a new <em>password.</em></h1><p className="lead">Set a strong password to secure your TutorConnect account.</p></section>
      <section className="auth-card" aria-labelledby="auth-heading"><p className="eyebrow">ACCOUNT SECURITY</p><h2 id="auth-heading">Set a new password</h2>
        <form className="stack-form" onSubmit={(event) => void authenticate(event)}>
          <label>New password<div className="password-field"><input name="p" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</button></div></label>
          <small className="muted">Use at least 8 characters. Avoid reusing a password from another site.</small>
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        </form>
        <button className="back-to-login" type="button" onClick={() => setAuthMode("login")}>Cancel and return to your account</button>
      </section>
    </main> : section === "resources" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">{presentationDemo ? "PRESENTATION EXAMPLES" : "OPEN LEARNING LIBRARY"}</p><h1>Courses & learning resources</h1><p className="muted">{presentationDemo ? "Explore curated subject resources and sample course-matched materials." : "Explore reputable public study materials by subject, plus course-specific resources and tutor-shared links."}</p></section>
      <div className="programme-controls resource-library-controls">
        <label>Institution<select value={institutionId} onChange={(event) => { setInstitutionId(Number(event.target.value)); setUnitId(""); }}>
          <option value="">Choose institution</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Search courses or subjects<input value={courseResourceQuery} onChange={(event) => setCourseResourceQuery(event.target.value)} placeholder="Course code, subject, title or source" /></label>
        <button className="button button-outline" onClick={() => setCourseResourceReload((value) => value + 1)} disabled={courseResourcesLoading}>Refresh resources</button>
      </div>
      <p className="source-note">{presentationDemo
        ? "The demo course entries are fictional. Curated third-party resources are real external learning materials; none are represented as UCC course records or as lessons created by demo tutors."
        : "Curated materials link to their publishers and are not UCC course records, tutor lessons or endorsements. Course-linked items use verified university sources; past papers appear only when an official public source is confirmed."}</p>
      <section className="course-resource-groups" aria-label="Curated learning resources by subject">
        <div><p className="eyebrow">CURATED OPEN WEB RESOURCES</p><h2>Free learning resources by subject</h2><p className="muted">These external links are selected for the demo subjects. Follow each publisher’s terms; course fit may differ by syllabus.</p></div>
        {filteredCuratedSubjectResources.length ? filteredCuratedSubjectResources.map((group) => <article className="course-resource-card" key={group.subject}>
          <p className="eyebrow">SUBJECT</p><h2>{group.subject}</h2>
          <div className="course-resource-list">{group.resources.map((resource) => <article className="course-resource-item" key={resource.url}>
            <span className="resource-type">{resource.kind}</span>
            <a className="course-resource-title" href={resource.url} target="_blank" rel="noreferrer"><b>{resource.title}</b></a>
            <small>Source: {resource.source}</small>
            <small>{resource.description}</small>
            {resource.license && <small>License: <a href={resource.license_url} target="_blank" rel="noreferrer">{resource.license}</a></small>}
          </article>)}</div>
        </article>) : <p className="muted">No curated subject resources match this search.</p>}
      </section>
      <h2>Verified course-specific resources</h2>
      {!supabase && !presentationDemo ? <div className="empty-state"><h2>Connect Supabase to load course resources</h2><p>Configure the project URL and publishable key, then run the database migrations.</p></div>
        : courseResourcesLoading ? <div className="empty-state" role="status" aria-live="polite"><h2>Loading course resources</h2><p>Checking the verified course catalogue.</p></div>
        : courseResourcesError ? <div className="empty-state" role="alert"><h2>Could not load course resources</h2><p>{courseResourcesError}</p><button className="button button-outline" onClick={() => setCourseResourceReload((value) => value + 1)}>Try again</button></div>
          : filteredCourseResourceCourses.length ? <section className="course-resource-groups" aria-label="Course learning resources">
            {filteredCourseResourceCourses.map((course) => <article className="course-resource-card" key={course.id}>
              <div className="row-between"><div><p className="eyebrow">{course.code}</p><h2>{course.title}</h2><p className="muted">{unitPath(course.academic_unit_id, units)}</p></div>
                {course.source_url && <a className="button button-outline" href={course.source_url} target="_blank" rel="noreferrer">Official course source</a>}
              </div>
              <div className="course-resource-list">{course.resources.map((resource) => <article className="course-resource-item" key={resource.id}>
                <span className="resource-type">{courseResourceLabel(resource.resource_type)}</span>
                <a className="course-resource-title" href={resource.url} target="_blank" rel="noreferrer"><b>{resource.title}</b></a>
                <small>Source: {resource.source_name}</small>
                {resource.description && <small>{resource.description}</small>}
                {resource.license_name && <small>License: {resource.license_url ? <a href={resource.license_url} target="_blank" rel="noreferrer">{resource.license_name}</a> : resource.license_name}</small>}
              </article>)}</div>
            </article>)}
          </section>
            : courseResourceQuery.trim() ? <div className="empty-state"><h2>No course resources match</h2><p>Try a different code, title or academic unit.</p></div>
            : <div className="empty-state"><h2>No verified course resources yet</h2><p>Course-specific items will appear here after an administrator links them to verified courses. Tutors can also share separate resources for each approved course on their profiles.</p></div>}
    </main> : section === "programmes" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">{presentationDemo ? "PRESENTATION EXAMPLES" : "OFFICIAL ADMISSIONS LISTING"}</p><h1>{presentationDemo ? "Example UCC programmes" : "Explore UCC programmes"}</h1><p className="muted">{presentationDemo ? "Fictional entries demonstrate how programme information will be grouped and filtered." : "Browse degree and postgraduate programmes by the academic unit shown in UCC’s admissions catalogue."}</p></section>
      <div className="programme-controls">
        <label>Search programmes<input value={programmeQuery} onChange={(event) => setProgrammeQuery(event.target.value)} placeholder="Programme, award, department or college" /></label>
        <label>Study level<select value={programmeLevel} onChange={(event) => setProgrammeLevel(event.target.value)}><option value="">All levels</option>{programmeLevels.map((level) => <option key={level}>{level}</option>)}</select></label>
        <a className="button button-outline" href="https://admissions.ucc.edu.gh/catalogue" target="_blank" rel="noreferrer">Official UCC catalogue</a>
      </div>
      <p className="source-note">{presentationDemo
        ? "All entries on this page are fictional presentation examples, not current UCC programmes."
        : "These are admissions programmes, not semester course units or course codes. Programme names link to UCC Admissions. College and school labels are shown only where the official listing provides them."}</p>
      <p className="muted programme-count">{programmesLoading ? "Loading UCC programmes…" : programmesError ? "The catalogue could not be loaded." : `Showing ${filteredProgrammes.length} of ${academicProgrammes.length} programmes`}</p>
      {!supabase && !presentationDemo ? <div className="empty-state"><h2>Connect Supabase to load this catalogue</h2><p>Or browse the official <a href="https://admissions.ucc.edu.gh/catalogue" target="_blank" rel="noreferrer">UCC Admissions catalogue</a>.</p></div>
        : programmesLoading ? <div className="empty-state"><h2>Loading programmes</h2><p>Fetching the verified UCC Admissions listing.</p></div>
          : programmesError ? <div className="empty-state" role="alert"><h2>Could not load UCC programmes</h2><p>{programmesError}</p><button className="button button-outline" onClick={() => setProgrammeReload((value) => value + 1)}>Try again</button><p>Or browse the <a href="https://admissions.ucc.edu.gh/catalogue" target="_blank" rel="noreferrer">official UCC catalogue</a>.</p></div>
            : groupedProgrammes.length ? <section className="programme-groups" aria-label="UCC programmes grouped by academic unit">
            {groupedProgrammes.map(([group, items], index) => <details className="course-group programme-group" key={group} open={presentationDemo || index === 0}>
              <summary>{group}<span>{items.length}</span></summary>
              {items.map((programme) => <article className="programme-item" key={programme.id}>
                <div><h2>{programme.programme_title}</h2><p>{programme.award} · {programme.level}</p></div>
                {presentationDemo ? <span className="demo-chip">Example only</span> : <a href={programme.source_url} target="_blank" rel="noreferrer">Official details</a>}
              </article>)}
            </details>)}
          </section>
          : <div className="empty-state"><h2>{academicProgrammes.length ? "No programmes match" : "No programme records available"}</h2><p>{academicProgrammes.length ? "Try another search or study level." : "Check the Supabase catalogue migration or use the official UCC link above."}</p></div>}
    </main> : !user && (!presentationDemo || demoAuthRequested) ? <main id="main-content" tabIndex={-1} className="auth-layout">
      <section className="auth-story">
        <div className="auth-brand-lockup"><span className="brand-mark">TC</span><span>Trusted course support</span></div>
        <p className="eyebrow">STUDY WITH CONFIDENCE</p>
        <h1>Learn from someone who understands <em>your course.</em></h1>
        <p className="lead">Discover approved tutors, preview learning resources and choose support that fits your subject.</p>
        <div className="auth-benefits">
          <article><span>01</span><div><b>Find relevant tutors</b><small>Search by institution, course and academic unit.</small></div></article>
          <article><span>02</span><div><b>Preview before booking</b><small>Explore teaching resources and student feedback.</small></div></article>
          <article><span>03</span><div><b>Stay in control</b><small>Private contact details unlock only after verified payment.</small></div></article>
        </div>
      </section>
      <section className="auth-card" aria-labelledby="auth-heading">
        <p className="eyebrow">{authMode === "login" ? "ACCOUNT ACCESS" : authMode === "signup" ? "CREATE ACCOUNT" : "PASSWORD RECOVERY"}</p>
        <h2 id="auth-heading">{authMode === "login" ? "Log in to TutorConnect" : authMode === "signup" ? "Create your account" : "Reset your password"}</h2>
        <p className="auth-card-lead">{authMode === "login" ? "Welcome back. Sign in to continue." : authMode === "signup" ? "Join as a student or apply as a tutor." : "Enter your email and we’ll send you a secure reset link."}</p>
        {authMode !== "forgot" && authMode !== "update" && <div className="auth-switch" role="group" aria-label="Account access">
          <button type="button" aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setShowPassword(false); }}>Log in</button>
          <button type="button" aria-pressed={authMode === "signup"} onClick={() => { setAuthMode("signup"); setShowPassword(false); }}>Sign up</button>
        </div>}
        <form className="stack-form" onSubmit={(event) => void authenticate(event)}>
          {authMode === "signup" && <>
            <label>Full name<input name="n" autoComplete="name" required /></label>
            <label>Account type<select name="r"><option value="student">Student</option><option value="tutor">Tutor (review required)</option></select></label>
          </>}
          {authMode !== "update" && <label>Email<input name="e" type="email" autoComplete="email" required /></label>}
          {authMode !== "forgot" && <label>{authMode === "update" ? "New password" : "Password"}
            <div className="password-field">
              <input name="p" type={showPassword ? "text" : "password"} autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={8} required />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</button>
            </div>
          </label>}
          {authMode === "update" && <small className="muted">Use at least 8 characters. Avoid reusing a password from another site.</small>}
          {authMode === "login" && <button className="forgot-password-link" type="button" onClick={() => setAuthMode("forgot")}>Forgot password?</button>}
          {!supabase && <p className="setup-note">Connect a Supabase project to enable sign-in, course search and role dashboards.</p>}
          {authMode === "login" && <p className="setup-note">The admin dashboard is available only to accounts assigned the admin role in Supabase. There is no public admin sign-up option.</p>}
          <button className="button button-primary auth-submit" name={authMode === "signup" ? "up" : authMode === "update" ? "update" : "in"} disabled={busy}>
            {busy ? "Please wait…" : authMode === "signup" ? "Create account" : authMode === "forgot" ? "Send reset link" : authMode === "update" ? "Update password" : "Log in"}
          </button>
        </form>
        {authMode === "forgot" && <button className="back-to-login" type="button" onClick={() => setAuthMode("login")}>← Back to log in</button>}
        {presentationDemo && demoAuthRequested && <a className="back-to-login" href="/?demo=1">Return to presentation demo</a>}
        {authMode === "signup" && <p className="small-note">Tutor accounts are created as pending applications. An administrator must approve your profile before students can find you.</p>}
      </section>
    </main> : user && !profile ? <main id="main-content" tabIndex={-1} className="page"><section className="empty-state" role={profileLoadError ? "alert" : "status"}>
      <h2>{profileLoading ? "Loading your account" : "Your account profile is unavailable"}</h2>
      <p>{profileLoading ? "Your sign-in is active. We’re loading your TutorConnect profile." : profileLoadError || "Your sign-in is active, but the profile has not loaded."}</p>
      {!profileLoading && <button className="button button-primary" type="button" onClick={() => user && void loadProfile(user.id)}>Retry profile loading</button>}
    </section></main> : profile && section === "profile" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">YOUR ACCOUNT</p><h1>My profile{profile.is_verified && <VerifiedBadge label="TutorConnect verified member" />}</h1><p className="muted">Add a short bio and photo. Student contact details are private; tutor contact links are shown only after a student unlocks them.</p>
        {profile.is_verified && <p className="verified-profile-note">Your account is verified based on active account status and confirmed payment.</p>}
      </section>
      <section className="panel profile-editor">
        <div className="profile-photo-column">
          <div className="profile-photo-preview">{avatarPreview || profile.avatar_url ? <img src={avatarPreview || profile.avatar_url || ""} alt={`${profile.full_name}'s profile`} /> : <span>{profile.full_name.slice(0, 1).toUpperCase()}</span>}</div>
          <small className="muted">{avatarPreview ? "Unsaved preview" : profile.avatar_url ? "Current photo" : "Photo not set"}</small>
        </div>
        <form className="stack-form" onSubmit={(event) => void savePersonalProfile(event)}>
          <label>Full name<input name="full_name" defaultValue={profile.full_name} autoComplete="name" required maxLength={120} /></label>
          <label>Short bio<textarea name="personal_bio" defaultValue={profile.bio || ""} rows={4} maxLength={500} placeholder="A few sentences about you" /></label>
          {profile.role === "student" && <fieldset className="contact-editor">
            <legend>Contact details and social links</legend>
            <p className="muted">Only you and authorized administrators can view these details. They are not shown to tutors or other students.</p>
            <div className="form-row">
              <label>Phone<input name="contact_phone" type="tel" autoComplete="tel" defaultValue={profile.phone || ""} maxLength={40} /></label>
              <label>Contact email<input name="contact_email" type="email" autoComplete="email" defaultValue={profile.contact_email || ""} maxLength={320} /></label>
            </div>
            <label>WhatsApp link<input name="whatsapp_url" type="url" defaultValue={profile.whatsapp_url || ""} maxLength={2048} placeholder="https://wa.me/…" /></label>
            <div className="form-row">
              <label>Instagram profile<input name="instagram_url" type="url" defaultValue={profile.instagram_url || ""} maxLength={2048} placeholder="https://instagram.com/…" /></label>
              <label>Facebook profile<input name="facebook_url" type="url" defaultValue={profile.facebook_url || ""} maxLength={2048} placeholder="https://facebook.com/…" /></label>
            </div>
            <div className="form-row">
              <label>LinkedIn profile<input name="linkedin_url" type="url" defaultValue={profile.linkedin_url || ""} maxLength={2048} placeholder="https://linkedin.com/in/…" /></label>
              <label>X profile<input name="x_url" type="url" defaultValue={profile.x_url || ""} maxLength={2048} placeholder="https://x.com/…" /></label>
            </div>
            <label>Website<input name="website_url" type="url" defaultValue={profile.website_url || ""} maxLength={2048} placeholder="https://…" /></label>
          </fieldset>}
          <label>Profile photo<input ref={avatarInputRef} name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={previewProfilePhoto} /></label>
          <small className="muted">Choose a JPG, PNG or WebP image up to 5 MB. Preview it here, then save to upload or replace your photo.</small>
          <div className="profile-actions">
            <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
            {(profile.avatar_url || profile.avatar_path) && <button className="button button-outline" type="button" disabled={busy} onClick={() => void removeProfilePhoto()}>Remove photo</button>}
          </div>
        </form>
      </section>
    </main> : (profile?.role === "student" || (presentationDemo && !user)) && section === "discover" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">{presentationDemo ? "PRESENTATION EXAMPLES" : "DISCOVER"}</p><h1>{presentationDemo ? "Explore sample tutor profiles" : "Find a tutor for your course"}</h1><p className="muted">{presentationDemo ? "These fictional profiles show how course- and department-matched tutor discovery works." : "Search only approved tutors who teach the selected course and academic unit."}</p></section>
      {recentlyUnlockedContact && <section className="panel contact-box" aria-live="polite">
        <h2>Payment confirmed — tutor contact unlocked</h2>
        <ContactLinks contact={recentlyUnlockedContact} />
        <p className="muted">This contact remains available on the tutor’s card after you search again.</p>
      </section>}
      <form className="search-panel" onSubmit={(event) => void searchSubmit(event)}>
        <label>Institution<select value={institutionId} onChange={(event) => { setInstitutionId(Number(event.target.value)); setUnitId(""); }} required>
          <option value="">Choose institution</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>College, school or department<select value={unitId} onChange={(event) => setUnitId(event.target.value ? Number(event.target.value) : "")}>
          <option value="">All academic units</option>{unitOptions.map((item) => <option key={item.id} value={item.id}>{unitPath(item.id, units)}</option>)}
        </select></label>
        <label>Course code or title<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={presentationDemo ? "Search sample courses, e.g. CS101" : "Search an official course code or title"} required /></label>
        <button className="button button-primary" disabled={busy}>{busy ? "Searching…" : "Search tutors"}</button>
        {(query || unitId !== "") && <button className="button button-outline" type="button" onClick={() => { setQuery(""); setUnitId(""); setResults([]); setResourcesByTutor({}); setHasSearched(false); }}>Clear</button>}
      </form>
      {institutionId !== "" && institutions.find((item) => item.id === institutionId)?.name === "University of Cape Coast" && <p className="source-note">
        UCC academic units follow the <a href="https://academics.ucc.edu.gh/colleges" target="_blank" rel="noreferrer">official UCC structure</a>. The <a href="https://admissions.ucc.edu.gh/catalogue/departments" target="_blank" rel="noreferrer">admissions catalogue</a> lists degree programmes, not semester course codes. Administrators add course codes from verified teaching schedules.
      </p>}
      {hasSearched && <p className="search-result-count" role="status">{busy ? "Searching for tutors…" : presentationDemo ? `${groupedTutors.length} fictional demo profile${groupedTutors.length === 1 ? "" : "s"} shown` : `${groupedTutors.length} approved tutor${groupedTutors.length === 1 ? "" : "s"} found`}</p>}
      <section className="results-grid" aria-live="polite">
        {groupedTutors.length === 0 ? <div className="empty-state"><span className="empty-icon">⌕</span><h2>{hasSearched ? "No tutors found" : "Start with a course"}</h2><p>{hasSearched ? "No approved tutors were found for that course. Try a different course code, title or academic unit." : "Enter a course code or title to see approved, relevant tutors."}</p></div> : groupedTutors.map((tutor) => {
          const matchingResources = (resourcesByTutor[tutor.id] ?? []).filter((resource) =>
            !resource.course_code || tutor.course_codes.includes(resource.course_code),
          );
          return <article className="tutor-card" key={tutor.id}>
            <div className="tutor-card-top"><div className="avatar">{tutor.avatar_url ? <img src={tutor.avatar_url} alt="" /> : (tutor.name || "T").slice(0, 1)}</div><div><h2>{tutor.name}{tutor.featured && <VerifiedBadge label="TutorConnect verified tutor" />}</h2><p className="muted">Courses: {tutor.course_codes.join(", ")}</p></div></div>
            <p>{tutor.bio || "Tutor profile"}</p>
            <div className="unit-label">{[tutor.college, tutor.school, tutor.department].filter(Boolean).join(" / ") || "Academic unit not assigned"}</div>
            <p className="tutor-meta">{tutor.avg_rating ? `★ ${tutor.avg_rating.toFixed(1)} (${tutor.review_count} reviews)` : "No reviews yet"} · {tutor.rate == null ? "Rate not listed" : `GHS ${tutor.rate}/hr`} · {tutor.delivery || "Delivery to be confirmed"}</p>
            {matchingResources.length > 0 && <div className="resource-list"><h3>Teaching previews & learning resources</h3>{matchingResources.map((resource) => <a key={resource.id} href={resource.signed_url || resource.url || undefined} target="_blank" rel="noreferrer"><span>{resource.course_code ? `${resource.course_code} · ` : "General · "}{resourceLabel(resource.resource_type)}</span><b>{resource.title}</b>{resource.description && <small>{resource.description}</small>}</a>)}<small>Course links are shown only for the matching subjects. Third-party materials are identified by their source.</small></div>}
            {contacts[tutor.id] ? <div className="contact-box"><b>Contact unlocked</b><ContactLinks contact={contacts[tutor.id]} /></div>
              : presentationDemo ? demoRole === "student"
                ? <button className="button button-primary" type="button" disabled={busy} onClick={() => void unlockContact(tutor.id)}>Demo unlock contact · GHS 10</button>
                : <button className="button button-outline" type="button" disabled>Contact unlock disabled in demo</button>
                : <button className="button button-primary" disabled={!profile || busy} onClick={() => void unlockContact(tutor.id)}>Unlock contact · GHS 10</button>}
            {profile?.role === "student" && contacts[tutor.id] && <div className="feedback-grid">
              <form className="mini-form" onSubmit={(event) => void submitReview(event, tutor.id)}>
                <h3>Leave a review</h3><label>Rating<select name="rating"><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select></label>
                <label>Feedback<textarea name="comment" rows={2} maxLength={1000} placeholder="Share useful, respectful feedback" /></label>
                <button className="button button-outline">Submit review</button>
              </form>
              <form className="mini-form" onSubmit={(event) => void submitReport(event, tutor.id)}>
                <h3>Report a concern</h3><label>Reason<select name="category"><option>Misleading profile</option><option>Unexpected charges</option><option>Unprofessional conduct</option><option>Service not delivered</option><option>Other</option></select></label>
                <label>Details<textarea name="description" rows={2} required maxLength={2000} /></label>
                <button className="button button-outline">Send private report</button>
              </form>
            </div>}
          </article>;
        })}
      </section>
    </main> : profile?.role === "student" && section === "student" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">STUDENT WORKSPACE</p><h1>Your activity{profile.is_verified && <VerifiedBadge label="TutorConnect verified member" />}</h1><p className="muted">Your reviews and private reports in one place.</p></section>
      <div className="two-column">
        <section className="panel"><h2>My reviews</h2>{studentReviews.length ? studentReviews.map((item) => <article className="list-item" key={item.id}><b>{item.rating} / 5 stars</b><p>{item.comment || "No written comment."}</p><small>{dateLabel(item.created_at)}</small></article>) : <p className="muted">No reviews submitted yet. Unlock a tutor’s contact details to share feedback.</p>}</section>
        <section className="panel"><h2>My reports</h2>{studentReports.length ? studentReports.map((item) => <article className="list-item" key={item.id}><div className="row-between"><b>{item.category}</b><span className={`status ${item.status}`}>{item.status}</span></div><p>{item.description}</p>{item.resolution && <p className="resolution">Outcome: {item.resolution}</p>}<small>{dateLabel(item.created_at)}</small></article>) : <p className="muted">You have no reports.</p>}</section>
      </div>
    </main> : profile?.role === "tutor" && section === "tutor" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">TUTOR WORKSPACE</p><h1>Your teaching dashboard{tutorVerified && <span className="verified-mark verified-mark-large" role="img" aria-label="TutorConnect verified tutor" title="Approved tutor with an active, Paystack-verified plan"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3.3 8.2 3 3 6.4-6.5" /></svg></span>}</h1><p className="muted">Manage your profile, course requests, visibility and student feedback.</p></section>
      <div className="stats-grid">
        <div className="stat-card"><span>Profile status</span><b className={`status ${tutorProfile?.status || "pending"}`}>{tutorProfile?.status || "Loading"}</b></div>
        <div className="stat-card"><span>Verified plan</span><b>{tutorVerified ? "Active" : "Not active"}</b></div>
        <div className="stat-card"><span>Contact unlocks</span><b>{tutorStats?.contact_unlocks ?? 0}</b></div>
        <div className="stat-card"><span>Average rating</span><b>{tutorStats?.average_rating?.toFixed(1) ?? "—"}</b></div>
      </div>
      <section className="panel premium-panel">
        <div className="row-between"><div><p className="eyebrow">TUTOR VISIBILITY</p><h2>Verified tutor mark</h2></div>{tutorVerified && <span className="premium-active-label">Active</span>}</div>
        <p className="muted">The blue mark appears on your tutor profile only when an administrator has approved your account and Paystack has verified an active paid plan.</p>
        {!tutorProfile ? <p className="muted" role="status">Loading your tutor profile…</p> : tutorProfile.status !== "approved" ? <p className="setup-note">Your tutor profile must be approved before you can activate a paid listing. Contact support if you need help with your application.</p> : <>
          {tutorVerified && tutorProfile.premium_until && <p className="premium-expiry">Your plan is active through <strong>{dateLabel(tutorProfile.premium_until)}</strong>. Renewing extends it from its current expiry date.</p>}
          <div className="plan-options">
            <article className="plan-card"><p className="eyebrow">MONTHLY</p><h3>GHS 50</h3><p className="muted">30 days of premium visibility</p><button className="button button-outline" type="button" disabled={busy} onClick={() => void startPremiumCheckout("monthly")}>{busy ? "Opening secure checkout…" : tutorVerified ? "Extend monthly plan" : "Choose monthly"}</button></article>
            <article className="plan-card"><p className="eyebrow">SEMESTER</p><h3>GHS 200</h3><p className="muted">120 days of premium visibility</p><button className="button button-primary" type="button" disabled={busy} onClick={() => void startPremiumCheckout("semester")}>{busy ? "Opening secure checkout…" : tutorVerified ? "Extend semester plan" : "Choose semester"}</button></article>
          </div>
          <small className="muted">Checkout opens on Paystack. The plan and badge activate only after the server verifies the payment.</small>
        </>}
      </section>
      <div className="two-column">
        <section className="panel"><h2>Edit profile</h2><form className="stack-form" onSubmit={(event) => void saveTutorProfile(event)}>
          <label>Biography<textarea name="bio" rows={3} defaultValue={tutorProfile?.bio || ""} maxLength={2000} required /></label>
          <label>Qualifications<textarea name="qualifications" rows={2} defaultValue={tutorProfile?.qualifications || ""} maxLength={1000} /></label>
          <div className="form-row"><label>Hourly rate (GHS)<input name="rate" type="number" min="0" step="0.01" defaultValue={tutorProfile?.rate ?? ""} required /></label>
            <label>Delivery<select name="delivery" defaultValue={tutorProfile?.delivery || "Online"}><option>Online</option><option>In person</option><option>Both</option></select></label></div>
          <label>Availability<input name="availability" defaultValue={tutorProfile?.availability || ""} maxLength={200} /></label>
          <fieldset className="contact-editor">
            <legend>Contact details and social links</legend>
            <p className="muted">Students can see these details only after they unlock your tutor contact.</p>
            <div className="form-row">
              <label>Phone<input name="phone" type="tel" autoComplete="tel" defaultValue={tutorContact?.phone || ""} maxLength={40} /></label>
              <label>Contact email<input name="contact_email" type="email" autoComplete="email" defaultValue={tutorContact?.email || user?.email || ""} maxLength={320} /></label>
            </div>
            <label>WhatsApp link<input name="whatsapp_url" type="url" defaultValue={tutorContact?.whatsapp_url || ""} maxLength={2048} placeholder="https://wa.me/…" /></label>
            <div className="form-row">
              <label>Instagram profile<input name="instagram_url" type="url" defaultValue={tutorContact?.instagram_url || ""} maxLength={2048} placeholder="https://instagram.com/…" /></label>
              <label>Facebook profile<input name="facebook_url" type="url" defaultValue={tutorContact?.facebook_url || ""} maxLength={2048} placeholder="https://facebook.com/…" /></label>
            </div>
            <div className="form-row">
              <label>LinkedIn profile<input name="linkedin_url" type="url" defaultValue={tutorContact?.linkedin_url || ""} maxLength={2048} placeholder="https://linkedin.com/in/…" /></label>
              <label>X profile<input name="x_url" type="url" defaultValue={tutorContact?.x_url || ""} maxLength={2048} placeholder="https://x.com/…" /></label>
            </div>
            <label>Website<input name="website_url" type="url" defaultValue={tutorContact?.website_url || ""} maxLength={2048} placeholder="https://…" /></label>
          </fieldset>
          <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
        </form></section>
        <section className="panel"><h2>My courses</h2><p className="muted">You can teach multiple courses. Request approval for each course you teach; approved courses appear together on your tutor profile.</p>
          {tutorCourses.length ? tutorCourses.map((item) => <article className="list-item" key={item.id}><div className="row-between"><b>{item.courses?.code} · {item.courses?.title}</b><span className={`status ${item.status}`}>{item.status}</span></div><small>{unitPath(item.courses?.academic_unit_id ?? null, units)}</small></article>) : <p className="muted">No course requests yet.</p>}
          <form className="mini-form course-search" onSubmit={(event) => void searchCourseOptions(event)}><h3>Find a course to teach</h3>
            <label>Course code or title<input name="course_query" placeholder="Search the verified course catalogue" required /></label><button className="button button-outline">Search catalogue</button>
          </form>
          {courseSearchPerformed && courseOptions.length === 0 && <p className="setup-note" role="status">No matching courses are available in the verified catalogue yet. Suggest the course below; an administrator will verify its official source before adding it. <a href="/?demo=1&role=tutor">Try the sample tutor catalogue</a>.</p>}
          {courseOptions.map((course) => <form className="course-option" key={course.id} onSubmit={(event) => void requestCourse(event)}><input type="hidden" name="course_id" value={course.id} /><div><b>{course.code} · {course.title}</b><small>{unitPath(course.academic_unit_id, units)}</small></div><button className="button button-outline">Request approval</button></form>)}
          <button className="button button-outline" type="button" onClick={() => setCourseCatalogueFormOpen((open) => !open)} aria-expanded={courseCatalogueFormOpen} aria-controls="course-catalogue-request-form">{courseCatalogueFormOpen ? "Cancel course suggestion" : "Suggest a missing course"}</button>
          {courseCatalogueFormOpen && <form id="course-catalogue-request-form" className="mini-form course-search" onSubmit={(event) => void submitCourseCatalogueRequest(event)}>
            <h3>Suggest a course for the catalogue</h3>
            <p className="muted">The request is saved to your dashboard immediately. It becomes a shared catalogue course only after an administrator verifies it against an official source.</p>
            <label>Course code<input name="code" required maxLength={40} placeholder="Course code from your outline" /></label>
            <label>Course title<input name="title" required maxLength={200} defaultValue={courseSearchTerm} /></label>
            <label>Academic unit<select name="academic_unit_id" defaultValue=""><option value="">Unassigned</option>{units.filter((item) => item.unit_type === "department").map((item) => <option key={item.id} value={item.id}>{unitPath(item.id, units)}</option>)}</select></label>
            <label>Official course outline or teaching schedule<input name="source_url" type="url" maxLength={2048} placeholder="Optional HTTPS link for the administrator to verify" /></label>
            <div className="row-between"><button className="button button-outline" type="button" onClick={() => setCourseCatalogueFormOpen(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save course suggestion"}</button></div>
          </form>}
          {courseCatalogueRequests.length > 0 && <section className="course-request-list" aria-label="My course catalogue suggestions">
            <h3>My catalogue suggestions</h3>
            {courseCatalogueRequests.map((request) => <article className="list-item" key={request.id}>
              <div className="row-between"><b>{request.code} · {request.title}</b><span className={`status ${request.status}`}>{request.status}</span></div>
              <small>{unitPath(request.academic_unit_id, units)}</small>
              {request.status === "approved" && <p className="muted">Added to the shared catalogue. Your tutor teaching request is listed above for separate approval.</p>}
              {request.admin_note && <p className="muted">Administrator note: {request.admin_note}</p>}
            </article>)}
          </section>}
        </section>
      </div>
      <section className="panel"><h2>Teaching previews and resources</h2><p className="muted">Add resources separately for each approved course you teach. Publish one resource per GHS 50 payment: upload an MP4/WebM video, PDF, Office document, text file or image (up to 50 MB), or share a YouTube/HTTPS link. Course links appear only beside matching subjects. Share only materials you own or are authorized to distribute.</p>
        {tutorProfile?.status !== "approved" ? <p className="setup-note">Your tutor profile must be approved before you can pay for or publish resources.</p>
          : resourceCreditsError ? <div className="empty-state" role="alert"><h3>Could not check your resource credits</h3><p>{resourceCreditsError}</p><button className="button button-outline" type="button" onClick={() => void loadTutorDashboard(profile.id)}>Try again</button></div>
            : resourceCredits.length === 0 ? <div className="resource-credit-box"><p>You have no unused resource credits. Pay GHS 50 to publish one file or link.</p><button className="button button-primary" type="button" disabled={busy} onClick={() => void startResourceCheckout()}>{busy ? "Opening secure checkout…" : "Pay GHS 50 for one resource"}</button></div>
            : <form className="resource-form" onSubmit={(event) => void saveTutorResource(event)}>
              <p className="resource-credit-note">Unused publishing credits: {resourceCredits.length}. Publishing a resource uses one credit.</p>
              <label>Resource type<select name="resource_type"><option value="teaching_video">Teaching video</option><option value="course_resource">Course resource</option><option value="past_questions">Past questions</option></select></label>
              <label>Approved course<select name="course_id" required>
                <option value="">Choose one of your approved courses</option>
                {tutorCourses.filter((item) => item.status === "approved").map((item) => <option key={item.id} value={item.courses?.id ?? ""}>{item.courses ? `${item.courses.code} · ${item.courses.title}` : "Course unavailable"}</option>)}
              </select></label>
              <label>Title<input name="title" required maxLength={160} /></label>
              <label>Upload a file<input name="resource_file" type="file" accept="video/mp4,video/webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,image/jpeg,image/png,image/webp" /></label>
              <label>Or external HTTPS link<input name="url" type="url" maxLength={2048} placeholder="https://…" /></label>
              <label>Source or description<textarea name="description" rows={2} maxLength={300} placeholder="Who created it? Is it an open or authorized resource?" /></label>
              <button className="button button-outline" disabled={busy}>{busy ? "Publishing…" : "Publish resource"}</button>
            </form>}
        {tutorResources.length ? tutorResources.map((resource) => {
          const course = tutorCourses.find((item) => item.courses?.id === resource.course_id)?.courses;
          return <article className="resource-row" key={resource.id}><div><span className="resource-type">{resourceLabel(resource.resource_type)}</span>{course && <small className="resource-course">{course.code} · {course.title}</small>}<a href={resource.signed_url || resource.url || undefined} target="_blank" rel="noreferrer"><b>{resource.title}</b></a>{resource.description && <p className="muted">{resource.description}</p>}</div><button className="button button-outline" type="button" disabled={busy} onClick={() => void removeTutorResource(resource.id)}>Remove</button></article>;
        }) : <p className="muted">No resources added yet. Add a YouTube lesson or authorized resource for an approved course.</p>}
      </section>
      <section className="panel"><h2>Student feedback</h2>{tutorReviews.length ? tutorReviews.map((item) => <article className="list-item" key={item.id}><div className="row-between"><b>{item.rating} / 5 stars</b><span className={`status ${item.status}`}>{item.status}</span></div><p>{item.comment || "No written comment."}</p><small>{dateLabel(item.created_at)}</small></article>) : <p className="muted">No reviews yet.</p>}</section>
    </main> : profile?.role === "admin" && section === "admin" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">ADMINISTRATION</p><h1>Trust & quality workspace</h1><p className="muted">Review tutor applications, course associations, reports and feedback. Decisions require a reason and are audited.</p></section>
      <div className="stats-grid"><div className="stat-card"><span>Pending tutors</span><b>{pendingTutors}</b></div><div className="stat-card"><span>Course requests</span><b>{adminTutorCourses.length + adminCourseCatalogueRequests.length}</b></div><div className="stat-card"><span>Open reports</span><b>{unresolvedReports}</b></div><div className="stat-card"><span>Total reviews</span><b>{adminReviews.length}</b></div><div className="stat-card"><span>Catalog courses</span><b>{adminCourses.length}</b></div></div>
      <div className="admin-tabs" role="group" aria-label="Moderation sections">
        {["applications", "course requests", "reports", "reviews", "courses", "audit"].map((tab) => <button key={tab} type="button" aria-pressed={adminTab === tab} onClick={() => setAdminTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
      </div>
      {adminTab === "applications" && <section className="panel"><h2>Tutor applications & status</h2>{adminTutors.length ? adminTutors.map((item) => <article className="moderation-card" key={item.id}>
        <div className="row-between"><div><h3>{profileNames[item.id] || "Tutor applicant"}</h3><span className={`status ${item.status}`}>{item.status}</span></div><small>{item.id}</small></div>
        <p>{item.bio || "Biography not provided."}</p><p className="muted">{item.qualifications || "Qualifications not provided."}</p>
        <form className="moderation-form" onSubmit={(event) => { if (!window.confirm("Save this tutor status change? It can affect the tutor's visibility.")) event.preventDefault(); else void moderateTutor(event, item.id); }}><label>Decision<select name="status" defaultValue={item.status}><option value="approved">Approve</option><option value="rejected">Reject</option><option value="suspended">Suspend</option><option value="removed">Remove</option></select></label><label>Reason<textarea name="reason" required minLength={4} maxLength={1000} /></label><button className="button button-primary">Save decision</button></form>
      </article>) : <p className="muted">No tutor profiles found.</p>}</section>}
      {adminTab === "course requests" && <section className="panel"><h2>Tutor course requests</h2>{adminTutorCourses.length ? adminTutorCourses.map((item) => <article className="moderation-card" key={item.id}>
        <div className="row-between"><h3>{profileNames[item.tutor_id] || "Tutor"} · {item.courses ? `${item.courses.code} · ${item.courses.title}` : "Course unavailable"}</h3><span className="status pending">pending</span></div>
        <p className="muted">{item.courses ? unitPath(item.courses.academic_unit_id, units) : ""}</p>
        <form className="moderation-form" onSubmit={(event) => { if (!window.confirm("Save this course approval decision?")) event.preventDefault(); else void moderateTutorCourse(event, item.id); }}><label>Decision<select name="status"><option value="approved">Approve</option><option value="rejected">Reject</option></select></label><label>Reason<textarea name="reason" required minLength={4} maxLength={1000} /></label><button className="button button-primary">Save decision</button></form>
      </article>) : <p className="muted">No tutor-to-course requests need review.</p>}
        <h2>Proposed catalogue courses</h2><p className="muted">Verify the code, title, academic unit and HTTPS source before approving. Approval adds the course to the shared catalogue and queues the tutor’s separate teaching request.</p>
        {adminCourseCatalogueRequests.length ? adminCourseCatalogueRequests.map((request) => <article className="moderation-card" key={request.id}>
          <div className="row-between"><h3>{request.code} · {request.title}</h3><span className="status pending">pending</span></div>
          <p>Submitted by {profileNames[request.requested_by] || "Tutor"} · {unitPath(request.academic_unit_id, units)}</p>
          {request.source_url && <p>Suggested source: <a href={request.source_url} target="_blank" rel="noreferrer">{request.source_url}</a></p>}
          <form className="moderation-form" onSubmit={(event) => { if (!window.confirm("Save this catalogue decision? Approval publishes the course after you provide an official source.")) event.preventDefault(); else void moderateCourseCatalogueRequest(event, request.id); }}>
            <label>Decision<select name="status" required defaultValue=""><option value="" disabled>Choose a decision</option><option value="approved">Approve and add to catalogue</option><option value="rejected">Reject</option></select></label>
            <label>Verified official source URL<input name="source_url" type="url" maxLength={2048} defaultValue={request.source_url || ""} placeholder="Required to approve; HTTPS only" /></label>
            <label>Reason<textarea name="reason" required minLength={4} maxLength={1000} /></label><button className="button button-primary">Save catalogue decision</button>
          </form>
        </article>) : <p className="muted">No proposed catalogue courses need review.</p>}
      </section>}
      {adminTab === "reports" && <section className="panel"><h2>Reports queue</h2>{adminReports.length ? adminReports.map((item) => <article className="moderation-card" key={item.id}>
        <div className="row-between"><h3>{item.category} · {profileNames[item.tutor_id] || "Tutor"}</h3><span className={`status ${item.status}`}>{item.status}</span></div><p>{item.description}</p><small>Received {dateLabel(item.created_at)}</small>
        <form className="moderation-form" onSubmit={(event) => { if (!window.confirm("Save this report status and outcome?")) event.preventDefault(); else void moderateReport(event, item.id); }}><label>Status<select name="status" defaultValue={item.status}><option value="open">Open</option><option value="in review">In review</option><option value="resolved">Resolved</option></select></label><label>Outcome<textarea name="resolution" required maxLength={1000} defaultValue={item.resolution || ""} /></label><label>Moderator reason<textarea name="reason" required minLength={4} maxLength={1000} /></label><button className="button button-primary">Save report decision</button></form>
      </article>) : <p className="muted">No reports received.</p>}</section>}
      {adminTab === "reviews" && <section className="panel"><h2>Reviews moderation</h2>{adminReviews.length ? adminReviews.map((item) => <article className="moderation-card" key={item.id}>
        <div className="row-between"><b>{item.rating} / 5 stars · {profileNames[item.tutor_id] || "Tutor"}</b><span className={`status ${item.status}`}>{item.status}</span></div><p>{item.comment || "No written comment."}</p><small>{dateLabel(item.created_at)}</small>
        <form className="moderation-form" onSubmit={(event) => { if (!window.confirm("Save this review visibility decision?")) event.preventDefault(); else void moderateReview(event, item.id); }}><label>Visibility<select name="status" defaultValue={item.status}><option value="published">Publish</option><option value="hidden">Hide</option></select></label><label>Reason<textarea name="reason" required minLength={4} maxLength={1000} /></label><button className="button button-primary">Save review decision</button></form>
      </article>) : <p className="muted">No reviews submitted.</p>}</section>}
      {adminTab === "courses" && <div className="two-column">
        <section className="panel"><h2>Add verified course</h2><p className="source-note">Do not enter degree programmes as course units. UCC’s public catalogue lists programmes; use official teaching schedules for actual course codes.</p>
          <form className="stack-form" onSubmit={(event) => void createCourse(event)}><label>Institution<select value={institutionId} onChange={(event) => { setInstitutionId(Number(event.target.value)); setUnitId(""); }} required>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Academic unit<select name="academic_unit_id" defaultValue=""><option value="">Unassigned</option>{units.filter((item) => item.unit_type === "department").map((item) => <option key={item.id} value={item.id}>{unitPath(item.id, units)}</option>)}</select></label>
            <label>Course code<input name="code" required maxLength={40} /></label><label>Course title<input name="title" required maxLength={200} /></label><label>Official course-source URL<input name="source_url" type="url" required placeholder="Official course outline or teaching schedule" /></label><button className="button button-primary">Add course</button>
          </form>
          <form className="stack-form unit-form" onSubmit={(event) => void createAcademicUnit(event)}><h3>Add college, school or department</h3><p className="muted">Use the name and parent shown in UCC’s official academic structure.</p>
            <label>Unit type<select name="unit_type"><option value="college">College</option><option value="school">School</option><option value="faculty">Faculty</option><option value="department">Department</option></select></label>
            <label>Parent unit<select name="parent_id" defaultValue=""><option value="">No parent (college)</option>{units.map((item) => <option key={item.id} value={item.id}>{unitPath(item.id, units)}</option>)}</select></label>
            <label>Unit name<input name="name" required maxLength={200} /></label><label>Official structure URL<input name="unit_source_url" type="url" placeholder="https://academics.ucc.edu.gh/…" /></label><button className="button button-outline">Add academic unit</button>
          </form>
        </section>
        <section className="panel"><h2>Courses by academic unit</h2>{groupedCourses.length ? groupedCourses.map(([group, items]) => <details className="course-group" key={group} open><summary>{group}<span>{items.length}</span></summary>{items.map((course) => <div className="course-option" key={course.id}><div><b>{course.code} · {course.title}</b>{course.source_url && <a href={course.source_url} target="_blank" rel="noreferrer">Official source</a>}</div></div>)}</details>) : <p className="muted">No course units have been added. Add verified course codes from an official teaching schedule.</p>}</section>
      </div>}
      {adminTab === "audit" && <section className="panel"><h2>Moderation audit log</h2>{adminActions.length ? adminActions.map((item) => <article className="list-item" key={item.id}><div className="row-between"><b>{item.action}</b><small>{dateLabel(item.created_at)}</small></div><p>{item.reason}</p><small>Admin {profileNames[item.admin_id] || item.admin_id} · Target {item.target_id}</small></article>) : <p className="muted">No admin actions recorded.</p>}</section>}
    </main> : <main id="main-content" tabIndex={-1} className="page"><section className="empty-state" role="status" aria-live="polite"><h1>Loading your workspace</h1><p className="muted">Your account role and permissions are being checked.</p></section></main>}
    <footer className="app-footer"><span>TutorConnect · course units link to official sources; external learning resources are source-labelled and not lecturer endorsements.</span><span>Contact administrators: <a href="mailto:baidoomensahama@gmail.com">baidoomensahama@gmail.com</a> · <a href="tel:0245664985">0245664985</a> · <a href="https://wa.me/2332456698495" target="_blank" rel="noreferrer">WhatsApp</a></span></footer>
  </div>;
}
