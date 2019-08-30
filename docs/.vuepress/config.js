module.exports = {
  title: 'ChartBrew',
  description: 'Just playing around',
  themeConfig: {
    logo: '/assets/cb_logo_4_small.png',
    displayAllHeaders: true,
    nav: [
      { text: 'Home', link: '/' },
      { text: 'ChartBrew website', link: 'https://chartbrew.com' },
      { text: 'Github', link: 'https://github.com/razvanilin/chartbrew' },
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
