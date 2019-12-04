module.exports = {
  title: 'ChartBrew',
  description: 'The official documentation of ChartBrew, a web app for generating charts from your data sources.',
  themeConfig: {
    logo: '/assets/cb_logo_4_small.png',
    displayAllHeaders: true,
    nav: [
      { text: 'Home', link: '/' },
      { text: '🍺 ChartBrew website', link: 'https://chartbrew.com' },
      { text: '👋 Join our Slack', link: 'https://join.slack.com/t/chartbrew/shared_invite/enQtNzMzMzkzMTQ5MDc0LTlhYTE0N2E4ZDE5Y2MyNTMxZGExNTVjYjZmN2FjZjlhMTdhZTBjMGQ5MGQwYjEzMjkzNzg0ZjE2MzEwMThlMjQ' },
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
