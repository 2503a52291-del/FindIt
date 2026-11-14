
const API = "http://localhost:5000/api";

const token = sessionStorage.getItem("finditToken");

let currentUser = null;
let myReports = [];
let matches = [];

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showMessage(message, isError = false) {
    const element = document.getElementById("pageMessage");

    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#dc3545" : "#198754";
}

async function apiRequest(url, options = {}) {
    const response = await fetch(`${API}${url}`, {
        ...options,
        headers: {
            ...authHeaders(),
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || data.error || "Request failed.");
    }

    return data;
}

function logout() {
    sessionStorage.removeItem("finditToken");
    sessionStorage.removeItem("finditUser");
    window.location.href = "index.html";
}

function getDate(value) {
    if (!value) return "Not specified";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? escapeHTML(value)
        : date.toLocaleDateString("en-IN");
}

function getId(value) {
    return value?._id || value;
}

// =============================================
// REPORT CARD
// =============================================

function reportCard(report) {
    return `
        <article class="report-card">

            <h3>${escapeHTML(report.name)}</h3>

            <p><strong>Type:</strong> ${escapeHTML(report.type)}</p>

            <p><strong>Category:</strong> ${escapeHTML(report.category)}</p>

            <p><strong>Description:</strong>
                ${escapeHTML(report.description)}
            </p>

            <p><strong>Location:</strong>
                ${escapeHTML(report.location)}
            </p>

            <p><strong>Date:</strong> ${getDate(report.date)}</p>

            <p><strong>Transport:</strong>
                ${escapeHTML(report.transport || "Not specified")}
            </p>

            <p><strong>Status:</strong>
                <span class="status-text">
                    ${escapeHTML(report.status || "Pending")}
                </span>
            </p>

            <div class="report-actions">

                <button class="edit-action"
                    onclick="editReport('${report._id}')">
                    Edit
                </button>

                <button class="delete-action"
                    onclick="deleteReport('${report._id}')">
                    Delete
                </button>

            </div>

        </article>
    `;
}

// =============================================
// LOAD CURRENT USER
// =============================================

async function loadCurrentUser() {
    const storedUser = JSON.parse(
        sessionStorage.getItem("finditUser") || "null"
    );

    if (storedUser) {
        currentUser = storedUser;

        document.getElementById("userName").textContent =
            currentUser.name || "Passenger";
    }

    try {
        const data = await apiRequest("/auth/me");

        currentUser = data.user || data;

        sessionStorage.setItem(
            "finditUser",
            JSON.stringify(currentUser)
        );

        document.getElementById("userName").textContent =
            currentUser.name || "Passenger";

    } catch (error) {

        if (!currentUser) {
            showMessage(
                "Please log in to access your dashboard.",
                true
            );

            setTimeout(logout, 1200);

            throw error;
        }
    }

    if (currentUser?.isAdmin) {
        window.location.href = "admin.html";
    }
}

// =============================================
// SUBMIT LOST / FOUND REPORT
// =============================================

async function submitReport(event, type) {
    event.preventDefault();

    const prefix = type === "Lost" ? "lost" : "found";

    const report = {
        name: document.getElementById(`${prefix}Name`).value.trim(),
        type,
        category: document.getElementById(`${prefix}Category`).value,
        description: document.getElementById(`${prefix}Description`).value.trim(),
        location: document.getElementById(`${prefix}Location`).value.trim(),
        date: document.getElementById(`${prefix}Date`).value,
        transport: document.getElementById(`${prefix}Transport`).value.trim()
    };

    try {
        await apiRequest("/reports", {
            method: "POST",
            body: JSON.stringify(report)
        });

        event.target.reset();

        showMessage(`${type} report submitted successfully.`);

        await refreshDashboard();

    } catch (error) {
        showMessage(error.message, true);
    }
}

// =============================================
// LOAD MY REPORTS
// =============================================

async function loadMyReports() {
    const data = await apiRequest("/reports/my");

    myReports = data.reports || [];

    const lost = myReports.filter(
        report => report.type === "Lost"
    );

    const found = myReports.filter(
        report => report.type === "Found"
    );

    document.getElementById("myLostReports").innerHTML =
        lost.length
            ? lost.map(reportCard).join("")
            : '<p class="empty-message">You have not submitted any lost reports.</p>';

    document.getElementById("myFoundReports").innerHTML =
        found.length
            ? found.map(reportCard).join("")
            : '<p class="empty-message">You have not submitted any found reports.</p>';
}

// =============================================
// EDIT REPORT
// =============================================

async function editReport(id) {
    const report = myReports.find(item => item._id === id);

    if (!report) return;

    if (["Claimed", "Returned"].includes(report.status)) {
        alert(
            "This report cannot be edited because it has already been claimed or returned."
        );

        return;
    }

    const name = prompt("Enter item name:", report.name);
    if (name === null) return;

    const category = prompt("Enter category:", report.category);
    if (category === null) return;

    const description = prompt(
        "Enter description:",
        report.description
    );

    if (description === null) return;

    const location = prompt("Enter location:", report.location);
    if (location === null) return;

    const date = prompt(
        "Enter date (YYYY-MM-DD):",
        String(report.date || "").slice(0, 10)
    );

    if (date === null) return;

    const transport = prompt(
        "Enter transport:",
        report.transport || ""
    );

    if (transport === null) return;

    if (
        !name.trim() ||
        !category.trim() ||
        !description.trim() ||
        !location.trim() ||
        !date.trim()
    ) {
        alert("Please fill in all required fields.");
        return;
    }

    try {
        await apiRequest(`/reports/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
                name: name.trim(),
                category: category.trim(),
                description: description.trim(),
                location: location.trim(),
                date,
                transport: transport.trim()
            })
        });

        showMessage("Report updated successfully.");

        await refreshDashboard();

    } catch (error) {
        showMessage(error.message, true);
    }
}

// =============================================
// DELETE REPORT
// =============================================

async function deleteReport(id) {
    const report = myReports.find(item => item._id === id);

    if (!report) return;

    if (
        !confirm(
            `Are you sure you want to delete your ${report.type.toLowerCase()} report "${report.name}"?`
        )
    ) {
        return;
    }

    try {
        await apiRequest(`/reports/${id}`, {
            method: "DELETE"
        });

        showMessage("Report deleted successfully.");

        await refreshDashboard();

    } catch (error) {
        showMessage(error.message, true);
    }
}

// =============================================
// LOAD POSSIBLE MATCHES
// =============================================

async function loadMatches() {
    const container = document.getElementById("userMatches");

    try {
        const data = await apiRequest("/matches");

        matches = data.matches || [];

        if (!matches.length) {
            container.innerHTML =
                '<p class="empty-message">No possible matches found yet.</p>';

            return;
        }

        container.innerHTML = matches.map(match => {

            const lost = match.lostItem || {};
            const found = match.foundItem || {};

            const lostOwner = getId(lost.reportedBy);

            const currentUserId =
                currentUser?._id || currentUser?.id;

            const isMyLostReport =
                currentUser &&
                String(lostOwner) === String(currentUserId);

            return `
                <article class="match-card"
                    id="match-${lost._id}-${found._id}">

                    <h3>
                        🎯 Possible Match — ${Number(match.matchScore || 0)}%
                    </h3>

                    <p><strong>Lost item:</strong>
                        ${escapeHTML(lost.name)}
                    </p>

                    <p><strong>Lost location:</strong>
                        ${escapeHTML(lost.location)}
                    </p>

                    <hr>

                    <p><strong>Found item:</strong>
                        ${escapeHTML(found.name)}
                    </p>

                    <p><strong>Found location:</strong>
                        ${escapeHTML(found.location)}
                    </p>

                    <p><strong>Category:</strong>
                        ${escapeHTML(found.category)}
                    </p>

                    <p>Verify the item carefully before claiming it.</p>

                    ${isMyLostReport ? `
                        <button class="claim-action"
                            onclick="submitClaim('${lost._id}','${found._id}')">

                            Submit Ownership Claim

                        </button>
                    ` : ""}

                </article>
            `;

        }).join("");

    } catch (error) {

        container.innerHTML =
            `<p class="empty-message">${escapeHTML(error.message)}</p>`;
    }
}

// =============================================
// VIEW EXACT MATCH FROM NOTIFICATION
// =============================================

async function viewMatchingItem(
    lostId,
    foundId,
    notificationId
) {
    try {

        // Ensure matches are loaded.
        if (!matches.length) {
            await loadMatches();
        }

        const matchingItem = matches.find(match =>
            String(match.lostItem?._id) === String(lostId) &&
            String(match.foundItem?._id) === String(foundId)
        );

        if (!matchingItem) {
            showMessage(
                "This matching item is no longer available.",
                true
            );

            return;
        }

        // Open the Possible Matches section.
        const matchCard = document.getElementById(
            `match-${lostId}-${foundId}`
        );

        if (!matchCard) {
            showMessage(
                "Unable to display this matching item.",
                true
            );

            return;
        }

        // Scroll to the exact matching pair.
        matchCard.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        // Highlight the matching pair.
        matchCard.style.outline = "3px solid #198754";
        matchCard.style.outlineOffset = "4px";

        setTimeout(() => {
            matchCard.style.outline = "";
            matchCard.style.outlineOffset = "";
        }, 3000);

        // Mark notification as read.
        await markNotificationRead(notificationId);

    } catch (error) {
        showMessage(error.message, true);
    }
}

// =============================================
// SUBMIT OWNERSHIP CLAIM
// =============================================

async function submitClaim(lostId, foundId) {

    const reason = prompt(
        "Explain how you can identify this item as yours:"
    );

    if (reason === null || !reason.trim()) return;

    try {

        await apiRequest("/claims", {
            method: "POST",

            body: JSON.stringify({
                lostReportId: lostId,
                foundReportId: foundId,
                reason: reason.trim()
            })
        });

        showMessage(
            "Ownership claim submitted. The admin will review it."
        );

        await loadClaims();

        await loadNotifications();

    } catch (error) {
        showMessage(error.message, true);
    }
}

// =============================================
// LOAD MY CLAIMS
// =============================================

async function loadClaims() {
    const container = document.getElementById("userClaims");

    try {

        const data = await apiRequest("/claims/my");

        const claims = data.claims || [];

        container.innerHTML = claims.length

            ? claims.map(claim => `

                <article class="report-card">

                    <p><strong>Claim status:</strong>
                        ${escapeHTML(claim.status)}
                    </p>

                    <p><strong>Reason:</strong>
                        ${escapeHTML(claim.reason)}
                    </p>

                    <p><strong>Admin note:</strong>
                        ${escapeHTML(claim.adminNote || "No note yet")}
                    </p>

                    <p><strong>Submitted:</strong>
                        ${getDate(claim.createdAt)}
                    </p>

                </article>

            `).join("")

            : '<p class="empty-message">You have not submitted any claims.</p>';

    } catch (error) {

        container.innerHTML =
            `<p class="empty-message">${escapeHTML(error.message)}</p>`;
    }
}

// =============================================
// LOAD NOTIFICATIONS
// =============================================

async function loadNotifications() {

    const container = document.getElementById("userNotifications");

    try {

        const data = await apiRequest("/notifications");

        const notifications = data.notifications || [];

        container.innerHTML = notifications.length

            ? notifications.map(notification => `

                <article class="notification-card ${notification.read ? "" : "unread"}">

                    <h3>
                        ${escapeHTML(notification.title || "Notification")}
                    </h3>

                    <p>
                        ${escapeHTML(
                            notification.message ||
                            "You have an update."
                        )}
                    </p>

                    <small>
                        ${getDate(notification.createdAt)}
                    </small>

                    ${
                        notification.type === "Match" &&
                        notification.relatedLostReport &&
                        notification.relatedFoundReport
                        ? `

                            <button class="primary-action"
                                onclick="viewMatchingItem(
                                    '${notification.relatedLostReport}',
                                    '${notification.relatedFoundReport}',
                                    '${notification._id}'
                                )">

                                View Matching Item

                            </button>

                        `
                        : ""
                    }

                    ${!notification.read ? `

                        <button class="primary-action"
                            onclick="markNotificationRead('${notification._id}')">

                            Mark as Read

                        </button>

                    ` : "<p>Read</p>"}

                </article>

            `).join("")

            : '<p class="empty-message">No notifications yet.</p>';

    } catch (error) {

        container.innerHTML =
            `<p class="empty-message">${escapeHTML(error.message)}</p>`;
    }
}

// =============================================
// MARK NOTIFICATION AS READ
// =============================================

async function markNotificationRead(id) {

    try {

        await apiRequest(`/notifications/${id}/read`, {
            method: "PATCH"
        });

        await loadNotifications();

    } catch (error) {

        showMessage(error.message, true);
    }
}

// =============================================
// REFRESH DASHBOARD
// =============================================

async function refreshDashboard() {

    try {

        await loadMyReports();

    } catch (error) {

        showMessage(error.message, true);
    }

    await Promise.all([
        loadMatches(),
        loadClaims(),
        loadNotifications()
    ]);
}

// =============================================
// EVENT LISTENERS
// =============================================

document.getElementById("logoutButton")
    .addEventListener("click", logout);

document.getElementById("lostForm")
    .addEventListener("submit", event => {
        submitReport(event, "Lost");
    });

document.getElementById("foundForm")
    .addEventListener("submit", event => {
        submitReport(event, "Found");
    });

// =============================================
// INITIALIZE DASHBOARD
// =============================================

async function initializeDashboard() {

    if (!token) {

        alert("Please log in first.");

        window.location.href = "index.html";

        return;
    }

    try {

        await loadCurrentUser();

        await refreshDashboard();

    } catch (error) {

        console.error(
            "Dashboard initialization:",
            error
        );
    }
}

initializeDashboard();
