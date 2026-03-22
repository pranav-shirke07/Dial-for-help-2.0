(function () {
  const btn = document.getElementById("trackBookingBtn");
  const input = document.getElementById("trackBookingId");
  const resultCard = document.getElementById("trackResultCard");
  const statusChip = document.getElementById("trackStatusChip");

  btn.addEventListener("click", async () => {
    const bookingId = input.value.trim();
    if (!bookingId) return window.dialUi.toast("Please enter booking ID", "error");

    try {
      btn.disabled = true;
      btn.textContent = "Checking...";
      const data = await window.dialApi.trackBooking(bookingId);

      document.getElementById("trackResultId").textContent = data.booking_id;
      document.getElementById("trackResultService").textContent = data.service_type;
      document.getElementById("trackResultCustomer").textContent = data.customer_name;
      document.getElementById("trackResultDate").textContent = data.preferred_date;
      document.getElementById("trackResultCharge").textContent = data.charge_type;
      document.getElementById("trackResultWorker").textContent = data.assigned_worker_name || "Not assigned yet";

      statusChip.textContent = data.status;
      statusChip.className = window.dialUi.statusChipClass(data.status);
      resultCard.classList.remove("hidden");
      window.dialUi.toast("Booking found", "success");
    } catch (error) {
      window.dialUi.toast(error.message || "Booking not found", "error");
      resultCard.classList.add("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Track Booking";
    }
  });
})();