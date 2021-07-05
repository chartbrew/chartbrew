let ogprefix = 'og: http://ogp.me/ns#';

module.exports = {
  title: 'Chartbrew Documentation',
  description: 'The official documentation of Chartbrew, a platform that lets you create powerful dashboards and interactive data reports by connecting all your services in one place',
  head: [
    ['link', { rel: 'icon', href: '/assets/logo_blue_2.png' }],
    ['meta', { prefix: ogprefix, property: 'og:title', content: 'Chartbrew Documentation' }],
    ['meta', { prefix: ogprefix, property: 'og:description', content: 'The official documentation of Chartbrew, a platform that lets you create powerful dashboards and interactive data reports by connecting all your services in one place' }],
    ['meta', { prefix: ogprefix, property: 'og:image', content: 'https://cdn2.chartbrew.com/chartbrew_visualize_banner_3.png' }],
    ['meta', { prefix: ogprefix, property: 'og:type', content: 'article' }],
    ['meta', { prefix: ogprefix, property: 'og:article:author', content: 'Razvan Ilin' }],
  ],
  themeConfig: {
    logo: '/assets/logo_blue_2.png',
    displayAllHeaders: true,
    nav: [
      { text: 'Home', link: '/' },
      { text: '🍺 Chartbrew website', link: 'https://chartbrew.com' },
      { text: '🤘 Join our Discord', link: 'https://discord.gg/KwGEbFk' },
      { text: '👨‍💻 GitHub', link: 'https://github.com/chartbrew/chartbrew' },
    ],
    sidebar: [
      {
        path: '/',
        title: '🚀 Introduction',
      },
      {
        path: '/database/',
        title: '💾 Database configuration',
      },
      {
        path: '/deployment/',
        title: '🌍 Deployment',
      },
      {
        path: '/integrations/',
        title: '🔌 Integrations',
        collapsable: false,
        sidebarDepth: 0,
        children: [
          ["/integrations/google-analytics/", "Google Analytics"]
        ],
      },
      {
        path: '/backend/',
        title: '🧪 Backend'
      },
      {
        path: '/frontend/',
        title: '✨ Frontend'
      },
      { 
        path: '/oneaccount/',
        title: '🔐 One account setup'
      },
      {
        title: "🚧 Migrations",
        collapsable: false,
        sidebarDepth: 0,
        children: [
          ["/migrations/v1.0.0-beta.9/", "v1.0.0-beta.9"]
        ],
      }
    ],
    lastUpdated: true,
    docsRepo: "chartbrew/chartbrew",
    docsDir: "docs",
    docsBranch: "master",
    editLinks: true,
    editLinkText: "Help us improve this page",
    smoothScroll: true,
  },
};
