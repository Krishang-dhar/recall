// Recall Flow — Content Script (Manifest V3)
// Always-present draggable floating orb, smooth expansion capsule, silence VAD, zero disappearance bug, and zero TTS.

(function () {
  if (window.__RECALL_FLOW_INITIALIZED__) return;
  window.__RECALL_FLOW_INITIALIZED__ = true;

  let isExpanded = false;
  let currentPhase = 'idle'; // idle | listening | understanding | writing | acting | ask | success | error | needs_choice
  let recognition = null;
  let mediaStream = null;
  let audioContext = null;
  let analyserNode = null;
  let animFrameId = null;
  let currentVolume = 0;
  let currentTranscript = '';
  let activeFieldTarget = null;
  let savedSelection = null;
  let hostContainer = null;
  let shadowRoot = null;
  let autoCloseTimer = null;
  let silenceTimer = null;
  let abortController = null;
  let hasSpoken = false;

  // Draggable position coordinates
  let savedPosition = null;

  // Load saved position & guide status from chrome.storage
  try {
    chrome.storage.local.get(['recall_flow_position', 'recall_flow_guide_seen'], (res) => {
      if (res && res.recall_flow_position) {
        savedPosition = res.recall_flow_position;
      }
      renderUI();
    });
  } catch (e) {
    renderUI();
  }

  let lastKnownActiveField = null;

  document.addEventListener('focusin', (e) => {
    let el = e.target;
    if (!el || (hostContainer && hostContainer.contains(el))) return;
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el.isContentEditable ||
      el.getAttribute('contenteditable') === 'true' ||
      el.getAttribute('role') === 'textbox' ||
      el.closest('[contenteditable="true"], [role="textbox"]')
    ) {
      lastKnownActiveField = el;
      captureFieldState();
    }
  }, true);

  document.addEventListener('selectionchange', () => {
    const active = getActiveEditableElement();
    if (active && (!hostContainer || !hostContainer.contains(active))) {
      lastKnownActiveField = active;
    }
  }, true);

  function getActiveEditableElement() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    if (!el) return lastKnownActiveField;

    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase();
      if (['text', 'search', 'email', 'url', 'tel', ''].includes(type)) return el;
    }
    if (el instanceof HTMLTextAreaElement) return el;
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox') {
      return el;
    }
    const ancestor = el.closest('[contenteditable="true"], [role="textbox"]');
    if (ancestor) return ancestor;
    return lastKnownActiveField;
  }

  function captureFieldState() {
    activeFieldTarget = getActiveEditableElement() || lastKnownActiveField;
    if (!activeFieldTarget) {
      savedSelection = null;
      return;
    }

    if (activeFieldTarget instanceof HTMLInputElement || activeFieldTarget instanceof HTMLTextAreaElement) {
      const start = activeFieldTarget.selectionStart || 0;
      const end = activeFieldTarget.selectionEnd || 0;
      const val = activeFieldTarget.value || '';
      savedSelection = {
        type: 'input',
        start,
        end,
        selectedText: val.substring(start, end),
        surroundingText: val.substring(Math.max(0, start - 120), Math.min(val.length, end + 120)),
      };
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        savedSelection = {
          type: 'range',
          range: range.cloneRange(),
          selectedText: sel.toString(),
          surroundingText: activeFieldTarget.innerText ? activeFieldTarget.innerText.slice(0, 200) : '',
        };
      } else {
        savedSelection = { type: 'element', selectedText: '', surroundingText: '' };
      }
    }
  }

  function detectActiveApplication() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('mail.google.com')) return 'gmail';
    if (host.includes('slack.com')) return 'slack';
    if (host.includes('whatsapp.com')) return 'whatsapp';
    if (host.includes('notion.so')) return 'notion';
    if (host.includes('openai.com') || host.includes('chatgpt.com')) return 'chatgpt';
    if (host.includes('claude.ai')) return 'claude';
    if (host.includes('linkedin.com')) return 'linkedin';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'x';
    return 'browser';
  }

  function insertTextIntoField(textToInsert) {
    if (!textToInsert) return true;
    const target = activeFieldTarget || getActiveEditableElement();

    if (!target) {
      fallbackCopyToClipboard(textToInsert);
      return false;
    }

    target.focus();

    try {
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = target.selectionStart || (savedSelection?.start ?? target.value.length);
        const end = target.selectionEnd || (savedSelection?.end ?? target.value.length);
        const before = target.value.substring(0, start);
        const after = target.value.substring(end);

        target.value = before + textToInsert + after;
        const newCursor = start + textToInsert.length;
        target.setSelectionRange(newCursor, newCursor);

        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      if (target.isContentEditable || target.getAttribute('contenteditable') === 'true' || target.getAttribute('role') === 'textbox') {
        const sel = window.getSelection();

        if (savedSelection?.range && sel) {
          try {
            sel.removeAllRanges();
            sel.addRange(savedSelection.range);
          } catch (e) {}
        }

        const inserted = document.execCommand('insertText', false, textToInsert);
        if (inserted) {
          target.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }

        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const node = document.createTextNode(textToInsert);
          range.insertNode(node);
          range.setStartAfter(node);
          range.setEndAfter(node);
          sel.removeAllRanges();
          sel.addRange(range);
          target.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }

      fallbackCopyToClipboard(textToInsert);
      return false;
    } catch (err) {
      fallbackCopyToClipboard(textToInsert);
      return false;
    }
  }

  function fallbackCopyToClipboard(text) {
    try {
      navigator.clipboard.writeText(text);
    } catch (e) {}
  }

  // ── 2. SHADOW DOM HOST & STYLING ────────────────────────────────────────

  function ensureOverlayHost() {
    if (!hostContainer) {
      hostContainer = document.createElement('div');
      hostContainer.id = 'recall-flow-host';
      hostContainer.style.all = 'initial';
      shadowRoot = hostContainer.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = `
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .rf-wrapper {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 2147483647;
          pointer-events: auto;
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
        }

        .rf-wrapper.dragging {
          cursor: grabbing;
        }

        /* ── IDLE RADIANT FLOATING ORB (NO WHITE CIRCLE) ── */
        .rf-idle-orb {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: transparent;
          border: none;
          box-shadow: none;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .rf-idle-orb:hover {
          transform: scale(1.12);
        }

        .rf-idle-glow {
          position: absolute;
          inset: -5px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 82, 255, 0.35) 0%, rgba(121, 40, 202, 0.25) 50%, rgba(0, 210, 255, 0.25) 100%);
          filter: blur(8px);
          opacity: 0.35;
          pointer-events: none;
          transition: opacity 0.3s ease, transform 0.3s ease;
        }

        .rf-idle-orb:hover .rf-idle-glow {
          opacity: 0.55;
          transform: scale(1.08);
        }

        .rf-idle-halo {
          display: none;
        }

        /* ── EXPANDED CAPSULE ── */
        .rf-capsule {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.04);
          border-radius: 9999px;
          padding: 6px 12px 6px 6px;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 280px;
          max-width: 340px;
          animation: rfPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          color: #18181b;
        }

        @media (prefers-color-scheme: dark) {
          .rf-capsule {
            background: rgba(24, 24, 28, 0.95);
            border-color: rgba(255, 255, 255, 0.1);
            box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
            color: #f4f4f5;
          }
        }

        @keyframes rfPopIn {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        /* ── ORB ELEMENT ── */
        .rf-orb {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0052ff 0%, #7928ca 50%, #00d2ff 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          position: relative;
          box-shadow: 0 0 14px rgba(0, 82, 255, 0.45);
          transition: transform 0.15s ease;
          cursor: pointer;
        }

        .rf-idle-orb .rf-orb {
          width: 52px;
          height: 52px;
          box-shadow: 0 0 20px rgba(0, 82, 255, 0.65);
        }

        .rf-orb.listening {
          animation: rfBreathe 2.2s ease-in-out infinite;
        }

        .rf-orb.understanding,
        .rf-orb.writing {
          animation: rfSpin 2.5s linear infinite;
        }

        @keyframes rfBreathe {
          0%, 100% { transform: scale(1); box-shadow: 0 0 12px rgba(0, 82, 255, 0.4); }
          50% { transform: scale(1.07); box-shadow: 0 0 22px rgba(121, 40, 202, 0.65); }
        }

        @keyframes rfSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .rf-orb svg {
          width: 17px;
          height: 17px;
          stroke: #ffffff;
        }

        /* ── CONTENT AREA ── */
        .rf-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-right: 2px;
        }

        .rf-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
          line-height: 1.2;
        }

        .rf-hint {
          font-size: 10px;
          color: #a1a1aa;
          font-weight: 400;
        }

        .rf-transcript {
          font-size: 11px;
          color: #71717a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 210px;
        }

        .rf-action-pills {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 4px;
        }

        .rf-pill-btn {
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 500;
          border-radius: 6px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(0, 0, 0, 0.04);
          color: #27272a;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        @media (prefers-color-scheme: dark) {
          .rf-pill-btn {
            border-color: rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.08);
            color: #e4e4e7;
          }
        }

        .rf-pill-btn:hover {
          background: rgba(0, 0, 0, 0.08);
        }

        @media (prefers-color-scheme: dark) {
          .rf-pill-btn:hover {
            background: rgba(255, 255, 255, 0.14);
          }
        }

        .rf-close-btn {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: none;
          background: rgba(0, 0, 0, 0.05);
          color: #71717a;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 10px;
          margin-left: 2px;
          flex-shrink: 0;
          align-self: flex-start;
          margin-top: 2px;
        }

        .rf-close-btn:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #18181b;
        }

        .rf-choice-btn {
          padding: 3px 8px;
          font-size: 10.5px;
          font-weight: 500;
          border-radius: 6px;
          border: none;
          background: #18181b;
          color: #ffffff;
          cursor: pointer;
          margin-right: 4px;
        }
        .rf-choice-btn:hover { background: #27272a; }

        .rf-action-link {
          font-size: 10.5px;
          font-weight: 500;
          color: #0052ff;
          text-decoration: none;
          margin-top: 2px;
          display: inline-block;
        }
      `;

      shadowRoot.appendChild(style);
      document.documentElement.appendChild(hostContainer);
    }
  }

  // ── 3. RENDER UI (IDLE ORB VS EXPANDED CAPSULE) ─────────────────────────

  function renderUI(state = {}) {
    ensureOverlayHost();
    let wrapper = shadowRoot.querySelector('.rf-wrapper');

    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'rf-wrapper';
      attachDragHandlers(wrapper);
      shadowRoot.appendChild(wrapper);
    }

    // Apply remembered coordinates
    if (savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
      wrapper.style.left = `${savedPosition.x}px`;
      wrapper.style.top = `${savedPosition.y}px`;
      wrapper.style.bottom = 'auto';
      wrapper.style.right = 'auto';
      wrapper.style.transform = 'none';
    }

    // ── CASE A: IDLE FLOATING ORB (Radiant Glow) ──
    if (!isExpanded) {
      wrapper.innerHTML = `
        <div class="rf-idle-orb" id="rf-idle-orb" title="Recall Flow (Option + Space)">
          <div class="rf-idle-glow"></div>
          <div class="rf-idle-halo"></div>
          <div class="rf-orb">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
        </div>
      `;

      const idleOrb = wrapper.querySelector('#rf-idle-orb');
      if (idleOrb) {
        idleOrb.onmousedown = (e) => {
          e.preventDefault(); // Keeps focus on active input field!
        };
        idleOrb.onclick = (e) => {
          e.stopPropagation();
          startFlow();
        };
      }
      return;
    }

    // ── CASE B: EXPANDED CAPSULE ──
    let orbClass = 'rf-orb';
    if (state.phase === 'listening') orbClass += ' listening';
    if (state.phase === 'understanding' || state.phase === 'writing') orbClass += ' understanding';

    let contentHtml = '';

    if (state.phase === 'listening') {
      contentHtml = `
        <div class="rf-status-row">
          <span>Listening…</span>
          <span class="rf-hint">Enter = done</span>
        </div>
        <div class="rf-transcript">${escapeHtml(state.transcript || 'Speak naturally…')}</div>
      `;
    } else if (state.phase === 'understanding') {
      contentHtml = `
        <div class="rf-status-row">Cleaning message…</div>
        <div class="rf-transcript">${escapeHtml(state.transcript || 'Processing speech…')}</div>
      `;
    } else if (state.phase === 'writing') {
      contentHtml = `
        <div class="rf-status-row">${escapeHtml(state.headline || 'Cleaning message…')}</div>
        <div class="rf-transcript">${escapeHtml(state.details || 'Processing…')}</div>
      `;
    } else if (state.phase === 'acting') {
      contentHtml = `
        <div class="rf-status-row">Running Recall action…</div>
        <div class="rf-transcript">${escapeHtml(state.details || 'Creating event in Recall…')}</div>
      `;
    } else if (state.phase === 'ask') {
      contentHtml = `
        <div class="rf-status-row">Recall</div>
        <div class="rf-transcript" style="white-space: normal; line-height: 1.3;">${escapeHtml(state.answer || 'Here is your response.')}</div>
        <a class="rf-action-link" href="http://localhost:3001" target="_blank">Open in Recall ↗</a>
      `;
    } else if (state.phase === 'success') {
      contentHtml = `
        <div class="rf-status-row" style="color: #10b981;">
          <span style="display:inline-flex;align-items:center;gap:4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${escapeHtml(state.headline || 'Done')}</span>
          </span>
        </div>
        <div class="rf-transcript" style="white-space: normal; line-height: 1.3; max-height: 48px; overflow-y: auto;">${escapeHtml(state.details || '')}</div>
        ${state.showActionPills ? `
          <div class="rf-action-pills">
            <button class="rf-pill-btn" id="rf-pill-copy">Copy</button>
            <button class="rf-pill-btn" id="rf-pill-insert">Insert</button>
            <button class="rf-pill-btn" id="rf-pill-rewrite">Rewrite</button>
          </div>
        ` : ''}
      `;
    } else if (state.phase === 'needs_choice') {
      contentHtml = `
        <div class="rf-status-row">Choose mode:</div>
        <div style="margin-top: 4px;">
          <button class="rf-choice-btn" id="rf-choice-write">Type text</button>
          <button class="rf-choice-btn" id="rf-choice-action">Add event</button>
        </div>
      `;
    } else if (state.phase === 'error') {
      contentHtml = `
        <div class="rf-status-row" style="color: #71717a;">Notice</div>
        <div class="rf-transcript">${escapeHtml(state.errorMessage || "Copied to clipboard")}</div>
      `;
    }

    wrapper.innerHTML = `
      <div class="rf-capsule">
        <div class="${orbClass}" id="rf-orb-btn" title="Click to finish">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </div>
        <div class="rf-content">${contentHtml}</div>
        <button class="rf-close-btn" id="rf-btn-close" title="Dismiss (Esc)">✕</button>
      </div>
    `;

    // Hook listeners
    const orbBtn = wrapper.querySelector('#rf-orb-btn');
    if (orbBtn) {
      orbBtn.onclick = (e) => {
        e.stopPropagation();
        if (state.phase === 'listening') stopAndProcess();
      };
    }

    const closeBtn = wrapper.querySelector('#rf-btn-close');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        collapseToOrb();
      };
    }

    const btnCopy = wrapper.querySelector('#rf-pill-copy');
    if (btnCopy) {
      btnCopy.onclick = (e) => {
        e.stopPropagation();
        fallbackCopyToClipboard(state.details || '');
        btnCopy.textContent = 'Copied!';
        setTimeout(() => { btnCopy.textContent = 'Copy'; }, 1500);
      };
    }

    const btnInsert = wrapper.querySelector('#rf-pill-insert');
    if (btnInsert) {
      btnInsert.onclick = (e) => {
        e.stopPropagation();
        const ok = insertTextIntoField(state.details || '');
        if (ok) {
          renderUI({
            phase: 'success',
            headline: 'Inserted ✓',
            details: state.details,
            showActionPills: false,
          });
          scheduleCollapse(2000);
        }
      };
    }

    const btnRewrite = wrapper.querySelector('#rf-pill-rewrite');
    if (btnRewrite) {
      btnRewrite.onclick = (e) => {
        e.stopPropagation();
        currentTranscript = state.details || '';
        stopAndProcess('write');
      };
    }

    const btnWrite = wrapper.querySelector('#rf-choice-write');
    if (btnWrite) {
      btnWrite.onclick = (e) => {
        e.stopPropagation();
        stopAndProcess('write');
      };
    }

    const btnAction = wrapper.querySelector('#rf-choice-action');
    if (btnAction) {
      btnAction.onclick = (e) => {
        e.stopPropagation();
        stopAndProcess('action');
      };
    }
  }

  function attachDragHandlers(el) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, a')) return;

      isDragging = true;
      el.classList.add('dragging');
      startX = e.clientX;
      startY = e.clientY;

      const rect = el.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        const width = el.offsetWidth || 50;
        const height = el.offsetHeight || 50;

        const newX = Math.max(16, Math.min(window.innerWidth - width - 16, initialLeft + deltaX));
        const newY = Math.max(16, Math.min(window.innerHeight - height - 16, initialTop + deltaY));

        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
        el.style.bottom = 'auto';
        el.style.right = 'auto';
        el.style.transform = 'none';

        savedPosition = { x: newX, y: newY };
      };

      const onMouseUp = () => {
        isDragging = false;
        el.classList.remove('dragging');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (savedPosition) {
          try {
            chrome.storage.local.set({ recall_flow_position: savedPosition });
          } catch (err) {}
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  // ── 4. SPEECH CAPTURE & SILENCE VAD ────────────────────────────────────

  function resetSilenceTimer() {
    if (silenceTimer) clearTimeout(silenceTimer);
    if (!hasSpoken) return;

    silenceTimer = setTimeout(() => {
      if (hasSpoken && currentTranscript.trim().length > 0) {
        stopAndProcess();
      }
    }, 1300);
  }

  function startFlow() {
    if (isExpanded && currentPhase === 'listening') return;
    captureFieldState();

    isExpanded = true;
    currentPhase = 'listening';
    currentTranscript = '';
    hasSpoken = false;
    abortController = new AbortController();

    renderUI({
      phase: 'listening',
      transcript: '',
    });

    // Start Audio Level Analyser (volume reactivity, 0 TTS)
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        mediaStream = stream;
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            audioContext = new AudioContextClass();
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 64;
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyserNode);

            const bufferLength = analyserNode.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const checkAudio = () => {
              if (!isExpanded || currentPhase !== 'listening') return;
              analyserNode.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
              const avg = sum / bufferLength;
              currentVolume = Math.min(1, avg / 128);

              if (currentVolume > 0.15) {
                hasSpoken = true;
                resetSilenceTimer();
              }

              if (shadowRoot) {
                const orb = shadowRoot.querySelector('.rf-orb');
                if (orb && currentPhase === 'listening') {
                  const scale = 1.0 + currentVolume * 0.22;
                  orb.style.transform = `scale(${scale})`;
                }
              }
              animFrameId = requestAnimationFrame(checkAudio);
            };
            animFrameId = requestAnimationFrame(checkAudio);
          }
        } catch (e) {}
      }).catch((e) => {
        console.warn('Microphone notice:', e);
      });
    }

    // Web Speech Recognition
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentTranscript += piece + ' ';
          } else {
            interim += piece;
          }
        }
        const full = (currentTranscript + interim).trim();
        if (full.length > 0) {
          hasSpoken = true;
          resetSilenceTimer();
        }
        renderUI({
          phase: 'listening',
          transcript: full,
        });
      };

      recognition.onerror = (err) => {
        console.warn('SpeechRecognition notice:', err);
      };

      try {
        recognition.start();
      } catch (e) {}
    }
  }

  // ── 5. STOP & PROCESS (FIX: NEVER DISAPPEAR PREMATURELY) ─────────────────

  function stopAndProcess(overrideIntent) {
    if (silenceTimer) clearTimeout(silenceTimer);
    cleanupAudio();

    const finalTranscript = currentTranscript.trim();
    if (!finalTranscript) {
      collapseToOrb();
      return;
    }

    // Immediately show "Understanding…" — Output is NEVER lost!
    currentPhase = 'understanding';
    renderUI({
      phase: 'understanding',
      transcript: finalTranscript,
    });

    const activeApp = detectActiveApplication();

    // Call local Recall Flow API
    fetch('http://localhost:3001/api/ai/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: finalTranscript,
        context: {
          activeApplication: activeApp,
          selectedText: savedSelection?.selectedText || '',
          surroundingText: savedSelection?.surroundingText || '',
        },
        chosenIntent: overrideIntent,
      }),
      signal: abortController ? abortController.signal : undefined,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          showError(data.error || 'Recall could not process input');
          return;
        }

        // ── MODE A: WRITE ──
        if (data.intent === 'write') {
          currentPhase = 'writing';
          renderUI({
            phase: 'writing',
            headline: 'Cleaning message…',
            details: data.rewrittenText,
            transcript: finalTranscript,
          });

          setTimeout(() => {
            fallbackCopyToClipboard(data.rewrittenText);
            const inserted = insertTextIntoField(data.rewrittenText);
            currentPhase = 'success';
            renderUI({
              phase: 'success',
              headline: inserted ? 'Inserted' : 'Copied',
              details: data.rewrittenText,
              showActionPills: !inserted,
            });

            if (inserted) {
              scheduleCollapse(2500);
            } else {
              scheduleCollapse(6000);
            }
          }, 400);
          return;
        }

        // ── MODE B: ACTION ──
        if (data.intent === 'action') {
          currentPhase = 'acting';
          renderUI({
            phase: 'acting',
          });

          setTimeout(() => {
            currentPhase = 'success';
            const cleanActionHeadline = (data.actionResult?.headline || 'Done').replace(/\s*✓\s*$/, '');
            renderUI({
              phase: 'success',
              headline: cleanActionHeadline,
              details: data.actionResult?.details || 'Event created in Recall',
            });
            scheduleCollapse(3000);
          }, 600);
          return;
        }

        // ── MODE C: ASK ──
        if (data.intent === 'ask') {
          currentPhase = 'ask';
          renderUI({
            phase: 'ask',
            answer: data.assistantResponse || 'Here is your response.',
          });
          scheduleCollapse(8000);
          return;
        }

        // ── AMBIGUOUS ──
        if (data.intent === 'ambiguous') {
          currentPhase = 'needs_choice';
          renderUI({
            phase: 'needs_choice',
            transcript: finalTranscript,
          });
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        showError("Couldn't reach Recall · Copied to clipboard");
        fallbackCopyToClipboard(finalTranscript);
      });
  }

  function scheduleCollapse(ms) {
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => {
      collapseToOrb();
    }, ms);
  }

  function collapseToOrb() {
    isExpanded = false;
    currentPhase = 'idle';
    cleanupAudio();
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    renderUI();
  }

  function cleanupAudio() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
      recognition = null;
    }
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      mediaStream = null;
    }
    if (audioContext) {
      try { audioContext.close(); } catch (e) {}
      audioContext = null;
    }
  }

  function showError(msg) {
    currentPhase = 'error';
    renderUI({
      phase: 'error',
      errorMessage: msg,
    });
    scheduleCollapse(3000);
  }

  // ── 6. GLOBAL SHORTCUTS (Option+Space, Enter, Escape) ───────────────────

  window.addEventListener('keydown', (e) => {
    const isAltSpace = e.altKey && (e.code === 'Space' || e.key === ' ');
    if (isAltSpace) {
      e.preventDefault();
      e.stopPropagation();
      if (isExpanded) {
        if (currentPhase === 'listening') {
          stopAndProcess();
        } else {
          collapseToOrb();
        }
      } else {
        startFlow();
      }
    }

    if (e.key === 'Enter' && isExpanded && currentPhase === 'listening') {
      e.preventDefault();
      e.stopPropagation();
      stopAndProcess();
    }

    if (e.key === 'Escape' && isExpanded) {
      e.preventDefault();
      collapseToOrb();
    }
  }, true);

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'TOGGLE_RECALL_FLOW') {
      if (isExpanded) {
        if (currentPhase === 'listening') {
          stopAndProcess();
        } else {
          collapseToOrb();
        }
      } else {
        startFlow();
      }
      sendResponse({ status: 'ok' });
    }
  });

})();
