// CatatUang GitHub Updater
async function checkGithubUpdate(silent) {
  const repo = (S.set.githubRepo || '').trim();
  if (!repo) return;
  try {
    const res = await fetch('https://api.github.com/repos/' + repo + '/releases/latest');
    if (!res.ok) return;
    const j = await res.json();
    const latestTag = (j.tag_name || '').replace(/^v/, '');
    const apkAsset = (j.assets || []).find((a) => /\.apk$/i.test(a.name || ''));
    if (!latestTag || !apkAsset) return;
    const compatible = cmpVer(latestTag, APP_VERSION) > 0;
    updateInfo = { tag: latestTag, url: apkAsset.browser_download_url, name: apkAsset.name, size: apkAsset.size, published: j.published_at, compatible };
    if (compatible && !silent) showToast(`Update v${latestTag} tersedia`, 'success');
    if (compatible && silent) {
      const shownKey = 'catatuang-update-notified';
      if (localStorage.getItem(shownKey) !== latestTag) {
        localStorage.setItem(shownKey, latestTag);
        setTimeout(() => showToast(`Update v${latestTag} tersedia`, 'success'), 800);
      }
    }
    render();
  } catch (e) {
    if (!silent) ErrorLog.add('checkGithubUpdate failed', e);
  }
}

function openUpdateLink(url) {
  const target = (updateInfo && updateInfo.url) || url;
  if (!target) return;
  if (!updateInfo || !updateInfo.compatible) {
    showError('Versi APK tidak kompatibel dengan versi saat ini.');
    return;
  }
  showToast('Pastikan Anda telah mengekspor cadangan data sebelum memperbarui.', 'warning');
  if (NATIVE && window.Capacitor?.Plugins?.Share) {
    Capacitor.Plugins.Share.share({ url: target, title: 'CatatUang APK' });
  } else {
    window.open(target, '_blank', 'noopener');
  }
}

function checkUpdateCompatibility(latestVersion) {
  if (!latestVersion) return { ok: true, message: '' };
  const cmp = cmpVer(latestVersion, APP_VERSION);
  if (cmp < 0) {
    return { ok: false, message: 'Versi APK lebih lama dari versi terinstal.' };
  }
  return { ok: true, message: '' };
}
