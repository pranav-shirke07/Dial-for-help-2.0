(function () {
  const queryInput = document.getElementById("servicesSearch");
  const categorySelect = document.getElementById("servicesCategory");
  const grid = document.getElementById("servicesGrid");

  const categories = ["All", ...new Set(window.ALL_SERVICES.map((item) => item.category))];
  categorySelect.innerHTML = categories
    .map((category) => `<option value="${category}" data-testid="services-category-option-${category.toLowerCase().replace(/\s+/g, "-")}">${category}</option>`)
    .join("");

  const render = () => {
    const q = queryInput.value.trim().toLowerCase();
    const cat = categorySelect.value;

    const list = window.ALL_SERVICES.filter((item) => {
      const qMatch = item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      const cMatch = cat === "All" || item.category === cat;
      return qMatch && cMatch;
    });

    grid.innerHTML = list
      .map(
        (item) => `
          <article class="card stack" data-testid="service-card-${item.name.toLowerCase().replace(/\s+/g, "-")}">
            <p class="label" data-testid="service-category-${item.name.toLowerCase().replace(/\s+/g, "-")}">${item.category}</p>
            <h2 data-testid="service-name-${item.name.toLowerCase().replace(/\s+/g, "-")}">${item.name}</h2>
            <p data-testid="service-description-${item.name.toLowerCase().replace(/\s+/g, "-")}">${item.description}</p>
          </article>
        `,
      )
      .join("");

    if (!list.length) {
      grid.innerHTML = `<p class="muted" data-testid="all-services-empty">No services found.</p>`;
    }
  };

  queryInput.addEventListener("input", render);
  categorySelect.addEventListener("change", render);
  render();
})();