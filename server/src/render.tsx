import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { SchemaLink } from '@apollo/client/link/schema'
import { getDataFromTree } from '@apollo/client/react/ssr'
import { isRedirect, ServerLocation } from '@reach/router'
import 'cross-fetch/polyfill' // enables fetch in node
import { Request, Response } from 'express'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import { Provider as StyletronProvider } from 'styletron-react'
import { App } from '../../web/src/view/App'
import { Config } from './config'

const Styletron = require('styletron-engine-monolithic')

export function renderApp(req: Request, res: Response, schema: any) {
  const apolloClient = new ApolloClient({
    ssrMode: true,
    link: new SchemaLink({schema}),
    cache: new InMemoryCache(),
  })

  const engine = new Styletron.Server()
  const app = (
    <ApolloProvider client={apolloClient}>
      <ServerLocation url={req.url}>
        <StyletronProvider value={engine}>
          <App />
        </StyletronProvider>
      </ServerLocation>
    </ApolloProvider>
  )

  getDataFromTree(app)
    .then(() => {
      const apolloState = apolloClient.extract()
      const body = ReactDOMServer.renderToString(app)
      const styles = engine.getCss()
      const html = ReactDOMServer.renderToString(
        <html>
          <head>
            <meta charSet="utf8" />
            <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="shortcut icon" href={`/app/assets/favicon${Config.isProd ? '' : '-dev'}.ico`} />
            <link rel="stylesheet" href="https://unpkg.com/tachyons@4.12.0/css/tachyons.min.css" />
            <link rel="stylesheet" href="/app/css/app.css" />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.app = {
                serverRendered: true,
                wsUrl: "${Config.wsUrl}",
                commitHash: "${'hash'}",
                isProd: ${Config.isProd},
                apolloState: ${apolloState ? JSON.stringify(apolloState) : 'undefined'}
              }`,
              }}
            />
            <style
              dangerouslySetInnerHTML={{
                __html: styles,
              }}
            />
          </head>
          <body>
            <div id="app" dangerouslySetInnerHTML={{ __html: body }} />
            <script src="/app/js/bundle.js"></script>
          </body>
        </html>
      )

      res.status(200).contentType('text/html').send(html)
    })
    .catch(err => {
      if (isRedirect(err)) {
        return res.redirect(err.uri)
      } else {
        return res.status(500).send(err.stack || err.message)
      }
    })
}

export const staticHtml = `<html lang="en">
  <head>
    <meta charset="utf8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/app/assets/favicon${Config.isProd ? '' : '-dev'}.ico">
    <link rel="stylesheet" href="https://unpkg.com/tachyons@4.12.0/css/tachyons.min.css" />
    <link rel="stylesheet" href="/app/css/app.css" >
    <script>
      window.app = {
        serverRendered: false,
        wsUrl: "${Config.wsUrl}",
        commitHash: "${'hash'}",
        isProd: ${Config.isProd}
      }
    </script>
  </head>
  <body>
    <div id="app" />
    <div id="modal" />
    <script src="/app/js/bundle.js"></script>
  </body>
</html>`
