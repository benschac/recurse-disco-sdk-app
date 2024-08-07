// Not 💯 why we need to reference up here, just going to leave it alone for now
/// <reference path="../environment.d.ts" />
/**
 * TODO:
 *
 * 1. Fix recurse-center sdk package to include dist dir. currently only getting src and types
 * 2. create login endpoint
 * 3. ✅ register applicaiton endpoint with RC OAuth server
 * 4. ✅ store 0auth token in memory / or sqlite
 * 5. ✅ session / cookie management
 *
 */
import dotenv from 'dotenv'
dotenv.config()
import express, { Express, NextFunction, Request, Response } from 'express'
import session from 'express-session'
import ky from 'ky'
import { URLSearchParams } from 'url'

import cookieParser from 'cookie-parser'
import passport from 'passport'
import OAuth2Strategy, { VerifyCallback } from 'passport-oauth2'
import logger from 'morgan'
import { FixMe } from './types'
const oneDay = 24 * 60 * 60 * 1000

dotenv.config()

const app: Express = express()

const {
  PORT = 3000,
  RECURSE_CENTER_APP_ID,
  RECURSE_CENTER_APP_SECRET,
  RECURSE_CENTER_AUTHORIZE_URL,
  RECURSE_CENTER_TOKEN_URL,
  RECURSE_CENTER_CALLBACK_URL,
  SESSION_SECRET,
} = process.env
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(logger('dev'))

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: oneDay,
    },
  })
)

app.use(passport.initialize())
app.use(passport.session())

const requiredEnvVars = [
  'RECURSE_CENTER_APP_ID',
  'RECURSE_CENTER_APP_SECRET',
  'RECURSE_CENTER_AUTHORIZE_URL',
  'RECURSE_CENTER_TOKEN_URL',
  'RECURSE_CENTER_CALLBACK_URL',
  'SESSION_SECRET',
]

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(`Environment variable ${varName} is required`)
  }
}
console.log({
  RECURSE_CENTER_APP_ID,
  RECURSE_CENTER_APP_SECRET,
  RECURSE_CENTER_AUTHORIZE_URL,
  RECURSE_CENTER_TOKEN_URL,
  RECURSE_CENTER_CALLBACK_URL,
})

const rc0AuthStrategy = new OAuth2Strategy(
  {
    authorizationURL: RECURSE_CENTER_AUTHORIZE_URL,
    tokenURL: RECURSE_CENTER_TOKEN_URL,
    clientID: RECURSE_CENTER_APP_ID,
    clientSecret: RECURSE_CENTER_APP_SECRET,
    callbackURL: RECURSE_CENTER_CALLBACK_URL,
  },
  (
    accessToken: string,
    refreshToken: string,
    profile: FixMe,
    done: VerifyCallback
  ) => {
    console.log('OAuth strategy callback reached')
    console.log('Access Token:', accessToken)
    console.log('Refresh Token:', refreshToken)
    console.log('Profile:', profile)
    done(null, { accessToken, refreshToken, profile })
  }
)
rc0AuthStrategy.error = (err) => {
  console.error('OAuth2Strategy Error:', err)
  if (err.oauthError) {
    console.error('OAuth Error:', err.oauthError.data)
  }
}
if (!RECURSE_CENTER_APP_ID || !RECURSE_CENTER_APP_SECRET) {
  throw new Error(
    'RECURSE_CENTER_APP_ID and RECURSE_CENTER_APP_SECRET are required'
  )
}

passport.use(rc0AuthStrategy)
// Serialize user for storing in session
passport.serializeUser((user: Express.User, done) => {
  console.log('Serializing user:', user)

  done(null, user)
})

// Deserialize user from session
passport.deserializeUser((user: Express.User, done) => {
  console.log('Deserializing user:', user)
  done(null, user)
})

app.get('/', (req: Request, res: Response) => {
  res.send('hello disco')
})

app.get('/auth', passport.authenticate('oauth2'))
app.get(
  '/callback',
  passport.authenticate('oauth2', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/')
  }
)

app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.send('authed!')
  } else {
    res.send('not authed')
  }
})

async function authedicatedRequest(url: string, accessToken: string) {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    console.log(`Response status: ${res.status}`)
    console.log(`Response headers:`, Object.fromEntries(res.headers.entries()))

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }
    const data = await res.json()
    console.log(data, 'data')
    return data
  } catch (e) {
    if (e instanceof Error) {
      console.error(`Error from authedRequest: ${e?.message}`)
      throw e
    }
  }
}

async function ensureAuthenticated(req: any, res: any, next: any) {
  console.log('Checking authentication', {
    isAuthenticated: req.isAuthenticated(),
  })

  if (req.isAuthenticated()) {
    return next()
  }
  res.status(401).json({ error: 'Unauthed' })
}

app.get('/batch', ensureAuthenticated, async (req: any, res) => {
  console.log(req.user.accessToken, 'hiiiiiii')
  try {
    const batch = await authedicatedRequest(
      'http://www.recurse.com/api/v1/batches',
      req.user.accessToken
    )
    if (!res.headersSent) {
      res.json(batch)
    }
  } catch (e) {
    if (e instanceof Error) {
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: 'Failed to fetch user data', details: e.message })
      } else {
        console.error('Headers already sent, unable to send error response')
      }
      console.error(e)
    }
  }
})

// Test route to check authentication status
app.get('/auth-status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ authenticated: true, user: req.user })
  } else {
    res.json({ authenticated: false })
  }
})

// Token refresh middleware
const refreshAccessToken = async (req: any, res: any, next: any) => {
  if (req.user && req.user.refreshToken) {
    // Check if access token is expired or close to expiration
    const tokenExpirationTime = req.user.tokenExpirationTime || 0
    if (Date.now() >= tokenExpirationTime - 5 * 60 * 1000) {
      // Refresh if within 5 minutes of expiration
      try {
        // Implement your token refresh logic here
        // This is a placeholder and needs to be implemented based on your OAuth2 provider
        const response = await fetch(RECURSE_CENTER_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: req.user.refreshToken,
            client_id: RECURSE_CENTER_APP_ID,
            client_secret: RECURSE_CENTER_APP_SECRET,
          }),
        })

        const data = await response.json()
        req.user.accessToken = data.access_token
        req.user.refreshToken = data.refresh_token || req.user.refreshToken
        req.user.tokenExpirationTime = Date.now() + data.expires_in * 1000
      } catch (error) {
        console.error('Failed to refresh access token', error)
        return next(error)
      }
    }
  }
  next()
}

app.use(refreshAccessToken)
app.get(
  '/callback',
  (req: Request, res: Response, next: NextFunction) => {
    console.log('Callback route reached')
    console.log('Query parameters:', req.query)
    next()
  },
  passport.authenticate('oauth2', { failureRedirect: '/login' }),
  (req: Request, res: Response) => {
    console.log('Authentication successful')
    console.log('User:', req.user)
    res.redirect('/')
  }
)

app.get('/login', (req: Request, res: Response) => {
  res.send('login endpoint')
})
app.get('/wow', (req: Request, res: Response) => {
  res.send('wow')
})

app.get('/test', async (req: Request, res: Response) => {
  console.log(req.query)
  res.send('Test route working')
})

app.get('/batches', async (req: Request, res: Response) => {
  const params = new URLSearchParams({
    limit: '10',
  })
  const { user } = req
  console.log(user)
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  console.log('hello world hiiiiiiii')
  const response = await ky
    .get('https://www.recurse.com/api/v1/batches', {
      searchParams: params,
      headers: {
        // @ts-expect-error
        Authorization: `Bearer ${user.accessToken}`,
      },
    })
    .json()
  console.log(response)
  res.json(response)
})

app.get('/thing', async (req: Request, res: Response) => {
  res.send('thing')
})

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err)
  // Check if headers have not been sent yet
  if (!res.headersSent) {
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: err.message })
  } else {
    console.error('Headers already sent, unable to send error response')
  }
})

app.listen(PORT, () => {
  console.log(`[server]: Server is running at http://localhost:${PORT}`)
})
