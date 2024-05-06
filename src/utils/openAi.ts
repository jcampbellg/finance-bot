import OpenAI from 'openai'
import * as dotenv from 'dotenv'
dotenv.config()

if (process.env.openAiKey === undefined) {
  throw new Error('openAiKey is not defined')
}
const openAiKey = process.env.openAiKey

const openAi = new OpenAI({
  apiKey: openAiKey,
})

export default openAi