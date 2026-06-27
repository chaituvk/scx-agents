(function() {
  'use strict';

  const script = document.currentScript;
  const tenant = script?.getAttribute('data-tenant') || 'r-mobile';
  const API_BASE = script?.getAttribute('data-api') || (new URL(script?.src || '')).origin;

  const TENANTS = {
    'r-mobile': { name: 'R-Mobile', color: '#ef4444', welcome: 'Welcome to R-Mobile! How can we help?' },
    'ichiba': { name: 'Ichiba', color: '#f97316', welcome: 'Konnichiwa! Welcome to Ichiba.' },
    'r-travel': { name: 'RTravel', color: '#06b6d4', welcome: 'Hello traveler! Ready to plan?' },
  };
  const cfg = TENANTS[tenant] || TENANTS['r-mobile'];

  let isOpen = false;
  let messages = [];
  let input = '';
  let isLoading = false;
  let conversationId = null;
  let journeyId = null;
  let journeys = [];
  let showPicker = true;

  const STYLE = document.createElement('style');
  STYLE.textContent = `
    .sierra-widget-btn{position:fixed;bottom:24px;right:24px;z-index:99999;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;box-shadow:0 8px 32px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;transition:transform .2s,color .2s;}
    .sierra-widget-btn:hover{transform:scale(1.05);}
    .sierra-widget-panel{position:fixed;bottom:24px;right:24px;z-index:99999;width:380px;height:580px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.6);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,0.08);background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
    .sierra-widget-header{padding:12px 16px;display:flex;align-items:center;justify-content:space-between;}
    .sierra-widget-header h4{margin:0;color:#fff;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;}
    .sierra-widget-close{background:none;border:none;color:#fff;cursor:pointer;opacity:.7;}
    .sierra-widget-close:hover{opacity:1;}
    .sierra-widget-body{flex:1;overflow-y:auto;padding:16px;}
    .sierra-msg{display:flex;gap:8px;margin-bottom:12px;}
    .sierra-msg.user{flex-direction:row-reverse;}
    .sierra-msg-avatar{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify:center;font-size:12px;}
    .sierra-msg-bubble{max-width:72%;padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.45;word-wrap:break-word;}
    .sierra-msg.user .sierra-msg-bubble{background:rgba(255,255,255,0.1);color:#fff;border-bottom-right-radius:4px;}
    .sierra-msg.agent .sierra-msg-bubble{background:#141414;color:rgba(255,255,255,0.9);border:1px solid rgba(255,255,255,0.05);border-bottom-left-radius:4px;}
    .sierra-msg-time{font-size:10px;opacity:.5;margin-top:4px;text-align:right;}
    .sierra-journey-card{width:100%;text-align:left;padding:14px;border-radius:14px;background:#141414;border:1px solid rgba(255,255,255,0.05);margin-bottom:8px;cursor:pointer;transition:border-color .2s;}
    .sierra-journey-card:hover{border-color:rgba(255,255,255,0.2);}
    .sierra-journey-card .title{font-size:13px;font-weight:600;color:#fff;margin-bottom:4px;}
    .sierra-journey-card .desc{font-size:11px;color:rgba(255,255,255,0.5);}
    .sierra-journey-card .badge{display:inline-block;font-size:10px;padding:2px 8px;border-radius:12px;margin-top:6px;}
    .sierra-widget-footer{padding:12px 16px;border-top:1px solid rgba(255,255,255,0.05);display:flex;gap:8px;}
    .sierra-widget-footer input{flex:1;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 14px;color:#fff;font-size:13px;outline:none;}
    .sierra-widget-footer input:focus{border-color:rgba(255,255,255,0.2);}
    .sierra-widget-footer button{width:36px;height:36px;border-radius:12px;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;}
    .sierra-widget-footer button:disabled{opacity:.4;cursor:not-allowed;}
    .sierra-loader{width:20px;height:20px;border:2px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:sierra-spin .6s linear infinite;}
    @keyframes sierra-spin{to{transform:rotate(360deg);}}
    .sierra-reset{font-size:11px;color:rgba(255,255,255,0.4);background:none;border:none;cursor:pointer;padding:0;}
    .sierra-reset:hover{color:rgba(255,255,255,0.7);}
    .sierra-tenant-tag{font-size:10px;color:rgba(255,255,255,0.4);}
    .sierra-welcome{text-align:center;padding:20px 0;}
    .sierra-welcome-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;}
    .sierra-welcome h3{margin:0 0 4px;font-size:15px;color:#fff;}
    .sierra-welcome p{margin:0;font-size:12px;color:rgba(255,255,255,0.5);}
    .sierra-tenant-switch{position:relative;}
    .sierra-tenant-switch-btn{font-size:11px;padding:4px 10px;border-radius:8px;background:rgba(255,255,255,0.15);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;}
    .sierra-tenant-menu{position:absolute;right:0;top:100%;margin-top:6px;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;min-width:120px;z-index:10;}
    .sierra-tenant-menu button{width:100%;text-align:left;padding:8px 12px;font-size:12px;color:rgba(255,255,255,0.8);background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:8px;}
    .sierra-tenant-menu button:hover{background:rgba(255,255,255,0.05);}
    .sierra-dot{width:8px;height:8px;border-radius:50%;}
    @media(max-width:480px){.sierra-widget-panel{width:calc(100vw - 32px);height:calc(100vh - 100px);right:16px;bottom:16px;}}
  `;
  document.head.appendChild(STYLE);

  const root = document.createElement('div');
  root.id = 'sierra-widget-root';
  document.body.appendChild(root);

  function svgIcon(type) {
    if (type === 'chat') return '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    if (type === 'close') return '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    if (type === 'send') return '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>';
    if (type === 'bot') return '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 15h.01M16 15h.01"/></svg>';
    if (type === 'user') return '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    if (type === 'chevron') return '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
    return '';
  }

  function api(path, opts = {}) {
    return fetch(API_BASE + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenant,
        ...(opts.headers || {}),
      },
    }).then(r => r.json());
  }

  function addMessage(role, content) {
    messages.push({
      id: Math.random().toString(36).slice(2),
      role,
      content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    render();
  }

  function startJourney(j) {
    showPicker = false;
    isLoading = true;
    render();
    api('/api/widget/conversations', {
      method: 'POST',
      body: JSON.stringify({ tenant, customerName: 'Visitor', customerEmail: '' }),
    }).then(conv => {
      conversationId = conv.conversation.id;
      journeyId = j.id;
      return api('/api/widget/chat', {
        method: 'POST',
        body: JSON.stringify({ tenant, conversationId, journeyId }),
      });
    }).then(data => {
      (data.messages || []).forEach(m => addMessage('agent', m));
    }).catch(() => {
      addMessage('agent', '⚠️ Failed to start. Please try again.');
    }).finally(() => {
      isLoading = false;
      render();
    });
  }

  function sendMessage() {
    if (!input.trim() || !conversationId || isLoading) return;
    const text = input.trim();
    input = '';
    addMessage('user', text);
    isLoading = true;
    render();
    api('/api/widget/chat', {
      method: 'POST',
      body: JSON.stringify({ tenant, conversationId, journeyId, message: text }),
    }).then(data => {
      (data.messages || []).forEach(m => addMessage('agent', m));
    }).catch(() => {
      addMessage('agent', '⚠️ Something went wrong.');
    }).finally(() => {
      isLoading = false;
      render();
    });
  }

  function reset() {
    messages = [];
    conversationId = null;
    journeyId = null;
    showPicker = true;
    render();
  }

  function loadJourneys() {
    api('/api/widget/journeys').then(data => {
      journeys = data.journeys || [];
      render();
    });
  }

  function render() {
    if (!isOpen) {
      root.innerHTML = `<button class="sierra-widget-btn" style="background:${cfg.color}">${svgIcon('chat')}</button>`;
      root.querySelector('button').onclick = () => { isOpen = true; loadJourneys(); render(); };
      return;
    }

    const tenantSwitch = !conversationId ? `
      <div class="sierra-tenant-switch">
        <button class="sierra-tenant-switch-btn" id="sierra-tenant-btn">${svgIcon('chevron')} Switch</button>
        <div class="sierra-tenant-menu" id="sierra-tenant-menu" style="display:none">
          ${Object.entries(TENANTS).map(([k,v]) => `<button data-t="${k}"><span class="sierra-dot" style="background:${v.color}"></span>${v.name}</button>`).join('')}
        </div>
      </div>
    ` : '';

    const picker = showPicker && !conversationId ? `
      <div class="sierra-welcome">
        <div class="sierra-welcome-icon" style="background:${cfg.color}30">${svgIcon('bot')}</div>
        <h3>${cfg.name}</h3>
        <p>${cfg.welcome}</p>
      </div>
      <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.4);margin:16px 0 8px;">Choose a topic</p>
      ${journeys.map(j => `
        <div class="sierra-journey-card" data-jid="${j.id}">
          <div class="title">${j.name}</div>
          <div class="desc">${j.description || ''}</div>
          <span class="badge" style="background:${j.execution_mode==='llm'?'#8b5cf620':j.execution_mode==='hybrid'?'#c4a57420':'#3b82f620'};color:${j.execution_mode==='llm'?'#a78bfa':j.execution_mode==='hybrid'?'#c4a574':'#60a5fa'}">${j.execution_mode}</span>
        </div>
      `).join('')}
    ` : '';

    const chat = !showPicker || conversationId ? `
      ${messages.map(m => `
        <div class="sierra-msg ${m.role}">
          <div class="sierra-msg-avatar" style="background:${m.role==='agent'?cfg.color+'30':'rgba(255,255,255,0.1)'};color:${m.role==='agent'?cfg.color:'rgba(255,255,255,0.5)'}">${svgIcon(m.role==='agent'?'bot':'user')}</div>
          <div class="sierra-msg-bubble">
            ${m.content}
            <div class="sierra-msg-time">${m.time}</div>
          </div>
        </div>
      `).join('')}
      ${isLoading ? `<div class="sierra-msg agent"><div class="sierra-msg-avatar" style="background:${cfg.color}30"><div class="sierra-loader" style="border-color:${cfg.color}40;border-top-color:${cfg.color}"></div></div><div class="sierra-msg-bubble">...</div></div>` : ''}
    ` : '';

    const footer = conversationId ? `
      <div class="sierra-widget-footer">
        <input type="text" id="sierra-input" placeholder="Type your message..." value="${input}" ${isLoading?'disabled':''} />
        <button id="sierra-send" style="background:${cfg.color}" ${isLoading||!input.trim()?'disabled':''}>${svgIcon('send')}</button>
      </div>
      <div style="padding:0 16px 10px;display:flex;justify-content:space-between;align-items:center;">
        <button class="sierra-reset" id="sierra-reset">New conversation</button>
        <span class="sierra-tenant-tag">${cfg.name}</span>
      </div>
    ` : '';

    root.innerHTML = `
      <div class="sierra-widget-panel">
        <div class="sierra-widget-header" style="background:${cfg.color}">
          <h4>${svgIcon('bot')} ${cfg.name} Support</h4>
          <div style="display:flex;align-items:center;gap:8px;">
            ${tenantSwitch}
            <button class="sierra-widget-close" id="sierra-close">${svgIcon('close')}</button>
          </div>
        </div>
        <div class="sierra-widget-body">${picker}${chat}</div>
        ${footer}
      </div>
    `;

    root.querySelector('#sierra-close').onclick = () => { isOpen = false; render(); };

    const body = root.querySelector('.sierra-widget-body');
    if (body) body.scrollTop = body.scrollHeight;

    if (!showPicker || conversationId) {
      root.querySelectorAll('[data-jid]').forEach(el => {
        el.onclick = () => startJourney(journeys.find(j => j.id === el.dataset.jid));
      });
    }

    if (conversationId) {
      const inp = root.querySelector('#sierra-input');
      const btn = root.querySelector('#sierra-send');
      if (inp) {
        inp.oninput = e => { input = e.target.value; render(); };
        inp.onkeydown = e => { if (e.key === 'Enter') sendMessage(); };
        inp.focus();
      }
      if (btn) btn.onclick = sendMessage;
      root.querySelector('#sierra-reset').onclick = reset;
    }

    const tbtn = root.querySelector('#sierra-tenant-btn');
    if (tbtn) {
      tbtn.onclick = () => {
        const menu = root.querySelector('#sierra-tenant-menu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
      };
      root.querySelectorAll('#sierra-tenant-menu button').forEach(b => {
        b.onclick = () => {
          const newTenant = b.dataset.t;
          if (newTenant !== tenant) {
            location.reload(); // Simplest for external embed
          }
        };
      });
    }
  }

  render();

  // ── Proactive triggers ────────────────────────────────────────────────
  // Fetch active triggers from the server and fire them based on behavioral
  // signals (page dwell, scroll depth, exit intent).

  const PROACTIVE_COOLDOWN_KEY = `sierra_trigger_cooldown_${tenant}`;

  function isTriggerCoolingDown(triggerId, cooldownHours) {
    try {
      const stored = JSON.parse(localStorage.getItem(PROACTIVE_COOLDOWN_KEY) || '{}');
      const firedAt = stored[triggerId];
      if (!firedAt) return false;
      return (Date.now() - firedAt) < cooldownHours * 3600 * 1000;
    } catch { return false; }
  }

  function markTriggerFired(triggerId) {
    try {
      const stored = JSON.parse(localStorage.getItem(PROACTIVE_COOLDOWN_KEY) || '{}');
      stored[triggerId] = Date.now();
      localStorage.setItem(PROACTIVE_COOLDOWN_KEY, JSON.stringify(stored));
    } catch {}
  }

  function fireTrigger(trigger) {
    if (isOpen || isTriggerCoolingDown(trigger.id, trigger.cooldown_hours)) return;
    markTriggerFired(trigger.id);
    // Pre-open widget with the trigger message
    isOpen = true;
    conversationId = null;
    showPicker = false;
    messages = [{ id: 'p0', role: 'agent', content: trigger.message, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
    // Create a conversation in the background
    api('/api/widget/conversations', {
      method: 'POST',
      body: JSON.stringify({ tenant, customerName: 'Visitor', customerEmail: '' }),
    }).then(conv => { conversationId = conv.conversation?.id || null; }).catch(() => {});
    render();
  }

  function setupTrigger(trigger) {
    const delay = (trigger.delay_seconds || 30) * 1000;
    if (trigger.trigger_type === 'page_dwell') {
      setTimeout(() => fireTrigger(trigger), delay);
    } else if (trigger.trigger_type === 'exit_intent') {
      document.addEventListener('mouseleave', function handler(e) {
        if (e.clientY <= 0) { fireTrigger(trigger); document.removeEventListener('mouseleave', handler); }
      });
    } else if (trigger.trigger_type === 'scroll_depth') {
      const threshold = trigger.conditions?.scroll_percent || 75;
      window.addEventListener('scroll', function handler() {
        const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        if (pct >= threshold) { fireTrigger(trigger); window.removeEventListener('scroll', handler); }
      });
    } else if (trigger.trigger_type === 'return_visitor') {
      const minVisits = trigger.conditions?.visit_count_min || 2;
      try {
        const visits = parseInt(localStorage.getItem(`sierra_visits_${tenant}`) || '0', 10) + 1;
        localStorage.setItem(`sierra_visits_${tenant}`, String(visits));
        if (visits >= minVisits) setTimeout(() => fireTrigger(trigger), delay);
      } catch {}
    }
  }

  // Load triggers after a short boot delay to avoid blocking page load
  setTimeout(() => {
    fetch(`${API_BASE}/api/widget/triggers?tenant_id=${encodeURIComponent(tenant)}`)
      .then(r => r.json())
      .then(data => {
        const triggers = (data.triggers || []).sort((a, b) => (a.priority || 100) - (b.priority || 100));
        // Only fire the highest-priority matching trigger to avoid spamming
        let fired = false;
        for (const trigger of triggers) {
          if (!fired) { setupTrigger(trigger); fired = true; }
        }
      })
      .catch(() => {});
  }, 2000);
})();
