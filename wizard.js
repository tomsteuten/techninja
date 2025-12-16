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

  /* =========================
     SESSION HANDLING
  ========================== */

  function loadSession() {
    var raw = null;
    try { raw = localStorage.getItem(SESSION_KEY); } catch (e) {}
    if (!raw) return null;
    var s = safeJsonParse(raw);
    if (!s || s.v !== 1) return null;
    return s;
  }

  function saveSession(partial) {
    var s = {
      v: 1,
      ts: Date.now(),
      machineId: (currentMachine && currentMachine.id) || null,
      symptomId: (currentSymptom && currentSymptom.id) || null,
      stepId: currentStepId || null,
      history: Array.isArray(stepHistory) ? stepHistory.slice(0) : []
    };
    if (partial && typeof partial === "object") {
      for (var k in partial) s[k] = partial[k];
    }
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
    renderResumeBar();
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    renderResumeBar();
  }

  /* =========================
     DEV WARNINGS (FAIL-LOUD)
  ========================== */

  function warn(msg, extra) {
    console.warn("[TechNinja]", msg, extra || "");
  }

  function error(msg, extra) {
    console.error("[TechNinja]", msg, extra || "");
  }

  function warnOnMachineIndex(idx) {
    if (!idx || !Array.isArray(idx.machines)) {
      warn("machines/index.json missing or invalid");
      return;
    }
    idx.machines.forEach(function (m) {
      if (!m.id) warn("Machine entry missing id", m);
      if (!m.config) warn("Machine entry missing config path", m);
    });
  }

  function warnOnMachineData(machine) {
    if (!machine || !machine.steps) {
      warn("Machine config has no steps", machine);
      return;
    }

    var stepIds = new Set(Object.keys(machine.steps));

    (machine.symptoms || []).forEach(function (s) {
      if (!stepIds.has(s.start)) {
        warn(`Symptom "${s.id}" starts at missing step "${s.start}"`);
      }
    });

    Object.keys(machine.steps).forEach(function (id) {
      var step = machine.steps[id];
      if (step.next && !stepIds.has(step.next)) {
        warn(`Step "${id}" points to missing next "${step.next}"`);
      }
      if (step.result && !step.result.confidence) {
        warn(`Result at step "${id}" missing confidence metadata`);
      }
    });
  }

  /* =========================
     MACHINE LOADING
  ========================== */

  function loadMachines() {
    function useFallback() {
      warn("Using fallback machine list");
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
      if (machines.length === 1) selectMachine(machines[0].id);
    }

    fetch("machines/index.json")
      .then(function (resp) {
        if (!resp.ok) throw new Error("Fetch failed");
        return resp.json();
      })
      .then(function (idx) {
        warnOnMachineIndex(idx);
        machines = idx.machines;
        renderMachines();
        renderResumeBar();
        if (machines.length === 1) selectMachine(machines[0].id);
      })
      .catch(function (e) {
        error("Failed to load machines/index.json", e);
        useFallback();
      });
  }

  function renderMachines() {
    var list = $("machineList");
    if (!list) return;
    list.innerHTML = "";
    machines.forEach(function (m) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "machine-btn";
      btn.dataset.id = m.id;

      var main = document.createElement("span");
      main.className = "main";
      main.textContent = m.name;
      btn.appendChild(main);

      var sub = document.createElement("span");
      sub.className = "sub";
      sub.textContent = m.subtitle || "";
      btn.appendChild(sub);

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

    fetch(currentMachine.config)
      .then(function (r) {
        if (!r.ok) throw new Error("Config fetch failed");
        return r.json();
      })
      .then(function (cfg) {
        currentMachine.configData = cfg;
        warnOnMachineData(cfg);
        renderSymptoms();
        $("contextTitle").textContent = "2. Select symptom for " + currentMachine.name;
      })
      .catch(function (e) {
        error("Failed to load machine config", e);
        $("symptomList").innerHTML =
          "<div style='font-size:12px;color:#fca5a5;'>Could not load machine data.</div>";
      });
  }

  function highlightMachine() {
    var list = $("machineList");
    if (!list) return;
    Array.from(list.children).forEach(function (el) {
      el.classList.toggle(
        "active",
        currentMachine && el.dataset.id === currentMachine.id
      );
    });
  }

  function resetSymptomAndWizard() {
    currentSymptom = null;
    currentStepId = null;
    stepHistory = [];
    $("symptomList").innerHTML = "";
    $("wizardStep").classList.remove("active");
  }

  /* =========================
     SYMPTOMS + STEPS
  ========================== */

  function renderSymptoms() {
    var panel = $("symptomList");
    panel.innerHTML = "";
    var cfg = currentMachine && currentMachine.configData;
    if (!cfg || !cfg.symptoms) {
      panel.innerHTML =
        "<div style='font-size:12px;color:#9ca3af;'>No symptom data.</div>";
      return;
    }

    cfg.symptoms.forEach(function (s) {
      var btn = document.createElement("button");
      btn.className = "symptom-btn";
      btn.textContent = s.name;
      btn.onclick = function () { startSymptom(s.id); };
      panel.appendChild(btn);
    });
  }

  function startSymptom(symptomId) {
    var cfg = currentMachine.configData;
    currentSymptom = cfg.symptoms.find(function (s) { return s.id === symptomId; });
    stepHistory = [];
    currentStepId = currentSymptom.start;
    renderCurrentStep();
    saveSession();
  }

  function renderCurrentStep() {
    var steps = currentMachine.configData.steps;
    var step = steps[currentStepId];
    if (!step) {
      error("Missing step", currentStepId);
      return;
    }

    $("wizardStep").classList.add("active");
    $("stepText").textContent = step.text || "";

    var optionGrid = $("optionGrid");
    optionGrid.innerHTML = "";

    if (step.result) {
      $("resultTitle").textContent = step.result.title || "Result";
      renderResultTags(step.result);
      addOptionButton(optionGrid, "Restart symptom", "primary", function () {
        startSymptom(currentSymptom.id);
      });
    } else {
      (step.options || []).forEach(function (opt) {
        addOptionButton(optionGrid, opt.label, "secondary", function () {
          goToStep(opt.next);
        });
      });
    }
  }

  function addOptionButton(container, label, style, onClick) {
    var btn = document.createElement("button");
    btn.className = "option-btn " + style;
    btn.textContent = label;
    btn.onclick = onClick;
    container.appendChild(btn);
  }

  function goToStep(nextId) {
    if (!nextId) return;
    stepHistory.push(currentStepId);
    currentStepId = nextId;
    renderCurrentStep();
    saveSession();
  }

  /* =========================
     RESULT TAGS
  ========================== */

  function renderResultTags(result) {
    var el = $("resultTags");
    if (!el) return;
    el.innerHTML = "";

    if (result && result.confidence) {
      var pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = "CONFIDENCE: " + result.confidence.toUpperCase();
      el.appendChild(pill);
    }
  }

  /* =========================
     INIT + VERSION STAMP
  ========================== */

  function init() {
    $("backStepBtn").onclick = function () {
      if (!stepHistory.length) return;
      currentStepId = stepHistory.pop();
      renderCurrentStep();
      saveSession();
    };

    loadMachines();

    var versionEl = $("techninja-version");
    if (versionEl) {
      versionEl.textContent =
        `TechNinja • Build ${TECHNINJA_BUILD} • Data v${TECHNINJA_DATA_VERSION}`;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
