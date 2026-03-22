(function () {
  const stepLabel = document.getElementById("bookingStepLabel");
  const stepEls = [
    document.getElementById("bookingStep1"),
    document.getElementById("bookingStep2"),
    document.getElementById("bookingStep3"),
  ];

  const serviceSelect = document.getElementById("bookingServiceType");
  serviceSelect.innerHTML = window.ALL_SERVICES.map((item) => `<option value="${item.name}">${item.name}</option>`).join("");

  const backBtn = document.getElementById("bookingBackBtn");
  const nextBtn = document.getElementById("bookingNextBtn");
  const submitBtn = document.getElementById("bookingSubmitBtn");
  const subCard = document.getElementById("bookingSubscriptionCard");
  const subText = document.getElementById("bookingSubscriptionText");
  const subPayBtn = document.getElementById("bookingSubscriptionPayBtn");
  const successCard = document.getElementById("bookingSuccessCard");
  const successId = document.getElementById("bookingSuccessId");

  const form = {
    full_name: "",
    phone: "",
    email: "",
    service_type: "Plumbing",
    address: "",
    preferred_date: "",
    notes: "",
  };

  let step = 1;
  let subStatus = null;

  const syncForm = () => {
    form.full_name = document.getElementById("bookingFullName").value.trim();
    form.phone = document.getElementById("bookingPhone").value.trim();
    form.email = document.getElementById("bookingEmail").value.trim();
    form.service_type = document.getElementById("bookingServiceType").value;
    form.address = document.getElementById("bookingAddress").value.trim();
    form.preferred_date = document.getElementById("bookingDate").value;
    form.notes = document.getElementById("bookingNotes").value.trim();
  };

  const validateStep = () => {
    syncForm();
    if (step === 1) return form.full_name && form.phone && form.email;
    if (step === 2) return form.service_type && form.address && form.preferred_date;
    return form.full_name && form.phone && form.email && form.service_type && form.address && form.preferred_date;
  };

  const renderStep = () => {
    stepLabel.textContent = String(step);
    stepEls.forEach((el, idx) => el.classList.toggle("hidden", idx !== step - 1));

    backBtn.disabled = step === 1;
    nextBtn.classList.toggle("hidden", step === 3);
    submitBtn.classList.toggle("hidden", step !== 3);

    syncForm();
    document.getElementById("reviewName").textContent = form.full_name || "-";
    document.getElementById("reviewService").textContent = form.service_type || "-";
    document.getElementById("reviewDate").textContent = form.preferred_date || "-";
  };

  const refreshUserStatus = async () => {
    syncForm();
    if (!form.phone || !form.email) return;
    try {
      subStatus = await window.dialApi.userSubscriptionStatus({ phone: form.phone, email: form.email });
      document.getElementById("bookingFreeRemaining").textContent = String(subStatus.free_remaining);
      document.getElementById("bookingUsedCount").textContent = String(subStatus.bookings_used);
      document.getElementById("bookingSubActive").textContent = subStatus.has_active_subscription ? "Yes" : "No";
    } catch (_error) {
      // ignore soft failure
    }
  };

  const submitBooking = async () => {
    syncForm();
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting...";
      const booking = await window.dialApi.createBooking(form);
      successId.textContent = booking.id;
      successCard.classList.remove("hidden");
      subCard.classList.add("hidden");
      window.dialUi.toast("Booking submitted", "success");
      await refreshUserStatus();
    } catch (error) {
      if (error.status === 402 && error.payload?.detail?.code === "USER_SUBSCRIPTION_REQUIRED") {
        subCard.classList.remove("hidden");
        subText.textContent = error.payload.detail.message;
        window.dialUi.toast(error.payload.detail.message, "error");
      } else {
        window.dialUi.toast(error.message || "Booking failed", "error");
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Confirm Booking";
    }
  };

  const startPayment = async () => {
    syncForm();
    if (!form.full_name || !form.phone || !form.email) {
      return window.dialUi.toast("Please fill name, phone, email first", "error");
    }

    try {
      subPayBtn.disabled = true;
      subPayBtn.textContent = "Opening Razorpay...";

      const order = await window.dialApi.paymentCreateOrder({
        plan_type: "user",
        name: form.full_name,
        email: form.email,
        phone: form.phone,
      });

      const rz = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Dial For Help",
        description: `User Annual Plan ₹${order.amount_inr}`,
        order_id: order.order_id,
        prefill: {
          name: form.full_name,
          email: form.email,
          contact: form.phone,
        },
        handler: async (payment) => {
          await window.dialApi.paymentVerify({
            plan_type: "user",
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
            subscriber_name: form.full_name,
            email: form.email,
            phone: form.phone,
          });
          window.dialUi.toast("Subscription activated", "success");
          subCard.classList.add("hidden");
          await refreshUserStatus();
          await submitBooking();
        },
      });

      rz.on("payment.failed", (event) => {
        window.dialUi.toast(event.error?.description || "Payment failed", "error");
      });

      rz.open();
    } catch (error) {
      window.dialUi.toast(error.message || "Payment flow failed", "error");
    } finally {
      subPayBtn.disabled = false;
      subPayBtn.textContent = "Pay ₹99/year and Continue";
    }
  };

  nextBtn.addEventListener("click", async () => {
    if (!validateStep()) return window.dialUi.toast("Please complete required fields", "error");
    if (step === 1) await refreshUserStatus();
    step = Math.min(3, step + 1);
    renderStep();
  });

  backBtn.addEventListener("click", () => {
    step = Math.max(1, step - 1);
    renderStep();
  });

  submitBtn.addEventListener("click", () => {
    if (!validateStep()) return window.dialUi.toast("Please complete required fields", "error");
    submitBooking();
  });

  subPayBtn.addEventListener("click", startPayment);

  renderStep();
})();