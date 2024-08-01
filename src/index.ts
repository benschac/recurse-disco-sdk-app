// Not 💯 why we need to reference up here, just going to leave it alone for now
/// <reference path="../environment.d.ts" />
/**
 * TODO:
 *
 * 1. Fix recurse-center sdk package to include dist dir. currently only getting src and types
 * 2. create login endpoint
 * 3. register applicaiton endpoint with RC OAuth server
 * 4. store 0auth token in memory / or sqlite
 * 5. session / cookie management
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
import OAuth2Strategy, { VerifyCallback, VerifyFunction } from 'passport-oauth2'
import logger from 'morgan'
import { FixMe } from './types'

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
app.use((req, res, next) => {
  console.log(`Received ${req.method} request for ${req.url}`)
  next()
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cookieParser())
app.use(logger('dev'))
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' },
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
console.log(
  process.env.RECURSE_CENTER_APP_ID,
  process.env.RECURSE_CENTER_APP_SECRET
)

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

// app.get('/auth/example', passport.authenticate('oauth2'))
app.get('/auth/recurse', (req: Request, res: Response, next: NextFunction) => {
  console.log('Starting OAuth flow'),
    passport.authenticate('oauth2')(req, res, next)
})

app.post(
  '/callback',
  (req: Request, res: Response, next: NextFunction) => {
    console.log('Callback route reached')
    console.log('Query parameters:', req.query)
    next()
  },
  passport.authenticate('oauth2', { failureRedirect: '/' }),
  (req: Request, res: Response) => {
    console.log('Authentication successful')
    console.log('User:', req.user)
    res.redirect('/')
  }
)
app.post('/login', (req: Request, res: Response) => {
  res.send('login endpoint')
})

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ error: 'An error occurred', details: err.message })
})

app.listen(PORT, () => {
  console.log(`[server]: Server is running at http://localhost:${PORT}`)
})
