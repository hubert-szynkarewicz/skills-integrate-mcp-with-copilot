document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const teacherRequiredNote = document.getElementById("teacher-required-note");
  const userMenuToggle = document.getElementById("user-menu-toggle");
  const userMenuPanel = document.getElementById("user-menu-panel");
  const authStatusText = document.getElementById("auth-status-text");
  const openLoginBtn = document.getElementById("open-login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLoginBtn = document.getElementById("cancel-login-btn");

  const DEFAULT_ACTIVITY_OPTION =
    '<option value="">-- Select an activity --</option>';
  let teacherToken = localStorage.getItem("teacherToken") || "";
  let teacherUsername = localStorage.getItem("teacherUsername") || "";

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function teacherHeaders() {
    return teacherToken ? { "X-Teacher-Token": teacherToken } : {};
  }

  function setAuthState() {
    const isTeacher = Boolean(teacherToken);

    signupForm.querySelector("button[type='submit']").disabled = !isTeacher;
    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.disabled = !isTeacher;
    });

    if (isTeacher) {
      authStatusText.textContent = `Teacher mode: ${teacherUsername}`;
      openLoginBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
      teacherRequiredNote.classList.add("hidden");
    } else {
      authStatusText.textContent = "Student mode";
      openLoginBtn.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
      teacherRequiredNote.classList.remove("hidden");
    }
  }

  async function syncAuthStatus() {
    if (!teacherToken) {
      setAuthState();
      return;
    }

    try {
      const response = await fetch("/auth/status", {
        headers: teacherHeaders(),
      });
      const result = await response.json();

      if (!response.ok || !result.is_teacher) {
        teacherToken = "";
        teacherUsername = "";
        localStorage.removeItem("teacherToken");
        localStorage.removeItem("teacherUsername");
      } else {
        teacherUsername = result.username || teacherUsername;
        localStorage.setItem("teacherUsername", teacherUsername);
      }
    } catch (error) {
      teacherToken = "";
      teacherUsername = "";
      localStorage.removeItem("teacherToken");
      localStorage.removeItem("teacherUsername");
      console.error("Error checking auth status:", error);
    }

    setAuthState();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = DEFAULT_ACTIVITY_OPTION;

      const isTeacher = Boolean(teacherToken);

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isTeacher
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });

      setAuthState();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!teacherToken) {
      showMessage("Please log in as a teacher to unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: teacherHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!teacherToken) {
      showMessage("Please log in as a teacher to register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: teacherHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userMenuToggle.addEventListener("click", () => {
    userMenuPanel.classList.toggle("hidden");
  });

  openLoginBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    userMenuPanel.classList.add("hidden");
  });

  cancelLoginBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("teacher-username").value;
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      teacherToken = result.token;
      teacherUsername = result.username;
      localStorage.setItem("teacherToken", teacherToken);
      localStorage.setItem("teacherUsername", teacherUsername);

      showMessage(result.message, "success");
      loginModal.classList.add("hidden");
      loginForm.reset();
      setAuthState();
      fetchActivities();
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: teacherHeaders(),
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    teacherToken = "";
    teacherUsername = "";
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherUsername");
    userMenuPanel.classList.add("hidden");
    setAuthState();
    fetchActivities();
    showMessage("Logged out", "info");
  });

  document.addEventListener("click", (event) => {
    if (!userMenuPanel.contains(event.target) && !userMenuToggle.contains(event.target)) {
      userMenuPanel.classList.add("hidden");
    }

    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
    }
  });

  // Initialize app
  syncAuthStatus().then(fetchActivities);
});
