import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

type Role = "student" | "tutor" | "admin";
type Section = "discover" | "student" | "tutor" | "admin" | "profile" | "programmes" | "resources";
type Institution = { id: number; name: string };
type AcademicUnit = { id: number; name: string; unit_type: string; parent_id: number | null };
type Profile = { id: string; full_name: string; role: Role; bio: string | null; avatar_path: string | null; avatar_url: string | null };
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
type TutorResource = { id: number; tutor_id: string; course_id: number | null; resource_type: "teaching_video" | "course_resource" | "past_questions"; title: string; url: string; description: string | null; created_at: string };
type CourseLearningResource = { id: number; course_id: number; resource_type: "video" | "notes" | "open_textbook" | "practice" | "past_questions"; title: string; url: string; source_name: string; description: string | null; license_name: string | null; license_url: string | null };
type Contact = { tutor_id: string; phone: string | null; email: string | null };
type Review = { id: number; tutor_id: string; student_id: string; rating: number; comment: string | null; status: string; created_at: string };
type Report = { id: number; tutor_id: string; reporter_id: string; category: string; description: string; status: string; resolution: string | null; created_at: string };
type TutorProfile = { id: string; bio: string | null; qualifications: string | null; rate: number | null; delivery: string | null; availability: string | null; status: string; premium_until: string | null; views: number };
type Course = { id: number; institution_id: number; code: string; title: string; academic_unit_id: number | null; source_url: string | null };
type AcademicProgramme = { id: number; programme_title: string; award: string; level: string; catalogue_unit: string; college_name: string | null; school_name: string | null; source_url: string };
type TutorCourse = { id: number; status: string; courses: Course | null };
type TutorStats = { profile_views: number; contact_unlocks: number; review_count: number; average_rating: number | null };
type AdminTutor = { id: string; bio: string | null; qualifications: string | null; status: string };
type AdminTutorCourse = { id: number; tutor_id: string; status: string; courses: Course | null };
type AdminProfile = { id: string; full_name: string | null; role: Role };
type AdminAction = { id: number; admin_id: string; target_id: string; action: string; reason: string; created_at: string };
type AssistantMessage = { role: "user" | "model"; text: string };

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
const courseResourceLabel = (type: CourseLearningResource["resource_type"]) => ({
  video: "Video lesson",
  notes: "Notes",
  open_textbook: "Open textbook",
  practice: "Practice materials",
  past_questions: "Past questions",
}[type]);

const subjectResourceFallback = [
  { subject: "Mathematics", title: "MIT 18.06 Linear Algebra", url: "https://www.youtube.com/playlist?list=PLEAYkSg4uSQ1-bul680xs3oaCwI90yZHb", resource: "MIT OpenCourseWare · linear algebra video playlist", source: "MIT OpenCourseWare" },
  { subject: "Mathematics", title: "3Blue1Brown", url: "https://www.youtube.com/@3blue1brown", resource: "Visual mathematics playlists including linear algebra and calculus", source: "3Blue1Brown" },
  { subject: "Calculus", title: "Khan Academy Calculus", url: "https://www.youtube.com/@khanacademy", resource: "Calculus videos and practice resources", source: "Khan Academy" },
  { subject: "Physics", title: "MIT OpenCourseWare Physics", url: "https://www.youtube.com/@MITOCW", resource: "Physics lectures and full course playlists", source: "MIT OpenCourseWare" },
  { subject: "Computer Science", title: "Harvard CS50", url: "https://cs50.harvard.edu/x/", resource: "CS50 lectures, notes and problem sets", source: "Harvard University" },
  { subject: "Chemistry", title: "The Organic Chemistry Tutor", url: "https://www.youtube.com/@TheOrganicChemistryTutor", resource: "Worked chemistry and mathematics lessons", source: "The Organic Chemistry Tutor" },
];

export default function App() {
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const authUserId = useRef<string | null>(null);
  const avatarPreviewUrl = useRef<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [recentlyUnlockedContact, setRecentlyUnlockedContact] = useState<Contact | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState<number | "">("");
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [unitId, setUnitId] = useState<number | "">("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchTutor[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [studentReviews, setStudentReviews] = useState<Review[]>([]);
  const [studentReports, setStudentReports] = useState<Report[]>([]);
  const [tutorProfile, setTutorProfile] = useState<TutorProfile | null>(null);
  const [tutorContact, setTutorContact] = useState<Contact | null>(null);
  const [tutorCourses, setTutorCourses] = useState<TutorCourse[]>([]);
  const [tutorResources, setTutorResources] = useState<TutorResource[]>([]);
  const [resourcesByTutor, setResourcesByTutor] = useState<Record<string, TutorResource[]>>({});
  const [tutorReviews, setTutorReviews] = useState<Review[]>([]);
  const [tutorStats, setTutorStats] = useState<TutorStats | null>(null);
  const [courseOptions, setCourseOptions] = useState<Course[]>([]);
  const [adminTutors, setAdminTutors] = useState<AdminTutor[]>([]);
  const [adminTutorCourses, setAdminTutorCourses] = useState<AdminTutorCourse[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>([]);
  const [adminReports, setAdminReports] = useState<Report[]>([]);
  const [adminReviews, setAdminReviews] = useState<Review[]>([]);
  const [adminCourses, setAdminCourses] = useState<Course[]>([]);
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [academicProgrammes, setAcademicProgrammes] = useState<AcademicProgramme[]>([]);
  const [courseResourceCourses, setCourseResourceCourses] = useState<Array<Course & { resources: CourseLearningResource[] }>>([]);
  const [courseResourcesLoading, setCourseResourcesLoading] = useState(false);
  const [courseResourcesError, setCourseResourcesError] = useState<string | null>(null);
  const [courseResourceQuery, setCourseResourceQuery] = useState("");
  const [courseResourceReload, setCourseResourceReload] = useState(0);
  const [programmesLoading, setProgrammesLoading] = useState(false);
  const [programmesError, setProgrammesError] = useState<string | null>(null);
  const [programmeQuery, setProgrammeQuery] = useState("");
  const [programmeLevel, setProgrammeLevel] = useState("");
  const [programmeReload, setProgrammeReload] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [section, setSection] = useState<Section>("discover");
  const [adminTab, setAdminTab] = useState("applications");
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const assistantInputRef = useRef<HTMLTextAreaElement>(null);
  const assistantEndRef = useRef<HTMLDivElement>(null);

  const unitOptions = useMemo(() => units.filter((unit) => unit.unit_type === "department" || unit.unit_type === "school" || unit.unit_type === "college"), [units]);
  const profileNames = useMemo(() => Object.fromEntries(adminProfiles.map((item) => [item.id, item.full_name || "TutorConnect member"])), [adminProfiles]);
  const tutorVerified = tutorProfile?.status === "approved"
    && !!tutorProfile.premium_until
    && Date.parse(tutorProfile.premium_until) > Date.now();

  useEffect(() => {
    if (assistantOpen) assistantInputRef.current?.focus();
  }, [assistantOpen]);

  useEffect(() => {
    assistantEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [assistantMessages, assistantLoading]);

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
    setTutorResources([]);
    setTutorReviews([]);
    setTutorStats(null);
    setAdminTutors([]);
    setAdminTutorCourses([]);
    setAdminProfiles([]);
    setAdminReports([]);
    setAdminReviews([]);
    setAdminCourses([]);
    setAdminActions([]);
  }

  async function loadProfile(id: string) {
    if (!supabase) return;
    const { data, error } = await supabase.from("profiles").select("id,full_name,role,bio,avatar_path").eq("id", id).single();
    if (error) {
      setNotice(error.message);
      return;
    }

    let avatarUrl: string | null = null;
    if (data.avatar_path) {
      const { data: signedPhoto, error: photoError } = await supabase.storage.from("profile-photos").createSignedUrl(data.avatar_path, 3600);
      if (photoError) setNotice(photoError.message);
      else avatarUrl = signedPhoto.signedUrl;
    }
    setProfile({ id: data.id, full_name: data.full_name || "TutorConnect member", role: roleFrom(data.role), bio: data.bio, avatar_path: data.avatar_path, avatar_url: avatarUrl });
  }

  async function requestAssistantReply(messages: AssistantMessage[]) {
    if (!supabase || !user) {
      setAssistantError("Log in to chat with the AI assistant.");
      return;
    }

    setAssistantLoading(true);
    setAssistantError("");
    try {
      const { data, error } = await supabase.functions.invoke<{ reply?: string }>("student-assistant", {
        body: { messages },
      });
      if (error) throw new Error(error.message);
      if (!data || typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The assistant returned an empty reply. Please try again.");
      }
      setAssistantMessages([...messages, { role: "model", text: data.reply.trim() }]);
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "The assistant is unavailable. Please try again.");
    } finally {
      setAssistantLoading(false);
    }
  }

  async function sendAssistantMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = assistantDraft.trim();
    if (!text || assistantLoading || assistantMessages[assistantMessages.length - 1]?.role === "user") return;
    if (!user) {
      setAssistantError("Log in to chat with the AI assistant.");
      return;
    }
    const messages = [...assistantMessages.slice(-11), { role: "user" as const, text }];
    setAssistantMessages(messages);
    setAssistantDraft("");
    await requestAssistantReply(messages);
  }

  async function askAssistantPrompt(prompt: string) {
    if (!user || assistantLoading) return;
    const messages = [...assistantMessages.slice(-11), { role: "user" as const, text: prompt }];
    setAssistantMessages(messages);
    setAssistantError("");
    await requestAssistantReply(messages);
  }

  function clearAssistantConversation() {
    setAssistantMessages([]);
    setAssistantDraft("");
    setAssistantError("");
  }

  async function retryAssistantMessage() {
    if (assistantLoading || assistantMessages[assistantMessages.length - 1]?.role !== "user") return;
    await requestAssistantReply(assistantMessages);
  }

  useEffect(() => {
    if (!supabase) return;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (authUserId.current !== nextUserId) {
        authUserId.current = nextUserId;
        clearAccountData();
      }
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null);
      setProfile(null);
      if (session?.user) void Promise.resolve().then(() => loadProfile(session.user.id));
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setNotice(error.message);
      const sessionUser = data.session?.user;
      const nextUserId = sessionUser?.id ?? null;
      if (authUserId.current !== nextUserId) {
        authUserId.current = nextUserId;
        clearAccountData();
      }
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? null } : null);
      if (sessionUser) void loadProfile(sessionUser.id);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return;
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
          .select("tutor_id,phone,email").eq("tutor_id", data.tutor_id).maybeSingle();
        if (contactError) setNotice(`Payment verified, but contact details could not be loaded: ${contactError.message}`);
        else if (contact) {
          setRecentlyUnlockedContact(contact);
          setContacts((current) => ({ ...current, [contact.tutor_id]: contact }));
          setNotice("Payment verified. Tutor contact unlocked.");
        } else {
          setNotice("Payment verified, but this tutor has no contact details listed.");
        }
      } else if (data?.status === "paid" && (data.purpose === "premium" || !data.tutor_id)) {
        setSection("tutor");
        await loadTutorDashboard(user.id);
        setNotice("Paystack verified your tutor plan. Your blue verified mark is now active.");
      } else {
        setNotice("Payment was not completed; contact details remain locked.");
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
    const signUp = authMode === "signup";
    const forgot = authMode === "forgot";
    setBusy(true);
    if (forgot) {
      const email = String(values.get("e")).trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin,
      });
      setBusy(false);
      setNotice(error?.message ?? "If an account exists for that email, a password reset link has been sent.");
      return;
    }
    const email = String(values.get("e")).trim();
    const password = String(values.get("p"));
    const result = signUp
      ? await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: String(values.get("n")), role: String(values.get("r")) },
          emailRedirectTo: location.origin,
        },
      })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setBusy(false);
      const lowerMessage = result.error.message.toLowerCase();
      const duplicateAccount = lowerMessage.includes("already registered")
        || lowerMessage.includes("already exists")
        || lowerMessage.includes("user already");
      if (duplicateAccount && signUp) {
        setAuthMode("login");
        setNotice("This email is already registered. Use the Log in tab and your existing password.");
        return;
      }
      setNotice(result.error.message.toLowerCase().includes("invalid login")
        ? "The email or password is incorrect. Use “Forgot password?” below the password field to recover your account."
        : result.error.message);
      return;
    }
    if (signUp && !result.data.session) {
      const loginResult = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (loginResult.error) {
        setNotice("Account created, but automatic sign-in failed. Use the Log in tab with the password you just chose.");
      } else {
        setNotice("Account created. You are signed in and ready to continue.");
      }
      return;
    }
    setBusy(false);
    setNotice(signUp ? "Account created. You are signed in and ready to continue." : "");
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    setNotice(error?.message ?? "");
    setSection("discover");
    setProfile(null);
  }

  async function runSearch() {
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
      const ids = rows.map((row) => row.id);
      if (ids.length) {
        const { data: resources, error: resourceError } = await client.from("tutor_resources")
          .select("id,tutor_id,course_id,resource_type,title,url,description,created_at")
          .in("tutor_id", ids).eq("is_public", true).order("created_at", { ascending: false });
        if (resourceError) {
          setNotice(resourceError.message);
          setResourcesByTutor({});
        } else setResourcesByTutor((resources ?? []).reduce<Record<string, TutorResource[]>>((grouped, item) => {
          grouped[item.tutor_id] = [...(grouped[item.tutor_id] ?? []), item];
          return grouped;
        }, {}));
      } else {
        setResourcesByTutor({});
      }
      if (user && ids.length) {
        const { data: unlocked, error: contactError } = await client.from("tutor_contacts").select("tutor_id,phone,email").in("tutor_id", ids);
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

  async function unlockContact(tutorId: string) {
    if (!supabase || !user) {
      setNotice("Log in as a student before unlocking contact details.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("payments", {
      body: { action: "contact", tutor_id: tutorId, callback_url: location.origin },
    });
    setBusy(false);
    if (error) setNotice(error.message);
    else if (data?.url) location.href = data.url;
    else setNotice("Payment could not be started. Please try again.");
  }

  async function startPremiumCheckout(plan: "monthly" | "semester") {
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
        setNotice(error.message);
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
    if (!supabase) return;
    const [profileResult, contactResult, coursesResult, reviewsResult, statsResult, resourcesResult] = await Promise.all([
      supabase.from("tutor_profiles").select("id,bio,qualifications,rate,delivery,availability,status,premium_until,views").eq("id", id).maybeSingle(),
      supabase.from("tutor_contacts").select("tutor_id,phone,email").eq("tutor_id", id).maybeSingle(),
      supabase.from("tutor_courses").select("id,status,courses(id,institution_id,code,title,academic_unit_id,source_url)").eq("tutor_id", id).order("id"),
      supabase.from("reviews").select("id,tutor_id,student_id,rating,comment,status,created_at").eq("tutor_id", id).order("created_at", { ascending: false }),
      supabase.rpc("tutor_dashboard_stats"),
      supabase.from("tutor_resources").select("id,tutor_id,course_id,resource_type,title,url,description,created_at").eq("tutor_id", id).order("created_at", { ascending: false }),
    ]);
    const failure = profileResult.error || contactResult.error || coursesResult.error || reviewsResult.error || statsResult.error || resourcesResult.error;
    if (failure) setNotice(failure.message);
    setTutorProfile(profileResult.data ?? null);
    setTutorContact(contactResult.data ?? null);
    setTutorCourses((coursesResult.data ?? []).map((row) => ({
      ...row,
      courses: Array.isArray(row.courses) ? row.courses[0] ?? null : row.courses,
    })));
    setTutorReviews(reviewsResult.data ?? []);
    setTutorResources(resourcesResult.data ?? []);
    setTutorStats(statsResult.data?.[0] ?? null);
  }

  async function savePersonalProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !profile) return;
    const values = new FormData(event.currentTarget);
    const fullName = String(values.get("full_name") || "").trim();
    const bio = String(values.get("personal_bio") || "").trim();
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
    const { error: updateError } = await supabase.from("profiles").update({ full_name: fullName, bio, avatar_path: nextAvatarPath }).eq("id", profile.id);
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
    setProfile({ ...profile, full_name: fullName, bio, avatar_path: nextAvatarPath, avatar_url: avatarUrl });
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
    if (!supabase || !profile || profile.role !== "tutor") return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const url = String(values.get("url") || "").trim();
    if (!url.startsWith("https://")) {
      setNotice("Resource links must use HTTPS.");
      return;
    }
    if (String(values.get("resource_type")) === "teaching_video") {
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
    const { data, error } = await supabase.from("tutor_resources").insert({
      tutor_id: profile.id,
      course_id: courseId ? Number(courseId) : null,
      resource_type: String(values.get("resource_type")),
      title: String(values.get("title")).trim(),
      url,
      description: String(values.get("description") || "").trim() || null,
    }).select("id,tutor_id,course_id,resource_type,title,url,description,created_at").single();
    if (error) setNotice(error.message);
    else {
      setTutorResources((current) => [data, ...current]);
      form.reset();
      setNotice("Resource added to your profile.");
    }
  }

  async function removeTutorResource(id: number) {
    if (!supabase || !profile || profile.role !== "tutor") return;
    const { error } = await supabase.from("tutor_resources").delete().eq("id", id).eq("tutor_id", profile.id);
    if (error) setNotice(error.message);
    else {
      setTutorResources((current) => current.filter((item) => item.id !== id));
      setNotice("Resource removed.");
    }
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
    const { error: contactError } = await supabase.from("tutor_contacts").upsert({
      tutor_id: profile.id,
      phone: String(values.get("phone")).trim(),
      email: String(values.get("contact_email")).trim(),
    }, { onConflict: "tutor_id" });
    setBusy(false);
    if (contactError) {
      setNotice(`Tutor profile saved, but contact details were not saved: ${contactError.message}`);
      await loadTutorDashboard(profile.id);
      return;
    }
    setTutorContact({
      tutor_id: profile.id,
      phone: String(values.get("phone")).trim() || null,
      email: String(values.get("contact_email")).trim() || null,
    });
    setNotice("Profile and contact details saved.");
    await loadTutorDashboard(profile.id);
  }

  async function searchCourseOptions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || institutionId === "") return;
    const values = new FormData(event.currentTarget);
    const term = String(values.get("course_query")).trim();
    if (!term) {
      setCourseOptions([]);
      return;
    }
    const [codeResult, titleResult] = await Promise.all([
      supabase.from("courses").select("id,institution_id,code,title,academic_unit_id,source_url").eq("institution_id", institutionId).ilike("code", `%${term}%`).eq("active", true).limit(20),
      supabase.from("courses").select("id,institution_id,code,title,academic_unit_id,source_url").eq("institution_id", institutionId).ilike("title", `%${term}%`).eq("active", true).limit(20),
    ]);
    const error = codeResult.error || titleResult.error;
    if (error) setNotice(error.message);
    else setCourseOptions(Array.from(new Map([...(codeResult.data ?? []), ...(titleResult.data ?? [])].map((course) => [course.id, course])).values()));
  }

  async function requestCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !profile) return;
    const values = new FormData(event.currentTarget);
    const { error } = await supabase.from("tutor_courses").insert({
      tutor_id: profile.id,
      course_id: Number(values.get("course_id")),
      status: "pending",
    });
    setNotice(error?.message ?? "Course request sent for administrator approval.");
    if (!error) await loadTutorDashboard(profile.id);
  }

  async function loadAdminDashboard() {
    if (!supabase) return;
    const [tutorsResult, tutorCoursesResult, profilesResult, reportsResult, reviewsResult, coursesResult, actionsResult] = await Promise.all([
      supabase.from("tutor_profiles").select("id,bio,qualifications,status"),
      supabase.from("tutor_courses").select("id,tutor_id,status,courses(id,institution_id,code,title,academic_unit_id,source_url)").eq("status", "pending").order("id"),
      supabase.from("profiles").select("id,full_name,role"),
      supabase.from("reports").select("id,tutor_id,reporter_id,category,description,status,resolution,created_at").order("created_at", { ascending: false }),
      supabase.from("reviews").select("id,tutor_id,student_id,rating,comment,status,created_at").order("created_at", { ascending: false }),
      supabase.from("courses").select("id,institution_id,code,title,academic_unit_id,source_url").order("title"),
      supabase.from("admin_actions").select("id,admin_id,target_id,action,reason,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    const failure = tutorsResult.error || tutorCoursesResult.error || profilesResult.error || reportsResult.error || reviewsResult.error || coursesResult.error || actionsResult.error;
    if (failure) setNotice(failure.message);
    setAdminTutors(tutorsResult.data ?? []);
    setAdminTutorCourses((tutorCoursesResult.data ?? []).map((row) => ({
      ...row,
      courses: Array.isArray(row.courses) ? row.courses[0] ?? null : row.courses,
    })));
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

  const unresolvedReports = adminReports.filter((item) => item.status !== "resolved").length;
  const pendingTutors = adminTutors.filter((item) => item.status === "pending").length;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="app-header">
      <a className="brand" href="/" aria-label="TutorConnect home" onClick={(event) => { event.preventDefault(); navigate(profile?.role === "tutor" ? "tutor" : profile?.role === "admin" ? "admin" : "discover"); }}>
        <span className="brand-mark">TC</span><span>TutorConnect</span>
      </a>
      <nav aria-label="Main navigation">
        <button className={section === "resources" ? "nav-link active" : "nav-link"} aria-current={section === "resources" ? "page" : undefined} onClick={() => navigate("resources")}>Courses & resources</button>
        <button className={section === "programmes" ? "nav-link active" : "nav-link"} aria-current={section === "programmes" ? "page" : undefined} onClick={() => navigate("programmes")}>UCC programmes</button>
        {profile?.role === "student" && <>
          <button className={section === "discover" ? "nav-link active" : "nav-link"} aria-current={section === "discover" ? "page" : undefined} onClick={() => navigate("discover")}>Find tutors</button>
          <button className={section === "student" ? "nav-link active" : "nav-link"} aria-current={section === "student" ? "page" : undefined} onClick={() => navigate("student")}>My activity</button>
        </>}
        {profile?.role === "tutor" && <button className="nav-link active" aria-current={section === "tutor" ? "page" : undefined} onClick={() => navigate("tutor")}>Tutor dashboard</button>}
        {profile?.role === "admin" && <button className="nav-link active" aria-current={section === "admin" ? "page" : undefined} onClick={() => navigate("admin")}>Moderation</button>}
        {profile && <button className={section === "profile" ? "nav-link active" : "nav-link"} aria-current={section === "profile" ? "page" : undefined} onClick={() => navigate("profile")}>My profile</button>}
        {user ? <button className="button button-outline" onClick={() => void signOut()}>Log out</button> : <button className="button button-outline" onClick={() => { setAuthMode("login"); navigate("discover"); }}>Log in</button>}
      </nav>
    </header>

    {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}

    {section === "resources" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">OPEN LEARNING LIBRARY</p><h1>Courses & learning resources</h1><p className="muted">Explore verified course units and freely accessible study materials before contacting a tutor.</p></section>
      <div className="programme-controls resource-library-controls">
        <label>Institution<select value={institutionId} onChange={(event) => { setInstitutionId(Number(event.target.value)); setUnitId(""); }}>
          <option value="">Choose institution</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Search courses<input value={courseResourceQuery} onChange={(event) => setCourseResourceQuery(event.target.value)} placeholder="Course code, title or department" /></label>
        <button className="button button-outline" onClick={() => setCourseResourceReload((value) => value + 1)} disabled={courseResourcesLoading}>Refresh resources</button>
      </div>
      <p className="source-note">Course entries link to official university sources. Learning materials are independent resources, not lessons by or endorsements from named university lecturers. Past papers are included only when an official, public source is verified; practice sets are labeled separately.</p>
      {!supabase ? <div className="empty-state"><h2>Connect Supabase to load course resources</h2><p>Configure the project URL and publishable key, then run the database migrations.</p></div>
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
            : <section className="course-resource-groups" aria-label="Independent subject learning resources">
              {subjectResourceFallback.map((item) => <article className="course-resource-card fallback-resource-card" key={item.title}>
                <div className="row-between"><div><p className="eyebrow">{item.subject}</p><h2>{item.title}</h2><p className="muted">{item.resource}</p></div><span className="resource-type">Independent resource</span></div>
                <div className="course-resource-list"><article className="course-resource-item">
                  <span className="resource-type">Video lesson</span>
                  <a className="course-resource-title" href={item.url} target="_blank" rel="noreferrer"><b>Open {item.title}</b></a>
                  <small>Source: {item.source}</small>
                  <small>Independent learning material — not a named UCC lecturer or TutorConnect endorsement.</small>
                </article></div>
              </article>)}
            </section>}
    </main> : section === "programmes" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">OFFICIAL ADMISSIONS LISTING</p><h1>Explore UCC programmes</h1><p className="muted">Browse degree and postgraduate programmes by the academic unit shown in UCC’s admissions catalogue.</p></section>
      <div className="programme-controls">
        <label>Search programmes<input value={programmeQuery} onChange={(event) => setProgrammeQuery(event.target.value)} placeholder="Programme, award, department or college" /></label>
        <label>Study level<select value={programmeLevel} onChange={(event) => setProgrammeLevel(event.target.value)}><option value="">All levels</option>{programmeLevels.map((level) => <option key={level}>{level}</option>)}</select></label>
        <a className="button button-outline" href="https://admissions.ucc.edu.gh/catalogue" target="_blank" rel="noreferrer">Official UCC catalogue</a>
      </div>
      <p className="source-note">These are admissions programmes, not semester course units or course codes. Programme names link to UCC Admissions. College and school labels are shown only where the official listing provides them.</p>
      <p className="muted programme-count">{programmesLoading ? "Loading UCC programmes…" : programmesError ? "The catalogue could not be loaded." : `Showing ${filteredProgrammes.length} of ${academicProgrammes.length} programmes`}</p>
      {!supabase ? <div className="empty-state"><h2>Connect Supabase to load this catalogue</h2><p>Or browse the official <a href="https://admissions.ucc.edu.gh/catalogue" target="_blank" rel="noreferrer">UCC Admissions catalogue</a>.</p></div>
        : programmesLoading ? <div className="empty-state"><h2>Loading programmes</h2><p>Fetching the verified UCC Admissions listing.</p></div>
          : programmesError ? <div className="empty-state" role="alert"><h2>Could not load UCC programmes</h2><p>{programmesError}</p><button className="button button-outline" onClick={() => setProgrammeReload((value) => value + 1)}>Try again</button><p>Or browse the <a href="https://admissions.ucc.edu.gh/catalogue" target="_blank" rel="noreferrer">official UCC catalogue</a>.</p></div>
            : groupedProgrammes.length ? <section className="programme-groups" aria-label="UCC programmes grouped by academic unit">
            {groupedProgrammes.map(([group, items], index) => <details className="course-group programme-group" key={group} open={index === 0}>
              <summary>{group}<span>{items.length}</span></summary>
              {items.map((programme) => <article className="programme-item" key={programme.id}>
                <div><h2>{programme.programme_title}</h2><p>{programme.award} · {programme.level}</p></div>
                <a href={programme.source_url} target="_blank" rel="noreferrer">Official details</a>
              </article>)}
            </details>)}
          </section>
          : <div className="empty-state"><h2>{academicProgrammes.length ? "No programmes match" : "No programme records available"}</h2><p>{academicProgrammes.length ? "Try another search or study level." : "Check the Supabase catalogue migration or use the official UCC link above."}</p></div>}
    </main> : !user ? <main id="main-content" tabIndex={-1} className="auth-layout">
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
        {authMode !== "forgot" && <div className="auth-switch" role="group" aria-label="Account access">
          <button type="button" aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setShowPassword(false); }}>Log in</button>
          <button type="button" aria-pressed={authMode === "signup"} onClick={() => { setAuthMode("signup"); setShowPassword(false); }}>Sign up</button>
        </div>}
        <form className="stack-form" onSubmit={(event) => void authenticate(event)}>
          {authMode === "signup" && <>
            <label>Full name<input name="n" autoComplete="name" required /></label>
            <label>Account type<select name="r"><option value="student">Student</option><option value="tutor">Tutor (review required)</option></select></label>
          </>}
          <label>Email<input name="e" type="email" autoComplete="email" required /></label>
          {authMode !== "forgot" && <label>Password
            <div className="password-field">
              <input name="p" type={showPassword ? "text" : "password"} autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={8} required />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</button>
            </div>
          </label>}
          {authMode === "login" && <button className="forgot-password-link" type="button" onClick={() => setAuthMode("forgot")}>Forgot password?</button>}
          {!supabase && <p className="setup-note">Connect a Supabase project to enable sign-in, course search and role dashboards.</p>}
          {authMode === "login" && <p className="setup-note">Administrator access is assigned to approved accounts by the system administrator. There is no public admin sign-up option.</p>}
          <button className="button button-primary auth-submit" name={authMode === "signup" ? "up" : "in"} disabled={busy}>
            {busy ? "Please wait…" : authMode === "signup" ? "Create account" : authMode === "forgot" ? "Send reset link" : "Log in"}
          </button>
        </form>
        {authMode === "forgot" && <button className="back-to-login" type="button" onClick={() => setAuthMode("login")}>← Back to log in</button>}
        {authMode === "signup" && <p className="small-note">Tutor accounts are created as pending applications. An administrator must approve your profile before students can find you.</p>}
      </section>
    </main> : profile && section === "profile" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">YOUR ACCOUNT</p><h1>My profile</h1><p className="muted">Add a short bio and photo. Your profile details are available to you; tutor photos are shown on approved tutor listings.</p></section>
      <section className="panel profile-editor">
        <div className="profile-photo-column">
          <div className="profile-photo-preview">{avatarPreview || profile.avatar_url ? <img src={avatarPreview || profile.avatar_url || ""} alt={`${profile.full_name}'s profile`} /> : <span>{profile.full_name.slice(0, 1).toUpperCase()}</span>}</div>
          <small className="muted">{avatarPreview ? "Unsaved preview" : profile.avatar_url ? "Current photo" : "Photo not set"}</small>
        </div>
        <form className="stack-form" onSubmit={(event) => void savePersonalProfile(event)}>
          <label>Full name<input name="full_name" defaultValue={profile.full_name} autoComplete="name" required maxLength={120} /></label>
          <label>Short bio<textarea name="personal_bio" defaultValue={profile.bio || ""} rows={4} maxLength={500} placeholder="A few sentences about you" /></label>
          <label>Profile photo<input ref={avatarInputRef} name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={previewProfilePhoto} /></label>
          <small className="muted">Choose a JPG, PNG or WebP image up to 5 MB. Preview it here, then save to upload or replace your photo.</small>
          <div className="profile-actions">
            <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
            {(profile.avatar_url || profile.avatar_path) && <button className="button button-outline" type="button" disabled={busy} onClick={() => void removeProfilePhoto()}>Remove photo</button>}
          </div>
        </form>
      </section>
    </main> : profile?.role === "student" && section === "discover" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">DISCOVER</p><h1>Find a tutor for your course</h1><p className="muted">Search only approved tutors who teach the selected course and academic unit.</p></section>
      {recentlyUnlockedContact && <section className="panel contact-box" aria-live="polite">
        <h2>Payment confirmed — tutor contact unlocked</h2>
        <p>{recentlyUnlockedContact.phone || "Phone not listed"} · {recentlyUnlockedContact.email || "Email not listed"}</p>
        <p className="muted">This contact remains available on the tutor’s card after you search again.</p>
      </section>}
      <form className="search-panel" onSubmit={(event) => void searchSubmit(event)}>
        <label>Institution<select value={institutionId} onChange={(event) => { setInstitutionId(Number(event.target.value)); setUnitId(""); }} required>
          <option value="">Choose institution</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>College, school or department<select value={unitId} onChange={(event) => setUnitId(event.target.value ? Number(event.target.value) : "")}>
          <option value="">All academic units</option>{unitOptions.map((item) => <option key={item.id} value={item.id}>{unitPath(item.id, units)}</option>)}
        </select></label>
        <label>Course code or title<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search an official course code or title" required /></label>
        <button className="button button-primary" disabled={busy}>{busy ? "Searching…" : "Search tutors"}</button>
        {(query || unitId !== "") && <button className="button button-outline" type="button" onClick={() => { setQuery(""); setUnitId(""); setResults([]); setResourcesByTutor({}); setHasSearched(false); }}>Clear</button>}
      </form>
      {institutionId !== "" && institutions.find((item) => item.id === institutionId)?.name === "University of Cape Coast" && <p className="source-note">
        UCC academic units follow the <a href="https://academics.ucc.edu.gh/colleges" target="_blank" rel="noreferrer">official UCC structure</a>. The <a href="https://admissions.ucc.edu.gh/catalogue/departments" target="_blank" rel="noreferrer">admissions catalogue</a> lists degree programmes, not semester course codes. Administrators add course codes from verified teaching schedules.
      </p>}
      {hasSearched && <p className="search-result-count" role="status">{busy ? "Searching for tutors…" : `${results.length} approved tutor${results.length === 1 ? "" : "s"} found`}</p>}
      <section className="results-grid" aria-live="polite">
        {results.length === 0 ? <div className="empty-state"><span className="empty-icon">⌕</span><h2>{hasSearched ? "No tutors found" : "Start with a course"}</h2><p>{hasSearched ? "No approved tutors were found for that course. Try a different course code, title or academic unit." : "Enter a course code or title to see approved, relevant tutors."}</p></div> : results.map((tutor) => <article className="tutor-card" key={`${tutor.id}-${tutor.course_code}`}>
          <div className="tutor-card-top"><div className="avatar">{tutor.avatar_url ? <img src={tutor.avatar_url} alt="" /> : (tutor.name || "T").slice(0, 1)}</div><div><h2>{tutor.name}{tutor.featured && <span className="verified-mark" role="img" aria-label="TutorConnect verified tutor" title="Approved tutor with an active, Paystack-verified plan"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3.3 8.2 3 3 6.4-6.5" /></svg></span>}</h2><p className="muted">{tutor.course_code}</p></div></div>
          <p>{tutor.bio || "Tutor profile"}</p>
          <div className="unit-label">{[tutor.college, tutor.school, tutor.department].filter(Boolean).join(" / ") || "Academic unit not assigned"}</div>
          <p className="tutor-meta">{tutor.avg_rating ? `★ ${tutor.avg_rating.toFixed(1)} (${tutor.review_count} reviews)` : "No reviews yet"} · {tutor.rate == null ? "Rate not listed" : `GHS ${tutor.rate}/hr`} · {tutor.delivery || "Delivery to be confirmed"}</p>
          {!!resourcesByTutor[tutor.id]?.length && <div className="resource-list"><h3>Teaching previews & learning resources</h3>{resourcesByTutor[tutor.id].map((resource) => <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer"><span>{resourceLabel(resource.resource_type)}</span><b>{resource.title}</b>{resource.description && <small>{resource.description}</small>}</a>)}<small>Links are shared by the tutor; third-party materials are identified by their source.</small></div>}
          {contacts[tutor.id] ? <div className="contact-box"><b>Contact unlocked</b><div>{contacts[tutor.id].phone || "Phone not listed"}</div><div>{contacts[tutor.id].email || "Email not listed"}</div></div>
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
        </article>)}
      </section>
    </main> : profile?.role === "student" && section === "student" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">STUDENT WORKSPACE</p><h1>Your activity</h1><p className="muted">Your reviews and private reports in one place.</p></section>
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
          <div className="form-row"><label>Phone<input name="phone" type="tel" defaultValue={tutorContact?.phone || ""} /></label><label>Contact email<input name="contact_email" type="email" defaultValue={tutorContact?.email || user.email || ""} /></label></div>
          <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
        </form></section>
        <section className="panel"><h2>My courses</h2><p className="muted">Course requests are shown under their official academic unit and need admin approval before search.</p>
          {tutorCourses.length ? tutorCourses.map((item) => <article className="list-item" key={item.id}><div className="row-between"><b>{item.courses?.code} · {item.courses?.title}</b><span className={`status ${item.status}`}>{item.status}</span></div><small>{unitPath(item.courses?.academic_unit_id ?? null, units)}</small></article>) : <p className="muted">No course requests yet.</p>}
          <form className="mini-form course-search" onSubmit={(event) => void searchCourseOptions(event)}><h3>Find a course to teach</h3>
            <label>Course code or title<input name="course_query" placeholder="Search the verified course catalogue" required /></label><button className="button button-outline">Search catalogue</button>
          </form>
          {courseOptions.map((course) => <form className="course-option" key={course.id} onSubmit={(event) => void requestCourse(event)}><input type="hidden" name="course_id" value={course.id} /><div><b>{course.code} · {course.title}</b><small>{unitPath(course.academic_unit_id, units)}</small></div><button className="button button-outline">Request approval</button></form>)}
        </section>
      </div>
      <section className="panel"><h2>Teaching previews and resources</h2><p className="muted">Share your own public lesson videos, course materials, or links to past questions you are authorized to distribute. Use the source name in your description for third-party content.</p>
        <form className="resource-form" onSubmit={(event) => void saveTutorResource(event)}>
          <label>Resource type<select name="resource_type"><option value="teaching_video">Teaching video / YouTube</option><option value="course_resource">Course resource</option><option value="past_questions">Past questions</option></select></label>
          <label>Course<select name="course_id" required>
            <option value="">Choose one of your courses</option>
            {tutorCourses.filter((item) => item.status === "approved").map((item) => <option key={item.id} value={item.courses?.id ?? ""}>{item.courses ? `${item.courses.code} · ${item.courses.title}` : "Course unavailable"}</option>)}
          </select></label>
          <label>Title<input name="title" required maxLength={160} /></label>
          <label>HTTPS link<input name="url" type="url" required maxLength={2048} placeholder="https://…" /></label>
          <label>Source or description<textarea name="description" rows={2} maxLength={300} placeholder="Who created it? Is it an open or authorized resource?" /></label>
          <button className="button button-outline">Add resource</button>
        </form>
        {tutorResources.length ? tutorResources.map((resource) => {
          const course = tutorCourses.find((item) => item.courses?.id === resource.course_id)?.courses;
          return <article className="resource-row" key={resource.id}><div><span className="resource-type">{resourceLabel(resource.resource_type)}</span>{course && <small className="resource-course">{course.code} · {course.title}</small>}<a href={resource.url} target="_blank" rel="noreferrer"><b>{resource.title}</b></a>{resource.description && <p className="muted">{resource.description}</p>}</div><button className="button button-outline" onClick={() => void removeTutorResource(resource.id)}>Remove</button></article>;
        }) : <p className="muted">No resources added yet. Add a YouTube lesson or authorized resource for an approved course.</p>}
      </section>
      <section className="panel"><h2>Student feedback</h2>{tutorReviews.length ? tutorReviews.map((item) => <article className="list-item" key={item.id}><div className="row-between"><b>{item.rating} / 5 stars</b><span className={`status ${item.status}`}>{item.status}</span></div><p>{item.comment || "No written comment."}</p><small>{dateLabel(item.created_at)}</small></article>) : <p className="muted">No reviews yet.</p>}</section>
    </main> : profile?.role === "admin" && section === "admin" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">ADMINISTRATION</p><h1>Trust & quality workspace</h1><p className="muted">Review tutor applications, course associations, reports and feedback. Decisions require a reason and are audited.</p></section>
      <div className="stats-grid"><div className="stat-card"><span>Pending tutors</span><b>{pendingTutors}</b></div><div className="stat-card"><span>Course requests</span><b>{adminTutorCourses.length}</b></div><div className="stat-card"><span>Open reports</span><b>{unresolvedReports}</b></div><div className="stat-card"><span>Total reviews</span><b>{adminReviews.length}</b></div><div className="stat-card"><span>Catalog courses</span><b>{adminCourses.length}</b></div></div>
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
      </article>) : <p className="muted">No course requests need review.</p>}</section>}
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
    <button
      className="assistant-fab"
      type="button"
      aria-label={assistantOpen ? "Close student assistant" : "Open student assistant"}
      aria-expanded={assistantOpen}
      aria-controls="student-assistant-panel"
      onClick={() => setAssistantOpen((open) => !open)}
    >
      <span aria-hidden="true">{assistantOpen ? "×" : "✦"}</span>
      <span>{assistantOpen ? "Close" : "Ask AI"}</span>
    </button>
    {assistantOpen && <section id="student-assistant-panel" className="assistant-panel" role="region" aria-label="TutorConnect student assistant">
      <header className="assistant-header">
        <div><p className="eyebrow">TUTORCONNECT SUPPORT</p><h2>Student assistant</h2></div>
        <div className="assistant-header-actions">
          {assistantMessages.length > 0 && <button className="assistant-clear" type="button" onClick={clearAssistantConversation}>Clear</button>}
          <button className="assistant-close" type="button" aria-label="Close student assistant" onClick={() => setAssistantOpen(false)}>×</button>
        </div>
      </header>
      <p className="assistant-disclaimer">Ask about any subject, explain a concept, prepare for a quiz, solve a problem step-by-step or get help using TutorConnect. The AI may make mistakes and cannot see private account data or browse live university information.</p>
      <div className="assistant-messages" role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions">
        {assistantMessages.length === 0 && <div className="assistant-welcome">
          <p>Hi! What would you like help with today?</p>
          {user ? <div className="assistant-prompts" aria-label="Suggested questions">
            <button type="button" disabled={assistantLoading} onClick={() => void askAssistantPrompt("Explain a difficult topic in simple steps.")}>Explain a topic</button>
            <button type="button" disabled={assistantLoading} onClick={() => void askAssistantPrompt("Create a 7-day study plan for my exam.")}>Make a study plan</button>
            <button type="button" disabled={assistantLoading} onClick={() => void askAssistantPrompt("Help me solve a problem step by step. Ask me for the question first.")}>Solve with steps</button>
          </div> : <p className="muted">Sign in to start a study conversation.</p>}
        </div>}
        {assistantMessages.map((message, index) => <p className={`assistant-message ${message.role === "user" ? "assistant-message-user" : "assistant-message-ai"}`} key={`${index}-${message.role}`}>{message.text}</p>)}
        {assistantLoading && <p className="assistant-message assistant-message-ai" role="status">Thinking…</p>}
        <div ref={assistantEndRef} />
      </div>
      {assistantError && <p className="assistant-error" role="alert">{assistantError}</p>}
      {assistantError && user && assistantMessages[assistantMessages.length - 1]?.role === "user" && <button className="assistant-retry" type="button" onClick={() => void retryAssistantMessage()} disabled={assistantLoading}>Try again</button>}
      {user ? <form className="assistant-form" onSubmit={(event) => void sendAssistantMessage(event)}>
        <label className="visually-hidden" htmlFor="assistant-message">Your question</label>
        <textarea
          id="assistant-message"
          ref={assistantInputRef}
          value={assistantDraft}
          onChange={(event) => setAssistantDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask a question…"
          rows={2}
          maxLength={2000}
          disabled={assistantLoading || assistantMessages[assistantMessages.length - 1]?.role === "user"}
        />
        <button className="button button-primary" type="submit" disabled={assistantLoading || assistantMessages[assistantMessages.length - 1]?.role === "user" || !assistantDraft.trim()}>{assistantLoading ? "Sending…" : "Send"}</button>
      </form> : <div className="assistant-login-prompt">
        <p>Log in to chat with the AI assistant.</p>
        <button className="button button-outline" type="button" onClick={() => { setAssistantOpen(false); setAuthMode("login"); navigate("discover"); }}>Log in</button>
      </div>}
      <div className="assistant-contact">
        <strong>Need a person?</strong>
        <a href="mailto:baidoomensahama@gmail.com" aria-label="Email the administrators">Email us</a>
        <a href="tel:0245664985" aria-label="Call 0245664985">Call 0245664985</a>
        <a href="https://wa.me/2332456698495" target="_blank" rel="noreferrer" aria-label="Message us on WhatsApp">WhatsApp</a>
      </div>
    </section>}
  </div>;
}
