(() => {
  const dialog = document.getElementById('enrollment-dialog');
  const form = document.getElementById('enrollment-form');
  const fields = document.getElementById('enrollment-fields');
  const submit = document.getElementById('enrollment-submit');
  const status = document.getElementById('enrollment-status');
  const date = document.getElementById('enrollment-date');
  let endpoint = 'https://script.google.com/macros/s/AKfycbz6gMuLriEytKpZsFf3GI0ppPhFIRwNvqaDZAa8ovLozDIxvLLVyMjZ3fXV7Ib33aL6vA/exec';
  let pending = null;
  let delivered = false;
  let trigger = null;

  function showStatus(message, error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
  }

  async function configure() {
    submit.disabled = true;
    showStatus('Preparing your enquiry...');
    try {
      const response = await fetch('./enrollment-config.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Enrollment configuration could not be loaded.');
      const config = await response.json();
      if (typeof config.endpoint !== 'string' || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.endpoint)) {
        throw new Error('Online enquiries are not connected yet. Please use the email or phone link below.');
      }
      endpoint = config.endpoint;
      form.action = endpoint;
      submit.disabled = false;
      showStatus('');
    } catch (error) {
      console.error('Enrollment setup failed:', error);
      showStatus('Online enquiries are unavailable. Please use the email or phone link below.', true);
    }
  }

  document.getElementById('lessons-cards').addEventListener('click', event => {
    const button = event.target.closest('button[data-enroll]');
    if (!button) return;
    trigger = button;
    if (!pending) {
      if (delivered) {
        form.reset();
        form.hidden = false;
        delivered = false;
        showStatus('');
      }
      const lesson = button.closest('.card').querySelector('h3').textContent.trim();
      document.getElementById('enrollment-lesson').value = lesson;
      document.getElementById('enrollment-lesson-label').textContent = lesson;
      const today = new Date();
      date.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (!endpoint) void configure();
    }
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('enrollment-open');
  });

  dialog.querySelector('.enrollment-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('enrollment-open');
    trigger?.focus();
  });

  function finish(message, error) {
    clearTimeout(pending.timer);
    pending = null;
    fields.disabled = false;
    submit.textContent = 'Send lesson enquiry';
    form.removeAttribute('aria-busy');
    delivered = !error;
    form.hidden = delivered;
    showStatus(message, error);
    if (delivered) {
      form.reset();
      if (dialog.open) dialog.querySelector('.enrollment-close').focus();
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (pending || !endpoint || !form.reportValidity()) return;
    for (const id of ['enrollment-name', 'enrollment-phone']) {
      const input = document.getElementById(id);
      input.setCustomValidity('');
      if (!input.value.trim() || (id === 'enrollment-phone' && input.value.replace(/\D/g, '').length < 7)) {
        input.setCustomValidity(id === 'enrollment-name' ? 'Please enter your name.' : 'Please enter a phone number with at least 7 digits.');
        input.reportValidity();
        return;
      }
    }
    const requestId = crypto.randomUUID();
    document.getElementById('enrollment-request-id').value = requestId;
    pending = {
      requestId,
      timer: setTimeout(() => finish('Delivery could not be confirmed. Your enquiry may have arrived; please email or call us before trying again.', true), 45000)
    };
    showStatus('Sending your enquiry securely. Please wait...');
    submit.textContent = 'Sending...';
    form.setAttribute('aria-busy', 'true');
    // Native form navigation avoids Apps Script's cross-origin fetch restrictions.
    // Disable fields only after the browser has captured the form payload.
    try {
      HTMLFormElement.prototype.submit.call(form);
      fields.disabled = true;
    } catch (error) {
      console.error('Enrollment submission failed:', error);
      finish('Your enquiry could not be sent. Please try again or email us directly.', true);
    }
  });

  form.addEventListener('input', event => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
  });

  window.addEventListener('message', event => {
    if (!pending) return;
    let origin;
    try {
      origin = new URL(event.origin);
    } catch {
      return; // Ignore unrelated messages, including opaque origins.
    }
    if (origin.protocol !== 'https:' || !(origin.hostname === 'script.google.com' || origin.hostname === 'script.googleusercontent.com' || origin.hostname.endsWith('-script.googleusercontent.com'))) return;
    const result = event.data;
    if (!result || result.type !== 'nairobi-enrollment' || result.requestId !== pending.requestId || typeof result.ok !== 'boolean') return;
    finish(result.ok
      ? 'Asante! Your enquiry has been emailed to Nairobi Swahili. We will contact you to discuss your lessons.'
      : 'Your enquiry could not be sent. Please try again later or email us directly.', !result.ok);
  });
})();
