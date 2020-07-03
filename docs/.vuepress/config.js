module.exports = {
  title: 'Chartbrew',
  description: 'The official documentation of Chartbrew, a web app for generating charts from your data sources.',
  themeConfig: {
    logo: '/assets/logo_blue.png',
    displayAllHeaders: true,
    nav: [
      { text: 'Home', link: '/' },
      { text: '🍺 Chartbrew website', link: 'https://chartbrew.com' },
      { text: '🤘 Join our Discord', link: 'https://discord.gg/KwGEbFk' },
      { text: '👋 Join our Slack', link: 'https://join.slack.com/t/chartbrew/shared_invite/enQtODU3MzYzNTkwOTMwLTZiOTA5YzczODUzZGFiZmQyMGI1ZGVmZGI4YTVmOTBkMTI0YzQ2ZjJjOGI5NzQ0NmNmYzRmMDk3MmY4YmI4MTI' },
      { text: '👨‍💻 GitHub', link: 'https://github.com/chartbrew/chartbrew' },
    ],
    sidebar: [
      {
        path: '/',
        title: '🚀 Introduction',
      },
      {
        path: '/database/',
        title: '🔌 Database configuration',
      },
      {
        path: '/deployment/',
        title: '🌍 Deployment',
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
