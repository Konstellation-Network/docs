// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Konstellation',
  tagline: 'Documentation for the Konstellation network',
  // TODO: set to the real docs domain once one is provisioned.
  url: 'https://docs.konstellation.network',
  baseUrl: '/',

  organizationName: 'konstellation-network',
  projectName: 'docs',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/', // docs-only mode: no separate blog/landing page
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/konstellation-network/docs/edit/main/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Konstellation',
        items: [
          {
            to: '/',
            label: 'Quickstart',
            position: 'left',
          },
          {
            to: '/rpc-endpoints',
            label: 'RPC Endpoints',
            position: 'left',
          },
          {
            to: '/contracts',
            label: 'Contracts',
            position: 'left',
          },
          {
            to: '/run-a-validator',
            label: 'Run a Validator',
            position: 'left',
          },
          {
            href: 'https://github.com/konstellation-network',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [],
        copyright: `Copyright © ${new Date().getFullYear()} Konstellation Network.`,
      },
      prism: {
        additionalLanguages: ['bash', 'toml', 'json', 'solidity'],
      },
    }),
};

module.exports = config;
