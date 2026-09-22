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
        "Capture the HVAC calls " + info.business + " misses after hours.";
    }
    if (note) {
      var text = "Personalized preview for " + info.business;
      if (info.city) {
        text += " in " + info.city;
      }
      text += ". No live phone line is connected — this is an interactive demo.";
      note.textContent = text;
      note.hidden = false;
    }
    var ctaLede = document.getElementById("cta-lede");
    if (ctaLede) {
      ctaLede.textContent =
        "Reply to the email that sent you this demo and we'll configure a live pilot around " +
        info.business +
        "'s actual call flow.";
    }
    document.title = "Lead Rescue — a demo built for " + info.business;
  }

  /* ---------- Speech synthesis (optional, muted-capable) ---------- */

  var speechEnabled = true;
  var synth = window.speechSynthesis || null;

  function speak(text) {
    if (!speechEnabled || !synth) {
      return;
    }
    try {
      synth.cancel();
      var utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1;
      utter.pitch = 1;
      synth.speak(utter);
    } catch (err) {
      /* speech synthesis is optional; ignore failures */
    }
  }

  function initMuteToggle() {
    var btn = document.getElementById("mute-toggle");
    var label = document.getElementById("mute-label");
    var icon = document.getElementById("mute-icon");
    if (!btn) {
      return;
    }
    if (!synth) {
      speechEnabled = false;
      btn.disabled = true;
      label.textContent = "Voice: unsupported";
      return;
    }
    btn.addEventListener("click", function () {
      speechEnabled = !speechEnabled;
      btn.setAttribute("aria-pressed", String(!speechEnabled));
      label.textContent = speechEnabled ? "Voice: on" : "Voice: off";
      icon.textContent = speechEnabled ? "🔊" : "🔇";
      if (!speechEnabled && synth) {
        synth.cancel();
      }
    });
  }

  /* ---------- Call simulation ---------- */

  var SCENARIOS = [
    { id: "no-heat", label: "No heat", issue: "No heat" },
    { id: "no-cooling", label: "No cooling", issue: "No cooling / AC not working" },
    { id: "water-boiler", label: "Water / boiler issue", issue: "Water leak or boiler issue" },
    { id: "replacement", label: "Replacement quote", issue: "Interested in a replacement quote" }
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

  var state = {
    step: 0,
    scenario: null,
    urgency: null,
    name: "",
    phone: "",
    location: "",
    callTime: null
  };

  var callLogEl, inputAreaEl, statusEl, summaryCard, summaryList;

  function resetState() {
    state = {
      step: 0,
      scenario: null,
      urgency: null,
      name: "",
      phone: "",
      location: "",
      callTime: null
    };
  }

  function clearLog() {
    while (callLogEl.firstChild) {
      callLogEl.removeChild(callLogEl.firstChild);
    }
  }

  function clearInputArea() {
    while (inputAreaEl.firstChild) {
      inputAreaEl.removeChild(inputAreaEl.firstChild);
    }
  }

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
  }

  function agentSay(text) {
    appendLogLine("agent", text);
    speak(text);
  }

  function callerSay(text) {
    appendLogLine("caller", text);
  }

  function setStatus(stepNumber, description) {
    statusEl.textContent = "Step " + stepNumber + " of " + TOTAL_STEPS + " — " + description;
  }

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
    clearInputArea();
    var grid = document.createElement("div");
    grid.className = "choice-grid";
    SCENARIOS.forEach(function (scenario) {
      grid.appendChild(
        makeChoiceButton(scenario.label, function () {
          state.scenario = scenario;
          callerSay(scenario.label);
          state.step = 1;
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
    clearInputArea();
    var grid = document.createElement("div");
    grid.className = "choice-grid";
    URGENCY_OPTIONS.forEach(function (opt) {
      grid.appendChild(
        makeChoiceButton(opt.label, function () {
          state.urgency = opt;
          callerSay(opt.label);
          state.step = 2;
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
    clearInputArea();

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
        renderTimeStep();
      }
    });
  }

  function renderTimeStep() {
    setStatus(6, "best time to call back");
    agentSay("Last question — when's the best time for someone to call you back?");
    clearInputArea();
    var grid = document.createElement("div");
    grid.className = "choice-grid";
    TIME_OPTIONS.forEach(function (opt) {
      grid.appendChild(
        makeChoiceButton(opt.label, function () {
          state.callTime = opt;
          callerSay(opt.label);
          renderSummary();
        })
      );
    });
    inputAreaEl.appendChild(grid);
  }

  function renderSummary() {
    agentSay(
      "Thanks, " +
        state.name +
        ". You're all set — the on-call team will reach out " +
        state.callTime.label.toLowerCase() +
        "."
    );
    clearInputArea();
    statusEl.textContent = "Demo complete — Lead Rescue summary below";

    var rows = [
      ["Issue", state.scenario.issue],
      ["Urgency", state.urgency.label],
      ["Name", state.name],
      ["Phone", state.phone],
      ["Location", state.location],
      ["Requested callback window", state.callTime.label]
    ];

    while (summaryList.firstChild) {
      summaryList.removeChild(summaryList.firstChild);
    }
    rows.forEach(function (row) {
      var dt = document.createElement("dt");
      dt.textContent = row[0];
      var dd = document.createElement("dd");
      dd.textContent = row[1];
      summaryList.appendChild(dt);
      summaryList.appendChild(dd);
    });

    summaryCard.hidden = false;
    summaryCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function startDemo() {
    resetState();
    clearLog();
    summaryCard.hidden = true;
    agentSay(
      "Thanks for calling — our office is closed right now, but I can get some details so the team can call you back. What's going on?"
    );
    renderScenarioStep();
  }

  function initDemo() {
    callLogEl = document.getElementById("call-log");
    inputAreaEl = document.getElementById("demo-input-area");
    statusEl = document.getElementById("demo-status");
    summaryCard = document.getElementById("summary-card");
    summaryList = document.getElementById("summary-list");

    document.getElementById("reset-demo").addEventListener("click", startDemo);
    document.getElementById("replay-demo").addEventListener("click", startDemo);

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
        "Hi — I'd like to set up a Lead Rescue live pilot" +
        businessLine +
        ". Please configure it around our actual after-hours call flow and confirm usage/telephony limits before activation.";

      function showConfirm(success) {
        confirmEl.textContent = success
          ? "Copied — paste it into your reply email."
          : "Couldn't copy automatically — please select and copy the request text manually.";
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(message)
          .then(function () {
            showConfirm(true);
          })
          .catch(function () {
            showConfirm(false);
          });
      } else {
        showConfirm(false);
      }
    });
  }

  /* ---------- Init ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    applyPersonalization();
    initMuteToggle();
    initDemo();
    initRoiCalculator();
    initCopyRequest();
  });
})();
