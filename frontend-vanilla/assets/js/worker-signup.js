(function () {
  const skillSelect = document.getElementById("workerSkill");
  skillSelect.innerHTML = window.ALL_SERVICES.filter((item) => item.name !== "Other")
    .map((item) => `<option value="${item.name}">${item.name}</option>`)
    .join("");

  const submitBtn = document.getElementById("workerSubmitBtn");
  const payBtn = document.getElementById("workerPayBtn");
  const checkBtn = document.getElementById("workerCheckSubBtn");
  const subActive = document.getElementById("workerSubActive");
  const subExpiry = document.getElementById("workerSubExpiry");

  let workerSub = { has_active_subscription: false, subscription_expires_at: null };

  const getForm = () => ({
    full_name: document.getElementById("workerName").value.trim(),
    phone: document.getElementById("workerPhone").value.trim(),
    email: document.getElementById("workerEmail").value.trim(),
    skill: document.getElementById("workerSkill").value,
    city: document.getElementById("workerCity").value.trim(),
    years_experience: Number(document.getElementById("workerExperience").value || 0),
    availability: document.getElementById("workerAvailability").value,
    about: document.getElementById("workerAbout").value.trim(),
  });

  const renderSubState = () => {
    subActive.textContent = workerSub.has_active_subscription ? "Yes" : "No";
    subExpiry.textContent = workerSub.subscription_expires_at
      ? new Date(workerSub.subscription_expires_at).toLocaleDateString()
      : "-";
  };

  const fetchSubStatus = async () => {
    const form = getForm();
    if (!form.phone || !form.email) {
      window.dialUi.toast("Enter phone and email first", "error");
      return false;
    }

    try {
      workerSub = await window.dialApi.workerSubscriptionStatus({
        phone: form.phone,
        email: form.email,
      });
      renderSubState();
      return workerSub.has_active_subscription;
    } catch (error) {
      window.dialUi.toast(error.message || "Could not verify subscription", "error");
      return false;
    }
  };

  const startPayment = async () => {
    const form = getForm();
    if (!form.full_name || !form.phone || !form.email) {
      return window.dialUi.toast("Fill name, phone and email before payment", "error");
    }

    try {
      payBtn.disabled = true;
      payBtn.textContent = "Opening Razorpay...";

      const order = await window.dialApi.paymentCreateOrder({
        plan_type: "worker",
        name: form.full_name,
        email: form.email,
        phone: form.phone,
      });

      const rz = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Dial For Help",
        description: `Worker Annual Plan ₹${order.amount_inr}`,
        order_id: order.order_id,
        prefill: {
          name: form.full_name,
          email: form.email,
          contact: form.phone,
        },
        handler: async (payment) => {
          await window.dialApi.paymentVerify({
            plan_type: "worker",
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
            subscriber_name: form.full_name,
            email: form.email,
            phone: form.phone,
          });
          window.dialUi.toast("Worker subscription activated", "success");
          await fetchSubStatus();
        },
      });

      rz.on("payment.failed", (event) => {
        window.dialUi.toast(event.error?.description || "Payment failed", "error");
      });
      rz.open();
    } catch (error) {
      window.dialUi.toast(error.message || "Payment failed", "error");
    } finally {
      payBtn.disabled = false;
      payBtn.textContent = "Pay ₹199/year";
    }
  };

  const submit = async () => {
    const form = getForm();
    if (!workerSub.has_active_subscription) {
      const active = await fetchSubStatus();
      if (!active) return window.dialUi.toast("Worker subscription is mandatory before signup", "error");
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting...";
      const response = await window.dialApi.createWorkerSignup(form);
      window.dialUi.toast(`Worker profile submitted: ${response.id}`, "success");
      ["workerName", "workerPhone", "workerEmail", "workerCity", "workerExperience", "workerAbout"].forEach((id) => {
        document.getElementById(id).value = "";
      });
    } catch (error) {
      window.dialUi.toast(error.message || "Signup failed", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Application";
    }
  };

  checkBtn.addEventListener("click", fetchSubStatus);
  payBtn.addEventListener("click", startPayment);
  submitBtn.addEventListener("click", submit);

  renderSubState();
})();