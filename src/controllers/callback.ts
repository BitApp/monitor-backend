import config from "@src/infrastructure/utils/config";
import {Controller, POST} from "@src/infrastructure/decorators/koa";
import {IRouterContext} from "koa-router";
import {getOnlineUser, redis} from "@src/infrastructure/redis";
import {getSocketIO} from "@src/infrastructure/socket";
import {MEDIA_TYPE, SOCKET_CHANNEL} from "@src/infrastructure/utils/constants";
import {jsonResponse} from "@src/infrastructure/utils/helper";
import {isImage} from "@src/infrastructure/utils/image";
import {isVideo} from "@src/infrastructure/utils/video";
import {mediaProducer} from "@src/services/producer/mediaProducer";
import {getMediaUrl} from "@src/infrastructure/amazon/mediaConvert";
import {ImageAmazonUrl, MediaConvertCache, VideoAmazonUrl} from "@src/interface";


// todo: need to verity the signatures of Amazon SNS messages
@Controller({prefix: "/callback"})
export default class CallbackController {
  @POST("/mediaconvertcomplete/notification")
  async notify(ctx: IRouterContext) {
    const body = ctx.request.body;
    const message = JSON.parse(body.Message);
    const records = message.Records;
    for (const recordItem of records) {
      const fileName = recordItem.s3.object.key;
      const ext = fileName.split(".")[1];
      let redisKey = fileName.split(".")[0];
      // 视频文件有下划线分割"_"，这里把下划线也滤除
      redisKey = redisKey.split("_")[0];
      const data = await redis.get(redisKey);
      if (data) {
        const decodedData: MediaConvertCache = JSON.parse(data);
        if (decodedData.fileCount > 1) {
          decodedData.fileCount--;
          await redis.set(redisKey, JSON.stringify(decodedData));
        } else {
          const io = getSocketIO();
          let msg;
          if (isImage(ext)) {
            const fileName = decodedData.key.replace(config.AWS_MEDIA_CONVERT.imageSourceFolder, "");
            await redis.del(redisKey);
            const urls = (getMediaUrl(MEDIA_TYPE.IMAGE, fileName) as ImageAmazonUrl);
            msg = JSON.stringify({
              type: MEDIA_TYPE.IMAGE,
              key: decodedData.key,
              ...urls,
              fileName,
              owner: decodedData.owner
            });
            await mediaProducer.publish(msg);
          } else if (isVideo(ext)) {
            const fileNameWithoutExt = decodedData.key.split(".")[0].replace(config.AWS_MEDIA_CONVERT.videoSourceFolder, "");
            await redis.del(redisKey);

            const urls = getMediaUrl(MEDIA_TYPE.VIDEO, fileNameWithoutExt) as VideoAmazonUrl;
            msg = JSON.stringify({
              type: MEDIA_TYPE.IMAGE,
              key: decodedData.key,
              ...urls,
              fileName: fileNameWithoutExt,
              owner: decodedData.owner
            });
            await mediaProducer.publish(msg);
          }

          if (decodedData.subscribers.length) {
            for (const uuid of decodedData.subscribers) {
              const sid = await getOnlineUser(uuid);
              if (sid) {
                io.sockets.connected[sid].emit(SOCKET_CHANNEL.MEDIA_CONVERTED, msg);
              }
            }
          }
        }
      }
      ctx.body = jsonResponse();
    }
  }
}
