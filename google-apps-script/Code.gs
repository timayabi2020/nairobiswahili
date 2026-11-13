function doPost(event) {
  var properties = PropertiesService.getScriptProperties();
  var siteOrigin = properties.getProperty('SITE_ORIGIN');
  var recipient = properties.getProperty('ENROLLMENT_EMAIL');
  var requestId = '';
  var ok = false;
  try {
    if (!siteOrigin || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(siteOrigin) ||
        !recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new Error('Configure SITE_ORIGIN and ENROLLMENT_EMAIL script properties.');
    }
    var data = validateEnrollment(event && event.parameter);
    requestId = data.requestId;
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('Enrollment service is busy.');
    try {
      var cache = CacheService.getScriptCache();
      var receiptKey = 'receipt:' + requestId;
      if (cache.get(receiptKey)) {
        ok = true;
      } else {
        var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data.email.toLowerCase());
        var rateKey = 'sender:' + Utilities.base64EncodeWebSafe(digest);
        var attempts = Number(cache.get(rateKey) || 0);
        var day = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
        var dailyCount = properties.getProperty('SEND_DAY') === day ? Number(properties.getProperty('SEND_COUNT') || 0) : 0;
        if (attempts >= 3 || dailyCount >= 80 || MailApp.getRemainingDailyQuota() < 1) {
          throw new Error('Enrollment email limit reached.');
        }
        cache.put(rateKey, String(attempts + 1), 600);
        MailApp.sendEmail({
          to: recipient,
          replyTo: data.email,
          name: 'Nairobi Swahili',
          subject: 'Lesson enquiry: ' + data.lesson,
          body: [
            'New Nairobi Swahili lesson enquiry',
            '',
            'Lesson: ' + data.lesson,
            'Name: ' + data.name,
            'Phone: ' + data.phone,
            'Email: ' + data.email,
            'Preferred start date: ' + (data.startDate || 'Not specified'),
            '',
            'Questions / suggestions:',
            data.message || 'None provided',
            '',
            'Consent: Contact me about this lesson enquiry only.',
            'Request ID: ' + requestId
          ].join('\n')
        });
        cache.put(receiptKey, 'sent', 21600);
        properties.setProperties({ SEND_DAY: day, SEND_COUNT: String(dailyCount + 1) });
        ok = true;
      }
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    // Do not log the submitted contact details or message.
    console.error('Enrollment delivery failed: ' + error.message);
    if (event && event.parameter && /^[a-f0-9-]{36}$/i.test(event.parameter.requestId || '')) {
      requestId = event.parameter.requestId;
    }
  }
  var result = JSON.stringify({ type: 'nairobi-enrollment', requestId: requestId, ok: ok });
  var target = JSON.stringify(siteOrigin || 'https://nairobiswahili.com');
  // Escape script delimiters even though all response fields are server-controlled.
  var script = 'window.top.postMessage(' + result + ', ' + target + ');';
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>' +
    script.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') +
    '</script></body></html>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function validateEnrollment(input) {
  if (!input) throw new Error('Missing enrollment data.');
  function field(key, max, required, multiline) {
    var value = typeof input[key] === 'string' ? input[key].trim() : '';
    if ((required && !value) || value.length > max || (!multiline && /[\r\n\x00-\x1f\x7f]/.test(value))) {
      throw new Error('Invalid enrollment field: ' + key);
    }
    return value;
  }
  if (input.website || input.consent !== 'yes') throw new Error('Invalid enrollment consent or spam field.');
  var data = {
    requestId: field('requestId', 36, true),
    lesson: field('lesson', 200, true),
    name: field('name', 120, true),
    phone: field('phone', 30, true),
    email: field('email', 254, true),
    startDate: field('startDate', 10, false),
    message: field('message', 2000, false, true)
  };
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.requestId) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
      !/^[+0-9() .-]{7,30}$/.test(data.phone) || data.phone.replace(/\D/g, '').length < 7) {
    throw new Error('Invalid enrollment contact or request ID.');
  }
  if (data.startDate) {
    var parsed = new Date(data.startDate + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate) || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== data.startDate) {
      throw new Error('Invalid preferred start date.');
    }
  }
  return data;
}
