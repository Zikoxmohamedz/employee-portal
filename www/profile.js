import { supabase } from "./config.js";
import { requireAuth, logout, updateNavbarVisibility } from "./common.js";

async function init() {
  const user = await requireAuth();
  await updateNavbarVisibility(user);
  if (!user) return;
  
  // تحميل البروفايل بعد التأكد من الهوية
  await loadProfile();
}

init();

// UI Elements
const fullNameInput = document.getElementById("fullName");
const employeeCodeInput = document.getElementById("employeeCode");
const phoneInput = document.getElementById("phone");
const nationalIdInput = document.getElementById("nationalId");
const idFileInput = document.getElementById("idFile");
const statusEl = document.getElementById("profileStatus");
const verifyStateEl = document.getElementById("verifyState");

// Avatar UI
const avatarFileInput = document.getElementById("avatarFile");
const avatarDisplay = document.getElementById("avatarDisplay");
const displayCodeEl = document.getElementById("displayEmployeeCode");

document.getElementById("logoutBtn").addEventListener("click", logout);

async function loadProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    statusEl.textContent = "تعذر تحميل بيانات البروفايل.";
    return;
  }

  fullNameInput.value = data.full_name || "";
  employeeCodeInput.value = data.employee_code || "";
  phoneInput.value = data.phone || "";
  nationalIdInput.value = data.national_id || "";

  // عرض الكود والصورة
  displayCodeEl.textContent = data.employee_code || "---";
  if (data.avatar_url) {
    const { data: img } = supabase.storage.from("avatars").getPublicUrl(data.avatar_url);
    if (img && img.publicUrl) {
      // إضافة timestamp لمنع تخزين الصورة القديمة في المتصفح
      avatarDisplay.src = img.publicUrl + "?t=" + Date.now();
    }
  }

  // في حالة فشل التحميل، نضع صورة افتراضية
  avatarDisplay.onerror = () => {
    avatarDisplay.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(data.full_name || "User") + "&background=random";
  };

  const status = data.verification_status || "pending";
  verifyStateEl.textContent = status === "approved" ? "معتمد" : status === "rejected" ? "مرفوض" : "قيد المراجعة";
  verifyStateEl.className = `tag ${status}`;

  // --- سياسة قفل رفع البطاقة ---
  if (data.id_document_path) {
    verifyStateEl.setAttribute("data-has-file", "true");
    
    // قفل الرفع في حالة الانتظار أو الموافقة، وفتحه فقط في حالة الرفض
    if (status === "pending" || status === "approved") {
      idFileInput.disabled = true;
      idFileInput.title = "لا يمكن تغيير الصورة أثناء المراجعة أو بعد الاعتماد";
    } else {
      idFileInput.disabled = false;
      idFileInput.title = "يمكنك إعادة رفع صورة البطاقة الآن بعد الرفض";
    }
  }

  // --- سياسة التعديل بعد الاعتماد ---
  if (status === "approved") {
    fullNameInput.disabled = true;
    nationalIdInput.disabled = true;
    phoneInput.disabled = false;
  } else {
    fullNameInput.disabled = false;
    nationalIdInput.disabled = false;
  }
}

await loadProfile();

// --- Avatar Upload Logic ---
avatarFileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  statusEl.textContent = "جاري رفع الصورة الشخصية...";
  const ext = file.name.split('.').pop();
  const filePath = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    statusEl.textContent = "فشل رفع الصورة: " + uploadError.message;
    return;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: filePath })
    .eq("id", user.id);

  if (!updateError) {
    statusEl.textContent = "تم تحديث الصورة الشخصية!";
    statusEl.style.color = "green";
    loadProfile();
    updateNavbarVisibility(user); // لتحديث الصورة في النافبار فوراً
  }
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  const fullName = fullNameInput.value.trim();
  const phone = phoneInput.value.trim();
  const nationalId = nationalIdInput.value.trim();
  const file = idFileInput.files[0];

  if (!fullName || !phone || !nationalId) {
    statusEl.textContent = "الاسم، الموبايل، والرقم القومي مطلوبين.";
    statusEl.style.color = "red";
    return;
  }

  if (verifyStateEl.hasAttribute("data-has-file") && file) {
    statusEl.textContent = "لا يمكن تغيير صورة البطاقة بعد رفعها المرة الأولى.";
    statusEl.style.color = "red";
    return;
  }

  statusEl.textContent = "جاري الحفظ...";
  statusEl.style.color = "inherit";

  // جلب الحالة الحالية لمعرفة هل هو معتمد أم لا
  const currentStatus = verifyStateEl.classList.contains("approved") ? "approved" : "pending";

  let updateData = {};

  if (currentStatus === "approved") {
    // لو معتمد، بنحدث الموبايل بس وبنحافظ على الحالة معتمدة
    updateData = {
      phone: phone,
      // لا نرسل الاسم أو القومي هنا لأنهما مغلقان أصلاً
    };
  } else {
    // لو مش معتمد، بنحدث كله وبنخلي الحالة pending للمراجعة
    updateData = {
      full_name: fullName,
      phone,
      national_id: nationalId || null,
      verification_status: "pending"
    };
  }

  let filePath = null;
  if (file && !idFileInput.disabled) {
    statusEl.textContent = "جاري رفع البطاقة الجديدة...";
    const ext = file.name.split('.').pop();
    filePath = `ids/${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      statusEl.textContent = "فشل رفع الملف: " + uploadError.message;
      return;
    }
    updateData.id_document_path = filePath;
    updateData.verification_status = "pending"; // لو رفع صورة جديدة يرجع للمراجعة
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id);

  if (error) {
    statusEl.textContent = "خطأ في التحديث: " + error.message;
    statusEl.style.color = "red";
  } else {
    statusEl.textContent = "تم الحفظ بنجاح.";
    statusEl.style.color = "green";
    await loadProfile(); // إعادة تحميل البيانات لقفل الخانات فوراً
  }
});