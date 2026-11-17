const android = /Android/i.test(navigator.userAgent);
document.documentElement.classList.toggle('android', android);

const SUPABASE_URL = 'https://fgomaujsdblpzxhnnqrg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
const TABLE = 'hanukkah_serenading_signups';
const form = document.querySelector('#signup-form');
const fields = document.querySelector('#signup-fields');
const fullName = document.querySelector('#full-name');
const phone = document.querySelector('#cell-phone');
const email = document.querySelector('#email');
if (android) email.closest('label').after(document.querySelector('.additional-attendees'));
const submitButton = document.querySelector('#submit-button');
const errorMessage = document.querySelector('#form-error');
const status = document.querySelector('#save-status');
const success = document.querySelector('#success');
const summary = document.querySelector('#signup-summary');
const bringingOthers = document.querySelector('#bringing-others');
const guestDialog = document.querySelector('#guest-dialog');
const guestForm = document.querySelector('#guest-form');
const guestInputs = [...guestForm.querySelectorAll('input')];
const guestSummary = document.querySelector('#guest-summary');
const guestSummaryNames = document.querySelector('#guest-summary-names');
let additionalNames = [];
let submitting = false;
let attempt = null;

function formatPhone(value) {
  const digits = value.replace(/\D/g, '');
  if (value.trim().startsWith('+') && !(digits.length === 11 && digits.startsWith('1'))) return value;
  if (!digits) return '';
  const hasCountryCode = digits.length === 11 && digits.startsWith('1');
  const national = hasCountryCode ? digits.slice(1) : digits;
  if (national.length > 10) return value;
  let formatted = `${hasCountryCode ? '+1 ' : ''}(${national.slice(0, 3)})`;
  if (national.length >= 3) formatted += ' ';
  formatted += national.slice(3, 6);
  if (national.length >= 6) formatted += `-${national.slice(6)}`;
  return formatted;
}

phone.addEventListener('input', event => {
  const value = phone.value;
  const cursor = phone.selectionStart ?? value.length;
  const digitsBeforeCursor = value.slice(0, cursor).replace(/\D/g, '').length;
  const formatted = formatPhone(value);
  if (formatted === value) return;
  phone.value = formatted;
  let position = 0;
  let digitsSeen = 0;
  while (position < formatted.length && digitsSeen < digitsBeforeCursor) {
    if (/\d/.test(formatted[position])) digitsSeen += 1;
    position += 1;
  }
  if (!event.inputType?.startsWith('delete')) {
    while (position < formatted.length && !/\d/.test(formatted[position])) position += 1;
  }
  phone.setSelectionRange(position, position);
});

// Delete a digit when Backspace or Delete reaches automatically inserted punctuation.
phone.addEventListener('beforeinput', event => {
  if (!event.cancelable) return;
  const backward = event.inputType === 'deleteContentBackward';
  const forward = event.inputType === 'deleteContentForward';
  if ((!backward && !forward) || phone.selectionStart !== phone.selectionEnd) return;
  if (!phone.value.startsWith('(') && !phone.value.startsWith('+1 (')) return;
  const cursor = phone.selectionStart ?? 0;
  let position = backward ? cursor - 1 : cursor;
  if (position < 0 || position >= phone.value.length || /\d/.test(phone.value[position])) return;
  while (position >= 0 && position < phone.value.length && !/\d/.test(phone.value[position])) {
    position += backward ? -1 : 1;
  }
  if (position < 0 || position >= phone.value.length) return;
  event.preventDefault();
  phone.setRangeText('', position, position + 1, 'end');
  phone.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: event.inputType }));
});

function updateGuestSummary() {
  bringingOthers.checked = additionalNames.length > 0;
  guestSummary.hidden = !additionalNames.length;
  guestSummaryNames.textContent = additionalNames.join(', ');
}

function openGuestDialog() {
  guestInputs.forEach((input, index) => {
    input.value = additionalNames[index] || '';
    input.setCustomValidity('');
  });
  guestDialog.showModal();
  guestInputs[0].focus();
}

bringingOthers.addEventListener('change', () => {
  if (bringingOthers.checked) {
    openGuestDialog();
  } else {
    additionalNames = [];
    updateGuestSummary();
  }
});
document.querySelector('#edit-guests').addEventListener('click', openGuestDialog);
document.querySelector('#cancel-guests').addEventListener('click', () => guestDialog.close());
guestDialog.addEventListener('close', updateGuestSummary);
guestForm.addEventListener('input', () => guestInputs[0].setCustomValidity(''));
guestForm.addEventListener('submit', event => {
  event.preventDefault();
  const names = guestInputs.map(input => input.value.trim()).filter(Boolean);
  guestInputs[0].setCustomValidity(names.length ? '' : 'Enter at least one name, or select Cancel.');
  if (!guestForm.reportValidity()) return;
  additionalNames = names;
  updateGuestSummary();
  guestDialog.close();
});

function validateContact() {
  fullName.setCustomValidity(fullName.value.trim() ? '' : 'Please enter your first and last name.');
  const digits = phone.value.replace(/\D/g, '');
  const domestic = digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
  const international = phone.value.trim().startsWith('+') && digits.length >= 7 && digits.length <= 15;
  const validPhone = /^[\d\s()+.\-]+$/.test(phone.value) && (domestic || international);
  phone.setCustomValidity(validPhone ? '' : 'Please enter your three-digit area code and seven-digit phone number, or an international number starting with +.');
  email.setCustomValidity(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? '' : 'Please enter a valid email address.');
}

form.addEventListener('input', () => {
  fullName.setCustomValidity('');
  phone.setCustomValidity('');
  email.setCustomValidity('');
  errorMessage.hidden = true;
});

function showConfirmation(data) {
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
  if (data.additional_names.length) {
    const term = document.createElement('dt');
    const definition = document.createElement('dd');
    term.textContent = 'With you';
    definition.textContent = data.additional_names.join(', ');
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
  if (bringingOthers.checked && !additionalNames.length) {
    openGuestDialog();
    return;
  }
  const data = {
    full_name: fullName.value.trim(),
    people_count: 1 + additionalNames.length,
    additional_names: [...additionalNames],
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
  additionalNames = [];
  updateGuestSummary();
  attempt = null;
  errorMessage.hidden = true;
  status.textContent = '';
  success.hidden = true;
  summary.replaceChildren();
  form.hidden = false;
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
        select: 'full_name,available_dates,additional_names',
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
      if (signup.additional_names?.length) {
        const guests = document.createElement('div');
        guests.className = 'attendee-guests';
        guests.textContent = `With ${signup.additional_names.join(', ')}`;
        row.insertBefore(guests, nights);
      }
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
