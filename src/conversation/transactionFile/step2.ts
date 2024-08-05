import noAttachmentError from '@botMessage/errors/noAttachmentError'
import noBookError from '@botMessage/errors/noBookError'
import upsError from '@botMessage/errors/upsError'
import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import { $Enums } from '@prisma/client'
import openAi from '@utils/openAi'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  if (!ctx.photo && !ctx.document) {
    await noAttachmentError(params)
    return
  }

  const fileType: $Enums.FileType = !!ctx.photo ? 'PHOTO' : 'DOCUMENT'
  const photoLen = ctx.photo?.length || 0

  const fileId = fileType === 'PHOTO' ? ((ctx.photo && ctx.photo[photoLen - 1]) ? ctx.photo[photoLen - 1].file_id : undefined) : ctx.document?.file_id

  if (!fileId) {
    await upsError(params)
    return
  }

  const transactionId = conversation.edit.transactionId

  if (!transactionId) {
    await noBookError(params)
    return
  }

  const items = fileType === 'PHOTO' ? await aiItems(fileId, params) : []

  const success = await xprisma.file.create(user, {
    fileId: fileId,
    fileType: fileType,
    transactionId: transactionId,
    items: {
      createMany: {
        data: items.map(item => ({
          description: item,
        }))
      }
    }
  })

  if (!success) {
    await upsError(params)
    return
  }

  await transactionViewMenuMessage(params, transactionId)
}

async function aiItems(fileId: string, { bot }: ConversationPropsWithBookSelected) {
  let items: string[] = []

  try {
    const fileUrl = await bot.getFileLink(fileId)

    const aiTag = await openAi.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: 'The photo will be either a receipt or some bought items in the photo.',
      }, {
        role: 'system',
        content: `If it's a photo of items, reply with a brief description of EACH item. Like: <Brand Name> Milk,`
      }, {
        role: 'system',
        content: 'If its a receipt your job is to get the items in the reciept, do not get the prices or the total amount, just the items with the name of the product.',
      }, {
        role: 'system',
        content: 'You will reply in json format like this: `{"items": ["item1", "item2", "item3"]}`',
      }, {
        role: 'system',
        content: 'If no items are found, reply with `{"items": []}`',
      }, {
        role: 'user',
        content: [{
          type: 'image_url',
          image_url: {
            url: fileUrl,
            detail: "high"
          }
        }]
      }],
      response_format: { type: 'json_object' },
    })

    if (!!aiTag.choices[0].message?.content) {
      const stringReply = aiTag.choices[0].message.content
      const jsonReply = JSON.parse(stringReply)
      if (jsonReply.items) {
        items = jsonReply.items
      }
    }
  } catch (e) {
    console.error(e)
  }

  return items
}