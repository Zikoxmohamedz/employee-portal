import { supabase } from "./config.js";
import { mapCodeToEmail } from "./common.js";

const codeInput = document.getElementById("employeeCode");
const passwordInput = document.getElementById("password");
const statusEl = document.getElementById("loginStatus");

const { data: sessionData } = await supabase.auth.getSession();
if (sessionData.session) {
  window.location.href = "profile.html";
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const code = codeInput.value.trim();
  const password = passwordInput.value;

  if (!code || !password) {
    statusEl.textContent = "يجب إدخال الكود وكلمة المرور";
    statusEl.style.color = "red";
    return;
  }

  statusEl.textContent = "جاري محاولة الدخول...";
  statusEl.style.color = "inherit";

  // قائمة بالتنسيقات المحتملة للإيميلات الداخلية
  const formats = [
    `emp_${code}@company.com`,
    `emp_${code}@internal.com`,
    `${code}@company.com`,
    `${code}@hager.com` // احتمال قديم من المشروع السابق
  ];

  let lastError = null;
  let success = false;

  for (const email of formats) {
    if (success) break;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      success = true;
    } else {
      lastError = error;
    }
  }

  if (!success) {
    statusEl.textContent = "خطأ في الدخول: " + (lastError?.message || "بيانات غير صحيحة");
    statusEl.style.color = "red";
    return;
  }

  // تسجيل الخروج من باقي الأجهزة
  await supabase.auth.signOut({ scope: "others" });

  statusEl.textContent = "تم الدخول بنجاح! جاري التحويل...";
  statusEl.style.color = "green";
  
  setTimeout(() => window.location.href = "salary.html", 1000);
});