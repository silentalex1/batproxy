if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      return Promise.all(
        registrations
          .filter((reg) => !reg.scope.includes('/uv'))
          .map((reg) => reg.unregister())
      );
    }).then(() => {
      return navigator.serviceWorker.register('/uv-sw.js', { scope: '/' });
    }).then(() => {
      console.log('ServiceWorker registration successful');
    }).catch((error) => {
      console.log('ServiceWorker registration failed:', error);
    });
  });
}
