import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { isStudentVerificationActive, isTutorVerificationActive } from "./accountVerification";
import "./App.css";

type Role = "student" | "tutor" | "admin";
type Section = "discover" | "student" | "tutor" | "admin" | "profile";
type Theme = "light" | "dark";
type ThemePreference = { theme: Theme; storageError: string | null };
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
type AdminProfile = { id: string; full_name: string | null; role: Role; account_status: string };
type PresenceStatus = "active" | "inactive" | "unknown";
type AdminAction = { id: number; admin_id: string; target_id: string; action: string; reason: string; created_at: string };
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

function readThemePreference(): ThemePreference {
  const systemTheme: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  try {
    const storedTheme = localStorage.getItem("tutorconnect-theme");
    return {
      theme: storedTheme === "light" || storedTheme === "dark" ? storedTheme : systemTheme,
      storageError: null,
    };
  } catch (error) {
    return {
      theme: systemTheme,
      storageError: error instanceof Error ? error.message : "Browser storage is unavailable.",
    };
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
function PresenceIndicator({ status, text }: { status: PresenceStatus; text?: string }) {
  const stateText = status === "active" ? "Active now" : status === "inactive" ? "Inactive" : "Status unavailable";
  return <span className={`presence-indicator presence-indicator-${status}`} aria-label={text ? `${text}: ${stateText}` : stateText}>
    <span className="presence-dot" aria-hidden="true" />{text ? `${text}: ${stateText}` : stateText}
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
const presenceInactiveThresholdMs = 5 * 60 * 1000;
const presenceStatusAt = (lastSeenAt: number | null | undefined, now: number): PresenceStatus => {
  if (lastSeenAt === null || lastSeenAt === undefined) return "inactive";
  return now - lastSeenAt < presenceInactiveThresholdMs ? "active" : "inactive";
};
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
export default function App() {
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
  const [courseCatalogueRequests, setCourseCatalogueRequests] = useState<CourseCatalogueRequest[]>([]);
  const [tutorResources, setTutorResources] = useState<TutorResource[]>([]);
  const [resourceCredits, setResourceCredits] = useState<string[]>([]);
  const [resourceCreditsError, setResourceCreditsError] = useState<string | null>(null);
  const [resourceDraftIds, setResourceDraftIds] = useState<string[]>(() => [crypto.randomUUID()]);
  const [resourceDraftDirty, setResourceDraftDirty] = useState(false);
  const [resourcesByTutor, setResourcesByTutor] = useState<Record<string, TutorResource[]>>({});
  const [myPresenceLastSeenAt, setMyPresenceLastSeenAt] = useState<number | null>(null);
  const [myPresenceError, setMyPresenceError] = useState<string | null>(null);
  const [presenceLastSeenByUserId, setPresenceLastSeenByUserId] = useState<Record<string, number>>({});
  const [tutorPresenceLoaded, setTutorPresenceLoaded] = useState(false);
  const [tutorPresenceError, setTutorPresenceError] = useState<string | null>(null);
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
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
  const [adminStudentCount, setAdminStudentCount] = useState<number | null>(null);
  const [adminTutorCount, setAdminTutorCount] = useState<number | null>(null);
  const [adminReports, setAdminReports] = useState<Report[]>([]);
  const [adminReviews, setAdminReviews] = useState<Review[]>([]);
  const [adminCourses, setAdminCourses] = useState<Course[]>([]);
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [section, setSection] = useState<Section>("discover");
  const [adminTab, setAdminTab] = useState("applications");
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot" | "update">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference);
  const theme = themePreference.theme;
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const unitOptions = useMemo(() => units.filter((unit) => unit.unit_type === "department" || unit.unit_type === "school" || unit.unit_type === "college"), [units]);
  const profileNames = useMemo(() => Object.fromEntries(adminProfiles.map((item) => [item.id, item.full_name || "TutorConnect member"])), [adminProfiles]);
  const tutorVerified = isTutorVerificationActive(
    tutorProfile?.status ?? "",
    tutorProfile?.premium_until ?? null,
  );
  const myPresenceStatus: PresenceStatus = myPresenceLastSeenAt === null
    ? "unknown"
    : presenceStatusAt(myPresenceLastSeenAt, presenceNow);

  useEffect(() => () => {
    if (avatarPreviewUrl.current) URL.revokeObjectURL(avatarPreviewUrl.current);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setPresenceNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (themePreference.storageError) {
      setNotice(`Theme preference could not be saved or loaded: ${themePreference.storageError}`);
    }
  }, [themePreference.storageError]);

  useEffect(() => {
    try {
      for (const key of [
        "tutorconnect-demo-tutor-premium-until",
        "tutorconnect-demo-resources",
        "tutorconnect-demo-course-requests",
        "tutorconnect-demo-receipts",
        "tutorconnect-demo-resource-credits",
      ]) localStorage.removeItem(key);
    } catch (error) {
      setNotice(`Old demo data could not be cleared from this browser: ${error instanceof Error ? error.message : "browser storage is unavailable."}`);
    }
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    let storageError: string | null = null;
    try {
      localStorage.setItem("tutorconnect-theme", nextTheme);
    } catch (error) {
      storageError = error instanceof Error ? error.message : "Browser storage is unavailable.";
    }
    setThemePreference({ theme: nextTheme, storageError });
  }

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
    setResourceDraftIds([crypto.randomUUID()]);
    setResourceDraftDirty(false);
    setTutorReviews([]);
    setTutorStats(null);
    setMyPresenceLastSeenAt(null);
    setMyPresenceError(null);
    setPresenceLastSeenByUserId({});
    setTutorPresenceLoaded(false);
    setTutorPresenceError(null);
    setAdminTutors([]);
    setAdminTutorCourses([]);
    setAdminCourseCatalogueRequests([]);
    setAdminProfiles([]);
    setAdminStudentCount(null);
    setAdminTutorCount(null);
    setAdminReports([]);
    setAdminReviews([]);
    setAdminCourses([]);
    setAdminActions([]);
  }

  async function lockInactiveAccount(status: string) {
    const statusLabel = status === "suspended" || status === "removed" ? status : "restricted";
    const message = `Your account has been ${statusLabel} by an administrator. Contact support if you believe this is a mistake.`;
    setProfile(null);
    setProfileLoadError(message);
    setProfileLoading(false);
    setNotice(message);
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setNotice(`${message} Sign-out could not be completed: ${error.message}`);
    } catch (error) {
      setNotice(`${message} Sign-out could not be completed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  useEffect(() => {
    if (!supabase || !user || !profile || profile.role === "admin") return;
    const client = supabase;
    let active = true;
    let requestInFlight = false;
    const checkAccountStatus = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      const { data, error } = await client.from("profiles")
        .select("account_status")
        .eq("id", user.id)
        .maybeSingle();
      requestInFlight = false;
      if (active && !error && data && data.account_status !== "active") {
        await lockInactiveAccount(data.account_status);
      }
    };
    const interval = window.setInterval(() => void checkAccountStatus(), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.id, profile?.id, profile?.role]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setMyPresenceLastSeenAt(null);
      setMyPresenceError(null);
      return;
    }

    setMyPresenceLastSeenAt(null);
    setMyPresenceError(null);
    let active = true;
    let requestInFlight = false;
    let lastHeartbeatAt = 0;
    const updatePresence = async (force = false) => {
      const currentTime = Date.now();
      if (document.visibilityState === "hidden" || requestInFlight || (!force && currentTime - lastHeartbeatAt < 60_000)) return;
      lastHeartbeatAt = currentTime;
      requestInFlight = true;
      const client = supabase;
      if (!client) {
        if (active) setMyPresenceError("Presence service is not configured.");
        requestInFlight = false;
        return;
      }

      try {
        const { data, error } = await client.rpc("heartbeat_user_presence");
        if (error) throw new Error(error.message);
        const lastSeenAt = typeof data === "string" ? Date.parse(data) : Number.NaN;
        if (!Number.isFinite(lastSeenAt)) throw new Error("Presence service returned an invalid last-seen time.");
        if (active) {
          setMyPresenceLastSeenAt(lastSeenAt);
          setMyPresenceError(null);
          setPresenceNow(Date.now());
        }
      } catch (error) {
        if (active) {
          setMyPresenceLastSeenAt(null);
          setMyPresenceError(error instanceof Error ? error.message : "Could not update your active status.");
        }
      } finally {
        requestInFlight = false;
      }
    };
    const onActivity = () => { void updatePresence(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void updatePresence(true);
    };

    void updatePresence(true);
    document.addEventListener("pointerdown", onActivity, { passive: true });
    document.addEventListener("pointermove", onActivity, { passive: true });
    document.addEventListener("keydown", onActivity);
    document.addEventListener("touchstart", onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener("pointerdown", onActivity);
      document.removeEventListener("pointermove", onActivity);
      document.removeEventListener("keydown", onActivity);
      document.removeEventListener("touchstart", onActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
    };
  }, [user?.id]);

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
      if (data.account_status !== "active") {
        await lockInactiveAccount(data.account_status);
        return;
      }

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

  async function unlockContact(tutorId: string) {
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
    if (!supabase) return;
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
    if (!profile || profile.role !== "tutor") return;
    if (tutorProfile?.status !== "approved") {
      setNotice("Only approved tutors can publish resources.");
      return;
    }
    if (!supabase) {
      setNotice("Resource publishing is unavailable. Please try again later.");
      return;
    }
    if (resourceDraftIds.length < 1 || resourceDraftIds.length > 5) {
      setNotice("A publish batch must contain between one and five resources.");
      return;
    }
    if (resourceCredits.length < resourceDraftIds.length) {
      setNotice(`This batch needs ${resourceDraftIds.length} publishing credits. Buy one GHS 50 credit for each resource before publishing.`);
      return;
    }

    const form = event.currentTarget;
    const values = new FormData(form);
    const approvedCourseIds = new Set(
      tutorCourses.flatMap((item) => item.status === "approved" && item.courses ? [item.courses.id] : []),
    );
    const drafts: Array<{
      course_id: number;
      resource_type: TutorResource["resource_type"];
      title: string;
      file: File | null;
      url: string | null;
      storage_path: string | null;
      resource_payment_id: string;
      description: string | null;
    }> = [];
    for (const [index, draftId] of resourceDraftIds.entries()) {
      const resourceType = String(values.get(`resource_type_${draftId}`) || "");
      if (!["teaching_video", "course_resource", "past_questions"].includes(resourceType)) {
        setNotice(`Choose a valid resource type for item ${index + 1}.`);
        return;
      }
      const courseId = Number(values.get(`course_id_${draftId}`));
      if (!Number.isInteger(courseId) || !approvedCourseIds.has(courseId)) {
        setNotice(`Choose one of your approved courses for item ${index + 1}.`);
        return;
      }
      const title = String(values.get(`title_${draftId}`) || "").trim();
      if (!title) {
        setNotice(`Enter a title for item ${index + 1}.`);
        return;
      }
      const selectedFile = values.get(`resource_file_${draftId}`);
      const file = selectedFile instanceof File && selectedFile.size > 0 ? selectedFile : null;
      const url = String(values.get(`url_${draftId}`) || "").trim();
      if (file && url) {
        setNotice(`Choose either a file or an external link for item ${index + 1}, not both.`);
        return;
      }
      if (!file && !url) {
        setNotice(`Choose a file or provide an external HTTPS link for item ${index + 1}.`);
        return;
      }
      let storagePath: string | null = null;
      if (file) {
        if (file.size > resourceFileSizeLimit) {
          setNotice(`The file for item ${index + 1} must be no larger than 50 MB.`);
          return;
        }
        const extension = resourceFileExtensions[file.type];
        if (!extension) {
          setNotice(`Choose an MP4/WebM video, PDF, Word/PowerPoint document, text file or JPG/PNG/WebP image for item ${index + 1}.`);
          return;
        }
        if (resourceType === "teaching_video" && !file.type.startsWith("video/")) {
          setNotice(`The file for teaching video item ${index + 1} must be an MP4 or WebM video.`);
          return;
        }
        storagePath = `${profile.id}/${resourceCredits[index]}/resource.${extension}`;
      } else {
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
        } catch {
          setNotice(`Enter a valid HTTPS link for item ${index + 1}.`);
          return;
        }
        if (parsedUrl.protocol !== "https:") {
          setNotice(`Resource links must use HTTPS (item ${index + 1}).`);
          return;
        }
        if (resourceType === "teaching_video") {
          const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
          if (!["youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com"].includes(host)) {
            setNotice(`Teaching video item ${index + 1} must use a YouTube link.`);
            return;
          }
        }
      }
      drafts.push({
        course_id: courseId,
        resource_type: resourceType as TutorResource["resource_type"],
        title,
        file,
        url: file ? null : url,
        storage_path: storagePath,
        resource_payment_id: resourceCredits[index],
        description: String(values.get(`description_${draftId}`) || "").trim() || null,
      });
    }

    const client = supabase;
    if (!client) return;
    const uploadedPaths: string[] = [];
    let rowsInserted = false;
    const cleanupUploadedFiles = async () => {
      if (!uploadedPaths.length) return null;
      try {
        const { error } = await client.storage.from("tutor-resources").remove(uploadedPaths);
        return error?.message ?? null;
      } catch (error) {
        return error instanceof Error ? error.message : "Unknown storage cleanup error.";
      }
    };

    setBusy(true);
    try {
      for (const draft of drafts) {
        if (!draft.file || !draft.storage_path) continue;
        const { error: uploadError } = await client.storage.from("tutor-resources").upload(draft.storage_path, draft.file, {
          contentType: draft.file.type,
          upsert: false,
        });
        if (uploadError) {
          const cleanupError = await cleanupUploadedFiles();
          setNotice(cleanupError
            ? `${uploadError.message} Earlier batch uploads could not be cleaned up: ${cleanupError}`
            : uploadError.message);
          return;
        }
        uploadedPaths.push(draft.storage_path);
      }

      const { data, error } = await client.from("tutor_resources").insert(drafts.map((draft) => ({
        tutor_id: profile.id,
        course_id: draft.course_id,
        resource_type: draft.resource_type,
        title: draft.title,
        url: draft.url,
        storage_path: draft.storage_path,
        resource_payment_id: draft.resource_payment_id,
        description: draft.description,
      }))).select("id,tutor_id,course_id,resource_type,title,url,storage_path,resource_payment_id,description,created_at");

      if (error) {
        const cleanupError = await cleanupUploadedFiles();
        setNotice(cleanupError
          ? `${error.message} Uploaded batch files could not be cleaned up: ${cleanupError}`
          : error.message);
        return;
      }

      rowsInserted = true;
      let resourcesWithSignedUrl: TutorResource[] = data ?? [];
      let publicationNotice = `Published ${resourcesWithSignedUrl.length} resources. ${resourcesWithSignedUrl.length} paid credits used.`;
      try {
        resourcesWithSignedUrl = await signTutorResourceFiles(resourcesWithSignedUrl);
      } catch (error) {
        publicationNotice = error instanceof Error
          ? `Batch published, but one or more file links could not be loaded: ${error.message}`
          : "Batch published, but one or more file links could not be loaded.";
      }
      setTutorResources((current) => [...resourcesWithSignedUrl, ...current]);
      const usedPaymentIds = new Set(drafts.map((draft) => draft.resource_payment_id));
      setResourceCredits((current) => current.filter((credit) => !usedPaymentIds.has(credit)));
      form.reset();
      setResourceDraftIds([crypto.randomUUID()]);
      setResourceDraftDirty(false);
      setNotice(publicationNotice);
    } catch (error) {
      const cleanupError = rowsInserted ? null : await cleanupUploadedFiles();
      setNotice([
        error instanceof Error ? error.message : "Could not publish the resource batch.",
        cleanupError ? `Uploaded files could not be cleaned up: ${cleanupError}` : "",
      ].filter(Boolean).join(" "));
    } finally {
      setBusy(false);
    }
  }

  async function removeTutorResource(id: number) {
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
    const [tutorsResult, tutorCoursesResult, catalogueRequestsResult, profilesResult, reportsResult, reviewsResult, coursesResult, actionsResult, studentCountResult, tutorCountResult] = await Promise.all([
      supabase.from("tutor_profiles").select("id,bio,qualifications,status"),
      supabase.from("tutor_courses").select("id,tutor_id,status,courses(id,institution_id,code,title,academic_unit_id,source_url)").eq("status", "pending").order("id"),
      supabase.from("course_catalogue_requests").select("id,institution_id,requested_by,code,title,academic_unit_id,source_url,status,admin_note,course_id,created_at").eq("status", "pending").order("created_at"),
      supabase.from("profiles").select("id,full_name,role,account_status"),
      supabase.from("reports").select("id,tutor_id,reporter_id,category,description,status,resolution,created_at").order("created_at", { ascending: false }),
      supabase.from("reviews").select("id,tutor_id,student_id,rating,comment,status,created_at").order("created_at", { ascending: false }),
      supabase.from("courses").select("id,institution_id,code,title,academic_unit_id,source_url").order("title"),
      supabase.from("admin_actions").select("id,admin_id,target_id,action,reason,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "tutor"),
    ]);
    const failure = tutorsResult.error || tutorCoursesResult.error || catalogueRequestsResult.error || profilesResult.error || reportsResult.error || reviewsResult.error || coursesResult.error || actionsResult.error || studentCountResult.error || tutorCountResult.error;
    if (failure) setNotice(failure.message);
    setAdminTutors(tutorsResult.data ?? []);
    setAdminTutorCourses((tutorCoursesResult.data ?? []).map((row) => ({
      ...row,
      courses: Array.isArray(row.courses) ? row.courses[0] ?? null : row.courses,
    })));
    setAdminCourseCatalogueRequests(catalogueRequestsResult.data ?? []);
    setAdminProfiles((profilesResult.data ?? []).map((item) => ({ ...item, role: roleFrom(item.role) })));
    setAdminStudentCount(studentCountResult.error ? null : studentCountResult.count ?? 0);
    setAdminTutorCount(tutorCountResult.error ? null : tutorCountResult.count ?? 0);
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

  async function moderateAccount(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!supabase) return;
    const values = new FormData(event.currentTarget);
    const { error } = await supabase.rpc("admin_set_account_status", {
      p_user: id,
      p_status: String(values.get("status")),
      p_reason: String(values.get("reason")).trim(),
    });
    setNotice(error?.message ?? "Account access updated and recorded in the audit log.");
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

  const visibleTutorIds = useMemo(() => [...new Set(groupedTutors.map((tutor) => tutor.id))], [groupedTutors]);

  useEffect(() => {
    const client = supabase;
    if (!user || !client || section !== "discover" || !visibleTutorIds.length) {
      setPresenceLastSeenByUserId({});
      setTutorPresenceLoaded(false);
      setTutorPresenceError(null);
      return;
    }

    let active = true;
    setPresenceLastSeenByUserId({});
    setTutorPresenceLoaded(false);
    setTutorPresenceError(null);
    const refreshPresence = async () => {
      const { data, error } = await client.from("user_presence")
        .select("user_id,last_seen_at")
        .in("user_id", visibleTutorIds);
      if (!active) return;
      if (error) {
        setPresenceLastSeenByUserId({});
        setTutorPresenceLoaded(false);
        setTutorPresenceError(error.message);
        return;
      }
      setPresenceLastSeenByUserId(Object.fromEntries((data ?? []).map((item) => [item.user_id, Date.parse(item.last_seen_at)])));
      setTutorPresenceLoaded(true);
      setTutorPresenceError(null);
    };

    void refreshPresence();
    const interval = window.setInterval(() => void refreshPresence(), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.id, section, visibleTutorIds]);

  const unresolvedReports = adminReports.filter((item) => item.status !== "resolved").length;
  const pendingTutors = adminTutors.filter((item) => item.status === "pending").length;

  return <div className={`app-shell ${!user ? "app-shell-auth" : ""}`}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="app-header">
      <a className="brand" href="/" aria-label="TutorConnect home" onClick={(event) => { event.preventDefault(); navigate(profile?.role === "tutor" ? "tutor" : profile?.role === "admin" ? "admin" : "discover"); }}>
        <img className="brand-mark" src="/tutorconnect-mark.svg" alt="" /><span>TutorConnect</span>
      </a>
      <nav aria-label="Main navigation">
        {profile?.role === "student" && <>
          <button className={section === "discover" ? "nav-link active" : "nav-link"} aria-current={section === "discover" ? "page" : undefined} onClick={() => navigate("discover")}>Find tutors</button>
          <button className={section === "student" ? "nav-link active" : "nav-link"} aria-current={section === "student" ? "page" : undefined} onClick={() => navigate("student")}>My activity</button>
        </>}
        {profile?.role === "tutor" && <button className="nav-link active" aria-current={section === "tutor" ? "page" : undefined} onClick={() => navigate("tutor")}>Tutor dashboard</button>}
        {profile?.role === "admin" && <button className="nav-link active" aria-current={section === "admin" ? "page" : undefined} onClick={() => navigate("admin")}>Moderation</button>}
        {profile && <button className={section === "profile" ? "nav-link active" : "nav-link"} aria-current={section === "profile" ? "page" : undefined} onClick={() => navigate("profile")}>My profile{profile.is_verified && <VerifiedBadge label={profile.role === "tutor" ? "TutorConnect verified tutor" : "TutorConnect verified member"} />}</button>}
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} aria-pressed={theme === "dark"}>
          <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>{theme === "dark" ? "Light" : "Dark"}
        </button>
        {user ? <button className="button button-outline" onClick={() => void signOut()}>Log out</button> : <button className="button button-outline" onClick={() => { setAuthMode("login"); navigate("discover"); }}>Log in</button>}
      </nav>
    </header>

    {notice && <div className="notice" role="status">{notice}
      <button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button>
    </div>}

    {authMode === "update" && user ? <main id="main-content" tabIndex={-1} className="auth-layout">
      <section className="auth-story"><div className="auth-brand-lockup"><img className="brand-mark" src="/tutorconnect-mark.svg" alt="" /><span>Secure account recovery</span></div><p className="eyebrow">PASSWORD RESET</p><h1>Choose a new <em>password.</em></h1><p className="lead">Set a strong password to secure your TutorConnect account.</p></section>
      <section className="auth-card auth-card-login" aria-labelledby="auth-heading"><div className="auth-logo" aria-hidden="true"><img className="brand-mark" src="/tutorconnect-mark.svg" alt="" /></div><p className="eyebrow">ACCOUNT SECURITY</p><h2 id="auth-heading">Set a new password</h2>
        <form className="stack-form" onSubmit={(event) => void authenticate(event)}>
          <label>New password<div className="password-field"><input name="p" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</button></div></label>
          <small className="muted">Use at least 8 characters. Avoid reusing a password from another site.</small>
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        </form>
        <button className="back-to-login" type="button" onClick={() => setAuthMode("login")}>Cancel and return to your account</button>
      </section>
    </main> : !user ? <main id="main-content" tabIndex={-1} className="auth-layout">
      <section className="auth-story">
        <div className="auth-brand-lockup"><img className="brand-mark" src="/tutorconnect-mark.svg" alt="" /><span>Trusted course support</span></div>
        <p className="eyebrow">STUDY WITH CONFIDENCE</p>
        <h1>Learn from someone who understands <em>your course.</em></h1>
        <p className="lead">Discover approved tutors, preview learning resources and choose support that fits your subject.</p>
        <div className="auth-benefits">
          <article><span>01</span><div><b>Find relevant tutors</b><small>Search by institution, course and academic unit.</small></div></article>
          <article><span>02</span><div><b>Preview before booking</b><small>Explore teaching resources and student feedback.</small></div></article>
          <article><span>03</span><div><b>Stay in control</b><small>Private contact details unlock only after verified payment.</small></div></article>
        </div>
      </section>
      <section className={`auth-card ${authMode === "login" ? "auth-card-login" : ""}`} aria-labelledby="auth-heading">
        <div className="auth-logo" aria-hidden="true"><img className="brand-mark" src="/tutorconnect-mark.svg" alt="" /></div>
        <p className="eyebrow">{authMode === "login" ? "ACCOUNT ACCESS" : authMode === "signup" ? "CREATE ACCOUNT" : "PASSWORD RECOVERY"}</p>
        <h2 id="auth-heading">{authMode === "login" ? "Welcome back" : authMode === "signup" ? "Create your account" : "Reset your password"}</h2>
        <p className="auth-card-lead">{authMode === "login" ? "Sign in to continue." : authMode === "signup" ? "Join as a student or apply as a tutor." : "Enter your email and we’ll send you a secure reset link."}</p>
        {authMode !== "forgot" && authMode !== "update" && <div className="auth-switch" role="group" aria-label="Account access">
          <button type="button" aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setShowPassword(false); }}>Log in</button>
          <button type="button" aria-pressed={authMode === "signup"} onClick={() => { setAuthMode("signup"); setShowPassword(false); }}>Sign up</button>
        </div>}
        <form className="stack-form auth-form" onSubmit={(event) => void authenticate(event)}>
          {authMode === "signup" && <>
            <label>Full name<input name="n" autoComplete="name" required /></label>
            <label>Account type<select name="r"><option value="student">Student</option><option value="tutor">Tutor (review required)</option></select></label>
          </>}
          {authMode !== "update" && <label>Email<span className="auth-input-wrap">
            <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20v-1.5a7 7 0 0 1 14 0V20z" /></svg>
            <input name="e" type="email" autoComplete="email" required />
          </span></label>}
          {authMode !== "forgot" && <label>{authMode === "update" ? "New password" : "Password"}
            <div className="password-field auth-input-wrap">
              <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></svg>
              <input name="p" type={showPassword ? "text" : "password"} autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={8} required />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((shown) => !shown)}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.5" />{showPassword && <path d="m4 4 16 16" />}</svg>
              </button>
            </div>
          </label>}
          {authMode === "update" && <small className="muted">Use at least 8 characters. Avoid reusing a password from another site.</small>}
          {authMode === "login" && <button className="forgot-password-link" type="button" onClick={() => setAuthMode("forgot")}>Forgot password?</button>}
          <button className="button button-primary auth-submit" name={authMode === "signup" ? "up" : authMode === "update" ? "update" : "in"} disabled={busy}>
            {busy ? "Please wait…" : authMode === "signup" ? "Create account" : authMode === "forgot" ? "Send reset link" : authMode === "update" ? "Update password" : "Log in"}
          </button>
        </form>
        {authMode === "forgot" && <button className="back-to-login" type="button" onClick={() => setAuthMode("login")}>← Back to log in</button>}
        {authMode === "signup" && <p className="small-note">Tutor accounts are created as pending applications. An administrator must approve your profile before students can find you.</p>}
        {authMode === "login" && <p className="auth-card-footer">LEARN · CONNECT · GROW TOGETHER</p>}
      </section>
    </main> : user && !profile ? <main id="main-content" tabIndex={-1} className="page"><section className="empty-state" role={profileLoadError ? "alert" : "status"}>
      <h2>{profileLoading ? "Loading your account" : "Your account profile is unavailable"}</h2>
      <p>{profileLoading ? "Your sign-in is active. We’re loading your TutorConnect profile." : profileLoadError || "Your sign-in is active, but the profile has not loaded."}</p>
      {!profileLoading && <button className="button button-primary" type="button" onClick={() => user && void loadProfile(user.id)}>Retry profile loading</button>}
    </section></main> : profile && section === "profile" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">YOUR ACCOUNT</p><h1>My profile{profile.is_verified && <VerifiedBadge label={profile.role === "tutor" ? "TutorConnect verified tutor" : "TutorConnect verified member"} />}</h1><p className="muted">Add a short bio and photo. Student contact details are private; tutor contact links are shown only after a student unlocks them.</p>
        <PresenceIndicator status={myPresenceStatus} text="Your status" />
        {myPresenceError && <p className="presence-error" role="status">Live status unavailable: {myPresenceError}</p>}
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
    </main> : profile?.role === "student" && section === "discover" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">DISCOVER</p><h1>Find a tutor for your course</h1><p className="muted">Search only approved tutors who teach the selected course and academic unit.</p>
        {user && <>
          <PresenceIndicator status={myPresenceStatus} text="Your status" />
          {myPresenceError && <p className="presence-error" role="status">Live status unavailable: {myPresenceError}</p>}
        </>}
      </section>
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
        <label>Course code or title<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search an official course code or title" required /></label>
        <button className="button button-primary" disabled={busy}>{busy ? "Searching…" : "Search tutors"}</button>
        {(query || unitId !== "") && <button className="button button-outline" type="button" onClick={() => { setQuery(""); setUnitId(""); setResults([]); setResourcesByTutor({}); setHasSearched(false); }}>Clear</button>}
      </form>
      {user && tutorPresenceError && <p className="presence-error" role="status">Tutor activity status could not be loaded: {tutorPresenceError}</p>}
      {hasSearched && <p className="search-result-count" role="status">{busy ? "Searching for tutors…" : `${groupedTutors.length} approved tutor${groupedTutors.length === 1 ? "" : "s"} found`}</p>}
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
            {user && <PresenceIndicator status={tutorPresenceLoaded ? presenceStatusAt(presenceLastSeenByUserId[tutor.id] ?? null, presenceNow) : "unknown"} />}
            {matchingResources.length > 0 && <div className="resource-list"><h3>Teaching previews & learning resources</h3>{matchingResources.map((resource) => <a key={resource.id} href={resource.signed_url || resource.url || undefined} target="_blank" rel="noreferrer"><span>{resource.course_code ? `${resource.course_code} · ` : "General · "}{resourceLabel(resource.resource_type)}</span><b>{resource.title}</b>{resource.description && <small>{resource.description}</small>}</a>)}<small>Course links are shown only for the matching subjects. Third-party materials are identified by their source.</small></div>}
            {contacts[tutor.id] ? <div className="contact-box"><b>Contact unlocked</b><ContactLinks contact={contacts[tutor.id]} /></div>
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
      <section className="page-heading"><p className="eyebrow">STUDENT WORKSPACE</p><h1>Your activity{profile.is_verified && <VerifiedBadge label="TutorConnect verified member" />}</h1><p className="muted">Your reviews and private reports in one place.</p>
        <PresenceIndicator status={myPresenceStatus} text="Your status" />
        {myPresenceError && <p className="presence-error" role="status">Live status unavailable: {myPresenceError}</p>}
      </section>
      <div className="two-column">
        <section className="panel"><h2>My reviews</h2>{studentReviews.length ? studentReviews.map((item) => <article className="list-item" key={item.id}><b>{item.rating} / 5 stars</b><p>{item.comment || "No written comment."}</p><small>{dateLabel(item.created_at)}</small></article>) : <p className="muted">No reviews submitted yet. Unlock a tutor’s contact details to share feedback.</p>}</section>
        <section className="panel"><h2>My reports</h2>{studentReports.length ? studentReports.map((item) => <article className="list-item" key={item.id}><div className="row-between"><b>{item.category}</b><span className={`status ${item.status}`}>{item.status}</span></div><p>{item.description}</p>{item.resolution && <p className="resolution">Outcome: {item.resolution}</p>}<small>{dateLabel(item.created_at)}</small></article>) : <p className="muted">You have no reports.</p>}</section>
      </div>
    </main> : profile?.role === "tutor" && section === "tutor" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">TUTOR WORKSPACE</p><h1>Your teaching dashboard{tutorVerified && <span className="verified-mark verified-mark-large" role="img" aria-label="TutorConnect verified tutor" title="Approved tutor with an active, Paystack-verified plan"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3.3 8.2 3 3 6.4-6.5" /></svg></span>}</h1><p className="muted">Manage your profile, course requests, visibility and student feedback.</p>
        <PresenceIndicator status={myPresenceStatus} text="Your status" />
        {myPresenceError && <p className="presence-error" role="status">Live status unavailable: {myPresenceError}</p>}
      </section>
      <div className="stats-grid">
        <div className="stat-card"><span>Profile status</span><b className={`status ${tutorProfile?.status || "pending"}`}>{tutorProfile?.status || "Loading"}{tutorVerified && <VerifiedBadge label="TutorConnect verified tutor" />}</b></div>
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
          {courseSearchPerformed && courseOptions.length === 0 && <p className="setup-note" role="status">No matching courses are available in the verified catalogue yet. Suggest the course below; an administrator will verify its official source before adding it.</p>}
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
      <section className="panel"><h2>Teaching previews and resources</h2><p className="muted">Prepare and publish up to five resources in one batch, choosing an approved course for each item. Each file or external link uses one GHS 50 publishing credit. Upload an MP4/WebM video, PDF, Office document, text file or image (up to 50 MB), or share a YouTube/HTTPS link. Course links appear only beside matching subjects. Share only materials you own or are authorized to distribute.</p>
        {tutorProfile?.status !== "approved" ? <p className="setup-note">Your tutor profile must be approved before you can pay for or publish resources.</p>
          : resourceCreditsError ? <div className="empty-state" role="alert"><h3>Could not check your resource credits</h3><p>{resourceCreditsError}</p><button className="button button-outline" type="button" onClick={() => void loadTutorDashboard(profile.id)}>Try again</button></div>
            : <>
              <div className="resource-credit-box">
                <p>Unused credits: {resourceCredits.length}. Each resource costs GHS 50; buy enough credits before preparing a batch of up to five items.</p>
                <button className="button button-primary" type="button" disabled={busy || resourceDraftDirty} onClick={() => void startResourceCheckout()}>{busy ? "Opening secure checkout…" : "Buy one GHS 50 resource credit"}</button>
                {resourceDraftDirty && <small>Clear this draft before checkout so browser-held files are not lost.</small>}
              </div>
              {resourceCredits.length > 0 && <form className="resource-form" aria-label="Publish resource batch" onChange={() => setResourceDraftDirty(true)} onSubmit={(event) => void saveTutorResource(event)} onReset={() => { setResourceDraftIds([crypto.randomUUID()]); setResourceDraftDirty(false); }}>
                <p className="resource-credit-note">Prepare up to {Math.min(5, resourceCredits.length)} item{Math.min(5, resourceCredits.length) === 1 ? "" : "s"} in this batch. Each item uses one paid credit; files and external links can be mixed.</p>
                {resourceDraftIds.map((draftId, index) => <fieldset className="resource-draft" key={draftId}>
                  <legend>Resource {index + 1}</legend>
                  {resourceDraftIds.length > 1 && <button className="button button-outline resource-remove-button" type="button" aria-label={`Remove resource ${index + 1}`} onClick={() => setResourceDraftIds((current) => current.filter((id) => id !== draftId))}>Remove</button>}
                  <label>Resource type<select name={`resource_type_${draftId}`} defaultValue="course_resource"><option value="teaching_video">Teaching video</option><option value="course_resource">Course resource</option><option value="past_questions">Past questions</option></select></label>
                  <label>Approved course<select name={`course_id_${draftId}`} required defaultValue="">
                    <option value="">Choose one of your approved courses</option>
                    {tutorCourses.filter((item) => item.status === "approved").map((item) => <option key={item.id} value={item.courses?.id ?? ""}>{item.courses ? `${item.courses.code} · ${item.courses.title}` : "Course unavailable"}</option>)}
                  </select></label>
                  <label>Title<input name={`title_${draftId}`} required maxLength={160} /></label>
                  <label>Upload a file<input name={`resource_file_${draftId}`} type="file" accept="video/mp4,video/webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,image/jpeg,image/png,image/webp" /></label>
                  <label>Or external HTTPS link<input name={`url_${draftId}`} type="url" maxLength={2048} placeholder="https://…" /></label>
                  <label>Source or description<textarea name={`description_${draftId}`} rows={2} maxLength={300} placeholder="Who created it? Is it an open or authorized resource?" /></label>
                </fieldset>)}
                <div className="resource-batch-actions">
                  <button className="button button-outline" type="button" disabled={resourceDraftIds.length >= 5 || resourceDraftIds.length >= resourceCredits.length} onClick={() => setResourceDraftIds((current) => [...current, crypto.randomUUID()])}>Add another resource</button>
                  <button className="button button-outline" type="reset" disabled={busy || (!resourceDraftDirty && resourceDraftIds.length === 1)}>Clear batch</button>
                  <button className="button button-primary" disabled={busy}>{busy ? "Publishing batch…" : `Publish ${resourceDraftIds.length} resource${resourceDraftIds.length === 1 ? "" : "s"}`}</button>
                </div>
              </form>}
            </>}
        {tutorResources.length ? tutorResources.map((resource) => {
          const course = tutorCourses.find((item) => item.courses?.id === resource.course_id)?.courses;
          return <article className="resource-row" key={resource.id}><div><span className="resource-type">{resourceLabel(resource.resource_type)}</span>{course && <small className="resource-course">{course.code} · {course.title}</small>}<a href={resource.signed_url || resource.url || undefined} target="_blank" rel="noreferrer"><b>{resource.title}</b></a>{resource.description && <p className="muted">{resource.description}</p>}</div><button className="button button-outline" type="button" disabled={busy} onClick={() => void removeTutorResource(resource.id)}>Remove</button></article>;
        }) : <p className="muted">No resources added yet. Add a YouTube lesson or authorized resource for an approved course.</p>}
      </section>
      <section className="panel"><h2>Student feedback</h2>{tutorReviews.length ? tutorReviews.map((item) => <article className="list-item" key={item.id}><div className="row-between"><b>{item.rating} / 5 stars</b><span className={`status ${item.status}`}>{item.status}</span></div><p>{item.comment || "No written comment."}</p><small>{dateLabel(item.created_at)}</small></article>) : <p className="muted">No reviews yet.</p>}</section>
    </main> : profile?.role === "admin" && section === "admin" ? <main id="main-content" tabIndex={-1} className="page">
      <section className="page-heading"><p className="eyebrow">ADMINISTRATION</p><h1>Trust & quality workspace</h1><p className="muted">Review tutor applications, course associations, reports and feedback. Decisions require a reason and are audited.</p></section>
      <div className="stats-grid"><div className="stat-card"><span>Total students</span><b>{adminStudentCount ?? "—"}</b></div><div className="stat-card"><span>Total tutors</span><b>{adminTutorCount ?? "—"}</b></div><div className="stat-card"><span>Pending tutors</span><b>{pendingTutors}</b></div><div className="stat-card"><span>Course requests</span><b>{adminTutorCourses.length + adminCourseCatalogueRequests.length}</b></div><div className="stat-card"><span>Open reports</span><b>{unresolvedReports}</b></div><div className="stat-card"><span>Total reviews</span><b>{adminReviews.length}</b></div><div className="stat-card"><span>Catalog courses</span><b>{adminCourses.length}</b></div></div>
      <div className="admin-tabs" role="group" aria-label="Moderation sections">
        {["applications", "accounts", "course requests", "reports", "reviews", "courses", "audit"].map((tab) => <button key={tab} type="button" aria-pressed={adminTab === tab} onClick={() => setAdminTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
      </div>
      {adminTab === "applications" && <section className="panel"><h2>Tutor applications & status</h2>{adminTutors.length ? adminTutors.map((item) => <article className="moderation-card" key={item.id}>
        <div className="row-between"><div><h3>{profileNames[item.id] || "Tutor applicant"}</h3><span className={`status ${item.status}`}>{item.status}</span></div><small>{item.id}</small></div>
        <p>{item.bio || "Biography not provided."}</p><p className="muted">{item.qualifications || "Qualifications not provided."}</p>
        <form className="moderation-form" onSubmit={(event) => { if (!window.confirm("Save this tutor status change? It can affect the tutor's visibility.")) event.preventDefault(); else void moderateTutor(event, item.id); }}><label>Decision<select name="status" defaultValue={item.status}><option value="approved">Approve</option><option value="rejected">Reject</option><option value="suspended">Suspend</option><option value="removed">Remove</option></select></label><label>Reason<textarea name="reason" required minLength={4} maxLength={1000} /></label><button className="button button-primary">Save decision</button></form>
      </article>) : <p className="muted">No tutor profiles found.</p>}</section>}
      {adminTab === "accounts" && <section className="panel"><h2>Student and tutor account access</h2><p className="muted">Suspending or removing an account signs the user out and blocks access. Restore an account by setting its status to active. Account changes are reversible and audited; user data is not deleted.</p>{adminProfiles.length ? adminProfiles.map((item) => <article className="moderation-card" key={item.id}>
        <div className="row-between"><div><h3>{item.full_name || "TutorConnect member"} · {item.role}</h3><span className={`status ${item.account_status}`}>{item.account_status}</span></div><small>{item.id}</small></div>
        {item.role === "admin" ? <p className="muted">Administrator accounts are protected from account moderation.</p> : <form className="moderation-form" onSubmit={(event) => { if (!window.confirm("Change this account's access? Suspended or removed users will be signed out and unable to use TutorConnect.")) event.preventDefault(); else void moderateAccount(event, item.id); }}>
          <label>Account status<select name="status" defaultValue={item.account_status}><option value="active">Active / restore access</option><option value="suspended">Suspend</option><option value="removed">Remove (reversible)</option></select></label>
          <label>Reason<textarea name="reason" required minLength={4} maxLength={1000} /></label><button className="button button-primary">Save account status</button>
        </form>}
      </article>) : <p className="muted">No user accounts found.</p>}</section>}
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
        <section className="panel"><h2>Add verified course</h2><p className="source-note">Add course units using verified codes and titles from official teaching schedules. Degree programmes are not course units.</p>
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
    <footer className="app-footer"><span>TutorConnect · Learn, connect, grow together.</span><span>Contact administrators: <a href="mailto:baidoomensahama@gmail.com">baidoomensahama@gmail.com</a> · <a href="tel:0245664985">0245664985</a> · <a href="https://wa.me/2332456698495" target="_blank" rel="noreferrer">WhatsApp</a></span></footer>
  </div>;
}
