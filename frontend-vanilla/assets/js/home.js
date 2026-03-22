(function () {
  const searchInput = document.getElementById("homeServiceSearch");
  const tagsWrap = document.getElementById("homeServiceTags");
  const topWrap = document.getElementById("homeTopServices");

  const renderTags = () => {
    const query = (searchInput.value || "").trim().toLowerCase();
    const list = query
      ? window.ALL_SERVICES.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 8)
      : window.ALL_SERVICES.slice(0, 8);

    tagsWrap.innerHTML = list.length
      ? list
          .map(
            (item) =>
              `<span class="pill-link" data-testid="home-service-tag-${item.name.toLowerCase().replace(/\s+/g, "-")}">${item.name}</span>`,
          )
          .join("")
      : `<span class="muted" data-testid="home-service-search-empty">No matching service found.</span>`;
  };

  const renderTop = () => {
    topWrap.innerHTML = window.ALL_SERVICES.slice(0, 6)
      .map(
        (item) => `
          <article class="card stack" data-testid="home-top-service-card-${item.name.toLowerCase().replace(/\s+/g, "-")}">
            <p class="label" data-testid="home-top-service-category-${item.name.toLowerCase().replace(/\s+/g, "-")}">${item.category}</p>
            <h2 data-testid="home-top-service-title-${item.name.toLowerCase().replace(/\s+/g, "-")}">${item.name}</h2>
            <p data-testid="home-top-service-description-${item.name.toLowerCase().replace(/\s+/g, "-")}">${item.description}</p>
          </article>
        `,
      )
      .join("");
  };

  searchInput.addEventListener("input", renderTags);
  renderTags();
  renderTop();
})();