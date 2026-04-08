import { supabase } from "./config.js";
import { requireAdmin, logout, updateNavbarVisibility } from "./common.js";

const adminUser = await requireAdmin();
await updateNavbarVisibility(adminUser);
if (!adminUser) throw new Error("Unauthorized");

// --- UI Elements ---
const masterStatus = document.getElementById("masterStatus");
const adminStatus = document.getElementById("adminStatus");
const salaryStatus = document.getElementById("salaryStatus");
const adminReqStatus = document.getElementById("adminReqStatus");
const adminRequestsBody = document.getElementById("adminRequestsBody");
const reqCountEl = document.getElementById("reqCount");

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshBtn").addEventListener("click", loadProfiles);
document.getElementById("viewReportBtn").addEventListener("click", loadSalaryReport);

// --- Tab Switching Logic ---
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetTab = btn.dataset.tab;

    // Active button
    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Active content
    tabContents.forEach(content => {
      content.classList.remove("active");
      if (content.id === targetTab) content.classList.add("active");
    });
  });
});

// --- Manual Master Data ---
document.getElementById("addMasterBtn").addEventListener("click", async () => {
  const code = document.getElementById("masterCode").value.trim();
  const name = document.getElementById("masterName").value.trim();
  const email = document.getElementById("masterEmail").value.trim();
  const phone = document.getElementById("masterPhone").value.trim();
  const nationalId = document.getElementById("masterNationalId").value.trim();

  if (!code || !name || !email) return alert("الكود والاسم والإيميل مطلوبين");

  const { error } = await supabase.from("master_staff").upsert({ 
    employee_code: code, 
    full_name: name, 
    email,
    phone,
    national_id: nationalId
  });

  if (error) {
    alert("خطأ: " + error.message);
  } else {
    alert("تم حفظ الموظف في القاعدة بنجاح!");
    // مسح الخانات بعد الحفظ
    document.getElementById("masterCode").value = "";
    document.getElementById("masterName").value = "";
    document.getElementById("masterEmail").value = "";
    document.getElementById("masterPhone").value = "";
    document.getElementById("masterNationalId").value = "";
  }
});

// --- Bulk Staff Import ---
const bulkStaffFile = document.getElementById("bulkStaffFile");
const processBulkStaffBtn = document.getElementById("processBulkStaffBtn");
bulkStaffFile.addEventListener("change", (e) => { if(e.target.files[0]) processBulkStaffBtn.classList.remove("hidden"); });
processBulkStaffBtn.onclick = async () => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const rows = XLSX.utils.sheet_to_json(XLSX.read(data, {type:'array'}).Sheets[XLSX.read(data, {type:'array'}).SheetNames[0]]);
    const processed = rows.map(r => {
      const f = (k) => { const x = Object.keys(r).find(z => k.some(y => z.toLowerCase().includes(y))); return x ? r[x] : null; };
      return { employee_code: String(f(['كود','code'])||""), full_name: f(['اسم','name'])||"", email: f(['بريد','email'])||"" };
    }).filter(r => r.employee_code);
    const { error } = await supabase.from("master_staff").upsert(processed, {onConflict:'employee_code'});
    if (!error) { alert(`تم رفع ${processed.length} سجل.`); processBulkStaffBtn.classList.add("hidden"); }
  };
  reader.readAsArrayBuffer(bulkStaffFile.files[0]);
};

// --- Employee Requests Management ---
async function loadAdminRequests() {
  adminRequestsBody.innerHTML = "";
  const { data, error } = await supabase
    .from("requests")
    .select("*, profiles(full_name, employee_code)") // جلب الكود مع الاسم
    .order("created_at", {ascending:false});

  if (error) return;

  const pending = data.filter(r => r.status === 'pending').length;
  reqCountEl.textContent = `${pending} جديد`;

  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="font-weight: 600;">${row.profiles?.full_name || row.employee_id}</div>
        <div class="user-id-badge" style="font-size: 0.75rem; margin-top: 4px;">ID: ${row.profiles?.employee_code || "---"}</div>
      </td>
      <td style="max-width: 300px; white-space: pre-wrap; word-break: break-word; font-size: 0.9rem;">
        ${row.message}
      </td>
      <td>${new Date(row.created_at).toLocaleDateString("ar-EG")}</td>
      <td>
        <div style="display: flex; gap: 0.5rem;">
          <button class="nav-btn primary resolve-req" data-id="${row.id}">حل المشكلة</button>
          <button class="nav-btn reject-req" data-id="${row.id}">رفض</button>
        </div>
      </td>
    `;
    adminRequestsBody.appendChild(tr);
  });

  document.querySelectorAll(".resolve-req").forEach(btn => btn.onclick = async () => {
    const note = prompt("اكتب ملاحظات الرد للموظف:");
    await supabase.from("requests").update({ status: 'resolved', admin_notes: note }).eq("id", btn.dataset.id);
    loadAdminRequests();
  });
  
  document.querySelectorAll(".reject-req").forEach(btn => btn.onclick = async () => {
    const note = prompt("سبب الرفض:");
    await supabase.from("requests").update({ status: 'rejected', admin_notes: note }).eq("id", btn.dataset.id);
    loadAdminRequests();
  });
}

// --- Salary & Profiles Logic ---
async function loadSalaryReport() {
  const { data, error } = await supabase.from("payrolls").select("*, profiles(full_name)").eq("payroll_month", document.getElementById("reportMonth").value).eq("payroll_year", document.getElementById("reportYear").value);
  salaryStatus.targetData = data;
  document.getElementById("salaryBody").innerHTML = data?.map(r => `<tr><td>${r.profiles?.full_name||"---"}</td><td>${r.employee_code}</td><td>${r.gross_total}</td><td>${r.deductions_total}</td><td>${r.net_total}</td></tr>`).join('') || "";
}

async function loadProfiles() {
  const { data } = await supabase.from("profiles").select("*").order("created_at", {ascending:false});
  
  const statusLabels = {
    pending: "قيد المراجعة",
    approved: "معتمد",
    rejected: "مرفوض"
  };

  document.getElementById("employeesBody").innerHTML = data?.map(r => {
    let actionsHtml = `<button class="nav-btn approve-user" data-id="${r.id}">موافقة</button>`;
    
    // زر المراجعة لو في صورة بطاقة
    if (r.id_document_path) {
      const { data: img } = supabase.storage.from("avatars").getPublicUrl(r.id_document_path);
      actionsHtml += `<a href="${img.publicUrl}" target="_blank" class="nav-btn primary" style="text-decoration:none; margin: 0 5px; background: #0284c7;">معاينة البطاقة</a>`;
    } else {
      actionsHtml += `<span style="color: #94a3b8; font-size: 0.8rem; margin: 0 5px;">لم يرفع البطاقة</span>`;
    }

    // زر الرفض
    actionsHtml += `<button class="nav-btn reject-user" data-id="${r.id}" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 0.5rem 0.75rem;">رفض</button>`;

    return `
      <tr>
        <td>${r.full_name}</td>
        <td>${r.employee_code}</td>
        <td>${r.phone}</td>
        <td><span class="tag ${r.verification_status}">${statusLabels[r.verification_status] || r.verification_status}</span></td>
        <td><div style="display: flex; gap: 0.25rem;">${actionsHtml}</div></td>
      </tr>
    `;
  }).join("") || "";

  // برمجة أزرار الموافقة
  document.querySelectorAll(".approve-user").forEach(b => b.onclick = async () => {
    if (!confirm("هل أنت متأكد من الموافقة على هذا الحساب؟")) return;
    await supabase.from("profiles").update({ verification_status: 'approved' }).eq("id", b.dataset.id); 
    loadProfiles();
  });

  // برمجة أزرار الرفض
  document.querySelectorAll(".reject-user").forEach(b => b.onclick = async () => {
    const reason = prompt("ما هو سبب الرفض؟ (سيظهر للموظف)");
    if (reason === null) return;
    await supabase.from("profiles").update({ verification_status: 'rejected' }).eq("id", b.dataset.id); 
    loadProfiles();
  });
}

// Bulk Salary
document.getElementById("processBulkBtn").onclick = async () => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const rows = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), {type:'array'}).Sheets[XLSX.read(new Uint8Array(e.target.result), {type:'array'}).SheetNames[0]]);
    const processed = rows.map(r => {
      const f = (k) => { const x = Object.keys(r).find(z => k.some(y => z.toLowerCase().includes(y))); return x ? r[x] : null; };
      return { employee_code: String(f(['كود','code'])||""), payroll_month: parseInt(f(['شهر','month'])), payroll_year: parseInt(f(['سنة','year'])), gross_total: parseFloat(f(['إجمالي','gross'])||0), deductions_total: parseFloat(f(['خصم','deductions'])||0), net_total: parseFloat(f(['صافي','net'])||0) };
    }).filter(r => r.employee_code);
    await supabase.from("payrolls").upsert(processed, {onConflict:'employee_code, payroll_month, payroll_year'});
    loadSalaryReport(); alert("تم!");
  };
  reader.readAsArrayBuffer(document.getElementById("bulkSalaryFile").files[0]);
};

loadProfiles();
loadSalaryReport();
loadAdminRequests();