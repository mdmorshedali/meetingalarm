// Data Stores
let meetings = JSON.parse(localStorage.getItem('meetings_final') || '[]');
let manualAlarms = JSON.parse(localStorage.getItem('manual_alarms_final') || '[]');
let emailHistory = JSON.parse(localStorage.getItem('email_history_final') || '[]');
let smtpConfig = JSON.parse(localStorage.getItem('smtp_config_final') || '{}');
let userName = localStorage.getItem('user_name_final') || '';
let ringtonePref = localStorage.getItem('ringtone_pref_final') || 'cring';
let customRingtoneUrl = localStorage.getItem('custom_ringtone_url_final') || null;
let activeTimers = {};
let currentAlarmTimeout = null;
let alarmInterval = null;
let isRinging = false;
let customAudio = null;

function saveMeetings() { localStorage.setItem('meetings_final', JSON.stringify(meetings)); }
function saveManualAlarms() { localStorage.setItem('manual_alarms_final', JSON.stringify(manualAlarms)); }
function saveEmailHistory() { localStorage.setItem('email_history_final', JSON.stringify(emailHistory)); }

function formatTo12Hour(time24) {
  if (!time24) return '--:-- --';
  let [hours, minutes] = time24.split(':');
  let h = parseInt(hours);
  let ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${minutes} ${ampm}`;
}

function playRingtone() {
  stopRingtone();
  isRinging = true;
  if (customRingtoneUrl && customAudio) {
    customAudio = new Audio(customRingtoneUrl);
    customAudio.loop = true;
    customAudio.play().catch(e => console.log('Error'));
    return;
  }
  if (ringtonePref === 'cring') {
    function playCringCring() {
      if (!isRinging) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const pattern = [800, 1000, 800, 1000, 800, 1000];
        pattern.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          gain.gain.value = 0.45;
          osc.start(ctx.currentTime + i * 0.28);
          gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + i * 0.28 + 0.22);
          setTimeout(() => osc.stop(), (i + 1) * 280);
        });
      } catch(e) {}
    }
    playCringCring();
    alarmInterval = setInterval(() => { if (isRinging) playCringCring(); }, 1800);
  } else {
    const tones = { default: [880, 880, 440, 880], digital: [1200, 800, 1200] };
    const freqs = tones[ringtonePref] || tones.default;
    function playBeep() {
      if (!isRinging) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          gain.gain.value = 0.35;
          osc.start(ctx.currentTime + i * 0.25);
          gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + i * 0.25 + 0.5);
          setTimeout(() => osc.stop(), (i + 1) * 250 + 500);
        });
      } catch(e) {}
    }
    playBeep();
    alarmInterval = setInterval(() => { if (isRinging) playBeep(); }, 3000);
  }
}

function stopRingtone() {
  isRinging = false;
  if (customAudio) { customAudio.pause(); customAudio.currentTime = 0; }
  if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
}

function triggerVibrate() { if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 500, 300, 300]); }
function showNotification(title, body) { if (Notification.permission === 'granted') new Notification(title, { body, icon: '🔔' }); }

function sendEmailViaSMTP(to, subject, body) {
  if (!smtpConfig.email) { alert('Configure SMTP in Settings'); return false; }
  const emailRecord = { id: Date.now(), to, subject, body, date: new Date().toLocaleString(), status: 'Sent' };
  emailHistory.unshift(emailRecord);
  saveEmailHistory();
  renderEmailHistory();
  showNotification('Email Sent', `To: ${to}`);
  alert(`📧 Email sent\nFrom: ${smtpConfig.email}\nTo: ${to}\nSubject: ${subject}`);
  return true;
}

function addSnoozeAlarm(message) {
  const snoozeTime = new Date();
  snoozeTime.setMinutes(snoozeTime.getMinutes() + 5);
  const date = snoozeTime.toISOString().split('T')[0];
  const time = `${snoozeTime.getHours().toString().padStart(2,'0')}:${snoozeTime.getMinutes().toString().padStart(2,'0')}`;
  const snoozeLabel = `Snooze: ${message.substring(0, 35)}`;
  manualAlarms.push({ id: Date.now(), date, time, label: snoozeLabel, triggered: false, enabled: true, isSnooze: true });
  saveManualAlarms();
  renderAllAlarmsList();
  showNotification('Snooze Set', `Alarm will ring again at ${formatTo12Hour(time)}`);
}

let alarmRetryTimeout = null;
function showAlarmPopup(title, message, alarmId = null) {
  const modal = document.getElementById('fullscreenAlarm');
  document.getElementById('alarmTitle').innerHTML = title;
  document.getElementById('alarmMessage').innerHTML = message;
  document.getElementById('alarmIcon').classList.add('ringing');
  modal.classList.add('active');
  playRingtone();
  triggerVibrate();
  
  if (currentAlarmTimeout) clearTimeout(currentAlarmTimeout);
  currentAlarmTimeout = setTimeout(() => {
    if (modal.classList.contains('active')) {
      stopAlarm();
      if (alarmRetryTimeout) clearTimeout(alarmRetryTimeout);
      alarmRetryTimeout = setTimeout(() => showAlarmPopup(title, message, alarmId), 2 * 60000);
    }
  }, 60000);
  
  const stopFn = () => { stopAlarm(); if (alarmRetryTimeout) clearTimeout(alarmRetryTimeout); };
  const snoozeFn = () => {
    stopAlarm();
    addSnoozeAlarm(message);
    if (currentAlarmTimeout) clearTimeout(currentAlarmTimeout);
  };
  document.getElementById('stopAlarmBtn').onclick = stopFn;
  document.getElementById('snoozeAlarmBtn').onclick = snoozeFn;
}

function stopAlarm() {
  const modal = document.getElementById('fullscreenAlarm');
  modal.classList.remove('active');
  document.getElementById('alarmIcon').classList.remove('ringing');
  stopRingtone();
  if (currentAlarmTimeout) clearTimeout(currentAlarmTimeout);
}

function clearMeetingTimers(meetingId) {
  if (activeTimers[`${meetingId}_1h`]) { clearTimeout(activeTimers[`${meetingId}_1h`]); delete activeTimers[`${meetingId}_1h`]; }
  if (activeTimers[`${meetingId}_15m`]) { clearTimeout(activeTimers[`${meetingId}_15m`]); delete activeTimers[`${meetingId}_15m`]; }
  if (activeTimers[`${meetingId}_main`]) { clearTimeout(activeTimers[`${meetingId}_main`]); delete activeTimers[`${meetingId}_main`]; }
}

function scheduleMeetingAlarms(meeting) {
  if (!meeting.enabled) return;
  const meetingTime = new Date(meeting.date + 'T' + meeting.time);
  const now = new Date();
  if (meetingTime <= now || meeting.status === 'completed') return;
  
  const oneHourBefore = new Date(meetingTime.getTime() - 60 * 60000);
  if (oneHourBefore > now && !meeting.oneHourTriggered) {
    activeTimers[`${meeting.id}_1h`] = setTimeout(() => {
      if (!meeting.oneHourTriggered && meeting.status !== 'completed' && meeting.enabled) {
        meeting.oneHourTriggered = true;
        saveMeetings();
        showNotification('🔔 1 Hour', `${meeting.title} in 1 hour`);
        showAlarmPopup('1 HOUR REMINDER', `${meeting.title}\n${meeting.person}\nStarts in 1 hour`, meeting.id);
        sendEmailViaSMTP(meeting.email, `Reminder: ${meeting.title}`, `Starts in 1 hour`);
      }
    }, oneHourBefore - now);
  }
  
  const fifteenBefore = new Date(meetingTime.getTime() - 15 * 60000);
  if (fifteenBefore > now && !meeting.fifteenTriggered) {
    activeTimers[`${meeting.id}_15m`] = setTimeout(() => {
      if (!meeting.fifteenTriggered && meeting.status !== 'completed' && meeting.enabled) {
        meeting.fifteenTriggered = true;
        saveMeetings();
        showNotification('⏰ 15 Minutes', `${meeting.title} starts soon`);
        showAlarmPopup('15 MINUTES LEFT', `${meeting.title}\n${meeting.person}\nStarts in 15 min`, meeting.id);
        sendEmailViaSMTP(meeting.email, `Reminder: ${meeting.title}`, `Starts in 15 minutes`);
      }
    }, fifteenBefore - now);
  }
  
  if (meetingTime > now && !meeting.mainTriggered) {
    activeTimers[`${meeting.id}_main`] = setTimeout(() => {
      if (!meeting.mainTriggered && meeting.status !== 'completed' && meeting.enabled) {
        meeting.mainTriggered = true;
        meeting.status = 'missed';
        saveMeetings();
        showNotification('🔔 MEETING NOW!', `${meeting.title}`);
        showAlarmPopup('MEETING NOW!', `${meeting.title}\n${meeting.person}\n${formatTo12Hour(meeting.time)}`, meeting.id);
        sendEmailViaSMTP(meeting.email, `Meeting Now`, `Your meeting is starting now`);
        renderAll();
      }
    }, meetingTime - now);
  }
  saveMeetings();
}

function renderAllAlarmsList() {
  const container = document.getElementById('allAlarmsList');
  if (!container) return;
  const now = new Date();
  
  const meetingAlarms = [];
  meetings.forEach(meeting => {
    const meetTime = new Date(meeting.date + 'T' + meeting.time);
    if (meetTime > now && meeting.status !== 'completed') {
      const oneHourTime = new Date(meetTime.getTime() - 60 * 60000);
      const fifteenTime = new Date(meetTime.getTime() - 15 * 60000);
      if (oneHourTime > now) {
        meetingAlarms.push({
          id: `meeting_${meeting.id}_1h`,
          type: 'meeting',
          label: `1h Before: ${meeting.title}`,
          dateTime: oneHourTime,
          dateStr: oneHourTime.toISOString().split('T')[0],
          timeStr: `${oneHourTime.getHours().toString().padStart(2,'0')}:${oneHourTime.getMinutes().toString().padStart(2,'0')}`,
          enabled: meeting.enabled !== false,
          meetingId: meeting.id,
          alarmType: '1h'
        });
      }
      if (fifteenTime > now) {
        meetingAlarms.push({
          id: `meeting_${meeting.id}_15m`,
          type: 'meeting',
          label: `15min Before: ${meeting.title}`,
          dateTime: fifteenTime,
          dateStr: fifteenTime.toISOString().split('T')[0],
          timeStr: `${fifteenTime.getHours().toString().padStart(2,'0')}:${fifteenTime.getMinutes().toString().padStart(2,'0')}`,
          enabled: meeting.enabled !== false,
          meetingId: meeting.id,
          alarmType: '15m'
        });
      }
    }
  });
  
  const manualAlarmsList = manualAlarms.filter(a => {
    const alarmTime = new Date(a.date + 'T' + a.time);
    return alarmTime > now && !a.triggered;
  }).map(a => ({
    id: a.id,
    type: 'manual',
    label: a.label,
    dateStr: a.date,
    timeStr: a.time,
    enabled: a.enabled !== false,
    originalAlarm: a
  }));
  
  const allAlarms = [...meetingAlarms, ...manualAlarmsList].sort((a,b) => a.dateTime - b.dateTime);
  
  if (allAlarms.length === 0) {
    container.innerHTML = '<div class="glass-card" style="padding:20px;text-align:center;">✨ No upcoming alarms</div>';
    return;
  }
  
  container.innerHTML = allAlarms.map(alarm => `
    <div class="alarm-card">
      <div>
        <i class="fas ${alarm.type === 'meeting' ? 'fa-video' : 'fa-bell'}"></i>
        <strong>${alarm.label}</strong>
        <br><small>📅 ${alarm.dateStr} ⏰ ${formatTo12Hour(alarm.timeStr)}</small>
        ${alarm.type === 'meeting' ? '<br><small style="font-size:10px;">Meeting auto-alarm</small>' : ''}
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="toggle-switch ${alarm.enabled ? 'active' : ''}" data-alarm-id="${alarm.id}" data-alarm-type="${alarm.type}" data-meeting-id="${alarm.meetingId || ''}" data-alarm-subtype="${alarm.alarmType || ''}" data-manual-id="${alarm.originalAlarm?.id || ''}">
          <div class="toggle-knob"></div>
        </div>
        ${alarm.type === 'manual' ? `<i class="fas fa-edit" style="cursor:pointer; color:var(--accent);" data-edit-manual="${alarm.originalAlarm?.id}"></i>` : ''}
        <i class="fas fa-trash-alt" style="color:var(--danger); cursor:pointer;" data-delete-alarm="${alarm.id}" data-alarm-type="${alarm.type}" data-meeting-id="${alarm.meetingId || ''}" data-manual-id="${alarm.originalAlarm?.id || ''}"></i>
      </div>
    </div>
  `).join('');
  
  document.querySelectorAll('.toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const alarmType = toggle.dataset.alarmType;
      const meetingId = toggle.dataset.meetingId;
      const isEnabled = toggle.classList.contains('active');
      
      if (alarmType === 'meeting' && meetingId) {
        const meeting = meetings.find(m => m.id == meetingId);
        if (meeting) {
          meeting.enabled = !isEnabled;
          saveMeetings();
          if (meeting.enabled) {
            meeting.oneHourTriggered = false;
            meeting.fifteenTriggered = false;
            meeting.mainTriggered = false;
            scheduleMeetingAlarms(meeting);
          } else {
            clearMeetingTimers(meeting.id);
          }
        }
      } else if (alarmType === 'manual') {
        const manualId = toggle.dataset.manualId;
        const manualAlarm = manualAlarms.find(m => m.id == manualId);
        if (manualAlarm) {
          manualAlarm.enabled = !isEnabled;
          saveManualAlarms();
        }
      }
      renderAllAlarmsList();
      renderAll();
    });
  });
  
  document.querySelectorAll('[data-delete-alarm]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const alarmType = btn.dataset.alarmType;
      const meetingId = btn.dataset.meetingId;
      const manualId = btn.dataset.manualId;
      
      if (alarmType === 'meeting' && meetingId) {
        const meeting = meetings.find(m => m.id == meetingId);
        if (meeting) {
          meeting.enabled = false;
          saveMeetings();
          clearMeetingTimers(meeting.id);
        }
      } else if (alarmType === 'manual' && manualId) {
        manualAlarms = manualAlarms.filter(m => m.id != manualId);
        saveManualAlarms();
      }
      renderAllAlarmsList();
      renderAll();
    });
  });
  
  document.querySelectorAll('[data-edit-manual]').forEach(btn => {
    btn.addEventListener('click', () => {
      const manualId = btn.dataset.editManual;
      const alarm = manualAlarms.find(m => m.id == manualId);
      if (alarm) openEditAlarmModal(alarm);
    });
  });
}

function openEditAlarmModal(alarm) {
  const modal = document.getElementById('editAlarmModal');
  document.getElementById('editAlarmDate').value = alarm.date;
  document.getElementById('editAlarmTime').value = alarm.time;
  document.getElementById('editAlarmLabel').value = alarm.label;
  modal.classList.add('active');
  document.getElementById('updateAlarmBtn').onclick = () => {
    alarm.date = document.getElementById('editAlarmDate').value;
    alarm.time = document.getElementById('editAlarmTime').value;
    alarm.label = document.getElementById('editAlarmLabel').value;
    saveManualAlarms();
    modal.classList.remove('active');
    renderAllAlarmsList();
    renderAll();
  };
  document.getElementById('closeAlarmEditModal').onclick = () => modal.classList.remove('active');
}

function updateMeetingStatuses() {
  const now = new Date();
  meetings.forEach(meeting => {
    const meetTime = new Date(meeting.date + 'T' + meeting.time);
    if (meetTime < now && meeting.status !== 'completed' && meeting.status !== 'missed') {
      meeting.status = 'missed';
      meeting.mainTriggered = true;
      saveMeetings();
    }
  });
}

function checkManualAlarms() {
  const now = new Date();
  manualAlarms.forEach((alarm, idx) => {
    if (alarm.enabled === false) return;
    const alarmTime = new Date(alarm.date + 'T' + alarm.time);
    if (!alarm.triggered && alarmTime <= now && alarmTime > new Date(now.getTime() - 2000)) {
      alarm.triggered = true;
      saveManualAlarms();
      showNotification('Manual Alarm', alarm.label);
      showAlarmPopup('⏰ MANUAL ALARM', alarm.label || `Alarm at ${formatTo12Hour(alarm.time)}`);
      setTimeout(() => { manualAlarms.splice(idx,1); saveManualAlarms(); renderAllAlarmsList(); renderAll(); }, 1000);
    }
  });
}

function updateCountdown() {
  const now = new Date();
  const upcoming = meetings.filter(m => {
    const mt = new Date(m.date + 'T' + m.time);
    return mt > now && m.status !== 'completed';
  }).sort((a,b) => new Date(a.date+'T'+a.time) - new Date(b.date+'T'+b.time));
  const next = upcoming[0];
  if (next) {
    const meetTime = new Date(next.date + 'T' + next.time);
    const totalSec = Math.max(0, Math.floor((meetTime - now) / 1000));
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    document.getElementById('hmsDisplay').innerHTML = `${hours}h ${minutes}m`;
    document.getElementById('secondsDisplay').innerHTML = `${seconds}s`;
    document.getElementById('nextMeetingTitle').innerHTML = next.title;
    document.getElementById('nextMeetingPerson').innerHTML = next.person;
    document.getElementById('nextMeetingDate').innerHTML = next.date;
    document.getElementById('nextMeetingTime').innerHTML = formatTo12Hour(next.time);
    const circumference = 2 * Math.PI * 62;
    let progress = 0, color = '#10b981';
    if (totalSec < 900) { progress = totalSec / 900; color = '#ef4444'; }
    else if (totalSec < 3600) { progress = totalSec / 3600; color = '#f59e0b'; }
    else { progress = Math.min(1, totalSec / (7 * 24 * 3600)); color = '#6366f1'; }
    const dashoffset = circumference * (1 - progress);
    const circle = document.getElementById('progressCircle');
    if (circle) { circle.style.strokeDasharray = `${circumference} ${circumference}`; circle.style.strokeDashoffset = dashoffset; circle.style.stroke = color; }
  } else {
    document.getElementById('hmsDisplay').innerHTML = '0h 0m'; document.getElementById('secondsDisplay').innerHTML = '0s';
    document.getElementById('nextMeetingTitle').innerHTML = 'No Meeting'; document.getElementById('nextMeetingPerson').innerHTML = '—';
    document.getElementById('nextMeetingDate').innerHTML = '—'; document.getElementById('nextMeetingTime').innerHTML = '—';
  }
}

function renderAllMeetings() {
  const container = document.getElementById('allMeetingsList');
  if (!container) return;
  const now = new Date();
  const sorted = [...meetings].sort((a,b) => (a.date+'T'+a.time).localeCompare(b.date+'T'+b.time));
  if (sorted.length === 0) { container.innerHTML = '<div class="glass-card" style="padding:20px;text-align:center;">✨ No meetings</div>'; return; }
  container.innerHTML = sorted.map(m => {
    const meetTime = new Date(m.date + 'T' + m.time);
    const isPast = meetTime < now;
    let statusClass = 'status-upcoming', statusText = 'Upcoming';
    if (m.status === 'completed') { statusClass = 'status-completed'; statusText = '✓ Completed'; }
    else if (m.status === 'missed' || (isPast && m.status !== 'completed')) { statusClass = 'status-missed'; statusText = 'Missed'; }
    return `<div class="meeting-card"><div><strong>${m.title}</strong><span class="status-badge ${statusClass}">${statusText}</span><br><small>👤 ${m.person} • ${m.date} ${formatTo12Hour(m.time)}</small></div>
    <div class="meeting-actions"><i class="fas fa-edit" data-id="${m.id}"></i><i class="fas fa-check-circle" style="color:var(--success);" data-complete="${m.id}"></i><i class="fas fa-trash-alt" style="color:var(--danger);" data-delete="${m.id}"></i></div></div>`;
  }).join('');
  attachMeetingEvents();
}

function attachMeetingEvents() {
  document.querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', () => openEditModal(parseInt(el.dataset.id))));
  document.querySelectorAll('[data-complete]').forEach(el => {
    el.addEventListener('click', () => {
      const m = meetings.find(m => m.id == el.dataset.complete);
      if (m) { m.status = m.status === 'completed' ? 'upcoming' : 'completed'; saveMeetings(); renderAll(); if(m.status === 'upcoming') scheduleMeetingAlarms(m); else clearMeetingTimers(m.id); }
    });
  });
  document.querySelectorAll('[data-delete]').forEach(el => {
    el.addEventListener('click', () => { const id = parseInt(el.dataset.delete); clearMeetingTimers(id); meetings = meetings.filter(m => m.id != id); saveMeetings(); renderAll(); });
  });
}

function renderMeetingsList() {
  const container = document.getElementById('meetingsList');
  if (!container) return;
  container.innerHTML = meetings.map((m, idx) => `<div class="meeting-card"><div><strong>${m.title}</strong><br><small>👤 ${m.person} • ${m.date} ${formatTo12Hour(m.time)}</small></div><div><i class="fas fa-edit" data-idx="${idx}"></i> <i class="fas fa-trash-alt" style="color:var(--danger);" data-idx="${idx}"></i></div></div>`).join('');
  document.querySelectorAll('#meetingsList .fa-edit').forEach(el => el.addEventListener('click', () => openEditModal(meetings[parseInt(el.dataset.idx)].id)));
  document.querySelectorAll('#meetingsList .fa-trash-alt').forEach(el => { el.addEventListener('click', () => { const id = meetings[parseInt(el.dataset.idx)].id; clearMeetingTimers(id); meetings.splice(parseInt(el.dataset.idx),1); saveMeetings(); renderAll(); }); });
}

function renderEmailHistory() {
  const container = document.getElementById('emailHistoryList');
  if (!container) return;
  container.innerHTML = emailHistory.slice(0, 8).map(e => `<div class="email-card"><div><strong>To: ${e.to}</strong><br><small>${e.subject} - ${e.date}</small></div><i class="fas fa-check-circle"></i></div>`).join('');
}

function openEditModal(meetingId) {
  const meeting = meetings.find(m => m.id === meetingId);
  if (!meeting) return;
  const modal = document.getElementById('editMeetingModal');
  const now = new Date();
  const meetTime = new Date(meeting.date + 'T' + meeting.time);
  const isPast = meetTime < now;
  
  if (isPast || meeting.status === 'completed' || meeting.status === 'missed') {
    document.getElementById('editModalTitle').innerHTML = '✏️ Edit Meeting Status (Past Meeting)';
    document.getElementById('editFullFields').style.display = 'none';
    document.getElementById('editStatusOnly').style.display = 'block';
    document.getElementById('editStatusTitle').value = meeting.title;
    document.getElementById('editStatusPerson').value = meeting.person;
    document.getElementById('editStatusDateTime').value = `${meeting.date} ${formatTo12Hour(meeting.time)}`;
    document.getElementById('editNote').innerHTML = '⚠️ Past meetings can only change status (time/date locked)';
    document.getElementById('editMeetStatus').value = meeting.status || 'missed';
  } else {
    document.getElementById('editModalTitle').innerHTML = '✏️ Edit Meeting (Upcoming)';
    document.getElementById('editFullFields').style.display = 'block';
    document.getElementById('editStatusOnly').style.display = 'none';
    document.getElementById('editMeetTitle').value = meeting.title;
    document.getElementById('editMeetPerson').value = meeting.person;
    document.getElementById('editMeetEmail').value = meeting.email || '';
    document.getElementById('editMeetDate').value = meeting.date;
    document.getElementById('editMeetTime').value = meeting.time;
    document.getElementById('editMeetStatus').value = meeting.status || 'upcoming';
    document.getElementById('editNote').innerHTML = '✅ You can edit all details for upcoming meetings';
  }
  modal.classList.add('active');
  
  document.getElementById('updateMeetingBtn').onclick = () => {
    if (isPast || meeting.status === 'completed' || meeting.status === 'missed') {
      meeting.status = document.getElementById('editMeetStatus').value;
    } else {
      meeting.title = document.getElementById('editMeetTitle').value;
      meeting.person = document.getElementById('editMeetPerson').value;
      meeting.email = document.getElementById('editMeetEmail').value;
      meeting.date = document.getElementById('editMeetDate').value;
      meeting.time = document.getElementById('editMeetTime').value;
      meeting.status = document.getElementById('editMeetStatus').value;
      clearMeetingTimers(meeting.id);
      meeting.oneHourTriggered = false;
      meeting.fifteenTriggered = false;
      meeting.mainTriggered = false;
      if (meeting.status === 'upcoming') {
        scheduleMeetingAlarms(meeting);
      }
    }
    saveMeetings();
    modal.classList.remove('active');
    renderAll();
  };
  document.getElementById('closeEditModal').onclick = () => modal.classList.remove('active');
}

function openMeetingModal() {
  const modal = document.getElementById('meetingModal');
  ['meetTitle','meetPerson','meetEmail','meetDate','meetTime'].forEach(id => document.getElementById(id).value = '');
  modal.classList.add('active');
  document.getElementById('saveMeetingBtn').onclick = () => {
    const newMeeting = { id: Date.now(), title: document.getElementById('meetTitle').value, person: document.getElementById('meetPerson').value, email: document.getElementById('meetEmail').value, date: document.getElementById('meetDate').value, time: document.getElementById('meetTime').value, status: 'upcoming', enabled: true, oneHourTriggered: false, fifteenTriggered: false, mainTriggered: false };
    if (newMeeting.title && newMeeting.date && newMeeting.time) { meetings.push(newMeeting); saveMeetings(); scheduleMeetingAlarms(newMeeting); modal.classList.remove('active'); renderAll(); }
    else alert('Fill title, date & time');
  };
  document.getElementById('closeMeetingModal').onclick = () => modal.classList.remove('active');
}

function openManualAlarmModal() {
  const modal = document.getElementById('manualAlarmModal');
  document.getElementById('manualAlarmDate').value = ''; document.getElementById('manualAlarmTime').value = ''; document.getElementById('manualAlarmLabel').value = '';
  modal.classList.add('active');
  document.getElementById('saveManualAlarmBtn').onclick = () => {
    const date = document.getElementById('manualAlarmDate').value, time = document.getElementById('manualAlarmTime').value, label = document.getElementById('manualAlarmLabel').value;
    if (date && time) { manualAlarms.push({ id: Date.now(), date, time, label: label || 'Manual Alarm', triggered: false, enabled: true, isSnooze: false }); saveManualAlarms(); modal.classList.remove('active'); renderAll(); }
    else alert('Select date & time');
  };
  document.getElementById('closeManualModal').onclick = () => modal.classList.remove('active');
}

function renderAll() { updateMeetingStatuses(); renderAllMeetings(); renderMeetingsList(); renderAllAlarmsList(); renderEmailHistory(); updateCountdown(); }

function updateClock() {
  const d = new Date();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2,'0');
  const seconds = d.getSeconds().toString().padStart(2,'0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  document.getElementById('liveClock').innerHTML = `${hours}:${minutes}:${seconds} ${ampm}`;
  const greet = d.getHours() < 12 ? 'Good Morning' : (d.getHours() < 18 ? 'Good Afternoon' : 'Good Evening');
  document.getElementById('greetingMsg').innerHTML = `${greet}, ${userName || 'User'}`;
}

// Event Listeners
document.getElementById('userName')?.addEventListener('change', (e) => { userName = e.target.value; localStorage.setItem('user_name_final', userName); updateClock(); });
document.getElementById('saveSmtpSettings')?.addEventListener('click', () => { smtpConfig = { email: document.getElementById('smtpEmail').value, password: document.getElementById('smtpPassword').value }; localStorage.setItem('smtp_config_final', JSON.stringify(smtpConfig)); document.getElementById('smtpStatus').innerHTML = '✅ Saved!'; setTimeout(() => document.getElementById('smtpStatus').innerHTML = '', 2000); });
document.getElementById('sendEmailBtn')?.addEventListener('click', () => { const to = document.getElementById('emailTo').value, subject = document.getElementById('emailSubject').value, body = document.getElementById('emailBody').value; if (to && subject) sendEmailViaSMTP(to, subject, body); else alert('Fill recipient & subject'); });
document.getElementById('ringtoneSelect')?.addEventListener('change', (e) => { ringtonePref = e.target.value; localStorage.setItem('ringtone_pref_final', ringtonePref); });
document.getElementById('customRingtoneFile')?.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { customRingtoneUrl = URL.createObjectURL(file); localStorage.setItem('custom_ringtone_url_final', customRingtoneUrl); customAudio = new Audio(customRingtoneUrl); alert('Custom ringtone loaded!'); } });
document.getElementById('testRingtone')?.addEventListener('click', () => { playRingtone(); setTimeout(() => stopRingtone(), 3000); });
document.getElementById('requestNotificationPerm')?.addEventListener('click', () => Notification.requestPermission());

// Tab navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => { document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); item.classList.add('active'); const tab = item.dataset.tab; document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen')); document.getElementById(`${tab}Screen`).classList.add('active-screen'); if(tab === 'alarm') renderAllAlarmsList(); });
});
document.querySelector('.nav-item[data-tab="dashboard"]').classList.add('active');

document.getElementById('globalFab').addEventListener('click', () => openMeetingModal());
document.getElementById('addManualAlarmBtn').addEventListener('click', () => openManualAlarmModal());
document.getElementById('addMeetingBtn').addEventListener('click', () => openMeetingModal());
document.getElementById('darkModeToggle').addEventListener('click', () => document.body.classList.toggle('dark'));

// Load saved settings
document.getElementById('ringtoneSelect').value = ringtonePref;
if (userName) document.getElementById('userName').value = userName;
if (smtpConfig.email) { document.getElementById('smtpEmail').value = smtpConfig.email; document.getElementById('smtpPassword').value = smtpConfig.password || ''; }
if (customRingtoneUrl) customAudio = new Audio(customRingtoneUrl);

// Initialize
setInterval(() => { updateClock(); checkManualAlarms(); updateCountdown(); }, 1000);
updateClock();
renderAll();
if (Notification.permission === 'default') Notification.requestPermission();