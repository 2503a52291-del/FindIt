
// =============================================
// FINDIT - COMPLETE ADMIN DASHBOARD JAVASCRIPT
// =============================================

const ADMIN_API = "http://localhost:5000/api/admin";
const AUTH_API = "http://localhost:5000/api/auth";
const REPORT_API = "http://localhost:5000/api/reports";
const MATCHES_API = "http://localhost:5000/api/admin/matches";

const token = sessionStorage.getItem("finditToken");
let currentAdmin = null;

// =============================================
// HELPERS
// =============================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function showMessage(message, isError = false) {
    const element = document.getElementById("adminMessage");
    if (!element) return;

    element.hidden = false;
    element.textContent = message;
    element.style.background = isError ? "#fee2e2" : "#dcfce7";
    element.style.color = isError ? "#991b1b" : "#166534";
}

function getPersonName(person) {
    if (!person) return "Unknown";
    if (typeof person === "string") return person;
    return person.name || person.email || "Unknown";
}

function getReportName(report) {
    if (!report) return "Unknown";
    if (typeof report === "string") return report;
    return report.name || report.description || "Unknown";
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("finditToken");
        sessionStorage.removeItem("finditUser");

        alert("Admin access is required. Please login again.");
        window.location.href = "index.html";

        throw new Error("Admin access denied.");
    }

    if (!response.ok) {
        throw new Error(data.message || data.error || "Request failed.");
    }

    return data;
}

// =============================================
// CHECK ADMIN SESSION
// =============================================

function checkAdminSession() {
    if (!token) {
        alert("Please login first.");
        window.location.href = "index.html";
        return false;
    }

    try {
        currentAdmin = JSON.parse(
            sessionStorage.getItem("finditUser") || "null"
        );

        if (!currentAdmin || currentAdmin.isAdmin !== true) {
            alert("You do not have admin access.");
            window.location.href = "index.html";
            return false;
        }

        return true;

    } catch {
        window.location.href = "index.html";
        return false;
    }
}

// =============================================
// LOAD COMPLETE DASHBOARD
// =============================================

async function loadDashboard() {
    try {
        showMessage("Loading dashboard...");

        await Promise.all([
            loadStats(),
            loadUsers(),
            loadReports(),
            loadMatches(),
            loadClaims()
        ]);

        showMessage("Dashboard updated successfully.");

    } catch (error) {
        console.error("Dashboard error:", error);
        showMessage(error.message, true);
    }
}

// =============================================
// 1. DASHBOARD STATISTICS
// =============================================

async function loadStats() {
    const data = await apiRequest(`${ADMIN_API}/dashboard`);

    document.getElementById("totalUsers").textContent =
        data.totalUsers ?? 0;

    document.getElementById("totalLost").textContent =
        data.totalLost ?? 0;

    document.getElementById("totalFound").textContent =
        data.totalFound ?? 0;

    document.getElementById("totalClaims").textContent =
        data.totalClaims ?? 0;

    document.getElementById("pendingClaims").textContent =
        data.pendingClaims ?? 0;

    document.getElementById("returnedItems").textContent =
        data.returnedItems ?? 0;
}

// =============================================
// 2. LOAD USERS
// =============================================

async function loadUsers() {
    const data = await apiRequest(`${ADMIN_API}/users`);
    const users = data.users || [];

    const table = document.getElementById("usersTable");

    if (!table) return;

    if (!users.length) {
        table.innerHTML = `
            <tr>
                <td colspan="4">No users registered yet.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = users.map(user => `
        <tr>
            <td>${escapeHTML(user.name)}</td>
            <td>${escapeHTML(user.email)}</td>
            <td>${escapeHTML(user.phone || "Not provided")}</td>
            <td>
                ${user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "—"}
            </td>
        </tr>
    `).join("");
}

// =============================================
// 3. LOAD ALL REPORTS
// =============================================

async function loadReports() {
    const data = await apiRequest(`${ADMIN_API}/reports`);
    const reports = data.reports || [];

    const table = document.getElementById("reportsTable");

    if (!table) return;

    if (!reports.length) {
        table.innerHTML = `
            <tr>
                <td colspan="7">No reports found.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = reports.map(report => {
        const reporterName = getPersonName(report.reportedBy);
        const status = report.status || "Unclaimed";

        return `
            <tr>
                <td>${escapeHTML(report.name)}</td>
                <td>${escapeHTML(report.type)}</td>
                <td>${escapeHTML(report.category)}</td>
                <td>${escapeHTML(report.location)}</td>
                <td>${escapeHTML(reporterName)}</td>
                <td>${escapeHTML(status)}</td>
                <td>
                    <select
                        class="status-select"
                        data-report-id="${escapeHTML(report._id)}">

                        ${["Pending", "Claimed", "Unclaimed", "Returned"]
                            .map(option => `
                                <option
                                    value="${option}"
                                    ${status === option ? "selected" : ""}
                                    ${option === "Returned" && status !== "Returned"
                                        ? "disabled"
                                        : ""}>
                                    ${option}
                                </option>
                            `).join("")}

                    </select>

                    <button
                        class="admin-btn update-status-btn"
                        data-report-id="${escapeHTML(report._id)}">
                        Update
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// =============================================
// 4. LOAD POSSIBLE MATCHES
// =============================================

async function loadMatches() {
    const container = document.getElementById("matchesContainer");

    if (!container) return;

    const data = await apiRequest(MATCHES_API);
    const matches = data.matches || [];

    if (!matches.length) {
        container.innerHTML = `
            <p>No possible matches found yet.</p>
            <p>
                Matches will appear when similar Lost and Found
                reports are available.
            </p>
        `;
        return;
    }

    container.innerHTML = matches.map(match => {
        const lost = match.lostItem || {};
        const found = match.foundItem || {};

        return `
            <div class="admin-match">

                <h3>Possible Match</h3>

                <p>
                    <strong>Lost Item:</strong>
                    ${escapeHTML(getReportName(lost))}
                </p>

                <p>
                    <strong>Lost Location:</strong>
                    ${escapeHTML(lost.location || "Not specified")}
                </p>

                <p>
                    <strong>Found Item:</strong>
                    ${escapeHTML(getReportName(found))}
                </p>

                <p>
                    <strong>Found Location:</strong>
                    ${escapeHTML(found.location || "Not specified")}
                </p>

                <span class="match-score">
                    Match Score:
                    ${escapeHTML(match.matchScore ?? 0)}%
                </span>

            </div>
        `;
    }).join("");
}

// =============================================
// 5. LOAD OWNERSHIP CLAIMS
// =============================================

async function loadClaims() {
    const data = await apiRequest(`${ADMIN_API}/claims`);
    const claims = data.claims || [];

    const table = document.getElementById("claimsTable");

    if (!table) return;

    if (!claims.length) {
        table.innerHTML = `
            <tr>
                <td colspan="7">
                    No ownership claims submitted yet.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = claims.map(claim => {
        const claimant = getPersonName(claim.claimant);
        const lostName = getReportName(claim.lostReport);
        const foundName = getReportName(claim.foundReport);
        const status = claim.status || "Pending";

        const foundStatus = claim.foundReport?.status || "";

        let actionHTML = "Reviewed";

        if (status === "Pending") {
            actionHTML = `
                <div class="admin-actions">

                    <button
                        class="approve-btn review-claim-btn"
                        data-claim-id="${escapeHTML(claim._id)}"
                        data-decision="Approved">
                        Approve
                    </button>

                    <button
                        class="reject-btn review-claim-btn"
                        data-claim-id="${escapeHTML(claim._id)}"
                        data-decision="Rejected">
                        Reject
                    </button>

                </div>
            `;
        }

        if (status === "Approved" && foundStatus === "Claimed") {
            actionHTML = `
                <button
                    class="admin-btn return-item-btn"
                    data-claim-id="${escapeHTML(claim._id)}">
                    Mark as Returned
                </button>
            `;
        }

        if (status === "Approved" && foundStatus === "Returned") {
            actionHTML = `
                <span class="returned-label">
                    Item Returned
                </span>
            `;
        }

        return `
            <tr>

                <td>${escapeHTML(claimant)}</td>

                <td>${escapeHTML(lostName)}</td>

                <td>${escapeHTML(foundName)}</td>

                <td>${escapeHTML(claim.reason || "")}</td>

                <td>${escapeHTML(status)}</td>

                <td>
                    <input
                        type="text"
                        class="admin-note-input"
                        data-claim-id="${escapeHTML(claim._id)}"
                        placeholder="Optional note"
                        value="${escapeHTML(claim.adminNote || "")}"
                        ${status !== "Pending" ? "disabled" : ""}>
                </td>

                <td>
                    ${actionHTML}
                </td>

            </tr>
        `;
    }).join("");
}

// =============================================
// 6. UPDATE REPORT STATUS
// =============================================

document.addEventListener("click", async event => {
    const button = event.target.closest(".update-status-btn");

    if (!button) return;

    const reportId = button.dataset.reportId;

    const select = document.querySelector(
        `.status-select[data-report-id="${reportId}"]`
    );

    if (!select) return;

    try {
        button.disabled = true;

        await apiRequest(
            `${ADMIN_API}/reports/${reportId}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    status: select.value
                })
            }
        );

        showMessage("Report status updated successfully.");

        await Promise.all([
            loadReports(),
            loadStats()
        ]);

    } catch (error) {
        showMessage(error.message, true);

    } finally {
        button.disabled = false;
    }
});

// =============================================
// 7. APPROVE OR REJECT CLAIM
// =============================================

document.addEventListener("click", async event => {
    const button = event.target.closest(".review-claim-btn");

    if (!button) return;

    const claimId = button.dataset.claimId;
    const decision = button.dataset.decision;

    const noteInput = document.querySelector(
        `.admin-note-input[data-claim-id="${claimId}"]`
    );

    const adminNote = noteInput
        ? noteInput.value.trim()
        : "";

    const confirmed = confirm(
        `Are you sure you want to ${decision.toLowerCase()} this claim?`
    );

    if (!confirmed) return;

    try {
        button.disabled = true;

        await apiRequest(
            `${ADMIN_API}/claims/${claimId}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    decision,
                    adminNote
                })
            }
        );

        showMessage(
            `Claim ${decision.toLowerCase()} successfully.`
        );

        await Promise.all([
            loadClaims(),
            loadReports(),
            loadStats(),
            loadMatches()
        ]);

    } catch (error) {
        showMessage(error.message, true);

    } finally {
        button.disabled = false;
    }
});

// =============================================
// 8. MARK APPROVED CLAIM AS RETURNED
// =============================================

document.addEventListener("click", async event => {
    const button = event.target.closest(".return-item-btn");

    if (!button) return;

    const claimId = button.dataset.claimId;

    const confirmed = confirm(
        "Confirm that the item has actually been returned to its owner?"
    );

    if (!confirmed) return;

    try {
        button.disabled = true;
        button.textContent = "Processing...";

        await apiRequest(
            `${ADMIN_API}/claims/${claimId}/return`,
            {
                method: "PATCH"
            }
        );

        showMessage(
            "Item marked as returned successfully. Both users have been notified."
        );

        await Promise.all([
            loadClaims(),
            loadReports(),
            loadStats(),
            loadMatches()
        ]);

    } catch (error) {
        showMessage(error.message, true);

    } finally {
        button.disabled = false;
        button.textContent = "Mark as Returned";
    }
});

// =============================================
// 9. EXPORT CSV
// =============================================

document.addEventListener("click", async event => {
    const button = event.target.closest("[data-export]");

    if (!button) return;

    const type = button.dataset.export;

    try {
        button.disabled = true;

        const response = await fetch(
            `${ADMIN_API}/export/${type}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                "Could not export data. Check admin access."
            );
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = `findit-${type}.csv`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        showMessage(`${type} CSV exported successfully.`);

    } catch (error) {
        showMessage(error.message, true);

    } finally {
        button.disabled = false;
    }
});

// =============================================
// 10. REFRESH DASHBOARD
// =============================================

const refreshButton = document.getElementById("refreshBtn");

if (refreshButton) {
    refreshButton.addEventListener("click", loadDashboard);
}

// =============================================
// 11. ADMIN LOGOUT
// =============================================

const logoutButton = document.getElementById("logoutBtn");

if (logoutButton) {
    logoutButton.addEventListener("click", () => {
        sessionStorage.removeItem("finditToken");
        sessionStorage.removeItem("finditUser");

        window.location.href = "index.html";
    });
}

// =============================================
// INITIALIZE ADMIN DASHBOARD
// =============================================

if (checkAdminSession()) {
    loadDashboard();
}
