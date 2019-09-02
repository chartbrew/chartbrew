module.exports = {
  title: 'ChartBrew',
  description: 'The official documentation of ChartBrew, a web app for generating charts from your data sources.',
  themeConfig: {
    logo: '/assets/cb_logo_4_small.png',
    displayAllHeaders: true,
    nav: [
      { text: 'Home', link: '/' },
      { text: 'ChartBrew website', link: 'https://chartbrew.com' },
      { text: 'Github', link: 'https://github.com/razvanilin/chartbrew' },
      { text: 'Join our Slack', link: 'https://join.slack.com/t/chartbrew/shared_invite/enQtNzMzMzkzMTQ5MDc0LTlhYTE0N2E4ZDE5Y2MyNTMxZGExNTVjYjZmN2FjZjlhMTdhZTBjMGQ5MGQwYjEzMjkzNzg0ZjE2MzEwMThlMjQ' }
    ],
    sidebar: [
      ['/', 'Introduction'],
      ['/database/', 'Database configuration'],
      ['/deployment/', 'Deployment'],
      ['/backend/', 'Backend'],
      ['/frontend/', 'Frontend'],
    ],
  },
};
