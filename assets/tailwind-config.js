/* Shared Tailwind CDN config. Must load after the Tailwind CDN <script>
   and before the page's other content is scanned. Pulled out of inline
   <script> tags so pages don't depend on inline script execution being
   allowed by whatever is previewing them. */
tailwind.config = {
  theme: {
    extend: {
      colors: {
        ink: '#0B0E13', ink2: '#161B24',
        blue: { DEFAULT: '#1E7BFF', 50: '#EAF2FF' },
        cyan: { DEFAULT: '#29B6F6', 50: '#E8F8FF' },
        surface: '#FFFFFF', alt: '#F4F6F8', muted: '#5B6472', line: '#E4E8ED',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        serif: ['"Source Serif 4"', 'serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
};
