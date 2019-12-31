module.exports = {
  title: 'ChartBrew',
  description: 'The official documentation of ChartBrew, a web app for generating charts from your data sources.',
  themeConfig: {
    logo: '/assets/cb_logo_4_small.png',
    displayAllHeaders: true,
    nav: [
      { text: 'Home', link: '/' },
      { text: '🍺 ChartBrew website', link: 'https://chartbrew.com' },
      { text: '🤘 Join our Discord', link: 'https://discord.gg/KwGEbFk' },
      { text: '👋 Join our Slack', link: 'https://join.slack.com/t/chartbrew/shared_invite/enQtODU3MzYzNTkwOTMwLTZiOTA5YzczODUzZGFiZmQyMGI1ZGVmZGI4YTVmOTBkMTI0YzQ2ZjJjOGI5NzQ0NmNmYzRmMDk3MmY4YmI4MTI' },
      { text: '👨‍💻 GitHub', link: 'https://github.com/chartbrew/chartbrew' },
    ],
    sidebar: [
      ['/', '🚀 Introduction'],
      ['/database/', '🔌 Database configuration'],
      ['/deployment/', '🌍 Deployment'],
      ['/backend/', '🧪 Backend'],
      ['/frontend/', '✨ Frontend'],
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
