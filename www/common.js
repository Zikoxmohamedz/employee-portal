import { supabase } from "./config.js";

// --- تحويل كود الموظف إلى إيميل داخلي للنظام ---
export function mapCodeToEmail(code) {
  return `emp_${code.trim()}@company.com`;
}

// --- دوال مساعدة ---
export async function requireAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return null;
  
  // فحص قاعدة البيانات + فحص إجباري لزياد (لحل مشكلة الطرد)
  const { data } = await supabase.from("admin_users").select("*").eq("id", user.id).maybeSingle();
  
  // جلب البروفايل للتأكد من الاسم
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const isZiad = profile && profile.full_name?.toLowerCase().includes("ziad");

  if (!data && !isZiad) {
    window.location.href = "salary.html"; // طرده للمرتبات لو مش أدمن
    return null;
  }
  return user;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "login.html";
}

export function salaryMonthName(month, year) {
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${months[month - 1]} ${year}`;
}

// --- تحديث النافبار بشكل متكامل ---
export async function updateNavbarVisibility(user) {
  if (!user) return;

  // 1. جلب البيانات الأساسية للموظف والمدير معاً لضمان السرعة
  const [profileResult, adminResult] = await Promise.all([
    supabase.from("profiles").select("verification_status, full_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("admin_users").select("id").eq("id", user.id).maybeSingle()
  ]);

  const profile = profileResult.data;
  const adminData = adminResult.data;

  // تسجيل بسيط للمساعدة في الفحص (يظهر للأدمن فقط في الـ Console)
  if (adminData) console.log("Admin identity verified");

  const navActions = document.querySelector(".nav-actions");
  if (!navActions) return;

  // مسح المحتوى الحالي لإعادة الترتيب بدقة
  navActions.innerHTML = "";

  // 1. رابط المرتبات (دائماً الأول)
  const salaryLink = document.createElement("a");
  salaryLink.href = "salary.html";
  salaryLink.className = "nav-btn";
  salaryLink.textContent = "المرتبات";
  if (window.location.pathname.includes("salary.html")) salaryLink.classList.add("primary");
  navActions.appendChild(salaryLink);

  // 2. رابط الطلبات
  const reqLink = document.createElement("a");
  reqLink.href = "requests.html";
  reqLink.className = "nav-btn";
  reqLink.textContent = "الطلبات";
  if (window.location.pathname.includes("requests.html")) reqLink.classList.add("primary");
  navActions.appendChild(reqLink);

  // 3. رابط الإدارة (يظهر فقط لمن يملك الصلاحية)
  const adminLink = document.createElement("a");
  adminLink.href = "admin.html";
  adminLink.className = "nav-btn";
  adminLink.style.fontWeight = "bold";
  adminLink.textContent = "الإدارة";
  
  // التحقق من الصلاحية
  const isZiad = profile && profile.full_name?.toLowerCase().includes("ziad");
  if (adminData || isZiad) {
    adminLink.style.display = "flex";
  } else {
    adminLink.style.display = "none";
  }
  
  navActions.appendChild(adminLink);

  // 4. مسافة مرنة (اختياري للفصل)
  const spacer = document.createElement("div");
  spacer.style.flex = "1";
  navActions.appendChild(spacer);

  // 5. معلومات المستخدم (اسم وصورة) - رابط لصفحة البيانات
  if (profile) {
    const userLink = document.createElement("a");
    userLink.href = "profile.html";
    userLink.className = "nav-user";
    userLink.style.textDecoration = "none";
    userLink.style.color = "inherit";

    let avatarSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || "User")}&background=random`;
    if (profile.avatar_url) {
      const { data: img } = supabase.storage.from("avatars").getPublicUrl(profile.avatar_url);
      if (img && img.publicUrl) avatarSrc = img.publicUrl + "?t=" + Date.now();
    }

    userLink.innerHTML = `
      <span style="font-weight: 600; font-size: 0.9rem;">${profile.full_name || "موظف"}</span>
      <img src="${avatarSrc}" class="avatar-circle" alt="Avatar" 
           onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || "User")}&background=random'" />
    `;
    navActions.appendChild(userLink);
  }

  // 6. زر الخروج
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;
}

// --- تفعيل الإشعارات و Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      console.log('Service Worker registered:', reg);
      
      // طلب إذن الإشعارات إذا لم يتم طلبه من قبل
      if (Notification.permission === 'default') {
        setTimeout(() => {
          requestNotificationPermission();
        }, 3000); // ننتظر 3 ثوانٍ قبل الطلب ليكون المستخدم قد استوعب التطبيق
      }
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  });
}

async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    console.log('Notification permission granted.');
    // هنا يمكن إضافة كود الـ FCM Token لاحقاً لإرسال إشعارات مخصصة
  }
}