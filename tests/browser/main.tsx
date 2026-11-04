const root = document.getElementById('app')
if (root) {
  if (new URLSearchParams(location.search).get('framework') === 'vue') {
    const [{ createApp }, { default: VueHost }] = await Promise.all([
      import('vue'),
      import('./VueHost.vue'),
    ])
    createApp(VueHost).mount(root)
  } else {
    const [{ createRoot }, { ReactHost }] = await Promise.all([
      import('react-dom/client'),
      import('./ReactHost'),
    ])
    createRoot(root).render(<ReactHost />)
  }
}
