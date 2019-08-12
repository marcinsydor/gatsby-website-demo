require("dotenv").config({
  path: `.env.${process.env.NODE_ENV}`
});

module.exports = {
  __experimentalThemes: [
    {
      resolve: `gatsby-theme-datocms`,
      options: {
        datacms: {
          apiToken: process.env.DATOCMS_API_TOKEN,
          previewMode: process.env.DATOCMS_PREVIEW === "true"
        }
      }
    }
  ],
  siteMetadata: {
    siteUrl: `https://magmarconstruction.co.uk/`
  },
  plugins: [
    {
      resolve: "gatsby-theme-ui"
    },
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `magmar-construction`,
        short_name: `website`,
        start_url: `/`,
        background_color: `#367DBA`,
        theme_color: `#367DBA`,
        display: `minimal-ui`
      }
    }
  ]
};
