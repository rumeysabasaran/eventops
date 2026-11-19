/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          primary: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
          hover: '#f1f5f9',
        },
        brand: {
          DEFAULT: '#10b981',      // Birincil yeşil
          dark: '#059669',         // Hover yeşili
          deep: '#064e3b',         // Koyu orman yeşili
          light: '#6ee7b7',        // Açık nane yeşili
          bg: '#ecfdf5',           // Çok açık nane yeşili zemin
          border: '#d1fae5',       // Yumuşak yeşil kenarlık
        },
        sidebar: {
          DEFAULT: '#0f172a',      // Derin antrasit / gece mavisi
          hover: '#1e293b',
          border: '#1e293b',
          text: '#94a3b8',
          active: '#10b981',
        },
        corp: {
          DEFAULT: '#0f172a',      // Koyu kurşun başlıklar / sayılar
          dark: '#020617',
          medium: '#1e293b',
          light: '#334155',
          muted: '#64748b',
          bg: '#f8fafc',
        },
        border: {
          DEFAULT: '#e2e8f0',      // 1px solid #E2E8F0
          strong: '#cbd5e1',
          light: '#f1f5f9',
        },
        status: {
          success: '#10b981',
          warning: '#d97706',
          danger: '#e11d48',
          info: '#2563eb',
        },
        text: {
          primary: '#0f172a',      // Koyu kurşun
          secondary: '#334155',    // Gövde metinleri
          muted: '#64748b',        // Açıklamalar (#64748B)
          light: '#94a3b8',        // İpuçları (#94A3B8)
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 2px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 4px 12px rgba(15, 23, 42, 0.06)',
        'dropdown': '0 10px 25px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
      },
      borderRadius: {
        'card': '8px',
        'input': '6px',
        'badge': '4px',
      },
    },
  },
  plugins: [],
}
