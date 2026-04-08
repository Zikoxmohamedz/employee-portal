import { supabase } from "./config.js";
import { mapCodeToEmail } from "./common.js";

const step1 = document.getElementById("step1");
const regForm = document.getElementById("registrationForm");
const lookupCodeInput = document.getElementById("lookupCode");
const infoBox = document.getElementById("infoBox");
const statusEl = document.getElementById("signupStatus");

// Form inputs
const fullNameInput = document.getElementById("fullName");
const phoneInput = document.getElementById("phone");
const nationalIdInput = document.getElementById("nationalId");
const passwordInput = document.getElementById("password");

let currentCode = "";
let isPreRegistered = false;

// التحقق من الكود
document.getElementById("checkCodeBtn").addEventListener("click", async () => {
  const code = lookupCodeInput.value.trim();
  if (!code) {
    statusEl.textContent = "ادخل كود الموظف أولاً";
    return;
  }

  statusEl.textContent = "جاري البحث في بيانات الشركة...";
  statusEl.style.color = "inherit";

  // 1. فحص هل الكود مسجل بالفعل في البروفايلات (حساب مفعل)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("employee_code", code)
    .maybeSingle();

  if (existingProfile) {
    statusEl.textContent = "هذا الكود مسجل بالفعل! برجاء الذهاب لصفحة الدخول.";
    statusEl.style.color = "orange";
    return;
  }

  // 2. محاولة البحث في جدول master_staff
  const { data: staffData } = await supabase
    .from("master_staff")
    .select("*")
    .eq("employee_code", code)
    .maybeSingle();

  currentCode = code;
  isPreRegistered = !!staffData;

  step1.classList.add("hidden");
  regForm.classList.remove("hidden");

  if (staffData) {
    infoBox.textContent = `أهلاً ${staffData.full_name}! بياناتك موجودة عندنا، برجاء تعيين كلمة مرور لتفعيل حسابك.`;
    fullNameInput.value = staffData.full_name || "";
    fullNameInput.disabled = true;
    phoneInput.value = staffData.phone || "";
    nationalIdInput.value = staffData.national_id || "";
  } else {
    infoBox.textContent = "هذا الكود جديد. برجاء إكمال البيانات يدوياً لإنشاء حساب.";
    fullNameInput.disabled = false;
    fullNameInput.value = "";
    phoneInput.value = "";
    nationalIdInput.value = "";
  }
});

document.getElementById("backToLookup").addEventListener("click", () => {
  regForm.classList.add("hidden");
  step1.classList.remove("hidden");
  statusEl.textContent = "";
});

// إتمام التسجيل
document.getElementById("finishSignupBtn").addEventListener("click", async () => {
  const fullName = fullNameInput.value.trim();
  const phone = phoneInput.value.trim();
  const nationalId = nationalIdInput.value.trim();
  const personalEmail = document.getElementById("email").value.trim();
  const password = passwordInput.value;

  if (!fullName || !phone || !nationalId || !password || !personalEmail) {
    statusEl.textContent = "برجاء استكمال كافة البيانات (الاسم، الموبايل، الرقم القومي، الإيميل، كلمة المرور)";
    statusEl.style.color = "red";
    return;
  }

  if (password.length < 6) {
    statusEl.textContent = "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
    statusEl.style.color = "red";
    return;
  }

  statusEl.textContent = "جاري إنشاء الحساب...";
  statusEl.style.color = "inherit";

  const email = mapCodeToEmail(currentCode);
  const idCardFile = document.getElementById("idCardFile").files[0];

  if (!idCardFile) {
    statusEl.textContent = "يجب رفع صورة البطاقة الشخصية لإتمام التسجيل";
    statusEl.style.color = "red";
    return;
  }

  // 1. إنشاء المستخدم في Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password
  });

  if (authError) {
    statusEl.textContent = "فشل إنشاء الحساب: " + authError.message;
    statusEl.style.color = "red";
    return;
  }

  const userId = authData.user?.id;
  if (!userId) {
    statusEl.textContent = "تعذر الحصول على بيانات المستخدم.";
    return;
  }

  // 2. رفع صورة البطاقة (إلزامي) إلى مجلد avatars كبديل لتجنب أخطاء السينك
  statusEl.textContent = "جاري رفع صورة البطاقة...";
  const fileExt = idCardFile.name.split('.').pop();
  const fileName = `ids/id_${userId}_${Date.now()}.${fileExt}`; // وضعها في مجلد ids داخل avatars
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, idCardFile);
  
  if (uploadError) {
    statusEl.textContent = "فشل رفع صورة البطاقة: " + uploadError.message;
    statusEl.style.color = "red";
    return;
  }

  const idDocPath = uploadData.path;
  statusEl.textContent = "جاري حفظ بيانات البروفايل...";

  // 3. إنشاء البروفايل في جدول profiles
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    full_name: fullName,
    employee_code: currentCode,
    phone,
    national_id: nationalId || null,
    email: personalEmail, // حفظ الإيميل الشخصي هنا
    id_document_path: idDocPath, // حفظ المسار هنا
    verification_status: "pending"
  });

  if (profileError) {
    statusEl.textContent = "تم إنشاء الحساب ولكن فشل حفظ البيانات الإضافية: " + profileError.message;
    return;
  }

  statusEl.textContent = "تم إنشاء حسابك بنجاح! جاري تحويلك...";
  statusEl.style.color = "green";

  setTimeout(() => {
    window.location.href = "salary.html";
  }, 2000);
});