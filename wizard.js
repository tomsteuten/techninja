const TECHNINJA_BUILD = "2025-03-16";
const TECHNINJA_DATA_VERSION = "0.4";

(function () {
  var machines = [];
  var currentMachine = null;
  var currentSymptom = null;
  var stepHistory = [];
  var currentStepId = null;

  function $(id) { return document.getElementById(id); }

  var SESSION_KEY = "techninja.session.v1";

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function loadSession() {
    var raw = null;
    try { raw = localStorage.getItem(SESSION_KEY); } catch (e) {}
    if (!raw) return null;
    var s = safeJsonParse(raw);
    if (!s || s.v !== 1) return null;
    return s;
  }

  function saveSession(partial) {
    // Partial saves are allowed (e.g. machine selected but symptom not started yet).
    var s = {
      v: 1,
      ts: Date.now(),
      machineId: (currentMachine && currentMachine.id) || null,
      symptomId: (currentSymptom && currentSymptom.id) || null,
      stepId: currentStepId || null,
      history: Array.isArray(stepHistory) ? stepHistory.slice(0) : []
    };
    if (partial && typeof partial === "object") {
      for (var k in partial) { s[k] = partial[k]; }
    }
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
    renderResumeBar();
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    renderResumeBar();
  }

  function fmtTime(ts) {
    if (!ts) return "";
    try {
      var d = new Date(ts);
      return d.toLocaleString();
    } catch (e) { return ""; }
  }

  function renderResumeBar() {
    var bar = $("resumeBar");
    if (!bar) return;
    var s = loadSession();
    if (!s || !s.machineId) {
      bar.style.display = "none";
      return;
    }
    // Only show resume if the stored machine exists in the current registry.
    var m = machines.find(function (x) { return x.id === s.machineId; });
    if (!m) { bar.style.display = "none"; return; }

    var meta = $("resumeMeta");
    if (meta) {
      var parts = [];
      parts.push(m.name || s.machineId);
      if (s.symptomId) parts.push("symptom: " + s.symptomId);
      if (s.stepId) parts.push("step: " + s.stepId);
      var when = fmtTime(s.ts);
      if (when) parts.push("saved: " + when);
      meta.textContent = parts.join(" • ");
    }

    var resumeBtn = $("resumeBtn");
    if (resumeBtn) resumeBtn.onclick = function () {
      resumeFromSession(s);
    };

    var clearBtn = $("clearResumeBtn");
    if (clearBtn) clearBtn.onclick = function () { clearSession(); };

    bar.style.display = "flex";
  }

  function resumeFromSession(s) {
    if (!s || !s.machineId) return;
    var m = machines.find(function (x) { return x.id === s.machineId; });
    if (!m) return;

    currentMachine = m;
    highlightMachine();
    resetSymptomAndWizard();

    fetch(currentMachine.config).then(function (resp) {
      return resp.json();
    }).then(function (cfg) {
      currentMachine.configData = cfg;
      renderSymptoms();

      // Restore symptom + step if possible.
      var sym = null;
      if (s.symptomId) {
        sym = (cfg.symptoms || []).find(function (x) { return x.id === s.symptomId; });
      }
      if (sym) {
        currentSymptom = sym;
        stepHistory = Array.isArray(s.history) ? s.history.slice(0) : [];
        currentStepId = s.stepId || sym.start;
        renderCurrentStep();
      }
    }).catch(function () {});
  }

  function renderResultTags(result) {
    var el = $("resultTags");
    if (!el) return;
    el.innerHTML = "";
    if (!result) return;

    // Confidence / uncertainty metadata (optional, additive)
    // Example schema:
    // result.confidence = { level: "high"|"medium"|"low"|"unknown", score: 0-100?, basis: "confirmed"|"manual"|"anecdotal"? }
    // result.provenance = { sources: ["manual","tech"], lastConfirmed: "YYYY-MM-DD", addedBy: "name/initials"? }
    if (result.confidence && result.confidence.level) {
      var lvl = String(result.confidence.level).toUpperCase();
      addPill(el, "CONFIDENCE: " + lvl);
    }
    if (result.confidence && typeof result.confidence.score === "number") {
      addPill(el, "SCORE: " + Math.round(result.confidence.score) + "/100");
    }
    if (result.provenance && Array.isArray(result.provenance.sources) && result.provenance.sources.length) {
      addPill(el, "SOURCE: " + result.provenance.sources.join(", "));
    }
    if (result.provenance && result.provenance.lastConfirmed) {
      addPill(el, "CONFIRMED: " + result.provenance.lastConfirmed);
    }
  }

  function addPill(container, text) {
    var p = document.createElement("div");
    p.className = "pill";
    p.textContent = text;
    container.appendChild(p);
  }


  function loadMachines() {
    // Primary source of truth: machines/index.json (additive, supports multi-machine).
    // Fallback: hardcoded list for survivability if index.json is missing or invalid.
    function useFallback() {
      machines = [
        {
          id: "mastrena2",
          name: "Mastrena II",
          subtitle: "Superauto espresso",
          tag: "Coffee",
          config: "machines/mastrena2.json"
        }
      ];
      renderMachines();
      renderResumeBar();
      if (machines.length === 1) {
        selectMachine(machines[0].id);
      }
    }

    fetch("machines/index.json").then(function (resp) {
      if (!resp || !resp.ok) throw new Error("index fetch failed");
      return resp.json();
    }).then(function (idx) {
      if (!idx || !Array.isArray(idx.machines)) throw new Error("bad index schema");
      machines = idx.machines;
      renderMachines();
      renderResumeBar();
      if (machines.length === 1) {
        selectMachine(machines[0].id);
      }
    }).catch(function () {
      useFallback();
    });
  }

  function renderMachines() {
    var list = $("machineList");
    list.innerHTML = "";
    machines.forEach(function (m) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "machine-btn";
      btn.setAttribute("data-id", m.id);

      var leftWrap = document.createElement("div");
      leftWrap.style.display = "flex";
      leftWrap.style.flexDirection = "column";

      var mainSpan = document.createElement("span");
      mainSpan.className = "main";
      mainSpan.textContent = m.name;
      leftWrap.appendChild(mainSpan);

      var subSpan = document.createElement("span");
      subSpan.className = "sub";
      subSpan.textContent = m.subtitle || "";
      leftWrap.appendChild(subSpan);

      btn.appendChild(leftWrap);

      var tagSpan = document.createElement("span");
      tagSpan.className = "tag";
      tagSpan.textContent = m.tag || "Machine";
      btn.appendChild(tagSpan);

      btn.onclick = function () { selectMachine(m.id); };

      list.appendChild(btn);
    });
  }

  function selectMachine(machineId) {
    currentMachine = machines.find(function (m) { return m.id === machineId; });
    highlightMachine();
    resetSymptomAndWizard();
    saveSession({ machineId: machineId, symptomId: null, stepId: null, history: [] });

    if (!currentMachine) return;
    fetch(currentMachine.config).then(function (resp) {
      return resp.json();
    }).then(function (cfg) {
      currentMachine.configData = cfg;
      renderSymptoms();
      $("contextTitle").textContent = "2. Select symptom for " + (currentMachine.name || "");
      $("contextSubtitle").textContent = "Tap a symptom to start a guided troubleshooting flow.";
    }).catch(function () {
      $("symptomList").innerHTML = "<div style='font-size:12px;color:#fca5a5;'>Could not load machine data.</div>";
    });
  }

  function highlightMachine() {
    var list = $("machineList");
    var children = list.querySelectorAll(".machine-btn");
    for (var i = 0; i < children.length; i++) {
      var id = children[i].getAttribute("data-id");
      if (currentMachine && id === currentMachine.id) {
        children[i].classList.add("active");
      } else {
        children[i].classList.remove("active");
      }
    }
  }

  function resetSymptomAndWizard() {
    currentSymptom = null;
    currentStepId = null;
    stepHistory = [];
    $("symptomList").innerHTML = "";
    $("wizardStep").classList.remove("active");
  }

  function renderSymptoms() {
    var panel = $("symptomList");
    panel.innerHTML = "";
    if (!currentMachine || !currentMachine.configData || !currentMachine.configData.symptoms) {
      panel.innerHTML = "<div style='font-size:12px;color:#9ca3af;'>No symptom data for this machine.</div>";
      return;
    }
    currentMachine.configData.symptoms.forEach(function (s) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "symptom-btn";
      btn.setAttribute("data-id", s.id);

      var left = document.createElement("div");
      left.style.display = "flex";
      left.style.flexDirection = "column";

      var t = document.createElement("span");
      t.className = "title";
      t.textContent = s.name;
      left.appendChild(t);

      if (s.description) {
        var d = document.createElement("span");
        d.className = "desc";
        d.textContent = s.description;
        left.appendChild(d);
      }

      btn.appendChild(left);
      btn.onclick = function () { startSymptom(s.id); };

      panel.appendChild(btn);
    });
  }

  function startSymptom(symptomId) {
    if (!currentMachine || !currentMachine.configData) return;
    var s = (currentMachine.configData.symptoms || []).find(function (x) { return x.id === symptomId; });
    if (!s) return;
    currentSymptom = s;
    stepHistory = [];
    currentStepId = s.start;
    renderCurrentStep();
    saveSession();
  }

  function renderCurrentStep() {
    if (!currentMachine || !currentSymptom || !currentMachine.configData) return;
    var steps = currentMachine.configData.steps || {};
    var step = steps[currentStepId];
    if (!step) return;

    $("wizardStep").classList.add("active");
    $("symptomList").style.display = "flex";

    var label = "Step " + (stepHistory.length + 1);
    $("stepLabel").textContent = label;
    $("stepText").textContent = step.text || "";
    $("stepNote").textContent = step.note || "";

    var resultBlock = $("resultBlock");
    var optionGrid = $("optionGrid");
    optionGrid.innerHTML = "";

    var isResult = !!step.result;
    if (isResult) {
      resultBlock.style.display = "block";
      $("resultTitle").textContent = step.result.title || "Summary";
      renderResultSection("resultLikely", "MOST LIKELY CAUSE", step.result.likelyCause);
      renderResultList("resultField", "FIELD FIX (WHAT TECHS ACTUALLY DO)", step.result.fieldFix);
      renderResultList("resultOfficial", "OFFICIAL / MANUAL STEPS", step.result.official);
      renderResultList("resultWarnings", "WARNINGS / SAFETY", step.result.warnings);
      renderResultTags(step.result);

      addOptionButton(optionGrid, "Restart this symptom", "primary", function () {
        startSymptom(currentSymptom.id);
      });
      addOptionButton(optionGrid, "Choose another symptom", "secondary", function () {
        $("wizardStep").classList.remove("active");
        $("symptomList").style.display = "flex";
        currentSymptom = null;
        currentStepId = null;
        stepHistory = [];
        saveSession({ symptomId: null, stepId: null, history: [] });
      });
    } else {
      resultBlock.style.display = "none";
      renderResultTags(null);
      var opts = step.options || [];
      if (!opts.length) {
        addOptionButton(optionGrid, "End", "primary", function () {});
      } else {
        for (var i = 0; i < opts.length; i++) {
          (function (opt) {
            var klass = opt.primary ? "primary" : "secondary";
            addOptionButton(optionGrid, opt.label, klass, function () {
              goToStep(opt.next);
            });
          })(opts[i]);
        }
      }
    }

    $("backStepBtn").disabled = stepHistory.length === 0;
    $("restartSymptomBtn").disabled = !currentSymptom;
  }

  function renderResultSection(elementId, title, text) {
    var el = $(elementId);
    if (!text) {
      el.innerHTML = "";
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    el.innerHTML = "<div class='result-section-title'>" + title + "</div><div style='font-size:12px;'>" + escapeHtml(text) + "</div>";
  }

  function renderResultList(elementId, title, arr) {
    var el = $(elementId);
    if (!arr || !arr.length) {
      el.innerHTML = "";
      el.style.display = "none";
      return;
    }
    var html = "<div class='result-section-title'>" + title + "</div><ul class='result-list'>";
    for (var i = 0; i < arr.length; i++) {
      html += "<li>" + escapeHtml(arr[i]) + "</li>";
    }
    html += "</ul>";
    el.style.display = "block";
    el.innerHTML = html;
  }

  function addOptionButton(container, label, style, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn " + (style || "");
    btn.textContent = label;
    btn.onclick = onClick;
    container.appendChild(btn);
  }

  function goToStep(nextId) {
    if (!currentMachine || !currentSymptom || !currentMachine.configData) return;
    if (!nextId) return;
    stepHistory.push(currentStepId);
    currentStepId = nextId;
    renderCurrentStep();
    saveSession();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function onBackStep() {
    if (!stepHistory.length) return;
    currentStepId = stepHistory.pop();
    renderCurrentStep();
    saveSession();
  }

  function onRestartSymptom() {
    if (!currentSymptom) return;
    startSymptom(currentSymptom.id);
    saveSession();
  }

  function init() {
    $("backStepBtn").onclick = onBackStep;
    $("restartSymptomBtn").onclick = onRestartSymptom;
    loadMachines();

    if ("serviceWorker" in navigator) {
      try {
        if (location.protocol === "http:" || location.protocol === "https:") {
          navigator.serviceWorker.register("service-worker.js").catch(function () {});
        }
      } catch (e) {}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
