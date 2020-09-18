import config from "@src/infrastructure/utils/config";
import {Consumer} from "@src/infrastructure/rabbitMq";
import {
  JUSTFANS_EXCHANGE, MEDIA_TYPE,
  MESSAGE_ROUTING_KEY,
  RABBITMQ_EXCHANGE_TYPE, SAVE_MESSAGE_QUEUE, SOCKET_CHANNEL,
} from "@src/infrastructure/utils/constants";
import MessageModel from "@src/models/message"
import {getMediaFileName, getMediaUrl} from "@src/infrastructure/amazon/mediaConvert";
import {Message} from "@src/interface";
import {getOnlineUser, redis} from "@src/infrastructure/redis";
import {mediaType} from "@src/infrastructure/utils";
import {getSocketIO} from "@src/infrastructure/socket";
import SocketIO from "socket.io";

export async function loadSaveAndSendMessageConsumer() {
  const io = getSocketIO();

  const consumer = new Consumer(SAVE_MESSAGE_QUEUE, MESSAGE_ROUTING_KEY, JUSTFANS_EXCHANGE);
  await consumer.connection(config.RABBITMQ, RABBITMQ_EXCHANGE_TYPE.DIRECT);

  await consumer.consume(async msg => {
    const tmp = JSON.parse(msg);
    console.log('save and send message:', msg);
    const message = await saveMessage(tmp as Message);
    if (message) {
      await sendMessage({...tmp, _id: message._id}, io)
    }
  })
}

async function saveMessage(message: Message) {
  const media: string[] = message.media.map((item: any) => {
    return item.key ? getMediaFileName(item.type, item.key) : item.fileName
  });
  if (message.content.trim() !== "" || media.length > 0) {
    return await MessageModel.create({
      from: message.from,
      to: message.to,
      price: message.price || 0,
      content: message.content,
      media: media
    })
  }
}

async function sendMessage(message: Message, io: SocketIO.Server) {
  const toSid = await getOnlineUser(message.to);
  for (const media of message.media) {
    if (!media.ready) {
      // 媒体未完成转换
      const ext = media.key!.split(".")[1];
      const mediaInfo = mediaType(ext)
      const fileNameWithoutExt = media.key!.split(".")[0].replace(config.AWS_MEDIA_CONVERT[mediaInfo.sourceFolder], "");
      const data = await redis.get(config.AWS_MEDIA_CONVERT[mediaInfo.confKey] + fileNameWithoutExt);
      if (data) {
        const decodedData = JSON.parse(data);
        decodedData.subscribers.push(message.to);
        console.log('add subscribers', message.to);
        await redis.set(config.AWS_MEDIA_CONVERT[mediaInfo.confKey] + fileNameWithoutExt, JSON.stringify(decodedData));
      } else {
        message.media.forEach(media => {
          media.ready = true;
          switch (media.type) {
            case MEDIA_TYPE.IMAGE:
              media.urls = getMediaUrl(MEDIA_TYPE.IMAGE, media.key!.split("/")[1]);
              break;
            case MEDIA_TYPE.VIDEO:
              media.urls = getMediaUrl(MEDIA_TYPE.VIDEO, media.key!.split("/")[1].split(".")[0]);
          }
        })
      }
    }
  }
  if (toSid) {
    io.sockets.connected[toSid].emit(SOCKET_CHANNEL.CHAT_MESSAGE, JSON.stringify(message))
  }
}
