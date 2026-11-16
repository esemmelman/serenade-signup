document.documentElement.classList.toggle('android', /Android/i.test(navigator.userAgent));

const SUPABASE_URL = 'https://fgomaujsdblpzxhnnqrg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
const TABLE = 'hanukkah_serenading_signups';
const form = document.querySelector('#signup-form');
const fields = document.querySelector('#signup-fields');
const fullName = document.querySelector('#full-name');
const nameReminder = document.querySelector('#name-reminder');
const phone = document.querySelector('#cell-phone');
const email = document.querySelector('#email');
const submitButton = document.querySelector('#submit-button');
const errorMessage = document.querySelector('#form-error');
const status = document.querySelector('#save-status');
const success = document.querySelector('#success');
const summary = document.querySelector('#signup-summary');
let submitting = false;
let attempt = null;
let nameReminderShown = false;
let nameReminderTimer;

function positionNameReminder() {
  if (nameReminder.hidden) return;
  fullName.closest('.name-field').scrollIntoView({ block: 'center', behavior: 'instant' });
}
window.visualViewport?.addEventListener('resize', positionNameReminder);

fullName.addEventListener('focus', () => {
  if (nameReminderShown) return;
  nameReminderShown = true;
  nameReminder.hidden = false;
  positionNameReminder();
  nameReminderTimer = setTimeout(() => { nameReminder.hidden = true; }, 4500);
});

fullName.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    clearTimeout(nameReminderTimer);
    nameReminder.hidden = true;
  }
});

function validateContact() {
  fullName.setCustomValidity(fullName.value.trim() ? '' : 'Please enter your first and last name.');
  const digits = phone.value.replace(/\D/g, '');
  const validPhone = /^[\d\s()+.\-]+$/.test(phone.value) && digits.length >= 7 && digits.length <= 15;
  phone.setCustomValidity(validPhone ? '' : 'Please enter a cell phone number with 7 to 15 digits.');
  email.setCustomValidity(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? '' : 'Please enter a valid email address.');
}

form.addEventListener('input', () => {
  fullName.setCustomValidity('');
  phone.setCustomValidity('');
  email.setCustomValidity('');
  errorMessage.hidden = true;
});

function showConfirmation(data) {
  clearTimeout(nameReminderTimer);
  nameReminder.hidden = true;
  summary.replaceChildren();
  const dates = data.available_dates.map(value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })).join(', ');
  for (const [label, value] of [
    ['Name', data.full_name],
    ['Cell phone', data.cell_phone], ['Email', data.email], ['Available', dates || 'No dates selected'],
  ]) {
    const term = document.createElement('dt');
    const definition = document.createElement('dd');
    term.textContent = label;
    definition.textContent = value;
    summary.append(term, definition);
  }
  form.hidden = true;
  success.hidden = false;
  success.focus();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting) return;
  validateContact();
  if (!form.reportValidity()) return;
  const data = {
    full_name: fullName.value.trim(),
    people_count: 1,
    cell_phone: phone.value.trim(),
    email: email.value.trim(),
    available_dates: [...form.querySelectorAll('[name="available_dates"]:checked')].map(input => input.value),
  };
  // Reuse the request ID when retrying the same signup after a lost response.
  const fingerprint = JSON.stringify(data);
  if (attempt?.fingerprint !== fingerprint) attempt = { fingerprint, id: crypto.randomUUID() };
  submitting = true;
  fields.disabled = true;
  submitButton.disabled = true;
  submitButton.textContent = 'Saving your signup…';
  errorMessage.hidden = true;
  status.textContent = 'Saving your signup.';
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ id: attempt.id, ...data }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      // A duplicate request ID confirms that this exact signup was already saved.
      if (response.status !== 409 || details.code !== '23505') throw new Error('Could not save signup.');
    }
    showConfirmation(data);
    status.textContent = 'Your signup has been saved.';
  } catch {
    errorMessage.textContent = 'We couldn’t confirm your signup. Please check your connection and try again. Your entries are still here.';
    errorMessage.hidden = false;
    status.textContent = '';
  } finally {
    submitting = false;
    fields.disabled = false;
    submitButton.disabled = false;
    submitButton.textContent = 'Submit';
  }
});

document.querySelector('#another-signup').addEventListener('click', () => {
  form.reset();
  attempt = null;
  errorMessage.hidden = true;
  status.textContent = '';
  success.hidden = true;
  summary.replaceChildren();
  form.hidden = false;
  clearTimeout(nameReminderTimer);
  nameReminderShown = false;
  nameReminder.hidden = true;
  fullName.focus();
});

const attendeesDialog = document.querySelector('#attendees');
const attendeesStatus = document.querySelector('#attendees-status');
const attendeesError = document.querySelector('#attendees-error');
const attendeeList = document.querySelector('#attendee-list');
const nightLabels = {
  '2026-12-05': 'Dec. 5 — Second night of Hanukkah',
  '2026-12-06': 'Dec. 6 — Third night of Hanukkah',
  '2026-12-08': 'Dec. 8 — Fifth night of Hanukkah',
};
let attendeeRequest = null;

async function loadAttendees() {
  attendeeRequest?.abort();
  const controller = new AbortController();
  attendeeRequest = controller;
  attendeeList.replaceChildren();
  attendeeList.hidden = true;
  attendeesError.hidden = true;
  attendeesStatus.hidden = false;
  attendeesStatus.textContent = 'Loading attendees…';
  const signups = [];
  try {
    const pageSize = 500;
    let batch;
    do {
      const params = new URLSearchParams({
        select: 'full_name,available_dates',
        order: 'full_name.asc,available_dates.asc',
        limit: String(pageSize),
        offset: String(signups.length),
      });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?${params}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Could not load attendees.');
      batch = await response.json();
      signups.push(...batch);
    } while (batch.length === pageSize);
    if (controller.signal.aborted) return;
    signups.sort((a, b) => a.full_name.localeCompare(b.full_name, 'en', { sensitivity: 'base', numeric: true }));
    const rows = document.createDocumentFragment();
    for (const signup of signups) {
      const row = document.createElement('li');
      row.className = 'attendee';
      const name = document.createElement('strong');
      name.className = 'attendee-name';
      const nights = document.createElement('div');
      nights.className = 'attendee-nights';
      name.textContent = signup.full_name;
      const dates = [...signup.available_dates].sort();
      if (!dates.length) nights.textContent = 'Dates not selected';
      for (const date of dates) {
        const night = document.createElement('div');
        night.textContent = nightLabels[date] || date;
        nights.append(night);
      }
      row.append(name, nights);
      rows.append(row);
    }
    attendeeList.append(rows);
    attendeeList.hidden = !signups.length;
    attendeesStatus.hidden = !!signups.length;
    attendeesStatus.textContent = signups.length ? '' : 'No signups yet.';
  } catch {
    if (controller.signal.aborted) return;
    attendeesStatus.hidden = true;
    attendeesError.hidden = false;
  }
}

document.querySelector('#attendee-link').addEventListener('click', event => {
  event.preventDefault();
  attendeesDialog.showModal();
  void loadAttendees();
});
document.querySelector('#retry-attendees').addEventListener('click', () => void loadAttendees());
document.querySelector('#close-attendees').addEventListener('click', () => attendeesDialog.close());
attendeesDialog.addEventListener('close', () => attendeeRequest?.abort());
