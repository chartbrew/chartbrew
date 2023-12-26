import { defineConfig } from 'vitepress'

let ogprefix = 'og: http://ogp.me/ns#';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  head: [
    ['link', { rel: 'icon', href: '/logo_blue_2.png' }],
    ['meta', { prefix: ogprefix, property: 'og:title', content: 'Chartbrew Documentation' }],
    ['meta', { prefix: ogprefix, property: 'og:description', content: 'The official documentation of Chartbrew, a platform that lets you create powerful dashboards and interactive data reports by connecting all your services in one place' }],
    ['meta', { prefix: ogprefix, property: 'og:image', content: 'https://cdn2.chartbrew.com/chartbrew_visualize_banner_6.png' }],
    ['meta', { prefix: ogprefix, property: 'og:type', content: 'article' }],
    ['meta', { prefix: ogprefix, property: 'og:article:author', content: 'Razvan Ilin' }],
  ],
  title: "Chartbrew v3 Docs",
  description: "The official Chartbrew Documentation site",
  themeConfig: {
    logo: "/logo_blue_2.png",
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Chartbrew', link: 'https://chartbrew.com' },
    ],

    sidebar: [
      {
        link: '/',
        text: '🚀 Introduction',
      },
      {
        link: '/database/',
        text: '💾 Database configuration',
      },
      {
        link: '/deployment/',
        text: '🌍 Deployment',
      },
      {
        link: '/integrations/',
        text: '🔌 Integrations',
        collapsable: false,
        sidebarDepth: 0,
        items: [
          { link: "/integrations/google-analytics/", text: "Google Analytics"},
          { link: "/integrations/webhooks/", text: "Webhooks" }
        ],
      },
      {
        link: '/backend/',
        text: '🧪 Backend'
      },
      {
        link: '/frontend/',
        text: '✨ Frontend'
      },
      {
        text: "🚧 Migrations",
        collapsable: false,
        sidebarDepth: 0,
        items: [
          { link: "/migrations/v3/", text: "Migrating to v3" },
          { link: "/migrations/v1.0.0-beta.9/", text: "v1.0.0-beta.9" }
        ],
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/chartbrew/chartbrew/' },
      { icon: 'x', link: 'https://twitter.com/chartbrew' },
      { icon: 'discord', link: 'https://discord.gg/KwGEbFk' }
    ]
  }
})
