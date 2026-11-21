(() => {
  'use strict';
  const Engine = window.CampusSageEngine;
  const $ = id => document.getElementById(id);
  const ui = {
    source:$('source'), policy:$('policy'), question:$('question'), testCase:$('test-case'), testId:$('test-id'), criterion:$('criterion'),
    status:$('retrieval-status'), evidence:$('evidence'), prompt:$('prompt'), answer:$('answer'), model:$('model'), settings:$('settings'),
    result:$('result-status'), saveStatus:$('save-status'), sourceStatus:$('source-status')
  };
  let lastResult = null;
  let lastPrompt = '';

  function setStatus(text, tone='') {
    ui.status.textContent = text;
    ui.status.className = `status${tone ? ` ${tone}` : ''}`;
  }
  function renderEvidence(result) {
    lastResult = result;
    if (result.kind === 'match') {
      ui.evidence.textContent = `${result.clause.section}: ${result.clause.text}\n\nMatched query terms: ${result.clause.hits.join(', ')}\nQuery coverage: ${Math.round(result.coverage * 100)}% (retrieval indicator, not model confidence)`;
      setStatus(`Evidence found · ${result.clause.section}`, 'success');
    } else if (result.kind === 'ambiguous') {
      ui.evidence.textContent = result.matches.map(item => `${item.section}: ${item.text}`).join('\n\n');
      setStatus(result.message, 'warn');
    } else {
      ui.evidence.textContent = result.message || 'No supporting excerpt was found.';
      setStatus(result.kind === 'invalid' ? result.message : 'No evidence match · prompt will abstain', 'warn');
    }
  }
  function findEvidence() {
    renderEvidence(Engine.rankEvidence(ui.question.value, ui.policy.value));
    lastPrompt = '';
    ui.prompt.textContent = 'Generate evidence first, then prepare the prompt.';
  }
  function composePrompt() {
    const result = Engine.rankEvidence(ui.question.value, ui.policy.value);
    renderEvidence(result);
    if (result.kind === 'invalid') {
      ui.prompt.textContent = result.message;
      lastPrompt = '';
      return;
    }
    lastPrompt = Engine.buildPrompt(ui.question.value, ui.source.value, result);
    ui.prompt.textContent = lastPrompt;
  }
  function loadCase(testCase) {
    if (!testCase) return;
    ui.question.value = testCase.question;
    ui.testId.value = testCase.id;
    ui.criterion.textContent = `${testCase.type}: ${testCase.criterion}`;
    ui.answer.value = '';
    ui.result.value = 'Unrated';
    ui.saveStatus.textContent = '';
    findEvidence();
  }
  function saveRun() {
    if (!lastPrompt) composePrompt();
    if (!ui.answer.value.trim()) {
      ui.saveStatus.textContent = 'Paste the actual model response before exporting a run record.';
      return;
    }
    if (!ui.model.value.trim()) {
      ui.saveStatus.textContent = 'Enter the model name/version used before exporting.';
      return;
    }
    const record = {
      project:'CampusSage',
      app_version:'2.0',
      test_case_id:ui.testId.value.trim() || null,
      question:ui.question.value.trim(),
      policy_source_version:ui.source.value.trim(),
      retrieved_status:lastResult?.kind || 'unknown',
      retrieved_sections:lastResult?.kind === 'match' ? [lastResult.clause.section] : lastResult?.kind === 'ambiguous' ? lastResult.matches.map(item => item.section) : [],
      evidence:Engine.evidenceFor(lastResult),
      prompt:lastPrompt,
      model_name_version:ui.model.value.trim(),
      settings:ui.settings.value.trim() || 'Not recorded',
      actual_model_response:ui.answer.value.trim(),
      evaluation_result:ui.result.value,
      created_at:new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(record, null, 2)], {type:'application/json'});
    const link = document.createElement('a');
    const safeId = (record.test_case_id || 'manual').replace(/[^a-z0-9_-]/gi, '_');
    link.href = URL.createObjectURL(blob);
    link.download = `campussage-${safeId}-run.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    ui.saveStatus.textContent = 'Run record downloaded. Check the answer, model details, and privacy before sharing it.';
  }

  for (const testCase of Engine.TEST_CASES) {
    const option = document.createElement('option');
    option.value = testCase.id;
    option.textContent = `${testCase.id} · ${testCase.type} · ${testCase.expectedSection}`;
    ui.testCase.appendChild(option);
  }
  ui.testCase.addEventListener('change', () => {
    const testCase = Engine.TEST_CASES.find(item => item.id === ui.testCase.value);
    if (testCase) ui.criterion.textContent = `${testCase.type}: ${testCase.criterion}`;
  });
  $('load-case').addEventListener('click', () => loadCase(Engine.TEST_CASES.find(item => item.id === ui.testCase.value)));
  $('retrieve').addEventListener('click', findEvidence);
  $('make-prompt').addEventListener('click', composePrompt);
  $('copy-prompt').addEventListener('click', async () => {
    if (!lastPrompt) composePrompt();
    if (!lastPrompt) return;
    try {
      await navigator.clipboard.writeText(lastPrompt);
      ui.saveStatus.textContent = 'Prompt copied. Run it in the model you record below.';
    } catch {
      ui.saveStatus.textContent = 'Clipboard access is unavailable. Select and copy the prompt text manually.';
    }
  });
  $('save-run').addEventListener('click', saveRun);
  $('reload-fixture').addEventListener('click', () => {
    ui.source.value = Engine.POLICY_SOURCE;
    ui.policy.value = Engine.POLICY_FIXTURE;
    ui.sourceStatus.textContent = 'Paraphrased 2024-25 demo fixture restored; verify current official text before use.';
    findEvidence();
  });
  $('clear-policy').addEventListener('click', () => {
    ui.policy.value = '';
    ui.sourceStatus.textContent = 'Policy text cleared from this page.';
    findEvidence();
  });
  ui.question.addEventListener('input', () => { lastPrompt = ''; });
  ui.policy.addEventListener('input', () => { lastPrompt = ''; });
  ui.source.addEventListener('input', () => { lastPrompt = ''; });
  const defaultCase = Engine.TEST_CASES[0];
  ui.testCase.value = defaultCase.id;
  ui.testId.value = defaultCase.id;
  ui.criterion.textContent = `${defaultCase.type}: ${defaultCase.criterion}`;
  renderEvidence(Engine.rankEvidence(ui.question.value, ui.policy.value));
})();
