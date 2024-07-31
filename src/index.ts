/**
 * TODO:
 *
 * 1. Fix recurse-center sdk package to include dist dir. currently only getting src and types
 * 2. create login endpoint
 * 3. register applicaiton endpoint with RC OAuth server
 *
 *
 */
import express, { Express, Request, Response } from 'express'
import dotenv from 'dotenv'

dotenv.config()

const app: Express = express()
const port = process.env.PORT ?? 3000

app.get('/', (req: Request, res: Response) => {
  res.send('hello disco')
})

app.post('/login', (req: Request, res: Response) => {
  res.send('login endpoint')
})

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`)
})
