import OpenAI from 'openai'
import * as dotenv from 'dotenv'
dotenv.config()

if (process.env.OPEN_AI_KEY === undefined) {
  throw new Error('OPEN_AI_KEY is not defined')
}
const openAiKey = process.env.OPEN_AI_KEY

const openAi = new OpenAI({
  apiKey: openAiKey,
})

export default openAi