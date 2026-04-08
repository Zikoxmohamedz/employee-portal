import { supabase } from "./config.js";
import { requireAuth, logout, updateNavbarVisibility } from "./common.js";

const user = await requireAuth();
await updateNavbarVisibility(user);
if (!user) throw new Error("Unauthorized");

const messageInput = document.getElementById("requestMessage");
const sendBtn = document.getElementById("sendRequestBtn");
const statusEl = document.getElementById("requestStatus");
const bodyEl = document.getElementById("requestsBody");

sendBtn.addEventListener("click", async () => {
  const msg = messageInput.value.trim();
  if (!msg) return alert("برجاء كتابة نص الرسالة");

  statusEl.textContent = "جاري الإرسال...";
  const { error } = await supabase.from("requests").insert({
    employee_id: user.id,
    message: msg
  });

  if (error) {
    statusEl.textContent = "خطأ: " + error.message;
    statusEl.style.color = "red";
  } else {
    statusEl.textContent = "تم إرسال طلبك بنجاح وسنقوم بمراجعته قريباً.";
    statusEl.style.color = "green";
    messageInput.value = "";
    loadRequests();
  }
});

async function loadRequests() {
  bodyEl.innerHTML = "";
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("employee_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return;

  const statusBadge = (s) => `<span class="tag ${s}">${s === "pending" ? "قيد الانتظار" : s === "resolved" ? "تم الحل" : "مرفوض"}</span>`;

  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(row.created_at).toLocaleDateString("ar-EG")}</td>
      <td>${row.message}</td>
      <td>${statusBadge(row.status)}</td>
      <td>${row.admin_notes || "---"}</td>
    `;
    bodyEl.appendChild(tr);
  });
}

loadRequests();
