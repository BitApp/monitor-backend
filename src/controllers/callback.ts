// @ts-ignore
import config from "config";
import { Controller, POST } from "@src/infrastructure/decorators/koa";
import { IRouterContext } from "koa-router";
import { redis } from "@src/infrastructure/redis";
import { getSocketIO } from "@src/infrastructure/socket";
import { SOCKET_CHANNEL } from "@src/infrastructure/utils/constants";
import { jsonResponse } from "@src/infrastructure/utils/helper";
import { isImage } from "@src/infrastructure/utils/image";
import { isVideo } from "@src/infrastructure/utils/video";


// todo: need to verity the signatures of Amazon SNS messages
@Controller({ prefix: "/callback" })
export default class CallbackController {
  @POST("/mediaconvertcomplete/notification")
  async notify(ctx: IRouterContext) {
    const body = ctx.request.body;
    const message = JSON.parse(body.Message);
    const records = message.Records;
    for(let recordItem of records){
      const fileName = recordItem.s3.object.key;
      const key = fileName.split(".")[0];
      const ext = fileName.split(".")[1];
      const data = await redis.get(key);
      console.log("callbackKey", key, data);
      if (data) {
        const decodedData = JSON.parse(data);
        if (decodedData.fileCount > 1) {
          decodedData.fileCount --;
          await redis.set(key, JSON.stringify(decodedData));
        } else {
          // all files have been converted successfully
          // 这里需要根据类型入库
          // 转换成功发送给订阅者
          if (decodedData.subscribers.length) {
            const io = getSocketIO();
            if (isImage(ext)) {
              const fileName = decodedData.key.replace(config.AWS_IMAGE_CONVERT.imageSourceFolder, "");
              await redis.del(key);
              for(let socketId of decodedData.subscribers) {
                io.sockets.connected[socketId].emit(SOCKET_CHANNEL.MEDIA_CONVERTED, JSON.stringify({
                  key: decodedData.key,
                  url: config.AWS_S3.imagePrefix + "/" + fileName,
                }));
              }
            } else if(isVideo(ext)) {
              const fileNameWithoutExt = decodedData.key.split(".")[0].replace(config.AWS_MEDIA_CONVERT.videoSourceFolder, "");
              await redis.del(key);
              for(let socketId of decodedData.subscribers){
                io.sockets.connected[socketId].emit(SOCKET_CHANNEL.MEDIA_CONVERTED, JSON.stringify({
                  key: decodedData.key,
                  screenshot: config.AWS_S3.videoPrefix + decodedData.purpose + "/" + fileNameWithoutExt + config.AWS_S3.screenshotSuffix,
                  low: config.AWS_S3.videoPrefix + decodedData.purpose + "/" + fileNameWithoutExt + config.AWS_S3.lowSuffix,
                  hd: config.AWS_S3.videoPrefix + decodedData.purpose + "/" + fileNameWithoutExt + config.AWS_S3.hdSuffix
                }));
              }
            }
          }
        }
      }
      ctx.body = jsonResponse();
    }
  }
}