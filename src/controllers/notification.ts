import {Controller, GET, POST} from "@src/infrastructure/decorators/koa";
import {AuthRequired} from "@src/infrastructure/decorators/auth";
import {IRouterContext} from "koa-router";
import UserModel from "@src/models/user";
import NotificationModel from "@src/models/notification";
import {jsonResponse} from "@src/infrastructure/utils";
import {RESPONSE_CODE} from "@src/infrastructure/utils/constants";

@Controller({prefix: "/notification"})
export default class Notification {
  @GET("/unread")
  @AuthRequired()
  async unReadNum(ctx: IRouterContext) {
    const uuid = ctx.state.user.uuid;
    const user = await UserModel.findOne({uuid})
    const unreadNum = await NotificationModel.find({uuid, createAt: {$gt: user!.notificationTime || 0}})
    ctx.body = jsonResponse({code: RESPONSE_CODE.NORMAL, data: unreadNum})
  }
}