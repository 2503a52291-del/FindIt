
 // =====================================================
 // FINDIT - COMPLETE FRONTEND JAVASCRIPT
 // =====================================================

 // API URLS
 const API_URL = "http://localhost:5000/api/reports";
 const MATCHES_URL = "http://localhost:5000/api/matches";
 const AUTH_URL = "http://localhost:5000/api/auth";

 // SESSION STORAGE KEYS
 const USER_KEY = "finditUser";
 const TOKEN_KEY = "finditToken";

 let reports = [];
 let matches = [];


 // =====================================================
 // 1. COMMON HELPERS
 // =====================================================

 function getElement(id) {
     return document.getElementById(id);
 }

 function getCurrentUser() {
     try {
         return JSON.parse(sessionStorage.getItem(USER_KEY));
     } catch {
         return null;
     }
 }

 function getToken() {
     return sessionStorage.getItem(TOKEN_KEY);
 }

 function getAuthHeaders() {
     const token = getToken();

     return token
         ? { Authorization: `Bearer ${token}` }
         : {};
 }

 function escapeHTML(value) {
     return String(value ?? "").replace(/[&<>"']/g, character => {
         const entities = {
             "&": "&amp;",
             "<": "&lt;",
             ">": "&gt;",
             '"': "&quot;",
             "'": "&#39;"
         };

         return entities[character];
     });
 }

 function formatDate(dateValue) {
     if (!dateValue) return "Date not provided";

     const date = new Date(dateValue);

     if (Number.isNaN(date.getTime())) {
         return escapeHTML(dateValue);
     }

     return date.toLocaleDateString("en-IN");
 }

 async function readResponse(response) {
     let data = {};

     try {
         data = await response.json();
     } catch {
         data = {};
     }

     if (!response.ok) {
         throw new Error(data.message || "Something went wrong.");
     }

     return data;
 }


 // =====================================================
 // 2. AUTHENTICATION BUTTON
 // =====================================================

 function updateAuthButton() {
     const user = getCurrentUser();
     const loginButton = document.querySelector(".login-btn");

     if (!loginButton) return;

     if (user) {
         loginButton.textContent = "Logout";
         loginButton.onclick = logoutUser;
     } else {
         loginButton.textContent = "Login / Register";
         loginButton.onclick = showLogin;
     }
 }

 function logoutUser() {
     sessionStorage.removeItem(USER_KEY);
     sessionStorage.removeItem(TOKEN_KEY);

     updateAuthButton();

     window.location.href = "index.html";
 }


 // =====================================================
 // 3. LOGIN MODAL
 // =====================================================

 function openAuthModal() {
     const modal = getElement("authModal");

     if (!modal) {
         console.error("Login modal not found: #authModal");
         return;
     }

     modal.hidden = false;
     modal.style.display = "flex";

     showAuthMessage("");
 }

 function hideAllAuthForms() {
     const formIds = [
         "loginChoice",
         "loginForm",
         "registerForm",
         "adminLoginForm"
     ];

     formIds.forEach(id => {
         const element = getElement(id);

         if (element) {
             element.hidden = true;
         }
     });
 }

 function setAuthSubtitle(message) {
     const subtitle = getElement("authSubtitle");

     if (subtitle) {
         subtitle.textContent = message;
     }
 }

 function showAuthMessage(message, isError = false) {
     const messageElement = getElement("authMessage");

     if (!messageElement) return;

     messageElement.textContent = message;
     messageElement.style.color = isError ? "#dc2626" : "#15803d";
 }

 function showLogin() {
     openAuthModal();
     hideAllAuthForms();

     const choice = getElement("loginChoice");

     if (choice) {
         choice.hidden = false;
     }

     setAuthSubtitle("Choose your login type.");
 }

 function showUserLogin() {
     openAuthModal();
     hideAllAuthForms();

     const loginForm = getElement("loginForm");

     if (loginForm) {
         loginForm.hidden = false;
     }

     setAuthSubtitle("Login to your passenger account.");
 }

 function showRegister() {
     openAuthModal();
     hideAllAuthForms();

     const registerForm = getElement("registerForm");

     if (registerForm) {
         registerForm.hidden = false;
     }

     setAuthSubtitle("Create your passenger account.");
 }

 function showAdminLogin() {
     openAuthModal();
     hideAllAuthForms();

     const adminForm = getElement("adminLoginForm");

     if (adminForm) {
         adminForm.hidden = false;
     }

     setAuthSubtitle("Administrator access only.");
 }

 function closeAuth() {
     const modal = getElement("authModal");

     if (!modal) return;

     modal.hidden = true;
     modal.style.display = "none";

     showAuthMessage("");
 }


 // =====================================================
 // 4. LOGIN PROCESS
 // =====================================================

 async function authenticateLogin(email, password, expectedRole) {
     try {
         if (!email || !password) {
             showAuthMessage("Please enter your email and password.", true);
             return false;
         }

         showAuthMessage("Logging in...");

         const response = await fetch(`${AUTH_URL}/login`, {
             method: "POST",
             headers: {
                 "Content-Type": "application/json"
             },
             body: JSON.stringify({
                 email: email.trim(),
                 password
             })
         });

         const data = await readResponse(response);

         if (!data.token || !data.user) {
             throw new Error("Invalid login response from server.");
         }

         const isAdmin = data.user.isAdmin === true;

         if (expectedRole === "admin" && !isAdmin) {
             showAuthMessage(
                 "This account does not have administrator access.",
                 true
             );
             return false;
         }

         if (expectedRole === "user" && isAdmin) {
             showAuthMessage(
                 "Please use the Admin Login option.",
                 true
             );
             return false;
         }

         sessionStorage.setItem(TOKEN_KEY, data.token);
         sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));

         showAuthMessage("Login successful!");

         updateAuthButton();

         closeAuth();

         if (isAdmin) {
             window.location.href = "admin.html";
         } else {
             window.location.href = "user.html";
         }

         return true;

     } catch (error) {
         console.error("Login error:", error);
         showAuthMessage(error.message || "Login failed.", true);
         return false;
     }
 }


 // =====================================================
 // 5. USER LOGIN FORM
 // =====================================================

 const loginForm = getElement("loginForm");

 if (loginForm) {
     loginForm.addEventListener("submit", async function (event) {
         event.preventDefault();

         const email =
             getElement("loginEmail")?.value ||
             loginForm.querySelector('[name="email"]')?.value;

         const password =
             getElement("loginPassword")?.value ||
             loginForm.querySelector('[name="password"]')?.value;

         await authenticateLogin(email, password, "user");
     });
 }


 // =====================================================
 // 6. ADMIN LOGIN FORM
 // =====================================================

 const adminLoginForm = getElement("adminLoginForm");

 if (adminLoginForm) {
     adminLoginForm.addEventListener("submit", async function (event) {
         event.preventDefault();

         const email =
             getElement("adminEmail")?.value ||
             adminLoginForm.querySelector('[name="email"]')?.value;

         const password =
             getElement("adminPassword")?.value ||
             adminLoginForm.querySelector('[name="password"]')?.value;

         await authenticateLogin(email, password, "admin");
     });
 }


 // =====================================================
 // 7. USER REGISTRATION
 // =====================================================

 const registerForm = getElement("registerForm");

 if (registerForm) {
     registerForm.addEventListener("submit", async function (event) {
         event.preventDefault();

         try {
             const name =
                 getElement("registerName")?.value ||
                 registerForm.querySelector('[name="name"]')?.value;

             const email =
                 getElement("registerEmail")?.value ||
                 registerForm.querySelector('[name="email"]')?.value;

             const phone =
                 getElement("registerPhone")?.value ||
                 registerForm.querySelector('[name="phone"]')?.value;

             const password =
                 getElement("registerPassword")?.value ||
                 registerForm.querySelector('[name="password"]')?.value;

             if (!name || !email || !phone || !password) {
                 showAuthMessage("Please fill in all the fields.", true);
                 return;
             }

             showAuthMessage("Creating your account...");

             const response = await fetch(`${AUTH_URL}/register`, {
                 method: "POST",
                 headers: {
                     "Content-Type": "application/json"
                 },
                 body: JSON.stringify({
                     name: name.trim(),
                     email: email.trim(),
                     phone: phone.trim(),
                     password
                 })
             });

             const data = await readResponse(response);

             if (data.user?.isAdmin) {
                 throw new Error("Admin accounts cannot be registered here.");
             }

             showAuthMessage(
                 data.message || "Registration successful! Please login."
             );

             registerForm.reset();

             setTimeout(() => {
                 showUserLogin();

                 const loginEmail = getElement("loginEmail");

                 if (loginEmail) {
                     loginEmail.value = email;
                 }

                 showAuthMessage("Account created. Please login.");
             }, 700);

         } catch (error) {
             console.error("Registration error:", error);
             showAuthMessage(error.message || "Registration failed.", true);
         }
     });
 }


 // =====================================================
 // 8. REPORT SUBMISSION
 // =====================================================

 async function submitReport(form, type) {
     try {
         const prefix = type === "Lost" ? "lost" : "found";

         const report = {
             type: type,
             itemName: getElement(`${prefix}Name`)?.value.trim(),
             category: getElement(`${prefix}Category`)?.value,
             description: getElement(`${prefix}Description`)?.value.trim(),
             location: getElement(`${prefix}Location`)?.value.trim(),
             date: getElement(`${prefix}Date`)?.value,
             transport: getElement(`${prefix}Transport`)?.value.trim()
         };

         if (
             !report.itemName ||
             !report.category ||
             !report.description ||
             !report.location ||
             !report.date
         ) {
             alert("Please fill in all required report details.");
             return;
         }

         const token = getToken();

         if (!token) {
             alert("Please login before submitting a report.");
             showLogin();
             return;
         }

         const response = await fetch(API_URL, {
             method: "POST",
             headers: {
                 "Content-Type": "application/json",
                 ...getAuthHeaders()
             },
             body: JSON.stringify(report)
         });

         const data = await readResponse(response);

         alert(data.message || `${type} item reported successfully!`);

         form.reset();

         await Promise.all([
             loadReports(),
             loadMatches()
         ]);

     } catch (error) {
         console.error("Report submission error:", error);

         if (
             error.message.toLowerCase().includes("token") ||
             error.message.toLowerCase().includes("unauthorized")
         ) {
             sessionStorage.removeItem(USER_KEY);
             sessionStorage.removeItem(TOKEN_KEY);
             updateAuthButton();
         }

         alert(error.message || "Unable to submit report.");
     }
 }

 const lostForm = getElement("lostForm");

 if (lostForm) {
     lostForm.addEventListener("submit", function (event) {
         event.preventDefault();
         submitReport(lostForm, "Lost");
     });
 }

 const foundForm = getElement("foundForm");

 if (foundForm) {
     foundForm.addEventListener("submit", function (event) {
         event.preventDefault();
         submitReport(foundForm, "Found");
     });
 }


 // =====================================================
 // 9. LOAD ALL REPORTS
 // =====================================================

 async function loadReports() {
     const container = getElement("reportsContainer");

     if (!container) return;

     container.innerHTML = "<p>Loading reports...</p>";

     try {
         const response = await fetch(API_URL);
         const data = await readResponse(response);

         // Supports both array and object API responses
         if (Array.isArray(data)) {
             reports = data;
         } else if (Array.isArray(data.reports)) {
             reports = data.reports;
         } else {
             reports = [];
         }

         console.log("Reports received:", reports);

         displayReports(reports);
         updateStats();

     } catch (error) {
         console.error("Reports loading error:", error);

         container.innerHTML = `
             <p class="error-message">
                 Unable to load reports. Please check the backend.
             </p>
         `;
     }
 }


 // =====================================================
 // 10. DISPLAY REPORT CARDS
 // =====================================================

 function displayReports(reportList) {
     const container = getElement("reportsContainer");

     if (!container) return;

     if (!reportList || reportList.length === 0) {
         container.innerHTML = `
             <p>No reports found.</p>
         `;
         return;
     }

     container.innerHTML = reportList.map(report => {

         const itemName =
             report.itemName ||
             report.name ||
             report.title ||
             "Unnamed item";

         const type = report.type || "Unknown";
         const category = report.category || "Other";
         const description = report.description || "No description provided";
         const location = report.location || "Location not provided";
         const date = report.date || report.createdAt;
         const transport = report.transport || "Not specified";
         const status = report.status || "Open";

         const normalizedType = String(type).toLowerCase();
         const normalizedStatus = String(status).toLowerCase();

         let typeColor = "#64748b";

         if (normalizedType === "lost") {
             typeColor = "#DC2626";
         } else if (normalizedType === "found") {
             typeColor = "#16A34A";
         }

         let statusColor = "#64748b";

         if (normalizedStatus === "claimed") {
             statusColor = "#2563EB";
         } else if (normalizedStatus === "returned") {
             statusColor = "#16A34A";
         }

         return `
             <div class="report-card">

                 <div class="report-card-header">

                     <h3>${escapeHTML(itemName)}</h3>

                     <span class="report-type"
                         style="
                             color: white;
                             background-color: ${typeColor};
                             padding: 5px 12px;
                             border-radius: 20px;
                             display: inline-block;
                         ">
                         ${escapeHTML(type)}
                     </span>

                 </div>

                 <p>
                     <strong>Category:</strong>
                     ${escapeHTML(category)}
                 </p>

                 <p>
                     <strong>Description:</strong>
                     ${escapeHTML(description)}
                 </p>

                 <p>
                     <strong>Location:</strong>
                     ${escapeHTML(location)}
                 </p>

                 <p>
                     <strong>Date:</strong>
                     ${formatDate(date)}
                 </p>

                 <p>
                     <strong>Transport:</strong>
                     ${escapeHTML(transport)}
                 </p>

                 <p>
                     <strong>Status:</strong>

                     <span style="
                         color: ${statusColor};
                         font-weight: bold;
                     ">
                         ${escapeHTML(status)}
                     </span>

                 </p>

             </div>
         `;
     }).join("");
 }


 // =====================================================
 // 11. SEARCH AND CATEGORY FILTER
 // =====================================================

 function filterReports() {
     const searchInput = getElement("searchInput");
     const categoryFilter = getElement("filterCategory");

     const searchText = searchInput
         ? searchInput.value.toLowerCase().trim()
         : "";

     const selectedCategory = categoryFilter
         ? categoryFilter.value.toLowerCase()
         : "";

     const filteredReports = reports.filter(report => {

         const itemName = (
             report.itemName ||
             report.name ||
             report.title ||
             ""
         ).toLowerCase();

         const description = (
             report.description || ""
         ).toLowerCase();

         const location = (
             report.location || ""
         ).toLowerCase();

         const category = (
             report.category || ""
         ).toLowerCase();

         const matchesSearch =
             itemName.includes(searchText) ||
             description.includes(searchText) ||
             location.includes(searchText);

         const normalizedSelected = selectedCategory.replace(/s$/, "");
         const normalizedCategory = category.replace(/s$/, "");

         const matchesCategory =
             selectedCategory === "" ||
             selectedCategory === "all" ||
             category === selectedCategory ||
             normalizedCategory === normalizedSelected;

         return matchesSearch && matchesCategory;
     });

     displayReports(filteredReports);
 }

 const searchInput = getElement("searchInput");

 if (searchInput) {
     searchInput.addEventListener("input", filterReports);
 }

 const filterCategory = getElement("filterCategory");

 if (filterCategory) {
     filterCategory.addEventListener("change", filterReports);
 }


 // =====================================================
 // 12. LOAD POSSIBLE MATCHES
 // =====================================================

 async function loadMatches() {
     const container = getElement("matchesContainer");

     if (!container) return;

     try {
         const response = await fetch(MATCHES_URL);
         const data = await readResponse(response);

         matches = Array.isArray(data)
             ? data
             : (data.matches || []);

         displayMatches(matches);

     } catch (error) {
         console.error("Matches loading error:", error);

         container.innerHTML = `
             <p>Unable to load possible matches.</p>
         `;
     }
 }


 // =====================================================
 // 13. DISPLAY POSSIBLE MATCHES
 // =====================================================

 function displayMatches(matchList) {
     const container = getElement("matchesContainer");

     if (!container) return;

     if (!matchList || matchList.length === 0) {
         container.innerHTML = `
             <p>No possible matches found yet.</p>
         `;
         return;
     }

     container.innerHTML = matchList.map(match => {

         const lostItem =
             match.lostItem ||
             match.lostReport ||
             match.lost ||
             {};

         const foundItem =
             match.foundItem ||
             match.foundReport ||
             match.found ||
             {};

         const lostName =
             lostItem.itemName ||
             lostItem.name ||
             lostItem.title ||
             "Lost item";

         const foundName =
             foundItem.itemName ||
             foundItem.name ||
             foundItem.title ||
             "Found item";

         const score =
             match.matchScore ??
             match.score ??
             match.similarity ??
             0;

         const percentage = Math.round(Number(score));

         return `
             <div class="match-card">

                 <h3>Possible Match</h3>

                 <div class="match-details">

                     <p>
                         <strong>Lost Item:</strong>
                         ${escapeHTML(lostName)}
                     </p>

                     <p>
                         <strong>Found Item:</strong>
                         ${escapeHTML(foundName)}
                     </p>

                     <p>
                         <strong>Lost Location:</strong>
                         ${escapeHTML(lostItem.location || "Not provided")}
                     </p>

                     <p>
                         <strong>Found Location:</strong>
                         ${escapeHTML(foundItem.location || "Not provided")}
                     </p>

                     <p>
                         <strong>Match Score:</strong>
                         ${Number.isFinite(percentage) ? percentage : 0}%
                     </p>

                 </div>

             </div>
         `;
     }).join("");
 }


 // =====================================================
 // 14. UPDATE HOMEPAGE STATISTICS
 // =====================================================

 function updateStats() {

     const lostCount = reports.filter(report =>
         String(report.type || "").toLowerCase() === "lost"
     ).length;

     const foundCount = reports.filter(report =>
         String(report.type || "").toLowerCase() === "found"
     ).length;

     // Only Returned Found reports count as returned items
     const returnedCount = reports.filter(report =>
         String(report.type || "").toLowerCase() === "found" &&
         String(report.status || "").toLowerCase() === "returned"
     ).length;

     if (getElement("lostCount")) {
         getElement("lostCount").textContent = lostCount;
     }

     if (getElement("foundCount")) {
         getElement("foundCount").textContent = foundCount;
     }

     if (getElement("claimedCount")) {
         getElement("claimedCount").textContent = returnedCount;
     }
 }


 // =====================================================
 // 15. MODAL BUTTON EVENT HANDLERS
 // =====================================================

 document.addEventListener("DOMContentLoaded", function () {

     const modal = getElement("authModal");

     if (modal) {
         modal.addEventListener("click", function (event) {
             if (event.target === modal) {
                 closeAuth();
             }
         });
     }

     const choice = getElement("loginChoice");

     if (choice) {
         const buttons = choice.querySelectorAll("button");

         if (buttons.length >= 2) {
             buttons[0].addEventListener("click", showUserLogin);
             buttons[1].addEventListener("click", showAdminLogin);
         }
     }

     document.addEventListener("keydown", function (event) {
         if (event.key === "Escape") {
             closeAuth();
         }
     });

     updateAuthButton();

     loadReports();

     loadMatches();
 });


 // =====================================================
 // END OF FINDIT SCRIPT
 // =====================================================
