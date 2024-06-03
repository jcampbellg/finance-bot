import { Category, Statement } from '@prisma/client'
import openAi from '@utils/openAi'

type ErrorJSON = {
  error: string
  reset?: boolean
}

type StatementJSON = Pick<Statement, 'month' | 'year'>

type CategoryJSON = {
  category: string
}

type AmountJSON = {
  amount: number
}

export async function AIStatement(userReply: string): Promise<StatementJSON | ErrorJSON> {
  const botAI = await openAi.chat.completions.create({
    messages: [{
      role: 'system',
      content: 'Reply in spanish'
    }, {
      role: 'system',
      content: `Your job is to get the month and year from the user. The user can type the month in full or in short form.`
    }, {
      role: 'system',
      content: 'You will return these data in JSON format: { "month": <from 1 to 12>, "year": <4 digits number> } or { "error": "error message" }'
    }, {
      role: 'user',
      content: userReply
    }],
    model: 'gpt-4-1106-preview',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 300
  })

  const botMessage = botAI.choices[0].message.content?.trim() || '{"error": "No se pudo procesar la información.", "reset": true}'
  const botMessageJSON: StatementJSON | ErrorJSON = JSON.parse(botMessage)

  return botMessageJSON
}

export async function AIAmount(amount: string): Promise<AmountJSON | ErrorJSON> {
  const botAI = await openAi.chat.completions.create({
    messages: [{
      role: 'system',
      content: 'Reply in spanish'
    }, {
      role: 'system',
      content: `Your job is to get a amount from the user. The user can type the amount in words or numbers. The amount will always be a positive value. Remove the negative sign if it is present.`
    }, {
      role: 'system',
      content: 'The user can also do basic math, like adding, subtracting, multiplying and dividing. You will need to return the result of the operation.'
    }, {
      role: 'system',
      content: 'The user can ask you to get the amount with the taxes (impuesto or ISV in spanish). You will need to return the amount with the taxes. The taxes are 15% of the amount (amount * 0.15).'
    }, {
      role: 'system',
      content: 'You will return these data in JSON format: { "amount": <amount in number>} or { "error": "error message" }'
    }, {
      role: 'user',
      content: amount
    }],
    model: 'gpt-4-1106-preview',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 300
  })
  const botMessage = botAI.choices[0].message.content?.trim() || '{"error": "No se pudo procesar la información.", "reset": true}'
  const botMessageJSON: AmountJSON | ErrorJSON = JSON.parse(botMessage)

  if ('error' in botMessageJSON) {
    return botMessageJSON
  }

  return {
    ...botMessageJSON,
    amount: parseFloat(botMessageJSON.amount.toString())
  }
}

export async function AICategory(allCategories: Category[], userReply: string): Promise<CategoryJSON | ErrorJSON> {
  const botAI = await openAi.chat.completions.create({
    messages: [{
      role: 'system',
      content: 'The conversation is in spanish.'
    }, {
      role: 'system',
      content: 'Your job is to get the category name the user is trying to find.'
    }, {
      role: 'system',
      content: `You will get the category name from this list: [${allCategories.map(c => c.description).join(", ")}]`
    }, {
      role: 'system',
      content: 'Don\'t be to strict with the user input, try to match the category name as best as you can.'
    }, {
      role: 'system',
      content: 'You will return these data in JSON format: { "category": "Category Name based on the list" } or { "error": "error message" }'
    }, {
      role: 'user',
      content: userReply
    }],
    model: 'gpt-4-1106-preview',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 300
  })
  const botMessage = botAI.choices[0].message.content?.trim() || '{"error": "No se pudo procesar la información.", "reset": true}'
  const botMessageJSON: CategoryJSON | ErrorJSON = JSON.parse(botMessage)

  return botMessageJSON
}