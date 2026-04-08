import { supabase } from "./config.js";
import { requireAuth, logout, salaryMonthName, updateNavbarVisibility } from "./common.js";

async function init() {
  const user = await requireAuth();
  await updateNavbarVisibility(user);
  if (!user) return;
  
  // نقوم بتنفيذ التحميل التلقائي بعد التأكد من الهوية
  loadSalary();
}

init();

const statusEl = document.getElementById("salaryStatus");
const salaryCards = document.getElementById("salaryCards");
const salaryMonthInput = document.getElementById("salaryMonth");
const salaryYearInput = document.getElementById("salaryYear");
const userNameEl = document.getElementById("userName");

// تعيين الشهر الحالي كافتراضي
const now = new Date();
salaryMonthInput.value = now.getMonth() + 1;
salaryYearInput.value = now.getFullYear();

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("loadSalaryBtn").addEventListener("click", loadSalary);

// تحميل تلقائي عند تغيير الشهر أو السنة
salaryMonthInput.addEventListener("change", loadSalary);
salaryYearInput.addEventListener("change", loadSalary);

async function loadSalary() {
  statusEl.textContent = "جاري تحميل البيانات...";
  statusEl.style.color = "inherit";
  salaryCards.classList.add("hidden");

  // 1. جلب كود الموظف
  const { data: profile, error: pError } = await supabase
    .from("profiles")
    .select("employee_code")
    .eq("id", user.id)
    .maybeSingle();

  if (pError || !profile) {
    statusEl.textContent = "تعذر تحديد كود الموظف الخاص بك.";
    return;
  }

  // تحديث اسم المستخدم في الترحيب من واقع البروفايل
  const { data: profileFull } = await supabase.from("profiles").select("full_name, employee_code").eq("id", user.id).single();
  if (profileFull) {
    userNameEl.textContent = profileFull.full_name;
    document.getElementById("displayID").textContent = profileFull.employee_code;
  }

  // 2. جلب بيانات المرتب بناءً على الفلتر
  const month = parseInt(salaryMonthInput.value);
  const year = parseInt(salaryYearInput.value);

  const { data, error } = await supabase
    .from("payrolls")
    .select("*")
    .eq("employee_code", profile.employee_code)
    .eq("payroll_month", month)
    .eq("payroll_year", year)
    .maybeSingle();

  if (error) {
    statusEl.textContent = "حدث خطأ أثناء تحميل المرتب: " + error.message;
    return;
  }

  if (!data) {
    statusEl.textContent = `لا توجد بيانات مرتب معتمدة لشهر ${salaryMonthName(month, year)}.`;
    return;
  }

  // 3. عرض البيانات
  document.getElementById("displaySalaryMonth").textContent = salaryMonthName(data.payroll_month, data.payroll_year);
  document.getElementById("grossTotal").textContent = Number(data.gross_total).toLocaleString();
  document.getElementById("deductionsTotal").textContent = Number(data.deductions_total).toLocaleString();
  document.getElementById("netTotal").textContent = Number(data.net_total).toLocaleString();

  statusEl.textContent = "";
  salaryCards.classList.remove("hidden");
}

loadSalary();