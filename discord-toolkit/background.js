const APP_URL = chrome.runtime.getURL('popup.html');
let appWindowId = null;

async function openApp() {
  if (appWindowId !== null) {
    try {
      await chrome.windows.update(appWindowId, {focused: true});
      return;
    } catch (_) {
      appWindowId = null;
    }
  }
  const w = await chrome.windows.create({
    url: APP_URL,
    type: 'popup',
    width: 1180,
    height: 760,
    focused: true
  });
  appWindowId = w.id;
}

chrome.action.onClicked.addListener(openApp);
chrome.windows.onRemoved.addListener(id => {
  if (id === appWindowId) appWindowId = null;
});
chrome.runtime.onInstalled.addListener(() => console.log('TWILIGHT Ultimate 4.0 installed'));
