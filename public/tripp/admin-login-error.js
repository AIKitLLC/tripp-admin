// The callback query is never read. Only server-projected diagnostic text is copied.
try {
  window.history.replaceState(null, '', '/admin');
} catch {
  // Some embedded browsers restrict history changes. Do not inspect their errors.
}

const errorText = document.getElementById('login-error-text');
const copyButton = document.getElementById('copy-login-error');
const copyStatus = document.getElementById('copy-login-error-status');

function selectErrorText() {
  if (!(errorText instanceof HTMLTextAreaElement)) return;
  errorText.focus({ preventScroll: true });
  errorText.select();
  errorText.setSelectionRange(0, errorText.value.length);
  if (copyStatus) copyStatus.textContent = 'Nội dung đã được chọn. Chạm giữ trong ô bên dưới, rồi chọn “Sao chép”.';
}

if (copyButton && errorText instanceof HTMLTextAreaElement) {
  copyButton.addEventListener('click', async () => {
    copyButton.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) {
        selectErrorText();
        return;
      }
      await navigator.clipboard.writeText(errorText.value);
      if (copyStatus) copyStatus.textContent = 'Đã sao chép thông tin lỗi. Bạn có thể dán để gửi hỗ trợ.';
    } catch {
      selectErrorText();
    } finally {
      copyButton.disabled = false;
    }
  });
}
