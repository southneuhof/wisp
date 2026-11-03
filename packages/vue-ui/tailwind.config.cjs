const color = (token) =>
  `color-mix(in srgb, var(--wisp-${token}) calc(<alpha-value> * 100%), transparent)`
module.exports = {
  content: ['./src/**/*.vue'],
  prefix: 'wisp-',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        primary: color('accent'),
        'on-primary': color('primary-fg'),
        surface: {
          DEFAULT: color('bg'),
          container: { DEFAULT: color('bg'), high: color('menu-bg') },
        },
        'on-surface': { DEFAULT: color('fg'), variant: color('muted') },
        error: color('danger'),
        'outline-variant': color('border'),
        'chat-user': { DEFAULT: color('user'), foreground: color('user-fg') },
      },
    },
  },
}
