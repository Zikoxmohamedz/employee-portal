import { supabase } from "./config.js";

const codeInput = document.getElementById("employeeCode");
const idInput = document.getElementById("nationalId");
const passInput = document.getElementById("newPassword");
const statusEl = document.getElementById("resetStatus");

document.getElementById("resetBtn").addEventListener("click", async () => {
  const code = codeInput.value.trim();
  const nationalId = idInput.value.trim();
  const newPassword = passInput.value;

  if (!code || !nationalId || !newPassword) {
    statusEl.textContent = "برجاء استكمال كافة البيانات";
    statusEl.style.color = "red";
    return;
  }

  if (newPassword.length < 6) {
    statusEl.textContent = "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
    return;
  }

  statusEl.textContent = "جاري التحقق وتحديث كلمة المرور...";
  statusEl.style.color = "inherit";

  const { data: success, error } = await supabase.rpc("reset_password_by_national_id", {
    p_code: code,
    p_national_id: nationalId,
    p_new_password: newPassword
  });

  if (error) {
    statusEl.textContent = "خطأ تقني: " + error.message;
    statusEl.style.color = "red";
    return;
  }

  if (success) {
    statusEl.textContent = "تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.";
    statusEl.style.color = "green";
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
  } else {
    statusEl.textContent = "البيانات غير متطابقة. تأكد من الكود والرقم القومي.";
    statusEl.style.color = "red";
  }
});
