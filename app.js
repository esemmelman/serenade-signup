const SUPABASE_URL = 'https://fgomaujsdblpzxhnnqrg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
const TABLE = 'hanukkah_serenading_signups';
const form = document.querySelector('#signup-form');
const fields = document.querySelector('#signup-fields');
const fullName = document.querySelector('#full-name');
const phone = document.querySelector('#cell-phone');
const email = document.querySelector('#email');
const submitButton = document.querySelector('#submit-button');
const errorMessage = document.querySelector('#form-error');
const status = document.querySelector('#save-status');
const success = document.querySelector('#success');
const summary = document.querySelector('#signup-summary');
let submitting = false;
let attempt = null;

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
  summary.replaceChildren();
  const dates = data.available_dates.map(value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })).join(', ');
  for (const [label, value] of [
    ['Name', data.full_name], ['People', String(data.people_count)],
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
    people_count: Number(document.querySelector('#people-count').value),
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
    submitButton.replaceChildren('Sign me up ');
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    submitButton.append(arrow);
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
  fullName.focus();
});
