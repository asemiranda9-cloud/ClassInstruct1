// ── Support Page ──

// Send support message (stub)
function sendMessage() {
  const subject = document.querySelector('input[placeholder="What do you need help with?"]');
  const message = document.querySelector('textarea[placeholder="Describe your issue or question..."]');

  if (!subject || !subject.value.trim()) {
    alert('Please enter a subject.');
    return;
  }
  if (!message || !message.value.trim()) {
    alert('Please enter a message.');
    return;
  }

  alert('Message sent! We\'ll get back to you soon.');
  subject.value = '';
  message.value = '';
}
