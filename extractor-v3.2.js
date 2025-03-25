// Full Extraction & Webhook Script V3.3 (All Metrics + Popover Distance Matching) is running

(async function () {
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYQE74B4BMygaBx3XZVm_Gm1S0jEvhvP3zgz0ZB4szrhLQoBCR_uk9OAsLvoroh4hXTw/exec";

  function openDatePicker() {
    const picker = document.querySelector('#location_dashboard-datepicker-dashboard_header_range .n-input');
    picker?.click();
    return !!picker;
  }

  function extractDateRange() {
    const startEl = document.querySelector('.n-date-panel-date--selected.n-date-panel-date--start');
    const endEl = document.querySelector('.n-date-panel-date--selected.n-date-panel-date--end');
    const calendars = document.querySelectorAll('.n-date-panel-calendar');
    const monthLabels = document.querySelectorAll('.n-date-panel-month__text');
    if (!startEl || !endEl || calendars.length < 2 || monthLabels.length < 2) return "Not Found";

    const getMonthYear = (el) => el.closest('.n-date-panel-calendar') === calendars[0]
      ? monthLabels[0].textContent.trim()
      : monthLabels[1].textContent.trim();

    const startDate = convertToDate(startEl.textContent.trim(), getMonthYear(startEl));
    const endDate = convertToDate(endEl.textContent.trim(), getMonthYear(endEl));
    return `${startDate} - ${endDate}`;
  }

  function convertToDate(day, monthYear) {
    const [month, year] = monthYear.split(" ");
    const monthNum = new Date(`${month} 1, ${year}`).getMonth() + 1;
    return `${year}-${monthNum.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  function extractBusinessName() {
    return document.querySelector('.hl_switcher-loc-name')?.textContent.trim() || 'Not Found';
  }

  function extractLocationID() {
    const match = window.location.href.match(/\/location\/([^\/]+)/);
    return match ? match[1] : 'Not Found';
  }

  async function extractData() {
    const labels = [
      // 🔵 Google
      ["Google Ads Report", true],
      ["Google Total Scheduled + Completed"],
      ["Total Google Leads"],
      ["Google Leads Scheduled + Completed"],

      // 🔵 Facebook
      ["Facebook Ads Report", true],
      ["Facebook Total Scheduled + Completed"],
      ["Total Facebook Leads"],
      ["Facebook Leads Scheduled + Completed"],

      // 🔵 Paid Unattributable
      ["Facebook/Google Total Scheduled + Completed"],
      ["Total Facebook/Google Leads"],
      ["Facebook/Google Leads Scheduled + Completed"]
    ];

    const labelMap = {
      "Google Ads Report": "Google Ads Report Total Spent",
      "Google Total Scheduled + Completed": "Google Total Scheduled + Completed",
      "Total Google Leads": "Total Google Leads",
      "Google Leads Scheduled + Completed": "Google Leads Scheduled + Completed",
      "Facebook Ads Report": "Facebook Ads Report Total Spent",
      "Facebook Total Scheduled + Completed": "Facebook Total Scheduled + Completed",
      "Total Facebook Leads": "Total Facebook Leads",
      "Facebook Leads Scheduled + Completed": "Facebook Leads Scheduled + Completed",
      "Facebook/Google Total Scheduled + Completed": "Facebook/Google Total Scheduled + Completed",
      "Total Facebook/Google Leads": "Total Facebook/Google Leads",
      "Facebook/Google Leads Scheduled + Completed": "Facebook/Google Leads Scheduled + Completed"
    };

    const extractedData = {
      "Business Name": extractBusinessName(),
      "Location ID": extractLocationID(),
      "Date Range": extractDateRange()
    };

    for (let [label, isSpend = false] of labels) {
      const value = await extractValue(label, isSpend);
      extractedData[labelMap[label]] = value;
      console.log(`➡️ ${labelMap[label]}:`, value);
    }

    console.table(extractedData);
    await sendToWebhook(extractedData);
  }

  async function extractValue(labelText, isSpend = false) {
    const cards = document.querySelectorAll('.hl-card');

    for (let card of cards) {
      const header = card.querySelector('.hl-card-header .hl-text-md-medium');
      if (!header || header.textContent.trim() !== labelText) continue;

      let valueElement = null;

      if (isSpend && (labelText === "Google Ads Report" || labelText === "Facebook Ads Report")) {
        const blocks = card.querySelectorAll('.hl-card-content .flex.flex-col.gap-1');
        for (let block of blocks) {
          const subLabel = block.querySelector('.text-gray-500')?.innerText.trim();
          if (subLabel?.includes("Total Spent")) {
            valueElement = block.querySelector('.text-3xl, svg text');
            break;
          }
        }
      } else {
        // Prefer svg text if present
        valueElement = card.querySelector('svg text') ||
                       card.querySelector('.hl-card-content .text-3xl') ||
                       card.querySelector('.hl-card-content text');
      }

      if (valueElement) {
        const previous = valueElement.textContent.trim();
        const rect = valueElement.getBoundingClientRect();

        simulateHover(valueElement);
        await new Promise(r => setTimeout(r, 300));

        const popoverValue = await getClosestPopoverValue(rect, previous);

        simulateMouseLeave(valueElement);
        await new Promise(r => setTimeout(r, 250));

        return popoverValue !== 'Not Found' ? popoverValue : previous;
      }
    }

    console.warn(`❌ Value for ${labelText} not found.`);
    return 'Not Found';
  }

  async function getClosestPopoverValue(targetRect, fallbackValue) {
    return new Promise((resolve) => {
      let tries = 0;
      const maxTries = 10;
      const interval = setInterval(() => {
        const popovers = document.querySelectorAll('.n-popover__content');
        if (popovers.length > 0) {
          let closest = null;
          let minDistance = Infinity;

          for (let popover of popovers) {
            const popRect = popover.getBoundingClientRect();
            const dx = targetRect.left - popRect.left;
            const dy = targetRect.top - popRect.top;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance) {
              minDistance = distance;
              closest = popover;
            }
          }

          clearInterval(interval);
          resolve(closest?.textContent.trim() || fallbackValue);
        }

        if (++tries >= maxTries) {
          clearInterval(interval);
          resolve(fallbackValue);
        }
      }, 100);
    });
  }

  function simulateHover(el) {
    el?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  }

  function simulateMouseLeave(el) {
    el?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
  }

  async function sendToWebhook(data) {
    try {
      const query = new URLSearchParams(data).toString();
      const res = await fetch(APPS_SCRIPT_URL + "?" + query);
      const result = await res.text();
      console.log("📡 Webhook Response:", result);
    } catch (err) {
      console.error("❌ Error sending to webhook:", err);
    }
  }

  if (openDatePicker()) {
    await new Promise(r => setTimeout(r, 500));
    const dateRange = extractDateRange();
    console.log("📅 Extracted Date Range:", dateRange);
    await extractData();
  }
})();
