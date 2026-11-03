module.exports = {
  plugins: [
    require('tailwindcss')({ config: './tailwind.config.cjs' }),
    {
      postcssPlugin: 'isolate-chat-utilities',
      OnceExit(root) {
        root.walkRules((rule) => {
          if (rule.selector === '*, ::before, ::after')
            rule.selector =
              ':where(.wisp-ui, .wisp-ui *, .wisp-ui *::before, .wisp-ui *::after)'
          if (rule.selector === '::backdrop')
            rule.selector = ':where(.wisp-ui)::backdrop'
        })
        root.walkDecls((decl) => {
          decl.prop = decl.prop.replaceAll('--tw-', '--wisp-tw-')
          decl.value = decl.value
            .replaceAll('--tw-', '--wisp-tw-')
            .replace(
              /(-?[0-9.]+)rem\b/g,
              (_, value) => `${Number(value) * 14}px`,
            )
        })
      },
    },
  ],
}
