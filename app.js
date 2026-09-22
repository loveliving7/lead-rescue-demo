(function () {
  "use strict";

  /* ---------- Personalization from URL query params ---------- */

  function getProspectInfo() {
    var params = new URLSearchParams(window.location.search);
    var business = (params.get("business") || "").trim().slice(0, 80);
    var city = (params.get("city") || "").trim().slice(0, 60);
    return { business: business, city: city };
  }

  function applyPersonalization() {
    var info = getProspectInfo();
    if (!info.business) {
      return;
    }
    var heading = document.getElementById("hero-heading");
    var note = document.getElementById("hero-personalized");
    if (heading) {
      heading.textContent =
        "When " + info.business + "'s team can't answer, Lead Rescue keeps capturing its HVAC leads.";
    }
    if (note) {
      var text = "Personalized preview for " + info.business;
      if (info.city) {
        text += " in " + info.city;
      }
      text += ". This is a simulated workflow, not a live phone line.";
      note.textContent = text;
      note.hidden = false;
    }
    var ctaLede = document.getElementById("cta-lede");
    if (ctaLede) {
      ctaLede.textContent =
        "Reply to the email that sent you this demo and we'll configure a 7-day live pilot around " +
        info.business +
        "'s actual call flow — no card, no contract.";
    }
    document.title = "Lead Rescue — a demo built for " + info.business;
  }

  /* ---------- Call simulation data ---------- */

  var SCENARIOS = [
    { id: "no-heat", label: "No heat", issue: "No heat", category: "Heating repair" },
    { id: "no-cooling", label: "No cooling", issue: "No cooling / AC not working", category: "Cooling repair" },
    { id: "water-boiler", label: "Water / boiler issue", issue: "Water leak or boiler issue", category: "Plumbing / boiler" },
    { id: "replacement", label: "Replacement quote", issue: "Interested in a replacement quote", category: "Replacement estimate" }
  ];

  var URGENCY_OPTIONS = [
    { id: "emergency", label: "Emergency — right now" },
    { id: "today", label: "Today" },
    { id: "week", label: "This week" }
  ];

  var TIME_OPTIONS = [
    { id: "asap", label: "As soon as possible" },
    { id: "morning", label: "Tomorrow morning" },
    { id: "afternoon", label: "Tomorrow afternoon" },
    { id: "evening", label: "Tomorrow evening" }
  ];

  var TOTAL_STEPS = 6;

  var FIELD_DEFS = [
    { key: "name", label: "Caller name" },
    { key: "phone", label: "Phone" },
    { key: "location", label: "Location" },
    { key: "issue", label: "Issue" },
    { key: "urgency", label: "Urgency" },
    { key: "callTime", label: "Preferred callback" },
    { key: "category", label: "Service category" }
  ];

  var state = {
    step: 0,
    scenario: null,
    urgency: null,
    name: "",
    phone: "",
    location: "",
    callTime: null,
    transcript: []
  };

  var callLogEl, inputAreaEl, statusEl, fieldListEl, eventRailEl;
  var callTitleEl, callTimerEl, callStatusDotEl;
  var timerInterval = null;
  var timerSeconds = 0;

  function resetState() {
    state = {
      step: 0,
      scenario: null,
      urgency: null,
      name: "",
      phone: "",
      location: "",
      callTime: null,
      transcript: []
    };
  }

  function clearChildren(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  /* ---------- Call timer ---------- */

  function formatTimer(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return (m < 10 ? "0" + m : String(m)) + ":" + (s < 10 ? "0" + s : String(s));
  }

  function startTimer() {
    stopTimer();
    timerSeconds = 0;
    callTimerEl.textContent = formatTimer(0);
    timerInterval = window.setInterval(function () {
      timerSeconds += 1;
      callTimerEl.textContent = formatTimer(timerSeconds);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      window.clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /* ---------- Transcript log ---------- */

  function appendLogLine(speaker, text) {
    var line = document.createElement("div");
    line.className = "log-line " + (speaker === "agent" ? "log-agent" : "log-caller");

    var speakerEl = document.createElement("span");
    speakerEl.className = "log-speaker";
    speakerEl.textContent = speaker === "agent" ? "Lead Rescue (demo)" : "Caller (you)";

    var textEl = document.createElement("span");
    textEl.textContent = text;

    line.appendChild(speakerEl);
    line.appendChild(textEl);
    callLogEl.appendChild(line);
    callLogEl.scrollTop = callLogEl.scrollHeight;

    state.transcript.push({ speaker: speaker, text: text });
  }

  function agentSay(text) {
    appendLogLine("agent", text);
  }

  function callerSay(text) {
    appendLogLine("caller", text);
  }

  function setStatus(stepNumber, description) {
    statusEl.textContent = "Step " + stepNumber + " of " + TOTAL_STEPS + " — " + description;
  }

  /* ---------- Live extraction panel ---------- */

  function renderFieldList() {
    clearChildren(fieldListEl);
    FIELD_DEFS.forEach(function (def) {
      var dt = document.createElement("dt");
      dt.textContent = def.label;

      var dd = document.createElement("dd");
      var value = readFieldValue(def.key);
      if (value) {
        dd.textContent = value;
        dd.className = "field-value field-value-filled";
      } else {
        dd.textContent = "—";
        dd.className = "field-value field-value-empty";
      }

      fieldListEl.appendChild(dt);
      fieldListEl.appendChild(dd);
    });
  }

  function readFieldValue(key) {
    switch (key) {
      case "name":
        return state.name;
      case "phone":
        return state.phone;
      case "location":
        return state.location;
      case "issue":
        return state.scenario ? state.scenario.issue : "";
      case "urgency":
        return state.urgency ? state.urgency.label : "";
      case "callTime":
        return state.callTime ? state.callTime.label : "";
      case "category":
        return state.scenario ? state.scenario.category : "";
      default:
        return "";
    }
  }

  function addEvent(text) {
    if (eventRailEl.querySelector(".event-placeholder")) {
      clearChildren(eventRailEl);
    }
    var item = document.createElement("li");
    item.className = "event-item";
    item.textContent = text;
    eventRailEl.appendChild(item);
    eventRailEl.scrollTop = eventRailEl.scrollHeight;
  }

  /* ---------- Step rendering ---------- */

  function makeChoiceButton(labelText, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-choice";
    btn.textContent = labelText;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderScenarioStep() {
    setStatus(1, "choose a scenario");
    clearChildren(inputAreaEl);
    var grid = document.createElement("div");
    grid.className = "choice-grid";
    SCENARIOS.forEach(function (scenario) {
      grid.appendChild(
        makeChoiceButton(scenario.label, function () {
          state.scenario = scenario;
          callerSay(scenario.label);
          state.step = 1;
          renderFieldList();
          addEvent("Identifying issue category: " + scenario.category + ".");
          renderUrgencyStep();
        })
      );
    });
    inputAreaEl.appendChild(grid);
  }

  function renderUrgencyStep() {
    setStatus(2, "how urgent is this?");
    agentSay(
      "Got it — " + state.scenario.issue.toLowerCase() + ". How urgent is this for you?"
    );
    clearChildren(inputAreaEl);
    var grid = document.createElement("div");
    grid.className = "choice-grid";
    URGENCY_OPTIONS.forEach(function (opt) {
      grid.appendChild(
        makeChoiceButton(opt.label, function () {
          state.urgency = opt;
          callerSay(opt.label);
          state.step = 2;
          renderFieldList();
          addEvent(
            opt.id === "emergency"
              ? "Flagging urgency: emergency (demo rule)."
              : "Flagging urgency: " + opt.label.toLowerCase() + "."
          );
          renderNameStep();
        })
      );
    });
    inputAreaEl.appendChild(grid);
  }

  function renderTextStep(opts) {
    // opts: { stepNumber, statusText, prompt, fieldLabel, inputType, onSubmit }
    setStatus(opts.stepNumber, opts.statusText);
    agentSay(opts.prompt);
    clearChildren(inputAreaEl);

    var form = document.createElement("form");
    form.className = "text-input-row";
    form.noValidate = true;

    var field = document.createElement("div");
    field.className = "field";

    var inputId = "demo-field-" + opts.stepNumber;
    var label = document.createElement("label");
    label.setAttribute("for", inputId);
    label.textContent = opts.fieldLabel;

    var input = document.createElement("input");
    input.type = opts.inputType || "text";
    input.id = inputId;
    input.name = inputId;
    input.required = true;
    input.autocomplete = "off";
    input.maxLength = 80;

    field.appendChild(label);
    field.appendChild(input);
    form.appendChild(field);

    var submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "btn btn-primary";
    submit.textContent = "Continue";
    form.appendChild(submit);

    form.addEventListener("submit", function (evt) {
      evt.preventDefault();
      var value = input.value.trim();
      if (!value) {
        input.focus();
        return;
      }
      value = value.slice(0, 80);
      callerSay(value);
      opts.onSubmit(value);
    });

    inputAreaEl.appendChild(form);
    input.focus();
  }

  function renderNameStep() {
    renderTextStep({
      stepNumber: 3,
      statusText: "caller name",
      prompt: "Thanks. Can I get your name?",
      fieldLabel: "Your name (example)",
      inputType: "text",
      onSubmit: function (value) {
        state.name = value;
        renderFieldList();
        renderPhoneStep();
      }
    });
  }

  function renderPhoneStep() {
    renderTextStep({
      stepNumber: 4,
      statusText: "callback number",
      prompt: "And the best phone number to reach you at?",
      fieldLabel: "Phone number (example)",
      inputType: "tel",
      onSubmit: function (value) {
        state.phone = value;
        renderFieldList();
        renderLocationStep();
      }
    });
  }

  function renderLocationStep() {
    renderTextStep({
      stepNumber: 5,
      statusText: "service location",
      prompt: "What's the service address or city?",
      fieldLabel: "Service location (example)",
      inputType: "text",
      onSubmit: function (value) {
        state.location = value;
        renderFieldList();
        addEvent("Checking demo service area for “" + value + "”…");
        window.setTimeout(function () {
          addEvent("✓ Within demo service area (simulated business rule).");
        }, 400);
        renderTimeStep();
      }
    });
  }

  function renderTimeStep() {
    setStatus(6, "best time to call back");
    agentSay("Last question — when's the best time for someone to call you back?");
    clearChildren(inputAreaEl);
    var grid = document.createElement("div");
    grid.className = "choice-grid";
    TIME_OPTIONS.forEach(function (opt) {
      grid.appendChild(
        makeChoiceButton(opt.label, function () {
          state.callTime = opt;
          callerSay(opt.label);
          renderFieldList();
          renderSummary();
        })
      );
    });
    inputAreaEl.appendChild(grid);
  }

  function computeRoute() {
    if (state.scenario.id === "replacement") {
      return "Estimate request queued";
    }
    if (state.urgency.id === "emergency") {
      return "Routed to on-call technician";
    }
    return "Callback scheduled for requested window";
  }

  function isUrgent() {
    return state.urgency.id === "emergency";
  }

  function renderSummary() {
    agentSay(
      "Thanks, " +
        state.name +
        ". You're all set — the on-call team will reach out " +
        state.callTime.label.toLowerCase() +
        "."
    );
    clearChildren(inputAreaEl);
    stopTimer();
    statusEl.textContent = "Demo call complete — owner dashboard updated below";
    callTitleEl.textContent = "Call ended (simulated)";
    if (callStatusDotEl) {
      callStatusDotEl.classList.remove("call-status-live");
      callStatusDotEl.classList.add("call-status-ended");
    }

    var route = computeRoute();
    addEvent("Choosing route: " + route + ".");
    addEvent("Preparing owner notification (example only, not sent).");

    renderDashboard(route);
  }

  /* ---------- Owner dashboard ---------- */

  function buildLeadSummaryText() {
    return [
      "Lead Rescue — simulated lead summary",
      "Status: " + (isUrgent() ? "Urgent" : "Standard"),
      "Service category: " + state.scenario.category,
      "Issue: " + state.scenario.issue,
      "Urgency: " + state.urgency.label,
      "Caller: " + state.name,
      "Phone: " + state.phone,
      "Location: " + state.location,
      "Preferred callback window: " + state.callTime.label,
      "Recommended next action: " + computeRoute(),
      "(This is demo/simulated data, not a real caller.)"
    ].join("\n");
  }

  function buildTranscriptText() {
    return state.transcript
      .map(function (line) {
        var who = line.speaker === "agent" ? "Lead Rescue (demo)" : "Caller (you)";
        return who + ": " + line.text;
      })
      .join("\n");
  }

  function renderMetrics() {
    var metricsRow = document.getElementById("metrics-row");
    clearChildren(metricsRow);
    var metrics = [
      { label: "Leads captured (this simulation)", value: "1" },
      { label: "Calls processed (this simulation)", value: "1" },
      { label: "Urgent", value: isUrgent() ? "Yes" : "No" }
    ];
    metrics.forEach(function (m) {
      var card = document.createElement("div");
      card.className = "metric-card";
      var val = document.createElement("span");
      val.className = "metric-value";
      val.textContent = m.value;
      var lab = document.createElement("span");
      lab.className = "metric-label";
      lab.textContent = m.label;
      card.appendChild(val);
      card.appendChild(lab);
      metricsRow.appendChild(card);
    });
  }

  function renderLeadCard(route) {
    var badge = document.getElementById("lead-status-badge");
    badge.textContent = isUrgent() ? "Urgent" : "Standard";
    badge.className = "lead-status-badge " + (isUrgent() ? "badge-urgent" : "badge-standard");

    var details = document.getElementById("lead-details");
    clearChildren(details);
    var rows = [
      ["Service category", state.scenario.category],
      ["Issue", state.scenario.issue],
      ["Urgency", state.urgency.label],
      ["Caller", state.name],
      ["Phone", state.phone],
      ["Location", state.location],
      ["Preferred callback window", state.callTime.label],
      ["Recommended next action", route],
      ["Disposition", "Simulated — demo lead, not a real caller"]
    ];
    rows.forEach(function (row) {
      var dt = document.createElement("dt");
      dt.textContent = row[0];
      var dd = document.createElement("dd");
      dd.textContent = row[1];
      details.appendChild(dt);
      details.appendChild(dd);
    });
  }

  function renderNotificationPreview() {
    var preview = document.getElementById("notification-preview");
    clearChildren(preview);

    var header = document.createElement("div");
    header.className = "notification-header";
    header.textContent = "New lead — " + state.scenario.category + (isUrgent() ? " (URGENT)" : "");
    preview.appendChild(header);

    var body = document.createElement("div");
    body.className = "notification-body";
    var lines = [
      state.name + " — " + state.phone,
      state.location,
      state.scenario.issue + " · " + state.urgency.label,
      "Callback window: " + state.callTime.label
    ];
    lines.forEach(function (text) {
      var p = document.createElement("p");
      p.textContent = text;
      body.appendChild(p);
    });
    preview.appendChild(body);

    var footer = document.createElement("div");
    footer.className = "notification-footer";
    footer.textContent = "Example notification — not actually sent from this demo.";
    preview.appendChild(footer);
  }

  function renderTranscriptBlock() {
    var block = document.getElementById("transcript-list");
    clearChildren(block);
    state.transcript.forEach(function (line) {
      var row = document.createElement("p");
      row.className = "transcript-row " + (line.speaker === "agent" ? "transcript-agent" : "transcript-caller");
      var strong = document.createElement("strong");
      strong.textContent = (line.speaker === "agent" ? "Lead Rescue (demo): " : "Caller (you): ");
      row.appendChild(strong);
      row.appendChild(document.createTextNode(line.text));
      block.appendChild(row);
    });
  }

  function renderRecentCalls(route) {
    var body = document.getElementById("recent-calls-body");
    clearChildren(body);
    var now = new Date();
    var timeText = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

    var row = document.createElement("tr");
    [timeText, state.scenario.category, state.urgency.label, state.name, route].forEach(function (text) {
      var td = document.createElement("td");
      td.textContent = text;
      row.appendChild(td);
    });
    body.appendChild(row);
  }

  function renderDashboard(route) {
    renderMetrics();
    renderLeadCard(route);
    renderNotificationPreview();
    renderTranscriptBlock();
    renderRecentCalls(route);

    var dashboardSection = document.getElementById("dashboard");
    dashboardSection.hidden = false;
    dashboardSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function hideDashboard() {
    document.getElementById("dashboard").hidden = true;
    document.getElementById("copy-status").textContent = "";
  }

  /* ---------- Copy helpers ---------- */

  function copyText(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          onDone(true);
        })
        .catch(function () {
          onDone(false);
        });
    } else {
      onDone(false);
    }
  }

  function initDashboardActions() {
    var copySummaryBtn = document.getElementById("copy-summary");
    var copyTranscriptBtn = document.getElementById("copy-transcript");
    var replayBtn = document.getElementById("replay-demo");
    var statusEl2 = document.getElementById("copy-status");

    copySummaryBtn.addEventListener("click", function () {
      copyText(buildLeadSummaryText(), function (success) {
        statusEl2.textContent = success
          ? "Lead summary copied to clipboard."
          : "Couldn't copy automatically — select and copy the summary text manually.";
      });
    });

    copyTranscriptBtn.addEventListener("click", function () {
      copyText(buildTranscriptText(), function (success) {
        statusEl2.textContent = success
          ? "Transcript copied to clipboard."
          : "Couldn't copy automatically — select and copy the transcript manually.";
      });
    });

    replayBtn.addEventListener("click", function () {
      hideDashboard();
      startDemo();
      document.getElementById("demo-shell").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ---------- Demo lifecycle ---------- */

  function startDemo() {
    resetState();
    clearChildren(callLogEl);
    clearChildren(eventRailEl);
    var placeholder = document.createElement("li");
    placeholder.className = "event-placeholder";
    placeholder.textContent = "Actions will appear here as the call progresses.";
    eventRailEl.appendChild(placeholder);
    hideDashboard();
    renderFieldList();

    callTitleEl.textContent = "Incoming call — after hours (simulated)";
    if (callStatusDotEl) {
      callStatusDotEl.classList.add("call-status-live");
      callStatusDotEl.classList.remove("call-status-ended");
    }
    startTimer();

    agentSay(
      "Thanks for calling — our office is closed right now, and I'm an automated assistant. I can get " +
        "some details so the team can call you back. What's going on?"
    );
    renderScenarioStep();
  }

  function initDemo() {
    callLogEl = document.getElementById("call-log");
    inputAreaEl = document.getElementById("demo-input-area");
    statusEl = document.getElementById("demo-status");
    fieldListEl = document.getElementById("field-list");
    eventRailEl = document.getElementById("event-rail");
    callTitleEl = document.getElementById("call-title");
    callTimerEl = document.getElementById("call-timer");
    callStatusDotEl = document.getElementById("call-status-dot");

    document.getElementById("reset-demo").addEventListener("click", function () {
      hideDashboard();
      startDemo();
    });

    initDashboardActions();
    startDemo();
  }

  /* ---------- ROI calculator ---------- */

  function initRoiCalculator() {
    var callsInput = document.getElementById("roi-calls");
    var closeInput = document.getElementById("roi-close");
    var valueInput = document.getElementById("roi-value");
    var output = document.getElementById("roi-output");
    var explain = document.getElementById("roi-explain");

    function clampNumber(value) {
      var n = parseFloat(value);
      if (isNaN(n) || n < 0) {
        return 0;
      }
      return n;
    }

    function recalc() {
      var calls = clampNumber(callsInput.value);
      var closeRate = clampNumber(closeInput.value);
      var jobValue = clampNumber(valueInput.value);
      var closeRateFraction = Math.min(closeRate, 100) / 100;
      var recoverable = calls * closeRateFraction * jobValue;

      output.textContent =
        "$" +
        recoverable.toLocaleString(undefined, { maximumFractionDigits: 0 });
      explain.textContent =
        calls.toLocaleString() +
        " missed calls × " +
        Math.min(closeRate, 100) +
        "% close rate × $" +
        jobValue.toLocaleString() +
        " average job value";
    }

    [callsInput, closeInput, valueInput].forEach(function (input) {
      input.addEventListener("input", recalc);
    });

    recalc();
  }

  /* ---------- Copy-to-clipboard pilot request ---------- */

  function initCopyRequest() {
    var btn = document.getElementById("copy-request");
    var confirmEl = document.getElementById("copy-confirm");
    if (!btn) {
      return;
    }
    btn.addEventListener("click", function () {
      var info = getProspectInfo();
      var businessLine = info.business ? " for " + info.business : "";
      var message =
        "Hi — I'd like to request a 7-day Lead Rescue live pilot" +
        businessLine +
        " (no card, no contract). Please configure it around our actual missed-call, overflow, and after-hours call flow and confirm usage/telephony limits before activation.";

      copyText(message, function (success) {
        confirmEl.textContent = success
          ? "Copied — paste it into your reply email."
          : "Couldn't copy automatically — please select and copy the request text manually.";
      });
    });
  }

  /* ---------- Init ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    applyPersonalization();
    initDemo();
    initRoiCalculator();
    initCopyRequest();
  });
})();
