/**
 * HirePair - Tailwind CSS Theme Configuration
 * Manual de Marca Oficial - Direção 1b: Quiet Azul + Fundo Creme
 */

if (typeof tailwind !== 'undefined') {
  tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        fontFamily: {
          sans: ['Plus Jakarta Sans', 'Public Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
          heading: ['Plus Jakarta Sans', 'sans-serif'],
          body: ['Public Sans', 'sans-serif'],
        },
        colors: {
          // Cores Oficiais do Manual de Marca
          brand: {
            primary: '#636FC1',       // Azul Confiança (Âncora, CTAs, links)
            'primary-hover': '#525EAF',
            navy: '#333364',          // Navy (Títulos, botões secundários, fundos escuros)
            'navy-hover': '#25254A',
            light: '#A7BBE0',         // Azul Claro (Segunda pessoa do símbolo, badges, tags)
            pink: '#D3A4CF',          // Rosa Humano (Acento pontual, destaque suave)
            creme: '#F5EEE2',         // Creme (Fundo padrão da interface - Nunca branco puro)
            'creme-deep': '#EDE4D3',  // Creme Profundo (Cards, superfícies elevadas, barras)
            whatsapp: '#2E7D32',
          },
          surface: {
            DEFAULT: '#F5EEE2',
            creme: '#F5EEE2',
            'creme-deep': '#EDE4D3',
            card: '#EDE4D3',
            paper: '#FFFFFF',         // Branco reservado exclusivamente para a folha do currículo
            clean: '#EDE4D3',
            dim: '#333364',
            dark: '#252626',
            'container-low': '#EDE4D3',
            'container-high': '#E5DAC6',
          },
          text: {
            main: '#252626',          // Tinta principal
            muted: '#4A4643',         // Tinta suave para parágrafos
            dim: '#807A72',           // Tinta apagada para legendas / rótulos
            light: '#F5EEE2',         // Texto claro para superfícies escuras
          },
          status: {
            success: '#3D7A3D',
            'success-bg': '#D7EACD',
            danger: '#A63838',
          },
          
          // Aliases semânticos para compatibilidade retroativa
          primary: {
            DEFAULT: '#636FC1',
            container: '#333364',
            soft: '#EDE4D3',
          },
          secondary: {
            DEFAULT: '#3D7A3D',
            container: '#A7BBE0',
          },
          background: '#F5EEE2',
          'on-background': '#252626',
          'on-surface': '#252626',
          'on-surface-variant': '#4A4643',
          'pastel-blue-tint': 'rgba(37,38,38,0.12)',
        },
        borderRadius: {
          'sm': '0.375rem',
          'DEFAULT': '0.75rem',
          'md': '0.875rem',
          'lg': '1rem',
          'xl': '1.25rem',
          '2xl': '1.5rem',            // 24px para cards
          '3xl': '1.75rem',           // 28px para containers
          '4xl': '2.5rem',            // 40px para telas mobile
          'full': '9999px',           // Pílula para botões
        },
        boxShadow: {
          'soft-sm': '0 4px 12px -2px rgba(37, 38, 38, 0.06)',
          'soft-md': '0 12px 28px -6px rgba(37, 38, 38, 0.10)',
          'soft-lg': '0 18px 40px -28px rgba(37, 38, 38, 0.45)',
          'mobile-frame': '0 28px 56px -36px rgba(37, 38, 38, 0.50)',
          'desktop-frame': '0 30px 60px -40px rgba(37, 38, 38, 0.50)',
        }
      }
    }
  };
}
