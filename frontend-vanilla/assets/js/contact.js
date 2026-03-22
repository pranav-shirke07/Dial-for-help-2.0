(function () {
  const submitBtn = document.getElementById("contactSubmitBtn");

  submitBtn.addEventListener("click", async () => {
    const payload = {
      name: document.getElementById("contactName").value.trim(),
      email: document.getElementById("contactEmail").value.trim(),
      phone: document.getElementById("contactPhone").value.trim(),
      message: document.getElementById("contactMessage").value.trim(),
    };

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
      await window.dialApi.createContact(payload);
      window.dialUi.toast("Message sent successfully", "success");
      ["contactName", "contactEmail", "contactPhone", "contactMessage"].forEach((id) => {
        document.getElementById(id).value = "";
      });
    } catch (error) {
      window.dialUi.toast(error.message || "Failed to send message", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Message";
    }
  });
})();