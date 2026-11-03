<template>
  <svg
    class="wisp-spinner"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      stroke-width="2"
      opacity=".2"
    />
    <path
      d="M12 3a9 9 0 0 1 9 9"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>
</template>
<style scoped>
.wisp-spinner {
  display: inline-block;
  animation: wisp-spin 0.8s linear infinite;
}
@keyframes wisp-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .wisp-spinner {
    animation-duration: 2s;
  }
}
</style>
