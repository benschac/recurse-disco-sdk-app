declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test'
      PORT?: 3000
      PWD: string
      RECURSE_CENTER_APP_ID: string
      RECURSE_CENTER_APP_SECRET: string
      RECURSE_CENTER_AUTHORIZE_URL: 'https://recurse.com/oauth/authorize'
      RECURSE_CENTER_TOKEN_URL: 'https://recurse.com/oauth/token'
      RECURSE_CENTER_CALLBACK_URL: 'http://localhost:3000/callback'
      RECUSE_CENTER_API_URL: string
      SESSION_SECRET: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
