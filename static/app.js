const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const saleForm = document.getElementById("saleForm");
const saleDateInput = document.getElementById("saleDate");
const photoCountInput = document.getElementById("photoCount");
const selectedPriceInput = document.getElementById("selectedPrice");
const unitPriceInput = document.getElementById("unitPrice");
const customPriceBtn = document.getElementById("customPriceBtn");
const customPriceWrapper = document.getElementById("customPriceWrapper");
const priceOptionButtons = document.querySelectorAll(".price-option");
const calculatedTotal = document.getElementById("calculatedTotal");
const salesTableBody = document.getElementById("salesTableBody");
const emptyState = document.getElementById("emptyState");
const salesPaginationElement = document.getElementById("salesPagination");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const paginationInfoElement = document.getElementById("paginationInfo");
const profileToggleBtn = document.getElementById("profileToggleBtn");
const profileDropdown = document.getElementById("profileDropdown");
const profileAvatar = document.getElementById("profileAvatar");
const profileDropdownName = document.getElementById("profileDropdownName");
const profileDropdownRole = document.getElementById("profileDropdownRole");
const deleteModal = document.getElementById("deleteModal");
const deleteModalCancelBtn = document.getElementById("deleteModalCancelBtn");
const deleteModalConfirmBtn = document.getElementById("deleteModalConfirmBtn");
const todaySummaryCard = document.getElementById("todaySummaryCard");
const monthSummaryCard = document.getElementById("monthSummaryCard");
const grandSummaryCard = document.getElementById("grandSummaryCard");
const totalPhotosSummaryCard = document.getElementById("totalPhotosSummaryCard");
const todaySummaryUserFilter = document.getElementById("todaySummaryUserFilter");
const monthSummaryUserFilter = document.getElementById("monthSummaryUserFilter");
const grandSummaryUserFilter = document.getElementById("grandSummaryUserFilter");
const totalPhotosSummaryUserFilter = document.getElementById("totalPhotosSummaryUserFilter");
const ownerEarningsSection = document.getElementById("ownerEarningsSection");
const ownerDateFilterInput = document.getElementById("ownerDateFilter");
const ownerDailyEarningsListElement = document.getElementById("ownerDailyEarningsList");
const ownerWorkerDetailElement = document.getElementById("ownerWorkerDetail");
const ownerDetailTitleElement = document.getElementById("ownerDetailTitle");
const ownerDetailSubtitleElement = document.getElementById("ownerDetailSubtitle");
const ownerWorkerHistoryListElement = document.getElementById("ownerWorkerHistoryList");
const ownerHistoryActionsElement = document.getElementById("ownerHistoryActions");
const ownerHistoryToggleElement = document.getElementById("ownerHistoryToggle");

const todayTotalElement = document.getElementById("todayTotal");
const monthTotalElement = document.getElementById("monthTotal");
const grandTotalElement = document.getElementById("grandTotal");
const totalPhotosElement = document.getElementById("totalPhotos");
const workerTotalPhotosElement = document.getElementById("workerTotalPhotos");
const currentUserNameElement = document.getElementById("currentUserName");
const currentUserRoleElement = document.getElementById("currentUserRole");
const salesListDescriptionElement = document.getElementById("salesListDescription");
const actionsHeaderElement = document.getElementById("actionsHeader");
const workerCompensationSection = document.getElementById("workerCompensationSection");
const bonusCardElement = document.getElementById("bonusCard");
const baseEarningsElement = document.getElementById("baseEarnings");
const bonusEarningsElement = document.getElementById("bonusEarnings");
const totalEarningsElement = document.getElementById("totalEarnings");
const workerCompensationDateLabelElement = document.getElementById("workerCompensationDateLabel");
const workerHistoryListElement = document.getElementById("workerHistoryList");
const workerHistoryActionsElement = document.getElementById("workerHistoryActions");
const workerHistoryToggleElement = document.getElementById("workerHistoryToggle");
const count150Element = document.getElementById("count150");
const count200Element = document.getElementById("count200");
const customCountElement = document.getElementById("customCount");

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2,
});
let currentUser = null;
let selectedOwnerWorkerId = null;
const ownerSummarySelections = {
  today: "",
  month: "",
  grand: "",
  photos: "",
};
let workerHistoryExpanded = false;
let ownerHistoryExpanded = false;
const HISTORY_VISIBLE_COUNT = 5;
const SALES_PAGE_SIZE = 5;
let currentSalesPage = 1;
let currentSalesData = [];
let editingSaleId = null;
let pendingDeleteSaleId = null;

function getSelectedUnitPrice() {
  if (!customPriceWrapper.classList.contains("hidden")) {
    return Number(unitPriceInput.value || 0);
  }

  return Number(selectedPriceInput.value || 0);
}

function updatePriceSelectionState(activeButton = null) {
  priceOptionButtons.forEach((button) => {
    button.classList.toggle("active", button === activeButton);
  });
}

function selectFixedPrice(price) {
  selectedPriceInput.value = String(price);
  unitPriceInput.value = "";
  customPriceWrapper.classList.add("hidden");

  const activeButton = Array.from(priceOptionButtons).find(
    (button) => button.dataset.price === String(price),
  );
  updatePriceSelectionState(activeButton || null);
  calculateTotal();
}

function enableCustomPrice(value = "") {
  selectedPriceInput.value = value ? String(value) : "";
  customPriceWrapper.classList.remove("hidden");
  unitPriceInput.value = value ? String(value) : "";
  updatePriceSelectionState(customPriceBtn);
  calculateTotal();
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateLabel(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatSaleDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function showLoginView() {
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
}

function showAppView() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function setLoginError(message) {
  loginError.textContent = message;
  loginError.classList.toggle("hidden", !message);
}

function roleLabel(role) {
  return role === "owner" ? "İşletme Sahibi" : "İşçi";
}

function renderCurrentUser(user) {
  currentUser = user;
  currentUserNameElement.textContent = user.full_name;
  currentUserRoleElement.textContent = `${roleLabel(user.role)} / ${user.username}`;
  profileDropdownName.textContent = user.full_name;
  profileDropdownRole.textContent = `${roleLabel(user.role)} / ${user.username}`;
  profileAvatar.textContent = user.full_name.trim().charAt(0).toUpperCase() || "M";
  salesListDescriptionElement.textContent =
    user.role === "owner"
      ? ""
      : "Yalnızca sizin eklediğiniz satış kayıtları aşağıda listelenir.";
  todaySummaryCard.classList.toggle("hidden", user.role !== "owner");
  monthSummaryCard.classList.toggle("hidden", user.role !== "owner");
  grandSummaryCard.classList.toggle("hidden", user.role !== "owner");
  totalPhotosSummaryCard.classList.toggle("hidden", user.role === "worker");
  todaySummaryUserFilter.classList.toggle("hidden", user.role !== "owner");
  monthSummaryUserFilter.classList.toggle("hidden", user.role !== "owner");
  grandSummaryUserFilter.classList.toggle("hidden", user.role !== "owner");
  totalPhotosSummaryUserFilter.classList.toggle("hidden", user.role !== "owner");
  actionsHeaderElement.classList.toggle("hidden", user.role !== "owner");
  workerCompensationSection.classList.toggle("hidden", user.role !== "worker");
  ownerEarningsSection.classList.toggle("hidden", user.role !== "owner");
}

function calculateTotal() {
  const photoCount = Number(photoCountInput.value || 0);
  const unitPrice = getSelectedUnitPrice();
  const total = photoCount * unitPrice;
  calculatedTotal.textContent = currencyFormatter.format(total);
}

function resetForm() {
  saleForm.reset();
  saleDateInput.value = new Date().toISOString().split("T")[0];
  calculatedTotal.textContent = currencyFormatter.format(0);
  selectFixedPrice(150);
}

function renderSummary(summary) {
  todayTotalElement.textContent = currencyFormatter.format(summary.today_total);
  monthTotalElement.textContent = currencyFormatter.format(summary.month_total);
  grandTotalElement.textContent = currencyFormatter.format(summary.grand_total);
  totalPhotosElement.textContent = summary.total_photos;
  workerTotalPhotosElement.textContent = summary.total_photos;
}

function renderOwnerSummaryUsers(users) {
  const filters = [
    { element: todaySummaryUserFilter, key: "today" },
    { element: monthSummaryUserFilter, key: "month" },
    { element: grandSummaryUserFilter, key: "grand" },
    { element: totalPhotosSummaryUserFilter, key: "photos" },
  ];

  filters.forEach(({ element, key }) => {
    element.innerHTML = '<option value="">Tümü</option>';

    users.forEach((user) => {
      const option = document.createElement("option");
      option.value = String(user.id);
      option.textContent = user.full_name;
      element.appendChild(option);
    });

    element.value = ownerSummarySelections[key];
  });
}

function renderOwnerSummaryMetric(metric, summary) {
  if (metric === "today") {
    todayTotalElement.textContent = currencyFormatter.format(summary.today_total);
    return;
  }

  if (metric === "month") {
    monthTotalElement.textContent = currencyFormatter.format(summary.month_total);
    return;
  }

  if (metric === "grand") {
    grandTotalElement.textContent = currencyFormatter.format(summary.grand_total);
    return;
  }

  totalPhotosElement.textContent = summary.total_photos;
}

function renderCompensation(compensation) {
  baseEarningsElement.textContent = currencyFormatter.format(compensation.base_earnings);
  bonusEarningsElement.textContent = currencyFormatter.format(compensation.bonus);
  totalEarningsElement.textContent = currencyFormatter.format(compensation.total_earnings);
  bonusCardElement.classList.toggle("hidden", compensation.bonus <= 0);
  count150Element.textContent = `${compensation.photo_count_150} fotoğraf`;
  count200Element.textContent = `${compensation.photo_count_200} fotoğraf`;
  customCountElement.textContent = `${compensation.custom_photo_count} fotoğraf`;
  workerTotalPhotosElement.textContent = compensation.total_photos;
}

function renderDailyHistory(history, todayDate) {
  workerHistoryListElement.innerHTML = "";
  workerHistoryActionsElement.classList.toggle("hidden", history.length <= HISTORY_VISIBLE_COUNT);
  workerHistoryToggleElement.textContent = workerHistoryExpanded ? "Daha Az Göster" : "Daha Fazla Göster";

  if (!history.length) {
    workerHistoryListElement.innerHTML =
      '<div class="history-empty">Henüz günlük hakediş geçmişi oluşmadı.</div>';
    return;
  }

  const visibleHistory =
    workerHistoryExpanded || history.length <= HISTORY_VISIBLE_COUNT
      ? history
      : history.slice(0, HISTORY_VISIBLE_COUNT);

  visibleHistory.forEach((day) => {
    const card = document.createElement("article");
    card.className = "history-card";

    const isToday = day.sale_date === todayDate;
    const bonusLine =
      day.bonus > 0
        ? `<div class="history-meta"><span>Prim</span><strong>${currencyFormatter.format(day.bonus)}</strong></div>`
        : "";

    card.innerHTML = `
      <div class="history-card-head">
        <div>
          <h3>${isToday ? "Bugün" : formatDateLabel(day.sale_date)}</h3>
          <p>${day.total_photos} fotoğraf</p>
        </div>
        <strong>${currencyFormatter.format(day.total_earnings)}</strong>
      </div>
      <div class="history-meta"><span>Ana Hakediş</span><strong>${currencyFormatter.format(day.base_earnings)}</strong></div>
      ${bonusLine}
    `;

    workerHistoryListElement.appendChild(card);
  });
}

function renderOwnerDailyEarnings(workers) {
  ownerDailyEarningsListElement.innerHTML = "";

  if (!workers.length) {
    ownerDailyEarningsListElement.innerHTML =
      '<div class="history-empty">Seçilen tarihte kullanıcı kaydı bulunamadı.</div>';
    ownerWorkerDetailElement.classList.add("hidden");
    return;
  }

  workers.forEach((worker) => {
    const card = document.createElement("article");
    card.className = "owner-earnings-card";
    const activeClass = selectedOwnerWorkerId === worker.user_id ? " active" : "";
    const bonusLine =
      worker.compensation.bonus > 0
        ? `<div class="history-meta"><span>Prim</span><strong>${currencyFormatter.format(worker.compensation.bonus)}</strong></div>`
        : "";

    card.innerHTML = `
      <button type="button" class="owner-worker-btn${activeClass}" data-user-id="${worker.user_id}">
        <div class="history-card-head">
          <div>
            <h3>${worker.full_name}</h3>
            <p>${roleLabel(worker.role)} / @${worker.username} / ${worker.compensation.total_photos} fotoğraf</p>
          </div>
          <strong>${currencyFormatter.format(worker.compensation.total_earnings)}</strong>
        </div>
        <div class="history-meta"><span>Ana Hakediş</span><strong>${currencyFormatter.format(worker.compensation.base_earnings)}</strong></div>
        ${bonusLine}
      </button>
    `;

    card.querySelector(".owner-worker-btn").addEventListener("click", async () => {
      selectedOwnerWorkerId = worker.user_id;
      ownerHistoryExpanded = false;
      renderOwnerDailyEarnings(workers);
      await loadOwnerWorkerHistory(worker.user_id);
    });

    ownerDailyEarningsListElement.appendChild(card);
  });
}

function renderOwnerWorkerHistory(worker, history) {
  ownerWorkerDetailElement.classList.remove("hidden");
  ownerDetailTitleElement.textContent = `${worker.full_name} Günlük Geçmiş`;
  ownerDetailSubtitleElement.textContent = `${roleLabel(worker.role)} / @${worker.username} kullanıcısının tüm gün bazlı hakediş geçmişi.`;
  ownerWorkerHistoryListElement.innerHTML = "";
  ownerHistoryActionsElement.classList.toggle("hidden", history.length <= HISTORY_VISIBLE_COUNT);
  ownerHistoryToggleElement.textContent = ownerHistoryExpanded ? "Daha Az Göster" : "Daha Fazla Göster";

  if (!history.length) {
    ownerWorkerHistoryListElement.innerHTML =
      '<div class="history-empty">Bu kullanıcı için geçmiş kayıt bulunamadı.</div>';
    return;
  }

  const visibleHistory =
    ownerHistoryExpanded || history.length <= HISTORY_VISIBLE_COUNT
      ? history
      : history.slice(0, HISTORY_VISIBLE_COUNT);

  visibleHistory.forEach((day) => {
    const bonusLine =
      day.compensation.bonus > 0
        ? `<div class="history-meta"><span>Prim</span><strong>${currencyFormatter.format(day.compensation.bonus)}</strong></div>`
        : "";

    const card = document.createElement("article");
    card.className = "history-card";
    card.innerHTML = `
      <div class="history-card-head">
        <div>
          <h3>${formatDateLabel(day.sale_date)}</h3>
          <p>${day.compensation.total_photos} fotoğraf</p>
        </div>
        <strong>${currencyFormatter.format(day.compensation.total_earnings)}</strong>
      </div>
      <div class="history-meta"><span>Ana Hakediş</span><strong>${currencyFormatter.format(day.compensation.base_earnings)}</strong></div>
      ${bonusLine}
    `;
    ownerWorkerHistoryListElement.appendChild(card);
  });
}

function renderTable(sales) {
  currentSalesData = sales;
  salesTableBody.innerHTML = "";
  emptyState.classList.toggle("hidden", sales.length > 0);
  salesPaginationElement.classList.toggle("hidden", sales.length <= SALES_PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(sales.length / SALES_PAGE_SIZE));
  if (currentSalesPage > totalPages) {
    currentSalesPage = totalPages;
  }

  const startIndex = (currentSalesPage - 1) * SALES_PAGE_SIZE;
  const visibleSales = sales.slice(startIndex, startIndex + SALES_PAGE_SIZE);
  paginationInfoElement.textContent = `${currentSalesPage} / ${totalPages}`;
  prevPageBtn.disabled = currentSalesPage === 1;
  nextPageBtn.disabled = currentSalesPage === totalPages;

  visibleSales.forEach((sale) => {
    const row = document.createElement("tr");
    const isEditing = editingSaleId === sale.id;

    if (isEditing) {
      const actionsCell =
        currentUser?.role === "owner"
          ? `
        <td class="actions-cell" data-label="İşlem">
          <button class="table-btn save-btn" data-id="${sale.id}">Kaydet</button>
          <button class="table-btn cancel-btn" data-id="${sale.id}">Vazgeç</button>
        </td>
      `
          : "";

      row.innerHTML = `
        <td data-label="Satışı Giren">${sale.seller_name || sale.seller_username || "-"}</td>
        <td data-label="Tarih"><input class="inline-input" type="date" value="${sale.sale_date}" id="edit-date-${sale.id}" /></td>
        <td data-label="Kayıt Zamanı">${formatDateTime(sale.created_at)}</td>
        <td data-label="Adet"><input class="inline-input" type="number" min="0" step="1" value="${sale.photo_count}" id="edit-count-${sale.id}" /></td>
        <td data-label="Birim Fiyat"><input class="inline-input" type="number" min="0" step="0.01" value="${sale.unit_price}" id="edit-price-${sale.id}" /></td>
        <td data-label="Toplam">${currencyFormatter.format(sale.total_price)}</td>
        ${actionsCell}
      `;

      row.querySelector(".save-btn").addEventListener("click", async () => {
        await saveInlineEdit(sale.id);
      });
      row.querySelector(".cancel-btn").addEventListener("click", cancelInlineEdit);
      salesTableBody.appendChild(row);
      return;
    }

    const actionsCell =
      currentUser?.role === "owner"
        ? `
      <td class="actions-cell" data-label="İşlem">
        <button class="table-btn edit-btn" data-id="${sale.id}">Düzenle</button>
        <button class="table-btn delete-btn" data-id="${sale.id}">Sil</button>
      </td>
    `
        : "";

    row.innerHTML = `
      <td data-label="Satışı Giren">${sale.seller_name || sale.seller_username || "-"}</td>
      <td data-label="Tarih">${formatSaleDate(sale.sale_date)}</td>
      <td data-label="Kayıt Zamanı">${formatDateTime(sale.created_at)}</td>
      <td data-label="Adet">${sale.photo_count}</td>
      <td data-label="Birim Fiyat">${currencyFormatter.format(sale.unit_price)}</td>
      <td data-label="Toplam">${currencyFormatter.format(sale.total_price)}</td>
      ${actionsCell}
    `;

    if (currentUser?.role === "owner") {
      row.querySelector(".edit-btn").addEventListener("click", () => startInlineEdit(sale.id));
      row.querySelector(".delete-btn").addEventListener("click", () => deleteSale(sale.id));
    }

    salesTableBody.appendChild(row);
  });
}

function startInlineEdit(saleId) {
  editingSaleId = saleId;
  renderTable(currentSalesData);
}

function cancelInlineEdit() {
  editingSaleId = null;
  renderTable(currentSalesData);
}

async function saveInlineEdit(saleId) {
  const saleDate = document.getElementById(`edit-date-${saleId}`)?.value;
  const photoCount = Number(document.getElementById(`edit-count-${saleId}`)?.value || 0);
  const unitPrice = Number(document.getElementById(`edit-price-${saleId}`)?.value || 0);

  await fetch(`/api/sales/${saleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sale_date: saleDate,
      photo_count: photoCount,
      unit_price: unitPrice,
    }),
  });

  editingSaleId = null;
  await loadSales();
}

function closeProfileDropdown() {
  profileDropdown.classList.add("hidden");
  profileToggleBtn.setAttribute("aria-expanded", "false");
}

function toggleProfileDropdown() {
  const willOpen = profileDropdown.classList.contains("hidden");
  profileDropdown.classList.toggle("hidden", !willOpen);
  profileToggleBtn.setAttribute("aria-expanded", String(willOpen));
}

function openDeleteModal(saleId) {
  pendingDeleteSaleId = saleId;
  deleteModal.classList.remove("hidden");
}

function closeDeleteModal() {
  pendingDeleteSaleId = null;
  deleteModal.classList.add("hidden");
}

async function loadSales() {
  const response = await fetch("/api/sales");
  if (response.status === 401) {
    showLoginView();
    return;
  }
  if (response.status === 403) {
    return;
  }
  const data = await response.json();
  currentSalesPage = 1;
  renderTable(data.sales);
  if (currentUser?.role === "worker") {
    renderSummary(data.summary);
    workerCompensationDateLabelElement.textContent = `${formatDateLabel(data.today_date)} günü için`;
    renderCompensation(data.compensation);
    renderDailyHistory(data.daily_history, data.today_date);
  } else if (currentUser?.role === "owner") {
    await loadOwnerSummaryCards();
    ownerDateFilterInput.value = data.today_date;
    await loadOwnerDailyEarnings(data.today_date);
  }
}

async function fetchOwnerSummary(userId = "") {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
  const response = await fetch(`/api/owner/summary${query}`);
  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function loadOwnerSummaryCards() {
  const metrics = [
    { key: "today" },
    { key: "month" },
    { key: "grand" },
    { key: "photos" },
  ];

  const results = await Promise.all(
    metrics.map(({ key }) => fetchOwnerSummary(ownerSummarySelections[key])),
  );
  const firstResult = results.find(Boolean);
  if (!firstResult) {
    return;
  }

  renderOwnerSummaryUsers(firstResult.users);

  results.forEach((data, index) => {
    if (!data) {
      return;
    }

    const metric = metrics[index].key;
    ownerSummarySelections[metric] = data.selected_user_id ? String(data.selected_user_id) : "";
    renderOwnerSummaryMetric(metric, data.summary);
  });
}

async function loadOwnerDailyEarnings(dateValue) {
  const response = await fetch(`/api/owner/daily-earnings?sale_date=${encodeURIComponent(dateValue)}`);
  if (!response.ok) {
    return;
  }

  const data = await response.json();
  ownerDateFilterInput.value = data.selected_date;

  if (!data.workers.some((worker) => worker.user_id === selectedOwnerWorkerId)) {
    selectedOwnerWorkerId = data.workers[0]?.user_id ?? null;
  }

  renderOwnerDailyEarnings(data.workers);

  if (selectedOwnerWorkerId) {
    await loadOwnerWorkerHistory(selectedOwnerWorkerId);
  } else {
    ownerWorkerDetailElement.classList.add("hidden");
  }
}

async function loadOwnerWorkerHistory(userId) {
  const response = await fetch(`/api/owner/worker-daily-history/${userId}`);
  if (!response.ok) {
    return;
  }

  const data = await response.json();
  renderOwnerWorkerHistory(data.worker, data.history);
}

async function loadRoles() {
  const response = await fetch("/api/roles");
  if (response.status === 401) {
    showLoginView();
    return;
  }
  if (response.status === 403) {
    return;
  }
  const data = await response.json();
  renderCurrentUser(data.current_user);
}

async function handleLogin(event) {
  event.preventDefault();
  setLoginError("");

  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: usernameInput.value.trim(),
      password: passwordInput.value,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    setLoginError(errorData.detail || "Giriş yapılamadı");
    return;
  }

  const data = await response.json();
  renderCurrentUser(data.user);
  loginForm.reset();
  showAppView();
  await loadRoles();
  await loadSales();
}

async function handleLogout() {
  await fetch("/api/logout", { method: "POST" });
  currentUser = null;
  closeProfileDropdown();
  showLoginView();
}

async function restoreSession() {
  const response = await fetch("/api/session");
  if (!response.ok) {
    showLoginView();
    return;
  }

  const data = await response.json();
  renderCurrentUser(data.user);
  showAppView();
  await loadRoles();
  await loadSales();
}

async function saveSale(event) {
  event.preventDefault();

  const payload = {
    sale_date: saleDateInput.value,
    photo_count: Number(photoCountInput.value),
    unit_price: getSelectedUnitPrice(),
  };

  await fetch("/api/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  resetForm();
  await loadSales();
}

async function deleteSale(saleId) {
  openDeleteModal(saleId);
}

async function confirmDeleteSale() {
  if (!pendingDeleteSaleId) {
    return;
  }

  await fetch(`/api/sales/${pendingDeleteSaleId}`, { method: "DELETE" });
  closeDeleteModal();
  await loadSales();
}

resetForm();
loginForm.addEventListener("submit", handleLogin);
saleForm.addEventListener("submit", saveSale);
photoCountInput.addEventListener("input", calculateTotal);
unitPriceInput.addEventListener("input", calculateTotal);
logoutBtn.addEventListener("click", handleLogout);
deleteModalCancelBtn.addEventListener("click", closeDeleteModal);
deleteModalConfirmBtn.addEventListener("click", confirmDeleteSale);
ownerDateFilterInput.addEventListener("change", async (event) => {
  selectedOwnerWorkerId = null;
  ownerHistoryExpanded = false;
  await loadOwnerDailyEarnings(event.target.value);
});
todaySummaryUserFilter.addEventListener("change", async (event) => {
  ownerSummarySelections.today = event.target.value;
  const data = await fetchOwnerSummary(ownerSummarySelections.today);
  if (data) {
    renderOwnerSummaryMetric("today", data.summary);
  }
});
monthSummaryUserFilter.addEventListener("change", async (event) => {
  ownerSummarySelections.month = event.target.value;
  const data = await fetchOwnerSummary(ownerSummarySelections.month);
  if (data) {
    renderOwnerSummaryMetric("month", data.summary);
  }
});
grandSummaryUserFilter.addEventListener("change", async (event) => {
  ownerSummarySelections.grand = event.target.value;
  const data = await fetchOwnerSummary(ownerSummarySelections.grand);
  if (data) {
    renderOwnerSummaryMetric("grand", data.summary);
  }
});
totalPhotosSummaryUserFilter.addEventListener("change", async (event) => {
  ownerSummarySelections.photos = event.target.value;
  const data = await fetchOwnerSummary(ownerSummarySelections.photos);
  if (data) {
    renderOwnerSummaryMetric("photos", data.summary);
  }
});
workerHistoryToggleElement.addEventListener("click", () => {
  workerHistoryExpanded = !workerHistoryExpanded;
  loadSales();
});
ownerHistoryToggleElement.addEventListener("click", async () => {
  ownerHistoryExpanded = !ownerHistoryExpanded;
  if (selectedOwnerWorkerId) {
    await loadOwnerWorkerHistory(selectedOwnerWorkerId);
  }
});
profileToggleBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleProfileDropdown();
});
document.addEventListener("click", (event) => {
  if (!profileDropdown.classList.contains("hidden") && !event.target.closest(".profile-menu")) {
    closeProfileDropdown();
  }
});
deleteModal.addEventListener("click", (event) => {
  if (event.target === deleteModal) {
    closeDeleteModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !deleteModal.classList.contains("hidden")) {
    closeDeleteModal();
  }
});
prevPageBtn.addEventListener("click", () => {
  if (currentSalesPage > 1) {
    currentSalesPage -= 1;
    renderTable(currentSalesData);
  }
});
nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(currentSalesData.length / SALES_PAGE_SIZE));
  if (currentSalesPage < totalPages) {
    currentSalesPage += 1;
    renderTable(currentSalesData);
  }
});
priceOptionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button === customPriceBtn) {
      enableCustomPrice();
      unitPriceInput.focus();
      return;
    }

    selectFixedPrice(Number(button.dataset.price));
  });
});

restoreSession();
